import axios from 'axios';
import { GeneratedApp, EvaluationResult } from '@imagine/types';
import { winstonLogger } from '../utils/logger';

export class EvaluationClient {
  private baseUrl = process.env.EVALUATION_SERVICE_URL || 'http://localhost:3006';

  async evaluateApp(app: GeneratedApp): Promise<EvaluationResult> {
    try {
      const response = await axios.post(`${this.baseUrl}/api/v1/evaluate`, {
        app
      });

      return response.data.data;
    } catch (error) {
      winstonLogger.error('Failed to call evaluation service', error);
      throw new Error('Evaluation service unavailable');
    }
  }
}