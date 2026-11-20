export class WorkflowEntrypoint<Env = unknown, Params = unknown> {
  protected env: Env;
  protected ctx: ExecutionContext;

  constructor(ctx: ExecutionContext, env: Env) {
    this.ctx = ctx;
    this.env = env;
  }

  async run(_event: WorkflowEvent<Params>, _step: WorkflowStep): Promise<unknown> {
    return undefined;
  }
}

export interface WorkflowEvent<Params = unknown> {
  payload: Params;
  timestamp: Date;
  instanceId: string;
}

export interface WorkflowStep {
  do<T>(name: string, callback: () => Promise<T>): Promise<T>;
  do<T>(name: string, config: unknown, callback: () => Promise<T>): Promise<T>;
}
