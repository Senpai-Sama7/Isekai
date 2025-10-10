// Basic types for the Imagine Platform
export interface PromptRequest {
  id: string;
  prompt: string;
  context?: {
    userId?: string;
    sessionId?: string;
    preferences?: Record<string, any>;
  };
}

export interface PromptResponse {
  id: string;
  status: 'pending' | 'planning' | 'generating' | 'executing' | 'completed' | 'failed';
  message?: string;
  planId?: string;
  appId?: string;
}

export interface PlanStep {
  id: string;
  type: 'perception' | 'synthesis' | 'execution' | 'validation';
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  input?: Record<string, any>;
  output?: Record<string, any>;
  error?: string;
  startedAt?: string;
  completedAt?: string;
  duration?: number;
}

export interface Plan {
  id: string;
  promptId: string;
  steps: PlanStep[];
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  createdAt: string;
  updatedAt: string;
}

export interface CodeFile {
  path: string;
  content: string;
  language: string;
}

export interface GeneratedApp {
  id: string;
  files: CodeFile[];
  dependencies: Record<string, string>;
  metadata: {
    framework: string;
    language: string;
    entryPoint: string;
  };
}

export interface WebSocketMessage {
  type: string;
  data: any;
  timestamp: string;
}