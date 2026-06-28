# Architecture Notes

Last updated: 2026-06-28.

## Runtime Shape

The app is a single Vite React SPA behind a custom Express server during development. The server exists because the app needs more than static Vite behavior:

- `GET /api/static/*` serves raw files from `ressources/`.
- `/api/files/*` supports local admin/editor file operations.
- `/api/admin/rebuild-index/:type` runs catalog build scripts.
- Vite middleware handles the SPA after API/static routes.

Production build uses `vite build`, then `scripts/copy_ressources_to_dist.js` copies the full `ressources/` tree to `dist/ressources/`. Runtime fetch helpers switch between `/api/static` in dev and `/ressources` in production.

## React Entry Tree

`src/main.jsx`:

- Imports global `App.css`.
- Wraps `App` in `AuthProvider`.

`src/shared/auth/AuthProvider.jsx`:

- Uses Firebase Auth `onAuthStateChanged`.
- Blocks the app behind `LoginView` until authenticated.
- Exposes `user` and `logout`.

`src/App.jsx`:

- Starts `useFirestoreV2Db(dbData)` directly on the `v2-convergence` branch.
- Legacy `usePersistedDb` is no longer selected by the normal app entry; it lives under `src/shared/db/legacy-import/` for import/backup/reference code.
- The normal app runtime reads from V2 documents and `CampaignContext` V2 viewmodels. Legacy projection code is isolated to `src/shared/db/v2/legacyProjection.js` for tests/import helpers.
- See `docs/agent/v2-default-readiness.md` before deploying the convergence branch as the main production path.
- Selects route through query params:
  - `?party=true` -> `PartyScreen`.
  - `?camp=true` -> `CampScreen`.
  - `?admin=true` -> `AdminApp`.
  - default -> `PlayerApp`.
- Wraps all route targets in `CampaignProvider`.

## Campaign Context

`src/shared/context/CampaignContext.jsx` is the main bridge between auth, full DB, and UI:

- Reads `db.users[user.email]` to determine role and assignments.
- Treats route-level admin/party/camp contexts as GM-capable.
- Persists GM-selected campaign in LocalStorage key `gm_selected_campaign`.
- Derives:
  - `campaigns`
  - `activeCampaign`
  - `activeCampaignId`
  - `myCharacter`
  - `myActor`
  - `actors`
  - `archivedActors`
  - `isGM`
  - `userInfo`
- Provides:
  - `setSelectedCampaignId`
  - `createCampaign`
  - `deleteCampaign`
  - `assignUser`
  - `dataActions`

Runtime writes should go through `dataActions`. `CampaignContext` no longer exposes a broad `updateActiveCampaign` escape hatch.

## Major UI Shells

`src/player/PlayerApp.jsx` and `src/player/PlayerAppController.jsx`:

- `PlayerApp.jsx` is the lazy route shell.
- `PlayerAppController.jsx` selects the active character, renders tabs, and orchestrates child views.
- Focused hooks under `src/player/hooks/` own navigation, modal state, catalog inspection/detail loading, character action wrappers, inventory/catalog handlers, and temporary runtime repair.
- Delegates display to `src/player/views/*`, `src/player/sections/*`, and `src/player/modals/*`.

`src/admin/AdminApp.jsx`:

- Main GM shell.
- Uses `Sidebar` and `Breadcrumbs`.
- Routes tabs to admin resource views.
- Manages player cards/users, XP notification, modal details, and system tools.
- Uses shared `ModalManager` for item/spell/feat/impulse detail style.

`src/player/PartyScreen.jsx`:

- Read-only player-facing encounter display for `?party=true`.
- Shows visible combatants from the active encounter.
- Uses `InitiativeCard`, `CreatureCard`, and `CharacterCard`.
- Fetches creature detail lazily via `creatureIndex` helpers.

`src/camping/CampScreen.jsx`:

- Public camp overview for `?camp=true` and embedded player camp overlay.
- Reads `activeCampaign.camping`.

## Shared Modal Pattern

`src/player/ModalManager.jsx` is used by both player and admin paths. Changes to modal modes can affect:

- Player stats/items/actions/magic flows.
- Admin detail previews.
- `CharacterCard` interactions in admin and party views.

Catalog content links are produced by `parseFoundry` as spans with `.content-link`, `data-type`, and `data-name`. Both `PlayerApp` and `AdminApp` attach click handlers that resolve these links via catalog helpers.

## Data Flow

The V2 convergence runtime has a native V2 store and selector-backed compatibility viewmodels where old screens still need older shapes. Runtime UI writes should not call broad DB setters:

1. User action calls local handler.
2. Handler calls a scoped `dataActions` method.
3. The V2 adapter writes targeted Firestore v2 documents or transactions.
4. `CampaignContext` re-derives active campaign and user data.

The old broad write model is confined to the legacy adapter branch in `createDataActions` and import/migration code.

## Design Implications For Future Work

- Prefer moving reusable domain operations out of `PlayerApp.jsx` and `AdminApp.jsx` only when touching that workflow anyway.
- For new campaign-scoped data, add defaults in `migrateDb`, project it in v2 normalizers if needed, and document its shape.
- For features touching both player and admin, introduce small shared helpers first, then wire UI.
- When changing route/query behavior, keep `AppRoutes` and `CampaignProvider` assumptions in sync.
