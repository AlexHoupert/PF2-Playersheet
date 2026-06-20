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

Remaining Player-local edit paths:

- Saves/skills, armor/weapon proficiencies, spell/impulse proficiencies, magic slots, armor/shield state, and inventory-driven gold/HP changes still use focused local updaters through `updateCharacter`.
- These are shape-hardened by the character normalizer, but should move to targeted actions when their workflows are next touched.

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
- PC Actor documents are preferred over stale Character documents when building `campaign.characters` compatibility rows.
- Player basis-value actions keep the `dataActions.character.*` facade but write PC Actor documents in V2.
- Inventory transfer, loot claim/gold split, quest rewards, and party XP write PC Actor documents in V2 instead of character documents.
- `CampaignContext` no longer injects `characterRepo` into runtime `dataActions`.
- Player Stats, ConditionsModal, Admin CharacterCard backlash, and mutagen item effects read/write `actorEffects`.
- `CompanionTab` reads and writes owned companion Actors and stores companion conditions as `actorEffects`.
- Static guards now fail runtime reintroduction of `character.conditions`, `character.companion`, root `db.characters`, broad `setDb`, broad V2 diffs, or unguarded production `/api/files/save`.

## Remaining By Domain

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
- Legacy `characters` docs may still exist as transition data. Runtime writes now target Actors; remaining work is to isolate/remove legacy character collection readers and migration helpers.
