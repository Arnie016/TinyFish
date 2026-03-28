import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import cors from "cors";
import express from "express";
import type { Request, Response } from "express";
import fs from "node:fs/promises";
import path from "node:path";
import { createServer } from "./server.js";
import { defaultGoal } from "./src/shared/seed.js";
import { blenderBridgeConfigured } from "./src/server/blender-bridge.js";
import {
  applySceneToBlender,
  chatWithScene,
  renderSceneGraph,
  repairSceneRun,
  runCheckpointLoop,
  startSceneResearch,
  validateSceneGraph,
} from "./src/server/radar-engine.js";

const distDir = import.meta.filename.endsWith(".ts")
  ? path.join(import.meta.dirname, "dist")
  : import.meta.dirname;

async function readWidgetHtml(): Promise<string> {
  return fs.readFile(path.join(distDir, "mcp-app.html"), "utf-8");
}

function firstString(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function jsonBody<T extends Record<string, unknown>>(req: Request): T {
  return (req.body ?? {}) as T;
}

export async function startStreamableHTTPServer(createServerFactory: () => McpServer): Promise<void> {
  const port = Number.parseInt(process.env.PORT ?? "3001", 10);

  const app = createMcpExpressApp({ host: "0.0.0.0" });
  app.use(cors());
  app.use(express.json());

  app.get("/", async (_req: Request, res: Response) => {
    try {
      res.type("html").send(await readWidgetHtml());
    } catch (error) {
      res.status(503).send(`Widget bundle missing. Run "npm run build" first.\n${String(error)}`);
    }
  });

  app.get("/health", (_req: Request, res: Response) => {
    res.json({
      status: "ok",
      tinyfishConfigured: Boolean(process.env.TINYFISH_API_KEY),
      blenderBridgeConfigured: blenderBridgeConfigured(),
    });
  });

  app.get("/preview-data/orchestrator", (req: Request, res: Response) => {
    res.json(renderSceneGraph(firstString(req.query.sceneId as string | string[] | undefined)));
  });

  app.post("/api/scene/start", (req: Request, res: Response) => {
    const body = jsonBody<{ goal?: string; sourceUrl?: string; browserProfile?: "lite" | "stealth" }>(req);
    res.json(
      startSceneResearch({
        goal: body.goal ?? defaultGoal,
        sourceUrl: body.sourceUrl,
        browserProfile: body.browserProfile,
      }),
    );
  });

  app.get("/api/scene/:sceneId", (req: Request, res: Response) => {
    res.json(renderSceneGraph(firstString(req.params.sceneId as string | string[] | undefined)));
  });

  app.post("/api/scene/:sceneId/validate", (req: Request, res: Response) => {
    res.json(validateSceneGraph({ sceneId: firstString(req.params.sceneId as string | string[] | undefined) ?? "" }));
  });

  app.post("/api/scene/:sceneId/loop", (req: Request, res: Response) => {
    res.json(runCheckpointLoop({ sceneId: firstString(req.params.sceneId as string | string[] | undefined) ?? "" }));
  });

  app.post("/api/scene/:sceneId/blender", (req: Request, res: Response) => {
    const body = jsonBody<{ replayFailedOnly?: boolean }>(req);
    res.json(
      applySceneToBlender({
        sceneId: firstString(req.params.sceneId as string | string[] | undefined) ?? "",
        replayFailedOnly: body.replayFailedOnly,
      }),
    );
  });

  app.post("/api/scene/:sceneId/repair", (req: Request, res: Response) => {
    const body = jsonBody<{ instruction?: string; targetNodeIds?: string[]; preferStealth?: boolean }>(req);
    res.json(
      repairSceneRun({
        sceneId: firstString(req.params.sceneId as string | string[] | undefined) ?? "",
        instruction: body.instruction,
        targetNodeIds: body.targetNodeIds,
        preferStealth: body.preferStealth,
      }),
    );
  });

  app.post("/api/scene/:sceneId/chat", async (req: Request, res: Response) => {
    const body = jsonBody<{ message?: string }>(req);
    res.json(
      await chatWithScene({
        sceneId: firstString(req.params.sceneId as string | string[] | undefined) ?? "",
        message: body.message ?? "",
      }),
    );
  });

  app.all("/mcp", async (req: Request, res: Response) => {
    const server = createServerFactory();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });

    res.on("close", () => {
      transport.close().catch(() => {});
      server.close().catch(() => {});
    });

    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      console.error("MCP error:", error);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: { code: -32603, message: "Internal server error" },
          id: null,
        });
      }
    }
  });

  const httpServer = app.listen(port, (err?: Error) => {
    if (err) {
      console.error("Failed to start server:", err);
      process.exit(1);
    }
    console.log(`Codex scene preview listening on http://localhost:${port}`);
    console.log(`MCP endpoint listening on http://localhost:${port}/mcp`);
  });

  const shutdown = () => {
    console.log("\nShutting down...");
    httpServer.close(() => process.exit(0));
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

export async function startStdioServer(createServerFactory: () => McpServer): Promise<void> {
  await createServerFactory().connect(new StdioServerTransport());
}

async function main() {
  if (process.argv.includes("--stdio")) {
    await startStdioServer(createServer);
    return;
  }

  await startStreamableHTTPServer(createServer);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
