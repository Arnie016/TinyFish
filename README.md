# TinyFish Radar MVP

Radar is a hackathon-ready MCP app that turns public workflows into reusable Codex skills, then shows the result through a live control surface.

This repo ships three things:

- a Radar MCP server with the core compiler tools from the brief
- a single-file widget UI that can render inside a host or in a normal browser preview
- shared contracts and seeded demo data so the flow is believable before TinyFish is fully wired in

## Why this shape

The scaffold follows the Radar brief directly:

- public source discovery before live browsing
- cheap parse first, TinyFish only for dynamic or judge-visible pages
- retrieval before generation
- compile into a versioned skill plus a surface
- keep a visible patch loop and eval gate

## Tool surface

Data tools:

- `discover_sources`
- `scan_sources`
- `extract_workflow`
- `find_similar_skills`
- `compile_skill`
- `patch_skill`
- `list_skills`
- `skill_usage_stats`

Render tools:

- `render_registry_dashboard`
- `render_skill_card`
- `render_run_result`

## Local development

```bash
npm install
npm run dev
```

Then open:

- preview UI: `http://localhost:3001/`
- health: `http://localhost:3001/health`
- MCP endpoint: `http://localhost:3001/mcp`

For a stdio-only MCP run:

```bash
npm run start:stdio
```

## Project structure

- `main.ts`: HTTP + stdio entrypoint, plus browser preview endpoints
- `server.ts`: MCP server registration and tool wiring
- `src/server/radar-engine.ts`: compiler heuristics and render payload builders
- `src/shared/contracts.ts`: shared Zod contracts and payload types
- `src/shared/seed.ts`: seeded sources, skills, evals, and surface presets
- `src/mcp-app.ts`: widget UI using the MCP Apps bridge

## Notes

This is intentionally a polished v1 scaffold, not the final extractor. TinyFish is represented in the decision layer and browser policy so the demo story is clear now, and the live extraction path can be swapped in next without changing the whole surface.

## Docs used

- [OpenAI Apps SDK quickstart](https://developers.openai.com/apps-sdk/quickstart)
- [OpenAI Apps SDK: build an MCP server](https://developers.openai.com/apps-sdk/build/mcp-server)
- [OpenAI Apps SDK examples](https://developers.openai.com/apps-sdk/build/examples)
- [MCP Apps basic vanilla starter pattern](https://github.com/modelcontextprotocol/ext-apps/tree/main/examples/basic-server-vanillajs)
