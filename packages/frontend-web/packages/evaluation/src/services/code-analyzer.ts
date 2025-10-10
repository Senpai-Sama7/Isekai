import { GeneratedApp } from '@imagine/types';
import { winstonLogger } from '../utils/logger';

export class CodeAnalyzer {
  
  async analyze(app: GeneratedApp): Promise<any> {
    const analysis = {
      complexity: 0,
      maintainability: 0,
      testability: 0,
      issues: [] as string[],
      metrics: {
        totalLines: 0,
        totalFiles: app.files.length,
        languageDistribution: {} as Record<string, number>
      }
    };

    for (const file of app.files) {
      const fileAnalysis = this.analyzeFile(file);
      
      analysis.complexity += fileAnalysis.complexity;
      analysis.metrics.totalLines += fileAnalysis.lines;
      
      // Update language distribution
      const lang = file.language || 'unknown';
      analysis.metrics.languageDistribution[lang] = 
        (analysis.metrics.languageDistribution[lang] || 0) + 1;

      // Collect issues
      analysis.issues.push(...fileAnalysis.issues);
    }

    // Calculate maintainability score (0-100)
    analysis.maintainability = this.calculateMaintainability(analysis);
    
    // Calculate testability score (0-100)
    analysis.testability = this.calculateTestability(analysis);

    return analysis;
  }

  private analyzeFile(file: any): any {
    const analysis = {
      complexity: 0,
      lines: file.content.split('\n').length,
      issues: [] as string[]
    };

    if (file.language === 'typescript' || file.language === 'javascript') {
      // Count complexity indicators
      const functions = (file.content.match(/function|=>/g) || []).length;
      const conditionals = (file.content.match(/if|else|switch|case/g) || []).length;
      const loops = (file.content.match(/for|while|do/g) || []).length;
      
      analysis.complexity = functions + (conditionals * 2) + (loops * 3);

      // Check for code quality issues
      if (analysis.lines > 500) {
        analysis.issues.push(`File ${file.path} is too long (${analysis.lines} lines)`);
      }

      if (functions > 20) {
        analysis.issues.push(`File ${file.path} has too many functions (${functions})`);
      }

      // Check for console.log statements
      const consoleLogs = (file.content.match(/console\.log/g) || []).length;
      if (consoleLogs > 5) {
        analysis.issues.push(`File ${file.path} has too many console.log statements (${consoleLogs})`);
      }

      // Check for TODO comments
      const todos = (file.content.match(/TODO|FIXME|HACK/g) || []).length;
      if (todos > 0) {
        analysis.issues.push(`File ${file.path} has ${todos} TODO/FIXME comments`);
      }

      // Check for any usage
      const anyTypes = (file.content.match(/: any/g) || []).length;
      if (anyTypes > 3) {
        analysis.issues.push(`File ${file.path} uses 'any' type ${anyTypes} times`);
      }
    }

    return analysis;
  }

  private calculateMaintainability(analysis: any): number {
    let score = 100;

    // Deduct points for high complexity
    if (analysis.complexity > 100) score -= 20;
    else if (analysis.complexity > 50) score -= 10;

    // Deduct points for issues
    score -= Math.min(30, analysis.issues.length * 5);

    // Deduct points for very long files
    if (analysis.metrics.totalLines > 5000) score -= 15;
    else if (analysis.metrics.totalLines > 2000) score -= 5;

    return Math.max(0, score);
  }

  private calculateTestability(analysis: any): number {
    let score = 100;

    // Check for test files
    const hasTestFiles = Object.keys(analysis.metrics.languageDistribution)
      .some(lang => lang.includes('test') || lang.includes('spec'));
    
    if (!hasTestFiles) score -= 30;

    // Deduct points for high complexity (harder to test)
    if (analysis.complexity > 100) score -= 20;
    else if (analysis.complexity > 50) score -= 10;

    // Check for separation of concerns
    const hasGoodStructure = analysis.metrics.totalFiles > 3; // Basic check
    if (!hasGoodStructure) score -= 15;

    return Math.max(0, score);
  }
}