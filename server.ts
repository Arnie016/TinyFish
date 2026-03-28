import { registerAppResource, registerAppTool, RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult, ReadResourceResult } from "@modelcontextprotocol/sdk/types.js";
import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { browserModeSchema, sceneGroundingSchema, sceneSessionSchema } from "./src/shared/contracts.js";
import {
  applySceneToBlender,
  chatWithScene,
  renderSceneGraph,
  repairSceneRun,
  runCheckpointLoop,
  startSceneResearch,
  validateSceneGraph,
} from "./src/server/radar-engine.js";
import { executeBlenderCode, getViewportScreenshot, readBlenderSceneGrounding } from "./src/server/blender-bridge.js";

const distDir = import.meta.filename.endsWith(".ts")
  ? path.join(import.meta.dirname, "dist")
  : import.meta.dirname;
const resourceUri = "ui://codex/scene-orchestrator.html";

function narrate(summary: string): CallToolResult["content"] {
  return [{ type: "text", text: summary }];
}

async function readWidgetHtml(): Promise<string> {
  return fs.readFile(path.join(distDir, "mcp-app.html"), "utf-8");
}

function withUi<T extends Record<string, unknown>>(summary: string, payload: T): CallToolResult {
  return {
    content: narrate(summary),
    structuredContent: payload,
  };
}

export function createServer(): McpServer {
  const server = new McpServer({
    name: "Codex Scene Orchestrator",
    version: "0.2.0",
  });

  registerAppTool(
    server,
    "start_scene_research",
    {
      title: "Start scene research",
      description: "Use this when you want Codex to launch a TinyFish-guided research pass and begin filling the live scene graph.",
      inputSchema: {
        goal: z.string().min(12),
        sourceUrl: z.url().optional(),
        browserProfile: z.enum(["lite", "stealth"]).optional(),
      },
      outputSchema: sceneSessionSchema,
      _meta: {
        ui: { resourceUri },
      },
    },
    async ({ goal, sourceUrl, browserProfile }): Promise<CallToolResult> => {
      const result = startSceneResearch({
        goal,
        sourceUrl,
        browserProfile: browserModeSchema.parse(browserProfile ?? "lite") as "lite" | "stealth",
      });
      return withUi("Scene research started.", result);
    },
  );

  registerAppTool(
    server,
    "render_scene_graph",
    {
      title: "Render scene graph",
      description: "Use this when you want the widget to render the current Codex-native orchestration graph and inspector state.",
      inputSchema: {
        sceneId: z.string().optional(),
      },
      outputSchema: sceneSessionSchema,
      _meta: {
        ui: { resourceUri },
      },
    },
    async ({ sceneId }): Promise<CallToolResult> => withUi("Scene graph rendered.", renderSceneGraph(sceneId)),
  );

  registerAppTool(
    server,
    "run_checkpoint_loop",
    {
      title: "Run checkpoint loop",
      description: "Use this when you want Codex to validate, auto-repair, and replay Blender actions through the checkpoint loop for the current scene.",
      inputSchema: {
        sceneId: z.string(),
      },
      outputSchema: sceneSessionSchema,
      _meta: {
        ui: { resourceUri },
      },
    },
    async ({ sceneId }): Promise<CallToolResult> => withUi("Checkpoint loop started.", runCheckpointLoop({ sceneId })),
  );

  registerAppTool(
    server,
    "validate_scene_graph",
    {
      title: "Validate scene graph",
      description: "Use this when you want Codex to verify citations, ambiguity, duplicates, and Blender readiness for the current scene graph.",
      inputSchema: {
        sceneId: z.string(),
      },
      outputSchema: sceneSessionSchema,
      _meta: {
        ui: { resourceUri },
      },
    },
    async ({ sceneId }): Promise<CallToolResult> => withUi("Scene validation updated.", validateSceneGraph({ sceneId })),
  );

  registerAppTool(
    server,
    "apply_scene_to_blender",
    {
      title: "Apply scene to Blender",
      description: "Use this when you want Codex to send the current command plan to Blender or prepare the fallback export path.",
      inputSchema: {
        sceneId: z.string(),
        replayFailedOnly: z.boolean().optional(),
      },
      outputSchema: sceneSessionSchema,
      _meta: {
        ui: { resourceUri },
      },
    },
    async ({ sceneId, replayFailedOnly }): Promise<CallToolResult> =>
      withUi("Blender apply started.", applySceneToBlender({ sceneId, replayFailedOnly })),
  );

  registerAppTool(
    server,
    "repair_scene_run",
    {
      title: "Repair scene run",
      description: "Use this when you want Codex to tighten the scene graph, re-normalize uncertainty, or replay a better TinyFish strategy.",
      inputSchema: {
        sceneId: z.string(),
        instruction: z.string().optional(),
        targetNodeIds: z.array(z.string()).optional(),
        preferStealth: z.boolean().optional(),
      },
      outputSchema: sceneSessionSchema,
      _meta: {
        ui: { resourceUri },
      },
    },
    async ({ sceneId, instruction, targetNodeIds, preferStealth }): Promise<CallToolResult> =>
      withUi(
        "Repair pass started.",
        repairSceneRun({ sceneId, instruction, targetNodeIds, preferStealth }),
      ),
  );

  registerAppTool(
    server,
    "chat_with_scene",
    {
      title: "Chat with scene",
      description: "Use this when you want Codex to answer questions about the current Blender scene, workflow skills, validation state, or next move from inside the orchestrator.",
      inputSchema: {
        sceneId: z.string(),
        message: z.string().min(1),
      },
      outputSchema: sceneSessionSchema,
      _meta: {
        ui: { resourceUri },
      },
    },
    async ({ sceneId, message }): Promise<CallToolResult> =>
      withUi("Scene chat updated.", await chatWithScene({ sceneId, message })),
  );

  registerAppTool(
    server,
    "get_scene_info",
    {
      title: "Get scene info",
      description: "Use this when you want the current Blender scene grounding directly from the live bridge.",
      inputSchema: {},
      outputSchema: sceneGroundingSchema.nullable(),
      _meta: {},
    },
    async (): Promise<CallToolResult> => {
      const result = await readBlenderSceneGrounding();
      return {
        content: narrate(result ? `Read Blender scene ${result.scene_name}.` : "Blender scene grounding is unavailable."),
        structuredContent: (result ?? undefined) as Record<string, unknown> | undefined,
      };
    },
  );

  registerAppTool(
    server,
    "execute_blender_code",
    {
      title: "Execute Blender code",
      description: "Use this when you need to send a direct Python snippet to Blender through the MCP bridge.",
      inputSchema: {
        code: z.string().min(1),
      },
      outputSchema: z.object({
        ok: z.boolean(),
        result: z.unknown().optional(),
      }),
      _meta: {},
    },
    async ({ code }): Promise<CallToolResult> => {
      const result = await executeBlenderCode(code);
      return {
        content: narrate("Executed Blender code through the live bridge."),
        structuredContent: { ok: true, result },
      };
    },
  );

  registerAppTool(
    server,
    "get_viewport_screenshot",
    {
      title: "Get viewport screenshot",
      description: "Use this when you want a current viewport image from Blender for grounding or verification.",
      inputSchema: {
        maxSize: z.number().int().min(256).max(2048).optional(),
      },
      outputSchema: z.object({
        image: z.string().nullable(),
      }),
      _meta: {},
    },
    async ({ maxSize }): Promise<CallToolResult> => {
      const image = await getViewportScreenshot(maxSize ?? 1200);
      return {
        content: narrate(image ? "Fetched Blender viewport screenshot." : "Viewport screenshot is unavailable."),
        structuredContent: { image },
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
            connectDomains: [process.env.TINYFISH_API_BASE ?? "https://agent.tinyfish.ai"],
            resourceDomains: ["https://docs.tinyfish.ai", "https://docs.blender.org"],
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
