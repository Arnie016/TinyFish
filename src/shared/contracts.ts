import { z } from "zod";

export const sourceKindSchema = z.enum(["docs", "github", "product", "changelog", "demo"]);
export type SourceKind = z.infer<typeof sourceKindSchema>;

export const browserModeSchema = z.enum(["none", "lite", "stealth"]);
export type BrowserMode = z.infer<typeof browserModeSchema>;

export const surfaceTypeSchema = z.enum(["chat", "widget", "menu-bar", "desktop", "mcp"]);
export type SurfaceType = z.infer<typeof surfaceTypeSchema>;

export const sourceCandidateSchema = z.object({
  id: z.string(),
  title: z.string(),
  url: z.url(),
  kind: sourceKindSchema,
  requiresBrowser: z.boolean(),
  browserMode: browserModeSchema,
  reason: z.string(),
});
export type SourceCandidate = z.infer<typeof sourceCandidateSchema>;

export const sourceScanSchema = z.object({
  url: z.url(),
  source_kind: sourceKindSchema,
  recommended_path: z.enum(["fetch", "tinyfish"]),
  browser_mode: browserModeSchema,
  blocked: z.boolean(),
  note: z.string(),
});
export type SourceScan = z.infer<typeof sourceScanSchema>;

export const workflowStepSchema = z.object({
  id: z.string(),
  action: z.string(),
  instruction: z.string(),
  expected_output: z.string(),
});
export type WorkflowStep = z.infer<typeof workflowStepSchema>;

export const workflowFieldSchema = z.object({
  name: z.string(),
  type: z.string(),
  required: z.boolean(),
  description: z.string(),
});
export type WorkflowField = z.infer<typeof workflowFieldSchema>;

export const workflowSpecSchema = z.object({
  workflow_id: z.string(),
  title: z.string(),
  description: z.string(),
  category: z.string(),
  tags: z.array(z.string()),
  source_urls: z.array(z.url()),
  source_kind: z.array(sourceKindSchema),
  input_schema: z.array(workflowFieldSchema),
  output_schema: z.object({
    type: z.literal("object"),
    properties: z.record(z.string(), z.object({ type: z.string() }).passthrough()),
    required: z.array(z.string()),
  }),
  steps: z.array(workflowStepSchema),
  evidence: z.array(
    z.object({
      url: z.url(),
      snippet: z.string(),
    }),
  ),
  surface_suggestion: surfaceTypeSchema,
  mcp_tools_needed: z.array(z.string()),
  confidence: z.number(),
});
export type WorkflowSpec = z.infer<typeof workflowSpecSchema>;

export const skillMatchSchema = z.object({
  skill_id: z.string(),
  score: z.number(),
});
export type SkillMatch = z.infer<typeof skillMatchSchema>;

export const compilerDecisionKindSchema = z.enum(["reuse", "fork", "compose", "create"]);
export type CompilerDecisionKind = z.infer<typeof compilerDecisionKindSchema>;

export const compilerDecisionSchema = z.object({
  decision: compilerDecisionKindSchema,
  reason: z.string(),
  nearest_skills: z.array(skillMatchSchema),
  composed_from: z.array(z.string()),
  forked_from: z.string().nullable(),
});
export type CompilerDecision = z.infer<typeof compilerDecisionSchema>;

export const skillRecordSchema = z.object({
  skill_id: z.string(),
  name: z.string(),
  description: z.string(),
  category: z.string(),
  tags: z.array(z.string()),
  version: z.string(),
  status: z.enum(["active", "draft", "paused"]),
  forked_from: z.string().nullable(),
  composed_from: z.array(z.string()),
  source_urls: z.array(z.url()),
  source_hashes: z.array(z.string()),
  surface_type: surfaceTypeSchema,
  usage_count: z.number(),
  last_used_at: z.string(),
  last_scanned_at: z.string(),
  last_patched_at: z.string().nullable(),
  eval_score: z.number(),
});
export type SkillRecord = z.infer<typeof skillRecordSchema>;

export const surfaceSpecSchema = z.object({
  surface_type: surfaceTypeSchema,
  display_name: z.string(),
  short_description: z.string(),
  icon: z.string(),
  brand_color: z.string(),
  default_prompt: z.string(),
  quick_actions: z.array(z.string()),
  stats_visible: z.boolean(),
});
export type SurfaceSpec = z.infer<typeof surfaceSpecSchema>;

export const evalResultSchema = z.object({
  eval_id: z.string(),
  skill_id: z.string(),
  version: z.string(),
  round: z.string(),
  prompt: z.string(),
  expected_skill: z.string(),
  actual_skill: z.string(),
  passed: z.boolean(),
  metrics: z.object({
    trigger_correct: z.boolean(),
    schema_valid: z.boolean(),
    source_citation_present: z.boolean(),
    latency_ms: z.number(),
  }),
  notes: z.string(),
});
export type EvalResult = z.infer<typeof evalResultSchema>;

export const patchJobSchema = z.object({
  patch_id: z.string(),
  skill_id: z.string(),
  previous_version: z.string(),
  proposed_version: z.string(),
  change_type: z.enum(["patch", "minor"]),
  source_changed: z.boolean(),
  changed_sources: z.array(z.url()),
  summary: z.string(),
  auto_promote: z.boolean(),
  eval_required: z.boolean(),
  approved: z.boolean(),
});
export type PatchJob = z.infer<typeof patchJobSchema>;

export const dashboardStatSchema = z.object({
  label: z.string(),
  value: z.string(),
  detail: z.string(),
});
export type DashboardStat = z.infer<typeof dashboardStatSchema>;

export const usageStatsSchema = z.object({
  total_skills: z.number(),
  active_skills: z.number(),
  total_runs: z.number(),
  patched_this_week: z.number(),
  mean_eval_score: z.number(),
  top_tags: z.array(z.object({ tag: z.string(), count: z.number() })),
});
export type UsageStats = z.infer<typeof usageStatsSchema>;

export type DashboardPayload = {
  view: "dashboard";
  title: string;
  subtitle: string;
  stats: DashboardStat[];
  pipeline: { label: string; detail: string }[];
  skills: SkillRecord[];
  watchlist: { title: string; status: string; detail: string }[];
  quick_actions: string[];
};

export type SkillPayload = {
  view: "skill";
  title: string;
  subtitle: string;
  skill: SkillRecord;
  sources: { url: string; note: string }[];
  evals: EvalResult[];
  quick_actions: string[];
};

export type RunPayload = {
  view: "run";
  title: string;
  subtitle: string;
  outcome: {
    verdict: string;
    rationale: string[];
    next_step: string;
  };
  citations: { label: string; url: string }[];
  decision?: CompilerDecision;
  generated_files?: string[];
  patch?: PatchJob;
};

export type RadarPayload = DashboardPayload | SkillPayload | RunPayload;
