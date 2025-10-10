// Pre-generated minimal TS types mirroring proto messages
// This is a hand-authored shim so the repo builds without buf installed.
export interface RequestMeta { request_id: string; user_id?: string; ts_unix_ms: number; }
export interface PlanInput { meta: RequestMeta; goal: string; context?: string; }
export interface PlanStep { id: string; action: string; tool?: string; payload?: string; }
export interface PlanOutput { meta: RequestMeta; steps: PlanStep[]; }
export interface PlannerClient {
  Plan(input: PlanInput): Promise<PlanOutput>;
}
