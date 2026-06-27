# Migration Backlog

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

- `src/shared/db/domain/createDataActions.js`: legacy adapter implementation that intentionally writes through `setDb`.

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

- `useFirestoreV2Db` returns `{ legacyProjection, v2Store, status }` and no longer writes broad legacy diffs back to Firestore.
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

- Player Inventory, Shop, Loot, and GM Items still have similar item-row rendering. Extract a shared `ItemRow`/`CatalogItemRow` in a future UI cleanup wave.
- Admin catalog previews for Spells, Actions, Feats, and Impulses already share `ContentPreviewCard`; harden editor/list reuse in a future catalog UI wave.

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
- Browser-native dialogs and large modal/view files remain UI-debt and should be handled after the rules/data hardening is fully stable.

### Campaign Compatibility

- Campaign-scoped admin player writes now require an active campaign and use `dataActions.character.updateCharacter`.
- The old campaignless root-character admin/player write fallback has been removed.
- `CampaignContext.updateActiveCampaign` has been removed from the context API.

### Shop And Traders

- `ItemsView` trader create/update/hide/inventory writes use `dataActions.shop`.
- Available items and formulas use `dataActions.shop`.
- GM custom items use `dataActions.globalContent.saveCustomItem/deleteCustomItem`.
- Shop reads in `ShopView`, `ItemsView`, and `InventoryView` are selector-backed through `shopSelectors`.

Remaining:

- Shop still depends on the legacy-shaped projection as the view-model input, but component-local root fallback logic has been removed.

### Legacy V2 Compatibility

- `useFirestoreV2Db` still builds a legacy-shaped projection for transitional reads, but it is no longer a write contract.
- `writeLegacyDbDiffToV2` must remain confined to legacy import/migration code.
- `composeLegacyDbFromV2Documents` still exists for import/backup compatibility and tests, but `CampaignContext` builds the normal runtime compatibility DB from `v2Store`.
- Legacy `characters` docs may still exist as transition data. Runtime reads and writes now target Actors; remaining work is to isolate/remove legacy character collection migration helpers.
