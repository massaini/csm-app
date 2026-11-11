# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## State of the repo

**CSM Fila Digital** — a digital queue for truck drivers at CSM (road freight carrier): drivers generate a password ("senha") at the yard, follow their position and get called to a loading bench ("bancada"); admins run the queue from a web panel. Scope of the current cycle: **MVP da Fila only** (driver PWA + admin panel). Availability, Demonstrativo/Acareação and Google Sheets are out of scope.

The product is **specified but not yet scaffolded**: no `package.json`, `src/` or `prisma/` exist at the time of writing (PRD approved, project setup is the next step). Until the scaffold lands there is nothing to build, lint or test — re-check with `ls` before assuming either way.

Source of truth, in order:
1. **`docs/PRD.md`** (v0.5, approved, committed) — requirements (RF/RNF with acceptance criteria), domain model, state machine, formulas, tech spec, test strategy, design tokens. Read the relevant section before implementing; do not re-derive rules from the Figma.
2. **Figma** file key `TSxGXyq7qLD3K4aCGtfjZD` (`CSM-fila-motorista`, student-tier account; the Starter-tier copy `TsxJquZYqYarMTrOligbTu` is stale) — validated by the client; UI is implemented faithfully from it, except for the deviations listed in PRD §10.6. Read it through the Figma MCP (`get_screenshot`, `get_metadata`, `get_design_context`, `get_variable_defs`) with the `figma-implement-design` skill. Cite screens by **node id** (`233:440`), never by number — Figma has two frames named "03".
3. **`docs/CONTEXTO.md`** — business context and client decisions. **Git-ignored on purpose** (see `.gitignore`); never commit it or move its content into tracked files verbatim.

`PROGRESS.md` is a log of the earlier Figma-only phase and is partly stale. `SKILL.md` at the root is stray skill-installer output; `.agents/`, `.claude/skills/`, `skills-lock.json` are tooling (the `figma` skill is for HyperFrames video work — irrelevant here). `assets/logoCsm.png` is the brand logo (source for PWA icons).

## Commands

Target scripts, defined in PRD §9.5 (they exist only after the scaffold; verify in `package.json`): `npm run dev | build | start | lint | typecheck | test | test:e2e | test:load | test:ca-coverage | db:migrate | db:deploy | db:seed | admin:transferir-super | admin:redefinir-senha`.

- Package manager is **npm** (pnpm is not installed). Node 22.
- Run one Vitest file/test: `npx vitest run path/to/file.test.ts -t "RF13-CA2"`; one Playwright spec: `npx playwright test path/to/spec.ts`.
- `test:ca-coverage` fails if any `RFxx-CAy` / `RNFxx-CAy` of the PRD is missing from a test name (or `docs/checklist-manual.md`), and `skip`/`todo` tests do not count. **Name every test with its CA id**, e.g. `it('RF13-CA2: aceita Estou a caminho até prazo + carência')`. PRD §9.6 assigns each CA to unit / integration / E2E / load / manual.

## Pinned stack (do not "upgrade")

Next.js 16.4 (App Router) · React 19 · **TypeScript 5.9.3** (7.x breaks the `typescript-eslint` required by `eslint-config-next` 16, which needs `< 6.1`) · **Prisma 7.10** with `@prisma/adapter-pg` (8.x is still RC) · PostgreSQL 16+ (Railway) · Tailwind 4 · Zod 4 · `@node-rs/argon2` · `web-push` · Vitest 5 · Playwright. Deploy target is Railway (staging + production); pre-deploy runs `db:deploy && db:seed`.

## Architecture (the parts that span files)

Single Next.js monolith: Server Components for reads, Server Actions/route handlers for mutations. Planned layers: `src/domain/` (pure rules + an injectable `Clock`, no I/O), `src/server/` (db, auth, push, realtime, jobs), `src/app/(motorista)/` and `src/app/admin/` (screens), `src/components/ui/` (design-system components).

**Senha state machine** (PRD §6.0) — `AGUARDANDO → CHAMADA → EM_ATENDIMENTO → CONCLUIDA`, with `CANCELADA` (motivos `MOTORISTA`, `EXPIRADA`, `FIM_DO_DIA`, `MOTORISTA_DESATIVADO`). Rules that are easy to break:
- Every transition is `UPDATE … WHERE id = ? AND status = <esperado>` (`CHAMADA → EM_ATENDIMENTO` also checks `prazoEm + carência >= agora`); zero rows = `CONFLITO`. Mutations return `{ ok, codigo, estado }`; `CONFLITO` is HTTP 409 in route handlers. The driver UI never shows it as an error — it renders the returned `estado`.
- **Status efetivo**: reads *compute* expiry (a `CHAMADA` past `prazoEm + carenciaSeg` is treated as `EXPIRADA`) without writing; every *write* touching such a senha persists the expiry first, in the same transaction. A 30 s job (started in `instrumentation.ts`, guarded by `NEXT_RUNTIME === 'nodejs'`) persists the rest and must be idempotent/safe with two instances (Railway overlaps deploys).
- One active senha per driver (partial unique index, hand-written SQL migration — Prisma can't express `WHERE` in `@@unique`) and one `CHAMADA`/`EM_ATENDIMENTO` per **bancada** (a bench serves one driver at a time).
- `prazoEm` is stored at call time, so changing `toleranciaMin` never affects calls already made. Senha rows snapshot driver/galpão/bancada/rota names at creation.
- Queue is FIFO **per bancada**; the bancada comes from the driver's fixed *região* mapped per galpão. Estimated time = `(posição − 1) × média do dia` (average of `concluidaEm − chamadaEm` of the galpão's concluded senhas that day, excluding `concluidaPor = SISTEMA` and durations above `ocupacaoMaxMin`).
- **Dia operacional** (senha codes, "hoje" KPIs, daily rollover) runs in `America/Sao_Paulo` from env `HORA_VIRADA` (default `00:00`). Compute day/fortnight bounds in one domain function and pass them as query params; **never** use `CURRENT_DATE`/`now()` in SQL. All instants are `@db.Timestamptz`.
- Geofence is checked server-side on senha generation only (haversine to the galpão's *Local*; galpões sharing an address share a Local and radius). Admin can grant a manual release (`LiberacaoGeofence`). GPS spoofing is an accepted risk.

**Real time**: each mutation does `NOTIFY`; a dedicated `pg` connection `LISTEN`s and fans out via SSE (`/api/stream`, heartbeat 20 s, `no-transform`). Events only *invalidate* — clients refetch a light JSON (`/api/fila/estado`) on each event, reconnect and `visibilitychange`; polling every 4 s is the fallback. Don't use `router.refresh()` per event.

**Push/PWA**: Web Push (VAPID); `urgency: high`, TTL = tolerância, `Topic` ≤ 32 chars. Service worker handles push only — **no caching** of `/_next/` or HTML (breaks installed apps after a deploy). iPhone needs the PWA installed (iOS 16.4+); Android is the main audience.

**Auth**: CPF + password for drivers and admins (the Figma prototype/older notes saying "nome + CPF" are wrong). Admin creates users with a temporary password (72 h, forced change); roles `ADMIN` and a single `SUPER_ADMIN`. Deactivating a user or resetting a password deletes their sessions and push subscriptions. CPF never in URLs/query strings (search and CSV export use POST) and masked in logs.

**Galpões (5)**: F SDR and SP-R-D228 (the Anjun) at Av. André Ramalho 89; DS AET at Av. André Ramalho 95; F SDR 03 and DS SDE at Av. dos Estados 6761. Display name for Anjun is **"SP-R-D228"**. The seed only *creates* missing rows and must never overwrite configuration, radius or the super-admin password.

**Testing time-dependent flows**: Playwright's `page.clock` only controls the browser; with `E2E=1` the server exposes a test endpoint to advance the server `Clock` and tests advance both.

## Design system

Tokens live in PRD §10 (dark theme only; `color/*`, `spacing/*`, `radius/*`, Inter text styles) and must be exposed as CSS variables/Tailwind `@theme`. Components mirror the Figma component sets (`Button`, `Chip`, `Info Row`, `Input Field`, `Stat Card`, `History Item`, `Alert Banner`, `Option Card`, `Tab Bar`, `Sidebar`). Screens the Figma lacks (admin login, password change, notifications opt-in, install, "em breve", registrations, result screens) are built from these components; their copy is in PRD §10.5. Domain vocabulary: **bancada** (not "doca"), **galpão**, **rota/região**, **senha**.

## Editing the Figma file (`use_figma` quirks)

Only relevant when changing the design file, not the app.
- Resolve variables with the full prefixed id (`VariableID:1:31`); a bare `"1:31"` makes `setBoundVariableForPaint` silently return an unbound paint.
- Paint opacity on a bound-variable paint doesn't stick if set in the same literal: attach the paint first (`node.fills = [paint]`), then re-set `node.fills = [{...node.fills[0], opacity: 0.15}]`. This applies to master components too (e.g. `Chip` tint).
- `node.clone()` of a variant doesn't copy `componentPropertyReferences` on TEXT children; re-link them **after** `componentSet.appendChild(clone)`, not before.
- `setReactionsAsync` rejects a destination equal to the containing top-level frame — skip the tab that points to the current screen when wiring Tab Bar reactions in a loop.
- Overlay reactions: dismiss action is `{ type: 'CLOSE' }` (not `'CLOSE_OVERLAY'`); `overlayRelativePosition` only validates with `overlayPositionType = 'MANUAL'`; `overlayBackgroundInteraction`/`overlayPositionType`/`overlayBackground` are read-only in the Plugin API (set them in the Prototype panel).
- `SectionNode` children use coordinates **relative to the section origin**; `appendChild` doesn't preserve the visual position. Write `x = padding + col*pitch`, never `section.x + …`, and verify with `absoluteBoundingBox`.
- `figma.createAutoLayout()` frames have a white fill by default — set `frame.fills = []` on layout-only containers.
- Keep a **single** prototype starting point (the login screen).
