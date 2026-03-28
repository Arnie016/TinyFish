# FrameCrawler — Implementation Plan

## Pitch

**"We delete the dead time between web research and the first editable frame."**

Enter a film-art topic → TinyFish scrapes public references live → validator emits SceneSpec → Blender builds the blockout with cameras, lights, and notes → change one mood or shot instruction → watch the scene update.

---

## Architecture

```
Claude Code / ChatGPT (orchestrator)
  ├── TinyFish MCP (web research)       ← already exists, compose with it
  │   ├── /run-sse (live demo: STARTED → STREAMING_URL → PROGRESS → COMPLETE)
  │   ├── /run-async (batch research across several pages)
  │   └── Structured output schema for scene metadata
  │
  └── FrameCrawler MCP (what we build)  ← scene planning + Blender bridge
      ├── validate_scene_spec
      ├── push_to_blender
      ├── update_scene
      └── get_scene_status
```

**Key principle:** We compose TinyFish MCP with our own MCP — we never wrap TinyFish.

---

## Data Flow

```
User prompt ("cyberpunk alleyway at night")
  ↓
TinyFish /run-sse → visits 5-10 pages → extracts structured scene metadata
  ↓
SceneSpec JSON (objects, lights, camera, mood, citations with source URLs)
  ↓
Validator (checks schema, confidence scores, source attribution)
  ↓
Blender Addon (file watcher reads scene_spec.json, builds graybox scene)
  ↓
React Dashboard (shows pipeline progress, R3F preview, Blender connection status)
```

---

## SceneSpec JSON Schema

```json
{
  "project_title": "Cyberpunk Alleyway",
  "topic": "cyberpunk alleyway at night",
  "scene_goal": "Moody, neon-lit back alley for a cinematic establishing shot",
  "style_keywords": ["cyberpunk", "noir", "neon"],
  "environment": { "location_type": "", "time_of_day": "", "weather": "", "mood": "", "scale": "" },
  "objects": [{
    "id": "", "name": "", "category": "prop|setpiece|character|vehicle|fx",
    "description": "", "material": "", "color": "#hex",
    "position": [x, y, z], "scale": [x, y, z], "geometry": "box|sphere|cylinder",
    "importance": 1-5, "source_url": "", "confidence": 0.0-1.0
  }],
  "camera": { "shot_type": "", "lens_feel": "", "framing_notes": "", "path": [[x,y,z], ...] },
  "lighting": {
    "key_light": "", "fill_light": "", "rim_light": "", "practicals": [],
    "lights": [{ "id": "", "type": "key|fill|rim|practical", "label": "", "color": "#hex", "intensity": 0.0, "position": [x,y,z] }]
  },
  "color_palette": ["#hex", ...],
  "mood_keywords": ["noir", "neon-soaked", ...],
  "citations": [{ "url": "", "snippet": "" }]
}
```

---

## TinyFish Integration

**For the judge demo**, use `/run-sse` so the audience sees:
- `STARTED` — browser launching
- `STREAMING_URL` — live browser preview link
- `PROGRESS` — page navigation, extraction steps
- `COMPLETE` — final structured output

**TinyFish prompt** (define exact output schema as docs recommend):
```
You are a research agent gathering scene-relevant information for a Blender previs workflow.
Task: Research "{USER_TOPIC}". Visit provided URLs and linked pages (up to 10).
Extract only: environment, objects, materials, color palette, lighting cues, camera ideas, spatial relationships, source URLs.
Return strict JSON matching the SceneSpec schema. No markdown.
Rules: be conservative, every claim needs source_url, lower confidence if uncertain.
```

**For batch research**, use `/run-async` with structured error handling and stop conditions.

---

## Components

### Blender Side (`/blender/`)
- `scene_builder.py` — Core: reads SceneSpec JSON, builds objects/lights/camera/annotations in Blender
- `framecrawler_addon/` — Blender addon: sidebar panel, file watcher (0.5s poll), load/clear/watch operators
- `scene_spec.json` — Written by React UI, read by Blender addon

### React Dashboard (`/apps/framecrawler-ui/`)
- 3-column layout: Research | 3D Preview | Scene Breakdown
- R3F viewport as real-time preview (mirrors what Blender builds)
- TinyFish SSE event stream display
- "Push to Blender" button (writes SceneSpec via Vite server plugin → disk)
- Keyboard-driven demo: 1-8 phases, B=push to Blender, A=auto, 0=reset

### Bridge (Vite Plugin)
- `POST /api/push-scene` — writes SceneSpec JSON to `blender/scene_spec.json`
- Blender addon watches file mtime → auto-rebuilds on change

---

## Demo Script (3 minutes)

| Time | Action | What audience sees |
|------|--------|-------------------|
| 0:00-0:10 | Title card | "FrameCrawler: Web-to-Previs Copilot" |
| 0:10-0:20 | Enter topic | Prompt bar types "cyberpunk alleyway at night" |
| 0:20-0:50 | TinyFish researches | Browser mockup shows SSE events, pages visited |
| 0:50-1:10 | Sources extracted | Cards cascade in with thumbnails, confidence bars |
| 1:10-1:30 | Scene planned | Object list, lighting breakdown, mood palette populate |
| 1:30-2:00 | Build scene | **HERO**: objects appear in R3F preview AND Blender simultaneously |
| 2:00-2:20 | Add lighting | Scene transforms from gray to neon-lit in both views |
| 2:20-2:40 | Camera path | Camera dollies through alley |
| 2:40-2:55 | **Edit & update** | Change mood → push again → Blender updates |
| 2:55-3:00 | Close | Stats: 14 objects, 5 lights, 5 citations, 89% confidence |

---

## Build Order

1. **Blender scene builder** (Python) — core value
2. **Blender addon** (panel + file watcher) — live connection
3. **React dashboard** with R3F preview — visual polish
4. **Vite bridge plugin** — React ↔ Blender file bridge
5. **TinyFish integration** — real API calls with SSE
6. **Edit & update flow** — the killer demo moment
