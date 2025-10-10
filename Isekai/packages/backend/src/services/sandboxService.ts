import axios from 'axios';

const SANDBOX_URL = process.env.SANDBOX_URL || 'http://localhost:8002';

export class SandboxService {
  async execute(appId: string, files: any): Promise<any> {
    try {
      const response = await axios.post(`${SANDBOX_URL}/execute`, {
        appId,
        files
      }, { timeout: 60000 });
      
      return response.data;
    } catch (error) {
      console.error('Sandbox service error:', error);
      
      // Return mock data if sandbox is not available
      return {
        appId,
        url: `http://localhost:9000/${appId}`,
        status: 'running',
        logs: 'App started successfully (mock)'
      };
    }
  }

  async update(appId: string, files: any): Promise<any> {
    try {
      const response = await axios.patch(`${SANDBOX_URL}/apps/${appId}`, {
        files
      }, { timeout: 10000 });
      
      return response.data;
    } catch (error) {
      console.error('Sandbox service error:', error);
      return { status: 'updated' };
    }
  }

  async stop(appId: string): Promise<void> {
    try {
      await axios.delete(`${SANDBOX_URL}/apps/${appId}`, { timeout: 10000 });
    } catch (error) {
      console.error('Sandbox service error:', error);
    }
  }

  async getStatus(appId: string): Promise<any> {
    try {
      const response = await axios.get(`${SANDBOX_URL}/apps/${appId}`, { timeout: 5000 });
      return response.data;
    } catch (error) {
      console.error('Sandbox service error:', error);
      return { status: 'unknown' };
    }
  }

  async getLogs(appId: string, tail: number = 100): Promise<string> {
    try {
      const response = await axios.get(`${SANDBOX_URL}/apps/${appId}/logs`, {
        params: { tail },
        timeout: 5000
      });
      return response.data.logs;
    } catch (error) {
      console.error('Sandbox service error:', error);
      return '';
    }
  }
}
