import { registerAppResource, registerAppTool, RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult, ReadResourceResult } from "@modelcontextprotocol/sdk/types.js";
import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { browserModeSchema, compilerDecisionSchema, patchJobSchema, skillRecordSchema, sourceCandidateSchema, sourceKindSchema, surfaceTypeSchema, usageStatsSchema, workflowSpecSchema } from "./src/shared/contracts.js";
import { compileSkill, discoverSources, extractWorkflow, findSimilarSkills, listSkills, patchSkill, renderRegistryDashboard, renderRunResult, renderSkillCard, scanSources, skillUsageStats } from "./src/server/radar-engine.js";

const distDir = import.meta.filename.endsWith(".ts")
  ? path.join(import.meta.dirname, "dist")
  : import.meta.dirname;
const resourceUri = "ui://radar/control-surface.html";

function narrate(summary: string): CallToolResult["content"] {
  return [{ type: "text", text: summary }];
}

async function readWidgetHtml(): Promise<string> {
  return fs.readFile(path.join(distDir, "mcp-app.html"), "utf-8");
}

export function createServer(): McpServer {
  const server = new McpServer({
    name: "Radar MCP Server",
    version: "0.1.0",
  });

  registerAppTool(
    server,
    "discover_sources",
    {
      title: "Discover sources",
      description: "Use this when you need the best public source shortlist before extracting a workflow.",
      _meta: {},
      inputSchema: {
        topic: z.string().min(3),
        sourceKinds: z.array(sourceKindSchema).optional(),
        preferLiveBrowser: z.boolean().optional(),
      },
      outputSchema: z.object({
        sources: z.array(sourceCandidateSchema),
        escalatedToTinyFish: z.boolean(),
        rationale: z.string(),
      }),
    },
    async ({ topic, sourceKinds, preferLiveBrowser }): Promise<CallToolResult> => {
      const result = discoverSources({ topic, sourceKinds, preferLiveBrowser });
      return {
        content: narrate(`Discovered ${result.sources.length} public sources for "${topic}".`),
        structuredContent: result,
      };
    },
  );

  registerAppTool(
    server,
    "scan_sources",
    {
      title: "Scan sources",
      description: "Use this when you need to decide whether each public page can stay on fetch or should escalate to TinyFish.",
      _meta: {},
      inputSchema: {
        sourceUrls: z.array(z.url()).min(1),
      },
      outputSchema: z.object({
        scans: z.array(
          z.object({
            url: z.url(),
            source_kind: sourceKindSchema,
            recommended_path: z.enum(["fetch", "tinyfish"]),
            browser_mode: browserModeSchema,
            blocked: z.boolean(),
            note: z.string(),
          }),
        ),
        blocked: z.boolean(),
        next_step: z.string(),
      }),
    },
    async ({ sourceUrls }): Promise<CallToolResult> => {
      const result = scanSources(sourceUrls);
      return {
        content: narrate(result.next_step),
        structuredContent: result,
      };
    },
  );

  registerAppTool(
    server,
    "extract_workflow",
    {
      title: "Extract workflow",
      description: "Use this when you want a normalized workflow spec from public evidence and a target surface.",
      _meta: {},
      inputSchema: {
        title: z.string().min(3),
        description: z.string().optional(),
        sourceUrls: z.array(z.url()).min(1),
        desiredSurface: surfaceTypeSchema.optional(),
      },
      outputSchema: workflowSpecSchema,
    },
    async ({ title, description, sourceUrls, desiredSurface }): Promise<CallToolResult> => {
      const result = extractWorkflow({ title, description, sourceUrls, desiredSurface });
      return {
        content: narrate(`Extracted workflow "${result.title}" with ${result.steps.length} compiler steps.`),
        structuredContent: result,
      };
    },
  );

  registerAppTool(
    server,
    "find_similar_skills",
    {
      title: "Find similar skills",
      description: "Use this when you want retrieval before generation and need the best reuse, fork, or compose candidates.",
      _meta: {},
      inputSchema: {
        category: z.string().optional(),
        tags: z.array(z.string()).optional(),
        workflowTitle: z.string().optional(),
      },
      outputSchema: z.object({
        nearest_skills: z.array(
          z.object({
            skill_id: z.string(),
            score: z.number(),
          }),
        ),
        recommended_decision: z.enum(["reuse", "fork", "compose", "create"]),
      }),
    },
    async ({ category, tags, workflowTitle }): Promise<CallToolResult> => {
      const result = findSimilarSkills({ category, tags, workflowTitle });
      return {
        content: narrate(`Top match: ${result.nearest_skills[0]?.skill_id ?? "none yet"}.`),
        structuredContent: result,
      };
    },
  );

  registerAppTool(
    server,
    "compile_skill",
    {
      title: "Compile skill",
      description: "Use this when you already have a workflow spec and want Radar to pick the best compile strategy and surface it.",
      inputSchema: {
        workflowSpec: workflowSpecSchema,
        preferredStrategy: z.enum(["reuse", "fork", "compose", "create"]).optional(),
      },
      outputSchema: z.object({
        view: z.literal("run"),
        title: z.string(),
        subtitle: z.string(),
        outcome: z.object({
          verdict: z.string(),
          rationale: z.array(z.string()),
          next_step: z.string(),
        }),
        citations: z.array(z.object({ label: z.string(), url: z.url() })),
        decision: compilerDecisionSchema,
        skill: skillRecordSchema,
        generated_files: z.array(z.string()),
      }),
      _meta: {
        ui: { resourceUri },
      },
    },
    async ({ workflowSpec, preferredStrategy }): Promise<CallToolResult> => {
      const result = compileSkill({ workflowSpec, preferredStrategy });
      return {
        content: narrate(result.outcome.verdict),
        structuredContent: result,
      };
    },
  );

  registerAppTool(
    server,
    "patch_skill",
    {
      title: "Patch skill",
      description: "Use this when a watched source drifts and you want an eval-gated patch proposal instead of silent mutation.",
      inputSchema: {
        skillId: z.string().min(2),
        reason: z.string().min(5),
        changedSources: z.array(z.url()).optional(),
      },
      outputSchema: z.object({
        view: z.literal("run"),
        title: z.string(),
        subtitle: z.string(),
        outcome: z.object({
          verdict: z.string(),
          rationale: z.array(z.string()),
          next_step: z.string(),
        }),
        citations: z.array(z.object({ label: z.string(), url: z.url() })),
        patch: patchJobSchema,
      }),
      _meta: {
        ui: { resourceUri },
      },
    },
    async ({ skillId, reason, changedSources }): Promise<CallToolResult> => {
      const result = patchSkill({ skillId, reason, changedSources });
      return {
        content: narrate(result.outcome.verdict),
        structuredContent: result,
      };
    },
  );

  registerAppTool(
    server,
    "list_skills",
    {
      title: "List skills",
      description: "Use this when you want the current Radar catalog filtered by category, tag, or status.",
      _meta: {},
      inputSchema: {
        category: z.string().optional(),
        tag: z.string().optional(),
        status: z.enum(["active", "draft", "paused"]).optional(),
      },
      outputSchema: z.object({
        skills: z.array(skillRecordSchema),
      }),
    },
    async ({ category, tag, status }): Promise<CallToolResult> => {
      const result = listSkills({ category, tag, status });
      return {
        content: narrate(`Listed ${result.skills.length} skills from the registry.`),
        structuredContent: result,
      };
    },
  );

  registerAppTool(
    server,
    "skill_usage_stats",
    {
      title: "Skill usage stats",
      description: "Use this when you need the top-line metrics that make the skill bank feel alive.",
      _meta: {},
      inputSchema: {},
      outputSchema: usageStatsSchema,
    },
    async (): Promise<CallToolResult> => {
      const result = skillUsageStats();
      return {
        content: narrate(`Radar is tracking ${result.total_skills} seeded skills and ${result.total_runs} cumulative runs.`),
        structuredContent: result,
      };
    },
  );

  registerAppTool(
    server,
    "render_registry_dashboard",
    {
      title: "Render registry dashboard",
      description: "Use this when you want the Radar widget to show the live skill genome and compiler loop in one place.",
      inputSchema: {
        focusCategory: z.string().optional(),
      },
      outputSchema: z.object({
        view: z.literal("dashboard"),
        title: z.string(),
        subtitle: z.string(),
        stats: z.array(
          z.object({
            label: z.string(),
            value: z.string(),
            detail: z.string(),
          }),
        ),
        pipeline: z.array(z.object({ label: z.string(), detail: z.string() })),
        skills: z.array(skillRecordSchema),
        watchlist: z.array(z.object({ title: z.string(), status: z.string(), detail: z.string() })),
        quick_actions: z.array(z.string()),
      }),
      _meta: {
        ui: { resourceUri },
      },
    },
    async ({ focusCategory }): Promise<CallToolResult> => {
      const result = renderRegistryDashboard(focusCategory);
      return {
        content: narrate("Rendered the Radar dashboard."),
        structuredContent: result,
      };
    },
  );

  registerAppTool(
    server,
    "render_skill_card",
    {
      title: "Render skill card",
      description: "Use this when you want the widget to focus on one skill's evidence, evals, and quick actions.",
      inputSchema: {
        skillId: z.string().optional(),
      },
      outputSchema: z.object({
        view: z.literal("skill"),
        title: z.string(),
        subtitle: z.string(),
        skill: skillRecordSchema,
        sources: z.array(z.object({ url: z.url(), note: z.string() })),
        evals: z.array(
          z.object({
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
          }),
        ),
        quick_actions: z.array(z.string()),
      }),
      _meta: {
        ui: { resourceUri },
      },
    },
    async ({ skillId }): Promise<CallToolResult> => {
      const result = renderSkillCard(skillId);
      return {
        content: narrate(`Rendered ${result.skill.name}.`),
        structuredContent: result,
      };
    },
  );

  registerAppTool(
    server,
    "render_run_result",
    {
      title: "Render run result",
      description: "Use this when you want the widget to show a routed answer, the evidence behind it, and the next compiler move.",
      inputSchema: {
        query: z.string().min(3),
        skillId: z.string().optional(),
      },
      outputSchema: z.object({
        view: z.literal("run"),
        title: z.string(),
        subtitle: z.string(),
        outcome: z.object({
          verdict: z.string(),
          rationale: z.array(z.string()),
          next_step: z.string(),
        }),
        citations: z.array(z.object({ label: z.string(), url: z.url() })),
      }),
      _meta: {
        ui: { resourceUri },
      },
    },
    async ({ query, skillId }): Promise<CallToolResult> => {
      const result = renderRunResult(query, skillId);
      return {
        content: narrate(result.outcome.verdict),
        structuredContent: result,
      };
    },
  );

  registerAppResource(
    server,
    resourceUri,
    resourceUri,
    {
      mimeType: RESOURCE_MIME_TYPE,
      _meta: {
        ui: {
          prefersBorder: false,
          csp: {
            connectDomains: [],
            resourceDomains: [],
          },
        },
      },
    },
    async (): Promise<ReadResourceResult> => {
      const html = await readWidgetHtml();

      return {
        contents: [
          {
            uri: resourceUri,
            mimeType: RESOURCE_MIME_TYPE,
            text: html,
          },
        ],
      };
    },
  );

  return server;
}
