import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import cors from "cors";
import type { Request, Response } from "express";
import fs from "node:fs/promises";
import path from "node:path";
import { createServer } from "./server.js";
import { compileSkill, extractWorkflow, patchSkill, renderPreviewPayload } from "./src/server/radar-engine.js";

const distDir = import.meta.filename.endsWith(".ts")
  ? path.join(import.meta.dirname, "dist")
  : import.meta.dirname;

async function readWidgetHtml(): Promise<string> {
  return fs.readFile(path.join(distDir, "mcp-app.html"), "utf-8");
}

function firstString(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

export async function startStreamableHTTPServer(createServerFactory: () => McpServer): Promise<void> {
  const port = Number.parseInt(process.env.PORT ?? "3001", 10);

  const app = createMcpExpressApp({ host: "0.0.0.0" });
  app.use(cors());

  app.get("/", async (_req: Request, res: Response) => {
    try {
      res.type("html").send(await readWidgetHtml());
    } catch (error) {
      res.status(503).send(`Widget bundle missing. Run "npm run build" first.\n${String(error)}`);
    }
  });

  app.get("/health", (_req: Request, res: Response) => {
    res.json({ status: "ok" });
  });

  app.get("/preview-data/dashboard", (req: Request, res: Response) => {
    res.json(renderPreviewPayload("dashboard", { category: firstString(req.query.category as string | string[] | undefined) }));
  });

  app.get("/preview-data/skill/:skillId", (req: Request, res: Response) => {
    res.json(renderPreviewPayload("skill", { skillId: firstString(req.params.skillId as string | string[] | undefined) }));
  });

  app.get("/preview-data/run", (req: Request, res: Response) => {
    res.json(
      renderPreviewPayload("run", {
        query: firstString(req.query.query as string | string[] | undefined) ?? "Compile a public docs workflow into a widget-ready skill.",
        skillId: firstString(req.query.skillId as string | string[] | undefined),
      }),
    );
  });

  app.get("/preview-data/compile", (req: Request, res: Response) => {
    const title = firstString(req.query.title as string | string[] | undefined) ?? "Radar Docs Compiler";
    const workflowSpec = extractWorkflow({
      title,
      sourceUrls: [
        "https://developers.openai.com/apps-sdk/quickstart",
        "https://github.com/modelcontextprotocol/ext-apps",
      ],
      desiredSurface: "widget",
    });

    res.json(compileSkill({ workflowSpec }));
  });

  app.get("/preview-data/patch/:skillId", (req: Request, res: Response) => {
    res.json(
      patchSkill({
        skillId: firstString(req.params.skillId as string | string[] | undefined) ?? "radar-browser-lens",
        reason: "Public docs example moved and the render surface needs a small selector update.",
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
    console.log(`Radar preview listening on http://localhost:${port}`);
    console.log(`Radar MCP endpoint listening on http://localhost:${port}/mcp`);
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
