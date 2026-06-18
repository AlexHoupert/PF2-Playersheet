# Known Risks And Modernization Notes

Last updated: 2026-06-18.

## Highest-Impact Risks

1. Large integration components

`src/player/PlayerApp.jsx`, `src/admin/AdminApp.jsx`, and `src/admin/ItemsView.jsx` contain many unrelated workflows. Changes in one handler can affect persistence, modals, catalog fetches, and UI state. Prefer extracting focused helpers while touching specific workflows, not broad rewrites.

2. Legacy projection as hidden contract

Most screens still expect the legacy `db` shape. Firestore v2 mode projects normalized documents back to that shape. New v2 collections or fields must be added to both normalization and composition if they should survive runtime writes.

3. Mixed item identity

Inventory and loot code sometimes uses `name`, sometimes `_index`, sometimes `instanceId`, sometimes `addedAt` plus equipment/prepared flags. This can break stacked items, duplicate items, and transfer/claim flows.

4. Whole-DB writes in normal UI paths

Some v2 runtime writes still diff whole legacy DB snapshots. Campaign/Session, Character/Inventory/Loot, Quests/Rewards, Encounters, Maps, Progress, and Camping now use `dataActions` and targeted repositories, but pact/bestiary/global domains still need migration.

5. Generated data size and source duplication

Generated catalog files are large. It is easy to accidentally import a full catalog into the bundle or commit ignored/generated heavy files. Keep list views on compact indexes and details on lazy resource fetches.

## Data And Migration Risks

- `migrateDb` mutates the input object in place by design. Be careful when calling it with shared references.
- Runtime character defaults in `PlayerApp.jsx` directly mutate the selected character object before render. Moving this into migration would be cleaner.
- Root `quests` and `lootBags` still exist for compatibility. Some code paths may read them when campaign data is absent.
- `InventoryView` still receives `onSetDb` for player-created custom item catalog registration. The immediate inventory add uses `onUpdateCharacter`, but global custom item storage remains legacy/global.
- Campaign, character, quest/subquest, encounter, and map deletion is soft delete. Do not hard-delete these documents unless a future purge flow is explicitly designed and approved.
- `CampaignContext.updateActiveCampaign` remains a broad compatibility helper for non-migrated campaign child domains. Do not use it for new Campaign/Session lifecycle work.
- Pacts, abilities, lore, bestiary custom content/reveal-state, and global catalog settings still have direct/broad `setDb` paths.
- Quest rewards are idempotent and not automatically rolled back when objectives are later marked incomplete.
- Quest reward notifications are campaign-scoped; root `notificationQueue` remains only a legacy fallback.
- `ItemsView` trader/global catalog behavior remains legacy/global. Loot-bag and character assignment paths have been moved to `dataActions`.
- User assignment is keyed by email in legacy DB and by member documents in v2. Email casing is normalized in v2 member docs.
- `src/data/new_db.json` includes real-looking user email assignments. Avoid exposing or expanding this data unnecessarily.
- Firestore rules document v2 access but do not visibly permit legacy `data/master`. Verify deployed rules before relying on legacy cloud writes.

## UI Risks

- Many flows use `alert`, `confirm`, and `prompt`; these are hard to test and inconsistent with the rest of the UI.
- Several files display symbol/emoji strings. Terminal output showed mojibake in multiple files. Verify browser rendering and actual file encoding before changing visible text.
- `dangerouslySetInnerHTML` is used for parsed PF2e content. It assumes local/trusted PF2e JSON and custom content. Review before accepting arbitrary HTML input.
- Inline styles are widespread, especially in older screens. New UI should match existing style but avoid adding more complexity when a CSS file already exists for that feature.
- Player swipe navigation can conflict with embedded scrollable/detail controls if event boundaries are not handled.

## Code Quality Risks

- There is no lint script.
- Tests currently cover v2 migration only.
- Some comments in `AdminApp.jsx` appear to be stale analysis notes from a prior edit, especially around a missing `LootView`.
- `handleRebuild` in `AdminApp.jsx` currently logs the request instead of fully using the server rebuild API.
- Debug logging remains in several runtime paths.
- Catalog builder scripts have duplicated dictionary/recursive traversal patterns.

## Security And Operations Risks

- Dev server file APIs can save, create, delete, list, and upload under the project/resource tree. They guard against path traversal but should remain dev/admin-only.
- `server/index.js` uses `exec` for rebuild commands. It maps a limited set of route params to known npm commands, which is good; keep it constrained.
- Firestore v2 migration writes many documents and creates backups. Never run write migration without explicit approval and a backup plan.
- LocalStorage is the first load path. Browser state can mask seed or Firestore changes during manual testing.

## Modernization Opportunities

Short-term:

- Add docs and tests for new migration fields.
- Extract inventory identity helpers and reuse in player/admin/loot paths.
- Move runtime character field defaults into `migrateDb`.
- Restore/admin-wire rebuild status to `/api/admin/rebuild-index/:type` if needed.
- Replace stale analysis comments in `AdminApp.jsx` with actionable TODOs or remove them.

Medium-term:

- Introduce small domain services for campaign, character, inventory, and loot mutations.
- Use v2 repository functions for remaining high-conflict actions like bestiary reveal-state and global/custom content updates.
- Add smoke tests for catalog decoders and `parseFoundry`.
- Add a minimal lint/format check to catch import and JSX issues.

Long-term:

- Split `PlayerApp.jsx` into route shell, modal orchestration, and domain hooks.
- Split `ItemsView.jsx` into catalog table, side panels, context menu, and item actions.
- Treat Firestore v2 as the primary store and remove legacy root compatibility after migration is proven.
- Replace browser prompts with shared modal primitives.
