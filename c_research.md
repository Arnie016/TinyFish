# Radar Hackathon — Research & Insights

## Project State (2026-03-28)
- **Repo:** `/Users/romanyanushevskyi/Desktop/tfhack`
- **Status:** Greenfield — only the brief exists (`RADAR_hackathon_brief (1).md`)
- **No code, no git, no package.json, no configs yet**

---

## Core Concept

**Radar** is a workflow compiler: it turns messy public web workflows into versioned Codex skills, then surfaces them as usable software.

**Pipeline:** public web workflow → structured JSON spec → retrieve nearest existing skills → reuse/fork/compose/create → Codex skill → surface → usage telemetry → patch loop

---

## Architecture — Key Insight: Two MCP Servers Composed

TinyFish already provides a **native MCP server**. We don't build extraction. We compose:

```
Agent (Claude Code / ChatGPT) = orchestrator
  ├── TinyFish MCP (extraction)        ← ALREADY EXISTS
  │   ├── run_web_automation            (sync, real-time streaming)
  │   ├── run_web_automation_async      (returns run_id for polling)
  │   ├── get_run                       (fetch results by run_id)
  │   └── list_runs                     (filter/list history)
  │
  └── Radar MCP (skill lifecycle)      ← WHAT WE BUILD
      ├── find_similar_skills
      ├── compile_skill
      ├── run_skill
      ├── patch_skill
      ├── list_skills
      ├── render_registry_dashboard
      ├── render_skill_card
      └── render_run_result
```

The agent calls TinyFish to extract, then passes the result to Radar to compile. No wrappers needed.

---

## TinyFish Technical Details

### Setup
```bash
# Install CLI
npm install -g @tiny-fish/cli

# Add as MCP server to Claude Code
claude mcp add --transport http tinyfish https://agent.tinyfish.ai/mcp
```

### MCP Tool Parameters (common to all)
- `url` (required, string) — target page
- `goal` (required, string) — what to extract, supports structured JSON output requests
- `browser_profile` (optional: "lite" | "stealth")
- `proxy_config` (optional)

### Endpoints
| Endpoint | Method | Use Case | Cancellation | Progress |
|----------|--------|----------|--------------|----------|
| `/run` | Sync | Quick tasks (<30s) | No | None |
| `/run-async` | Async | Long tasks, batch | Yes | Poll via `get_run` |
| `/run-sse` | SSE stream | Real-time, user-facing | Yes | Streaming events |

### SSE Event Types
- `STARTED` — run initiated
- `STREAMING_URL` — 24hr browser observation link
- `PROGRESS` — action descriptions (navigating, clicking, extracting)
- `HEARTBEAT` — keepalive
- `COMPLETE` — final result

### Browser Profiles
| Profile | When | Notes |
|---------|------|-------|
| **lite** (default) | Standard sites | Fast, standard Chromium |
| **stealth** | Bot-protected sites | Anti-fingerprinting, can't solve reCAPTCHA, fresh start each run |
| **stealth + proxy** | Max anonymity | IP rotation added |

### Structured Extraction Pattern
Define JSON schema in the `goal` prompt:
```
Extract and return as JSON: {product_name, price, in_stock}
```
Request parseable error responses: `{success, error_type, error_message, partial_results}`

### Response Handling
Three outcomes:
1. **COMPLETED (Success)** — parse result object
2. **COMPLETED (Goal Failure)** — browser worked but extraction failed; retry with modified goal
3. **FAILED (Infrastructure)** — timeout/crash; retry with stealth mode

### Auth
- OAuth 2.1, browser-based sign-in
- Config stored in `~/.tinyfish/config.json`
- Env vars override stored config

---

## Radar MCP — Technical Design

### Tech Stack
- TypeScript + `@modelcontextprotocol/sdk` (v1.28.0) + `zod`
- `openai` npm package, `gpt-4o-mini` for skill generation
- JSON files on disk for storage (no SQLite needed for <100 skills)
- `StreamableHTTPServerTransport` on port 3001
- Also supports `StdioServerTransport` for local Claude Code piping

### Data Contracts (6 schemas)

#### 1. WorkflowSpec (input from extraction)
```json
{
  "workflow_id": "supabase-auth-nextjs-v1",
  "title": "Supabase Auth setup for Next.js",
  "description": "...",
  "category": "Documentation",
  "tags": ["auth", "supabase", "nextjs", "setup"],
  "source_urls": ["https://supabase.com/docs/guides/auth/quickstarts/nextjs"],
  "source_kind": ["docs"],
  "input_schema": [{"name": "project_name", "type": "string", "required": true, "description": "..."}],
  "output_schema": {"type": "object", "properties": {...}},
  "steps": [{"id": "s1", "action": "create", "instruction": "...", "expected_output": "..."}],
  "evidence": [{"url": "...", "snippet": "..."}],
  "surface_suggestion": "widget",
  "mcp_tools_needed": ["run_skill", "render_skill_card"],
  "confidence": 0.93
}
```

#### 2. CompilerDecision
```json
{
  "decision": "fork",
  "reason": "firebase-auth-setup covers the same auth-setup pattern but for a different provider.",
  "nearest_skills": [{"skill_id": "firebase-auth-setup", "score": 0.81}],
  "composed_from": [],
  "forked_from": "firebase-auth-setup"
}
```

#### 3. SkillRecord
```json
{
  "skill_id": "supabase-auth-setup",
  "name": "Supabase Auth Setup",
  "description": "...",
  "category": "Documentation",
  "tags": ["auth", "supabase", "nextjs", "setup"],
  "version": "0.1.0",
  "status": "active",
  "forked_from": "firebase-auth-setup",
  "composed_from": [],
  "source_urls": ["https://supabase.com/docs/guides/auth/quickstarts/nextjs"],
  "source_hashes": ["abc123"],
  "surface_type": "widget",
  "usage_count": 0,
  "last_used_at": null,
  "last_scanned_at": "2026-03-28T18:00:00Z",
  "last_patched_at": null,
  "eval_score": null
}
```

#### 4. SurfaceSpec
```json
{
  "surface_type": "widget",
  "display_name": "Supabase Auth Setup",
  "short_description": "Set up Supabase auth in Next.js",
  "icon": "supabase-auth.svg",
  "brand_color": "#7C3AED",
  "default_prompt": "Set up Supabase auth for my Next.js app",
  "quick_actions": ["Run skill", "Patch from source", "Open evidence"],
  "stats_visible": true
}
```

#### 5. EvalResult
```json
{
  "eval_id": "eval-001",
  "skill_id": "supabase-auth-setup",
  "version": "0.1.0",
  "round": "trigger",
  "prompt": "...",
  "expected_skill": "supabase-auth-setup",
  "actual_skill": "supabase-auth-setup",
  "passed": true,
  "metrics": {"trigger_correct": true, "schema_valid": true, "source_citation_present": true, "latency_ms": 2210},
  "notes": "..."
}
```

#### 6. PatchJob
```json
{
  "patch_id": "patch-001",
  "skill_id": "supabase-auth-setup",
  "previous_version": "0.1.0",
  "proposed_version": "0.1.1",
  "change_type": "patch",
  "source_changed": true,
  "changed_sources": ["https://supabase.com/docs/guides/auth/quickstarts/nextjs"],
  "summary": "Env var name changed: PUBLISHABLE_KEY → ANON_KEY",
  "auto_promote": false,
  "eval_required": true,
  "approved": false
}
```

### Similarity Search — Keyword Scorer
Two-tier approach (Tier 1 only needed for hackathon):

**Tier 1: Keyword matching (no API, zero latency)**
- Tokenize `title + description` → lowercase, remove stop words
- Tag Jaccard: `|A ∩ B| / |A ∪ B|`
- Description token overlap: `|shared tokens| / |total unique tokens|`
- Category exact match: 1.0 if same, 0.0 if not
- Combined score: `0.5 * tagJaccard + 0.3 * descOverlap + 0.2 * categoryMatch`

**Tier 2: Embeddings (optional, if OPENAI_API_KEY set)**
- `text-embedding-3-small` (1536 dims) on `title + description + tags`
- Cosine similarity against stored embeddings
- Blend: `0.3 * keyword + 0.7 * embedding`

### Compiler Decision Engine (pure logic)
| Condition | Decision |
|-----------|----------|
| Top score ≥ 0.90 + same category | `reuse` |
| Top score ≥ 0.70 + same category | `fork` |
| 2+ matches ≥ 0.50 + complementary tags | `compose` |
| Otherwise | `create` |

Thresholds tunable. `force_decision` param bypasses for demo scripting.

### Skill Generator (one LLM call)
- Model: `gpt-4o-mini` with `response_format: { type: "json_schema" }`
- Input: workflow_spec + compiler_decision + (base SKILL.md if forking)
- Output: `{ skill_md, openai_yaml, eval_prompts[], changelog_entry }`
- For `reuse` decision: skip LLM, return existing skill directly

### Compiler Outputs
Every compiled skill produces:
- `SKILL.md` — instruction card with YAML frontmatter + Inputs/Outputs/Steps/Failure behavior
- `agents/openai.yaml` — display config, policy, MCP dependency
- `evals/` — 3 test prompts (direct trigger, edge case, negative)
- `CHANGELOG.md` or version note

### Render Tools
Return **markdown-formatted text** as MCP content:
- `render_registry_dashboard` → markdown table + summary stats
- `render_skill_card` → name, version, tags, description, actions
- `render_run_result` → numbered steps + evidence citations

### Storage
- `data/registry/` — one `{skill_id}.json` per skill
- Atomic writes: write `.tmp` then `fs.rename`
- `SkillStore` class: `save()`, `get()`, `listAll()`, `search()`, `incrementUsage()`, `updateVersion()`

### Transport
- **Streamable HTTP** (for ChatGPT): Express on PORT 3001, `POST /mcp`, `GET /mcp` (SSE), `DELETE /mcp`
- **stdio** (for Claude Code local): `StdioServerTransport`
- Selected via `TRANSPORT` env var, default `streamable-http`

---

## Widget Design

### Single HTML file: `apps/radar-surface/public/radar-widget.html`

No React, no build step. Vanilla JS/CSS. Uses MCP Apps SDK bridge via `postMessage`.

### 5 Views
1. **Dashboard** — stat cards grid (Total, Active, Patched Today) + skill list
2. **Skill card** — icon, name, version badge, tags, quick action buttons
3. **Run result** — numbered steps + evidence citations with source URLs
4. **Scanning** — progress bar with animated status text
5. **Compiler** — workflow spec display + similar skills + decision badge + compile button

### Visual Design
```
Background:     #0f0f13
Card surface:   #1a1a24
Card border:    #2a2a3a (1px solid)
Primary accent: #7C3AED (purple)
Success:        #10B981
Warning:        #F59E0B
Text primary:   #E5E7EB
Text secondary: #9CA3AF
Font:           Inter (system-ui fallback)
Code font:      JetBrains Mono (monospace fallback)
Card radius:    16px
Badge radius:   8px
Pill radius:    24px
```

### ChatGPT Integration
- Widget served as iframe via `registerAppResource()` at `ui://widget/radar.html`
- Tools bound to widget via `_meta.ui.resourceUri`
- `structuredContent` in tool responses flows to widget via `ui/notifications/tool-result`
- Widget reads `structuredContent.view` to pick which DOM template to render

---

## Demo Scenario

### Source
`https://supabase.com/docs/guides/auth/quickstarts/nextjs`

### Seed Skill Bank (5 pre-loaded)
| Skill ID | Category | Tags | Similarity |
|----------|----------|------|------------|
| `workspace-doctor` | macOS Utility | `macos`, `diagnostic` | 0.22 |
| `content-pack` | Documentation | `content`, `packaging` | 0.31 |
| `repo-launch` | Documentation | `repo`, `setup` | 0.28 |
| `nextjs-setup-helper` | Documentation | `nextjs`, `setup` | 0.74 |
| `firebase-auth-setup` | Documentation | `auth`, `firebase`, `setup` | 0.81 |

### Expected Extraction (from TinyFish)
4-step workflow: Create Supabase project → scaffold Next.js with template → configure env vars → verify at localhost

### Expected Compiler Decision
**Fork** from `firebase-auth-setup` (0.81 similarity, same category, same auth-setup pattern)

### Expected Compiled Skill
`supabase-auth-setup` v0.1.0, category Documentation, tags [auth, supabase, nextjs, setup]

### Expected Patch Scenario
Simulated: env var name changed from `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Patch bumps to v0.1.1.

---

## 90-Second Demo Script

### Seed State
Widget open. Dashboard: **5 skills, 4 active, 0 patched today.**

### [0:00–0:08] OPENING
> "The web is full of workflows trapped inside messy pages. Radar turns them into versioned, reusable software."

### [0:08–0:20] EXTRACT (TinyFish MCP)
Type: *"Use TinyFish to extract the auth setup workflow from https://supabase.com/docs/guides/auth/quickstarts/nextjs"*
Agent calls `run_web_automation` → live browser → extracted JSON.
> "TinyFish launches a live browser, navigates the docs, extracts the workflow."

### [0:20–0:30] WORKFLOW SPEC
Show: "Supabase Auth setup for Next.js" — 4 steps, confidence 0.93, evidence.
> "Four steps extracted, source evidence attached, high confidence."

### [0:30–0:42] SIMILAR SKILLS + DECISION (Radar MCP)
Call `find_similar_skills` → `firebase-auth-setup (0.81)`, `nextjs-setup-helper (0.74)` → **FORK**
> "Radar searches existing skills. Firebase-auth-setup is 81% similar — it forks instead of creating from scratch."

### [0:42–0:50] COMPILE
Call `compile_skill` → **Supabase Auth Setup v0.1.0** skill card.
> "One command. Compiled, versioned, in the registry."

### [0:50–1:00] RUN
Type: *"Run supabase-auth-setup for my-saas"*
Call `run_skill` → 4 steps with commands + evidence.
> "Anyone can run it. Concrete steps, real evidence."

### [1:00–1:10] DASHBOARD
Call `render_registry_dashboard` → **6 skills, 5 active**, usage counter.
> "Usage tracked. The skill bank grows with every run."

### [1:10–1:25] PATCH
Call `patch_skill` → Amber badge, env var diff. Apply → v0.1.1.
> "Source changes, Radar detects drift, patches. From pages to procedures — from procedures to software."

### [1:25–1:30] END

---

## Demo Fallbacks

| Scenario | Fallback |
|----------|----------|
| TinyFish down/slow | `DEMO_MODE=true` returns mock workflow_spec |
| ChatGPT flaky | Demo via Claude Code CLI (both MCP servers work) |
| LLM slow | Pre-computed compiler output in fixtures |
| Everything down | Pre-recorded screen recording |

**DEMO_MODE=true:** All tools skip network, return mock data with realistic 800-2000ms delays. CSS animations fake scanning progress.

---

## Build Order

### Sprint 1: Skeleton
- AGENTS.md, package.json, tsconfig.json, .env
- store/types.ts (6 data contracts)
- store/skill-store.ts (JSON CRUD)
- server.ts + index.ts (McpServer + list_skills)
- All mock data files
- Seed 5 skills in data/registry/
- Configure TinyFish MCP

### Sprint 2: Compiler + Similarity
- keyword-scorer.ts
- decision-engine.ts
- skill-generator.ts (gpt-4o-mini)
- compile-skill.ts, find-similar-skills.ts, run-skill.ts, patch-skill.ts tools

### Sprint 3: Widget + Render Tools
- render-registry-dashboard.ts, render-skill-card.ts, render-run-result.ts
- radar-widget.html (all 5 views, dark theme)

### Sprint 4: Integration + Polish
- ngrok tunnel, ChatGPT connection
- DEMO_MODE flag
- Rehearse × 3, record backup

---

## Project File Structure

```
tfhack/
  AGENTS.md
  package.json / tsconfig.json / .env

  server/radar-mcp/
    index.ts                          # Entry + transport
    server.ts                         # McpServer + 8 tools
    tools/
      find-similar-skills.ts
      compile-skill.ts                # ★ Core
      run-skill.ts
      patch-skill.ts
      list-skills.ts
      render-registry-dashboard.ts
      render-skill-card.ts
      render-run-result.ts
    compiler/
      decision-engine.ts              # reuse/fork/compose/create
      skill-generator.ts              # gpt-4o-mini structured output
    similarity/
      keyword-scorer.ts               # Tag Jaccard + description overlap
    store/
      skill-store.ts                  # JSON file CRUD
      types.ts                        # All data contract interfaces
    clients/
      openai-client.ts

  apps/radar-surface/
    public/
      radar-widget.html               # Single-file widget

  data/
    registry/                         # Live skill JSON files
    mock/                             # Fixture files for demo

  skills/demo-skill/
    SKILL.md
    agents/openai.yaml
```

---

## References from Brief

### OpenAI
- Codex Agent Skills: https://developers.openai.com/codex/skills
- Apps SDK Quickstart: https://developers.openai.com/apps-sdk/quickstart
- Building MCP Servers: https://developers.openai.com/api/docs/mcp
- AGENTS.md guidance: https://developers.openai.com/codex/guides/agents-md

### TinyFish
- CLI: https://docs.tinyfish.ai/cli
- MCP Integration: https://docs.tinyfish.ai/mcp-integration
- AI Integration: https://docs.tinyfish.ai/ai-integration
- Endpoints: https://docs.tinyfish.ai/key-concepts/endpoints
- Browser Profiles: https://docs.tinyfish.ai/key-concepts/browser-profiles
- Anti-Bot Guide: https://docs.tinyfish.ai/anti-bot-guide

### Demo Targets
- Seed repo: https://github.com/Arnie016/codex-goated-skills
- Supabase Auth quickstart: https://supabase.com/docs/guides/auth/quickstarts/nextjs
- Next.js docs: https://nextjs.org/docs

---

## Team Split

### You (user)
- Architecture, workflow spec schema
- Skill compiler + patch logic
- Widget / surface layer
- Demo flow + pitch

### Teammate
- Discovery step, TinyFish source adapters
- Extraction prompt tuning
- Normalization into workflow_spec.json
- Source hash + change detection

### Teammate's definition of done
- Given a URL set → valid workflow_spec.json
- Handles blocked/login/timeout cleanly
- Works on ≥2 source sets

---

## Scope Guardrails

### Must-have
- One source set end-to-end
- One compiled skill
- One surface
- One patch flow

### Nice-to-have
- Composition from 2 skills
- Menu bar shell
- Usage leaderboard

### Do not build
- Full marketplace, auth, billing, multi-tenant
- Per-skill MCP servers
- Browser history surveillance
- Many verticals at once
