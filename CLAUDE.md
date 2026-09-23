# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repository is

This is **not an application codebase**. There is no source code, package manager, build step, linter, or test suite — there is nothing to build, lint, or run. The repo is a lightweight staging area for the **CSM Fila Digital** project: a digital queue app for truck drivers at CSM (a road freight carrier), designed to replace the manual wait for loading-dock calls.

All actual product design work happens in **Figma**, not in this repo, via the Figma MCP tools (`use_figma`, `get_metadata`, `get_screenshot`, `create_new_file`, `upload_assets`, etc.). Treat this repo as a place to stash assets referenced by the Figma file and to keep notes — not as the source of truth for the UI.

## Repository contents

- `assets/logoCsm.png` — the CSM brand logo, uploaded into the Figma file as an image fill (imageHash `6a6f970dc23c0e380fa0ef2b23b21682c79288b0` in the current file). If the logo needs to change, replace this file and re-upload via `upload_assets`, then update the fill on every frame that references the old hash.
- `.agents/skills/`, `.claude/skills/`, `skills-lock.json` — Claude Code skills installed for this project (`figma` from `heygen-com/hyperframes`, `figma-implement-design` from `openai/skills`). These are tooling, not project code. Note: the `figma` (hyperframes) skill is for importing Figma content *into a video/motion composition* — it is unrelated to building the Figma design itself; use the built-in `use_figma` MCP tooling (`figma-use` skill) for that.
- `SKILL.md` at the repo root is stray output from the skill installer, not project documentation.

## The Figma file

The live design lives in a Figma file owned by the project's Figma **student** account (tier `student`), file key `TSxGXyq7qLD3K4aCGtfjZD` (`CSM-fila-motorista`). An earlier copy exists under a separate Starter-tier account (file key `TsxJquZYqYarMTrOligbTu`) — that one is stale; work happens in the student-account file now, since the Starter plan hits MCP rate limits quickly.

File structure (pages, top to bottom):
1. **`00 · Cover`** — project title, scope, and a numbered list of usability improvements made versus the original static prototype (a Vercel-hosted reference page showing the driver queue screen).
2. **`01 · Design System`** — token foundations: color swatches (Primitives + Semantic), the Inter type ramp, spacing bars, and radius samples. Backing variable collections: `Primitives` (20 raw colors), `Semantic` (14 aliased tokens: `color/bg`, `color/surface`, `color/primary`, `color/text-*`, `color/border*`, `color/success|warning|danger`, all Dark-mode only), `Spacing` (`xs`…`4xl`), `Radius` (`sm`…`full`). Text styles: `Display/*`, `Title/*`, `Body/*`, `Caption`, `Overline`, `Button/*`.
3. **`02 · Motorista — Fluxo v1`** — the 8-screen mobile flow (390×844 frames), wired together as a Figma prototype with the starting point on screen 01:
   `01 · Identificação` → `02 · Fora do raio` (geofence blocked) → `03 · Gerar senha` → `04 · Aguardando` (auto-advances) → `05 · Chamado` → `06 · Em atendimento` (auto-advances) → `07 · Concluído` → `08 · Histórico` (reachable from the header on `03` and `08`).
4. **`03 · Componentes`** — reusable component sets consumed as instances across all 8 screens: `Button` (Kind: Primary/Secondary/Reversed/Danger × State: Default/Disabled), `Chip` (Tone: Success/Warning/Primary/Neutral), `Info Row`, `Input Field` (State: Default/Filled/Focused), `Stat Card` (Tone: Default/Primary), `History Item` (Status: Concluído/Cancelada), `Alert Banner`. All are bound to the Semantic/Spacing/Radius variables and the shared text styles — changing a token updates every instance.

### Known quirk when editing via `use_figma`

`figma.variables.setBoundVariableForPaint(paint, 'color', variable)` silently produces an **unbound** paint (falls back to the literal color, usually invisible on dark backgrounds) if `variable` is `null` — which happens if `getVariableByIdAsync` is called with a bare short ID (`"1:31"`) instead of the full prefixed ID (`"VariableID:1:31"`). Always resolve variables with the `VariableID:` prefix.

Also: `Chip` instances lose their semi-transparent background (opacity 0.15) on creation — reapply `instance.fills = [{...instance.fills[0], opacity: 0.15}]` after instancing.
