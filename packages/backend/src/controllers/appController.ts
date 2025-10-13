import { randomUUID } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { Database, App, SuggestionRecord } from '../db/database';
import { PlannerService } from '../services/plannerService';
import { SandboxService } from '../services/sandboxService';
import { logger } from '../observability/logger';

export class AppController {
  private db: Database;
  private plannerService: PlannerService;
  private sandboxService: SandboxService;

  constructor() {
    this.db = Database.getInstance();
    this.plannerService = new PlannerService();
    this.sandboxService = new SandboxService();
  }

  async generateApp(prompt: string, context?: any, correlationId = 'unknown'): Promise<any> {
    const appId = uuidv4();
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

      return this.getApp(appId);
    } catch (error) {
      this.db.updateApp(appId, { status: 'error' });
      logger.error('Failed to generate app', {
        correlationId,
        message: (error as Error).message,
      });
      throw error;
    }
  }

  getApp(appId: string): any | null {
    const app = this.db.getApp(appId);
    if (!app) return null;

    return {
      id: app.id,
      name: app.name,
      prompt: app.prompt,
      status: app.status,
      previewUrl: app.previewUrl,
      code: JSON.parse(app.code),
      metadata: JSON.parse(app.metadata),
      createdAt: app.createdAt,
      updatedAt: app.updatedAt
    };
  }

  listApps(limit: number, offset: number): { apps: any[]; total: number } {
    const result = this.db.listApps(limit, offset);
    
    return {
      apps: result.apps.map(app => ({
        id: app.id,
        name: app.name,
        prompt: app.prompt,
        status: app.status,
        previewUrl: app.previewUrl,
        code: JSON.parse(app.code),
        metadata: JSON.parse(app.metadata),
        createdAt: app.createdAt,
        updatedAt: app.updatedAt
      })),
      total: result.total
    };
  }

  async modifyApp(appId: string, prompt?: string, changes?: any, correlationId = 'unknown'): Promise<any | null> {
    const app = this.db.getApp(appId);
    if (!app) return null;

    try {
      let newCode;
      
      if (prompt) {
        const result = await this.plannerService.analyzeModification(
          prompt,
          JSON.parse(app.code),
          JSON.parse(app.metadata),
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
        message: (error as Error).message,
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
        message: (error as Error).message,
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
  ): Promise<SuggestionRecord[]> {
    const app = this.db.getApp(appId);
    if (!app) return [];

    try {
      const result = await this.plannerService.infer({
        action,
        target,
        data,
        context: JSON.parse(app.metadata),
        currentCode: JSON.parse(app.code)
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

  async applySuggestion(appId: string, suggestionId: string, correlationId = 'unknown'): Promise<any | null> {
    const suggestion = this.db.getSuggestion(appId, suggestionId);
    const app = this.db.getApp(appId);

    if (!suggestion || !app) {
      return null;
    }

    const currentCode = JSON.parse(app.code).files || {};
    const updatedFiles = { ...currentCode, ...suggestion.changes };

    await this.sandboxService.update(appId, updatedFiles, correlationId);

    this.db.updateApp(appId, {
      code: JSON.stringify({ files: updatedFiles })
    });

    this.db.clearSuggestions(appId);

    return this.getApp(appId);
  }

  private generateAppName(prompt: string): string {
    const words = prompt.split(' ').slice(0, 3);
    return words.map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
  }
}
