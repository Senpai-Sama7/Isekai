import { GeneratedApp } from '@imagine/types';
import { winstonLogger } from '../utils/logger';

export class SecurityManager {
  private allowedPackages = new Set([
    'react', 'react-dom', 'next', 'typescript', 'tailwindcss',
    'lucide-react', 'class-variance-authority', 'clsx', 'tailwind-merge',
    'date-fns', 'papaparse', 'jspdf', 'html2canvas'
  ]);

  private blockedPatterns = [
    /eval\s*\(/gi,
    /Function\s*\(/gi,
    /require\s*\(\s*['"`]fs['"`]\s*\)/gi,
    /require\s*\(\s*['"`]child_process['"`]\s*\)/gi,
    /require\s*\(\s*['"`]os['"`]\s*\)/gi,
    /require\s*\(\s*['"`]path['"`]\s*\)/gi,
    /import\s+.*\s+from\s+['"`]fs['"`]/gi,
    /import\s+.*\s+from\s+['"`]child_process['"`]/gi,
    /import\s+.*\s+from\s+['"`]os['"`]/gi,
    /import\s+.*\s+from\s+['"`]path['"`]/gi,
    /document\.write/gi,
    /innerHTML\s*=/gi,
    /outerHTML\s*=/gi,
  ];

  private allowedNetworkHosts = new Set([
    'api.github.com',
    'cdn.jsdelivr.net',
    'fonts.googleapis.com',
    'fonts.gstatic.com'
  ]);

  async validateApp(app: GeneratedApp): Promise<void> {
    winstonLogger.info('Validating application security', { appId: app.id });

    // Validate dependencies
    this.validateDependencies(app.dependencies);

    // Validate file content
    for (const file of app.files) {
      this.validateFileContent(file);
    }

    // Validate file structure
    this.validateFileStructure(app.files);

    winstonLogger.info('Application security validation passed', { appId: app.id });
  }

  private validateDependencies(dependencies: Record<string, string>): void {
    for (const [name, version] of Object.entries(dependencies)) {
      if (!this.allowedPackages.has(name)) {
        throw new Error(`Package '${name}' is not allowed`);
      }

      // Basic version validation
      if (!/^[\d\w\.\-+]+$/i.test(version)) {
        throw new Error(`Invalid version format for package '${name}': ${version}`);
      }
    }
  }

  private validateFileContent(file: any): void {
    const content = file.content;

    // Check for blocked patterns
    for (const pattern of this.blockedPatterns) {
      if (pattern.test(content)) {
        throw new Error(`Blocked pattern detected in file '${file.path}': ${pattern.source}`);
      }
    }

    // Check file size (max 1MB per file)
    if (Buffer.byteLength(content, 'utf8') > 1024 * 1024) {
      throw new Error(`File '${file.path}' exceeds maximum size limit`);
    }

    // Check for suspicious imports
    const suspiciousImports = content.match(/import\s+.*\s+from\s+['"`]([^'"`]+)['"`]/gi);
    if (suspiciousImports) {
      for (const importStatement of suspiciousImports) {
        const match = importStatement.match(/from\s+['"`]([^'"`]+)['"`]/);
        if (match && match[1]) {
          const packageName = match[1].split('/')[0];
          if (!this.allowedPackages.has(packageName) && !packageName.startsWith('.')) {
            throw new Error(`Suspicious import detected in file '${file.path}': ${packageName}`);
          }
        }
      }
    }
  }

  private validateFileStructure(files: any[]): void {
    const filePaths = new Set(files.map(f => f.path));

    // Check for required files
    const hasPackageJson = filePaths.has('package.json');
    const hasEntryPoint = files.some(f => 
      f.path === 'index.js' || 
      f.path === 'index.tsx' || 
      f.path === 'pages/index.tsx' ||
      f.path === 'src/index.tsx'
    );

    if (!hasPackageJson) {
      throw new Error('Missing package.json file');
    }

    if (!hasEntryPoint) {
      throw new Error('Missing entry point file');
    }

    // Check for suspicious file paths
    for (const file of files) {
      if (file.path.includes('..') || file.path.startsWith('/')) {
        throw new Error(`Invalid file path: ${file.path}`);
      }

      if (file.path.endsWith('.exe') || file.path.endsWith('.sh') || file.path.endsWith('.bat')) {
        throw new Error(`Executable files not allowed: ${file.path}`);
      }
    }
  }

  isNetworkAllowed(host: string): boolean {
    return this.allowedNetworkHosts.has(host);
  }

  sanitizeOutput(output: string): string {
    // Remove potential sensitive information
    return output
      .replace(/password[=:]\s*[^\s\n]+/gi, 'password=***')
      .replace(/token[=:]\s*[^\s\n]+/gi, 'token=***')
      .replace(/secret[=:]\s*[^\s\n]+/gi, 'secret=***')
      .replace(/key[=:]\s*[^\s\n]+/gi, 'key=***');
  }
}