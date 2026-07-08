# Migration Backlog

Last updated: 2026-07-08.

This file tracks remaining broad legacy writes after the Character/Inventory/Loot,
Campaign/Session, Quests/Rewards, Encounters, Maps, Progress, Camping,
Global Admin Content, Player Edit Stability, and V2 Convergence foundation waves.
New work should prefer `dataActions` and domain reducers. Broad writes listed here
are compatibility debt, not patterns for new code.

## Guarded Migrated Domains

These UI files must not introduce direct `setDb` or `updateActiveCampaign` writes:

- `src/admin/AdminApp.jsx`
- `src/admin/ItemsView.jsx`
- `src/admin/EncounterView.jsx`
- `src/admin/QuestsView.jsx`
- `src/admin/MapAdminView.jsx`
- `src/admin/ProgressAdminView.jsx`
- `src/admin/AbilitiesView.jsx`
- `src/admin/BestiaryView.jsx`
- `src/admin/LoreAdminView.jsx`
- `src/pacts/DeviantAbilitiesAdminView.jsx`
- `src/pacts/PactAdminView.jsx`
- `src/player/PlayerAppController.jsx`
- `src/shared/context/CampaignContext.jsx`
- `src/player/views/InventoryView.jsx`
- `src/player/views/ProgressView.jsx`
- `src/player/views/PlayerQuestsView.jsx`
- `src/player/views/MapsView.jsx`
- `src/camping/CampingAdminView.jsx`
- `src/camping/CampingView.jsx`
- `src/camping/CampScreen.jsx`

`scripts/check_broad_writes.js` enforces this list.

## Remaining Direct Writes

Only these broad-write files are currently allowed by `scripts/check_broad_writes.js`:

- `src/shared/db/domain/createDataActions.js`: legacy adapter aggregator while the remaining domains are split out.
- `src/shared/db/domain/actionContext.js`: shared legacy adapter infrastructure that intentionally owns `setDb`/legacy snapshot writes for compatibility tests and import-era fallback paths.

Any new broad write outside those files should be treated as a regression.

## Completed In Global Admin Content Wave

- Pacts and Deviant Abilities use `dataActions.pact`.
- Custom Abilities use `dataActions.globalContent`; V2 persists new writes as catalog overrides.
- Lore articles use `dataActions.globalContent` and the `loreArticles` collection.
- Bestiary custom creatures use `dataActions.bestiary`; V2 persists new writes as catalog overrides while old custom creature docs remain readable transition data.
- Bestiary metadata, reveal state, catalog initialization, group changes, and bestiary toggles use `global/config.bestiary.creatures` through `dataActions.bestiary`.
- Player root-notification clearing uses `dataActions.globalContent.clearRootNotification`.
- Player skill-name runtime repair uses `dataActions.character.updateCharacter`.

## Completed In Player Edit Stability Wave

- Player Gold, Attribute, HP, Temp HP, Max HP, Speed, Class DC, and Formula Book daily batch edits use targeted `dataActions.character` basis actions.
- `normalizeCharacterRuntimeShape` initializes missing Player-edit subtrees: `stats.hp`, `stats.speed`, `stats.attributes`, `stats.saves`, `stats.ac`, `stats.proficiencies`, `magic`, `formulaBook`, `languages`, `senses`, and root `proficiencies`.
- Static UI regression tests guard the migrated Player modal fields against expression-bodied direct nested writes.
- Saves/skills, armor/weapon proficiencies, spell/impulse proficiencies, magic slots, and armor/shield state now route through Actor-backed actions from Player modals, QuickSheet, MagicView, and DefensesSection.

Remaining Player-local edit paths:

- Inventory-driven compound edits still use focused local updaters through `updateCharacter` where they combine inventory, gold, HP, prepared items, staff/wand recharge, formulas, and item state in one workflow.
- These write PC Actor documents in V2 through the character compatibility facade, but they should be split into narrower inventory/actor actions when those workflows are next touched.

## Completed In V2 Convergence Foundation Wave

- `src/App.jsx` starts Firestore V2 directly on the `v2-convergence` branch.
- Schema version 3 adds campaign-scoped `actors`, `actorEffects`, `effectTemplates`, and top-level `catalogOverrides`.
- V2 migration/backfill writes PC actors from characters, owned companion actors from legacy companions, actor effects from legacy conditions, and catalog overrides from custom content.
- `CampaignContext` exposes `actors`, `archivedActors`, and `myActor` alongside transitional character fields.
- Character create/import/archive/restore writes actor documents in V2.
- Conditions can write `actorEffects` through `dataActions.effect`; old character-condition writes remain fallback-only.
- Deployed item, spell, action, feat, impulse, ability, and creature editing writes `catalogOverrides` instead of depending on production file writes.
- Firestore rules cover `actors`, `actorEffects`, `effectTemplates`, and `catalogOverrides`.

## Completed In V2 Read Cutover / Actor Runtime Slice

- `useFirestoreV2Db` returns `{ v2Store, status }` and no longer writes broad legacy diffs back to Firestore.
- `writeLegacyDbDiffToV2` is isolated to migration/import code.
- Player/Admin runtime trees no longer carry `setDb` props.
- `campaign.characters` compatibility rows in the runtime compatibility DB are built from PC Actor documents only; old Character documents are import/projection-test material.
- Player basis-value actions keep the `dataActions.character.*` facade but write PC Actor documents in V2.
- Inventory transfer, loot claim/gold split, quest rewards, and party XP write PC Actor documents in V2 instead of character documents.
- `CampaignContext` no longer injects `characterRepo` into runtime `dataActions`.
- Player Stats, ConditionsModal, Admin CharacterCard backlash, and mutagen item effects read/write `actorEffects`.
- `CompanionTab` reads and writes owned companion Actors and stores companion conditions as `actorEffects`.
- Static guards now fail runtime reintroduction of `character.conditions`, `character.companion`, root `db.characters`, broad `setDb`, broad V2 diffs, or unguarded production `/api/files/save`.

## Completed In Shared Presentation Wave

- Creature reveal defaults and creature list view models are centralized in `src/shared/bestiary/creaturePresentation.js`.
- GM Bestiary and Player Lore Bestiary now share the same creature metadata/custom/static merge path.
- `CreatureCard` supports clickable creature skills and abilities through explicit callbacks while preserving player reveal restrictions.
- Encounter creature details reuse the shared creature card interactions for GM skill/ability inspection.
- `ActorSheetCard` is the shared composition surface for Stats, Inventory, Magic, Feats, Impulses, and Pact display.
- Admin `CharacterCard` is now a thin compatibility wrapper around `ActorSheetCard`.
- Encounter and Party selected-player details no longer depend on empty modal callback stubs.

Remaining presentation cleanup:

- Player Loot, Shop, and GM Items side lists now use shared `ItemRow` primitives. Complex Player equipment rows remain local because wand/staff/ammo/equipment interactions need a dedicated pass.
- Admin catalog previews for Spells, Actions, Feats, and Impulses already share `ContentPreviewCard`; harden editor/list reuse in a future catalog UI wave.

## Completed In Catalog Admin Unification Wave

- Items, Spells, Actions, Feats, Impulses, Abilities, and Creatures now use the shared admin catalog table/controller contract.
- Static `Edit` writes a `catalogOverrides` document with `mode: "override"` instead of creating a duplicate custom entry.
- `Clone` and `New` write `mode: "custom"`.
- Static `Delete` writes `mode: "hide"` and is visible through the Deleted status filter.
- Custom/override `Delete` removes the override document.
- `Copy Reference` is visible across catalog tables and resolves through the generic catalog reference resolver.
- Tables refresh through context/selectors after mutation and no longer use catalog-save `window.location.reload()` fallbacks.
- The old Actions `Clone/Override` menu label is removed; `Edit` and `Clone` are separate actions.
- Creature production editing now writes DB-backed content overrides. Bestiary reveal/group/published metadata remains separate from creature content overrides.
- Creature full-data reads now use the shared catalog detail-merge helper so compact index rows, fetched Foundry JSON, and overrides do not drop descriptions, items, or stats.
- Deviant Abilities remain Pact-domain content, but the admin table now exposes explicit Edit, Clone, Delete, and Copy Reference actions with stable ID-based row behavior.
- Smoke and guard coverage checks immediate refresh, item edit without duplicates, item clone, creature production-style edit, action hide/delete, Deleted filter behavior, and Copy Reference.

## Remaining By Domain

## Post-Migration Hardening

Status: in progress.

Completed:

- Baseline on this wave was green before changes: `npm run check` passed with 89 tests.
- Actor rules now flow through `src/shared/rules/actorRulesViewModel.js`; Player Stats and shared Actor sheets use effective Actor+Effect view models instead of ad-hoc condition prop injection as the rules source.
- Mutagen item use creates `actorEffects` with concrete modifiers; old modifier-less mutagen effects are normalized defensively during rules reads.
- AC item bonuses from mutagens no longer add on top of armor item AC; the armor/effect item path keeps the highest item AC contribution.
- Structured quest item rewards use `rewards.itemRewards`; legacy `rewards.items` remains a note and is not executed as free text.
- Campaign XP threshold is stored at `campaign.advancement.xpThreshold`; Party XP writes synchronize active character `xp.max`.
- Loot gold split uses copper arithmetic and leaves indivisible copper in the lootbag.
- Loot item claims keep `claimedAt` on the lootbag item while keeping the copied inventory item free of claim metadata.
- Shared item identity helpers live in `src/shared/utils/itemIdentity.js`; reducers, Player inventory actions, `InventoryView`, `ItemDetailModal`, shared Actor sheets, and GM Items side-panel selection use the same identity resolver/key helpers.
- Obsolete shared inventory/combat hooks that were no longer imported have been removed instead of keeping a second identity implementation alive.
- `npm run lint` was added as a narrow first-pass quality gate for hardened areas; it focuses on `no-undef` and React hook rules.
- The broad-write/static guard now rejects `currentMutagen` as a runtime rules source.

Deferred follow-ups:

- Full `createDataActions.js` domain split remains a dedicated refactor wave; this wave avoided mixing broad file moves with rules/data fixes.
- Shared `ItemRow`/`CatalogItemRow` cleanup remains useful for presentation consistency, but the first-pass instance identity hotspots are now centralized.
- Browser-native dialogs have been replaced by `useAppFeedback` toasts/confirm/prompt dialogs. Large modal/view files remain UI-debt and should be handled after the rules/data hardening is fully stable.

### Campaign Compatibility

- Campaign-scoped admin player writes now require an active campaign and use `dataActions.character.updateCharacter`.
- The old campaignless root-character admin/player write fallback has been removed.
- `CampaignContext.updateActiveCampaign` has been removed from the context API.

### Shop And Traders

- `ItemsView` trader create/update/hide/inventory writes use `dataActions.shop`.
- Available items and formulas use `dataActions.shop`.
- GM item catalog content writes use `dataActions.catalogOverride` through the shared catalog editor contract.
- Legacy custom item helpers remain compatibility/convenience paths for older non-table surfaces.
- Shop reads in `ShopView`, `ItemsView`, and `InventoryView` are selector-backed through `shopSelectors`.

Compatibility note:

- Old `shop.customItems`, `db.actions`, `abilities.custom`, and bestiary custom creature shapes remain readable through centralized compatibility selectors so old data does not disappear.
- New catalog-table writes must not target those legacy shapes.
- Remaining catalog work is performance/lazy-loading and optional UI polish, not data-model migration debt.

### Legacy V2 Compatibility

- `useFirestoreV2Db` no longer builds a legacy-shaped projection in the normal runtime path.
- `writeLegacyDbDiffToV2` must remain confined to legacy import/migration code.
- `composeLegacyDbFromV2Documents` exists only in `src/shared/db/v2/legacyProjection.js` for import/backup compatibility and tests.
- Legacy LocalStorage/data-master runtime helpers live under `src/shared/db/legacy-import/`.
- Legacy `characters` docs may still exist as transition data. Runtime reads and writes target Actors; `V2_COLLECTIONS.characters` is confined to migration/projection/test paths.
