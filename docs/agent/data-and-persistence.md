# Data And Persistence

Last updated: 2026-06-18.

## Mental Model

The app currently has two persistence modes but one dominant UI data shape. Existing screens expect a legacy-shaped `db` object. Firestore v2 mode normalizes storage but projects documents back into that same shape for UI compatibility.

This means a feature is not fully v2-ready just because it works through `setDb`; v2 may still need normalizer support so data is written into the intended collection and reconstructed correctly.

## Legacy Mode

File: `src/shared/db/usePersistedDb.js`

Default mode unless `?db=v2` or `VITE_DB_MODE=v2` is used.

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

File: `src/shared/db/migrateDb.js`

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
- `loreArticles`
- `migrationBackups`

Campaign subcollections:

- `characters`
- `quests`
- `lootBags`
- `encounters`
- `maps`
- `members`

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
5. Call `composeLegacyDbFromV2Documents`.
6. Run `migrateDb`.
7. Cache projection to LocalStorage.

Write path:

1. `setDb` receives next legacy-shaped DB.
2. Run `migrateDb`.
3. Compare previous and next by calling `normalizeMasterToV2` on both.
4. Write changed docs and delete missing docs through `writeLegacyDbDiffToV2`.

Important limitation:

- There are repository functions in `src/shared/db/v2/repositories.js`, but compatibility support for broad legacy diffs still exists for future non-migrated paths.
- Campaign/Session, Character, Inventory, Loot, Quests/Rewards, Encounters, Maps, Progress, Camping, shop/trader, global custom content, Pacts, Abilities, Lore, Bestiary metadata/custom creatures, and Player runtime fallbacks now use targeted domain actions instead of broad runtime UI writes.

## Domain Action Layer

Files:

- `src/shared/db/domain/createDataActions.js`
- `src/shared/db/domain/campaignReducers.js`
- `src/shared/db/domain/inventoryReducers.js`
- `src/shared/db/domain/lootReducers.js`
- `src/shared/db/domain/questReducers.js`
- `src/shared/db/domain/encounterReducers.js`
- `src/shared/db/domain/mapReducers.js`
- `src/shared/db/domain/progressReducers.js`
- `src/shared/db/domain/campingReducers.js`
- `src/shared/db/domain/globalContentReducers.js`
- `src/shared/db/selectors/`
- `src/shared/db/v2/repositories.js`

`CampaignContext` exposes `dataActions`, `dbMode`, and `dbStatus`.

Current migrated write paths:

- Player character updates through `dataActions.character.updateCharacter`; player basis edits for gold, attributes, HP/temp/max HP, speed, Class DC, and daily crafting max use targeted character basis actions.
- Player inventory transfer through `dataActions.inventory.transferItem`.
- Player loot claim, gold claim, and gold split through `dataActions.loot`.
- Campaign/session flows through `dataActions.campaign`, `dataActions.character`, and `dataActions.member`.
- GM item assignment to loot/characters and loot-bag edits through `dataActions`.
- GM quest create/update/archive/restore, objective toggles, secret reveal, and reward distribution through `dataActions.quest`.
- GM encounter create/archive/restore/activate, combatant updates, initiative, HP, turn state, and conditions through `dataActions.encounter`.
- GM map create/update/archive/restore, ordering, pins, scale, and image URL persistence through `dataActions.map`.
- GM progress section edits and top-level Progress archive/restore through `dataActions.progress`.
- Player progress views read active-only Progress data through the domain reducer.
- GM/player camping settings, activity edits, activity archive/restore, assignments, rolls, and unassign through `dataActions.camping`.
- Player reward notifications read `campaign.notificationQueue` first and root `db.notificationQueue` only as a legacy fallback.
- GM ItemsView shop/trader writes through `dataActions.shop`.
- GM/player custom item/action saves through `dataActions.globalContent`.
- GM AbilitiesView custom ability saves/deletes/clones and custom-creature ability assignment through `dataActions.globalContent` and `dataActions.bestiary`.
- GM PactAdminView and DeviantAbilitiesAdminView through `dataActions.pact`.
- GM LoreAdminView through `dataActions.globalContent` and the `loreArticles` collection.
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
- Firestore v2 keeps Campaign and Character documents; member assignments are cleared when a character is archived.
- Quest rewards are idempotent via applied markers and are not automatically rolled back when objectives are later marked incomplete.

Adapter behavior:

- Legacy mode uses pure reducers against the legacy campaign snapshot and writes with `setDb`.
- Firestore v2 mode uses targeted repository updates and transactions.
- Missing Firestore config falls back to legacy adapter behavior.
- Runtime Firestore repositories are injected by `CampaignContext`; tests can inject fake repositories without loading Firebase.

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
- Stamps documents with schema metadata and migration info.
- Produces a report with counts, renamed fields, moved fields, invalid values, and assumptions.

`composeLegacyDbFromV2Documents(documents, baseDb)`:

- Builds the legacy projection used by existing screens.
- Reassembles campaign subcollections into `db.campaigns[campaignId]`.
- Converts `members` docs back into `db.users`.
- Rehydrates global config including shop, bestiary reveal-state/metadata, pacts, abilities, custom collections, and lore.
- Sets root `quests` and `lootBags` from the first campaign for compatibility.

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

V2 remains opt-in through `?db=v2` or `VITE_DB_MODE=v2`. Do not switch the default until the manual smoke checklist and Firestore rules audit in `docs/agent/v2-default-readiness.md` are complete for the target Firebase project.

## Firestore Rules

File: `firestore.rules`

Access model:

- Users must be signed in and have email.
- Global admins are documents under `admins/{email}`.
- Campaign membership is stored under `campaigns/{campaignId}/members/{email}`.
- Campaign GMs are member roles `gm` or `admin`.
- Assigned players can update their own character doc in v2.
- Loot bag updates are allowed for any campaign member.
- Top-level global/custom/lore collections are readable by signed-in users but writable only by global admins.

Mismatch to watch:

- Legacy `data/master` is not explicitly allowed by these rules. Legacy mode may depend on older/deployed rules or admin privileges. Verify live rules before relying on legacy Firestore writes.
- The currently targeted V2 global writes are covered by `global`, `customItems`, `customCreatures`, `customActions`, and `loreArticles`; all are signed-in readable and global-admin writable.

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
- Members, custom items/actions/creatures, pacts, abilities, and lore document paths/projection.
- Composition of v2 docs back into legacy projection.
- Campaign/Character/Quest/Encounter soft delete and restore reducers.
- Map soft delete, restore, order, pin, and scale reducers.
- Progress update, active-only, top-level soft delete, and restore reducers.
- Camping settings, custom activity archive/restore, assignment conflict, roll, and unassign reducers.
- Global content reducers for custom items/actions/abilities/creatures, pacts, lore, trader state, availability lists, root notifications, and bestiary reveal-state/metadata.
- Legacy and v2 adapter behavior for `createDataActions`.
- Selector behavior for active/archived campaign data, legacy root fallbacks, shop reads, bestiary reveal-state/custom creatures, pacts, abilities, and lore.
- Broad-write guard coverage for migrated UI files.
- Quest objective and quest reward idempotency.
- Encounter activation, combatants, initiative, turn state, and conditions.

Add tests here when changing:

- `normalizers.js`
- `firestoreMigration.js`
- v2 schema paths
- migration assumptions
- legacy projection shape
