import { randomUUID } from 'crypto';
import { Database, App, SuggestionRecord } from '../db/database';
import { PlannerService } from '../services/plannerService';
import { SandboxService } from '../services/sandboxService';
import { logger } from '../observability/logger';
import { safeJsonParse } from '../utils/security';
import type {
  AppResponse,
  AppCode,
  AppMetadata,
  Suggestion
} from '../types/api';

export class AppController {
  private db: Database;
  private plannerService: PlannerService;
  private sandboxService: SandboxService;

  constructor() {
    this.db = Database.getInstance();
    this.plannerService = new PlannerService();
    this.sandboxService = new SandboxService();
  }

  async generateApp(prompt: string, context?: any, correlationId = 'unknown'): Promise<AppResponse> {
    const appId = randomUUID();
    const now = new Date().toISOString();

    // Create initial app record
    const app: App = {
      id: appId,
      name: this.generateAppName(prompt),
      prompt,
      status: 'generating',
      code: JSON.stringify({ files: {} }),
      metadata: JSON.stringify({ context }),
      createdAt: now,
      updatedAt: now
    };

    this.db.createApp(app);

    // Generate code via planner service
    try {
      const result = await this.plannerService.analyze(prompt, context, correlationId);

      // Execute in sandbox
      const sandboxResult = await this.sandboxService.execute(appId, result.code.files, correlationId);
      
      // Update app with results
      this.db.updateApp(appId, {
        status: 'running',
        code: JSON.stringify({ files: result.code.files }),
        previewUrl: sandboxResult.url,
        metadata: JSON.stringify({ 
          context, 
          intent: result.intent,
          components: result.components 
        })
      });

      const finalApp = this.getApp(appId);
      if (!finalApp) {
        throw new Error('Failed to retrieve generated app');
      }
      return finalApp;
    } catch (error) {
      this.db.updateApp(appId, { status: 'error' });
      logger.error('Failed to generate app', {
        correlationId,
        errorMessage: (error as Error).message,
        stack: (error as Error).stack,
      });
      throw error;
    }
  }

  getApp(appId: string): AppResponse | null {
    const app = this.db.getApp(appId);
    if (!app) return null;

    const code = safeJsonParse<AppCode>(app.code, { files: {} });
    const metadata = safeJsonParse<AppMetadata>(app.metadata, {});

    return {
      id: app.id,
      name: app.name,
      prompt: app.prompt,
      status: app.status,
      previewUrl: app.previewUrl,
      code,
      metadata,
      createdAt: app.createdAt,
      updatedAt: app.updatedAt
    };
  }

  listApps(limit: number, offset: number): { apps: AppResponse[]; total: number } {
    const result = this.db.listApps(limit, offset);

    return {
      apps: result.apps.map(app => {
        const code = safeJsonParse<AppCode>(app.code, { files: {} });
        const metadata = safeJsonParse<AppMetadata>(app.metadata, {});

        return {
          id: app.id,
          name: app.name,
          prompt: app.prompt,
          status: app.status,
          previewUrl: app.previewUrl,
          code,
          metadata,
          createdAt: app.createdAt,
          updatedAt: app.updatedAt
        };
      }),
      total: result.total
    };
  }

  async modifyApp(appId: string, prompt?: string, changes?: any, correlationId = 'unknown'): Promise<AppResponse | null> {
    const app = this.db.getApp(appId);
    if (!app) return null;

    try {
      let newCode;

      if (prompt) {
        const currentCode = safeJsonParse<AppCode>(app.code, { files: {} });
        const metadata = safeJsonParse<AppMetadata>(app.metadata, {});

        const result = await this.plannerService.analyzeModification(
          prompt,
          currentCode,
          metadata,
          correlationId
        );
        newCode = result.code.files;
      } else if (changes) {
        newCode = changes;
      } else {
        return this.getApp(appId);
      }

      // Update in sandbox
      await this.sandboxService.update(appId, newCode, correlationId);
      
      // Update database
      this.db.updateApp(appId, {
        code: JSON.stringify({ files: newCode })
      });

      return this.getApp(appId);
    } catch (error) {
      logger.error('Error modifying app', {
        correlationId,
        errorMessage: (error as Error).message,
        stack: (error as Error).stack,
      });
      throw error;
    }
  }

  async deleteApp(appId: string, correlationId = 'unknown'): Promise<boolean> {
    const app = this.db.getApp(appId);
    if (!app) return false;

    try {
      await this.sandboxService.stop(appId, correlationId);
    } catch (error) {
      logger.warn('Error stopping app in sandbox', {
        correlationId,
        errorMessage: (error as Error).message,
      });
    }

    return this.db.deleteApp(appId);
  }

  async trackAction(
    appId: string,
    action: string,
    target: string,
    data: any,
    correlationId = 'unknown'
  ): Promise<Suggestion[]> {
    const app = this.db.getApp(appId);
    if (!app) {
      logger.warn('App not found for trackAction', { appId, correlationId });
      return [];
    }

    try {
      const metadata = safeJsonParse<AppMetadata>(app.metadata, {});
      const currentCode = safeJsonParse<AppCode>(app.code, { files: {} });

      const result = await this.plannerService.infer({
        action,
        target,
        data,
        context: metadata,
        currentCode
      }, correlationId);

      const suggestions = (result.suggestions || []).map((suggestion: any) => {
        const id = suggestion.id || randomUUID();
        const title = suggestion.title || 'Suggestion';
        const description = suggestion.description || 'No description provided';
        const changes = suggestion.changes || {};

        const record: SuggestionRecord = {
          id,
          appId,
          title,
          description,
          changes,
          createdAt: new Date().toISOString()
        };

        return record;
      });

      this.db.saveSuggestions(appId, suggestions);

      return suggestions;
    } catch (error) {
      logger.warn('Error inferring from action', {
        correlationId,
        errorMessage: (error as Error).message,
      });
      return [];
    }
  }

  async applySuggestion(appId: string, suggestionId: string, correlationId = 'unknown'): Promise<AppResponse | null> {
    const suggestion = this.db.getSuggestion(appId, suggestionId);
    const app = this.db.getApp(appId);

    if (!suggestion || !app) {
      logger.warn('Suggestion or app not found', { appId, suggestionId, correlationId });
      return null;
    }

    const code = safeJsonParse<AppCode>(app.code, { files: {} });
    const currentCode = code.files || {};
    const updatedFiles = { ...currentCode, ...suggestion.changes };

    await this.sandboxService.update(appId, updatedFiles, correlationId);

    this.db.updateApp(appId, {
      code: JSON.stringify({ files: updatedFiles })
    });

    this.db.clearSuggestions(appId);

    return this.getApp(appId);
  }

  private generateAppName(prompt: string): string {
    // Extract meaningful words, filter out common words
    const commonWords = new Set(['a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should', 'could', 'may', 'might', 'can']);

    const words = prompt
      .split(/\s+/)
      .map(w => w.replace(/[^a-zA-Z0-9]/g, ''))
      .filter(w => w.length > 0 && !commonWords.has(w.toLowerCase()))
      .slice(0, 3);

    if (words.length === 0) {
      return 'Isekai App';
    }

    return words
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');
  }

  async analyzeInteractions(interactions: any[], correlationId = 'unknown'): Promise<Suggestion[]> {
    try {
      // Analyze interaction patterns to generate suggestions
      const patterns = this.extractPatterns(interactions);
      const suggestions: Suggestion[] = [];

      // Pattern 1: Frequent file viewing suggests adding related features
      if (patterns.fileViews && patterns.fileViews.length > 3) {
        suggestions.push({
          id: randomUUID(),
          title: 'Add Code Navigation',
          description: 'Based on your frequent code viewing, consider adding code navigation features like search, jump-to-definition, or file tree.',
          changes: {},
          modificationPrompt: 'Add enhanced code navigation features including search functionality'
        });
      }

      // Pattern 2: Multiple app creations suggest template or quick-start feature
      if (patterns.appGenerations > 2) {
        suggestions.push({
          id: randomUUID(),
          title: 'Create Templates',
          description: 'You\'ve generated multiple apps. Consider saving your favorite patterns as reusable templates.',
          changes: {},
          modificationPrompt: 'Add template management system for quick app generation'
        });
      }

      // Pattern 3: Error patterns suggest debugging tools
      if (patterns.errors > 0) {
        suggestions.push({
          id: randomUUID(),
          title: 'Enhanced Error Display',
          description: 'We noticed some errors. Add better error visualization and debugging tools to help troubleshoot issues.',
          changes: {},
          modificationPrompt: 'Add comprehensive error display and debugging features'
        });
      }

      return suggestions;
    } catch (error) {
      logger.error('Error analyzing interactions', {
        correlationId,
        errorMessage: (error as Error).message,
      });
      return [];
    }
  }

  async getSuggestions(appId: string, interactions: any[], correlationId = 'unknown'): Promise<Suggestion[]> {
    const app = this.db.getApp(appId);
    if (!app) {
      logger.warn('App not found for getSuggestions', { appId, correlationId });
      return [];
    }

    try {
      const metadata = safeJsonParse<AppMetadata>(app.metadata, {});
      const currentCode = safeJsonParse<AppCode>(app.code, { files: {} });
      const patterns = this.extractPatterns(interactions);

      const suggestions: Suggestion[] = [];

      // Suggestion 1: Based on file expansion patterns
      if (patterns.expandedFiles && patterns.expandedFiles.length > 0) {
        const mostViewedFile = patterns.expandedFiles[0];
        suggestions.push({
          id: randomUUID(),
          title: `Enhance ${mostViewedFile}`,
          description: `You've been viewing ${mostViewedFile} frequently. Would you like to add more features or improve its functionality?`,
          changes: {},
          modificationPrompt: `Enhance the ${mostViewedFile} file with additional features and improvements`
        });
      }

      // Suggestion 2: Based on preview opens
      if (patterns.previewOpens > 2) {
        suggestions.push({
          id: randomUUID(),
          title: 'Add Live Reload',
          description: 'You frequently open the preview. Consider adding live reload for instant feedback on changes.',
          changes: {},
          modificationPrompt: 'Add live reload functionality to automatically refresh preview on code changes'
        });
      }

      // Suggestion 3: Based on time spent on app
      if (patterns.duration && patterns.duration > 300000) { // 5 minutes
        suggestions.push({
          id: randomUUID(),
          title: 'Add Advanced Features',
          description: 'You\'ve spent significant time with this app. Consider adding advanced features like data persistence, authentication, or API integration.',
          changes: {},
          modificationPrompt: 'Enhance app with advanced features based on current functionality'
        });
      }

      // Suggestion 4: Generic improvement based on app type
      const appType = metadata.intent || 'application';
      suggestions.push({
        id: randomUUID(),
        title: 'Optimize Performance',
        description: `Based on your ${appType}, we can optimize performance with caching, lazy loading, and efficient rendering.`,
        changes: {},
        modificationPrompt: 'Optimize app performance with caching and efficient rendering strategies'
      });

      return suggestions.slice(0, 3); // Return top 3 suggestions
    } catch (error) {
      logger.error('Error getting suggestions', {
        correlationId,
        errorMessage: (error as Error).message,
      });
      return [];
    }
  }

  private extractPatterns(interactions: any[]): any {
    const patterns: any = {
      fileViews: [],
      expandedFiles: [],
      appGenerations: 0,
      errors: 0,
      previewOpens: 0,
      duration: 0,
    };

    const fileViewCount: Record<string, number> = {};
    let startTime: Date | null = null;
    let endTime: Date | null = null;

    for (const interaction of interactions) {
      if (interaction.timestamp) {
        const time = new Date(interaction.timestamp);
        if (!startTime || time < startTime) startTime = time;
        if (!endTime || time > endTime) endTime = time;
      }

      switch (interaction.action) {
        case 'expand':
          if (interaction.data && interaction.data.filename) {
            patterns.expandedFiles.push(interaction.data.filename);
            fileViewCount[interaction.data.filename] = (fileViewCount[interaction.data.filename] || 0) + 1;
          }
          break;
        case 'view':
          patterns.fileViews.push(interaction);
          break;
        case 'generate':
          patterns.appGenerations++;
          break;
        case 'error':
          patterns.errors++;
          break;
        case 'open':
          if (interaction.target === 'preview_url') {
            patterns.previewOpens++;
          }
          break;
      }
    }

    // Calculate duration
    if (startTime && endTime) {
      patterns.duration = endTime.getTime() - startTime.getTime();
    }

    // Sort expanded files by frequency
    patterns.expandedFiles = Object.entries(fileViewCount)
      .sort(([, a], [, b]) => (b as number) - (a as number))
      .map(([filename]) => filename);

    return patterns;
  }
}
