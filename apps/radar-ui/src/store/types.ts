export interface SkillRecord {
  skill_id: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  version: string;
  status: 'active' | 'draft' | 'deprecated';
  forked_from: string | null;
  composed_from: string[];
  source_urls: string[];
  source_hashes: string[];
  surface_type: 'widget' | 'chat' | 'menu_bar' | 'mcp_tool';
  usage_count: number;
  last_used_at: string | null;
  last_scanned_at: string | null;
  last_patched_at: string | null;
  eval_score: number | null;
}

export interface WorkflowSpec {
  workflow_id: string;
  title: string;
  description: string;
  category: string;
  tags: string[];
  source_urls: string[];
  source_kind: string[];
  input_schema: { name: string; type: string; required: boolean; description: string }[];
  output_schema: Record<string, unknown>;
  steps: WorkflowStep[];
  evidence: Evidence[];
  surface_suggestion: string;
  confidence: number;
}

export interface WorkflowStep {
  id: string;
  action: string;
  instruction: string;
  expected_output: string;
}

export interface Evidence {
  url: string;
  snippet: string;
}

export interface CompilerDecision {
  decision: 'reuse' | 'fork' | 'compose' | 'create';
  reason: string;
  nearest_skills: { skill_id: string; score: number }[];
  composed_from: string[];
  forked_from: string | null;
}

export interface PatchJob {
  patch_id: string;
  skill_id: string;
  previous_version: string;
  proposed_version: string;
  change_type: 'patch' | 'minor' | 'major';
  source_changed: boolean;
  changed_sources: string[];
  summary: string;
  diff_lines: { type: 'added' | 'removed' | 'context'; content: string }[];
  auto_promote: boolean;
  eval_required: boolean;
  approved: boolean;
}

export interface RunResult {
  skill_id: string;
  skill_name: string;
  project_name: string;
  steps: {
    number: number;
    title: string;
    command?: string;
    detail: string;
    evidence?: Evidence;
    status: 'pending' | 'running' | 'done';
  }[];
}

export type ActivityEventType =
  | 'scan_started'
  | 'scan_complete'
  | 'similarity_found'
  | 'compile_started'
  | 'compile_complete'
  | 'run_started'
  | 'run_step'
  | 'run_complete'
  | 'patch_detected'
  | 'patch_applied'
  | 'skill_created'
  | 'info';

export interface ActivityEvent {
  id: string;
  type: ActivityEventType;
  title: string;
  detail?: string;
  skill_id?: string;
  timestamp: number;
}

export type DetailView =
  | { kind: 'none' }
  | { kind: 'skill'; skill_id: string }
  | { kind: 'scanning'; url: string; progress: number; status: string }
  | { kind: 'workflow_spec'; spec: WorkflowSpec }
  | { kind: 'compiler'; spec: WorkflowSpec; decision: CompilerDecision | null; compiling: boolean }
  | { kind: 'run_result'; result: RunResult }
  | { kind: 'patch'; patch: PatchJob };
