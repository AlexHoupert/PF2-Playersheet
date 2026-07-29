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
- Use the context7 skill when possible, especially for react and shadcn
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

## Firefox Android Layout Checks

- Treat Firefox Android with `Scroll to hide toolbar` enabled as a separate mobile layout target. GeckoView can update the visual viewport and safe-area environment values during taps, scrolling, and toolbar transitions even when Chromium-based mobile browsers remain stable.
- For persistent mobile UI such as dialogs, drawers, sticky footers, and bottom navigation, do not use `dvh` or a dynamic `env(safe-area-inset-*)` directly unless the element is intentionally expected to resize with browser chrome.
- Prefer stable `svh` sizing for bounded modal surfaces. Apply dynamic safe-area padding only in display modes that need it, such as an installed standalone PWA, and keep regular browser-mode footer dimensions stable.
- Before accepting a mobile overlay change, check opening, tapping, vertical scrolling, horizontal swiping, and browser-toolbar hide/show transitions. Watch specifically for blank footer rows, jumping fixed controls, and changing scroll ownership.
- Desktop Playwright Firefox does not reproduce GeckoView's dynamic toolbar. Keep automated layout guards, but record a real-device Firefox Android smoke as required whenever viewport-anchored mobile UI changes.
- Do not introduce portals, VisualViewport JavaScript, or global fixed-position workarounds solely for a Firefox symptom until stable CSS sizing and inset handling have been ruled out.

## Documentation Maintenance

`agent_context.md` should stay short and high-signal. Put deeper details in `docs/agent/`.

When adding docs:

- Record facts that will be useful in later conversations.
- Link to concrete source files and commands.
- Distinguish current behavior from desired future architecture.
- Add risks and follow-up decisions to `docs/agent/known-risks.md`.

## Context7-Fehlerbehandlung

Vor jedem `ctx7 library ...`- oder `ctx7 docs ...`-Abruf zuerst den portablen
Repository-Preflight ausführen:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/ctx7_zscaler_preflight.ps1 -Quiet
```

- Context7 nur bei Exitcode `0` aufrufen.
- Der Preflight darf ausschließlich die bekannte Zscaler-Warnseite
  `CC01` für `Generative AI and ML Applications` automatisch bestätigen.
- Andere Netzwerk-, Policy-, Quota- oder Authentifizierungsfehler darf der
  Preflight nicht umgehen.

Wenn der Preflight mit einem anderen Exitcode endet:

- Context7 nicht aufrufen.
- `Start-Process "https://context7.com/"` ausführen, um die Freigabe im Browser
  zu ermöglichen. Falls der Browser nicht geöffnet werden kann, dem Nutzer die
  URL direkt nennen.
- Exitcode und Fehlermeldung melden und erwähnen, dass die Context7-Webseite
  geöffnet wurde.
- Auf den Nutzer warten. Keine automatische Wiederholungsschleife und keinen
  alternativen Bypass starten.

Nach einem erfolgreichen Preflight und vor dem ersten Context7-Aufruf eines
Tasks zusätzlich die Session prüfen:

```powershell
npx ctx7@latest whoami
```

- Nicht nur den Exitcode prüfen. Enthält die Ausgabe `Not logged in` oder
  `Session may be expired`, gilt die Session als ungültig.
- Bei ungültiger Session `npx ctx7@latest login` starten, den Nutzer darauf
  hinweisen, dass die Anmeldung im Browser bestätigt werden muss, und auf den
  Abschluss des Login-Flows warten.
- Anschließend Preflight und `whoami` erneut ausführen. Erst bei erfolgreichem
  Preflight und gültiger Session mit `ctx7 library ...` oder `ctx7 docs ...`
  fortfahren.

Wenn `ctx7 library ...` oder `ctx7 docs ...` trotz erfolgreichem Preflight und
gültigem `whoami` mit HTTP `401` oder `403`, einer abgelaufenen Session oder
einer vergleichbaren Authentifizierungs-/Autorisierungsmeldung scheitert:

- keine weiteren Analyse-, Implementierungs- oder Refactoring-Passes ausführen,
  die aktuelle externe Dokumentation voraussetzen.
- nicht still auf Trainingswissen, Websuche oder alte lokale Annahmen ausweichen.
- `npx ctx7@latest login` starten und den Nutzer um die Browserbestätigung
  bitten.
- nach der Reauthentifizierung erneut Preflight und `whoami` ausführen.
- erst nach erfolgreichem Preflight, gültigem `whoami` und erfolgreichem
  `ctx7 library ...` / `ctx7 docs ...` fortfahren.

Ziel: Preflight- und Authentifizierungsfehler sollen sichtbar blockieren, statt
zu veralteten oder ungeprüften Implementierungsentscheidungen zu führen.
