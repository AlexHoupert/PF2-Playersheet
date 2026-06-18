# Migration Wave: Maps, Progress, Camping

Last updated: 2026-06-18.

## Scope

This wave migrates campaign-scoped Maps, Progress, and Camping writes from broad `updateActiveCampaign`/legacy snapshot paths to `CampaignContext.dataActions`.

Out of scope:

- V2 default switch.
- Firestore write migration.
- Asset migration for uploaded map files.
- Pacts, bestiary reveal-state, and global/custom catalog data.

## Step 1: Maps

Status: implemented.

Changes:

- Added `src/shared/db/domain/mapReducers.js` for map creation, updates, soft delete, restore, ordering, image URL writes, pin upsert/delete, and scale writes.
- Added `mapRepo` to `src/shared/db/v2/repositories.js` for targeted `campaigns/{campaignId}/maps/{mapId}` writes and multi-map reorder transactions.
- Added `dataActions.map` in `src/shared/db/domain/createDataActions.js`.
- Extended `CampaignContext` view-model filtering through `buildCampaignViewModel`: active maps are exposed as `activeCampaign.maps`, archived maps as `activeCampaign.archivedMaps`.
- Changed V2 legacy projection sorting for maps to `order -> name -> id` instead of `name -> id`.
- Migrated `src/admin/MapAdminView.jsx` to `dataActions.map` and added an archived-map restore section.
- Added reducer and migration projection tests for map soft delete, restore, pins, scale, and V2 map ordering.

Assessment:

- Map runtime writes no longer need broad V2 legacy-diff writes.
- Soft-deleted maps are hidden from normal admin/player lists and remain restorable.
- Map upload remains intentionally outside the domain layer; only the final `imageUrl` is persisted.
- Pin deletion is still physical inside the map document. This is acceptable for this wave because the soft-delete requirement applies to maps, not individual pins.

## Step 2: Progress

Status: implemented.

Changes:

- Added `src/shared/db/domain/progressReducers.js` for default normalization, generic progress updates, active-only read projections, and top-level progress archive/restore.
- Added `dataActions.progress.updateProgress/softDeleteEntry/restoreEntry`.
- Migrated `src/admin/ProgressAdminView.jsx` from `updateActiveCampaign` to `dataActions.progress`.
- Added restore sections for archived Factions, Research Topics, Calcifer Stages, and Material Elements.
- Migrated `src/player/views/ProgressView.jsx` to the domain reducer with `activeOnly`, so archived top-level entries are hidden from player views.
- Added reducer tests for progress updates, top-level archive/restore, nested data preservation, and active-only filtering.

Assessment:

- Progress writes are now targeted Campaign-document updates in V2 and no longer require broad legacy-diff writes.
- The model intentionally keeps `progress` on the Campaign document because it is campaign metadata and not yet large or conflict-heavy enough to justify subcollections.
- Soft delete is limited to top-level entities: `reputation.factions`, `research.topics`, `calcifer.stages`, and `materials.elements`.
- Nested records such as ranks, perks, info points, boons, tiers, and items still use physical array removal. This keeps the wave scoped and matches the implementation plan.

Checks:

- `npm test`: passed, 18/18.
- `npx vite build`: passed. Existing large chunk warning remains.

## Step 3: Camping

Status: implemented.

Changes:

- Added `src/shared/db/domain/campingReducers.js` for camping settings, activity upsert/archive/restore/reset, activity assignments, roll results, and unassign.
- Added `dataActions.camping.updateSettings/upsertActivity/deleteActivity/restoreActivity/resetDefaultActivity/assignActivity/recordActivityRoll/unassignActivity`.
- Migrated `src/camping/CampingAdminView.jsx` from `updateActiveCampaign` to `dataActions.camping`.
- Added archived Custom Activity restore UI in the Camping admin view.
- Migrated `src/camping/CampingView.jsx` assignment, roll, and unassign writes to `dataActions.camping`.
- Updated `src/camping/campingData.js` so deleted activities are excluded from merged defaults/custom activities.
- Updated `src/camping/CampScreen.jsx` to recognize assignments by `characterId` or legacy `characterName`.
- Added reducer tests for settings, activity archive/restore/reset, assignment conflict protection, roll recording, and unassign.

Assessment:

- Camping writes are now targeted Campaign-document updates in V2 and no longer require broad legacy-diff writes.
- Assignments now store `characterId` and `characterName`; old name-only assignments remain readable.
- Assignment conflict checks run in the pure reducer, so V2 transaction retries see the latest Campaign document before accepting writes.
- Custom Activity delete is soft delete. Default Activity reset physically removes only the override record, leaving the built-in default intact.

Checks:

- `npm test`: passed, 19/19.
- `npx vite build`: passed. Existing large chunk warning remains.
