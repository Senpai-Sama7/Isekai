import axios from 'axios';
import { LocalPlanner } from './localPlanner';

const REMOTE_PLANNER_URL = process.env.PLANNER_URL || 'http://localhost:8001';

function shouldUseRemotePlanner(): boolean {
  if (!process.env.PLANNER_URL) {
    return false;
  }

  const value = process.env.PLANNER_URL.toLowerCase();
  if (value === 'local' || value === 'builtin') {
    return false;
  }

  return true;
}

export class PlannerService {
  private readonly localPlanner = new LocalPlanner();

  async analyze(prompt: string, context?: any): Promise<any> {
    if (!shouldUseRemotePlanner()) {
      return this.localPlanner.generateApp(prompt, context);
    }

    try {
      const response = await axios.post(`${REMOTE_PLANNER_URL}/analyze`, {
        prompt,
        context
      }, { timeout: 30000 });

      return response.data;
    } catch (error) {
      console.error('Planner service error:', error);
      return this.localPlanner.generateApp(prompt, context);
    }
  }

  async analyzeModification(prompt: string, currentCode: any, metadata: any): Promise<any> {
    if (!shouldUseRemotePlanner()) {
      return this.localPlanner.generateModification(prompt, currentCode?.files || currentCode || {}, metadata);
    }

    try {
      const response = await axios.post(`${REMOTE_PLANNER_URL}/analyze`, {
        prompt,
        context: { currentCode, metadata, isModification: true }
      }, { timeout: 30000 });

      return response.data;
    } catch (error) {
      console.error('Planner service error:', error);
      return this.localPlanner.generateModification(prompt, currentCode?.files || currentCode || {}, metadata);
    }
  }

  async infer(data: any): Promise<any> {
    if (!shouldUseRemotePlanner()) {
      return this.localPlanner.infer({
        action: data.action,
        target: data.target,
        data: data.data,
        context: data.context,
        currentCode: data.currentCode
      });
    }

    try {
      const response = await axios.post(`${REMOTE_PLANNER_URL}/infer`, data, { timeout: 5000 });
      return response.data;
    } catch (error) {
      console.error('Planner service error:', error);
      return this.localPlanner.infer({
        action: data.action,
        target: data.target,
        data: data.data,
        context: data.context,
        currentCode: data.currentCode
      });
    }
  }
}
