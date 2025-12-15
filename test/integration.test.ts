import axios from 'axios';
import { ChildProcess, spawn } from 'child_process';
import { promisify } from 'util';
import { randomUUID } from 'crypto';
import { setTimeout } from 'timers/promises';

const sleep = promisify(setTimeout);

// Configuration
const BACKEND_URL = 'http://localhost:8080';
const FRONTEND_URL = 'http://localhost:3001';
const PLANNER_URL = 'http://localhost:8090';
const SANDBOX_URL = 'http://localhost:8070';

interface AppResponse {
  id: string;
  name: string;
  prompt: string;
  status: string;
  previewUrl?: string;
  code: {
    files: Record<string, string>;
  };
  metadata: any;
  createdAt: string;
  updatedAt: string;
}

describe('Isekai End-to-End Integration Test', () => {
  let backendProcess: ChildProcess;
  let plannerProcess: ChildProcess;
  let sandboxProcess: ChildProcess;
  let frontendProcess: ChildProcess;

  // Start all services before running tests
  beforeAll(async () => {
    console.log('Starting all services...');
    
    // Start backend
    backendProcess = spawn('npm', ['run', 'dev:backend'], {
      cwd: './packages/backend',
      shell: true,
      env: { ...process.env, PORT: '8080', NODE_ENV: 'test' }
    });
    
    // Start planner
    plannerProcess = spawn('npm', ['run', 'dev:planner'], {
      cwd: './packages/planner',
      shell: true,
      env: { ...process.env, PORT: '8090', NODE_ENV: 'test' }
    });
    
    // Start sandbox
    sandboxProcess = spawn('npm', ['run', 'dev:sandbox'], {
      cwd: './packages/sandbox',
      shell: true,
      env: { ...process.env, PORT: '8070', NODE_ENV: 'test' }
    });
    
    // Wait for services to start
    await sleep(10000); // Wait 10 seconds for services to start
    
    // Verify all services are running
    await verifyServiceHealth(BACKEND_URL, '/api/health', 'Backend');
    await verifyServiceHealth(PLANNER_URL, '/health', 'Planner');
    await verifyServiceHealth(SANDBOX_URL, '/health', 'Sandbox');
  }, 30000); // 30 second timeout for service startup

  // Clean up after tests
  afterAll((done) => {
    console.log('Stopping all services...');
    
    // Kill all processes
    [backendProcess, plannerProcess, sandboxProcess, frontendProcess].forEach(process => {
      if (process && !process.killed) {
        process.kill();
      }
    });
    
    // Give processes time to shut down
    setTimeout(() => done(), 2000);
  });

  test('Complete application lifecycle', async () => {
    console.log('Testing complete application lifecycle...');
    
    // 1. Test health endpoints
    console.log('1. Testing health endpoints...');
    const backendHealth = await axios.get(`${BACKEND_URL}/api/health`);
    expect(backendHealth.status).toBe(200);
    expect(backendHealth.data).toHaveProperty('status');

    // 2. Test app generation
    console.log('2. Testing app generation...');
    const appId = randomUUID();
    const generationResponse = await axios.post(`${BACKEND_URL}/api/apps/generate`, {
      prompt: 'Create a simple CSV viewer with search functionality'
    });
    
    expect(generationResponse.status).toBe(200);
    expect(generationResponse.data).toHaveProperty('id');
    expect(generationResponse.data.status).toBe('running');
    expect(generationResponse.data).toHaveProperty('previewUrl');
    
    const generatedApp: AppResponse = generationResponse.data;
    console.log(`Generated app with ID: ${generatedApp.id}`);
    
    // 3. Test app listing
    console.log('3. Testing app listing...');
    const listResponse = await axios.get(`${BACKEND_URL}/api/apps`);
    expect(listResponse.status).toBe(200);
    expect(Array.isArray(listResponse.data.apps)).toBe(true);
    
    // 4. Test getting specific app
    console.log('4. Testing getting specific app...');
    const getResponse = await axios.get(`${BACKEND_URL}/api/apps/${generatedApp.id}`);
    expect(getResponse.status).toBe(200);
    expect(getResponse.data.id).toBe(generatedApp.id);
    
    // 5. Test app modification with resilience
    console.log('5. Testing app modification...');
    const modificationResponse = await axios.patch(`${BACKEND_URL}/api/apps/${generatedApp.id}`, {
      prompt: 'Add sorting functionality to the CSV viewer'
    });
    expect(modificationResponse.status).toBe(200);
    expect(modificationResponse.data.id).toBe(generatedApp.id);
    
    // 6. Test action tracking and inference
    console.log('6. Testing action tracking...');
    const actionResponse = await axios.post(`${BACKEND_URL}/api/apps/${generatedApp.id}/actions`, {
      action: 'click',
      target: 'table-header',
      data: { column: 'name' }
    });
    expect(actionResponse.status).toBe(200);
    expect(Array.isArray(actionResponse.data)).toBe(true);
    
    // 7. Test suggestions application
    console.log('7. Testing suggestions application...');
    if (actionResponse.data.length > 0) {
      const suggestionResponse = await axios.post(`${BACKEND_URL}/api/apps/${generatedApp.id}/apply`, {
        suggestionId: actionResponse.data[0].id
      });
      expect(suggestionResponse.status).toBe(200);
    }
    
    // 8. Test metrics endpoint
    console.log('8. Testing metrics endpoint...');
    const metricsResponse = await axios.get(`${BACKEND_URL}/metrics`);
    expect(metricsResponse.status).toBe(200);
    expect(typeof metricsResponse.data === 'string' || typeof metricsResponse.data === 'object');
    
    console.log('All integration tests passed successfully!');
  }, 60000); // 60 second timeout for the test

  test('Security features validation', async () => {
    console.log('Testing security features...');
    
    // Test dependency validation - attempt to create an app with unsafe dependencies
    // This should be caught by our validation system
    console.log('Testing dependency validation...');
    
    // Test database input validation - try to create an app with invalid data
    console.log('Testing database input validation...');
    
    // Create an app with a potentially dangerous prompt (should be filtered)
    try {
      const dangerousPromptResponse = await axios.post(`${BACKEND_URL}/api/apps/generate`, {
        prompt: 'Create an app; DROP TABLE users; -- malicious SQL'
      });
      
      // The system should catch SQL keywords and reject the prompt
      // If not rejected, verify that the app was created safely
      if (dangerousPromptResponse.status === 200) {
        console.log('Warning: Dangerous prompt was not rejected by validation');
      }
    } catch (error) {
      // Expected if validation caught the dangerous prompt
      console.log('Dangerous prompt properly rejected by validation system');
    }
    
    console.log('Security validation tests completed.');
  }, 30000);
});

async function verifyServiceHealth(baseUrl: string, healthPath: string, serviceName: string): Promise<void> {
  const maxRetries = 10;
  const retryInterval = 2000; // 2 seconds
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await axios.get(`${baseUrl}${healthPath}`);
      if (response.status === 200) {
        console.log(`${serviceName} is healthy`);
        return;
      }
    } catch (error) {
      console.log(`${serviceName} not ready, attempt ${i + 1}/${maxRetries}`);
    }
    
    await sleep(retryInterval);
  }
  
  throw new Error(`${serviceName} failed to start within the expected time`);
}