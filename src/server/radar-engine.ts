import {
  compilerDecisionKindSchema,
  type CompilerDecision,
  type DashboardPayload,
  type PatchJob,
  type RadarPayload,
  type RunPayload,
  type SkillMatch,
  type SkillPayload,
  type SkillRecord,
  type SourceKind,
  type SourceScan,
  type SurfaceType,
  type UsageStats,
  type WorkflowSpec,
} from "../shared/contracts.js";
import { productLine, seedEvals, seedSkills, seedSources, surfacePresets } from "../shared/seed.js";

type DiscoverSourcesInput = {
  topic: string;
  sourceKinds?: SourceKind[];
  preferLiveBrowser?: boolean;
};

type ExtractWorkflowInput = {
  title: string;
  description?: string;
  sourceUrls: string[];
  desiredSurface?: SurfaceType;
};

type FindSkillsInput = {
  category?: string;
  tags?: string[];
  workflowTitle?: string;
};

type CompileSkillInput = {
  workflowSpec: WorkflowSpec;
  preferredStrategy?: CompilerDecision["decision"];
};

type PatchSkillInput = {
  skillId: string;
  reason: string;
  changedSources?: string[];
};

type ListSkillsInput = {
  category?: string;
  tag?: string;
  status?: SkillRecord["status"];
};

const pipeline = [
  {
    label: "Watch sources",
    detail: "Start with public repos, docs, changelogs, and demo pages.",
  },
  {
    label: "Normalize workflow",
    detail: "Turn rough instructions into a versioned JSON spec with evidence.",
  },
  {
    label: "Retrieve before generate",
    detail: "Search the skill bank for the nearest reusable patterns first.",
  },
  {
    label: "Compile and surface",
    detail: "Emit a skill plus a widget or chat surface that feels executable.",
  },
  {
    label: "Patch on drift",
    detail: "Open eval-gated patch jobs whenever the public source moves.",
  },
];

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function uniq<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function inferSourceKind(url: string): SourceKind {
  if (url.includes("github.com")) {
    return "github";
  }
  if (url.includes("changelog")) {
    return "changelog";
  }
  if (url.includes("developers.openai.com") || url.includes("/docs")) {
    return "docs";
  }
  if (url.includes("demo") || url.includes("play")) {
    return "demo";
  }
  return "product";
}

function inferScan(url: string): SourceScan {
  const sourceKind = inferSourceKind(url);
  const recommendedPath = sourceKind === "demo" || sourceKind === "product" ? "tinyfish" : "fetch";
  const browserMode = recommendedPath === "tinyfish" ? "lite" : "none";

  return {
    url,
    source_kind: sourceKind,
    recommended_path: recommendedPath,
    browser_mode: browserMode,
    blocked: false,
    note:
      recommendedPath === "tinyfish"
        ? "Dynamic or judge-facing surface detected. Escalate to TinyFish only for the interactive pass."
        : "Cheap parse is enough here. Keep TinyFish in reserve.",
  };
}

function titleTokens(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .filter((token) => token.length > 2);
}

function makeTags(title: string, description?: string): string[] {
  const tokens = [...titleTokens(title), ...titleTokens(description ?? "")];
  const tags = new Set<string>(["workflow-compiler", "mcp"]);

  for (const token of tokens) {
    if (token.includes("doc")) tags.add("documentation");
    if (token.includes("browser") || token.includes("crawl")) tags.add("browser-automation");
    if (token.includes("widget")) tags.add("widget");
    if (token.includes("menu")) tags.add("menu-bar");
    if (token.includes("patch") || token.includes("drift")) tags.add("patch-loop");
    if (token.includes("repo") || token.includes("github")) tags.add("github");
    if (token.includes("swift")) tags.add("swiftui");
    if (token.includes("tool")) tags.add("tooling");
  }

  for (const token of tokens.slice(0, 4)) {
    tags.add(token);
  }

  return [...tags].slice(0, 8);
}

function bumpPatch(version: string): string {
  const [major = "0", minor = "1", patch = "0"] = version.split(".");
  return `${major}.${minor}.${Number(patch) + 1}`;
}

function computeSkillMatches(input: FindSkillsInput): SkillMatch[] {
  const requestedTags = uniq(input.tags ?? []);
  const requestedTitleTokens = titleTokens(input.workflowTitle ?? "");
  const requestedCategory = input.category?.toLowerCase();

  return seedSkills
    .map((skill) => {
      const tagHits = skill.tags.filter((tag) => requestedTags.includes(tag)).length;
      const titleHits = titleTokens(skill.name).filter((token) => requestedTitleTokens.includes(token)).length;
      const categoryBonus =
        requestedCategory && skill.category.toLowerCase() === requestedCategory ? 0.35 : 0;
      const tagScore = requestedTags.length > 0 ? (tagHits / requestedTags.length) * 0.45 : 0;
      const titleScore = requestedTitleTokens.length > 0 ? (titleHits / requestedTitleTokens.length) * 0.2 : 0;
      const score = Number(Math.min(categoryBonus + tagScore + titleScore + skill.eval_score * 0.15, 0.98).toFixed(2));

      return {
        skill_id: skill.skill_id,
        score,
      };
    })
    .sort((left, right) => right.score - left.score)
    .slice(0, 3);
}

function decideStrategy(matches: SkillMatch[]): CompilerDecision["decision"] {
  const [best = { score: 0 }, second = { score: 0 }] = matches;

  if (best.score >= 0.85) {
    return "reuse";
  }
  if (best.score >= 0.62) {
    return "fork";
  }
  if (best.score >= 0.45 && second.score >= 0.35) {
    return "compose";
  }
  return "create";
}

function buildDecision(input: FindSkillsInput, preferredStrategy?: CompilerDecision["decision"]): CompilerDecision {
  const nearestSkills = computeSkillMatches(input);
  const decision = preferredStrategy ?? decideStrategy(nearestSkills);
  const leadSkill = seedSkills.find((skill) => skill.skill_id === nearestSkills[0]?.skill_id);

  const reasonByDecision: Record<CompilerDecision["decision"], string> = {
    reuse: "A close skill already covers the workflow shape, so reuse keeps the demo fast and believable.",
    fork: "A related skill exists, but the surface and evidence model need a tailored branch.",
    compose: "The workflow spans multiple capability clusters, so composition is safer than a brand new skill.",
    create: "No close skill covers this route well enough yet, so create a fresh entry in the catalog.",
  };

  return {
    decision: compilerDecisionKindSchema.parse(decision),
    reason: reasonByDecision[decision],
    nearest_skills: nearestSkills,
    composed_from:
      decision === "compose"
        ? nearestSkills.slice(0, 2).map((skill) => skill.skill_id)
        : [],
    forked_from: decision === "fork" ? leadSkill?.skill_id ?? null : null,
  };
}

function getSkill(skillId?: string): SkillRecord {
  return seedSkills.find((skill) => skill.skill_id === skillId) ?? seedSkills[0];
}

function statsFromSkills(skills: SkillRecord[]): UsageStats {
  const tagCounts = new Map<string, number>();

  for (const skill of skills) {
    for (const tag of skill.tags) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    }
  }

  const meanEvalScore =
    skills.reduce((sum, skill) => sum + skill.eval_score, 0) / Math.max(skills.length, 1);

  return {
    total_skills: skills.length,
    active_skills: skills.filter((skill) => skill.status === "active").length,
    total_runs: skills.reduce((sum, skill) => sum + skill.usage_count, 0),
    patched_this_week: skills.filter((skill) => skill.last_patched_at).length,
    mean_eval_score: Number(meanEvalScore.toFixed(2)),
    top_tags: [...tagCounts.entries()]
      .sort((left, right) => right[1] - left[1])
      .slice(0, 5)
      .map(([tag, count]) => ({ tag, count })),
  };
}

export function discoverSources(input: DiscoverSourcesInput) {
  const tokens = titleTokens(input.topic);

  const filtered = seedSources
    .filter((source) => {
      if (input.sourceKinds?.length && !input.sourceKinds.includes(source.kind)) {
        return false;
      }
      return true;
    })
    .map((source) => {
      const haystack = `${source.title} ${source.reason} ${source.url}`.toLowerCase();
      const matches = tokens.filter((token) => haystack.includes(token)).length;
      const boost = source.requiresBrowser && input.preferLiveBrowser ? 1 : 0;
      return { source, score: matches + boost };
    })
    .sort((left, right) => right.score - left.score);

  const sources = (filtered.some((entry) => entry.score > 0) ? filtered : filtered.slice(0, 4))
    .map((entry) => entry.source)
    .slice(0, 5);

  return {
    sources,
    escalatedToTinyFish: sources.some((source) => source.requiresBrowser),
    rationale:
      "Radar starts with public, cheap sources first and only marks a browser pass when the page is dynamic, JS-heavy, or demo-critical.",
  };
}

export function scanSources(sourceUrls: string[]) {
  const scans = sourceUrls.map(inferScan);

  return {
    scans,
    blocked: scans.some((scan) => scan.blocked),
    next_step:
      scans.some((scan) => scan.recommended_path === "tinyfish")
        ? "Run TinyFish on the interactive sources and keep the rest on fetch."
        : "Stay on cheap parsing and move to workflow normalization.",
  };
}

export function extractWorkflow(input: ExtractWorkflowInput): WorkflowSpec {
  const sourceKind = uniq(input.sourceUrls.map(inferSourceKind));
  const tags = makeTags(input.title, input.description);
  const surfaceSuggestion =
    input.desiredSurface ??
    (tags.includes("menu-bar") ? "menu-bar" : tags.includes("widget") ? "widget" : "widget");
  const category = tags.includes("browser-automation") ? "Browser Automation" : "Documentation";

  return {
    workflow_id: slugify(input.title),
    title: input.title,
    description:
      input.description ??
      "Normalize a public workflow, retrieve the nearest existing skills, and compile the best reusable surface.",
    category,
    tags,
    source_urls: input.sourceUrls,
    source_kind: sourceKind,
    input_schema: [
      {
        name: "source_topic",
        type: "string",
        required: true,
        description: "Plain-language description of the public workflow to capture.",
      },
      {
        name: "source_urls",
        type: "string[]",
        required: true,
        description: "Public URLs that contain the repeatable steps or evidence.",
      },
    ],
    output_schema: {
      type: "object",
      properties: {
        decision: { type: "string" },
        reasoning: { type: "array" },
        generated_skill: { type: "object" },
      },
      required: ["decision", "reasoning"],
    },
    steps: [
      {
        id: "s1",
        action: "discover",
        instruction: "Check public repos and docs first, then escalate only the dynamic pages to TinyFish.",
        expected_output: "ranked evidence plan",
      },
      {
        id: "s2",
        action: "normalize",
        instruction: "Turn the messy instructions into a structured workflow JSON spec.",
        expected_output: "workflow_spec.json",
      },
      {
        id: "s3",
        action: "retrieve",
        instruction: "Search the skill bank for the closest reusable skills before creating anything new.",
        expected_output: "compiler decision",
      },
      {
        id: "s4",
        action: "surface",
        instruction: "Compile the chosen skill into a widget or chat surface with telemetry hooks.",
        expected_output: "skill scaffold and surface plan",
      },
    ],
    evidence: input.sourceUrls.slice(0, 3).map((url) => ({
      url,
      snippet: `Public evidence captured from ${new URL(url).hostname}.`,
    })),
    surface_suggestion: surfaceSuggestion,
    mcp_tools_needed: ["discover_sources", "extract_workflow", "compile_skill", "render_registry_dashboard"],
    confidence: sourceKind.includes("docs") || sourceKind.includes("github") ? 0.91 : 0.76,
  };
}

export function findSimilarSkills(input: FindSkillsInput) {
  const nearest_skills = computeSkillMatches(input);
  return {
    nearest_skills,
    recommended_decision: decideStrategy(nearest_skills),
  };
}

export function compileSkill(input: CompileSkillInput): RunPayload & {
  decision: CompilerDecision;
  skill: SkillRecord;
  generated_files: string[];
} {
  const decision = buildDecision(
    {
      category: input.workflowSpec.category,
      tags: input.workflowSpec.tags,
      workflowTitle: input.workflowSpec.title,
    },
    input.preferredStrategy,
  );

  const name = input.workflowSpec.title.replace(/\s+/g, " ").trim();
  const skillId = slugify(name);
  const forkTarget = decision.forked_from ? getSkill(decision.forked_from) : undefined;

  const skill: SkillRecord = {
    skill_id: skillId,
    name,
    description: input.workflowSpec.description,
    category: input.workflowSpec.category,
    tags: input.workflowSpec.tags,
    version: "0.1.0",
    status: "draft",
    forked_from: forkTarget?.skill_id ?? null,
    composed_from: decision.composed_from,
    source_urls: input.workflowSpec.source_urls,
    source_hashes: input.workflowSpec.source_urls.map((_, index) => `${skillId}-${index + 1}`),
    surface_type: input.workflowSpec.surface_suggestion,
    usage_count: 0,
    last_used_at: new Date().toISOString(),
    last_scanned_at: new Date().toISOString(),
    last_patched_at: null,
    eval_score: 0.0,
  };

  const generated_files = [
    "SKILL.md",
    "agents/openai.yaml",
    "evals/trigger.json",
    "evals/schema.json",
    "CHANGELOG.md",
  ];

  return {
    view: "run",
    title: `Compiled ${name}`,
    subtitle: `${decision.decision.toUpperCase()} route selected for ${input.workflowSpec.surface_suggestion} delivery.`,
    outcome: {
      verdict:
        decision.decision === "fork"
          ? `Fork ${decision.forked_from} into a Radar-specific branch.`
          : `${decision.decision[0].toUpperCase()}${decision.decision.slice(1)} a fresh skill record.`,
      rationale: [
        decision.reason,
        "The generated skill stays public-source-friendly and keeps TinyFish reserved for the hard pages.",
        `Surface preset: ${surfacePresets.find((surface) => surface.surface_type === input.workflowSpec.surface_suggestion)?.display_name ?? "Radar Surface"}.`,
      ],
      next_step: "Generate SKILL.md, wire evals, and expose the render tool in the demo surface.",
    },
    citations: input.workflowSpec.source_urls.slice(0, 3).map((url) => ({
      label: new URL(url).hostname,
      url,
    })),
    decision,
    generated_files,
    skill,
  };
}

export function patchSkill(input: PatchSkillInput): RunPayload {
  const skill = getSkill(input.skillId);
  const changedSources = (input.changedSources?.length ? input.changedSources : skill.source_urls).slice(0, 2);
  const patch: PatchJob = {
    patch_id: `patch-${slugify(skill.skill_id)}-${changedSources.length}`,
    skill_id: skill.skill_id,
    previous_version: skill.version,
    proposed_version: bumpPatch(skill.version),
    change_type: "patch",
    source_changed: true,
    changed_sources: changedSources,
    summary: input.reason,
    auto_promote: false,
    eval_required: true,
    approved: false,
  };

  return {
    view: "run",
    title: `Patch proposal for ${skill.name}`,
    subtitle: "Source drift detected. Radar is holding the patch behind an eval gate.",
    outcome: {
      verdict: `Open ${patch.change_type} job ${patch.patch_id}.`,
      rationale: [
        "The public source changed, but the patch still needs an eval pass before promotion.",
        "TinyFish can re-run only the affected interactive sources instead of the whole workflow.",
      ],
      next_step: "Run the patch evals, inspect the evidence diff, and approve promotion if the contract still holds.",
    },
    citations: changedSources.map((url) => ({
      label: new URL(url).hostname,
      url,
    })),
    patch,
  };
}

export function listSkills(input: ListSkillsInput = {}) {
  const skills = seedSkills.filter((skill) => {
    if (input.category && skill.category !== input.category) return false;
    if (input.tag && !skill.tags.includes(input.tag)) return false;
    if (input.status && skill.status !== input.status) return false;
    return true;
  });

  return { skills };
}

export function skillUsageStats() {
  return statsFromSkills(seedSkills);
}

export function renderRegistryDashboard(focusCategory?: string): DashboardPayload {
  const visibleSkills = focusCategory
    ? seedSkills.filter((skill) => skill.category === focusCategory)
    : seedSkills;
  const usage = statsFromSkills(visibleSkills);

  return {
    view: "dashboard",
    title: "Radar Registry",
    subtitle: productLine,
    stats: [
      {
        label: "Active skills",
        value: `${usage.active_skills}`,
        detail: "Live entries ready to route or fork.",
      },
      {
        label: "Total runs",
        value: `${usage.total_runs}`,
        detail: "Usage is a ranking prior, not vanity.",
      },
      {
        label: "Mean eval",
        value: usage.mean_eval_score.toFixed(2),
        detail: "Compiler quality gate across the seed bank.",
      },
      {
        label: "Patched this week",
        value: `${usage.patched_this_week}`,
        detail: "Signals that the catalog is alive, not static.",
      },
    ],
    pipeline,
    skills: visibleSkills,
    watchlist: [
      {
        title: "Cheap parse first",
        status: "healthy",
        detail: "Three seeded sources stay on fetch and skip the browser entirely.",
      },
      {
        title: "TinyFish escalation",
        status: "ready",
        detail: "Interactive demo surfaces are marked for live browser runs only when needed.",
      },
      {
        title: "Patch loop",
        status: "queued",
        detail: "One changelog-driven patch path is seeded and eval-gated.",
      },
    ],
    quick_actions: ["Render skill card", "Compile demo skill", "Propose patch"],
  };
}

export function renderSkillCard(skillId?: string): SkillPayload {
  const skill = getSkill(skillId);

  return {
    view: "skill",
    title: skill.name,
    subtitle: skill.description,
    skill,
    sources: skill.source_urls.map((url) => ({
      url,
      note: inferScan(url).note,
    })),
    evals: seedEvals.filter((result) => result.skill_id === skill.skill_id),
    quick_actions: ["Fork skill", "Open evidence", "Patch on drift"],
  };
}

export function renderRunResult(query: string, skillId?: string): RunPayload {
  const skill = getSkill(skillId);

  return {
    view: "run",
    title: "Simulated run result",
    subtitle: `Query: ${query}`,
    outcome: {
      verdict: `Route this request through ${skill.name}.`,
      rationale: [
        `${skill.name} already covers the strongest capability cluster for this prompt.`,
        "The run cites public evidence, keeps the output compact, and preserves a clean path to a widget surface.",
      ],
      next_step: "Use compile_skill if the current surface needs a dedicated fork.",
    },
    citations: skill.source_urls.slice(0, 2).map((url) => ({
      label: new URL(url).hostname,
      url,
    })),
  };
}

export function renderPreviewPayload(kind: "dashboard" | "skill" | "run", options?: Record<string, string | undefined>): RadarPayload {
  if (kind === "skill") {
    return renderSkillCard(options?.skillId);
  }
  if (kind === "run") {
    return renderRunResult(options?.query ?? "Compile a docs workflow into a widget-ready skill.", options?.skillId);
  }
  return renderRegistryDashboard(options?.category);
}
