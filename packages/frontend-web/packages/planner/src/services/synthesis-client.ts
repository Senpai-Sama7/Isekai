import axios from 'axios';
import { GeneratedApp, PerceptionResult } from '@isekai/types';
import { winstonLogger } from '../utils/logger';

export class SynthesisClient {
  private baseUrl = process.env.SYNTHESIS_SERVICE_URL || 'http://localhost:3004';

  async generateCode(prompt: string, perceptionResult?: PerceptionResult): Promise<GeneratedApp> {
    try {
      const response = await axios.post(`${this.baseUrl}/api/v1/synthesize`, {
        prompt,
        perceptionResult
      });

      return response.data.data;
    } catch (error) {
      winstonLogger.error('Failed to call synthesis service', error);
      throw new Error('Synthesis service unavailable');
    }
  }
}