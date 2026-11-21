import { WorkflowEntrypoint, WorkflowEvent, WorkflowStep } from 'cloudflare:workers';
import type { WorkerEnv } from '../env';
import type {
  AgentDispatchPayload,
  LintResult,
  QualityBreakdown,
  TokenUsage,
  TraceEntry,
} from '../types';
import {
  createEmptyTokenUsage,
  stageDeepResearch,
  stageDraftAndRefine,
  stageHuntTopics,
  stageLoadContext,
  stagePersistWithGate,
  stageQualityAssessment,
  type AgentContext,
  type DraftArticlePayload,
  type PrimarySourceDoc,
  type TopicHuntDecision,
} from '../lib/agent';
import { createDatabase } from '../lib/db';
import type { FeedItem } from '../lib/tools';

const STAGE_STEP_CONFIG = {
  retries: {
    limit: 2,
    delay: '5 seconds' as const,
    backoff: 'exponential' as const,
  },
  timeout: '4 minutes' as const,
};

interface LoadContextStepOutput {
  runId: number;
  ctxJson: string;
}

interface HuntTopicsStepOutput {
  decision: TopicHuntDecision;
  noveltyScore: number;
  skipReason?: string;
  topic: string;
  angle: string;
  searchQueries: string[];
  feedItems: FeedItem[];
  resolvedModel?: string;
  trace: TraceEntry[];
  usage: TokenUsage;
}

interface DeepResearchStepOutput {
  sources: PrimarySourceDoc[];
  trace: TraceEntry[];
}

interface DraftRefineStepOutput {
  draft: DraftArticlePayload;
  lintResult: LintResult;
  attempts: number;
  trace: TraceEntry[];
  usage: TokenUsage;
}

interface QualityAssessmentStepOutput {
  finalScore: number;
  finalBreakdown: QualityBreakdown;
  revisedDraft?: DraftArticlePayload;
  revisedLintResult?: LintResult;
  trace: TraceEntry[];
  usage: TokenUsage;
}

export interface PersistStepOutput {
  postId: number | null;
  slug: string;
  status: string;
  qualityScore: number;
  decisionReason?: string;
}

/**
 * Durable Cloudflare Workflow executing the 6-stage Pyvren Autonomous Editorial Agent.
 * Each stage runs inside a retryable step.do(...) checkpoint and persists progress
 * to Supabase agent_runs.
 */
export class EditorialAgentWorkflow extends WorkflowEntrypoint<WorkerEnv, AgentDispatchPayload> {
  async run(event: WorkflowEvent<AgentDispatchPayload>, step: WorkflowStep): Promise<PersistStepOutput> {
    const payload = event.payload || {};
    let trackedRunId: number | undefined = payload.run_id;

    try {
      // Stage 1: Load editorial context & initialize agent_runs row
      const loaded = await step.do<LoadContextStepOutput>(
        'load-context',
        STAGE_STEP_CONFIG,
        async () => {
          const db = createDatabase(this.env);
          const ctx = await stageLoadContext(db, payload);

          let runId = payload.run_id;
          if (runId) {
            const existing = await db.getAgentRunById(runId);
            if (existing) {
              await db.updateAgentRun(runId, {
                workflow_instance_id: event.instanceId,
                status: 'running',
                current_stage: 'hunt_topics',
                category_slug: ctx.skill.slug,
                archetype: ctx.archetype,
                model_used: ctx.model,
                error_message: null,
              });
            } else {
              runId = undefined;
            }
          }

          if (!runId) {
            const created = await db.createAgentRun({
              workflow_instance_id: event.instanceId,
              trigger_source: payload.trigger_source || 'manual',
              category_slug: ctx.skill.slug,
              topic: payload.topic || 'auto',
              archetype: ctx.archetype,
              model_used: ctx.model,
              status: 'running',
              current_stage: 'hunt_topics',
            });
            runId = created.id;
          }

          return {
            runId,
            ctxJson: JSON.stringify(ctx),
          };
        },
      );

      trackedRunId = loaded.runId;
      const ctx = JSON.parse(loaded.ctxJson) as AgentContext;

      // Stage 2: Hunt authoritative feeds + select non-duplicate topic
      const hunted = await step.do<HuntTopicsStepOutput>(
        'hunt-topics',
        STAGE_STEP_CONFIG,
        async () => {
          const db = createDatabase(this.env);
          const trace: TraceEntry[] = [];
          const usage = createEmptyTokenUsage();

          const result = await stageHuntTopics(this.env, ctx, payload.topic, trace, usage);

          await db.updateAgentRun(loaded.runId, {
            current_stage:
              result.decision === 'publish_worthy' ? 'deep_research' : result.decision,
            topic: result.topic,
            model_used: result.resolvedModel || ctx.model,
            trace_json: trace,
            token_usage_json: usage,
          });

          return {
            decision: result.decision,
            noveltyScore: result.noveltyScore,
            ...(result.skipReason ? { skipReason: result.skipReason } : {}),
            topic: result.topic,
            angle: result.angle,
            searchQueries: result.searchQueries,
            feedItems: result.feedItems,
            ...(result.resolvedModel ? { resolvedModel: result.resolvedModel } : {}),
            trace,
            usage,
          };
        },
      );

      // Short-circuit cleanly when editorial novelty / duplicate / daily-cap gate skips the run
      if (hunted.decision !== 'publish_worthy') {
        const decisionReason = hunted.skipReason || 'Skipped by editorial gate';
        await step.do('finalize-skipped-run', STAGE_STEP_CONFIG, async () => {
          const db = createDatabase(this.env);
          await db.updateAgentRun(loaded.runId, {
            status: 'skipped',
            current_stage: hunted.decision,
            topic: hunted.topic,
            model_used: hunted.resolvedModel || ctx.model,
            decision_reason: decisionReason,
            trace_json: hunted.trace,
            token_usage_json: hunted.usage,
            completed_at: new Date().toISOString(),
          });
        });

        return {
          postId: null,
          slug: '',
          status: 'skipped',
          qualityScore: 0,
          decisionReason: hunted.skipReason,
        };
      }

      if (hunted.resolvedModel) {
        ctx.model = hunted.resolvedModel;
      }

      // Stage 3: Deep primary-source web search & webpage extraction
      const researched = await step.do<DeepResearchStepOutput>(
        'deep-research',
        STAGE_STEP_CONFIG,
        async () => {
          const db = createDatabase(this.env);
          const trace: TraceEntry[] = [...hunted.trace];

          const sources = await stageDeepResearch(
            this.env,
            hunted.topic,
            hunted.searchQueries,
            hunted.feedItems,
            trace,
          );

          await db.updateAgentRun(loaded.runId, {
            current_stage: 'draft_and_refine',
            trace_json: trace,
          });

          return { sources, trace };
        },
      );

      // Reset Cloudflare Workers Free-plan 50-subrequest invocation budget before drafting
      if (typeof step.sleep === 'function') {
        await step.sleep('yield-budget-draft', '10 seconds');
      }

      // Stage 4: Draft structured JSON & deterministic self-correction loop
      const drafted = await step.do<DraftRefineStepOutput>(
        'draft-and-refine',
        STAGE_STEP_CONFIG,
        async () => {
          const db = createDatabase(this.env);
          const trace: TraceEntry[] = [...researched.trace];
          const usage: TokenUsage = { ...hunted.usage };

          const result = await stageDraftAndRefine(
            this.env,
            ctx,
            hunted.topic,
            researched.sources,
            trace,
            usage,
          );

          await db.updateAgentRun(loaded.runId, {
            current_stage: 'quality_assessment',
            trace_json: trace,
            token_usage_json: usage,
          });

          return {
            draft: result.draft,
            lintResult: result.lintResult,
            attempts: result.attempts,
            trace,
            usage,
          };
        },
      );

      // Reset Cloudflare Workers Free-plan 50-subrequest invocation budget before dual-critic + persist
      if (typeof step.sleep === 'function') {
        await step.sleep('yield-budget-critic', '10 seconds');
      }

      // Stage 5: Cross-family dual-model critic review & revision loop
      const assessed = await step.do<QualityAssessmentStepOutput>(
        'quality-assessment',
        STAGE_STEP_CONFIG,
        async () => {
          const db = createDatabase(this.env);
          const trace: TraceEntry[] = [...drafted.trace];
          const usage: TokenUsage = { ...drafted.usage };

          const result = await stageQualityAssessment(
            this.env,
            ctx,
            drafted.draft,
            drafted.lintResult,
            trace,
            usage,
            researched.sources,
          );

          await db.updateAgentRun(loaded.runId, {
            current_stage: 'persist_with_gate',
            quality_score: result.finalScore,
            trace_json: trace,
            token_usage_json: usage,
          });

          return {
            finalScore: result.finalScore,
            finalBreakdown: result.finalBreakdown,
            ...(result.revisedDraft ? { revisedDraft: result.revisedDraft } : {}),
            ...(result.revisedLintResult ? { revisedLintResult: result.revisedLintResult } : {}),
            trace,
            usage,
          };
        },
      );

      // Stage 6: Persist article with hard publishing gate & finalize agent_runs
      const persisted = await step.do<PersistStepOutput>(
        'persist-with-gate',
        STAGE_STEP_CONFIG,
        async () => {
          const db = createDatabase(this.env);
          const trace: TraceEntry[] = [...assessed.trace];
          const usage: TokenUsage = { ...assessed.usage };

          const { post, run } = await stagePersistWithGate(
            db,
            ctx,
            assessed.revisedDraft || drafted.draft,
            assessed.revisedLintResult || drafted.lintResult,
            assessed.finalScore,
            assessed.finalBreakdown,
            loaded.runId,
            trace,
            usage,
          );

          return {
            postId: post.id,
            slug: post.slug,
            status: post.status,
            qualityScore: post.quality_score,
            ...(run?.decision_reason ? { decisionReason: run.decision_reason } : {}),
          };
        },
      );

      return persisted;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      if (trackedRunId) {
        try {
          const db = createDatabase(this.env);
          await db.updateAgentRun(trackedRunId, {
            status: 'failed',
            current_stage: 'failed',
            error_message: errorMessage,
            completed_at: new Date().toISOString(),
          });
        } catch {
          // Best-effort failure persistence; preserve original workflow error
        }
      }
      throw err;
    }
  }
}
