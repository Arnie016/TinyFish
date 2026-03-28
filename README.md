# TinyFish Web-to-Previs

TinyFish is a Codex-native web-to-previs copilot for 3D artists.

It reads the current Blender scene first, runs TinyFish on live public references, normalizes the result into a strict `SceneSpec`, validates the plan, and then builds an editable Blender graybox with cameras, lights, placeholders, and notes.

## Core Flow

1. `Scene Grounder`
   Read the live Blender scene before research: scene name, frame range, active object, visible objects, cameras, and lights.
2. `ReferenceScout`
   Run TinyFish against public sources and extract only scene-relevant cues.
3. `SceneSpec Validator`
   Deduplicate objects, normalize materials and placement hints, and keep uncertainty inside notes instead of hallucinating final art.
4. `Blender Executor`
   Create deterministic collections, placeholder geometry, cameras, lights, and provenance notes inside Blender.

## Product Framing

TinyFish deletes the dead time between web research and the first editable frame.

The pitch is not “AI makes a whole movie.”
The pitch is “web research becomes an editable Blender previs scene.”

## What The App Shows

- Live Blender grounding before any crawl begins
- TinyFish event stream and live browser status
- The normalized `SceneSpec`
- Validation issues and repair loop
- Blender action plan and live apply status

## Blender Bridge Modes

The app supports two Blender bridge paths:

- `tcp://127.0.0.1:9876` by default for the current Blender addon socket server
- `BLENDER_MCP_ENDPOINT=http(s)://...` for an external HTTP bridge

The raw socket path is the important one for local demo work. It talks directly to the Blender addon, reads the active scene, and sends Python execution plans back through `execute_code`.

## Local Development

```bash
npm install
npm run dev
```

Open:

- preview UI: `http://localhost:3001/`
- health: `http://localhost:3001/health`
- MCP endpoint: `http://localhost:3001/mcp`

For stdio-only MCP:

```bash
npm run start:stdio
```

## Environment

- `TINYFISH_API_KEY`
- `TINYFISH_API_BASE` optional, defaults to `https://agent.tinyfish.ai`
- `BLENDER_MCP_SOCKET` optional, defaults to `tcp://127.0.0.1:9876`
- `BLENDER_MCP_ENDPOINT` optional HTTP bridge override
- `BLENDER_MCP_TOKEN` optional bearer token for HTTP bridge mode

## Repo Shape

- `src/server/tinyfish-client.ts`: TinyFish SSE client
- `src/server/blender-bridge.ts`: live Blender grounding + apply bridge
- `src/server/radar-engine.ts`: orchestration loop from research to Blender
- `src/shared/contracts.ts`: `SceneSpec`, grounding, graph, validation, and action contracts
- `src/mcp-app.ts`: single-file operator surface

## Demo Story

1. Start with a live Blender scene.
2. Ground the scene.
3. Launch TinyFish on a public reference source.
4. Show the extracted `SceneSpec`.
5. Apply the validated plan to Blender.
6. Replay a feedback note and update the blockout without touching final art.
