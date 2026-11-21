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
import { lintPostPayload } from '../lib/linter';
import { compileMarkdown } from '../lib/markdown';
import { probeWorkingModelPool } from '../lib/openrouter';
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
  fastestModels?: string[];
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
 * Durable Cloudflare Workflow executing the 6-stage Pyvren Autonomous Editorial Agent
 * (and durable 2-step post auto-improvement when `improve_post_id` is provided).
 * Each stage runs inside a retryable step.do(...) checkpoint and persists progress
 * to Supabase agent_runs.
 */
export class EditorialAgentWorkflow extends WorkflowEntrypoint<WorkerEnv, AgentDispatchPayload> {
  async run(event: WorkflowEvent<AgentDispatchPayload>, step: WorkflowStep): Promise<PersistStepOutput> {
    const payload = event.payload || {};
    let trackedRunId: number | undefined = payload.run_id;

    try {
      // Durable Auto-Improve Mode for an existing draft/low-score post
      if (typeof payload.improve_post_id === 'number' && payload.improve_post_id > 0) {
        const targetPostId = payload.improve_post_id;
        const prep = await step.do<{
          runId: number;
          ctxJson: string;
          postJson: string;
          sources: PrimarySourceDoc[];
          trace: TraceEntry[];
        }>('improve-research', STAGE_STEP_CONFIG, async () => {
          const db = createDatabase(this.env);
          const existing = await db.getPostById(targetPostId);
          if (!existing) {
            throw new Error(`Post #${targetPostId} not found for auto-improvement.`);
          }
          const ctx = await stageLoadContext(db, {
            category_slug: existing.category_slug,
            archetype: existing.archetype,
            trigger_source: payload.trigger_source || 'manual',
            force: true,
          });
          const trace: TraceEntry[] = [];

          // Probe live working model pool across NIM + OpenRouter
          try {
            const probeResults = await probeWorkingModelPool(
              this.env,
              [
                ctx.model,
                ctx.settings.fallback_model_1 || '',
                ctx.settings.fallback_model_2 || '',
                ctx.judgeModel,
              ].filter(Boolean),
              { timeoutMs: 7_000 },
            );
            const working = probeResults.filter((r) => r.ok && r.json_ok);
            if (working.length > 0) {
              ctx.fastestModels = working.map((r) => r.id);
              if (probeResults.some((r) => r.id === ctx.model && !r.ok)) {
                ctx.model = working[0].id;
              }
            }
          } catch {
            // proceed with failover chain
          }

          let runId = payload.run_id;
          if (!runId) {
            const created = await db.createAgentRun({
              workflow_instance_id: event.instanceId,
              trigger_source: payload.trigger_source || 'manual',
              category_slug: existing.category_slug,
              topic: `Auto-improve: ${existing.title}`,
              archetype: existing.archetype,
              model_used: ctx.model,
              status: 'running',
              current_stage: 'deep_research',
            });
            runId = created.id;
            await db.updateAgentRun(runId, { post_id: existing.id });
          } else {
            await db.updateAgentRun(runId, {
              workflow_instance_id: event.instanceId,
              status: 'running',
              current_stage: 'deep_research',
              post_id: existing.id,
            });
          }

          const seedFeedItems: FeedItem[] = (existing.sources_json || [])
            .filter((u) => typeof u === 'string' && u.startsWith('https://'))
            .slice(0, 4)
            .map((url) => ({
              title: existing.title,
              url,
              summary: existing.description || existing.tldr_summary || existing.title,
            }));

          const searchQueries = [
            existing.title,
            `${existing.title} CVE advisory patch version official`,
            ...(existing.keywords_json || []).slice(0, 2).map((kw) => `${existing.title} ${kw}`),
          ].slice(0, 3);

          const sources = await stageDeepResearch(
            this.env,
            existing.title,
            searchQueries,
            seedFeedItems,
            trace,
          );

          await db.updateAgentRun(runId, {
            current_stage: 'quality_assessment',
            trace_json: trace,
          });

          return {
            runId,
            ctxJson: JSON.stringify(ctx),
            postJson: JSON.stringify(existing),
            sources,
            trace,
          };
        });

        trackedRunId = prep.runId;

        if (typeof step.sleep === 'function') {
          await step.sleep('yield-budget-improve', '10 seconds');
        }

        const improved = await step.do<PersistStepOutput>(
          'improve-critic-and-persist',
          STAGE_STEP_CONFIG,
          async () => {
            const db = createDatabase(this.env);
            const ctx = JSON.parse(prep.ctxJson) as AgentContext;
            const existing = JSON.parse(prep.postJson) as import('../types').PostRecord;
            const trace: TraceEntry[] = [...prep.trace];
            const usage = createEmptyTokenUsage();

            const initialDraft: DraftArticlePayload = {
              title: existing.title,
              slug: existing.slug,
              description: existing.description,
              tldr_summary: existing.tldr_summary,
              cover_image_url: existing.cover_image_url,
              cover_image_alt: existing.cover_image_alt,
              images: Array.isArray(existing.images_json) ? existing.images_json : [],
              key_facts: Array.isArray(existing.key_facts_json) ? existing.key_facts_json : [],
              faq: Array.isArray(existing.faq_json) ? existing.faq_json : [],
              body_markdown: existing.body_markdown,
              tags: Array.isArray(existing.tags_json) ? existing.tags_json : [],
              keywords: Array.isArray(existing.keywords_json) ? existing.keywords_json : [],
              sources: Array.isArray(existing.sources_json) ? existing.sources_json : [],
              review_notes: Array.isArray(existing.review_notes_json)
                ? existing.review_notes_json
                : [],
            };

            const initialLint = lintPostPayload({
              title: initialDraft.title,
              description: initialDraft.description,
              tldr_summary: initialDraft.tldr_summary,
              key_facts: initialDraft.key_facts,
              faq: initialDraft.faq,
              body_markdown: initialDraft.body_markdown,
              author: existing.author || ctx.settings.default_author,
              archetype: existing.archetype,
              sources: initialDraft.sources,
              banned_patterns: ctx.skill.banned_patterns_json,
            });

            const assessed = await stageQualityAssessment(
              this.env,
              ctx,
              initialDraft,
              initialLint,
              trace,
              usage,
              prep.sources,
              {
                reAuditAfterRevision: true,
                maxImprovementRounds: 2,
              },
            );

            const finalDraft = assessed.revisedDraft || initialDraft;
            const finalLint = assessed.revisedLintResult || initialLint;
            const compiled = compileMarkdown(finalDraft.body_markdown);
            const minPublishScore = Math.max(
              50,
              Math.min(100, ctx.settings.min_publish_score || 78),
            );
            const canAutoPublish =
              ctx.settings.publishing_mode === 'auto_publish' &&
              finalLint.passed &&
              assessed.finalScore >= minPublishScore;
            const nextStatus: import('../types').PostStatus =
              existing.status === 'published' ? 'published' : canAutoPublish ? 'published' : 'draft';

            const saved =
              (await db.updatePost(existing.id, {
                title: finalDraft.title,
                description: finalDraft.description,
                tldr_summary: finalDraft.tldr_summary,
                cover_image_url: finalDraft.cover_image_url,
                cover_image_alt: finalDraft.cover_image_alt,
                images_json: finalDraft.images,
                key_facts_json: finalDraft.key_facts,
                faq_json: finalDraft.faq,
                body_markdown: finalDraft.body_markdown,
                body_html: compiled.html,
                tags_json: finalDraft.tags,
                keywords_json: finalDraft.keywords,
                sources_json: finalDraft.sources,
                review_notes_json: finalDraft.review_notes,
                lint_passed: finalLint.passed,
                lint_errors_json: finalLint.errors,
                quality_score: assessed.finalScore,
                quality_breakdown_json: assessed.finalBreakdown,
                reading_time_minutes: finalLint.reading_time_minutes || compiled.readingTimeMinutes,
                word_count: finalLint.word_count || compiled.wordCount,
                status: nextStatus,
                published_at:
                  existing.published_at ||
                  (nextStatus === 'published' ? new Date().toISOString() : null),
                last_edited_by: 'agent-auto-improve',
              })) || existing;

            const reason = `Auto-improved post #${saved.id} (${existing.quality_score} -> ${assessed.finalScore}/100, lint=${finalLint.passed ? 'PASS' : 'FAIL'}, status=${nextStatus})`;
            await db.updateAgentRun(prep.runId, {
              status: 'completed',
              current_stage: 'completed',
              topic: `Auto-improve: ${saved.title}`,
              model_used: ctx.model,
              quality_score: assessed.finalScore,
              decision_reason: reason,
              post_id: saved.id,
              trace_json: trace,
              token_usage_json: usage,
              completed_at: new Date().toISOString(),
            });

            return {
              postId: saved.id,
              slug: saved.slug,
              status: saved.status,
              qualityScore: assessed.finalScore,
              decisionReason: reason,
            };
          },
        );

        return improved;
      }

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
            ...(result.fastestModels ? { fastestModels: result.fastestModels } : {}),
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
      if (Array.isArray(hunted.fastestModels) && hunted.fastestModels.length > 0) {
        ctx.fastestModels = hunted.fastestModels;
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
