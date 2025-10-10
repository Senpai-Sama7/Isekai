import { v4 as uuidv4 } from 'uuid';
import ZAI from 'z-ai-web-dev-sdk';
import { GeneratedApp, PerceptionResult, UIComponent } from '@isekai/types';
import { winstonLogger } from '../utils/logger';
import { CodeTemplateManager } from './code-template-manager';
import { CodeValidator } from './code-validator';

export class SynthesisService {
  private templateManager: CodeTemplateManager;
  private codeValidator: CodeValidator;

  constructor() {
    this.templateManager = new CodeTemplateManager();
    this.codeValidator = new CodeValidator();
  }

  async generateCode(prompt: string, perceptionResult?: PerceptionResult): Promise<GeneratedApp> {
    const startTime = Date.now();
    
    try {
      winstonLogger.info('Starting AI-powered code generation', { 
        prompt: prompt.substring(0, 100) 
      });

      const zai = await ZAI.create();

      // Build comprehensive prompt for AI
      const aiPrompt = this.buildAIPrompt(prompt, perceptionResult);
      
      // Generate code using AI
      const completion = await zai.chat.completions.create({
        messages: [
          {
            role: 'system',
            content: this.getSystemPrompt()
          },
          {
            role: 'user',
            content: aiPrompt
          }
        ],
        temperature: 0.7,
        max_tokens: 4000
      });

      const aiResponse = completion.choices[0]?.message?.content;
      if (!aiResponse) {
        throw new Error('AI model returned empty response');
      }

      // Parse AI response into structured app
      const generatedApp = await this.parseAIResponse(aiResponse, prompt);
      
      // Validate generated code
      await this.codeValidator.validateApp(generatedApp);

      const duration = Date.now() - startTime;
      winstonLogger.info('Code generation completed', { 
        appId: generatedApp.id,
        fileCount: generatedApp.files.length,
        duration 
      });

      return generatedApp;

    } catch (error) {
      winstonLogger.error('Code generation failed', error);
      
      // Fallback to template-based generation
      return this.generateFromTemplate(prompt, perceptionResult);
    }
  }

  async repairCode(app: GeneratedApp, error: string, logs: string[]): Promise<GeneratedApp> {
    try {
      winstonLogger.info('Starting AI-powered code repair', { 
        appId: app.id,
        error: error.substring(0, 100) 
      });

      const zai = await ZAI.create();

      // Build repair prompt
      const repairPrompt = this.buildRepairPrompt(app, error, logs);
      
      const completion = await zai.chat.completions.create({
        messages: [
          {
            role: 'system',
            content: this.getRepairSystemPrompt()
          },
          {
            role: 'user',
            content: repairPrompt
          }
        ],
        temperature: 0.3,
        max_tokens: 4000
      });

      const aiResponse = completion.choices[0]?.message?.content;
      if (!aiResponse) {
        throw new Error('AI model returned empty repair response');
      }

      // Parse repair response
      const repairedApp = await this.parseAIResponse(aiResponse, `Repair: ${error}`);
      
      // Validate repaired code
      await this.codeValidator.validateApp(repairedApp);

      winstonLogger.info('Code repair completed', { 
        appId: repairedApp.id 
      });

      return repairedApp;

    } catch (error) {
      winstonLogger.error('Code repair failed', error);
      throw new Error(`Code repair failed: ${error.message}`);
    }
  }

  private buildAIPrompt(prompt: string, perceptionResult?: PerceptionResult): string {
    let aiPrompt = `Generate a complete Next.js 15 application for: "${prompt}"\n\n`;

    if (perceptionResult) {
      aiPrompt += `UI Components identified:\n`;
      perceptionResult.components.forEach((component: UIComponent) => {
        aiPrompt += `- ${component.type}: ${JSON.stringify(component.properties)}\n`;
      });
      aiPrompt += `Layout: ${perceptionResult.layout}\n`;
      aiPrompt += `Interactions: ${perceptionResult.interactions.join(', ')}\n\n`;
    }

    aiPrompt += `Requirements:
1. Use Next.js 15 with App Router
2. Use TypeScript
3. Use Tailwind CSS for styling
4. Use shadcn/ui components where appropriate
5. Make it responsive and accessible
6. Include proper error handling
7. Add loading states
8. Make it production-ready

Please provide the complete application structure as JSON with the following format:
{
  "files": [
    {
      "path": "package.json",
      "content": "...",
      "language": "json"
    },
    {
      "path": "src/app/page.tsx",
      "content": "...",
      "language": "typescript"
    }
    // ... more files
  ],
  "dependencies": {
    "react": "^18.0.0",
    // ... more dependencies
  },
  "metadata": {
    "framework": "Next.js",
    "language": "TypeScript",
    "entryPoint": "src/app/page.tsx"
  }
}

Focus on creating a functional, well-structured application that works out of the box.`;

    return aiPrompt;
  }

  private buildRepairPrompt(app: GeneratedApp, error: string, logs: string[]): string {
    return `Please repair the following Next.js application that has this error: "${error}"

Application files:
${app.files.map(f => `File: ${f.path}\n\`\`\`${f.language}\n${f.content}\n\`\`\``).join('\n\n')}

Execution logs:
${logs.join('\n')}

Please provide the fixed application structure in the same JSON format as before.
Focus on fixing the specific error while maintaining the application's functionality.`;
  }

  private getSystemPrompt(): string {
    return `You are an expert Next.js developer who specializes in creating complete, production-ready applications from natural language descriptions.

Your strengths:
- Deep knowledge of Next.js 15 with App Router
- TypeScript expertise
- Tailwind CSS and shadcn/ui mastery
- Responsive design principles
- Accessibility best practices
- Performance optimization
- Error handling patterns

Always provide complete, working code that follows best practices.
Include all necessary files (package.json, components, pages, etc.).
Make sure the application is self-contained and ready to run.`;
  }

  private getRepairSystemPrompt(): string {
    return `You are an expert Next.js developer who specializes in debugging and fixing applications.

Your process:
1. Analyze the error and logs carefully
2. Identify the root cause
3. Fix the issue while preserving functionality
4. Ensure the fix follows best practices
5. Provide the complete corrected application

Focus on making minimal, targeted fixes that resolve the specific issue.`;
  }

  private async parseAIResponse(aiResponse: string, originalPrompt: string): Promise<GeneratedApp> {
    try {
      // Try to extract JSON from AI response
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in AI response');
      }

      const appData = JSON.parse(jsonMatch[0]);
      
      // Validate required fields
      if (!appData.files || !Array.isArray(appData.files)) {
        throw new Error('Invalid files structure in AI response');
      }

      if (!appData.dependencies || typeof appData.dependencies !== 'object') {
        throw new Error('Invalid dependencies structure in AI response');
      }

      return {
        id: uuidv4(),
        files: appData.files,
        dependencies: appData.dependencies,
        metadata: {
          framework: appData.metadata?.framework || 'Next.js',
          language: appData.metadata?.language || 'TypeScript',
          entryPoint: appData.metadata?.entryPoint || 'src/app/page.tsx'
        }
      };

    } catch (error) {
      winstonLogger.error('Failed to parse AI response', error);
      throw new Error(`Invalid AI response format: ${error.message}`);
    }
  }

  private async generateFromTemplate(prompt: string, perceptionResult?: PerceptionResult): Promise<GeneratedApp> {
    winstonLogger.info('Using template-based generation as fallback');
    
    // Simple template-based generation for common patterns
    if (prompt.toLowerCase().includes('csv') && prompt.toLowerCase().includes('viewer')) {
      return this.templateManager.generateCSVViewer(prompt, perceptionResult);
    }
    
    // Default template
    return this.templateManager.generateDefaultApp(prompt, perceptionResult);
  }
}