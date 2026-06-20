# Known Risks And Modernization Notes

Last updated: 2026-06-20.

## Highest-Impact Risks

1. Large integration components

The worst route/component files have been cut into shells/controllers/layouts:

- `src/player/PlayerApp.jsx` is a route shell; `PlayerAppController.jsx` is now a smaller orchestrator backed by `src/player/hooks/`.
- `src/admin/AdminApp.jsx` delegates tab content to `AdminTabContent.jsx`.
- `src/admin/ItemsView.jsx` delegates rendering to `items/ItemsViewLayout.jsx`.
- `src/admin/EncounterView.jsx` delegates sidebar/info panel rendering to `encounter/EncounterPanels.jsx`.

The residual risk moved to the new hooks and controller/layout files. Continue extracting focused pure helpers while touching specific workflows.

2. Compatibility viewmodels as hidden contract

The `v2-convergence` branch starts Firestore V2 directly. `CampaignContext` now builds the normal runtime view from `v2Store`, but many screens still receive compatibility-shaped data. New V2 collections or fields must be added to the V2 store composition and selectors before they are safe UI contracts.

Global-facing reads for shop, pacts, abilities, lore, and bestiary are centralized in selectors, and a native V2 view model exists in `dbStatus.v2ViewModel`. Continue shrinking compatibility props until views consume native V2 selectors directly.

3. Mixed item identity

Inventory and loot code sometimes uses `name`, sometimes `_index`, sometimes `instanceId`, sometimes `addedAt` plus equipment/prepared flags. This can break stacked items, duplicate items, and transfer/claim flows.

4. Legacy write compatibility

Normal UI write paths for Campaign/Session, Character/Inventory/Loot, Quests/Rewards, Encounters, Maps, Progress, Camping, shop/trader, global custom content, Pacts, Abilities, Lore, Bestiary, actor effects, companion actors, and Player runtime fallbacks now use `dataActions` and targeted repositories. UI and context broad writes are guarded against regressions; broad writes remain only in the `createDataActions` legacy adapter used by legacy tests/import compatibility.

5. Generated data size and source duplication

Generated catalog files are large. It is easy to accidentally import a full catalog into the bundle or commit ignored/generated heavy files. Keep list views on compact indexes and details on lazy resource fetches.

Vite now isolates major catalog decoders into explicit data chunks (`ability-index`, `shop-index`, `creature-index`, `feat-index`, `spell-index`, `impulse-index`, `action-index`) and loads `icon_catalog.json` as a JSON asset. Do not reintroduce broad static imports from utility modules like clipboard helpers or shared editors; use dynamic imports for optional catalog dropdowns/detail paths.

## Data And Migration Risks

- `migrateDb` mutates the input object in place by design. Be careful when calling it with shared references.
- Character runtime defaults and old skill names are normalized in `src/shared/db/domain/characterShape.js` during load, V2 migration, create, and update paths.
- Player basis edits for gold, attributes, current/temp/max HP, speed, Class DC, Formula Book daily batch limits, saves/skills, weapon/armor proficiencies, spell/impulse proficiencies, magic slots, and armor/shield state use targeted Actor-backed methods. Keep direct nested writes for these fields out of Player modals and views.
- Remaining Player UI-local edit paths are compound inventory flows that may update inventory, gold, HP, prepared items, staff/wand recharge, formulas, or item state together. They write PC Actors in V2 through the character compatibility facade, but should be split into narrower inventory/actor actions when touched.
- PC character lifecycle and migrated PC writes target campaign-scoped `actors(kind="pc")`; companion snapshots are backfilled as owned actors and `CompanionTab` now edits owned actors directly. Old character documents can remain as transition/import data but should not be runtime write targets.
- Conditions are campaign-scoped `actorEffects` for Player Stats, ConditionsModal, Admin CharacterCard backlash, mutagen effects, and companion conditions. The legacy projection still overlays character conditions for compatibility/import surfaces only.
- Catalog overrides are the production-safe write target for deployed item/spell/action/feat/impulse/ability/creature editing. Static resource file APIs should stay local-dev only.
- Wands are reusable inventory items with `system.wand = { charges, max }`, not consumable stacks. Inventory double-tap and spell detail casting should reduce charges only; Daily Preparation recharges them. Keep wand detection centralized in `src/shared/utils/wandUtils.js`.
- Scaly Skin is currently represented as a generated feat effect inside the shared AC calculation: while unarmored or wearing Explorer's Clothing, it adds item AC and applies Dex cap +3 through the effect resolver. It should eventually become a persisted template-driven feat effect.
- The shared effect resolver now handles typed bonus/penalty stacking, caps, persistent damage, and resistance/weakness offsets for the first actor-effect foundation. It is not yet a full PF2e rules engine, and not every PF2e condition has complete modifiers yet.
- Root `quests` and `lootBags` still exist for compatibility. Some code paths may read them when campaign data is absent.
- Player-created custom item catalog registration uses `dataActions.globalContent.saveCustomItem`. The immediate inventory add still uses `onUpdateCharacter`.
- Campaign, character, quest/subquest, encounter, and map deletion is soft delete. Do not hard-delete these documents unless a future purge flow is explicitly designed and approved.
- `CampaignContext.updateActiveCampaign` has been removed from the public context API.
- Broad UI and context writes are guarded by `scripts/check_broad_writes.js`; see `docs/agent/migration-backlog.md`.
- The broad-write guard also rejects runtime `character.conditions`, `character.companion`, root `db.characters`, broad V2 diff writes, and unguarded production `/api/files/save`.
- Quest rewards are idempotent and not automatically rolled back when objectives are later marked incomplete.
- Quest reward notifications are campaign-scoped; root `notificationQueue` remains only a legacy fallback.
- `ItemsView` trader, availability/formula, custom-item, loot-bag, and character assignment paths have been moved to `dataActions`.
- User assignment is keyed by email in legacy DB and by member documents in v2. Email casing is normalized in v2 member docs.
- `src/data/new_db.json` includes real-looking user email assignments. Avoid exposing or expanding this data unnecessarily.
- Firestore rules now cover campaign `actors`, `actorEffects`, `effectTemplates`, and top-level `catalogOverrides`. They do not visibly permit legacy `data/master`; verify deployed rules before relying on legacy cloud writes.

## UI Risks

- Many flows use `alert`, `confirm`, and `prompt`; these are hard to test and inconsistent with the rest of the UI.
- Several files display symbol/emoji strings. Terminal output showed mojibake in multiple files. Verify browser rendering and actual file encoding before changing visible text.
- `dangerouslySetInnerHTML` is used for parsed PF2e content. It assumes local/trusted PF2e JSON and custom content. Review before accepting arbitrary HTML input.
- Inline styles are widespread, especially in older screens. New UI should match existing style but avoid adding more complexity when a CSS file already exists for that feature.
- Player swipe navigation can conflict with embedded scrollable/detail controls if event boundaries are not handled.

## Code Quality Risks

- There is no lint script. `npm run check` currently covers tests, broad-write guard, and Vite app build.
- Tests now cover v2 migration, domain reducers, global content reducers, data-action adapters, selectors, and the broad-write guard.
- `handleRebuild` in `AdminApp.jsx` currently logs the request instead of fully using the server rebuild API.
- Debug logging remains in several runtime paths.
- Catalog builder scripts have duplicated dictionary/recursive traversal patterns.

## Security And Operations Risks

- Dev server file APIs can save, create, delete, list, and upload under the project/resource tree. They guard against path traversal but should remain dev/admin-only.
- `server/index.js` uses `exec` for rebuild commands. It maps a limited set of route params to known npm commands, which is good; keep it constrained.
- Firestore v2 migration writes many documents and creates backups. Never run write migration without explicit approval and a backup plan.
- The convergence branch starts V2 directly, but it is not yet production-cutover ready. Use `docs/agent/v2-default-readiness.md` before deploying it as the main play branch.
- LocalStorage is the first load path. Browser state can mask seed or Firestore changes during manual testing.

## Modernization Opportunities

Short-term:

- Add docs and tests for new migration fields.
- Extract inventory identity helpers and reuse in player/admin/loot paths.
- Continue moving remaining Player UI-local edit paths to targeted character or inventory actions when those workflows are touched.
- Restore/admin-wire rebuild status to `/api/admin/rebuild-index/:type` if needed.
- Replace stale analysis comments in `AdminApp.jsx` with actionable TODOs or remove them.

Medium-term:

- Keep shrinking large controller hooks, especially `usePlayerInventoryActions`, into smaller pure reducers/helpers as workflows are touched.
- Make player catalog modals async-data driven so `PlayerApp` does not synchronously import shop/spell/feat/action/impulse indexes.
- Continue shrinking compatibility reads and the legacy projection before treating the convergence branch as production-ready.
- Add smoke tests for catalog decoders and `parseFoundry`.
- Add a minimal lint/format check to catch import and JSX issues.

Long-term:

- Treat Firestore V2 as the only runtime store and isolate legacy as import/backup code after migration is proven.
- Replace browser prompts with shared modal primitives.
