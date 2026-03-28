import { z } from "zod";

export const sourceKindSchema = z.enum(["docs", "api", "community", "moodboard", "manual"]);
export type SourceKind = z.infer<typeof sourceKindSchema>;

export const browserModeSchema = z.enum(["none", "lite", "stealth"]);
export type BrowserMode = z.infer<typeof browserModeSchema>;

export const scenePhaseSchema = z.enum([
  "idle",
  "researching",
  "normalizing",
  "ready",
  "validating",
  "repairing",
  "applying",
  "completed",
  "error",
]);
export type ScenePhase = z.infer<typeof scenePhaseSchema>;

export const sceneChatRoleSchema = z.enum(["user", "assistant"]);
export type SceneChatRole = z.infer<typeof sceneChatRoleSchema>;

export const checkpointLoopStatusSchema = z.enum(["idle", "running", "completed", "error"]);
export type CheckpointLoopStatus = z.infer<typeof checkpointLoopStatusSchema>;

export const sceneNodeTypeSchema = z.enum([
  "research_source",
  "scene_grounding",
  "tinyfish_run",
  "scene_checkpoint",
  "scene_object",
  "camera",
  "lighting",
  "workflow_skill",
  "blender_action",
  "validation_issue",
]);
export type SceneNodeType = z.infer<typeof sceneNodeTypeSchema>;

export const sceneNodeStatusSchema = z.enum(["idle", "queued", "running", "ready", "warning", "error", "blocked"]);
export type SceneNodeStatus = z.infer<typeof sceneNodeStatusSchema>;

export const sceneObjectCategorySchema = z.enum(["prop", "setpiece", "character", "vehicle", "fx", "note"]);
export type SceneObjectCategory = z.infer<typeof sceneObjectCategorySchema>;

export const checkpointKindSchema = z.enum([
  "scene_grounded",
  "run_created",
  "page_identity_verified",
  "research_extracted",
  "scene_spec_normalized",
  "scene_graph_resolved",
  "blender_plan_ready",
  "blender_applied",
  "verification_passed",
  "repair_needed",
]);
export type CheckpointKind = z.infer<typeof checkpointKindSchema>;

export const validationSeveritySchema = z.enum(["info", "warning", "error"]);
export type ValidationSeverity = z.infer<typeof validationSeveritySchema>;

export const validationStatusSchema = z.enum(["pending", "passed", "failed"]);
export type ValidationStatus = z.infer<typeof validationStatusSchema>;

export const blenderBridgeModeSchema = z.enum(["live", "fallback", "unavailable"]);
export type BlenderBridgeMode = z.infer<typeof blenderBridgeModeSchema>;

export const blenderRunStatusSchema = z.enum(["idle", "queued", "applying", "applied", "failed", "fallback_ready"]);
export type BlenderRunStatus = z.infer<typeof blenderRunStatusSchema>;

export const blenderActionKindSchema = z.enum(["collection", "mesh", "camera", "light", "annotation", "material"]);
export type BlenderActionKind = z.infer<typeof blenderActionKindSchema>;

export const blenderActionStatusSchema = z.enum(["pending", "running", "done", "failed", "blocked"]);
export type BlenderActionStatus = z.infer<typeof blenderActionStatusSchema>;

export const tinyFishEventTypeSchema = z.enum(["started", "streaming_url", "progress", "checkpoint", "complete", "error"]);
export type TinyFishEventType = z.infer<typeof tinyFishEventTypeSchema>;

export const sourceCandidateSchema = z.object({
  id: z.string(),
  title: z.string(),
  url: z.url(),
  kind: sourceKindSchema,
  requires_browser: z.boolean(),
  recommended_browser_mode: browserModeSchema,
  reason: z.string(),
});
export type SourceCandidate = z.infer<typeof sourceCandidateSchema>;

export const sceneEvidenceSchema = z.object({
  id: z.string(),
  label: z.string(),
  url: z.url(),
  snippet: z.string(),
  source_kind: sourceKindSchema,
});
export type SceneEvidence = z.infer<typeof sceneEvidenceSchema>;

export const sceneObjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: sceneObjectCategorySchema,
  description: z.string(),
  material: z.string(),
  color: z.string(),
  approx_size: z.string(),
  placement_hint: z.string(),
  importance: z.number().min(1).max(5),
  confidence: z.number().min(0).max(1),
  citations: z.array(sceneEvidenceSchema),
});
export type SceneObject = z.infer<typeof sceneObjectSchema>;

export const sceneSpecSchema = z.object({
  scene_id: z.string(),
  project_title: z.string(),
  topic: z.string(),
  scene_goal: z.string(),
  style_keywords: z.array(z.string()),
  environment: z.object({
    location_type: z.string(),
    time_of_day: z.string(),
    weather: z.string(),
    mood: z.string(),
    scale: z.string(),
  }),
  objects: z.array(sceneObjectSchema),
  camera: z.object({
    shot_type: z.string(),
    lens_feel: z.string(),
    framing_notes: z.string(),
  }),
  lighting: z.object({
    key_light: z.string(),
    fill_light: z.string(),
    rim_light: z.string(),
    practicals: z.array(z.string()),
    overall_feel: z.string(),
  }),
  animation_cues: z.array(z.string()),
  composition_rules: z.array(z.string()),
  must_include: z.array(z.string()),
  avoid: z.array(z.string()),
  citations: z.array(sceneEvidenceSchema),
});
export type SceneSpec = z.infer<typeof sceneSpecSchema>;

export const sceneGroundingSchema = z.object({
  scene_name: z.string(),
  current_frame: z.number().int(),
  frame_start: z.number().int(),
  frame_end: z.number().int(),
  active_object: z.string().nullable(),
  selected_objects: z.array(z.string()),
  object_count: z.number().int().nonnegative(),
  collection_names: z.array(z.string()),
  camera_names: z.array(z.string()),
  light_names: z.array(z.string()),
  object_names: z.array(z.string()),
  summary_lines: z.array(z.string()),
  viewport_image: z.string().nullable(),
});
export type SceneGrounding = z.infer<typeof sceneGroundingSchema>;

export const sceneGraphNodeSchema = z.object({
  id: z.string(),
  type: sceneNodeTypeSchema,
  status: sceneNodeStatusSchema,
  label: z.string(),
  summary: z.string(),
  detail_lines: z.array(z.string()),
  x: z.number(),
  y: z.number(),
  citations: z.array(sceneEvidenceSchema),
  clusterable: z.boolean(),
});
export type SceneGraphNode = z.infer<typeof sceneGraphNodeSchema>;

export const sceneGraphEdgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  kind: z.enum(["feeds", "verifies", "resolves", "controls", "reports"]),
  label: z.string(),
});
export type SceneGraphEdge = z.infer<typeof sceneGraphEdgeSchema>;

export const sceneValidationIssueSchema = z.object({
  id: z.string(),
  severity: validationSeveritySchema,
  code: z.string(),
  message: z.string(),
  suggested_fix: z.string(),
  node_ids: z.array(z.string()),
  blocking: z.boolean(),
});
export type SceneValidationIssue = z.infer<typeof sceneValidationIssueSchema>;

export const blenderActionSchema = z.object({
  id: z.string(),
  kind: blenderActionKindSchema,
  label: z.string(),
  detail: z.string(),
  command: z.string(),
  target_node_ids: z.array(z.string()),
  status: blenderActionStatusSchema,
});
export type BlenderAction = z.infer<typeof blenderActionSchema>;

export const blenderCommandPlanSchema = z.object({
  scene_id: z.string(),
  summary: z.string(),
  notes: z.array(z.string()),
  actions: z.array(blenderActionSchema),
});
export type BlenderCommandPlan = z.infer<typeof blenderCommandPlanSchema>;

export const blenderRunStateSchema = z.object({
  bridge_mode: blenderBridgeModeSchema,
  status: blenderRunStatusSchema,
  endpoint_configured: z.boolean(),
  summary: z.string(),
  last_applied_at: z.string().nullable(),
  command_plan: blenderCommandPlanSchema,
});
export type BlenderRunState = z.infer<typeof blenderRunStateSchema>;

export const sceneWorkflowSkillSchema = z.object({
  id: z.string(),
  name: z.string(),
  purpose: z.string(),
  when_to_use: z.string(),
  steps: z.array(z.string()),
  codex_prompt: z.string(),
  target_node_ids: z.array(z.string()),
});
export type SceneWorkflowSkill = z.infer<typeof sceneWorkflowSkillSchema>;

export const sceneChatMessageSchema = z.object({
  id: z.string(),
  role: sceneChatRoleSchema,
  text: z.string(),
  timestamp: z.string(),
});
export type SceneChatMessage = z.infer<typeof sceneChatMessageSchema>;

export const checkpointLoopStateSchema = z.object({
  enabled: z.boolean(),
  auto_apply: z.boolean(),
  status: checkpointLoopStatusSchema,
  repair_attempts: z.number().int().nonnegative(),
  max_repairs: z.number().int().positive(),
  replay_attempts: z.number().int().nonnegative(),
  max_replays: z.number().int().positive(),
  last_outcome: z.string(),
});
export type CheckpointLoopState = z.infer<typeof checkpointLoopStateSchema>;

export const tinyFishEventSchema = z.object({
  id: z.string(),
  type: tinyFishEventTypeSchema,
  title: z.string(),
  detail: z.string(),
  timestamp: z.string(),
  run_id: z.string().nullable(),
  streaming_url: z.string().nullable(),
});
export type TinyFishEvent = z.infer<typeof tinyFishEventSchema>;

export const tinyFishCapabilityProfileSchema = z.object({
  name: z.string(),
  docs_url: z.url(),
  api_base: z.url(),
  primary_endpoint: z.string(),
  browser_profiles: z.array(
    z.object({
      id: browserModeSchema,
      label: z.string(),
      best_for: z.string(),
    }),
  ),
  event_types: z.array(z.string()),
  constraints: z.array(z.string()),
  example_goal_templates: z.array(z.string()),
});
export type TinyFishCapabilityProfile = z.infer<typeof tinyFishCapabilityProfileSchema>;

export const sceneSessionSchema = z.object({
  view: z.literal("orchestrator"),
  scene_id: z.string(),
  title: z.string(),
  subtitle: z.string(),
  goal: z.string(),
  phase: scenePhaseSchema,
  phase_label: z.string(),
  updated_at: z.string(),
  narrative: z.object({
    codex_role: z.string(),
    operator_brief: z.array(z.string()),
    next_best_move: z.string(),
  }),
  capability_profile: tinyFishCapabilityProfileSchema,
  available_sources: z.array(sourceCandidateSchema),
  graph: z.object({
    nodes: z.array(sceneGraphNodeSchema),
    edges: z.array(sceneGraphEdgeSchema),
  }),
  checkpoints: z.array(
    z.object({
      kind: checkpointKindSchema,
      status: sceneNodeStatusSchema,
      note: z.string(),
    }),
  ),
  tinyfish: z.object({
    enabled: z.boolean(),
    live: z.boolean(),
    browser_profile: browserModeSchema,
    status: z.string(),
    run_id: z.string().nullable(),
    streaming_url: z.string().nullable(),
    docs_reasoning: z.array(z.string()),
    events: z.array(tinyFishEventSchema),
  }),
  grounding: sceneGroundingSchema.nullable(),
  scene_spec: sceneSpecSchema.nullable(),
  workflow_skills: z.array(sceneWorkflowSkillSchema),
  chat_messages: z.array(sceneChatMessageSchema),
  chat_placeholder: z.string(),
  checkpoint_loop: checkpointLoopStateSchema,
  validation: z.object({
    status: validationStatusSchema,
    summary: z.string(),
    issues: z.array(sceneValidationIssueSchema),
  }),
  blender: blenderRunStateSchema,
  quick_actions: z.array(z.string()),
  cluster_placeholder: z.string(),
  export_filename: z.string(),
});
export type SceneSession = z.infer<typeof sceneSessionSchema>;

export type ScenePayload = SceneSession;
