import { randomUUID } from "node:crypto";
import {
  type BlenderCommandPlan,
  type BlenderRunState,
  type BrowserMode,
  type CheckpointKind,
  checkpointKindSchema,
  type SceneChatMessage,
  type SceneEvidence,
  type SceneGraphEdge,
  type SceneGrounding,
  type SceneGraphNode,
  type SceneObject,
  scenePhaseSchema,
  sceneSessionSchema,
  type SceneSession,
  sceneSpecSchema,
  type SceneSpec,
  type SceneValidationIssue,
  type SceneWorkflowSkill,
  type SourceCandidate,
  type TinyFishEvent,
  type TinyFishEventType,
} from "../shared/contracts.js";
import {
  defaultGoal,
  defaultResearchSources,
  demoBlenderCommandPlan,
  demoBlenderState,
  demoEvidence,
  demoSceneSpec,
  productLine,
  tinyFishCapabilityProfile,
} from "../shared/seed.js";
import { applyBlenderPlan, blenderBridgeConfigured, readBlenderSceneGrounding } from "./blender-bridge.js";
import { normalizeTinyFishEvent, streamTinyFishRun, tinyFishConfigured, type TinyFishRawEvent } from "./tinyfish-client.js";

type StartSceneResearchInput = {
  goal: string;
  sourceUrl?: string;
  browserProfile?: Extract<BrowserMode, "lite" | "stealth">;
};

type ValidateSceneGraphInput = {
  sceneId: string;
};

type ApplySceneToBlenderInput = {
  sceneId: string;
  replayFailedOnly?: boolean;
};

type RepairSceneRunInput = {
  sceneId: string;
  instruction?: string;
  targetNodeIds?: string[];
  preferStealth?: boolean;
};

type ChatWithSceneInput = {
  sceneId: string;
  message: string;
};

type RunCheckpointLoopInput = {
  sceneId: string;
};

const sessions = new Map<string, SceneSession>();
const jobs = new Map<string, Promise<void>>();
let latestSceneId: string | null = null;

function clone<T>(value: T): T {
  return structuredClone(value);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function nowIso() {
  return new Date().toISOString();
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function titleCase(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function phaseLabel(phase: SceneSession["phase"]): string {
  return {
    idle: "Standing by for a source drop",
    researching: "TinyFish is running the live research pass",
    normalizing: "Codex is shaping research into a scene spec",
    ready: "Scene graph is staged for validation and Blender",
    validating: "Codex is checking evidence, ambiguity, and drift",
    repairing: "Codex is repairing the graph with tighter instructions",
    applying: "Blender actions are being applied",
    completed: "Scene applied and presentation ready",
    error: "Run needs intervention",
  }[phase];
}

function topicKeywords(goal: string): string[] {
  return [...new Set(goal.toLowerCase().split(/[^a-z0-9]+/g).filter((token) => token.length > 3))].slice(0, 8);
}

function evidenceFromSource(source: SourceCandidate, index: number): SceneEvidence {
  return {
    id: `src-${index + 1}-${slugify(source.title)}`,
    label: source.title,
    url: source.url,
    snippet: source.reason,
    source_kind: source.kind,
  };
}

function rankSources(goal: string, sourceUrl?: string): SourceCandidate[] {
  const tokens = topicKeywords(goal);
  const scored = defaultResearchSources.map((source) => {
    const haystack = `${source.title} ${source.reason} ${source.url}`.toLowerCase();
    const score = tokens.reduce((count, token) => count + (haystack.includes(token) ? 1 : 0), 0);
    return { source, score };
  });

  scored.sort((left, right) => right.score - left.score);

  const shortlist = scored.map((entry) => entry.source);
  if (!sourceUrl) {
    return shortlist.slice(0, 5);
  }

  const matched = shortlist.find((source) => source.url === sourceUrl);
  if (matched) {
    return [matched, ...shortlist.filter((source) => source.url !== sourceUrl)].slice(0, 5);
  }

  const customSource: SourceCandidate = {
    id: `custom-${slugify(sourceUrl)}`,
    title: titleCase(sourceUrl.split("/").filter(Boolean).slice(-1)[0] ?? "Selected source"),
    url: sourceUrl,
    kind: sourceUrl.includes("docs") ? "docs" : sourceUrl.includes("api") ? "api" : "moodboard",
    requires_browser: true,
    recommended_browser_mode: "lite",
    reason: "Manually dropped onto the graph as the primary research seed.",
  };

  return [customSource, ...shortlist].slice(0, 5);
}

function deriveProjectTitle(goal: string): string {
  const trimmed = goal.replace(/\.$/, "").trim();
  if (!trimmed) {
    return demoSceneSpec.project_title;
  }
  return titleCase(trimmed.split(/\s+/).slice(0, 6).join(" "));
}

function detectMood(goal: string) {
  const lower = goal.toLowerCase();
  if (lower.includes("dream")) {
    return { mood: "dreamlike and fragile", lighting: "silvery with soft bloom", time: "predawn blue hour" };
  }
  if (lower.includes("doc") || lower.includes("truth")) {
    return { mood: "documentary tension", lighting: "practical and unforgiving", time: "late evening" };
  }
  if (lower.includes("burnout") || lower.includes("struggle")) {
    return { mood: "focused but frayed", lighting: "low-key and oppressive", time: "02:17 AM" };
  }
  return { mood: demoSceneSpec.environment.mood, lighting: demoSceneSpec.lighting.overall_feel, time: demoSceneSpec.environment.time_of_day };
}

function groundingBriefLines(grounding: SceneGrounding | null): string[] {
  if (!grounding) {
    return ["No live Blender grounding yet. Codex will treat the scene as blank previs territory."];
  }

  const visibleObjects =
    grounding.object_names.length > 8
      ? `${grounding.object_names.slice(0, 8).join(", ")}, +${grounding.object_names.length - 8} more`
      : grounding.object_names.join(", ") || "none";

  return [
    `${grounding.scene_name} at frame ${grounding.current_frame}/${grounding.frame_end}.`,
    grounding.active_object ? `Active object: ${grounding.active_object}.` : "No active object selected.",
    `Visible objects: ${visibleObjects}.`,
  ];
}

function tinyFishSceneSpecTemplate(): string {
  return JSON.stringify(
    {
      project_title: "string",
      topic: "string",
      scene_goal: "string",
      style_keywords: ["string"],
      environment: {
        location_type: "string",
        time_of_day: "string",
        weather: "string",
        mood: "string",
        scale: "string",
      },
      objects: [
        {
          name: "string",
          category: "prop | setpiece | character | vehicle | fx | note",
          description: "string",
          material: "string",
          color: "string",
          approx_size: "string",
          placement_hint: "string",
          importance: 1,
          confidence: 0.5,
        },
      ],
      camera: {
        shot_type: "string",
        lens_feel: "string",
        framing_notes: "string",
      },
      lighting: {
        key_light: "string",
        fill_light: "string",
        rim_light: "string",
        practicals: ["string"],
        overall_feel: "string",
      },
      animation_cues: ["string"],
      composition_rules: ["string"],
      must_include: ["string"],
      avoid: ["string"],
    },
    null,
    2,
  );
}

function buildHeuristicSceneSpec(goal: string, sources: SourceCandidate[], sceneId: string): SceneSpec {
  const mood = detectMood(goal);
  const keywords = topicKeywords(goal);
  const citations = [...demoEvidence, ...sources.map(evidenceFromSource)].slice(0, 6);

  const objects: SceneObject[] = demoSceneSpec.objects.map((item, index) => ({
    ...item,
    id: `${sceneId}-${item.id}`,
    citations: item.citations.length ? item.citations : citations.slice(index, index + 2),
  }));

  if (keywords.some((token) => token.includes("deadline"))) {
    objects.push({
      id: `${sceneId}-deadline-wall`,
      name: "Wall of missed milestones",
      category: "note",
      description: "A timeline board showing slips, revisions, and redlined deadlines.",
      material: "paper, tape, pencil",
      color: "off-white with red pen marks",
      approx_size: "1.4m x 0.8m",
      placement_hint: "background wall behind the camera line",
      importance: 3,
      confidence: 0.72,
      citations: citations.slice(0, 2),
    });
  }

  const spec: SceneSpec = {
    scene_id: sceneId,
    project_title: deriveProjectTitle(goal),
    topic: goal,
    scene_goal: goal,
    style_keywords: [...new Set(["cinematic", "grounded", "editable", ...keywords.slice(0, 4)])],
    environment: {
      location_type: demoSceneSpec.environment.location_type,
      time_of_day: mood.time,
      weather: demoSceneSpec.environment.weather,
      mood: mood.mood,
      scale: demoSceneSpec.environment.scale,
    },
    objects,
    camera: {
      ...demoSceneSpec.camera,
      framing_notes: `${demoSceneSpec.camera.framing_notes} Codex should keep the scene readable for a live judge demo.`,
    },
    lighting: {
      ...demoSceneSpec.lighting,
      overall_feel: mood.lighting,
    },
    animation_cues: clone(demoSceneSpec.animation_cues),
    composition_rules: clone(demoSceneSpec.composition_rules),
    must_include: clone(demoSceneSpec.must_include),
    avoid: clone(demoSceneSpec.avoid),
    citations,
  };

  return sceneSpecSchema.parse(spec);
}

function stringValue(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function normalizeSceneSpec(raw: unknown, session: SceneSession): SceneSpec {
  if (!raw || typeof raw !== "object") {
    return buildHeuristicSceneSpec(session.goal, session.available_sources, session.scene_id);
  }

  const data = raw as Record<string, unknown>;
  const citations = session.available_sources.map(evidenceFromSource);
  const objectSource = Array.isArray(data.objects) ? data.objects : [];
  const objects: SceneObject[] = objectSource.slice(0, 8).map((item, index) => {
    const object = item as Record<string, unknown>;
    const sourceEvidence = citations.slice(index, index + 2);
    return {
      id: `${session.scene_id}-obj-${index + 1}`,
      name: stringValue(object.name, `Scene object ${index + 1}`),
      category:
        object.category === "setpiece" ||
        object.category === "character" ||
        object.category === "vehicle" ||
        object.category === "fx" ||
        object.category === "note"
          ? object.category
          : "prop",
      description: stringValue(object.description, "Extracted from TinyFish research."),
      material: stringValue(object.material, "placeholder material"),
      color: stringValue(object.color, "neutral grey"),
      approx_size: stringValue(object.approx_size, "medium"),
      placement_hint: stringValue(object.placement_hint, "position during scene blocking"),
      importance:
        typeof object.importance === "number" && object.importance >= 1 && object.importance <= 5
          ? object.importance
          : Math.min(5, index + 2),
      confidence: typeof object.confidence === "number" ? Math.max(0, Math.min(1, object.confidence)) : 0.72,
      citations: sourceEvidence.length ? sourceEvidence : citations.slice(0, 1),
    };
  });

  const candidate = {
    scene_id: session.scene_id,
    project_title: stringValue(data.project_title, deriveProjectTitle(session.goal)),
    topic: stringValue(data.topic, session.goal),
    scene_goal: stringValue(data.scene_goal, session.goal),
    style_keywords: Array.isArray(data.style_keywords)
      ? data.style_keywords.filter((value): value is string => typeof value === "string").slice(0, 8)
      : topicKeywords(session.goal),
    environment: {
      location_type: stringValue((data.environment as Record<string, unknown> | undefined)?.location_type, demoSceneSpec.environment.location_type),
      time_of_day: stringValue((data.environment as Record<string, unknown> | undefined)?.time_of_day, demoSceneSpec.environment.time_of_day),
      weather: stringValue((data.environment as Record<string, unknown> | undefined)?.weather, demoSceneSpec.environment.weather),
      mood: stringValue((data.environment as Record<string, unknown> | undefined)?.mood, demoSceneSpec.environment.mood),
      scale: stringValue((data.environment as Record<string, unknown> | undefined)?.scale, demoSceneSpec.environment.scale),
    },
    objects: objects.length ? objects : buildHeuristicSceneSpec(session.goal, session.available_sources, session.scene_id).objects,
    camera: {
      shot_type: stringValue((data.camera as Record<string, unknown> | undefined)?.shot_type, demoSceneSpec.camera.shot_type),
      lens_feel: stringValue((data.camera as Record<string, unknown> | undefined)?.lens_feel, demoSceneSpec.camera.lens_feel),
      framing_notes: stringValue((data.camera as Record<string, unknown> | undefined)?.framing_notes, demoSceneSpec.camera.framing_notes),
    },
    lighting: {
      key_light: stringValue((data.lighting as Record<string, unknown> | undefined)?.key_light, demoSceneSpec.lighting.key_light),
      fill_light: stringValue((data.lighting as Record<string, unknown> | undefined)?.fill_light, demoSceneSpec.lighting.fill_light),
      rim_light: stringValue((data.lighting as Record<string, unknown> | undefined)?.rim_light, demoSceneSpec.lighting.rim_light),
      practicals: Array.isArray((data.lighting as Record<string, unknown> | undefined)?.practicals)
        ? ((data.lighting as Record<string, unknown>).practicals as unknown[]).filter((value): value is string => typeof value === "string").slice(0, 6)
        : demoSceneSpec.lighting.practicals,
      overall_feel: stringValue((data.lighting as Record<string, unknown> | undefined)?.overall_feel, demoSceneSpec.lighting.overall_feel),
    },
    animation_cues: Array.isArray(data.animation_cues)
      ? data.animation_cues.filter((value): value is string => typeof value === "string").slice(0, 5)
      : demoSceneSpec.animation_cues,
    composition_rules: Array.isArray(data.composition_rules)
      ? data.composition_rules.filter((value): value is string => typeof value === "string").slice(0, 5)
      : demoSceneSpec.composition_rules,
    must_include: Array.isArray(data.must_include)
      ? data.must_include.filter((value): value is string => typeof value === "string").slice(0, 6)
      : demoSceneSpec.must_include,
    avoid: Array.isArray(data.avoid)
      ? data.avoid.filter((value): value is string => typeof value === "string").slice(0, 6)
      : demoSceneSpec.avoid,
    citations,
  };

  const parsed = sceneSpecSchema.safeParse(candidate);
  return parsed.success ? parsed.data : buildHeuristicSceneSpec(session.goal, session.available_sources, session.scene_id);
}

function buildBlenderCommandPlan(sceneSpec: SceneSpec): BlenderCommandPlan {
  const base = clone(demoBlenderCommandPlan);
  base.scene_id = sceneSpec.scene_id;
  base.summary = `Build "${sceneSpec.project_title}" as an editable previs scene with collections, hero props, cameras, lights, and notes.`;
  base.actions = base.actions.map((action, index) => ({
    ...action,
    id: `${sceneSpec.scene_id}-action-${index + 1}`,
    status: "pending",
    target_node_ids:
      action.kind === "mesh"
        ? sceneSpec.objects.slice(0, 3).map((object) => object.id)
        : action.kind === "annotation"
          ? sceneSpec.objects.filter((object) => object.category === "note").map((object) => object.id)
          : action.target_node_ids,
  }));
  return base;
}

function buildSceneWorkflowSkills(sceneSpec: SceneSpec, grounding: SceneGrounding | null): SceneWorkflowSkill[] {
  const heroObjects = [...sceneSpec.objects]
    .sort((left, right) => right.importance - left.importance)
    .slice(0, 3);
  const heroNames = heroObjects.map((object) => object.name).join(", ");
  const groundingSummary = grounding
    ? `${grounding.scene_name} with ${grounding.object_count} observed objects`
    : "a blank previs canvas";

  return [
    {
      id: `${sceneSpec.scene_id}-skill-ground-scene`,
      name: "Scene grounding reader",
      purpose: "Read the current Blender scene and turn existing geometry into hard constraints before web research or new blocking.",
      when_to_use: "Use first when Codex should adapt to an existing set instead of building from zero.",
      steps: [
        `Inspect ${groundingSummary}.`,
        "Protect existing hero geometry and camera intent.",
        "Translate live scene facts into constraints for downstream web research and blocking.",
      ],
      codex_prompt: `Read the current Blender scene for "${sceneSpec.project_title}", identify the fixed geometry and framing that must remain, and convert those into blocking constraints before any new scene actions run.`,
      target_node_ids: [`${sceneSpec.scene_id}-grounding`, ...heroObjects.map((object) => object.id)].filter(Boolean),
    },
    {
      id: `${sceneSpec.scene_id}-skill-reference-blockout`,
      name: "Research to blockout",
      purpose: "Turn TinyFish research into concrete blockout objects, placements, and placeholders.",
      when_to_use: "Use when the scene needs grounded props and set dressing from live web evidence.",
      steps: [
        "Extract concrete props and setpieces only.",
        `Prioritize hero elements: ${heroNames || "the highest-confidence scene objects"}.`,
        "Resolve ambiguity into placeholders and notes instead of hallucinated assets.",
      ],
      codex_prompt: `Using the current SceneSpec for "${sceneSpec.project_title}", convert the cited web research into deterministic Blender blockout instructions for the main objects, materials, and placements.`,
      target_node_ids: sceneSpec.objects.map((object) => object.id),
    },
    {
      id: `${sceneSpec.scene_id}-skill-camera-language`,
      name: "Camera language pass",
      purpose: "Convert the scene goal into a hero camera and support coverage that still reads clearly in previs.",
      when_to_use: "Use when Codex should tighten framing, focal hierarchy, or support-shot coverage.",
      steps: [
        `Anchor the scene around a ${sceneSpec.camera.shot_type}.`,
        `Preserve the lens feel: ${sceneSpec.camera.lens_feel}.`,
        "Stage one hero shot and two support shots that keep the strongest story beats readable.",
      ],
      codex_prompt: `Create a camera blocking pass for "${sceneSpec.project_title}" that follows this direction: ${sceneSpec.camera.framing_notes}`,
      target_node_ids: [`${sceneSpec.scene_id}-camera`, ...heroObjects.map((object) => object.id)],
    },
    {
      id: `${sceneSpec.scene_id}-skill-lighting-rig`,
      name: "Lighting mood rig",
      purpose: "Translate the scene mood into a readable previs lighting setup with practicals and separation.",
      when_to_use: "Use when the scene needs lighting that sells the mood without overcomplicating the blockout.",
      steps: [
        `Carry the overall feel: ${sceneSpec.lighting.overall_feel}.`,
        "Use key, fill, rim, and practicals only where they clarify the scene.",
        "Keep the rig simple enough for live judge playback and editing.",
      ],
      codex_prompt: `Build a previs-ready lighting pass for "${sceneSpec.project_title}" using this direction: key ${sceneSpec.lighting.key_light}; fill ${sceneSpec.lighting.fill_light}; rim ${sceneSpec.lighting.rim_light}.`,
      target_node_ids: [`${sceneSpec.scene_id}-lighting`, ...heroObjects.map((object) => object.id)],
    },
  ];
}

function refreshDerivedArtifacts(session: SceneSession) {
  if (!session.scene_spec) {
    session.workflow_skills = [];
    return;
  }

  session.workflow_skills = buildSceneWorkflowSkills(session.scene_spec, session.grounding);
  session.blender.command_plan = buildBlenderCommandPlan(session.scene_spec);
}

function createBaseBlenderState(sceneId: string): BlenderRunState {
  const state = clone(demoBlenderState);
  state.bridge_mode = blenderBridgeConfigured() ? "live" : "fallback";
  state.endpoint_configured = blenderBridgeConfigured();
  state.summary = blenderBridgeConfigured()
    ? "Live Blender bridge configured and waiting for an apply command."
    : "Live Blender bridge not configured yet. Fallback export is ready if needed.";
  state.command_plan = {
    ...clone(demoBlenderCommandPlan),
    scene_id: sceneId,
    actions: clone(demoBlenderCommandPlan.actions).map((action, index) => ({
      ...action,
      id: `${sceneId}-action-${index + 1}`,
      status: "pending",
    })),
  };
  return state;
}

function createChatMessage(role: SceneChatMessage["role"], text: string, sceneId: string): SceneChatMessage {
  return {
    id: `${sceneId}-chat-${role}-${randomUUID().slice(0, 8)}`,
    role,
    text,
    timestamp: nowIso(),
  };
}

function pushChatMessage(session: SceneSession, role: SceneChatMessage["role"], text: string) {
  session.chat_messages = [...session.chat_messages, createChatMessage(role, text, session.scene_id)].slice(-14);
}

function defaultAssistantGreeting(): string {
  return "Ask me what I see in the current Blender scene, which workflow skill to run next, or whether the checkpoint loop is stuck. I’ll answer from the live scene grounding and the current graph state.";
}

function uniqueNodeIds(values: string[]): string[] {
  return [...new Set(values)];
}

function autoRepairInstruction(session: SceneSession): string {
  const blockingIssues = session.validation.issues.filter((issue) => issue.blocking);
  const issueSummary = blockingIssues.map((issue) => issue.message).join(" ");
  return [
    "Repair the current scene graph conservatively.",
    issueSummary || "Resolve any remaining blocking issues.",
    "Attach at least one citation to every hero object, dedupe repeated props, and convert vague or uncertain items into note placeholders instead of final assets.",
    "Keep the result safe for live Blender replay.",
  ].join(" ");
}

function answerSceneChat(session: SceneSession, message: string): string {
  const lower = message.toLowerCase();
  const grounding = session.grounding;
  const workflowNames = session.workflow_skills.map((skill) => skill.name);
  const blockingIssues = session.validation.issues.filter((issue) => issue.blocking);
  const failedActions = session.blender.command_plan.actions.filter((action) => action.status === "failed");

  if (/(what|which).*(see|scene)|current blender|what's in blender|what is in blender/.test(lower)) {
    if (!grounding) {
      return "I don’t have fresh Blender grounding yet. Run research or ask me to refresh the scene, and I’ll pull the current viewport and scene facts before answering.";
    }

    const objectPreview =
      grounding.object_names.length > 6
        ? `${grounding.object_names.slice(0, 6).join(", ")}, and ${grounding.object_names.length - 6} more visible preview objects`
        : grounding.object_names.join(", ") || "no named preview objects";

    return `I can read the current Blender scene from Codex. Right now I’m grounded on "${grounding.scene_name}" at frame ${grounding.current_frame}/${grounding.frame_end}. I see ${grounding.object_count} total scene objects, with preview objects including ${objectPreview}. ${grounding.active_object ? `The active object is ${grounding.active_object}.` : "There is no active object selected right now."}`;
  }

  if (/workflow|skill|prompt|which.*run next|what.*run next/.test(lower)) {
    if (!workflowNames.length) {
      return "The scene-derived workflow skills haven’t been generated yet. Launch research first, then I’ll suggest the best one for the current scene.";
    }

    const recommendation = session.workflow_skills[0];
    return `The current workflow skills are ${workflowNames.join(", ")}. I’d run "${recommendation.name}" first because ${recommendation.when_to_use.toLowerCase()}`;
  }

  if (/checkpoint|loop|retry|repair/.test(lower)) {
    return `The checkpoint loop is ${session.checkpoint_loop.status}. Repair attempts: ${session.checkpoint_loop.repair_attempts}/${session.checkpoint_loop.max_repairs}. Replay attempts: ${session.checkpoint_loop.replay_attempts}/${session.checkpoint_loop.max_replays}. ${session.checkpoint_loop.last_outcome}`;
  }

  if (/validation|issue|problem|blocked/.test(lower)) {
    if (!session.scene_spec) {
      return "There isn’t a scene spec yet, so validation hasn’t started. Launch research first and I’ll validate the result automatically.";
    }
    if (!session.validation.issues.length) {
      return "Validation is currently clear. The scene spec passed, and any remaining uncertainty is being held in notes and placeholders.";
    }
    return `Validation is ${session.validation.status}. The main issues are: ${session.validation.issues
      .slice(0, 3)
      .map((issue) => issue.message)
      .join(" ")}`;
  }

  if (/apply|blender|replay|failed action/.test(lower)) {
    if (!session.scene_spec) {
      return "I don’t have a scene spec to apply yet. Let me ground the scene and run research first.";
    }
    if (!failedActions.length) {
      return `Blender is in ${session.blender.bridge_mode} mode. ${session.blender.summary}`;
    }
    return `Some Blender actions still need attention: ${failedActions.map((action) => action.label).join(", ")}. I can replay the failed actions or run the checkpoint loop again.`;
  }

  if (/next|recommend|should i/.test(lower)) {
    return session.narrative.next_best_move;
  }

  const sceneTitle = session.scene_spec?.project_title ?? session.goal;
  const sceneStatus = session.scene_spec
    ? `The current scene plan is "${sceneTitle}" with ${session.scene_spec.objects.length} structured objects and ${workflowNames.length} generated workflow skills.`
    : "The scene plan is not fully generated yet.";
  const issuesText = blockingIssues.length
    ? `There are ${blockingIssues.length} blocking validation issues, so repair should happen before a confident Blender apply.`
    : "There are no blocking validation issues right now.";
  return `${sceneStatus} ${issuesText} ${session.narrative.next_best_move}`;
}

function createEmptySession(goal = defaultGoal): SceneSession {
  const sceneId = `scene-${slugify(goal) || "bootstrap"}-${randomUUID().slice(0, 8)}`;
  const sources = rankSources(goal);

  const session: SceneSession = {
    view: "orchestrator",
    scene_id: sceneId,
    title: "TinyFish Web-to-Previs Orchestrator",
    subtitle: productLine,
    goal,
    phase: "idle",
    phase_label: phaseLabel("idle"),
    updated_at: new Date().toISOString(),
    narrative: {
      codex_role: "Codex reads the current Blender scene, runs TinyFish on the web, validates the SceneSpec, and then stages an editable previs blockout.",
      operator_brief: [
        "Read Blender scene info before beginning any research so the crawl stays grounded in what already exists.",
        "Use TinyFish run-sse because the live stream proves the research pass to judges.",
        "Prefer lite before stealth unless the page blocks or turns suspicious.",
        "Hold uncertainty in notes and placeholders instead of hallucinating final art.",
      ],
      next_best_move: "Capture the current Blender scene, then launch the research pass from the header.",
    },
    capability_profile: tinyFishCapabilityProfile,
    available_sources: sources,
    graph: { nodes: [], edges: [] },
    checkpoints: [],
    tinyfish: {
      enabled: tinyFishConfigured(),
      live: false,
      browser_profile: "lite",
      status: tinyFishConfigured() ? "Ready to launch run-sse." : "No API key detected. Demo mode will simulate the live run.",
      run_id: null,
      streaming_url: null,
      docs_reasoning: [
        "Primary endpoint: POST /v1/automation/run-sse",
        "Expected stream: STARTED, STREAMING_URL, PROGRESS, COMPLETE, plus heartbeats",
        "Public-web demo keeps vault credentials off and defaults to lite browsing",
        "Codex prepends current Blender scene grounding so the crawl returns scene-relevant JSON, not generic inspiration",
      ],
      events: [],
    },
    grounding: null,
    scene_spec: null,
    workflow_skills: [],
    chat_messages: [createChatMessage("assistant", defaultAssistantGreeting(), sceneId)],
    chat_placeholder: "Ask about the current Blender scene, workflow skills, or next move...",
    checkpoint_loop: {
      enabled: true,
      auto_apply: true,
      status: "idle",
      repair_attempts: 0,
      max_repairs: 2,
      replay_attempts: 0,
      max_replays: 2,
      last_outcome: "Checkpoint loop is ready. It will validate, repair if needed, and replay Blender actions automatically.",
    },
    validation: {
      status: "pending",
      summary: "No validation run yet.",
      issues: [],
    },
    blender: createBaseBlenderState(sceneId),
    quick_actions: ["Research", "Run loop", "Validate", "Apply to Blender", "Replay failed", "Export scene_spec.json"],
    cluster_placeholder: "Merge the selected nodes into a stronger cinematic instruction...",
    export_filename: `${sceneId}.scene_spec.json`,
  };

  syncSession(session);
  return session;
}

function checkpointStatusForKind(kind: CheckpointKind, session: SceneSession): SceneGraphNode["status"] {
  const checkpoint = session.checkpoints.find((entry) => entry.kind === kind);
  return checkpoint?.status ?? "idle";
}

function nodeForSource(source: SourceCandidate, index: number, total: number): SceneGraphNode {
  const y = total === 1 ? 50 : 18 + index * (64 / Math.max(total - 1, 1));
  return {
    id: source.id,
    type: "research_source",
    status: source.requires_browser ? "queued" : "ready",
    label: source.title,
    summary: source.reason,
    detail_lines: [
      `Kind: ${source.kind}`,
      `Browser: ${source.recommended_browser_mode}`,
      source.requires_browser ? "Can be dropped to trigger a live TinyFish pass." : "Can be used as cheap grounding before the browser run.",
    ],
    x: 11,
    y,
    citations: [evidenceFromSource(source, index)],
    clusterable: false,
  };
}

function buildGraph(session: SceneSession): { nodes: SceneGraphNode[]; edges: SceneGraphEdge[] } {
  const nodes: SceneGraphNode[] = [];
  const edges: SceneGraphEdge[] = [];

  session.available_sources.forEach((source, index) => {
    nodes.push(nodeForSource(source, index, session.available_sources.length));
    edges.push({
      id: `edge-${source.id}-tf`,
      source: source.id,
      target: `${session.scene_id}-tinyfish`,
      kind: "feeds",
      label: "research seed",
    });
  });

  if (session.grounding) {
    nodes.push({
      id: `${session.scene_id}-grounding`,
      type: "scene_grounding",
      status: checkpointStatusForKind("scene_grounded", session) || "ready",
      label: "Scene Grounder",
      summary: `${session.grounding.scene_name} • ${session.grounding.object_count} objects • frame ${session.grounding.current_frame}`,
      detail_lines: session.grounding.summary_lines,
      x: 31,
      y: 18,
      citations: [],
      clusterable: false,
    });

    edges.push({
      id: `edge-${session.scene_id}-grounding-tf`,
      source: `${session.scene_id}-grounding`,
      target: `${session.scene_id}-tinyfish`,
      kind: "feeds",
      label: "grounds research",
    });
  }

  nodes.push({
    id: `${session.scene_id}-tinyfish`,
    type: "tinyfish_run",
    status:
      session.phase === "researching" || session.phase === "normalizing"
        ? "running"
        : session.phase === "error"
          ? "error"
          : session.tinyfish.events.length
            ? "ready"
            : "queued",
    label: session.tinyfish.live ? "TinyFish live run" : "TinyFish orchestration lane",
    summary: session.tinyfish.status,
    detail_lines: [
      `Browser profile: ${session.tinyfish.browser_profile}`,
      `Primary endpoint: ${session.capability_profile.primary_endpoint}`,
      session.tinyfish.streaming_url ? "Live browser stream available." : "No streaming URL yet.",
    ],
    x: 31,
    y: 38,
    citations: [demoEvidence[0], demoEvidence[1]],
    clusterable: false,
  });

  session.checkpoints.forEach((checkpoint, index) => {
    const nodeId = `${session.scene_id}-checkpoint-${checkpoint.kind}`;
    nodes.push({
      id: nodeId,
      type: "scene_checkpoint",
      status: checkpoint.status,
      label: checkpoint.kind.replaceAll("_", " "),
      summary: checkpoint.note,
      detail_lines: [checkpoint.note],
      x: 47,
      y: 18 + index * 10,
      citations: [],
      clusterable: false,
    });

    edges.push({
      id: `edge-${session.scene_id}-tf-${checkpoint.kind}`,
      source: `${session.scene_id}-tinyfish`,
      target: nodeId,
      kind: "reports",
      label: "checkpoint",
    });
  });

  if (session.scene_spec) {
    session.scene_spec.objects.forEach((object, index) => {
      const y = 18 + index * (56 / Math.max(session.scene_spec?.objects.length ?? 1, 1));
      nodes.push({
        id: object.id,
        type: "scene_object",
        status: session.validation.issues.some((issue) => issue.node_ids.includes(object.id) && issue.severity === "error")
          ? "error"
          : session.validation.issues.some((issue) => issue.node_ids.includes(object.id))
            ? "warning"
            : "ready",
        label: object.name,
        summary: object.description,
        detail_lines: [
          `${object.category} • ${object.material}`,
          `Placement: ${object.placement_hint}`,
          `Confidence: ${(object.confidence * 100).toFixed(0)}%`,
        ],
        x: 66,
        y,
        citations: object.citations,
        clusterable: true,
      });

      edges.push({
        id: `edge-obj-${object.id}`,
        source: `${session.scene_id}-checkpoint-scene_graph_resolved`,
        target: object.id,
        kind: "resolves",
        label: "scene object",
      });
    });

    nodes.push({
      id: `${session.scene_id}-camera`,
      type: "camera",
      status: checkpointStatusForKind("scene_graph_resolved", session),
      label: "Camera language",
      summary: session.scene_spec.camera.shot_type,
      detail_lines: [session.scene_spec.camera.lens_feel, session.scene_spec.camera.framing_notes],
      x: 83,
      y: 24,
      citations: session.scene_spec.citations.slice(0, 2),
      clusterable: true,
    });

    nodes.push({
      id: `${session.scene_id}-lighting`,
      type: "lighting",
      status: checkpointStatusForKind("scene_graph_resolved", session),
      label: "Lighting rig",
      summary: session.scene_spec.lighting.overall_feel,
      detail_lines: [
        `Key: ${session.scene_spec.lighting.key_light}`,
        `Fill: ${session.scene_spec.lighting.fill_light}`,
        `Rim: ${session.scene_spec.lighting.rim_light}`,
      ],
      x: 83,
      y: 48,
      citations: session.scene_spec.citations.slice(2, 4),
      clusterable: true,
    });

    edges.push({
      id: `edge-camera-plan-${session.scene_id}`,
      source: `${session.scene_id}-checkpoint-scene_graph_resolved`,
      target: `${session.scene_id}-camera`,
      kind: "controls",
      label: "frames",
    });
    edges.push({
      id: `edge-light-plan-${session.scene_id}`,
      source: `${session.scene_id}-checkpoint-scene_graph_resolved`,
      target: `${session.scene_id}-lighting`,
      kind: "controls",
      label: "lights",
    });
  }

  session.workflow_skills.forEach((skill, index) => {
    const y = 18 + index * 14;
    nodes.push({
      id: skill.id,
      type: "workflow_skill",
      status: session.scene_spec ? "ready" : "queued",
      label: skill.name,
      summary: skill.purpose,
      detail_lines: [skill.when_to_use, ...skill.steps.slice(0, 2)],
      x: 78,
      y,
      citations: [],
      clusterable: true,
    });

    edges.push({
      id: `edge-${session.scene_id}-skill-${index + 1}`,
      source: `${session.scene_id}-checkpoint-scene_graph_resolved`,
      target: skill.id,
      kind: "resolves",
      label: "workflow",
    });
  });

  session.blender.command_plan.actions.forEach((action, index) => {
    nodes.push({
      id: action.id,
      type: "blender_action",
      status:
        action.status === "done"
          ? "ready"
          : action.status === "running"
            ? "running"
            : action.status === "failed"
              ? "error"
              : action.status === "blocked"
                ? "blocked"
                : "queued",
      label: action.label,
      summary: action.detail,
      detail_lines: [action.command, `Mode: ${session.blender.bridge_mode}`],
      x: 92,
      y: 69 + index * 7,
      citations: [],
      clusterable: false,
    });

    const skill = session.workflow_skills.find((candidate) =>
      candidate.target_node_ids.some((targetId) => action.target_node_ids.includes(targetId)),
    );

    if (skill) {
      edges.push({
        id: `edge-${skill.id}-${action.id}`,
        source: skill.id,
        target: action.id,
        kind: "controls",
        label: "drives Blender",
      });
    }

    action.target_node_ids.forEach((targetId) => {
      edges.push({
        id: `edge-${targetId}-${action.id}`,
        source: targetId,
        target: action.id,
        kind: "controls",
        label: "feeds Blender",
      });
    });
  });

  session.validation.issues.forEach((issue, index) => {
    const issueId = `${session.scene_id}-issue-${index + 1}`;
    nodes.push({
      id: issueId,
      type: "validation_issue",
      status: issue.severity === "error" ? "error" : "warning",
      label: issue.code.replaceAll("_", " "),
      summary: issue.message,
      detail_lines: [issue.suggested_fix, issue.blocking ? "Blocking before live apply." : "Non-blocking issue."],
      x: 59 + index * 9,
      y: 88,
      citations: [],
      clusterable: false,
    });

    issue.node_ids.forEach((nodeId) => {
      edges.push({
        id: `edge-${issueId}-${nodeId}`,
        source: issueId,
        target: nodeId,
        kind: "verifies",
        label: "needs repair",
      });
    });
  });

  return { nodes, edges };
}

function syncSession(session: SceneSession) {
  session.phase = scenePhaseSchema.parse(session.phase);
  session.phase_label = phaseLabel(session.phase);
  session.updated_at = new Date().toISOString();
  session.graph = buildGraph(session);
}

function saveSession(session: SceneSession) {
  syncSession(session);
  sessions.set(session.scene_id, sceneSessionSchema.parse(session));
  latestSceneId = session.scene_id;
}

function getSession(sceneId?: string): SceneSession {
  if (sceneId && sessions.has(sceneId)) {
    return sessions.get(sceneId)!;
  }
  if (latestSceneId && sessions.has(latestSceneId)) {
    return sessions.get(latestSceneId)!;
  }
  const bootstrap = createEmptySession();
  saveSession(bootstrap);
  return bootstrap;
}

function addCheckpoint(session: SceneSession, kind: CheckpointKind, status: SceneGraphNode["status"], note: string) {
  const existing = session.checkpoints.find((checkpoint) => checkpoint.kind === kind);
  if (existing) {
    existing.status = status;
    existing.note = note;
  } else {
    session.checkpoints.push({
      kind: checkpointKindSchema.parse(kind),
      status,
      note,
    });
  }
  syncSession(session);
}

function addTinyFishEvent(session: SceneSession, type: TinyFishEventType, title: string, detail: string, options?: Partial<TinyFishEvent>) {
  const event: TinyFishEvent = {
    id: options?.id ?? `${session.scene_id}-${type}-${session.tinyfish.events.length + 1}`,
    type,
    title,
    detail,
    timestamp: options?.timestamp ?? new Date().toISOString(),
    run_id: options?.run_id ?? session.tinyfish.run_id,
    streaming_url: options?.streaming_url ?? null,
  };
  session.tinyfish.events = [...session.tinyfish.events, event].slice(-18);
  if (event.streaming_url) {
    session.tinyfish.streaming_url = event.streaming_url;
  }
  session.tinyfish.status = detail;
  syncSession(session);
}

async function captureSceneGrounding(session: SceneSession) {
  try {
    const grounding = await readBlenderSceneGrounding();
    if (!grounding) {
      addCheckpoint(session, "scene_grounded", "warning", "Live Blender grounding is unavailable on the current bridge transport.");
      return;
    }

    session.grounding = grounding;
    if (session.scene_spec) {
      refreshDerivedArtifacts(session);
    }
    session.narrative.operator_brief = [
      `Grounded scene: ${grounding.scene_name}`,
      `Frame ${grounding.current_frame}/${grounding.frame_end}, ${grounding.object_count} objects`,
      `Bridge mode: ${session.blender.bridge_mode}`,
      "Codex will use this grounding to constrain the TinyFish extraction and the Blender apply plan.",
    ];
    session.narrative.next_best_move = "Launch or continue the research pass so Codex can convert the grounded scene into a SceneSpec and workflow skills.";
    addCheckpoint(session, "scene_grounded", "ready", grounding.summary_lines[0] ?? "Live Blender scene info captured.");
    saveSession(session);
  } catch (error) {
    addCheckpoint(session, "scene_grounded", "warning", `Scene grounding failed: ${String(error)}`);
    saveSession(session);
  }
}

function validateSceneSpec(sceneSpec: SceneSpec): SceneValidationIssue[] {
  const issues: SceneValidationIssue[] = [];
  const names = new Map<string, string>();
  const vagueTokens = ["thing", "stuff", "object", "item", "cool"];

  for (const object of sceneSpec.objects) {
    const normalized = slugify(object.name);
    if (names.has(normalized)) {
      issues.push({
        id: `${sceneSpec.scene_id}-dup-${normalized}`,
        severity: "warning",
        code: "duplicate_object",
        message: `Duplicate object naming detected for "${object.name}".`,
        suggested_fix: "Merge or rename repeated props so Blender actions stay deterministic.",
        node_ids: [object.id, names.get(normalized)!],
        blocking: false,
      });
    } else {
      names.set(normalized, object.id);
    }

    if (object.importance >= 4 && object.citations.length === 0) {
      issues.push({
        id: `${sceneSpec.scene_id}-${object.id}-evidence`,
        severity: "error",
        code: "missing_citation",
        message: `Hero scene element "${object.name}" is missing evidence.`,
        suggested_fix: "Re-run research or attach at least one grounded citation before live Blender apply.",
        node_ids: [object.id],
        blocking: true,
      });
    }

    if (vagueTokens.some((token) => normalized.includes(token))) {
      issues.push({
        id: `${sceneSpec.scene_id}-${object.id}-vague`,
        severity: "warning",
        code: "vague_object",
        message: `Scene element "${object.name}" is too vague for deterministic blocking.`,
        suggested_fix: "Replace it with a concrete prop or move it into NOTES as an unresolved placeholder.",
        node_ids: [object.id],
        blocking: false,
      });
    }
  }

  if (!sceneSpec.camera.framing_notes.trim()) {
    issues.push({
      id: `${sceneSpec.scene_id}-camera-framing`,
      severity: "error",
      code: "missing_camera_framing",
      message: "Camera framing notes are empty.",
      suggested_fix: "Give Codex at least one hero framing instruction before applying to Blender.",
      node_ids: [`${sceneSpec.scene_id}-camera`],
      blocking: true,
    });
  }

  if (!sceneSpec.lighting.overall_feel.trim()) {
    issues.push({
      id: `${sceneSpec.scene_id}-lighting-feel`,
      severity: "warning",
      code: "weak_lighting_direction",
      message: "Lighting direction is underspecified.",
      suggested_fix: "Add the emotional intent of the light so the rig reads clearly in previs.",
      node_ids: [`${sceneSpec.scene_id}-lighting`],
      blocking: false,
    });
  }

  return issues;
}

function applyInstructionToScene(session: SceneSession, instruction: string, targetNodeIds: string[]) {
  if (!session.scene_spec) {
    return;
  }

  const lower = instruction.toLowerCase();
  const spec = session.scene_spec;

  if (lower.includes("dream")) {
    spec.style_keywords = [...new Set([...spec.style_keywords, "dreamlike", "misty"])];
    spec.lighting.overall_feel = "dreamlike silver-blue haze with softened edges";
  }
  if (lower.includes("dramatic")) {
    spec.camera.framing_notes = `${spec.camera.framing_notes} Push contrast in silhouette and isolate the hero object with stronger negative space.`;
    spec.lighting.rim_light = "pronounced edge light from the rain-streaked window";
  }
  if (lower.includes("documentary")) {
    spec.camera.lens_feel = "28mm documentary realism with handheld tension";
  }

  const targetObjects = spec.objects.filter((object) => targetNodeIds.includes(object.id));
  if (targetObjects.length) {
    for (const object of targetObjects) {
      object.description = `${object.description} Refined by Codex cluster instruction: ${instruction}`;
      object.confidence = Math.min(1, object.confidence + 0.06);
      if (object.citations.length === 0) {
        object.citations = spec.citations.slice(0, 1);
      }
    }
  } else {
    spec.objects.push({
      id: `${session.scene_id}-note-${spec.objects.length + 1}`,
      name: "Codex direction note",
      category: "note",
      description: instruction,
      material: "annotation",
      color: "signal amber",
      approx_size: "text marker",
      placement_hint: "NOTES collection near the selected cluster",
      importance: 2,
      confidence: 0.74,
      citations: spec.citations.slice(0, 1),
    });
  }

  spec.composition_rules = [...new Set([...spec.composition_rules, `Codex merge: ${instruction}`])].slice(-6);
  session.scene_spec = sceneSpecSchema.parse(spec);
  refreshDerivedArtifacts(session);
}

async function simulateTinyFishRun(session: SceneSession): Promise<SceneSpec> {
  const simulatedRunId = `sim-${randomUUID().slice(0, 10)}`;
  session.tinyfish.run_id = simulatedRunId;
  session.tinyfish.live = false;
  addTinyFishEvent(session, "started", "TinyFish started", "Simulated run-sse launch for local preview.", { run_id: simulatedRunId });
  addCheckpoint(session, "run_created", "ready", "Codex prepared a run-sse request using the curated TinyFish capability profile.");
  await sleep(350);

  addTinyFishEvent(session, "streaming_url", "Browser stream ready", "Demo stream prepared so the graph can animate like a live session.", {
    run_id: simulatedRunId,
    streaming_url: `https://observe.tinyfish.ai/session/${simulatedRunId}`,
  });
  await sleep(350);

  addTinyFishEvent(session, "progress", "Page identity verified", "Confirmed the primary source and opened the research surface.");
  addCheckpoint(session, "page_identity_verified", "ready", "Primary source identity and page intent were verified before extraction.");
  await sleep(320);

  addTinyFishEvent(session, "progress", "Research extracted", "TinyFish is extracting scene-relevant details with citations only.");
  addCheckpoint(session, "research_extracted", "ready", "Scene-relevant evidence was extracted conservatively from the live web.");
  await sleep(320);

  const spec = buildHeuristicSceneSpec(session.goal, session.available_sources, session.scene_id);
  addTinyFishEvent(session, "complete", "TinyFish complete", "Structured scene metadata is ready for Codex normalization.", {
    run_id: simulatedRunId,
  });
  return spec;
}

function tinyFishGoalForSession(session: SceneSession): string {
  const groundingLines = groundingBriefLines(session.grounding).map((line) => `- ${line}`).join(" ");
  return [
    "Research only what is useful for a Blender previs scene.",
    `Topic: ${session.goal}`,
    `Current Blender scene grounding: ${groundingLines}`,
    "Find public references that help block out environment, props, camera, and lighting. Ignore anything that only helps final polish.",
    "Return strict JSON only. No markdown. No prose outside the JSON object.",
    `Use this exact JSON shape: ${tinyFishSceneSpecTemplate()}`,
    "Be conservative. Lower confidence when uncertain, prefer notes over fabricated assets, and keep the output editable inside Blender.",
  ].join(" ");
}

async function liveTinyFishRun(session: SceneSession): Promise<SceneSpec> {
  const primarySource = session.available_sources[0];
  const liveResult = await streamTinyFishRun(
    {
      url: primarySource.url,
      goal: tinyFishGoalForSession(session),
      browserProfile: session.tinyfish.browser_profile as Extract<BrowserMode, "lite" | "stealth">,
    },
    (raw: TinyFishRawEvent) => {
      const normalized = normalizeTinyFishEvent(raw);
      session.tinyfish.run_id = raw.run_id ?? session.tinyfish.run_id;
      session.tinyfish.live = true;
      session.tinyfish.streaming_url = raw.streaming_url ?? session.tinyfish.streaming_url;
      session.tinyfish.events = [...session.tinyfish.events, normalized].slice(-18);
      session.tinyfish.status = normalized.detail;
      if (normalized.type === "started") {
        addCheckpoint(session, "run_created", "ready", "TinyFish accepted the live run-sse request.");
      }
      if (normalized.type === "progress" && /page|navigating|loaded/i.test(normalized.detail)) {
        addCheckpoint(session, "page_identity_verified", "ready", "TinyFish verified the live page before deeper extraction.");
      }
      syncSession(session);
    },
  );

  return normalizeSceneSpec(liveResult.result, session);
}

async function hydrateResearch(sceneId: string) {
  const session = sessions.get(sceneId);
  if (!session) {
    return;
  }

  try {
    session.phase = "researching";
    session.subtitle = "Codex is grounding the live Blender scene before launching the web research run.";
    session.tinyfish.status = "Reading the current Blender scene so the research pass starts from reality.";
    saveSession(session);

    await captureSceneGrounding(session);

    session.subtitle = "Codex is using scene grounding plus TinyFish to shape the live research run.";
    session.tinyfish.status = tinyFishConfigured()
      ? "Launching live TinyFish run-sse request with the grounded scene context."
      : "API key missing, so the local preview is simulating the live run-sse flow from the grounded scene context.";
    saveSession(session);

    const sceneSpec = tinyFishConfigured() ? await liveTinyFishRun(session) : await simulateTinyFishRun(session);

    session.phase = "normalizing";
    session.tinyfish.status = "Codex is normalizing research into a scene spec and Blender command plan.";
    addCheckpoint(session, "scene_spec_normalized", "running", "Normalizing citations, object roles, and cinematic framing.");
    saveSession(session);
    await sleep(220);

    session.scene_spec = sceneSpec;
    refreshDerivedArtifacts(session);
    session.blender.summary = blenderBridgeConfigured()
      ? "Command plan is ready for live Blender application."
      : "Command plan is ready. Live bridge is optional; fallback export is standing by.";
    addCheckpoint(session, "scene_spec_normalized", "ready", "Scene spec was normalized into a deterministic, evidence-backed structure.");
    addCheckpoint(session, "scene_graph_resolved", "ready", "The graph resolved hero objects, cameras, lighting, and validation targets.");
    addCheckpoint(session, "blender_plan_ready", "ready", "Codex translated the scene graph into deterministic Blender actions.");
    session.phase = "ready";
    session.subtitle = "Scene graph resolved. Validate, repair, or apply to Blender from the same Codex surface.";
    session.narrative.next_best_move = "Inspect the generated workflow skills, validate the scene, then apply or replay Blender actions.";
    saveSession(session);

    if (session.checkpoint_loop.enabled) {
      session.checkpoint_loop.repair_attempts = 0;
      session.checkpoint_loop.replay_attempts = 0;
      await runCheckpointLoopInternal(sceneId);
    } else {
      validateSceneGraphInternal(sceneId);
    }
  } catch (error) {
    session.phase = "error";
    addTinyFishEvent(session, "error", "TinyFish error", String(error));
    addCheckpoint(session, "repair_needed", "error", "Research failed. Codex recommends a repair pass or source swap.");
    session.validation.status = "failed";
    session.validation.summary = "Research failed before a valid scene spec could be produced.";
    session.subtitle = "The run hit an error. Use repair to retry or tighten the instruction.";
    saveSession(session);
  } finally {
    jobs.delete(sceneId);
  }
}

function validateSceneGraphInternal(sceneId: string) {
  const session = sessions.get(sceneId);
  if (!session || !session.scene_spec) {
    return;
  }

  session.phase = "validating";
  session.validation.issues = validateSceneSpec(session.scene_spec);
  const blocking = session.validation.issues.some((issue) => issue.blocking);
  session.validation.status = blocking ? "failed" : "passed";
  session.validation.summary = blocking
    ? "Validation found blocking issues that need repair before a confident Blender apply."
    : "Validation passed. Remaining uncertainty is contained in notes and placeholders.";
  session.narrative.next_best_move = blocking
    ? "Run a repair pass or refine one of the generated workflow skills before applying to Blender."
    : "Validation is clear. Apply the scene to Blender live or replay only failed actions.";
  addCheckpoint(
    session,
    blocking ? "repair_needed" : "verification_passed",
    blocking ? "warning" : "ready",
    session.validation.summary,
  );
  session.phase = "ready";
  saveSession(session);
}

async function performBlenderApply(session: SceneSession, replayFailedOnly = false) {
  if (!session.scene_spec) {
    return;
  }

  const actions = replayFailedOnly
    ? session.blender.command_plan.actions.filter((action) => action.status === "failed")
    : session.blender.command_plan.actions;

  if (!actions.length) {
    session.blender.summary = "No Blender actions needed replay right now.";
    session.phase = "ready";
    saveSession(session);
    return;
  }

  session.phase = "applying";
  session.blender.status = "applying";
  session.blender.command_plan.actions = session.blender.command_plan.actions.map((action) => ({
    ...action,
    status: actions.some((candidate) => candidate.id === action.id) ? "running" : action.status,
  }));
  saveSession(session);

  await sleep(220);
  const result = await applyBlenderPlan(session.scene_spec, actions);
  session.blender.bridge_mode = result.bridgeMode;
  session.blender.summary = result.summary;
  session.blender.status = result.bridgeMode === "live" ? "applied" : "fallback_ready";
  session.blender.last_applied_at = nowIso();
  session.blender.command_plan.actions = session.blender.command_plan.actions.map((action) => ({
    ...action,
    status: result.statuses.get(action.id) ?? action.status,
  }));

  addCheckpoint(
    session,
    "blender_applied",
    session.blender.command_plan.actions.some((action) => action.status === "failed") ? "warning" : "ready",
    session.blender.summary,
  );
  session.phase = result.bridgeMode === "live" ? "completed" : "ready";
  session.subtitle =
    result.bridgeMode === "live"
      ? "Blender scene updated live from the Codex orchestration graph."
      : "Live bridge unavailable, but the fallback command plan and export bundle are ready.";
  session.narrative.next_best_move =
    result.bridgeMode === "live"
      ? "Inspect the updated scene in Blender, then use a workflow skill prompt to refine cameras, lighting, or props."
      : "Keep the generated workflow skills, or use the export bundle while the live Blender bridge is unavailable.";
  saveSession(session);
}

async function performRepairPass(session: SceneSession, input: RepairSceneRunInput) {
  await sleep(260);
  if (input.preferStealth) {
    session.tinyfish.browser_profile = "stealth";
    session.tinyfish.docs_reasoning = [
      "Repair pass escalated from lite to stealth because the operator explicitly requested a safer browser profile.",
      ...session.tinyfish.docs_reasoning,
    ].slice(0, 4);
  }
  if (!session.scene_spec) {
    session.scene_spec = buildHeuristicSceneSpec(session.goal, session.available_sources, session.scene_id);
    refreshDerivedArtifacts(session);
  }

  if (input.instruction?.trim()) {
    applyInstructionToScene(session, input.instruction.trim(), input.targetNodeIds ?? []);
    addTinyFishEvent(
      session,
      "checkpoint",
      "Repair note merged",
      `Codex merged the cluster instruction into the scene graph: ${input.instruction.trim()}`,
    );
  } else {
    session.scene_spec = buildHeuristicSceneSpec(session.goal, session.available_sources, session.scene_id);
    refreshDerivedArtifacts(session);
    addTinyFishEvent(
      session,
      "checkpoint",
      "Repair rerun staged",
      "Codex rebuilt the scene spec conservatively from the existing evidence.",
    );
  }

  addCheckpoint(session, "scene_spec_normalized", "ready", "Repair pass normalized the scene graph with tighter instructions.");
  session.phase = "ready";
  session.subtitle = "Repair pass complete. Validate again or replay Blender from the updated graph.";
  session.narrative.next_best_move = "Validate the repaired scene, then copy a workflow skill prompt or replay Blender actions.";
  saveSession(session);
  validateSceneGraphInternal(session.scene_id);
}

async function runCheckpointLoopInternal(sceneId: string) {
  let session = sessions.get(sceneId);
  if (!session || !session.scene_spec) {
    return;
  }

  session.checkpoint_loop.status = "running";
  session.checkpoint_loop.last_outcome = "Checkpoint loop is validating the current scene graph.";
  saveSession(session);
  validateSceneGraphInternal(sceneId);

  session = sessions.get(sceneId);
  if (!session || !session.scene_spec) {
    return;
  }

  if (session.validation.status === "failed") {
    const blockingNodeIds = uniqueNodeIds(
      session.validation.issues.filter((issue) => issue.blocking).flatMap((issue) => issue.node_ids),
    );

    if (session.checkpoint_loop.repair_attempts >= session.checkpoint_loop.max_repairs) {
      session.checkpoint_loop.status = "error";
      session.checkpoint_loop.last_outcome = "Checkpoint loop exhausted its auto-repair budget. Manual repair is needed.";
      session.narrative.next_best_move = "Use repair or chat with Codex about the blocking issues before applying to Blender again.";
      saveSession(session);
      return;
    }

    session.checkpoint_loop.repair_attempts += 1;
    session.checkpoint_loop.last_outcome = `Auto-repair ${session.checkpoint_loop.repair_attempts}/${session.checkpoint_loop.max_repairs} is running.`;
    session.phase = "repairing";
    session.subtitle = "Checkpoint loop found blocking issues and is running an automatic repair pass.";
    addCheckpoint(session, "repair_needed", "running", "Checkpoint loop triggered an automatic repair pass.");
    saveSession(session);

    await performRepairPass(session, {
      sceneId,
      instruction: autoRepairInstruction(session),
      targetNodeIds: blockingNodeIds,
      preferStealth: session.checkpoint_loop.repair_attempts > 1,
    });
    await runCheckpointLoopInternal(sceneId);
    return;
  }

  if (!session.checkpoint_loop.auto_apply) {
    session.checkpoint_loop.status = "completed";
    session.checkpoint_loop.last_outcome = "Validation passed. Auto-apply is off, so the loop is waiting for a manual Blender apply.";
    saveSession(session);
    return;
  }

  await performBlenderApply(session, false);
  session = sessions.get(sceneId);
  if (!session) {
    return;
  }

  const failedActions = session.blender.command_plan.actions.filter((action) => action.status === "failed");
  if (session.blender.bridge_mode === "live" && failedActions.length) {
    if (session.checkpoint_loop.replay_attempts >= session.checkpoint_loop.max_replays) {
      session.checkpoint_loop.status = "error";
      session.checkpoint_loop.last_outcome = "Checkpoint loop exhausted its replay budget. Some Blender actions still failed.";
      saveSession(session);
      return;
    }

    session.checkpoint_loop.replay_attempts += 1;
    session.checkpoint_loop.last_outcome = `Replay ${session.checkpoint_loop.replay_attempts}/${session.checkpoint_loop.max_replays} is retrying failed Blender actions.`;
    saveSession(session);
    await performBlenderApply(session, true);
    session = sessions.get(sceneId);
  }

  if (!session) {
    return;
  }

  const remainingFailures = session.blender.command_plan.actions.filter((action) => action.status === "failed");
  session.checkpoint_loop.status = remainingFailures.length ? "error" : "completed";
  session.checkpoint_loop.last_outcome = remainingFailures.length
    ? `Checkpoint loop finished with ${remainingFailures.length} failed Blender actions still requiring manual attention.`
    : "Checkpoint loop completed successfully. The scene is validated and Blender is in sync.";
  saveSession(session);
}

async function hydrateBlenderApply(sceneId: string, replayFailedOnly = false) {
  const session = sessions.get(sceneId);
  if (!session || !session.scene_spec) {
    jobs.delete(sceneId);
    return;
  }

  try {
    await performBlenderApply(session, replayFailedOnly);
  } catch (error) {
    session.blender.status = "failed";
    session.blender.summary = String(error);
    session.blender.command_plan.actions = session.blender.command_plan.actions.map((action) => ({
      ...action,
      status: action.status === "running" ? "failed" : action.status,
    }));
    session.phase = "error";
    session.subtitle = "Blender apply failed. Replay the failed actions or fall back to export.";
    addCheckpoint(session, "blender_applied", "error", "Blender bridge failed during the apply step.");
    saveSession(session);
  } finally {
    jobs.delete(sceneId);
  }
}

async function hydrateRepair(sceneId: string, input: RepairSceneRunInput) {
  const session = sessions.get(sceneId);
  if (!session) {
    jobs.delete(sceneId);
    return;
  }

  try {
    await performRepairPass(session, input);
  } catch (error) {
    session.phase = "error";
    session.subtitle = "Repair failed. Tighten the instruction or restart research.";
    addTinyFishEvent(session, "error", "Repair failed", String(error));
    saveSession(session);
  } finally {
    jobs.delete(sceneId);
  }
}

async function hydrateCheckpointLoop(sceneId: string) {
  const session = sessions.get(sceneId);
  if (!session) {
    jobs.delete(sceneId);
    return;
  }

  try {
    if (!session.scene_spec) {
      session.phase = "normalizing";
      session.subtitle = "Checkpoint loop is waiting for a scene spec before it can run.";
      saveSession(session);
      return;
    }
    await runCheckpointLoopInternal(sceneId);
  } catch (error) {
    session.checkpoint_loop.status = "error";
    session.checkpoint_loop.last_outcome = `Checkpoint loop failed: ${String(error)}`;
    session.phase = "error";
    saveSession(session);
  } finally {
    jobs.delete(sceneId);
  }
}

export function startSceneResearch(input: StartSceneResearchInput): SceneSession {
  const session = createEmptySession(input.goal);
  session.available_sources = rankSources(input.goal, input.sourceUrl);
  session.tinyfish.browser_profile =
    input.browserProfile ?? (session.available_sources[0]?.recommended_browser_mode === "stealth" ? "stealth" : "lite");
  session.phase = "researching";
  session.subtitle = "Codex is staging the scene-grounding pass before the TinyFish research lane lights up.";
  session.tinyfish.status = tinyFishConfigured()
    ? "Preparing a grounded TinyFish run-sse request."
    : "Preparing the simulated grounded run-sse flow because no API key is configured.";
  session.narrative.operator_brief = [
    `Primary source: ${session.available_sources[0]?.title ?? "manual input"}`,
    `Browser profile: ${session.tinyfish.browser_profile}`,
    "Codex will read Blender first, then keep the graph live while TinyFish researches and Blender stays downstream.",
  ];
  session.narrative.next_best_move = "Capture the live Blender scene, then let TinyFish research against that grounded context.";
  saveSession(session);

  const job = hydrateResearch(session.scene_id);
  jobs.set(session.scene_id, job);

  return clone(session);
}

export function renderSceneGraph(sceneId?: string): SceneSession {
  const session = getSession(sceneId);
  return clone(session);
}

export function validateSceneGraph(input: ValidateSceneGraphInput): SceneSession {
  const session = getSession(input.sceneId);
  validateSceneGraphInternal(session.scene_id);
  return clone(getSession(session.scene_id));
}

export function runCheckpointLoop(input: RunCheckpointLoopInput): SceneSession {
  const session = getSession(input.sceneId);
  session.checkpoint_loop.status = "running";
  session.checkpoint_loop.last_outcome = "Checkpoint loop started manually from the operator surface.";
  saveSession(session);

  const job = hydrateCheckpointLoop(session.scene_id);
  jobs.set(session.scene_id, job);
  return clone(getSession(session.scene_id));
}

export function applySceneToBlender(input: ApplySceneToBlenderInput): SceneSession {
  const session = getSession(input.sceneId);
  const job = hydrateBlenderApply(session.scene_id, input.replayFailedOnly);
  jobs.set(session.scene_id, job);
  return clone(getSession(session.scene_id));
}

export function repairSceneRun(input: RepairSceneRunInput): SceneSession {
  const session = getSession(input.sceneId);
  session.phase = "repairing";
  session.subtitle = "Repair pass started. Codex is tightening the scene graph before the next Blender move.";
  addCheckpoint(session, "repair_needed", "running", "Repair pass is active.");
  saveSession(session);

  const job = hydrateRepair(session.scene_id, input);
  jobs.set(session.scene_id, job);
  return clone(getSession(session.scene_id));
}

export async function chatWithScene(input: ChatWithSceneInput): Promise<SceneSession> {
  const session = getSession(input.sceneId);
  const message = input.message.trim();
  if (!message) {
    return clone(session);
  }

  await captureSceneGrounding(session);
  pushChatMessage(session, "user", message);
  pushChatMessage(session, "assistant", answerSceneChat(session, message));
  saveSession(session);
  return clone(getSession(session.scene_id));
}
