import { z } from 'zod';

// Core request/response types
export const PromptRequestSchema = z.object({
  id: z.string(),
  prompt: z.string(),
  context: z.object({
    userId: z.string().optional(),
    sessionId: z.string().optional(),
    preferences: z.record(z.any()).optional(),
  }).optional(),
});

export const PromptResponseSchema = z.object({
  id: z.string(),
  status: z.enum(['pending', 'planning', 'generating', 'executing', 'completed', 'failed']),
  message: z.string().optional(),
  planId: z.string().optional(),
  appId: z.string().optional(),
});

// Planning types
export const PlanStepSchema = z.object({
  id: z.string(),
  type: z.enum(['perception', 'synthesis', 'execution', 'validation']),
  description: z.string(),
  status: z.enum(['pending', 'in_progress', 'completed', 'failed']),
  input: z.record(z.any()).optional(),
  output: z.record(z.any()).optional(),
  error: z.string().optional(),
  startedAt: z.string().optional(),
  completedAt: z.string().optional(),
  duration: z.number().optional(),
});

export const PlanSchema = z.object({
  id: z.string(),
  promptId: z.string(),
  steps: z.array(PlanStepSchema),
  status: z.enum(['pending', 'in_progress', 'completed', 'failed']),
  createdAt: z.string(),
  updatedAt: z.string(),
});

// Perception types
export const UIComponentSchema = z.object({
  id: z.string(),
  type: z.enum(['table', 'form', 'chart', 'list', 'button', 'input', 'modal']),
  properties: z.record(z.any()),
  layout: z.object({
    x: z.number(),
    y: z.number(),
    width: z.number(),
    height: z.number(),
  }),
});

export const PerceptionResultSchema = z.object({
  components: z.array(UIComponentSchema),
  layout: z.string(),
  interactions: z.array(z.string()),
});

// Code synthesis types
export const CodeFileSchema = z.object({
  path: z.string(),
  content: z.string(),
  language: z.string(),
});

export const GeneratedAppSchema = z.object({
  id: z.string(),
  files: z.array(CodeFileSchema),
  dependencies: z.record(z.string()),
  metadata: z.object({
    framework: z.string(),
    language: z.string(),
    entryPoint: z.string(),
  }),
});

// Runtime execution types
export const ExecutionContextSchema = z.object({
  appId: z.string(),
  sandboxId: z.string(),
  environment: z.record(z.string()),
  resources: z.object({
    memory: z.number(),
    cpu: z.number(),
    timeout: z.number(),
  }),
});

export const ExecutionResultSchema = z.object({
  success: z.boolean(),
  output: z.string().optional(),
  error: z.string().optional(),
  logs: z.array(z.string()),
  metrics: z.object({
    executionTime: z.number(),
    memoryUsage: z.number(),
    cpuUsage: z.number(),
  }),
  artifacts: z.array(z.string()).optional(),
});

// Evaluation types
export const TestCaseSchema = z.object({
  id: z.string(),
  description: z.string(),
  input: z.record(z.any()),
  expectedOutput: z.record(z.any()),
  type: z.enum(['unit', 'integration', 'e2e']),
});

export const TestResultSchema = z.object({
  testCaseId: z.string(),
  passed: z.boolean(),
  actualOutput: z.record(z.any()).optional(),
  error: z.string().optional(),
  duration: z.number(),
});

export const EvaluationResultSchema = z.object({
  appId: z.string(),
  testResults: z.array(TestResultSchema),
  summary: z.object({
    total: z.number(),
    passed: z.number(),
    failed: z.number(),
    coverage: z.number(),
  }),
  recommendations: z.array(z.string()),
});

// WebSocket message types
export const WebSocketMessageSchema = z.object({
  type: z.enum([
    'prompt_submitted',
    'plan_updated',
    'step_started',
    'step_completed',
    'code_generated',
    'execution_started',
    'execution_completed',
    'evaluation_completed',
    'error'
  ]),
  data: z.any(),
  timestamp: z.string(),
});

// Export types
export type PromptRequest = z.infer<typeof PromptRequestSchema>;
export type PromptResponse = z.infer<typeof PromptResponseSchema>;
export type PlanStep = z.infer<typeof PlanStepSchema>;
export type Plan = z.infer<typeof PlanSchema>;
export type UIComponent = z.infer<typeof UIComponentSchema>;
export type PerceptionResult = z.infer<typeof PerceptionResultSchema>;
export type CodeFile = z.infer<typeof CodeFileSchema>;
export type GeneratedApp = z.infer<typeof GeneratedAppSchema>;
export type ExecutionContext = z.infer<typeof ExecutionContextSchema>;
export type ExecutionResult = z.infer<typeof ExecutionResultSchema>;
export type TestCase = z.infer<typeof TestCaseSchema>;
export type TestResult = z.infer<typeof TestResultSchema>;
export type EvaluationResult = z.infer<typeof EvaluationResultSchema>;
export type WebSocketMessage = z.infer<typeof WebSocketMessageSchema>;