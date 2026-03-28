import {
  App,
  applyDocumentTheme,
  applyHostFonts,
  applyHostStyleVariables,
  type McpUiHostContext,
} from "@modelcontextprotocol/ext-apps";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { DashboardPayload, RadarPayload, RunPayload, SkillPayload } from "./shared/contracts.js";
import "./global.css";
import "./mcp-app.css";

type AppMode = "hosted" | "preview";

const root = document.getElementById("app") as HTMLDivElement;
const app = new App({ name: "Radar Control Surface", version: "0.1.0" });

let mode: AppMode = "hosted";
let currentPayload: RadarPayload | null = null;
let statusLine = "Connecting to host...";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function updateStatus(message: string) {
  statusLine = message;
  render();
}

function applyHostContext(ctx: McpUiHostContext) {
  if (ctx.theme) {
    applyDocumentTheme(ctx.theme);
  }
  if (ctx.styles?.variables) {
    applyHostStyleVariables(ctx.styles.variables);
  }
  if (ctx.styles?.css?.fonts) {
    applyHostFonts(ctx.styles.css.fonts);
  }
}

function payloadFromToolResult(result: CallToolResult): RadarPayload | null {
  return (result.structuredContent ?? null) as RadarPayload | null;
}

function metricMarkup(payload: DashboardPayload): string {
  return payload.stats
    .map(
      (stat) => `
        <div class="metric">
          <div class="metric-value">${escapeHtml(stat.value)}</div>
          <div class="metric-label">${escapeHtml(stat.label)}</div>
          <div class="metric-detail">${escapeHtml(stat.detail)}</div>
        </div>
      `,
    )
    .join("");
}

function dashboardMarkup(payload: DashboardPayload): string {
  return `
    <section class="hero">
      <div class="hero-copy">
        <div class="eyebrow"><span class="dot"></span> Radar control room</div>
        <h1 class="hero-title">${escapeHtml(payload.title)}</h1>
        <p class="hero-subtitle">${escapeHtml(payload.subtitle)}</p>
      </div>
      <div class="action-row">
        <button class="action is-primary" data-action="compile-demo">Compile demo skill</button>
        <button class="action" data-action="render-run">Simulate routed answer</button>
      </div>
    </section>
    <section class="metric-strip">${metricMarkup(payload)}</section>
    <section class="section">
      <div class="section-head">
        <div>
          <h2 class="section-title">Skill genome</h2>
          <p class="section-note">Retrieval before generation. The best demo flow starts from what already exists.</p>
        </div>
      </div>
      <div class="list">
        ${payload.skills
          .map(
            (skill) => `
              <button class="list-row" data-action="open-skill" data-skill-id="${escapeHtml(skill.skill_id)}">
                <div>
                  <div class="row-title">${escapeHtml(skill.name)}</div>
                  <div class="row-meta">${escapeHtml(skill.category)} · ${escapeHtml(skill.description)}</div>
                  <div class="tag-rail">${skill.tags
                    .map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`)
                    .join("")}</div>
                </div>
                <div class="row-score">${skill.usage_count} runs</div>
                <div class="row-score">${skill.eval_score.toFixed(2)} eval</div>
              </button>
            `,
          )
          .join("")}
      </div>
    </section>
  `;
}

function skillMarkup(payload: SkillPayload): string {
  return `
    <section class="hero">
      <div class="hero-copy">
        <div class="eyebrow"><span class="dot"></span> Skill focus</div>
        <h1 class="hero-title">${escapeHtml(payload.title)}</h1>
        <p class="hero-subtitle">${escapeHtml(payload.subtitle)}</p>
      </div>
      <div class="action-row">
        <button class="action" data-action="back-dashboard">Back to registry</button>
        <button class="action is-primary" data-action="patch-skill" data-skill-id="${escapeHtml(payload.skill.skill_id)}">Propose patch</button>
      </div>
    </section>
    <section class="section">
      <div class="section-head">
        <div>
          <h2 class="section-title">Skill metadata</h2>
          <p class="section-note">Versioned behavior plus the public evidence that keeps it honest.</p>
        </div>
      </div>
      <div class="list">
        <div class="skill-meta-row">
          <div class="row-title">${escapeHtml(payload.skill.category)}</div>
          <div class="row-meta">Version ${escapeHtml(payload.skill.version)} · ${escapeHtml(payload.skill.surface_type)} surface</div>
          <div class="tag-rail">${payload.skill.tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}</div>
        </div>
        ${payload.sources
          .map(
            (source) => `
              <div class="source-row">
                <div class="row-title">${escapeHtml(source.url)}</div>
                <div class="row-meta">${escapeHtml(source.note)}</div>
                <button class="mini-action" data-action="open-link" data-url="${escapeHtml(source.url)}">Open source</button>
              </div>
            `,
          )
          .join("")}
      </div>
    </section>
    <section class="section">
      <div class="section-head">
        <div>
          <h2 class="section-title">Eval receipts</h2>
          <p class="section-note">Small, fast checks that keep the catalog trustworthy.</p>
        </div>
      </div>
      <div class="list">
        ${payload.evals.length
          ? payload.evals
              .map(
                (evalResult) => `
                  <div class="eval-row">
                    <div class="row-title">${escapeHtml(evalResult.round)} · ${escapeHtml(evalResult.prompt)}</div>
                    <div class="row-meta">${evalResult.metrics.latency_ms} ms · citations ${evalResult.metrics.source_citation_present ? "present" : "missing"}</div>
                    <div class="pill-note">${escapeHtml(evalResult.notes)}</div>
                  </div>
                `,
              )
              .join("")
          : `<div class="empty">No evals attached yet.</div>`}
      </div>
    </section>
  `;
}

function runMarkup(payload: RunPayload): string {
  return `
    <section class="hero">
      <div class="hero-copy run-headline">
        <div class="eyebrow"><span class="dot"></span> Compiler outcome</div>
        <div class="run-verdict">${escapeHtml(payload.outcome.verdict)}</div>
        <p class="hero-subtitle">${escapeHtml(payload.subtitle)}</p>
      </div>
      <div class="action-row">
        <button class="action" data-action="back-dashboard">Back to registry</button>
        <button class="action is-primary" data-action="compile-demo">Compile again</button>
      </div>
    </section>
    <section class="section">
      <div class="section-head">
        <div>
          <h2 class="section-title">${escapeHtml(payload.title)}</h2>
          <p class="section-note">The answer is compact, but the evidence trail stays visible.</p>
        </div>
      </div>
      <div class="list">
        ${payload.outcome.rationale
          .map(
            (line) => `
              <div class="rationale-row">
                <div class="row-title">${escapeHtml(line)}</div>
              </div>
            `,
          )
          .join("")}
        <div class="rationale-row">
          <div class="row-title">${escapeHtml(payload.outcome.next_step)}</div>
        </div>
      </div>
    </section>
    <section class="section">
      <div class="section-head">
        <div>
          <h2 class="section-title">Citations</h2>
          <p class="section-note">Public sources only. Keep the browser pass scoped to what really needs it.</p>
        </div>
      </div>
      <div class="list">
        ${payload.citations
          .map(
            (citation) => `
              <div class="source-row">
                <div class="row-title">${escapeHtml(citation.label)}</div>
                <div class="row-meta">${escapeHtml(citation.url)}</div>
                <button class="mini-action" data-action="open-link" data-url="${escapeHtml(citation.url)}">Open source</button>
              </div>
            `,
          )
          .join("")}
        ${
          payload.generated_files
            ? `
              <div class="source-row">
                <div class="row-title">Generated files</div>
                <div class="tag-rail">${payload.generated_files.map((file) => `<span class="tag">${escapeHtml(file)}</span>`).join("")}</div>
              </div>
            `
            : ""
        }
      </div>
    </section>
  `;
}

function sidePaneMarkup(payload: RadarPayload): string {
  if (payload.view === "dashboard") {
    return `
      <section class="section">
        <div class="section-head">
          <div>
            <h2 class="section-title">Compiler loop</h2>
            <p class="section-note">One engine, one polished surface, one clean vertical.</p>
          </div>
        </div>
        <div class="pipeline">
          ${payload.pipeline
            .map(
              (step) => `
                <div class="pipeline-row">
                  <div class="pipeline-label">${escapeHtml(step.label)}</div>
                  <div class="row-meta">${escapeHtml(step.detail)}</div>
                </div>
              `,
            )
            .join("")}
        </div>
      </section>
      <section class="section">
        <div class="section-head">
          <div>
            <h2 class="section-title">Watchlist</h2>
            <p class="section-note">What is healthy, ready, or queued right now.</p>
          </div>
        </div>
        <div class="list">
          ${payload.watchlist
            .map(
              (item) => `
                <div class="watch-row">
                  <div class="watch-title">${escapeHtml(item.title)}</div>
                  <div class="watch-state">${escapeHtml(item.status)}</div>
                  <div class="row-meta">${escapeHtml(item.detail)}</div>
                </div>
              `,
            )
            .join("")}
        </div>
      </section>
    `;
  }

  return `
    <section class="section">
      <div class="section-head">
        <div>
          <h2 class="section-title">Quick moves</h2>
          <p class="section-note">Keep the next action obvious during the demo.</p>
        </div>
      </div>
      <div class="action-row">
        <button class="action" data-action="back-dashboard">Open registry</button>
        <button class="action" data-action="render-run">Show routed answer</button>
      </div>
    </section>
    <div class="note-block">Preview mode stays useful in a normal browser too, so you can demo the surface without a host attached.</div>
  `;
}

function render() {
  const payload = currentPayload ?? {
    view: "dashboard",
    title: "Radar Registry",
    subtitle: "Loading the control surface...",
    stats: [],
    pipeline: [],
    skills: [],
    watchlist: [],
    quick_actions: [],
  } satisfies DashboardPayload;

  const mainMarkup =
    payload.view === "dashboard"
      ? dashboardMarkup(payload)
      : payload.view === "skill"
        ? skillMarkup(payload)
        : runMarkup(payload);

  root.innerHTML = `
    <div class="shell">
      <header class="masthead">
        <div class="eyebrow"><span class="dot"></span> TinyFish × Radar MVP</div>
        <div class="status">${escapeHtml(statusLine)}</div>
      </header>
      <div class="content">
        <main class="main-pane">${mainMarkup}</main>
        <aside class="side-pane">${sidePaneMarkup(payload)}</aside>
      </div>
      <footer class="footer">
        <div class="row-meta">${mode === "preview" ? "Standalone preview mode" : "Connected through the MCP Apps bridge"}</div>
        <div class="action-row">
          <button class="mini-action" data-action="back-dashboard">Dashboard</button>
          <button class="mini-action" data-action="render-run">Run result</button>
        </div>
      </footer>
    </div>
  `;
}

async function fetchPreview<T>(path: string): Promise<T> {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Preview request failed: ${response.status}`);
  }
  return (await response.json()) as T;
}

async function loadDashboard() {
  if (mode === "preview") {
    currentPayload = await fetchPreview<DashboardPayload>("/preview-data/dashboard");
    updateStatus("Preview dashboard ready.");
    return;
  }

  const result = await app.callServerTool({ name: "render_registry_dashboard", arguments: {} });
  currentPayload = payloadFromToolResult(result);
  updateStatus("Registry rendered from host data.");
}

async function loadSkill(skillId: string) {
  if (mode === "preview") {
    currentPayload = await fetchPreview<SkillPayload>(`/preview-data/skill/${encodeURIComponent(skillId)}`);
    updateStatus(`Previewing ${skillId}.`);
    return;
  }

  const result = await app.callServerTool({ name: "render_skill_card", arguments: { skillId } });
  currentPayload = payloadFromToolResult(result);
  updateStatus(`Opened ${skillId}.`);
}

async function loadRun() {
  if (mode === "preview") {
    currentPayload = await fetchPreview<RunPayload>("/preview-data/run");
    updateStatus("Previewed a routed answer.");
    return;
  }

  const result = await app.callServerTool({
    name: "render_run_result",
    arguments: { query: "Compile a public docs workflow into a widget-ready skill." },
  });
  currentPayload = payloadFromToolResult(result);
  updateStatus("Rendered a routed answer.");
}

async function compileDemo() {
  if (mode === "preview") {
    currentPayload = await fetchPreview<RunPayload>("/preview-data/compile");
    updateStatus("Previewed a compiler pass.");
    return;
  }

  const workflow = await app.callServerTool({
    name: "extract_workflow",
    arguments: {
      title: "Radar Docs Compiler",
      sourceUrls: [
        "https://developers.openai.com/apps-sdk/quickstart",
        "https://github.com/modelcontextprotocol/ext-apps",
      ],
      desiredSurface: "widget",
    },
  });

  const workflowSpec = workflow.structuredContent;
  const result = await app.callServerTool({
    name: "compile_skill",
    arguments: { workflowSpec },
  });

  currentPayload = payloadFromToolResult(result);
  updateStatus("Compiled a demo workflow.");
}

async function patchSkill(skillId: string) {
  if (mode === "preview") {
    currentPayload = await fetchPreview<RunPayload>(`/preview-data/patch/${encodeURIComponent(skillId)}`);
    updateStatus(`Previewed a patch for ${skillId}.`);
    return;
  }

  const result = await app.callServerTool({
    name: "patch_skill",
    arguments: {
      skillId,
      reason: "Public source moved and the widget surface needs a small selector adjustment.",
    },
  });

  currentPayload = payloadFromToolResult(result);
  updateStatus(`Opened patch flow for ${skillId}.`);
}

root.addEventListener("click", async (event) => {
  const target = event.target as HTMLElement;
  const actionEl = target.closest<HTMLElement>("[data-action]");

  if (!actionEl) {
    return;
  }

  const action = actionEl.dataset.action;

  try {
    if (action === "back-dashboard") await loadDashboard();
    if (action === "open-skill" && actionEl.dataset.skillId) await loadSkill(actionEl.dataset.skillId);
    if (action === "render-run") await loadRun();
    if (action === "compile-demo") await compileDemo();
    if (action === "patch-skill" && actionEl.dataset.skillId) await patchSkill(actionEl.dataset.skillId);
    if (action === "open-link" && actionEl.dataset.url) {
      await app.openLink({ url: actionEl.dataset.url });
      updateStatus(`Opened ${actionEl.dataset.url}.`);
    }
  } catch (error) {
    updateStatus(`Action failed: ${String(error)}`);
  }
});

app.ontoolresult = (result) => {
  const payload = payloadFromToolResult(result);
  if (payload) {
    currentPayload = payload;
    updateStatus("Tool result received.");
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
    if (ctx) {
      applyHostContext(ctx);
    }
    mode = "hosted";
    await loadDashboard();
  })
  .catch(async () => {
    mode = "preview";
    await loadDashboard();
  });
