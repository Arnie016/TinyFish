# Radar — Hackathon Demo Implementation Plan

## Context

Greenfield hackathon project. **Radar** turns public web workflows into versioned Codex skills. We need a **working 90-second demo**: extract workflow → find similar skills → compile → surface → run → detect drift → patch.

**Key architecture insight:** TinyFish already provides a native MCP server at `https://agent.tinyfish.ai/mcp` with tools `run_web_automation`, `run_web_automation_async`, `get_run`, `list_runs`. We don't build extraction — we **compose** TinyFish MCP + Radar MCP and let the AI agent orchestrate both.

**Demo scenario:** Supabase Auth Next.js quickstart → `supabase-auth-setup` skill.

---

## Architecture

```
Claude Code / ChatGPT (orchestrator)
  ├── TinyFish MCP (extraction)        ← already exists, just configure
  │   ├── run_web_automation
  │   ├── run_web_automation_async
  │   ├── get_run
  │   └── list_runs
  │
  └── Radar MCP (our code)             ← what we build
      ├── find_similar_skills
      ├── compile_skill
      ├── run_skill
      ├── patch_skill
      ├── list_skills
      ├── render_registry_dashboard
      ├── render_skill_card
      └── render_run_result
```

**The agent calls TinyFish to extract, then passes the result to Radar to compile.** We don't wrap TinyFish — we compose with it.

### TinyFish Setup (one command)
```bash
claude mcp add --transport http tinyfish https://agent.tinyfish.ai/mcp
```

---

## Tech Stack

| Component | Tech | Why |
|-----------|------|-----|
| Radar MCP Server | TypeScript + `@modelcontextprotocol/sdk` + `zod` | Official SDK, type-safe |
| Skill generation | `openai` npm, `gpt-4o-mini` structured output | Cheap, fast |
| Widget | Single HTML file, vanilla JS/CSS | No build step, ChatGPT iframe or standalone |
| Storage | JSON files on disk | Zero setup, inspectable |
| Extraction | TinyFish MCP (external) | Already built, native MCP |
| Tunnel | ngrok | Expose localhost to ChatGPT |

---

## What We Build vs. What Already Exists

### We Build (Radar MCP)
- Skill similarity search (keyword-based)
- Compiler: decision engine + LLM skill generation
- Skill registry (JSON file store)
- Patch detection (content hash diff)
- Render tools (dashboard, skill cards, run results)
- ChatGPT widget with 5 views
- Mock data for demo fallback
- 5 pre-seeded skills

### Already Exists (TinyFish MCP)
- Live browser extraction (`run_web_automation`)
- Async extraction (`run_web_automation_async`)
- Run status polling (`get_run`)
- Run history (`list_runs`)
- Browser profiles (lite/stealth)
- SSE streaming for live progress

### Don't Build
- Extraction wrappers (TinyFish handles this)
- Browser automation (TinyFish handles this)
- Embeddings-based similarity (keyword matching is enough)
- Evals framework, auth, multi-tenant

---

## Project Structure

```
tfhack/
  AGENTS.md
  package.json / tsconfig.json / .env

  server/radar-mcp/
    index.ts                          # Entry point + transport
    server.ts                         # McpServer + 8 tool registrations
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
      decision-engine.ts              # reuse/fork/compose/create logic
      skill-generator.ts              # gpt-4o-mini structured output
    similarity/
      keyword-scorer.ts               # Tag Jaccard + description overlap
    store/
      skill-store.ts                  # JSON file CRUD
      types.ts                        # All data contract interfaces
    clients/
      openai-client.ts                # OpenAI wrapper

  apps/radar-surface/
    public/
      radar-widget.html               # ★ Single-file widget (all views)

  data/
    registry/                         # Live skill JSON files (one per skill)
    mock/                             # Fixture files for demo fallback

  skills/demo-skill/
    SKILL.md
    agents/openai.yaml
```

---

## Build Order (4 sprints)

### Sprint 1: Skeleton That Runs
1. `AGENTS.md`, `package.json`, `tsconfig.json`, `.env.example`
2. Install deps: `@modelcontextprotocol/sdk`, `zod`, `openai`, `dotenv`, `tsx`
3. `store/types.ts` — interfaces: WorkflowSpec, SkillRecord, CompilerDecision, PatchJob, SurfaceSpec, EvalResult
4. `store/skill-store.ts` — read/write/list JSON files in `data/registry/`
5. `server.ts` + `index.ts` — McpServer with `list_skills` tool returning seeded data
6. Wire `StreamableHTTPServerTransport` on port 3001
7. Create all mock data files in `data/mock/`
8. Seed `data/registry/` with 5 pre-loaded skills
9. Configure TinyFish MCP: `claude mcp add --transport http tinyfish https://agent.tinyfish.ai/mcp`
10. Verify: MCP handshake works, `list_skills` returns 5 skills

### Sprint 2: Compiler + Similarity
1. `keyword-scorer.ts`:
   - Tag Jaccard: `|A ∩ B| / |A ∪ B|`
   - Description token overlap: `|shared| / |unique|`
   - Category match: exact = 1.0, else 0.0
   - Combined: `0.5 * tagJaccard + 0.3 * descOverlap + 0.2 * categoryMatch`
2. `decision-engine.ts` — pure logic, tunable thresholds:
   - ≥0.90 same category → `reuse`
   - ≥0.70 same category → `fork`
   - 2+ at ≥0.50 complementary → `compose`
   - else → `create`
   - `force_decision` param bypasses scoring for demo scripting
3. `skill-generator.ts`:
   - One `gpt-4o-mini` call with `response_format: { type: "json_schema" }`
   - Input: workflow_spec + compiler_decision + (base SKILL.md if forking)
   - Output: `{ skill_md, openai_yaml, eval_prompts, changelog_entry }`
   - For `reuse`: no LLM call, return existing skill
4. `compile-skill.ts` tool — wires: scorer → decision → generator → store.save
5. `find-similar-skills.ts` tool
6. `run-skill.ts` tool — returns the skill's steps customized with user input
7. `patch-skill.ts` tool — fetch source URLs, hash compare, generate patch if changed
8. Test: pass mock workflow_spec → get compiled SKILL.md

### Sprint 3: Widget + Render Tools
1. `render-registry-dashboard.ts` — markdown table + summary stats
2. `render-skill-card.ts` — formatted skill detail card
3. `render-run-result.ts` — steps + evidence citations
4. `radar-widget.html` — 5 views (dark theme, card-based):
   - **Dashboard**: stat cards (total, active, patched today) + skill list
   - **Skill card**: name, version badge, tags, quick actions
   - **Run result**: numbered steps + evidence
   - **Scanning**: animated progress text (while TinyFish runs)
   - **Compiler**: spec + similar skills + decision badge + compile button
5. Visual: `#0f0f13` bg, `#7C3AED` accent, 16px radius cards

### Sprint 4: Integration + Demo Polish
1. ngrok tunnel → connect Radar MCP to ChatGPT
2. Verify TinyFish MCP + Radar MCP both accessible from agent
3. `DEMO_MODE=true` flag: tools return mock data with 1-2s delays
4. Pre-seed registry with 5 populated skills
5. Test full demo flow: TinyFish extracts → Radar compiles → widget shows
6. Rehearse 90-second script 3 times
7. Record backup screen recording

---

## Demo Script (90 seconds)

### Seed State
Widget in ChatGPT. Dashboard: **5 skills, 4 active, 0 patched today.**

### [0:00–0:08] OPENING
> "The web is full of workflows trapped inside messy pages. Radar turns them into versioned, reusable software."

### [0:08–0:20] EXTRACT — TinyFish does the work
Type: *"Use TinyFish to extract the auth setup workflow from https://supabase.com/docs/guides/auth/quickstarts/nextjs — return it as a structured workflow spec with steps, inputs, outputs, and evidence"*

Agent calls TinyFish's `run_web_automation` → live browser navigates docs → returns extracted JSON.

> "TinyFish launches a live browser, navigates the docs, extracts the workflow."

### [0:20–0:30] WORKFLOW SPEC
Show the extracted result: "Supabase Auth setup for Next.js" — 4 steps, evidence snippets.

> "Four steps extracted, source evidence attached, high confidence."

### [0:30–0:42] SIMILAR SKILLS + DECISION
Type: *"Find similar skills in Radar for this workflow"*

Agent calls Radar's `find_similar_skills` → shows: `firebase-auth-setup (0.81)`, `nextjs-setup-helper (0.74)`

> "Radar searches existing skills. Firebase-auth-setup is 81% similar — it forks instead of creating from scratch."

### [0:42–0:50] COMPILE
Type: *"Compile this into a new Radar skill"*

Agent calls Radar's `compile_skill` → returns skill card: **Supabase Auth Setup v0.1.0**

> "One command. Compiled, versioned, in the registry."

### [0:50–1:00] RUN
Type: *"Run supabase-auth-setup for a project called my-saas"*

Agent calls `run_skill` → 4 concrete steps with commands + evidence.

> "Anyone can run it. Concrete steps, real evidence."

### [1:00–1:10] USAGE + DASHBOARD
Type: *"Show the Radar dashboard"*

Dashboard: **6 skills, 5 active**, usage counter incremented.

> "Usage tracked. The skill bank grows with every run."

### [1:10–1:25] PATCH
Type: *"Check supabase-auth-setup for source drift"*

Agent calls `patch_skill` → Amber **Patch Available**: env var name changed. Apply → v0.1.1.

> "Source changes, Radar detects drift, proposes a patch. From pages to procedures — from procedures to software."

### [1:25–1:30] END — dashboard with updated stats

---

## Demo Fallbacks

| Scenario | Fallback |
|----------|----------|
| TinyFish down/slow | `DEMO_MODE=true` returns pre-extracted mock workflow_spec |
| ChatGPT flaky | Demo via Claude Code CLI (both MCP servers work there too) |
| LLM call slow | Pre-computed compiler output in mock fixtures |
| Everything down | Pre-recorded screen recording |

---

## Seed Skill Bank (5 pre-loaded in `data/registry/`)

| Skill ID | Category | Tags | Similarity to demo |
|----------|----------|------|--------------------|
| `workspace-doctor` | macOS Utility | `macos`, `diagnostic` | 0.22 (noise) |
| `content-pack` | Documentation | `content`, `packaging` | 0.31 (noise) |
| `repo-launch` | Documentation | `repo`, `setup` | 0.28 (noise) |
| `nextjs-setup-helper` | Documentation | `nextjs`, `setup` | 0.74 (relevant) |
| `firebase-auth-setup` | Documentation | `auth`, `firebase`, `setup` | 0.81 (fork source) |

---

## Data Contracts (in `store/types.ts`)

### WorkflowSpec
From TinyFish extraction output, normalized to:
```ts
{ workflow_id, title, description, category, tags, source_urls, source_kind,
  input_schema[], output_schema, steps[], evidence[], surface_suggestion, confidence }
```

### CompilerDecision
```ts
{ decision: "reuse"|"fork"|"compose"|"create", reason, nearest_skills[], composed_from[], forked_from }
```

### SkillRecord
```ts
{ skill_id, name, description, category, tags, version, status,
  forked_from, composed_from, source_urls, source_hashes,
  surface_type, usage_count, last_used_at, last_scanned_at, last_patched_at, eval_score }
```

### PatchJob
```ts
{ patch_id, skill_id, previous_version, proposed_version, change_type,
  source_changed, changed_sources, summary, auto_promote, eval_required, approved }
```

---

## Verification

1. `curl POST localhost:3001/mcp` → MCP handshake responds
2. TinyFish MCP configured: `claude mcp list` shows `tinyfish`
3. Call `list_skills` → 5 seeded skills returned
4. Call `find_similar_skills` with supabase spec → firebase-auth-setup ranked #1
5. Call `compile_skill` → valid SKILL.md + skill_record generated
6. Call `patch_skill` → patch_job with version bump
7. Widget loads → dashboard renders with 5 skills
8. Full demo script end-to-end without errors
9. `DEMO_MODE=true` → everything works with zero network

---

## Critical Files (build order)

1. `AGENTS.md` — repo rules
2. `server/radar-mcp/store/types.ts` — data contracts (foundation for everything)
3. `data/mock/*.json` — fixture files (demo reliability)
4. `data/registry/*.json` — 5 seeded skills
5. `server/radar-mcp/store/skill-store.ts` — JSON CRUD
6. `server/radar-mcp/server.ts` — McpServer + tool wiring (backbone)
7. `server/radar-mcp/index.ts` — entry + transport
8. `server/radar-mcp/similarity/keyword-scorer.ts` — skill matching
9. `server/radar-mcp/compiler/decision-engine.ts` — reuse/fork/compose/create
10. `server/radar-mcp/compiler/skill-generator.ts` — LLM generation
11. `server/radar-mcp/tools/compile-skill.ts` — core tool
12. `apps/radar-surface/public/radar-widget.html` — the widget

---

## How to Resume

Tell Claude: *"Read implementation_plan.md and claude_research.md, then implement Sprint N"* (where N = 1, 2, 3, or 4).

Or for the full build: *"Read implementation_plan.md and claude_research.md, then implement the entire Radar hackathon demo end-to-end."*
