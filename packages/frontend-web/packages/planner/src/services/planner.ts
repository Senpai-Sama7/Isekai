import { v4 as uuidv4 } from 'uuid';
import { Plan, PlanStep, PromptRequest, WebSocketMessage } from '@isekai/types';
import { winstonLogger } from '../utils/logger';
import { PerceptionClient } from './perception-client';
import { SynthesisClient } from './synthesis-client';
import { RuntimeClient } from './runtime-client';
import { EvaluationClient } from './evaluation-client';

export class PlannerService {
  private plans: Map<string, Plan> = new Map();
  private perceptionClient = new PerceptionClient();
  private synthesisClient = new SynthesisClient();
  private runtimeClient = new RuntimeClient();
  private evaluationClient = new EvaluationClient();

  async createPlan(promptRequest: PromptRequest): Promise<Plan> {
    const planId = uuidv4();
    
    const plan: Plan = {
      id: planId,
      promptId: promptRequest.id,
      steps: [
        {
          id: uuidv4(),
          type: 'perception',
          description: 'Analyze prompt to understand UI requirements',
          status: 'pending'
        },
        {
          id: uuidv4(),
          type: 'synthesis',
          description: 'Generate application code',
          status: 'pending'
        },
        {
          id: uuidv4(),
          type: 'execution',
          description: 'Execute application in sandbox',
          status: 'pending'
        },
        {
          id: uuidv4(),
          type: 'validation',
          description: 'Validate and test application',
          status: 'pending'
        }
      ],
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.plans.set(planId, plan);
    return plan;
  }

  async getPlan(planId: string): Promise<Plan | null> {
    return this.plans.get(planId) || null;
  }

  async executePlan(planId: string, wsServer: any): Promise<void> {
    const plan = this.plans.get(planId);
    if (!plan) {
      throw new Error(`Plan ${planId} not found`);
    }

    plan.status = 'in_progress';
    plan.updatedAt = new Date().toISOString();

    try {
      for (const step of plan.steps) {
        await this.executeStep(step, plan, wsServer);
      }
      
      plan.status = 'completed';
      plan.updatedAt = new Date().toISOString();
      
      wsServer.broadcast({
        type: 'plan_completed',
        data: { planId, status: 'completed' },
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      plan.status = 'failed';
      plan.updatedAt = new Date().toISOString();
      
      wsServer.broadcast({
        type: 'plan_failed',
        data: { planId, error: error.message },
        timestamp: new Date().toISOString()
      });
      
      throw error;
    }
  }

  private async executeStep(step: PlanStep, plan: Plan, wsServer: any): Promise<void> {
    step.status = 'in_progress';
    step.startedAt = new Date().toISOString();
    
    wsServer.broadcast({
      type: 'step_started',
      data: { planId: plan.id, stepId: step.id, type: step.type },
      timestamp: new Date().toISOString()
    });

    try {
      let result: any;

      switch (step.type) {
        case 'perception':
          result = await this.executePerceptionStep(plan);
          break;
        case 'synthesis':
          result = await this.executeSynthesisStep(plan);
          break;
        case 'execution':
          result = await this.executeExecutionStep(plan);
          break;
        case 'validation':
          result = await this.executeValidationStep(plan);
          break;
        default:
          throw new Error(`Unknown step type: ${step.type}`);
      }

      step.status = 'completed';
      step.completedAt = new Date().toISOString();
      step.duration = new Date(step.completedAt).getTime() - new Date(step.startedAt).getTime();
      step.output = result;

      wsServer.broadcast({
        type: 'step_completed',
        data: { 
          planId: plan.id, 
          stepId: step.id, 
          type: step.type,
          duration: step.duration,
          output: result
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      step.status = 'failed';
      step.completedAt = new Date().toISOString();
      step.error = error.message;

      wsServer.broadcast({
        type: 'step_failed',
        data: { 
          planId: plan.id, 
          stepId: step.id, 
          type: step.type,
          error: error.message
        },
        timestamp: new Date().toISOString()
      });

      throw error;
    }
  }

  private async executePerceptionStep(plan: Plan): Promise<any> {
    // This would get the original prompt from storage
    const prompt = "CSV viewer with filter and export"; // Placeholder
    
    const perceptionResult = await this.perceptionClient.analyzePrompt(prompt);
    
    // Store perception result in plan context
    (plan as any).perceptionResult = perceptionResult;
    
    return perceptionResult;
  }

  private async executeSynthesisStep(plan: Plan): Promise<any> {
    const prompt = "CSV viewer with filter and export"; // Placeholder
    const perceptionResult = (plan as any).perceptionResult;
    
    const generatedApp = await this.synthesisClient.generateCode(prompt, perceptionResult);
    
    // Store generated app in plan context
    (plan as any).generatedApp = generatedApp;
    
    return generatedApp;
  }

  private async executeExecutionStep(plan: Plan): Promise<any> {
    const generatedApp = (plan as any).generatedApp;
    
    const executionResult = await this.runtimeClient.executeApp(generatedApp);
    
    // Store execution result in plan context
    (plan as any).executionResult = executionResult;
    
    return executionResult;
  }

  private async executeValidationStep(plan: Plan): Promise<any> {
    const generatedApp = (plan as any).generatedApp;
    
    const evaluationResult = await this.evaluationClient.evaluateApp(generatedApp);
    
    // Store evaluation result in plan context
    (plan as any).evaluationResult = evaluationResult;
    
    return evaluationResult;
  }
}