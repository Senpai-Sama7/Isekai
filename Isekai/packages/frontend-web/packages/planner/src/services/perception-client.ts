import axios from 'axios';
import { PerceptionResult } from '@imagine/types';
import { winstonLogger } from '../utils/logger';

export class PerceptionClient {
  private baseUrl = process.env.PERCEPTION_SERVICE_URL || 'http://localhost:3002';

  async analyzePrompt(prompt: string, context?: any): Promise<PerceptionResult> {
    try {
      const response = await axios.post(`${this.baseUrl}/api/v1/perceive`, {
        prompt,
        context
      });

      return response.data.data;
    } catch (error) {
      winstonLogger.error('Failed to call perception service', error);
      throw new Error('Perception service unavailable');
    }
  }
}