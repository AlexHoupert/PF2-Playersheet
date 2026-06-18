# Architecture Notes

Last updated: 2026-06-16.

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

- Selects data mode:
  - legacy: `usePersistedDb(dbData)`.
  - v2: `useFirestoreV2Db(dbData)` when `?db=v2` or `VITE_DB_MODE=v2` is set.
- Legacy is still the default. See `docs/agent/v2-default-readiness.md` before changing the default.
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

Legacy compatibility still has a top-level `[db, setDb]` pair, but runtime UI writes should not call it directly:

1. User action calls local handler.
2. Handler calls a scoped `dataActions` method.
3. The selected adapter applies the shared reducer to legacy data or writes targeted Firestore v2 documents.
4. `CampaignContext` re-derives active campaign and user data.

The old broad write model is now confined to the legacy adapter in `createDataActions` and the v2 compatibility diff layer.

## Design Implications For Future Work

- Prefer moving reusable domain operations out of `PlayerApp.jsx` and `AdminApp.jsx` only when touching that workflow anyway.
- For new campaign-scoped data, add defaults in `migrateDb`, project it in v2 normalizers if needed, and document its shape.
- For features touching both player and admin, introduce small shared helpers first, then wire UI.
- When changing route/query behavior, keep `AppRoutes` and `CampaignProvider` assumptions in sync.
