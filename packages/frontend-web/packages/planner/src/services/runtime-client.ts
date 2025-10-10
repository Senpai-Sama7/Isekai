import axios from 'axios';
import { GeneratedApp, ExecutionResult } from '@isekai/types';
import { winstonLogger } from '../utils/logger';

export class RuntimeClient {
  private baseUrl = process.env.RUNTIME_SERVICE_URL || 'http://localhost:3005';

  async executeApp(app: GeneratedApp): Promise<ExecutionResult> {
    try {
      const response = await axios.post(`${this.baseUrl}/api/v1/execute`, {
        app
      });

      return response.data.data;
    } catch (error) {
      winstonLogger.error('Failed to call runtime service', error);
      throw new Error('Runtime service unavailable');
    }
  }
}