# Agent Instructions

## Scope

These instructions apply to the whole `PF2-Playersheet` project.

This is an old, active React/Vite Pathfinder 2e campaign tool. Treat it as a live app with persistent campaign data, not as a disposable prototype.

## Required First Reads

Before non-trivial work, read:

- `agent_context.md` for the durable project map and current architectural state.
- The relevant file under `docs/agent/` before changing that area:
  - `docs/agent/architecture.md`
  - `docs/agent/data-and-persistence.md`
  - `docs/agent/catalog-pipeline.md`
  - `docs/agent/ui-flows.md`
  - `docs/agent/known-risks.md`

Keep these docs updated when you learn durable facts or make architectural decisions.

## Commands

- Install dependencies: `npm install`
- Start local app and admin file APIs: `npm run dev`
- Run tests: `npm test`
- Build generated data indexes: `npm run build:data`
- Production build: `npm run build`
- Firestore v2 dry run: `npm run migrate:v2:dry-run`
- Firestore v2 write migration: `npm run migrate:v2`

The dev command runs `server/index.js`, not plain `vite`. Use it when testing catalog fetches, local resource serving, admin file editing, or rebuild APIs.

## Safety Rules

- Do not run `npm run migrate:v2`, legacy master uploads, or any Firestore write migration without explicit user approval.
- Do not manually edit generated catalog files in `src/data/*_index.json` or `src/data/*_catalog.json` unless the task is specifically about generated output. Prefer changing `ressources/` input data or `scripts/build_*.js`, then rebuild.
- Do not commit local backups from `recovery/` or generated `dist/`.
- Be careful with `src/data/new_db.json`: it is the local seed and legacy projection sample. It also contains campaign-like data and user email assignments.
- Preserve user data shape compatibility. Most UI still consumes the legacy projection even in Firestore v2 mode.
- Avoid broad refactors in `PlayerApp.jsx`, `AdminApp.jsx`, and `ItemsView.jsx` unless the task is explicitly structural. They are large integration points with many implicit contracts.
- Prefer `deepClone` or focused immutable updates when modifying nested campaign data. Many existing paths mutate cloned nested objects, so accidental shared mutation is easy.

## Coding Style

- The app uses React 18, Vite, ES modules, plain CSS, and local helper modules.
- Match existing folder boundaries: `player`, `admin`, `shared`, `utils`, `camping`, `pacts`.
- Keep new shared logic in `src/shared/*` only when it is actually used by both player and admin flows.
- Use existing catalog helpers from `src/shared/catalog/` instead of fetching resource JSON directly in UI components.
- Use `parseFoundry` for PF2e/Foundry markup rendering and content links. Check content-link behavior in both player and admin modals.
- Keep UI changes responsive. Admin navigation has separate desktop sidebar and mobile bottom-sheet behavior.

## Verification Expectations

- Run `npm test` after changes touching data migration, normalizers, persistence, or rules helpers.
- Run the narrow build script after changing a catalog builder, for example `npm run build:shop`.
- Run `npm run build` for changes affecting imports, generated data, routing, or deployment output when feasible.
- When changing Firestore rules or v2 persistence on `v2-convergence`, test the V2 runtime path conceptually or manually; legacy is import/backup compatibility, not the normal app runtime.

## Documentation Maintenance

`agent_context.md` should stay short and high-signal. Put deeper details in `docs/agent/`.

When adding docs:

- Record facts that will be useful in later conversations.
- Link to concrete source files and commands.
- Distinguish current behavior from desired future architecture.
- Add risks and follow-up decisions to `docs/agent/known-risks.md`.
