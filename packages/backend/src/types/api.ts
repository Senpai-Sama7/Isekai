// Comprehensive API type definitions for type safety

export interface AppMetadata {
  context?: Record<string, unknown>;
  intent?: string;
  components?: string[];
  [key: string]: unknown;
}

export interface AppCode {
  files: Record<string, string>;
}

export interface AppResponse {
  id: string;
  name: string;
  prompt: string;
  status: 'generating' | 'running' | 'stopped' | 'error';
  previewUrl?: string;
  code: AppCode;
  metadata: AppMetadata;
  createdAt: string;
  updatedAt: string;
}

export interface GenerateAppRequest {
  prompt: string;
  context?: Record<string, unknown>;
}

export interface ModifyAppRequest {
  prompt?: string;
  changes?: Record<string, string>;
}

export interface TrackActionRequest {
  action: string;
  target: string;
  data: unknown;
}

export interface ApplySuggestionRequest {
  suggestionId: string;
}

export interface Suggestion {
  id: string;
  appId?: string;
  title: string;
  description: string;
  changes: Record<string, string>;
  createdAt?: string;
  confidence?: number;
  modificationPrompt?: string;
}

export interface ListAppsQuery {
  limit?: number;
  offset?: number;
}

export interface ListAppsResponse {
  apps: AppResponse[];
  total: number;
}

export interface HealthResponse {
  status: 'ok' | 'degraded' | 'error';
  services: Record<string, 'ok' | 'error' | 'unknown'>;
  timestamp: string;
}

export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  correlationId?: string;
}

export interface PlannerAnalyzeRequest {
  prompt: string;
  context?: {
    currentCode?: AppCode;
    metadata?: AppMetadata;
    isModification?: boolean;
    [key: string]: unknown;
  };
}

export interface PlannerAnalyzeResponse {
  intent: string;
  components: string[];
  plan: {
    framework: string;
    features: string[];
    notes?: string[];
  };
  code: AppCode;
}

export interface PlannerInferRequest {
  action: string;
  target?: string;
  data?: unknown;
  context?: AppMetadata;
  currentCode?: AppCode;
}

export interface PlannerInferResponse {
  suggestions: Suggestion[];
  confidence?: number;
}

export interface SandboxExecuteRequest {
  appId: string;
  files: Record<string, string>;
  dependencies?: Record<string, string>;
  config?: Record<string, unknown>;
}

export interface SandboxExecuteResponse {
  appId: string;
  url: string;
  status: string;
  logs?: string;
}

export interface SandboxUpdateRequest {
  files: Record<string, string>;
}

export interface SandboxStatusResponse {
  appId: string;
  status: string;
  url?: string;
  uptime?: number;
}

export interface SandboxLogsResponse {
  logs: string;
}
