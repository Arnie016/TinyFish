# RADAR Hackathon Brief

## One-line idea
**Radar turns messy public web workflows into versioned Codex skills, then surfaces them as usable software: chat tools, widgets, menu bar utilities, or small desktop apps.**

---

## TL;DR
We are **not** building "AI that scraped a website."

We are building a **workflow compiler**:

**public web workflow -> structured JSON spec -> retrieve nearest existing skills -> reuse / fork / compose / create -> Codex skill -> surface -> usage telemetry -> patch loop**

That is the core insight.

---

# 5W1H

## Who
- **Users:** builders who want reusable software from messy web workflows
- **Hackathon judges:** want visible technical leverage, live browsing, and clear utility
- **Team:**
  - **You:** compiler, skill bank, surfaces, demo story
  - **Teammate:** TinyFish extraction and source normalization

## What
A radar agent that:
1. watches public web sources
2. extracts a reusable workflow
3. converts it to a normalized JSON spec
4. searches existing skills first
5. decides whether to reuse, fork, compose, or create
6. compiles a Codex skill
7. exposes that skill through a surface layer
8. tracks usage and patches the skill when the source drifts

## Why
Because raw scraping is low-leverage.

The real value is:
- turning instructions into repeatable capability
- making docs and workflows executable
- letting useful patterns compound over time
- making the skill bank feel alive through search, tags, usage, and patch history

## Where
Use **public, low-friction web sources**:
- GitHub repos
- official docs sites
- public product pages
- public changelogs
- public demo pages

Avoid private dashboards and login-heavy flows for the hackathon demo.

## When
**Hackathon v1 scope:** one engine, one polished surface, one clean vertical.

Best target: **developer workflows from public repos + docs**.

## How
Use a 3-layer stack:
- **TinyFish** = live browser extraction on messy web surfaces
- **Codex skills** = reusable workflow behavior
- **MCP + UI surface** = usable presentation and execution layer

---

# Product framing

## The winning framing
**Radar makes the web executable.**

## Even sharper
**From pages to procedures. From procedures to software.**

## What we are not
- not a general scraper marketplace
- not a giant agent platform
- not full autonomous app generation from any website
- not a private browsing surveillance tool

---

# The core loop

1. **Watch sources**
2. **Extract workflow**
3. **Normalize to JSON**
4. **Search similar skills first**
5. **Reuse / fork / compose / create**
6. **Compile skill**
7. **Surface skill**
8. **Track usage**
9. **Patch on source change**
10. **Promote strong patterns back into the catalog**

This is the Radar flywheel.

---

# Why TinyFish matters

TinyFish should be used **only where a real browser adds real value**.

## Use TinyFish for
- JavaScript-rendered content
- multi-step navigation
- dropdowns, modals, pagination
- SPAs, lazy loading, infinite scroll
- public pages with anti-bot friction
- live, visual browser demos for judges

## Do not use TinyFish for
- clean static docs that can be fetched normally
- simple GitHub README parsing
- tasks that are already available via a direct API or normal fetch

## Practical scrape ladder
1. **Discovery:** OpenAI web search or simple site search
2. **Cheap pass:** fetch + parse static HTML / README / docs
3. **Escalate to TinyFish:** only if the page is dynamic, interactive, or annoying

## TinyFish endpoint choice
- **`/run`** for quick simple tasks
- **`/run-async`** for longer background scans and patch jobs
- **`/run-sse`** for live judge demos with visible browser progress

## TinyFish browser policy
- default: **`lite`**
- use **`stealth`** only if the site is protected or flaky
- add proxy only if geo or anti-bot friction appears
- if a CAPTCHA appears, stop and mark blocked

---

# Architecture

```text
public source URLs
    ↓
discovery layer
    ↓
cheap parse first
    ↓
TinyFish if dynamic / interactive / JS-heavy
    ↓
workflow_spec.json
    ↓
retrieve nearest skills
    ↓
reuse / fork / compose / create
    ↓
skill compiler
    ↓
SKILL.md + agents/openai.yaml + optional assets + evals
    ↓
skill bank / registry
    ↓
surface layer
(chat widget / menu bar / desktop app / mcp tool)
    ↓
usage telemetry + patch loop
```

---

# Radar memory and ranking model

Treat the skill catalog as a **live skill genome**.

## Search
Search is **retrieval before generation**.
It answers:
- what already exists?
- what is similar?
- should we fork instead of create?
- can this be composed from smaller skills?

## Category
Category is **compiler routing**, not just UI.
Examples:
- **Browser Automation** -> navigation, extraction, retries, selectors
- **Documentation** -> parse docs, derive steps, build references
- **MCP Tools** -> tool contracts, manifests, schemas
- **macOS Utility Builders** -> app shell, menu bar, widget, system hooks

## Tags
Tags are **micro-capabilities**.
Examples:
- `browser-automation`
- `documentation`
- `mcp`
- `swiftui`
- `widgetkit`
- `auth`
- `sql`

Composition example:
- `browser-automation` + `documentation` + `mcp`
  -> docs-to-tool compiler

## Blog / changelog layer
Human-readable summary for:
- what problem the skill solves
- what sources it watches
- what changed from the previous version
- example runs

## Usage count
Usage becomes:
- popularity prior
- trust signal
- ranking feature
- recommendation input

---

# Data contracts

## 1. `workflow_spec.json`
```json
{
  "workflow_id": "movie-radar-v1",
  "title": "Movie decision workflow",
  "description": "Decide whether to watch a movie using ratings, sentiment, and availability.",
  "category": "Browser Automation",
  "tags": ["movie", "sentiment", "availability", "widget"],
  "source_urls": [
    "https://example.com/source-1",
    "https://example.com/source-2"
  ],
  "source_kind": ["docs", "webpage"],
  "input_schema": [
    {
      "name": "movie_title",
      "type": "string",
      "required": true,
      "description": "Title provided by the user"
    }
  ],
  "output_schema": {
    "type": "object",
    "properties": {
      "verdict": { "type": "string" },
      "reasoning": { "type": "array" },
      "where_to_watch": { "type": "array" }
    },
    "required": ["verdict", "reasoning"]
  },
  "steps": [
    {
      "id": "s1",
      "action": "navigate",
      "instruction": "Open rating sources and gather headline score",
      "expected_output": "normalized ratings"
    },
    {
      "id": "s2",
      "action": "extract",
      "instruction": "Collect sentiment snippets",
      "expected_output": "positive and negative evidence"
    },
    {
      "id": "s3",
      "action": "decide",
      "instruction": "Summarize watch / skip / maybe",
      "expected_output": "verdict with reasons"
    }
  ],
  "evidence": [
    {
      "url": "https://example.com/source-1",
      "snippet": "Audience score is 93%."
    }
  ],
  "surface_suggestion": "widget",
  "mcp_tools_needed": ["run_skill", "render_skill_card"],
  "confidence": 0.91
}
```

## 2. `compiler_decision.json`
```json
{
  "decision": "fork",
  "reason": "Closest matching skill already handles browser extraction and result ranking.",
  "nearest_skills": [
    {
      "skill_id": "movie-radar",
      "score": 0.86
    },
    {
      "skill_id": "content-pack",
      "score": 0.41
    }
  ],
  "composed_from": [],
  "forked_from": "movie-radar"
}
```

## 3. `skill_record.json`
```json
{
  "skill_id": "movie-radar",
  "name": "Movie Radar",
  "description": "Use this skill to decide whether to watch a movie using public web evidence.",
  "category": "Browser Automation",
  "tags": ["movie", "sentiment", "availability"],
  "version": "0.1.0",
  "status": "active",
  "forked_from": null,
  "composed_from": [],
  "source_urls": ["https://example.com"],
  "source_hashes": ["abc123"],
  "surface_type": "widget",
  "usage_count": 18,
  "last_used_at": "2026-03-26T18:00:00Z",
  "last_scanned_at": "2026-03-26T18:10:00Z",
  "last_patched_at": null,
  "eval_score": 0.88
}
```

## 4. `surface_spec.json`
```json
{
  "surface_type": "widget",
  "display_name": "Movie Radar",
  "short_description": "Watch, skip, or maybe.",
  "icon": "movie-radar.png",
  "brand_color": "#7C3AED",
  "default_prompt": "Should I watch Dune Part Two?",
  "quick_actions": [
    "Run skill",
    "Patch from source",
    "Open evidence"
  ],
  "stats_visible": true
}
```

## 5. `eval_result.json`
```json
{
  "eval_id": "eval-001",
  "skill_id": "movie-radar",
  "version": "0.1.0",
  "round": "trigger",
  "prompt": "Should I watch Dune Part Two?",
  "expected_skill": "movie-radar",
  "actual_skill": "movie-radar",
  "passed": true,
  "metrics": {
    "trigger_correct": true,
    "schema_valid": true,
    "source_citation_present": true,
    "latency_ms": 2210
  },
  "notes": "Good response shape and correct skill routing."
}
```

## 6. `patch_job.json`
```json
{
  "patch_id": "patch-004",
  "skill_id": "movie-radar",
  "previous_version": "0.1.0",
  "proposed_version": "0.1.1",
  "change_type": "patch",
  "source_changed": true,
  "changed_sources": ["https://example.com/source-1"],
  "summary": "Availability extraction path changed.",
  "auto_promote": false,
  "eval_required": true,
  "approved": false
}
```

---

# Compiler outputs

Every compiled skill should output:
- `SKILL.md`
- `agents/openai.yaml`
- `evals/` with 3 to 5 test prompts
- `CHANGELOG.md` or version note
- optional `assets/` folder for icons or screenshots

## Minimal `SKILL.md`
```md
---
name: movie-radar
description: Use this skill when the user wants a watch/skip/maybe verdict for a movie using public ratings, audience sentiment, and streaming availability. Do not use it for box office prediction or private data.
---

## Inputs
- movie title

## Outputs
- verdict
- reasoning
- where to watch

## Steps
1. Validate the title.
2. Collect ratings from trusted public sources.
3. Collect sentiment snippets.
4. Check availability.
5. Return compact answer.

## Failure behavior
- If one source fails, continue with remaining sources.
- If availability is missing, still return verdict.
```

## Minimal `agents/openai.yaml`
```yaml
interface:
  display_name: "Movie Radar"
  short_description: "Watch, skip, or maybe."
  icon_small: "./assets/movie-radar-small.svg"
  icon_large: "./assets/movie-radar-large.png"
  brand_color: "#7C3AED"
  default_prompt: "Should I watch Dune Part Two?"
policy:
  allow_implicit_invocation: true
dependencies:
  tools:
    - type: "mcp"
      value: "radarMcp"
      description: "Radar MCP server"
      transport: "streamable_http"
      url: "https://your-domain.example/mcp"
```

---

# Skill surfaces and harnesses

## Key principle
**Skill = behavior**
**Surface = how the behavior is experienced**

A skill is not the app icon by itself.
A skill becomes app-like when wrapped in a surface.

## Surface types

### 1. Chat surface
Best for:
- fastest hackathon demo
- running the skill with a natural language prompt
- showing evidence and answer in one place

### 2. Widget surface
Best for:
- one-click quick actions
- compact, judge-friendly demo
- stats like total skills, active skills, patched today

### 3. Menu bar surface
Best for:
- always-on radar vibe
- quick usage stats
- opening the widget or detail window

### 4. Desktop app shell
Best for:
- browsing the catalog
- editing metadata
- composing skills
- viewing patch history

### 5. MCP tool surface
Best for:
- running skills via ChatGPT or another MCP host
- remote execution
- keeping one stable tool contract

## Recommended hackathon surface order
1. **ChatGPT widget**
2. **Tiny registry dashboard inside widget**
3. **Optional SwiftUI menu bar shell** if time remains

---

# MCP server design

Use **one Radar MCP server**, not one server per skill.

## Required tools
### Data tools
- `discover_sources`
- `scan_sources`
- `extract_workflow`
- `find_similar_skills`
- `compile_skill`
- `patch_skill`
- `list_skills`
- `skill_usage_stats`

### Render tools
- `render_registry_dashboard`
- `render_skill_card`
- `render_run_result`

## Optional later
- `compose_skills`
- `publish_plugin`
- `export_surface`

## Optional deep research compatibility later
If you later want Radar to behave like a data-only app or connector for search-style use, add compatible `search` and `fetch` tools. That is **not required** for hackathon v1.

---

# What Codex should do in this project

## Use Codex as the build engine
Codex should mainly help you:
- scaffold the MCP server
- scaffold the ChatGPT widget
- scaffold the SwiftUI shell if needed
- write the compiler and patcher logic
- create and refine skills
- keep the repo organized

## Codex operating rules
- create `AGENTS.md` first
- use `$skill-creator` to scaffold the compiler and patcher skills
- keep skills instruction-first unless deterministic scripts are clearly needed
- only load a skill into context when it is selected
- search similar skills before creating a new one

## Recommended project files
```text
repo/
  AGENTS.md
  server/radar-mcp/
  apps/radar-surface/
  skills/radar-compiler/
  skills/radar-patcher/
  skills/demo-skill/
  data/mock/
  evals/
```

---

# Prompt layer

Use 4 layers, not one giant prompt.

## 1. `AGENTS.md`
Repo-wide operating rules, scope, and definition of done.

## 2. Memory card
Short structured context:
- current project
- active sources
- active skills
- pending patch jobs

## 3. Skill metadata
Only `name`, `description`, tags, category, surface type, and usage stats.

## 4. Task prompt
The current job only.

That keeps context efficient.

---

# Prompt templates

## TinyFish extraction prompt
```text
You are extracting a reusable workflow from a public website.

Inspect this page and up to 3 linked pages that are directly necessary to understand the workflow.

Return JSON exactly in this shape:
{
  "workflow_id": "string",
  "title": "string",
  "description": "string",
  "category": "string",
  "tags": ["string"],
  "source_urls": ["string"],
  "input_schema": [{"name":"string","type":"string","required":true}],
  "output_schema": {},
  "steps": [{"id":"string","action":"string","instruction":"string","expected_output":"string"}],
  "evidence": [{"url":"string","snippet":"string"}],
  "surface_suggestion": "chat | widget | menu_bar | desktop_app | mcp_tool",
  "confidence": 0.0
}

Rules:
- Stop after 4 pages total.
- Stop early if the workflow is clearly understood.
- Close cookie banners before proceeding.
- If a CAPTCHA or login wall appears, stop and return a structured error.
- Do not return prose outside JSON.
```

## Compiler prompt to Codex
```text
Given workflow_spec.json and nearest skill matches, create or update a Codex skill.

Outputs required:
- SKILL.md
- agents/openai.yaml
- 3 eval prompts
- compact version note

Rules:
- Prefer reuse or fork before creating from zero.
- Keep the skill focused on one job.
- Make the description precise about when to use and when not to use.
- Prefer instruction-only unless a script is clearly needed.
```

## Patcher prompt
```text
Given an existing skill, previous workflow spec, and fresh evidence from sources, determine whether the skill needs a patch.

Return:
- changed: true/false
- summary
- semantic diff
- proposed version bump
- patched SKILL.md if needed
- patched agents/openai.yaml if needed
- eval prompts to rerun

Do not auto-promote without passing evals.
```

---

# Evaluation plan

The eval plan should be visible and simple.

## Round 0: Human smoke test
Goal:
- the end-to-end flow works once

Pass if:
- source scan runs
- JSON spec is valid
- skill compiles
- widget renders

## Round 1: Extraction quality
Questions:
- was the right workflow extracted?
- are the steps complete enough?
- is evidence present?

Checks:
- valid JSON
- required fields present
- no raw HTML leak
- confidence above threshold

## Round 2: Retrieval / composition quality
Questions:
- did Radar find the nearest useful skill?
- should it reuse, fork, compose, or create?

Checks:
- nearest skill is relevant
- the decision is explainable
- no needless duplicates

## Round 3: Skill trigger quality
Questions:
- does the correct skill trigger from the description?

For each skill, test:
- 1 direct trigger prompt
- 1 edge prompt
- 1 should-not-trigger prompt

## Round 4: Output quality
Questions:
- is the output shape correct?
- does it stay compact and useful?
- are failures graceful?

Checks:
- output matches schema
- no invented source claims
- partial success is handled

## Round 5: Surface quality
Questions:
- does the surface feel like usable software?

Checks:
- visible title, version, icon, actions
- registry stats render correctly
- run result is easy to understand

## Round 6: Patch loop
Questions:
- when a source changes, does Radar propose a sane patch?

Checks:
- change detected
- patch generated
- version bump correct
- evals rerun
- no auto-promotion without review

## Suggested metrics
- extraction success rate
- schema validity rate
- nearest-skill retrieval hit rate
- trigger precision
- skill run success rate
- median latency
- patch acceptance rate

---

# Demo sources to target

## Primary target: your own repo
### `Arnie016/codex-goated-skills`
Why:
- it already separates **skills** from **apps**
- it already has install/update patterns
- it already contains app-like skill ideas and macOS utilities
- it gives you a believable seed bank and surface inspiration

Use as:
- seed skill bank
- retrieval baseline
- surface design inspiration
- demo proof that the system can grow from an existing catalog

## Good public workflow targets
### 1. `supabase/supabase-js` + Supabase Auth docs
Use case:
- compile a skill that helps implement auth flows or generate setup steps

Why good:
- public
- structured docs
- clear workflow steps
- practical developer value

### 2. `vercel/next.js` + Next.js docs or examples
Use case:
- compile a setup or upgrade helper skill

Why good:
- popular
- public repo + public docs
- clear examples and starter flows

### 3. Your own repo pages + docs-like pages
Use case:
- show Radar extracting and surfacing a skill for one of your macOS app builders

Why good:
- easier to control
- faster iteration
- stronger demo coherence

## Do not target for v1
- private dashboards
- sites requiring personal credentials
- sites with aggressive CAPTCHA loops
- random unofficial blog posts as the only source of truth
- giant issue trackers or noisy discussion pages
- workflows that require too many hidden assumptions

## Recommended target strategy
### For the actual hackathon demo
Pick **one**:
1. **Own-repo demo** using `codex-goated-skills`
2. **Developer docs demo** using Supabase + Next.js

My recommendation:
- **Use your own repo as the skill bank**
- **Use one public docs workflow as the external source**

That gives both credibility and live-web relevance.

---

# Team split

## You
- architecture
- workflow spec schema
- skill compiler
- patch logic
- widget / surface layer
- pitch and demo flow

## Teammate
- discovery step
- TinyFish source adapters
- extraction prompt tuning
- normalization into `workflow_spec.json`
- source hash + change detection

## Definition of done for teammate
- given a URL set, the extractor returns valid `workflow_spec.json`
- handles blocked / login / timeout cleanly
- works on at least 2 source sets

---

# Build order

## Phase 1: skeleton
- create `AGENTS.md`
- create mock schemas
- create local JSON fixtures
- create empty MCP server routes
- create static widget shell

## Phase 2: extractor
- implement discovery
- implement cheap parse
- add TinyFish extraction path
- validate `workflow_spec.json`

## Phase 3: compiler
- implement similar-skill search
- implement reuse / fork / compose / create logic
- generate `SKILL.md`
- generate `agents/openai.yaml`

## Phase 4: registry and surface
- store skill records in SQLite or JSON file first
- render dashboard
- render skill card
- show usage stats

## Phase 5: patch loop
- hash sources
- detect drift
- propose patch
- rerun evals

## Phase 6: polish
- icon and label cleanup
- better empty states
- fast demo seed data

---

# 90-second judge demo

## Opening line
“The web is full of workflows, but they are trapped inside messy pages. Radar turns those workflows into reusable software.”

## Flow
1. Paste a public repo/docs source set
2. Show Radar scanning the source
3. Show TinyFish browser live with `/run-sse`
4. Show `workflow_spec.json`
5. Show similar skills retrieved from the bank
6. Show Radar decide: reuse / fork / compose / create
7. Click **Compile skill**
8. Show the new skill card with icon, version, prompt, and actions
9. Run the skill from the widget
10. Show usage stats
11. Simulate a source change
12. Show **Patch available** -> version bump

## Judge takeaway
- live web extraction
- structured compiler logic
- reusable skill artifact
- visible software surface
- patch and telemetry loop

---

# Scope guardrails

## Must-have
- one source set works end to end
- one compiled skill works
- one surface works
- one patch flow works

## Nice-to-have
- composition from 2 skills
- menu bar shell
- usage leaderboard
- plugin packaging

## Do not build
- full marketplace
- auth and billing
- multi-tenant team permissions
- browser history surveillance
- per-skill MCP servers
- many verticals at once

---

# Why this can win

Because it hits all 3 hackathon judge instincts:

## 1. Technical leverage
You use the open web as messy live infrastructure, not just as a search result.

## 2. Reusability
The output is a versioned skill, not just a one-off answer.

## 3. Product feel
The skill surface makes the result feel like real software.

---

# Suggested names
- **Radar**
- **CastNet**
- **SkillTrawler**
- **ReelOps**

Best serious name: **Radar**
Best clever name: **CastNet**

---

# References

## OpenAI
- Codex Agent Skills: https://developers.openai.com/codex/skills
- Testing Agent Skills with Evals: https://developers.openai.com/blog/eval-skills
- Skills in OpenAI API: https://developers.openai.com/cookbook/examples/skills_in_api
- Apps SDK Quickstart: https://developers.openai.com/apps-sdk/quickstart
- Building MCP Servers: https://developers.openai.com/api/docs/mcp
- Web Search Tool Guide: https://developers.openai.com/api/docs/guides/tools-web-search
- API Changelog: https://developers.openai.com/api/docs/changelog
- AGENTS.md guidance: https://developers.openai.com/codex/guides/agents-md
- Codex changelog / plugins: https://developers.openai.com/codex/changelog

## TinyFish
- AI Integration Guide: https://docs.tinyfish.ai/ai-integration
- Endpoints: https://docs.tinyfish.ai/key-concepts/endpoints
- Browser Profiles: https://docs.tinyfish.ai/key-concepts/browser-profiles
- Anti-Bot Guide: https://docs.tinyfish.ai/anti-bot-guide
- MCP Integration: https://docs.tinyfish.ai/mcp-integration

## Seed repo and demo targets
- `Arnie016/codex-goated-skills`: https://github.com/Arnie016/codex-goated-skills
- `vercel/next.js`: https://github.com/vercel/next.js
- Next.js docs: https://nextjs.org/docs
- `supabase/supabase-js`: https://github.com/supabase/supabase-js
- Supabase docs: https://supabase.com/docs
- Supabase Auth quickstart: https://supabase.com/docs/guides/auth/quickstarts/nextjs

---

# Final recommendation

For the hackathon, the cleanest winning build is:

**Radar + one external docs workflow + one ChatGPT widget + one patch loop + your own repo as the seed skill bank.**

That is ambitious enough to impress, but small enough to finish.
