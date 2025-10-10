import { v4 as uuidv4 } from 'uuid';
import puppeteer from 'puppeteer';
import { GeneratedApp, EvaluationResult, TestCase, TestResult } from '@isekai/types';
import { winstonLogger } from '../utils/logger';
import { TestRunner } from './test-runner';
import { CodeAnalyzer } from './code-analyzer';
import { SecurityScanner } from './security-scanner';

export class EvaluationService {
  private testRunner: TestRunner;
  private codeAnalyzer: CodeAnalyzer;
  private securityScanner: SecurityScanner;
  private evaluationResults: Map<string, EvaluationResult> = new Map();

  constructor() {
    this.testRunner = new TestRunner();
    this.codeAnalyzer = new CodeAnalyzer();
    this.securityScanner = new SecurityScanner();
  }

  async evaluateApp(app: GeneratedApp): Promise<EvaluationResult> {
    const evaluationId = uuidv4();
    const startTime = Date.now();

    try {
      winstonLogger.info('Starting comprehensive evaluation', { 
        appId: app.id,
        evaluationId 
      });

      // Generate test cases based on app type
      const testCases = await this.generateTestCases(app);
      
      // Run functional tests
      const testResults = await this.testRunner.runTests(app, testCases);
      
      // Analyze code quality
      const codeQuality = await this.codeAnalyzer.analyze(app);
      
      // Security scan
      const securityResults = await this.securityScanner.scan(app);
      
      // Performance evaluation
      const performanceResults = await this.evaluatePerformance(app);
      
      // Calculate summary
      const summary = this.calculateSummary(testResults, codeQuality, securityResults);
      
      // Generate recommendations
      const recommendations = this.generateRecommendations(
        testResults, 
        codeQuality, 
        securityResults, 
        performanceResults
      );

      const result: EvaluationResult = {
        appId: app.id,
        testResults,
        summary,
        recommendations
      };

      this.evaluationResults.set(evaluationId, result);

      const duration = Date.now() - startTime;
      winstonLogger.info('Evaluation completed', { 
        appId: app.id,
        evaluationId,
        duration,
        passed: summary.passed,
        total: summary.total
      });

      return result;

    } catch (error) {
      winstonLogger.error('Evaluation failed', error);
      
      const errorResult: EvaluationResult = {
        appId: app.id,
        testResults: [],
        summary: {
          total: 0,
          passed: 0,
          failed: 0,
          coverage: 0
        },
        recommendations: [`Evaluation failed: ${error.message}`]
      };

      this.evaluationResults.set(evaluationId, errorResult);
      return errorResult;
    }
  }

  async getEvaluationResult(evaluationId: string): Promise<EvaluationResult | null> {
    return this.evaluationResults.get(evaluationId) || null;
  }

  private async generateTestCases(app: GeneratedApp): Promise<TestCase[]> {
    const testCases: TestCase[] = [];

    // Basic smoke tests
    testCases.push({
      id: 'smoke-1',
      description: 'Application should start without errors',
      input: {},
      expectedOutput: { status: 'running' },
      type: 'e2e'
    });

    // Check for package.json
    testCases.push({
      id: 'structure-1',
      description: 'Should have valid package.json',
      input: {},
      expectedOutput: { hasPackageJson: true },
      type: 'unit'
    });

    // Check for entry point
    testCases.push({
      id: 'structure-2',
      description: 'Should have entry point file',
      input: {},
      expectedOutput: { hasEntryPoint: true },
      type: 'unit'
    });

    // Type-specific tests
    if (this.isCSVViewer(app)) {
      testCases.push({
        id: 'csv-1',
        description: 'Should handle CSV file upload',
        input: { file: 'test.csv' },
        expectedOutput: { success: true },
        type: 'integration'
      });

      testCases.push({
        id: 'csv-2',
        description: 'Should filter data correctly',
        input: { filter: 'test' },
        expectedOutput: { filtered: true },
        type: 'integration'
      });

      testCases.push({
        id: 'csv-3',
        description: 'Should export filtered data',
        input: { export: true },
        expectedOutput: { exported: true },
        type: 'integration'
      });
    }

    return testCases;
  }

  private isCSVViewer(app: GeneratedApp): boolean {
    const packageJson = app.files.find(f => f.path === 'package.json');
    if (packageJson) {
      const content = JSON.parse(packageJson.content);
      return content.dependencies?.['papaparse'] || 
             content.name?.includes('csv') ||
             app.files.some(f => f.content.includes('papaparse'));
    }
    return false;
  }

  private async evaluatePerformance(app: GeneratedApp): Promise<any> {
    // Basic performance metrics
    const totalSize = app.files.reduce((sum, file) => 
      sum + Buffer.byteLength(file.content, 'utf8'), 0
    );

    const dependencyCount = Object.keys(app.dependencies).length;

    return {
      bundleSize: totalSize,
      dependencyCount,
      complexity: this.calculateComplexity(app)
    };
  }

  private calculateComplexity(app: GeneratedApp): number {
    let complexity = 0;
    
    for (const file of app.files) {
      if (file.language === 'typescript' || file.language === 'javascript') {
        // Simple complexity calculation based on file characteristics
        const lines = file.content.split('\n').length;
        const functions = (file.content.match(/function|=>/g) || []).length;
        complexity += lines + (functions * 2);
      }
    }

    return complexity;
  }

  private calculateSummary(
    testResults: TestResult[], 
    codeQuality: any, 
    securityResults: any
  ): EvaluationResult['summary'] {
    const total = testResults.length;
    const passed = testResults.filter(r => r.passed).length;
    const failed = total - passed;
    
    // Simple coverage calculation
    const coverage = Math.max(0, Math.min(100, (passed / Math.max(1, total)) * 100));

    return {
      total,
      passed,
      failed,
      coverage
    };
  }

  private generateRecommendations(
    testResults: TestResult[],
    codeQuality: any,
    securityResults: any,
    performanceResults: any
  ): string[] {
    const recommendations: string[] = [];

    // Test-based recommendations
    const failedTests = testResults.filter(r => !r.passed);
    if (failedTests.length > 0) {
      recommendations.push(`${failedTests.length} test(s) failed. Review and fix failing functionality.`);
    }

    // Code quality recommendations
    if (codeQuality.complexity > 100) {
      recommendations.push('Consider reducing code complexity for better maintainability.');
    }

    // Security recommendations
    if (securityResults.vulnerabilities.length > 0) {
      recommendations.push(`Address ${securityResults.vulnerabilities.length} security vulnerability/vulnerabilities.`);
    }

    // Performance recommendations
    if (performanceResults.bundleSize > 1024 * 1024) { // 1MB
      recommendations.push('Consider optimizing bundle size for better performance.');
    }

    if (performanceResults.dependencyCount > 20) {
      recommendations.push('Review dependencies - consider reducing the number of packages.');
    }

    // Default recommendation if everything looks good
    if (recommendations.length === 0) {
      recommendations.push('Application looks good! Consider adding more comprehensive tests.');
    }

    return recommendations;
  }
}