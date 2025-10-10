#!/usr/bin/env node

/**
 * Smoke Test Script for Imagine Platform
 * 
 * This script performs basic smoke tests to ensure the platform
 * is functioning correctly.
 */

const axios = require('axios');
const WebSocket = require('ws');

// Configuration
const SERVICES = {
  perception: 'http://localhost:3002',
  planner: 'http://localhost:3003',
  synthesis: 'http://localhost:3004',
  runtime: 'http://localhost:3005',
  evaluation: 'http://localhost:3006',
  ui: 'http://localhost:3000',
  gateway: 'http://localhost:3001'
};

const TEST_TIMEOUT = 30000; // 30 seconds

class SmokeTest {
  constructor() {
    this.results = {
      passed: 0,
      failed: 0,
      tests: []
    };
  }

  async run() {
    console.log('💨 Starting Imagine Platform Smoke Tests');
    console.log('==========================================\n');

    try {
      await this.testServiceHealth();
      await this.testPromptSubmission();
      await this.testWebSocketConnection();
      await this.testCSVViewerGeneration();

      this.printResults();
      
      if (this.results.failed > 0) {
        process.exit(1);
      }
      
    } catch (error) {
      console.error('❌ Smoke test failed:', error.message);
      process.exit(1);
    }
  }

  async testServiceHealth() {
    console.log('🏥 Testing Service Health');
    console.log('-------------------------');

    for (const [service, url] of Object.entries(SERVICES)) {
      try {
        const response = await axios.get(`${url}/health`, { timeout: 5000 });
        this.recordTest(`Service Health - ${service}`, true, 
          `${service} is healthy (${response.status})`);
      } catch (error) {
        this.recordTest(`Service Health - ${service}`, false, 
          `${service} is unhealthy: ${error.message}`);
      }
    }
    console.log('');
  }

  async testPromptSubmission() {
    console.log('📝 Testing Prompt Submission');
    console.log('-----------------------------');

    try {
      const promptData = {
        id: 'smoke-test-' + Date.now(),
        prompt: 'Simple counter app with increment and decrement buttons',
        context: {
          userId: 'smoke-test-user',
          sessionId: 'smoke-test-session'
        }
      };

      const response = await axios.post(`${SERVICES.gateway}/api/v1/prompts`, promptData, {
        timeout: 10000
      });

      if (response.status === 201 && response.data.planId) {
        this.recordTest('Prompt Submission', true, 
          'Prompt submitted successfully, plan ID: ' + response.data.planId);
      } else {
        this.recordTest('Prompt Submission', false, 
          'Unexpected response: ' + JSON.stringify(response.data));
      }
    } catch (error) {
      this.recordTest('Prompt Submission', false, 
        'Prompt submission failed: ' + error.message);
    }
    console.log('');
  }

  async testWebSocketConnection() {
    console.log('🔌 Testing WebSocket Connection');
    console.log('--------------------------------');

    return new Promise((resolve) => {
      const ws = new WebSocket('ws://localhost:3003');
      let connected = false;
      let timeout = setTimeout(() => {
        if (!connected) {
          this.recordTest('WebSocket Connection', false, 'Connection timeout');
          ws.close();
          resolve();
        }
      }, 5000);

      ws.on('open', () => {
        connected = true;
        clearTimeout(timeout);
        this.recordTest('WebSocket Connection', true, 'WebSocket connected successfully');
        ws.close();
        resolve();
      });

      ws.on('error', (error) => {
        clearTimeout(timeout);
        this.recordTest('WebSocket Connection', false, 'WebSocket error: ' + error.message);
        resolve();
      });
    });
  }

  async testCSVViewerGeneration() {
    console.log('📊 Testing CSV Viewer Generation');
    console.log('---------------------------------');

    try {
      const promptData = {
        id: 'csv-test-' + Date.now(),
        prompt: 'CSV viewer with filter and export functionality',
        context: {
          userId: 'smoke-test-user',
          sessionId: 'csv-test-session'
        }
      };

      // Submit prompt
      const response = await axios.post(`${SERVICES.gateway}/api/v1/prompts`, promptData, {
        timeout: 10000
      });

      if (response.status !== 201) {
        throw new Error('Prompt submission failed');
      }

      const planId = response.data.planId;
      
      // Wait for plan completion (simplified - in real test would poll)
      console.log('⏳ Waiting for plan completion...');
      await this.sleep(5000);

      // Check plan status
      try {
        const planResponse = await axios.get(`${SERVICES.planner}/api/v1/plans/${planId}`, {
          timeout: 5000
        });

        if (planResponse.data.status === 'completed') {
          this.recordTest('CSV Viewer Generation', true, 
            'CSV viewer generated successfully');
        } else {
          this.recordTest('CSV Viewer Generation', false, 
            'Plan not completed: ' + planResponse.data.status);
        }
      } catch (error) {
        this.recordTest('CSV Viewer Generation', false, 
          'Failed to check plan status: ' + error.message);
      }

    } catch (error) {
      this.recordTest('CSV Viewer Generation', false, 
        'CSV viewer generation failed: ' + error.message);
    }
    console.log('');
  }

  recordTest(name, passed, message) {
    const status = passed ? '✅' : '❌';
    console.log(`${status} ${name}: ${message}`);
    
    this.results.tests.push({ name, passed, message });
    if (passed) {
      this.results.passed++;
    } else {
      this.results.failed++;
    }
  }

  printResults() {
    console.log('📊 Smoke Test Results');
    console.log('=====================');
    console.log(`Total: ${this.results.tests.length}`);
    console.log(`Passed: ${this.results.passed}`);
    console.log(`Failed: ${this.results.failed}`);
    console.log('');

    if (this.results.failed === 0) {
      console.log('🎉 All smoke tests passed!');
    } else {
      console.log('❌ Some smoke tests failed. Check the logs above.');
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Run smoke tests
if (require.main === module) {
  const smokeTest = new SmokeTest();
  smokeTest.run().catch(error => {
    console.error('Smoke test execution failed:', error);
    process.exit(1);
  });
}

module.exports = SmokeTest;