import {
  App,
  applyDocumentTheme,
  applyHostFonts,
  applyHostStyleVariables,
  type McpUiHostContext,
} from "@modelcontextprotocol/ext-apps";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { SceneGraphNode, ScenePayload } from "./shared/contracts.js";
import { defaultGoal } from "./shared/seed.js";
import "./global.css";
import "./mcp-app.css";

type AppMode = "hosted" | "preview";

const root = document.getElementById("app") as HTMLDivElement;
const app = new App({ name: "Codex Scene Orchestrator", version: "0.2.0" });

let mode: AppMode = "hosted";
let currentPayload: ScenePayload | null = null;
let statusLine = "Connecting to Codex host...";
let goalDraft = defaultGoal;
let clusterDraft = "";
let selectedNodeIds = new Set<string>();
let pollHandle: number | null = null;
let draggedSourceId: string | null = null;

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function payloadFromToolResult(result: CallToolResult): ScenePayload | null {
  return (result.structuredContent ?? null) as ScenePayload | null;
}

function applyHostContext(ctx: McpUiHostContext) {
  if (ctx.theme) applyDocumentTheme(ctx.theme);
  if (ctx.styles?.variables) applyHostStyleVariables(ctx.styles.variables);
  if (ctx.styles?.css?.fonts) applyHostFonts(ctx.styles.css.fonts);
}

function updateStatus(message: string) {
  statusLine = message;
  render();
}

function syncDrafts(payload: ScenePayload) {
  if (!goalDraft.trim()) {
    goalDraft = payload.goal;
  }
}

function setPayload(payload: ScenePayload, message?: string) {
  currentPayload = payload;
  syncDrafts(payload);
  if (message) {
    statusLine = message;
  }
  render();
  ensurePolling();
}

function needsPolling(payload: ScenePayload | null): boolean {
  if (!payload) return false;
  return ["researching", "normalizing", "repairing", "applying"].includes(payload.phase);
}

function stopPolling() {
  if (pollHandle) {
    window.clearTimeout(pollHandle);
    pollHandle = null;
  }
}

function ensurePolling() {
  stopPolling();
  if (!needsPolling(currentPayload)) {
    return;
  }

  pollHandle = window.setTimeout(async () => {
    if (!currentPayload) return;
    try {
      const payload = await callSceneTool("render_scene_graph", { sceneId: currentPayload.scene_id });
      setPayload(payload, payload.phase_label);
    } catch (error) {
      updateStatus(`Polling failed: ${String(error)}`);
    }
  }, 1100);
}

async function openExternal(url: string) {
  if (mode === "preview") {
    window.open(url, "_blank", "noopener,noreferrer");
    return;
  }
  await app.openLink({ url });
}

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, init);
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }
  return (await response.json()) as T;
}

async function callPreviewTool(name: string, args: Record<string, unknown>): Promise<ScenePayload> {
  if (name === "start_scene_research") {
    return fetchJson<ScenePayload>("/api/scene/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(args),
    });
  }
  if (name === "render_scene_graph") {
    const sceneId = args.sceneId ? `?sceneId=${encodeURIComponent(String(args.sceneId))}` : "";
    return fetchJson<ScenePayload>(`/preview-data/orchestrator${sceneId}`);
  }
  if (name === "validate_scene_graph") {
    return fetchJson<ScenePayload>(`/api/scene/${encodeURIComponent(String(args.sceneId))}/validate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
  }
  if (name === "apply_scene_to_blender") {
    return fetchJson<ScenePayload>(`/api/scene/${encodeURIComponent(String(args.sceneId))}/blender`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ replayFailedOnly: Boolean(args.replayFailedOnly) }),
    });
  }
  if (name === "repair_scene_run") {
    return fetchJson<ScenePayload>(`/api/scene/${encodeURIComponent(String(args.sceneId))}/repair`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        instruction: args.instruction,
        targetNodeIds: args.targetNodeIds,
        preferStealth: args.preferStealth,
      }),
    });
  }

  throw new Error(`Unknown preview tool: ${name}`);
}

async function callSceneTool(name: string, args: Record<string, unknown>): Promise<ScenePayload> {
  if (mode === "preview") {
    return callPreviewTool(name, args);
  }

  const result = await app.callServerTool({ name, arguments: args });
  const payload = payloadFromToolResult(result);
  if (!payload) {
    throw new Error(`Tool ${name} returned no structured content.`);
  }
  return payload;
}

function selectedNodes(payload: ScenePayload): SceneGraphNode[] {
  return payload.graph.nodes.filter((node) => selectedNodeIds.has(node.id));
}

function stageMetrics(payload: ScenePayload) {
  const objectCount = payload.scene_spec?.objects.length ?? 0;
  return [
    { label: "Grounding", value: payload.grounding ? payload.grounding.scene_name : "pending" },
    { label: "Objects", value: `${objectCount}` },
    { label: "Skills", value: `${payload.workflow_skills.length}` },
    { label: "Validation", value: payload.validation.status },
    { label: "Blender", value: payload.blender.bridge_mode },
    { label: "TinyFish", value: payload.tinyfish.enabled ? (payload.tinyfish.live ? "live" : "sim") : "sim" },
  ];
}

function checkpointStatus(payload: ScenePayload, kind: string): string {
  return payload.checkpoints.find((checkpoint) => checkpoint.kind === kind)?.status ?? "idle";
}

function flowStripMarkup(payload: ScenePayload): string {
  const steps = [
    {
      label: "Ground scene",
      detail: payload.grounding ? `${payload.grounding.object_count} objects in view` : "Capture live Blender context",
      status: checkpointStatus(payload, "scene_grounded"),
    },
    {
      label: "Research web",
      detail: payload.tinyfish.status,
      status:
        payload.phase === "researching" || payload.phase === "normalizing"
          ? "running"
          : checkpointStatus(payload, "research_extracted"),
    },
    {
      label: "Resolve scene",
      detail: payload.scene_spec ? `${payload.scene_spec.project_title} • ${payload.workflow_skills.length} skills` : "Wait for SceneSpec",
      status: checkpointStatus(payload, "scene_graph_resolved"),
    },
    {
      label: "Validate",
      detail: payload.validation.summary || "Check evidence and ambiguity",
      status:
        payload.validation.status === "passed"
          ? "ready"
          : payload.validation.status === "failed"
            ? "warning"
            : checkpointStatus(payload, "verification_passed"),
    },
    {
      label: "Apply to Blender",
      detail: payload.blender.summary,
      status: checkpointStatus(payload, "blender_applied"),
    },
  ];

  return `
    <section class="flow-strip">
      ${steps
        .map(
          (step) => `
            <div class="flow-step flow-${escapeHtml(step.status)}">
              <span class="flow-label">${escapeHtml(step.label)}</span>
              <span class="flow-detail">${escapeHtml(step.detail)}</span>
            </div>
          `,
        )
        .join("")}
    </section>
  `;
}

function nodeColorClass(node: SceneGraphNode): string {
  return `type-${node.type} status-${node.status}`;
}

function edgeMarkup(payload: ScenePayload): string {
  const nodeMap = new Map(payload.graph.nodes.map((node) => [node.id, node]));

  return payload.graph.edges
    .map((edge) => {
      const source = nodeMap.get(edge.source);
      const target = nodeMap.get(edge.target);
      if (!source || !target) return "";

      return `
        <line
          x1="${source.x}"
          y1="${source.y}"
          x2="${target.x}"
          y2="${target.y}"
          class="edge edge-${escapeHtml(edge.kind)}"
        />
      `;
    })
    .join("");
}

function laneMarkup(): string {
  const lanes = [
    { label: "Grounding", left: 6 },
    { label: "Research", left: 27 },
    { label: "Scene plan", left: 50 },
    { label: "Workflow", left: 76 },
    { label: "Blender", left: 92 },
  ];

  return lanes
    .map(
      (lane) => `
        <div class="graph-lane" style="left:${lane.left}%">
          <span>${escapeHtml(lane.label)}</span>
        </div>
      `,
    )
    .join("");
}

function nodeMarkup(payload: ScenePayload): string {
  return payload.graph.nodes
    .map((node) => {
      const selected = selectedNodeIds.has(node.id) ? "is-selected" : "";
      const detail = node.detail_lines[0] ?? node.summary;
      return `
        <button
          class="graph-node ${nodeColorClass(node)} ${selected}"
          data-action="select-node"
          data-node-id="${escapeHtml(node.id)}"
          style="left:${node.x}%; top:${node.y}%"
        >
          <span class="graph-node-kicker">${escapeHtml(node.type.replaceAll("_", " "))}</span>
          <strong class="graph-node-label">${escapeHtml(node.label)}</strong>
          <span class="graph-node-summary">${escapeHtml(detail)}</span>
        </button>
      `;
    })
    .join("");
}

function sourceDockMarkup(payload: ScenePayload): string {
  return payload.available_sources
    .map(
      (source) => `
        <button
          class="source-chip"
          data-action="use-source"
          data-source-url="${escapeHtml(source.url)}"
          data-source-id="${escapeHtml(source.id)}"
          draggable="true"
        >
          <span>${escapeHtml(source.title)}</span>
          <em>${escapeHtml(source.recommended_browser_mode)}</em>
        </button>
      `,
    )
    .join("");
}

function inspectorMarkup(payload: ScenePayload): string {
  const nodes = selectedNodes(payload);

  if (nodes.length > 1) {
    return `
      <section class="inspector-section">
        <div class="inspector-kicker">Cluster</div>
        <h2 class="inspector-title">${nodes.length} nodes selected</h2>
        <p class="inspector-copy">Merge a single instruction back into the graph and Blender plan from this right-side panel.</p>
        <div class="selected-list">
          ${nodes.map((node) => `<span class="selected-pill">${escapeHtml(node.label)}</span>`).join("")}
        </div>
      </section>
      <section class="inspector-section">
        <label class="field-label" for="cluster-input">Cluster instruction</label>
        <textarea id="cluster-input" class="field-area" placeholder="${escapeHtml(payload.cluster_placeholder)}">${escapeHtml(clusterDraft)}</textarea>
        <div class="button-row">
          <button class="ui-button ui-button-primary" data-action="cluster-merge">Merge into graph</button>
          <button class="ui-button" data-action="clear-selection">Clear selection</button>
        </div>
      </section>
    `;
  }

  if (nodes.length === 1) {
    const node = nodes[0];
    const workflowSkill = node.type === "workflow_skill" ? payload.workflow_skills.find((skill) => skill.id === node.id) ?? null : null;
    return `
      <section class="inspector-section">
        <div class="inspector-kicker">${escapeHtml(node.type.replaceAll("_", " "))}</div>
        <h2 class="inspector-title">${escapeHtml(node.label)}</h2>
        <p class="inspector-copy">${escapeHtml(node.summary)}</p>
      </section>
      <section class="inspector-section">
        <div class="detail-stack">
          ${node.detail_lines.map((line) => `<div class="detail-line">${escapeHtml(line)}</div>`).join("")}
        </div>
      </section>
      ${
        workflowSkill
          ? `
            <section class="inspector-section">
              <div class="inspector-kicker">Codex prompt</div>
              <div class="detail-stack">
                <div class="detail-line">${escapeHtml(workflowSkill.when_to_use)}</div>
                <div class="detail-line detail-code">${escapeHtml(workflowSkill.codex_prompt)}</div>
              </div>
              <div class="button-row">
                <button class="ui-button ui-button-primary" data-action="copy-skill-prompt" data-skill-id="${escapeHtml(workflowSkill.id)}">Copy prompt</button>
              </div>
            </section>
          `
          : ""
      }
      ${
        node.citations.length
          ? `
            <section class="inspector-section">
              <div class="inspector-kicker">Citations</div>
              <div class="citation-list">
                ${node.citations
                  .map(
                    (citation) => `
                      <button class="citation-row" data-action="open-link" data-url="${escapeHtml(citation.url)}">
                        <strong>${escapeHtml(citation.label)}</strong>
                        <span>${escapeHtml(citation.snippet)}</span>
                      </button>
                    `,
                  )
                  .join("")}
              </div>
            </section>
          `
          : ""
      }
      <section class="inspector-section">
        <div class="button-row">
          <button class="ui-button" data-action="clear-selection">Back to operator view</button>
        </div>
      </section>
    `;
  }

  const recentEvents = payload.tinyfish.events.slice(-6).reverse();

  return `
    <section class="inspector-section">
      <div class="inspector-kicker">Operator brief</div>
      <h2 class="inspector-title">${escapeHtml(payload.phase_label)}</h2>
      <p class="inspector-copy">${escapeHtml(payload.narrative.codex_role)}</p>
      <div class="brief-list">
        ${payload.narrative.operator_brief.map((line) => `<div class="brief-line">${escapeHtml(line)}</div>`).join("")}
      </div>
    </section>
    ${
      payload.grounding
        ? `
          <section class="inspector-section">
            <div class="inspector-kicker">Scene grounding</div>
            <h3 class="subhead">${escapeHtml(payload.grounding.scene_name)}</h3>
            ${
              payload.grounding.viewport_image
                ? `<div class="grounding-preview"><img src="${escapeHtml(payload.grounding.viewport_image)}" alt="Current Blender viewport" /></div>`
                : ""
            }
            <div class="detail-stack">
              ${payload.grounding.summary_lines.map((line) => `<div class="detail-line">${escapeHtml(line)}</div>`).join("")}
            </div>
          </section>
        `
        : ""
    }
    <section class="inspector-section">
      <div class="inspector-kicker">TinyFish docs-aware plan</div>
      <div class="detail-stack">
        ${payload.tinyfish.docs_reasoning.map((line) => `<div class="detail-line">${escapeHtml(line)}</div>`).join("")}
      </div>
      <div class="button-row">
        <button class="ui-button" data-action="open-link" data-url="${escapeHtml(payload.capability_profile.docs_url)}">Open docs</button>
        ${
          payload.tinyfish.streaming_url
            ? `<button class="ui-button ui-button-primary" data-action="open-link" data-url="${escapeHtml(payload.tinyfish.streaming_url)}">Open live stream</button>`
            : ""
        }
      </div>
    </section>
    <section class="inspector-section">
      <div class="inspector-kicker">Event stream</div>
      <div class="event-list">
        ${
          recentEvents.length
            ? recentEvents
                .map(
                  (event) => `
                    <div class="event-row event-${escapeHtml(event.type)}">
                      <strong>${escapeHtml(event.title)}</strong>
                      <span>${escapeHtml(event.detail)}</span>
                    </div>
                  `,
                )
                .join("")
            : `<div class="event-row"><strong>Waiting</strong><span>Start research to populate the TinyFish lane.</span></div>`
        }
      </div>
    </section>
    ${
      payload.workflow_skills.length
        ? `
          <section class="inspector-section">
            <div class="inspector-kicker">Generated workflow skills</div>
            <div class="detail-stack">
              ${payload.workflow_skills
                .map(
                  (skill) => `
                    <button class="citation-row skill-row" data-action="copy-skill-prompt" data-skill-id="${escapeHtml(skill.id)}">
                      <strong>${escapeHtml(skill.name)}</strong>
                      <span>${escapeHtml(skill.purpose)}</span>
                    </button>
                  `,
                )
                .join("")}
            </div>
          </section>
        `
        : ""
    }
    ${
      payload.scene_spec
        ? `
          <section class="inspector-section">
            <div class="inspector-kicker">Scene spec</div>
            <h3 class="subhead">${escapeHtml(payload.scene_spec.project_title)}</h3>
            <div class="detail-stack">
              <div class="detail-line">${escapeHtml(payload.scene_spec.environment.location_type)}</div>
              <div class="detail-line">${escapeHtml(payload.scene_spec.camera.lens_feel)}</div>
              <div class="detail-line">${escapeHtml(payload.scene_spec.lighting.overall_feel)}</div>
            </div>
          </section>
        `
        : ""
    }
  `;
}

function actionRailMarkup(payload: ScenePayload): string {
  return `
    <div class="action-rail">
      <button class="ui-button" data-action="validate-scene" ${payload.scene_spec ? "" : "disabled"}>Validate</button>
      <button class="ui-button ui-button-primary" data-action="apply-blender" ${payload.scene_spec ? "" : "disabled"}>Apply to Blender</button>
      <button class="ui-button" data-action="replay-failed" ${payload.scene_spec ? "" : "disabled"}>Replay failed</button>
      <button class="ui-button" data-action="repair-scene" ${payload.scene_spec ? "" : "disabled"}>Repair</button>
      <button class="ui-button" data-action="export-scene" ${payload.scene_spec ? "" : "disabled"}>Export JSON</button>
    </div>
  `;
}

function mainMarkup(payload: ScenePayload): string {
  return `
    <div class="shell">
      <header class="topbar">
        <div class="brand-block">
          <div class="brand-kicker">Codex operator layer</div>
          <h1 class="brand-title">TinyFish Web-to-Previs</h1>
          <p class="brand-copy">${escapeHtml(payload.subtitle)}</p>
        </div>
        <div class="status-chip">${escapeHtml(statusLine)}</div>
      </header>

      <section class="launch-strip">
        <div class="launch-copy">
          <div class="section-kicker">Goal</div>
          <p>Codex grounds the live Blender scene, TinyFish researches the web, and Blender receives a deterministic previs blockout.</p>
          <p>${escapeHtml(payload.narrative.next_best_move)}</p>
        </div>
        <div class="launch-controls">
          <textarea id="goal-input" class="field-area goal-area" placeholder="Describe the cinematic scene you want Codex to research and stage.">${escapeHtml(goalDraft)}</textarea>
          <div class="button-row">
            <button class="ui-button ui-button-primary" data-action="launch-research">Launch research</button>
            <button class="ui-button" data-action="render-latest">Refresh graph</button>
          </div>
        </div>
      </section>

      <section class="metric-strip">
        ${stageMetrics(payload)
          .map(
            (metric) => `
              <div class="metric">
                <span class="metric-label">${escapeHtml(metric.label)}</span>
                <strong class="metric-value">${escapeHtml(metric.value)}</strong>
              </div>
            `,
          )
          .join("")}
      </section>
      ${flowStripMarkup(payload)}

      <div class="workspace">
        <main class="graph-pane">
          <div class="stage-head">
            <div>
              <div class="section-kicker">Graph stage</div>
              <h2 class="stage-title">${escapeHtml(payload.goal)}</h2>
            </div>
            <div class="stage-state">${escapeHtml(payload.phase_label)}</div>
          </div>
          <div class="graph-stage" data-drop-zone="graph">
            ${laneMarkup()}
            <svg class="graph-edges" viewBox="0 0 100 100" preserveAspectRatio="none">
              ${edgeMarkup(payload)}
            </svg>
            ${nodeMarkup(payload)}
            <div class="drop-hint">Drag a source here to launch a new TinyFish-guided pass.</div>
          </div>
          <div class="source-dock">
            <div class="section-kicker">Source dock</div>
            <div class="source-row">${sourceDockMarkup(payload)}</div>
          </div>
          ${actionRailMarkup(payload)}
        </main>

        <aside class="inspector-pane">${inspectorMarkup(payload)}</aside>
      </div>
    </div>
  `;
}

function render() {
  const payload =
    currentPayload ??
    ({
      view: "orchestrator",
      scene_id: "bootstrap",
      title: "TinyFish Web-to-Previs Orchestrator",
      grounding: null,
      subtitle: "Loading the operator graph...",
      goal: goalDraft,
      phase: "idle",
      phase_label: "Loading",
      updated_at: new Date().toISOString(),
      narrative: {
        codex_role: "Codex will become the primary operator layer once the session loads.",
        operator_brief: [],
        next_best_move: "Wait for the preview payload.",
      },
      capability_profile: {
        name: "TinyFish Web Agent",
        docs_url: "https://docs.tinyfish.ai/",
        api_base: "https://agent.tinyfish.ai",
        primary_endpoint: "/v1/automation/run-sse",
        browser_profiles: [],
        event_types: [],
        constraints: [],
        example_goal_templates: [],
      },
      available_sources: [],
      graph: { nodes: [], edges: [] },
      checkpoints: [],
      tinyfish: {
        enabled: false,
        live: false,
        browser_profile: "lite",
        status: "Loading",
        run_id: null,
        streaming_url: null,
        docs_reasoning: [],
        events: [],
      },
      scene_spec: null,
      validation: { status: "pending", summary: "", issues: [] },
      blender: {
        bridge_mode: "fallback",
        status: "idle",
        endpoint_configured: false,
        summary: "",
        last_applied_at: null,
        command_plan: { scene_id: "bootstrap", summary: "", notes: [], actions: [] },
      },
      quick_actions: [],
      cluster_placeholder: "Merge selected nodes...",
      export_filename: "bootstrap.scene_spec.json",
      workflow_skills: [],
    } satisfies ScenePayload);

  root.innerHTML = mainMarkup(payload);
}

async function loadInitialState() {
  const payload = await callSceneTool("render_scene_graph", currentPayload ? { sceneId: currentPayload.scene_id } : {});
  setPayload(payload, payload.phase_label);
}

async function launchResearch(sourceUrl?: string) {
  const payload = await callSceneTool("start_scene_research", {
    goal: goalDraft.trim() || defaultGoal,
    sourceUrl,
    browserProfile: currentPayload?.tinyfish.browser_profile ?? "lite",
  });
  selectedNodeIds.clear();
  setPayload(payload, "Scene research launched.");
}

async function runValidation() {
  if (!currentPayload) return;
  const payload = await callSceneTool("validate_scene_graph", { sceneId: currentPayload.scene_id });
  setPayload(payload, payload.validation.summary);
}

async function applyToBlender(replayFailedOnly = false) {
  if (!currentPayload) return;
  const payload = await callSceneTool("apply_scene_to_blender", {
    sceneId: currentPayload.scene_id,
    replayFailedOnly,
  });
  setPayload(payload, replayFailedOnly ? "Replaying failed Blender actions." : "Applying scene to Blender.");
}

async function repairScene() {
  if (!currentPayload) return;
  const payload = await callSceneTool("repair_scene_run", {
    sceneId: currentPayload.scene_id,
    instruction: clusterDraft.trim() || undefined,
    targetNodeIds: [...selectedNodeIds],
    preferStealth: false,
  });
  setPayload(payload, "Repair pass started.");
}

function exportSceneSpec() {
  if (!currentPayload?.scene_spec) {
    return;
  }

  const blob = new Blob([JSON.stringify(currentPayload.scene_spec, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = currentPayload.export_filename;
  anchor.click();
  URL.revokeObjectURL(url);
  updateStatus(`Exported ${currentPayload.export_filename}.`);
}

async function copySkillPrompt(skillId: string) {
  if (!currentPayload) {
    return;
  }
  const skill = currentPayload.workflow_skills.find((candidate) => candidate.id === skillId);
  if (!skill) {
    throw new Error("Workflow skill not found.");
  }
  await navigator.clipboard.writeText(skill.codex_prompt);
  updateStatus(`Copied workflow prompt for ${skill.name}.`);
}

function toggleSelection(nodeId: string, additive: boolean) {
  if (!currentPayload) return;

  if (!additive) {
    selectedNodeIds = selectedNodeIds.size === 1 && selectedNodeIds.has(nodeId) ? new Set<string>() : new Set([nodeId]);
  } else {
    const next = new Set(selectedNodeIds);
    if (next.has(nodeId)) next.delete(nodeId);
    else next.add(nodeId);
    selectedNodeIds = next;
  }
  render();
}

root.addEventListener("input", (event) => {
  const target = event.target as HTMLElement;
  if (target instanceof HTMLTextAreaElement && target.id === "goal-input") {
    goalDraft = target.value;
  }
  if (target instanceof HTMLTextAreaElement && target.id === "cluster-input") {
    clusterDraft = target.value;
  }
});

root.addEventListener("dragstart", (event) => {
  const target = event.target as HTMLElement;
  const source = target.closest<HTMLElement>("[data-source-id]");
  if (!source) return;
  draggedSourceId = source.dataset.sourceId ?? null;
  event.dataTransfer?.setData("text/plain", draggedSourceId ?? "");
});

root.addEventListener("dragover", (event) => {
  const target = event.target as HTMLElement;
  if (target.closest("[data-drop-zone='graph']")) {
    event.preventDefault();
  }
});

root.addEventListener("drop", async (event) => {
  const target = event.target as HTMLElement;
  if (!target.closest("[data-drop-zone='graph']") || !currentPayload) {
    return;
  }
  event.preventDefault();
  const sourceId = draggedSourceId ?? event.dataTransfer?.getData("text/plain");
  draggedSourceId = null;
  const source = currentPayload.available_sources.find((item) => item.id === sourceId);
  if (!source) {
    return;
  }
  try {
    await launchResearch(source.url);
  } catch (error) {
    updateStatus(`Drop failed: ${String(error)}`);
  }
});

root.addEventListener("click", async (event) => {
  const target = event.target as HTMLElement;
  const actionEl = target.closest<HTMLElement>("[data-action]");
  if (!actionEl) return;

  const action = actionEl.dataset.action;

  try {
    if (action === "launch-research") await launchResearch();
    if (action === "render-latest") await loadInitialState();
    if (action === "validate-scene") await runValidation();
    if (action === "apply-blender") await applyToBlender(false);
    if (action === "replay-failed") await applyToBlender(true);
    if (action === "repair-scene") await repairScene();
    if (action === "cluster-merge") await repairScene();
    if (action === "export-scene") exportSceneSpec();
    if (action === "clear-selection") {
      selectedNodeIds.clear();
      render();
    }
    if (action === "open-link" && actionEl.dataset.url) {
      await openExternal(actionEl.dataset.url);
      updateStatus(`Opened ${actionEl.dataset.url}.`);
    }
    if (action === "use-source" && actionEl.dataset.sourceUrl) {
      await launchResearch(actionEl.dataset.sourceUrl);
    }
    if (action === "copy-skill-prompt" && actionEl.dataset.skillId) {
      await copySkillPrompt(actionEl.dataset.skillId);
    }
    if (action === "select-node" && actionEl.dataset.nodeId) {
      toggleSelection(actionEl.dataset.nodeId, event.metaKey || event.ctrlKey || event.shiftKey);
    }
  } catch (error) {
    updateStatus(`Action failed: ${String(error)}`);
  }
});

app.ontoolresult = (result) => {
  const payload = payloadFromToolResult(result);
  if (payload) {
    setPayload(payload, "Tool result received.");
  }
};

app.onhostcontextchanged = applyHostContext;
app.onerror = (error) => {
  updateStatus(`Bridge error: ${String(error)}`);
};

render();

app
  .connect()
  .then(async () => {
    const ctx = app.getHostContext();
    if (ctx) applyHostContext(ctx);
    mode = "hosted";
    await loadInitialState();
  })
  .catch(async () => {
    mode = "preview";
    await loadInitialState();
  });
