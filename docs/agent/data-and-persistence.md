# Data And Persistence

Last updated: 2026-07-28.

## Mental Model

The `v2-convergence` branch has started the V2-only cutover. `src/App.jsx` now starts the Firestore V2 hook directly instead of selecting the legacy runtime.

Existing screens still expect some compatibility props, but `CampaignContext` now builds its normal runtime view from the V2 store. The hook-level `legacyProjection` has been removed from the normal app path; legacy projection code is isolated in `src/shared/db/v2/legacyProjection.js` for migration tests and explicit import/backup helpers.

This means a feature is not fully v2-ready just because it appears in the legacy-shaped projection; v2 still needs targeted repository/actions so data is written into the intended collection and reconstructed correctly.

## Legacy Mode

File: `src/shared/db/legacy-import/usePersistedDb.js`

No longer selected by `src/App.jsx` on the V2 convergence branch. Legacy remains useful as an import/backup source and as implementation reference until its runtime code is isolated or removed.

Storage:

- Browser LocalStorage key: `pf2e-data`
- Firestore document: `data/master` when Firebase env is configured

Behavior:

- Initializes from LocalStorage or `src/data/new_db.json`.
- Runs `migrateDb` on loaded data.
- Subscribes to `data/master` when Firebase is configured.
- Uses `_lastWriteTimestamp`, `lastWriteTimestampRef`, and a suppression window to avoid applying its own write echo.
- Writes immediately to LocalStorage and asynchronously to Firestore.
- Blocks local writes before the first remote snapshot when Firebase is configured.

Important risk:

- Legacy mode writes the entire DB object as one Firestore document. This is simple but high-conflict and size-constrained.

## Migration Defaults

File: `src/shared/db/legacy-import/migrateDb.js`

Current responsibilities:

- Ensures top-level `campaigns`, `users`, and `library`.
- Migrates old root `characters`, `quests`, and `lootBags` into a default campaign if no campaigns exist.
- Keeps root `characters`, `quests`, and `lootBags` arrays for compatibility.
- Normalizes character `initiative`.
- Normalizes armor proficiencies into object form with defaults for `Unarmored`, `Light`, `Medium`, `Heavy`.
- Ensures global `shop.availableItems`, `shop.traders`.
- Provides a default `lore.articles` sample if no lore object exists.

Add new durable DB defaults here when screens would crash on missing fields.

## Firestore V2 Schema

File: `src/shared/db/v2/schema.js`

Top-level collections:

- `campaigns`
- `global`
- `customItems`
- `customCreatures`
- `customActions`
- `catalogOverrides`
- `loreArticles` (recovery/import compatibility only)
- `migrationBackups`

Campaign subcollections:

- `actors`
- `actorEffects`
- `effectTemplates`
- `quests`
- `lootBags`
- `encounters`
- `maps`
- `members`
- `loreArticles`
- `loreGroups`
- `loreDeliveries`
- `knowledgeNotes`
- `catalogEntries`
- `catalogChangeEvents`
- `effectRequests`
- `loreContributions`

Helpers:

- `campaignPath(campaignId)`
- `campaignSubPath(campaignId, collectionName, docId)`

## V2 Runtime Hook

File: `src/shared/db/v2/useFirestoreV2Db.js`

Storage:

- Browser LocalStorage key: `pf2e-data-v2-projection`
- Firestore normalized documents

Read path:

1. Subscribe to top-level collections.
2. Subscribe to `campaigns`.
3. For every campaign, subscribe to known subcollections.
4. Store documents in a `Map` keyed by Firestore path.
5. Build a V2-native debug/read view with `composeV2ViewModelFromDocuments`.
6. Legacy projection is not built by the normal runtime hook. Call `composeLegacyDbFromV2Documents` from `src/shared/db/v2/legacyProjection.js` only for explicit compatibility/import use.
7. Run `migrateDb` on that compatibility projection when using the import/backup helper.

`CampaignContext` uses `composeRuntimeDbFromV2Store` for the normal runtime compatibility DB and exposes V2-native viewmodels such as `actors`, `pcActors`, `myActor`, quests, loot bags, maps, shop, lore, pacts, abilities, bestiary, and catalog overrides.

Runtime write path:

1. UI calls `CampaignContext.dataActions`.
2. `createDataActions` selects targeted V2 repositories/transactions.
3. Firestore snapshots rebuild `v2Store`.

Campaign catalog data merges in this order: static resources, global
`catalogOverrides`, then campaign-scoped `catalogEntries`. Campaign writes emit
immutable `catalogChangeEvents`; only an explicit global-admin promotion writes
back to the global override collection.

### Creature Catalog And Encounter-local Forks

The generated Creature index uses compact schema version 2. Static rows carry
the table summary needed for sorting and filtering without loading thousands of
detail files: defenses, movement, perception, size, skills, resistances,
weaknesses, immunities, attack/magic/shield flags, and spellcasting modes.
`buildCreatureTableSummary` is also applied to custom and override Creatures so
all Creature origins expose the same table contract.

Full static Creature JSON remains detail-lazy. Creature spellcasting is stored
in Foundry-compatible `spellcastingEntry` and linked `spell` items; the editor
normalizes Prepared, Spontaneous, Innate, and Focus entries while preserving
unknown source fields and stable IDs.

Customizing one Encounter combatant creates a campaign-scoped Creature fork
with `linkedOnly` metadata and repoints only that combatant. Linked-only forks
remain resolvable by ID and in explicit Encounter scopes, but ordinary Bestiary
catalog lists exclude them. Removing the combatant retains the fork and stamps
it as a later cleanup candidate instead of deleting content implicitly.

Campaign member roles are `player`, `trusted_player`, `assistant_gm`,
`spectator`, `gm`, and `admin`. Runtime authorization derives capabilities from
the member role; `?admin=true` only requests an admin route and grants no rights.

Compatibility projection updates:

- `useFirestoreV2Db` returns `{ v2Store, status }` and does not build or cache a legacy projection.
- The hook no longer broad-diffs that projection back into Firestore.
- `writeLegacyDbDiffToV2` remains only in legacy import/migration code.

Important transitional limitation:

- There are still transitional screens that read the legacy-shaped projection, but runtime writes should not use it as a persistence contract.
- `setDb` no longer flows through Player/Admin runtime components on `v2-convergence`.
- Campaign/Session, Actor-backed Character compatibility, Inventory, Loot, Quests/Rewards, Encounters, Maps, Progress, Camping, shop/trader, global custom content, Pacts, Abilities, Lore, Bestiary metadata/custom creatures, Catalog Overrides, and Player runtime fallbacks now use targeted domain actions instead of broad runtime UI writes.
- Actor, Actor Effect, Effect Template, and Catalog Override repositories/actions have been introduced as the foundation for the planned Effects/Conditions and Companion/Minion systems.

## Domain Action Layer

Files:

- `src/shared/db/domain/createDataActions.js`
- `src/shared/db/domain/actionContext.js`
- `src/shared/db/domain/actorActions.js`
- `src/shared/db/domain/campaignActions.js`
- `src/shared/db/domain/characterActions.js`
- `src/shared/db/domain/inventoryActions.js`
- `src/shared/db/domain/lootActions.js`
- `src/shared/db/domain/questActions.js`
- `src/shared/db/domain/encounterActions.js`
- `src/shared/db/domain/mapActions.js`
- `src/shared/db/domain/progressActions.js`
- `src/shared/db/domain/campingActions.js`
- `src/shared/db/domain/globalContentActions.js`
- `src/shared/db/domain/effectActions.js`
- `src/shared/db/domain/memberActions.js`
- `src/shared/db/domain/catalogOverrideActions.js`
- `src/shared/db/domain/campaignCatalogActions.js`
- `src/shared/db/domain/campaignCatalogReducers.js`
- `src/shared/db/domain/loreContributionActions.js`
- `src/shared/db/domain/loreContributionReducers.js`
- `src/shared/db/domain/campaignReducers.js`
- `src/shared/db/domain/inventoryReducers.js`
- `src/shared/db/domain/lootReducers.js`
- `src/shared/db/domain/questReducers.js`
- `src/shared/db/domain/encounterReducers.js`
- `src/shared/db/domain/mapReducers.js`
- `src/shared/db/domain/progressReducers.js`
- `src/shared/db/domain/campingReducers.js`
- `src/shared/db/domain/globalContentReducers.js`
- `src/shared/db/domain/actorReducers.js`
- `src/shared/rules/actorRulesViewModel.js`
- `src/shared/utils/itemIdentity.js`
- `src/shared/db/selectors/`
- `src/shared/db/v2/repositories.js`

`CampaignContext` exposes `dataActions`, `dbMode`, and `dbStatus`.

`createDataActions.js` is a public API aggregator. Shared mode/repository/legacy-update infrastructure lives in `actionContext.js`; domain actions live in dedicated factories for Actor, Campaign, Member, Character compatibility, Inventory, Loot, Quest, Encounter, Map, Progress, Camping, Global Content, ActorEffect, and Catalog Override paths.

Current migrated write paths:

- Player character compatibility updates through `dataActions.character.updateCharacter`; in V2 these delegate to PC Actor updates. Player basis edits for gold, attributes, HP/temp/max HP, speed, Class DC, daily crafting max, saves/skills, proficiencies, magic slots, and armor/shield state write PC Actor documents directly in V2.
- Player, GM, and Encounter stat displays should consume the actor rules view model instead of manually injecting effects or legacy conditions. Mutagens, Scaly Skin, standard Conditions, and item/stat modifiers are represented as `actorEffects.modifiers` and resolved through the shared rules path.
- New character create/import/archive/restore writes campaign-scoped PC Actors in V2. Old character documents remain import/transition data and are not a runtime read or write target.
- Conditions in `ConditionsModal`, Player Stats, Encounter right-click assignment, Admin CharacterCard backlash, and item mutagen effects use `dataActions.effect` and campaign-scoped `actorEffects`.
- Encounter creature combatants are not full NPC Actors yet. They receive stable `effectTargetId` strings and write `actorEffects` against those targets; player combatants write effects against the PC Actor ID.
- Persistent damage uses `actorEffects(category="damage_effect")` with a stored formula and damage type. The resolver selects the strongest same-type persistent damage for display/evaluation; turn-end rolling remains future work.
- Companion UI reads and writes owned Actor documents instead of `character.companion`; companion conditions also use `actorEffects`.
- Custom item/action/ability/creature saves write `catalogOverrides` in V2. Deployed item, spell, action, feat, impulse, ability, and creature editors use catalog overrides instead of `/api/files/*`.
- Player inventory transfer through `dataActions.inventory.transferItem`.
- Player loot claim, gold claim, and gold split through `dataActions.loot`.
- Campaign/session flows through `dataActions.campaign`, `dataActions.character`, and `dataActions.member`.
- GM item assignment to loot/characters and loot-bag edits through `dataActions`.
- GM quest create/update/archive/restore, objective toggles, secret reveal, and reward distribution through `dataActions.quest`.
- Quest item rewards use structured `rewards.itemRewards`; legacy `rewards.items` is display-only note text and must not be treated as executable reward data.
- GM encounter create/archive/restore/activate, combatant updates, initiative, HP, and turn state through `dataActions.encounter`.
- GM Encounter condition, persistent damage, and custom badge assignment through `dataActions.effect`.
- GM map create/update/archive/restore, ordering, pins, scale, and image URL persistence through `dataActions.map`.
- GM progress section edits and top-level Progress archive/restore through `dataActions.progress`.
- Player progress views read active-only Progress data through the domain reducer.
- GM/player camping settings, activity edits, activity archive/restore, assignments, rolls, and unassign through `dataActions.camping`.
- Player reward notifications read `campaign.notificationQueue` first and root `db.notificationQueue` only as a legacy fallback.
- GM ItemsView shop/trader writes through `dataActions.shop`.
- GM/player custom item/action saves through `dataActions.globalContent`.
- GM AbilitiesView custom ability saves/deletes/clones and custom-creature ability assignment through `dataActions.globalContent` and `dataActions.bestiary`.
- GM PactAdminView and DeviantAbilitiesAdminView through `dataActions.pact`.
- GM LoreAdminView through `dataActions.lore` and campaign-scoped Lore collections. Players read reveal-safe `loreDeliveries` and write Actor-owned `knowledgeNotes`; each new note may retain a small reveal-safe `targetSnapshot` for unavailable-source fallback in the own-note overview. Top-level Lore remains a recovery fallback.
- GM BestiaryView custom creature, metadata, reveal-state, group, bestiary toggle, and catalog metadata initialization through `dataActions.bestiary`.
- Encounter bestiary reveal-state writes through `dataActions.bestiary`.
- Player root-notification clear and skill-name runtime repair through `dataActions`.

Soft delete:

- Campaign and character deletion is archival via `deletedAt` and optional `deletedBy`.
- Quest/Subquest and Encounter deletion is also archival via `deletedAt` and optional `deletedBy`.
- Map deletion is also archival via `deletedAt` and optional `deletedBy`.
- Top-level Progress entry deletion is also archival via `deletedAt` and optional `deletedBy`.
- Custom Camping Activity deletion is also archival via `deletedAt` and optional `deletedBy`.
- Restore removes deletion fields and stamps `restoredAt`/`restoredBy`.
- `CampaignContext` filters active Campaigns, Characters, Quests, Encounters, and Maps for normal screens and exposes archived records for restore UI.
- Firestore v2 keeps Campaign and Actor documents; member assignments are cleared when an assigned PC Actor is archived.
- Quest rewards are idempotent via applied markers and are not automatically rolled back when objectives are later marked incomplete.

Adapter behavior:

- Legacy adapter tests still use pure reducers against a legacy campaign snapshot and write with `setDb`.
- Firestore v2 mode uses targeted repository updates and transactions.
- Missing Firestore config no longer creates broad runtime V2 writes; local non-Firestore editing is not the convergence target.
- Runtime Firestore repositories are injected by `CampaignContext`; tests can inject fake repositories without loading Firebase.

Catalog effect definitions:

- Catalog sources declare safe, serializable rules in `rules.effectDefinitions[]`.
- Passive definitions are derived at read time from owned or equipped sources. Usable definitions materialize targeted `actorEffects` with a source snapshot, duration, targeting, and idempotent tick state.
- Definitions support only registered selectors, predicates, scaling modes, modifiers, and apply actions. Executable code and free actor paths are rejected.
- Creature-combatant activations create campaign `effectRequests`. GM/admin approval validates and applies them atomically; Assistant GMs can inspect but not decide requests.
- Daily Preparation removes `daily_preparation` effects in the same actor/effect transaction as the preparation update.
- `npm run backfill:catalog-effects` is dry-run by default. The approved
  2026-07-17 write created 27 overrides and backup
  `catalog-effects-2026-07-17T12-24-48-968Z`; its read-only verification
  reported 0 pending writes. Future write mode still requires direct script
  flags `--write --confirm-write` and is never run during application startup.

Actor and inventory identity:

- Inventory and loot item instances use `instanceId` as the runtime identity contract.
- Fallback matching for old data is centralized in `src/shared/utils/itemIdentity.js`; new UI code should not add local name/index matching rules.
- `findInventoryItemIndex`, `resolveInventoryItemIdentity`, `findLootItemIndex`, `resolveLootItemIdentity`, `sameInventoryItem`, `findStackableInventoryItemIndex`, and `getItemIdentityKey` are the supported helpers for Inventory/Loot/Side-panel instance selection.
- Player inventory actions, `InventoryView`, `ItemDetailModal`, shared `ActorSheetCard`, and GM Items side-panel selection are guarded to prefer `instanceId` and to keep legacy name/index matching inside those helpers.

Campaign advancement:

- Campaign XP threshold is stored at `campaign.advancement.xpThreshold`.
- Default threshold is `1000`.
- `dataActions.campaign.setXpThreshold` updates the campaign setting and synchronizes active PC actor `xp.max` values.
- Party XP writes and quest XP rewards continue to derive active actor/character `xp.max` from the campaign setting.

See `docs/agent/domain-actions.md` for the detailed API and migration status.

## V2 Normalization

File: `src/shared/db/v2/normalizers.js`

`normalizeMasterToV2(masterDb, options)`:

- Converts legacy master DB into Firestore document payloads.
- Creates fallback campaign `campaign_default` if no campaigns exist.
- Moves root quests and loot bags into a campaign when present.
- Splits campaigns into campaign meta doc plus subcollection docs.
- Adds members from `db.users`.
- Adds global config from `shop`, `bestiary.creatures`, `notificationQueue`, `rules`, `library`, `runes`, `feats`.
- Adds `pacts` and `abilities.custom`/`abilities.deviant` into `global/config`.
- Adds custom content collections for custom items, creatures, actions, and lore articles.
- Adds PC actors from campaign characters.
- Adds companion actors from legacy `character.companion`.
- Adds actor effects from legacy `character.conditions` and companion conditions.
- Adds catalog overrides for custom item/action/ability/creature/spell records.
- Stamps documents with schema metadata and migration info.
- Produces a report with counts, renamed fields, moved fields, invalid values, and assumptions.

File: `src/shared/db/v2/legacyProjection.js`

`composeLegacyDbFromV2Documents(documents, baseDb)`:

- Builds the legacy projection used by migration/import compatibility tests and explicit backup/import helpers.
- Reassembles campaign subcollections into `db.campaigns[campaignId]`.
- Reassembles `actors`, `actorEffects`, and `effectTemplates` into campaign view data.
- Builds runtime `campaign.characters` compatibility rows from PC Actors only; stale Character documents are kept for legacy projection/import tests.
- Overlays transitional character `conditions` from `actorEffects` when compatibility screens still need that shape.
- Converts `members` docs back into `db.users`.
- Rehydrates global config including shop, bestiary reveal-state/metadata, pacts, abilities, custom collections, and lore.
- Sets root `quests` and `lootBags` from the first campaign for legacy projection compatibility only; the normal runtime DB does not project those root fields.

## V2 Migration Scripts And UI

CLI:

- `scripts/migrate_master_to_v2.js`
- Dry run: `npm run migrate:v2:dry-run`
- Write: `npm run migrate:v2`

Admin UI:

- `src/admin/FirebaseMigrator.jsx`
- Can download local backup.
- Can dry-run v2 normalization and download report.
- Can write v2 docs after prompt confirmation.
- Legacy master upload is disabled unless `VITE_ENABLE_LEGACY_MASTER_UPLOAD=true`.

Do not run write migration without explicit user approval.

## V2 Default Readiness

V2 is the runtime entry point on the convergence branch. The checklist in `docs/agent/v2-default-readiness.md` is now a cutover/completion checklist for making this branch deployable, not a precondition for local branch work.

## Firestore Rules

File: `firestore.rules`

Access model:

- Users must be signed in and have email.
- Global admins are documents under `admins/{email}`.
- Campaign membership is stored under `campaigns/{campaignId}/members/{email}`.
- Campaign GMs are member roles `gm` or `admin`.
- Assigned players can update their own character doc and assigned actor doc in V2.
- Assigned players can create/update/delete actor effects that target their assigned actor.
- Loot bag updates are allowed for any campaign member.
- Campaign effect templates are readable by campaign members and writable by campaign GM/global admins.
- Top-level global/custom/catalog-override/recovery-Lore collections are readable by signed-in users but writable only by global admins.
- Campaign Lore drafts are GM-only. Campaign members may read groups; assigned Actors query their own deliveries and notes. A separate `sharedWithParty == true` query exposes Party-shared notes read-only to campaign members, while the GM workspace still queries only `sharedWithGm == true` notes.

Mismatch to watch:

- Legacy `data/master` is not explicitly allowed by these rules. Legacy mode may depend on older/deployed rules or admin privileges. Verify live rules before relying on legacy Firestore writes.
- The currently targeted V2 global writes are covered by `global`, `customItems`, `customCreatures`, `customActions`, and `catalogOverrides`; top-level `loreArticles` is retained only for recovery/import compatibility.
- The actor/effects foundation is covered by `actors`, `actorEffects`, and `effectTemplates` campaign subcollection rules.
- Lore delivery/note queries must retain their `actorId`, `sharedWithGm`, or `sharedWithParty` constraints because Firestore rules evaluate the potential query result set. See `docs/agent/lore-migration-readiness.md` for the emulator gate.

## Existing Tests

Files:

- `tests/v2Migration.test.js`
- `tests/domainReducers.test.js`
- `tests/globalContentReducers.test.js`
- `tests/dataActionsLegacy.test.js`
- `tests/dataActionsV2Adapter.test.js`
- `tests/selectors.test.js`
- `tests/broadWritesGuard.test.js`

Tests cover:

- Normalization of a campaign-scoped legacy master into v2 documents.
- HP migration to `stats.hp`.
- String condition/item conversion.
- Inventory quantity normalization.
- Proficiencies array to object conversion.
- Members, custom items/actions/creatures, pacts, abilities, recovery Lore paths, and campaign-scoped Lore runtime composition.
- Composition of v2 docs back into legacy projection.
- Campaign/Character/Quest/Encounter soft delete and restore reducers.
- Map soft delete, restore, order, pin, and scale reducers.
- Progress update, active-only, top-level soft delete, and restore reducers.
- Camping settings, custom activity archive/restore, assignment conflict, roll, and unassign reducers.
- Global content reducers for custom items/actions/abilities/creatures, pacts, legacy Lore compatibility, trader state, availability lists, root notifications, and bestiary reveal-state/metadata.
- Legacy and v2 adapter behavior for `createDataActions`.
- Selector behavior for active/archived campaign data, legacy root fallbacks, shop reads, bestiary reveal-state/custom creatures, pacts, abilities, and campaign/recovery Lore precedence.
- Lore normalization, reveal materialization, audience changes, versioned alerts, links/backlinks, groups, migration reports, private notes, and targeted V2 adapter calls.
- Broad-write guard coverage for migrated UI files.
- Quest objective and quest reward idempotency.
- Encounter activation, combatants, effect target IDs, initiative, turn state, compatibility conditions, and ActorEffect condition assignment.

Add tests here when changing:

- `normalizers.js`
- `legacyProjection.js`
- `firestoreMigration.js`
- v2 schema paths
- migration assumptions
- legacy projection shape
