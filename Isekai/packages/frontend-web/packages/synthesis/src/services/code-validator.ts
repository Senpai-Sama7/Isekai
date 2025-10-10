import { GeneratedApp } from '@imagine/types';
import { winstonLogger } from '../utils/logger';

export class CodeValidator {
  
  async validateApp(app: GeneratedApp): Promise<void> {
    winstonLogger.info('Validating generated application', { appId: app.id });

    // Validate structure
    this.validateStructure(app);

    // Validate files
    this.validateFiles(app);

    // Validate dependencies
    this.validateDependencies(app);

    winstonLogger.info('Application validation passed', { appId: app.id });
  }

  private validateStructure(app: GeneratedApp): void {
    if (!app.id) {
      throw new Error('App ID is required');
    }

    if (!app.files || !Array.isArray(app.files) || app.files.length === 0) {
      throw new Error('App must have at least one file');
    }

    if (!app.dependencies || typeof app.dependencies !== 'object') {
      throw new Error('App must have dependencies object');
    }

    if (!app.metadata) {
      throw new Error('App must have metadata');
    }

    if (!app.metadata.framework) {
      throw new Error('App metadata must specify framework');
    }

    if (!app.metadata.entryPoint) {
      throw new Error('App metadata must specify entry point');
    }
  }

  private validateFiles(app: GeneratedApp): void {
    const filePaths = new Set<string>();
    let hasPackageJson = false;
    let hasEntryPoint = false;

    for (const file of app.files) {
      // Check required fields
      if (!file.path) {
        throw new Error('File must have a path');
      }

      if (!file.content) {
        throw new Error(`File ${file.path} must have content`);
      }

      if (!file.language) {
        throw new Error(`File ${file.path} must have a language`);
      }

      // Check for duplicate paths
      if (filePaths.has(file.path)) {
        throw new Error(`Duplicate file path: ${file.path}`);
      }
      filePaths.add(file.path);

      // Check for required files
      if (file.path === 'package.json') {
        hasPackageJson = true;
      }

      if (file.path === app.metadata.entryPoint) {
        hasEntryPoint = true;
      }

      // Validate file path format
      if (file.path.includes('..') || file.path.startsWith('/')) {
        throw new Error(`Invalid file path: ${file.path}`);
      }

      // Validate file size
      if (Buffer.byteLength(file.content, 'utf8') > 1024 * 1024) {
        throw new Error(`File ${file.path} exceeds 1MB limit`);
      }
    }

    if (!hasPackageJson) {
      throw new Error('App must include package.json');
    }

    if (!hasEntryPoint) {
      throw new Error(`App must include entry point file: ${app.metadata.entryPoint}`);
    }
  }

  private validateDependencies(app: GeneratedApp): void {
    const packageJsonFile = app.files.find(f => f.path === 'package.json');
    if (!packageJsonFile) {
      throw new Error('package.json file not found');
    }

    try {
      const packageJson = JSON.parse(packageJsonFile.content);
      
      if (!packageJson.dependencies) {
        throw new Error('package.json must have dependencies');
      }

      // Check that dependencies match the app dependencies
      for (const [name, version] of Object.entries(app.dependencies)) {
        if (!packageJson.dependencies[name]) {
          throw new Error(`Dependency ${name} not found in package.json`);
        }
      }

      // Validate package.json structure
      if (!packageJson.name) {
        throw new Error('package.json must have a name');
      }

      if (!packageJson.version) {
        throw new Error('package.json must have a version');
      }

      if (!packageJson.scripts) {
        throw new Error('package.json must have scripts');
      }

      if (!packageJson.scripts.dev && !packageJson.scripts.start) {
        throw new Error('package.json must have dev or start script');
      }

    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error('package.json is not valid JSON');
      }
      throw error;
    }
  }

  validateSyntax(file: any): void {
    if (file.language === 'json') {
      try {
        JSON.parse(file.content);
      } catch (error) {
        throw new Error(`Invalid JSON in file ${file.path}: ${error.message}`);
      }
    }

    if (file.language === 'typescript' || file.language === 'javascript') {
      // Basic syntax checks
      const openBraces = (file.content.match(/\{/g) || []).length;
      const closeBraces = (file.content.match(/\}/g) || []).length;
      
      if (openBraces !== closeBraces) {
        throw new Error(`Unmatched braces in file ${file.path}`);
      }

      const openParens = (file.content.match(/\(/g) || []).length;
      const closeParens = (file.content.match(/\)/g) || []).length;
      
      if (openParens !== closeParens) {
        throw new Error(`Unmatched parentheses in file ${file.path}`);
      }
    }
  }
}