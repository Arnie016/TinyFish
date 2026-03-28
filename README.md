# FrameCrawler

**Web-to-Previs Copilot for 3D Artists**

We delete the dead time between web research and the first editable frame.

Enter a film-art topic → TinyFish scrapes public references live → validator emits SceneSpec → Blender builds the blockout with cameras, lights, and notes → change one instruction → watch the scene update.

## Quick Start

### React Dashboard
```bash
cd apps/framecrawler-ui
npm install
npm run dev          # http://localhost:5174
```
Press `1`-`8` to step through demo phases, `B` to push to Blender, `A` for auto-run, `0` to reset.

### Blender Addon
1. Open Blender (4.0+)
2. Edit → Preferences → Add-ons → Install → select `blender/framecrawler_addon/`
3. Enable "FrameCrawler" addon
4. In 3D Viewport sidebar (N), open the "FrameCrawler" tab
5. Set the JSON path to `blender/scene_spec.json`
6. Click "Start Watching" for live updates

### Standalone Blender Script
```bash
blender --python blender/scene_builder.py -- blender/scene_spec.json
```

## Architecture

```
TinyFish MCP (/run-sse)  →  SceneSpec JSON  →  Blender Addon (file watcher)
                                  ↑                     ↓
                          React Dashboard       Graybox 3D Scene
                          (R3F preview)     (objects, lights, camera, notes)
```

## Tech Stack

- **React 19** + Vite + Tailwind + Framer Motion + Zustand (dashboard)
- **React Three Fiber** + drei (3D preview)
- **Blender 4.0+** Python API (scene building)
- **TinyFish** MCP (web research)
