import { GeneratedApp } from '@isekai/types';
import { winstonLogger } from '../utils/logger';

export class SecurityScanner {
  
  async scan(app: GeneratedApp): Promise<any> {
    const scanResult = {
      vulnerabilities: [] as string[],
      recommendations: [] as string[],
      score: 100,
      details: {
        packageVulnerabilities: [] as string[],
        codeVulnerabilities: [] as string[],
        sensitiveData: [] as string[]
      }
    };

    // Scan dependencies for known vulnerabilities
    await this.scanDependencies(app, scanResult);
    
    // Scan code for security issues
    await this.scanCode(app, scanResult);
    
    // Check for sensitive data exposure
    await this.scanForSensitiveData(app, scanResult);

    // Calculate security score
    scanResult.score = this.calculateSecurityScore(scanResult);

    return scanResult;
  }

  private async scanDependencies(app: GeneratedApp, result: any): Promise<void> {
    // Check for packages with known security issues
    const riskyPackages = [
      'lodash', // Historically had vulnerabilities
      'request', // Deprecated
      'axios', // Check version
      'express', // Check version
    ];

    for (const [name, version] of Object.entries(app.dependencies)) {
      if (riskyPackages.includes(name)) {
        result.details.packageVulnerabilities.push(
          `Package ${name}@${version} may have security vulnerabilities`
        );
      }

      // Check for outdated packages
      if (this.isOutdatedVersion(name, version)) {
        result.details.packageVulnerabilities.push(
          `Package ${name}@${version} is outdated and may have security issues`
        );
      }
    }

    // Check for missing security-related packages
    const securityPackages = ['helmet', 'cors', 'bcrypt', 'jsonwebtoken'];
    const hasSecurityPackages = securityPackages.some(pkg => 
      app.dependencies[pkg]
    );

    if (!hasSecurityPackages && this.isServerApp(app)) {
      result.recommendations.push(
        'Consider adding security packages like helmet, cors, or bcrypt'
      );
    }
  }

  private async scanCode(app: GeneratedApp, result: any): Promise<void> {
    for (const file of app.files) {
      if (file.language === 'typescript' || file.language === 'javascript') {
        // Check for dangerous patterns
        const dangerousPatterns = [
          /eval\s*\(/gi,
          /Function\s*\(/gi,
          /innerHTML\s*=/gi,
          /outerHTML\s*=/gi,
          /document\.write/gi,
          /setTimeout\s*\(\s*["'`][^"'`]*["'`]\s*,/gi, // String setTimeout
          /setInterval\s*\(\s*["'`][^"'`]*["'`]\s*,/gi, // String setInterval
        ];

        for (const pattern of dangerousPatterns) {
          const matches = file.content.match(pattern);
          if (matches) {
            result.details.codeVulnerabilities.push(
              `Dangerous pattern ${pattern.source} found in ${file.path}`
            );
          }
        }

        // Check for hardcoded secrets
        const secretPatterns = [
          /password\s*=\s*["'][^"']+["']/gi,
          /api_key\s*=\s*["'][^"']+["']/gi,
          /secret\s*=\s*["'][^"']+["']/gi,
          /token\s*=\s*["'][^"']+["']/gi,
        ];

        for (const pattern of secretPatterns) {
          const matches = file.content.match(pattern);
          if (matches) {
            result.details.sensitiveData.push(
              `Potential hardcoded secret in ${file.path}: ${pattern.source}`
            );
          }
        }

        // Check for unsafe imports
        const unsafeImports = [
          'require("child_process")',
          'require("fs")',
          'require("os")',
          'require("path")',
          'import * as fs from',
          'import * as child_process from',
        ];

        for (const imp of unsafeImports) {
          if (file.content.includes(imp)) {
            result.details.codeVulnerabilities.push(
              `Unsafe import ${imp} found in ${file.path}`
            );
          }
        }
      }
    }
  }

  private async scanForSensitiveData(app: GeneratedApp, result: any): Promise<void> {
    // Check for common sensitive data patterns
    const sensitivePatterns = [
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, // Emails
      /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, // Credit cards
      /\b(?:\d{1,3}\.){3}\d{1,3}\b/g, // IP addresses
      /https?:\/\/[^\s]+/g, // URLs (might contain sensitive info)
    ];

    for (const file of app.files) {
      for (const pattern of sensitivePatterns) {
        const matches = file.content.match(pattern);
        if (matches) {
          result.details.sensitiveData.push(
            `Potential sensitive data found in ${file.path}: ${matches.length} matches`
          );
        }
      }
    }
  }

  private isOutdatedVersion(packageName: string, version: string): boolean {
    // Simplified version checking - in real implementation, 
    // this would check against a database of latest versions
    const outdatedVersions: Record<string, string[]> = {
      'react': ['^16.0.0', '^17.0.0'],
      'next': ['^12.0.0', '^13.0.0'],
      'axios': ['^0.21.0', '^0.22.0'],
    };

    return outdatedVersions[packageName]?.some(outdated => 
      version.startsWith(outdated.replace('^', ''))
    ) || false;
  }

  private isServerApp(app: GeneratedApp): boolean {
    return app.files.some(f => 
      f.content.includes('express') || 
      f.content.includes('server') ||
      f.path.includes('server')
    );
  }

  private calculateSecurityScore(result: any): number {
    let score = 100;

    // Deduct points for vulnerabilities
    score -= result.details.packageVulnerabilities.length * 10;
    score -= result.details.codeVulnerabilities.length * 15;
    score -= result.details.sensitiveData.length * 20;

    return Math.max(0, score);
  }
}