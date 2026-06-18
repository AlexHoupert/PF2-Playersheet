# Agent Context

Last deep scan: 2026-06-17.

## Project Identity

`PF2-Playersheet` is a React/Vite Pathfinder 2e campaign companion for players and GMs. It includes:

- Player character sheet, inventory, feats, spells, impulses, quests, lore, maps, camping, pacts, companion, shop, and loot workflows.
- GM/admin screens for sessions, players, catalog resources, bestiary, encounters, lore, maps, progress, camping, pacts, and Firestore migration tools.
- A large local PF2e resource corpus under `ressources/` plus generated compact indexes under `src/data/`.
- Firebase Auth and Firestore persistence with both a legacy single-document store and a newer normalized v2 document model.

The root repo is `PF2-Playersheet`; the parent directory is not the git repo.

## Current Tech Stack

- React 18 with Vite 5 and ES modules.
- Custom Express dev server in `server/index.js`; `npm run dev` starts this server on port 5173 and embeds Vite middleware.
- Firebase 12 for Auth and Firestore.
- Framer Motion is used in party/initiative display.
- Node test runner via `node --test tests/*.test.js`.
- A minimal Python project exists only for `openpyxl`; current app scripts are Node-based.

## Entry Points

- `src/main.jsx` wraps `<App />` in `AuthProvider`.
- `src/App.jsx` selects persistence mode and route:
  - default or `VITE_DB_MODE`: legacy `usePersistedDb`.
  - `?db=v2`: `useFirestoreV2Db`.
  - `?admin=true`: GM/admin app.
  - `?party=true`: read-only party encounter screen.
  - `?camp=true`: camp overview screen.
  - no special query: player app.
- `src/shared/context/CampaignContext.jsx` derives active campaign, GM status, user assignment, and campaign update helpers.

## High-Level Structure

- `src/player/`: player shell, tabs, inventory/shop workflows, modals, party screen, view components.
- `src/admin/`: GM shell, resource/admin views, editors, encounter manager, Firestore tools.
- `src/shared/`: auth, db hooks, v2 persistence, catalog adapters, components, constants, hooks, utilities.
- `src/utils/`: PF2e rules calculations and bestiary helpers.
- `src/camping/`: camping data, player/admin camping UI, public camp screen.
- `src/pacts/`: elemental pact/deviant ability data and views.
- `src/data/`: seed DB and generated compact catalogs/indexes.
- `ressources/`: source PF2e JSON and assets. Large, mostly input data.
- `scripts/`: build and migration scripts.
- `server/`: Express wrapper for dev, resource serving, file APIs, and admin rebuild APIs.
- `tests/`: currently focused on Firestore v2 migration normalizers.

## Persistence Summary

The UI mostly works against a legacy-shaped `db` object. Even Firestore v2 mode projects normalized documents back into that legacy shape so existing screens can keep working.

Legacy mode:

- `src/shared/db/usePersistedDb.js`
- LocalStorage key `pf2e-data`.
- Optional Firestore document `data/master`.
- Adds `_lastWriteTimestamp` for echo suppression.
- Runs `migrateDb` before use.

Firestore v2 mode:

- `src/shared/db/v2/useFirestoreV2Db.js`
- LocalStorage key `pf2e-data-v2-projection`.
- Subscribes to normalized collections from `src/shared/db/v2/schema.js`.
- Uses `composeLegacyDbFromV2Documents` to create the legacy projection.
- Non-migrated runtime writes still diff whole legacy DBs via `writeLegacyDbDiffToV2`.
- Campaign/Session, Character, Inventory, Loot, Quests/Rewards, and Encounters migrated writes now go through `CampaignContext.dataActions` and targeted v2 repositories/transactions.

Firestore v2 collections include `campaigns`, campaign subcollections `characters`, `quests`, `lootBags`, `encounters`, `maps`, `members`, plus top-level `global`, `customItems`, `customCreatures`, `customActions`, `loreArticles`, and `migrationBackups`.

## Domain Actions Snapshot

`CampaignContext` exposes `dataActions`, `dbMode`, and `dbStatus`.

Current domain action files:

- `src/shared/db/domain/createDataActions.js`: adapter selection and public action API.
- `src/shared/db/domain/campaignReducers.js`: campaign/session reducers, soft delete, user assignment, party XP.
- `src/shared/db/domain/inventoryReducers.js`: pure character/inventory reducers and identity normalization.
- `src/shared/db/domain/lootReducers.js`: pure loot-bag, claim, and gold reducers.
- `src/shared/db/domain/questReducers.js`: pure quest, objective, reward, notification, and quest soft-delete reducers.
- `src/shared/db/domain/encounterReducers.js`: pure encounter, combatant, initiative, turn, condition, and encounter soft-delete reducers.
- `src/shared/db/v2/repositories.js`: targeted Firestore v2 document updates and transactions.

Migrated paths:

- Campaign create/archive/restore and SessionManager campaign list restore UI.
- Character create/archive/restore/import and SessionManager character restore UI.
- User assign/revoke and Admin Player tab user revoke.
- Admin Player tab character updates and party XP set/add.

- Player local `updateCharacter` wrapper, covering most inventory/equipment/rune/weapon/formula handlers.
- Player item transfer.
- Player loot item claim, gold claim, and gold split.
- GM ItemsView loot bag add/remove/quantity/create/lock/gold updates.
- GM ItemsView item/formula assignment to characters.
- GM QuestsView quest create/update/archive/restore, objective toggles, secret reveal, and reward distribution.
- GM EncounterView encounter create/archive/restore/activate, combatants, HP, initiative, turn state, selected entity, visibility, conditions, and CharacterCard edits.

Soft delete uses `deletedAt`/`deletedBy`; restore removes those fields and sets `restoredAt`/`restoredBy`. `CampaignContext.campaigns`, `activeCampaign.characters`, `activeCampaign.quests`, and `activeCampaign.encounters` expose active records; `archivedCampaigns`, `activeCampaign.archivedCharacters`, `activeCampaign.archivedQuests`, and `activeCampaign.archivedEncounters` expose archived records.

Quest rewards are idempotent via applied markers and are not automatically rolled back if an objective is later marked incomplete. Quest reward notifications are campaign-scoped via `campaign.notificationQueue`; root `db.notificationQueue` remains a legacy fallback.

`CampaignContext.updateActiveCampaign` intentionally remains a broad compatibility helper for non-migrated map/camping/progress style updates.

Remaining broad write paths are tracked in `docs/agent/domain-actions.md` and `docs/agent/known-risks.md`.

## Data Model Snapshot

`src/data/new_db.json` currently has top-level keys including `campaigns`, `users`, `shop`, `lore`, `bestiary`, `abilities`, `actions`, `feats`, `pacts`, `rules`, `runes`, `notificationQueue`, and legacy root arrays `characters`, `quests`, `lootBags`.

Current seed includes one campaign named `War of the Elements` with characters, loot bags, maps, encounters, camping, progress, XP, and XP notification fields. Root `quests` and `lootBags` still exist for legacy compatibility.

Character objects are heterogeneous. Common areas:

- identity: `id`, `name`, `level`
- progression: `xp`, `gold`, `money`
- stats: `stats.hp`, `stats.ac`, `stats.attributes`, `stats.saves`, `stats.perception`, `stats.speed`
- skills and lore keys can use mixed casing or generated names.
- inventory items may be full catalog-derived objects, short `{ name, qty }` records, or custom/augmented objects with `system`, `instanceId`, `equipped`, `prepared`, `loaded`, runes, wand/staff data, etc.

## Catalog Pipeline

Generated compact indexes are decoded by `src/shared/catalog/*Index.js`. The source inputs live under `ressources/`.

Important scripts:

- `scripts/build_shop.js` -> `src/data/shop_catalog.json`, `src/data/shop_index.json`
- `scripts/build_spells.js` -> spell catalog/index
- `scripts/build_feats.js` -> feat catalog/index
- `scripts/generate_action_index.js` -> action index
- `scripts/build_impulses.js` -> impulse catalog/index
- `scripts/build_creatures.js` -> creature catalog/index
- `scripts/build_ability_index.js` -> ability index
- `scripts/build_icons.js` -> icon catalog
- `scripts/copy_ressources_to_dist.js` copies `ressources/` into `dist/ressources/` after production build.

`src/data/creature_catalog.json` is ignored in git, but the compact creature index is present. Runtime creature detail fetches read source JSON from `ressources/`.

## Core Rule Helpers

- `src/utils/rules.js`: stats, conditions, spell attack/DC, impulse attack/class DC.
- `src/shared/utils/combatUtils.js`: weapon capacity, weapon attack bonus, inventory buckets, equipability.
- `src/utils/rules/damage.js`: weapon damage and crit profile.
- `src/utils/rules/runes.js`: rune parse/apply/remove.
- `src/shared/utils/foundryParser.js`: Foundry/PF2e markup to HTML and content-link spans.
- `src/shared/utils/inventoryUtils.js`: stackability.

## Known Architectural State

- `PlayerApp.jsx`, `AdminApp.jsx`, and `ItemsView.jsx` are large integration components and carry a lot of business logic.
- Some migration and normalization happens at runtime in React effects, especially for older skill names and data shape defaults.
- Admin and player flows share `ModalManager` and catalog detail fetching patterns.
- Direct browser prompts/alerts/confirms are common.
- `dangerouslySetInnerHTML` is used for parsed PF2e/Foundry content. Treat `parseFoundry` and trusted source assumptions carefully.
- There are many visible symbol/icon strings; terminal output showed mojibake for some files. Before changing display text or icons, verify browser rendering and file encoding.

## Documentation Index

- `docs/agent/architecture.md`: route tree, app composition, main data flow.
- `docs/agent/data-and-persistence.md`: legacy DB, Firestore v2, migration, rules.
- `docs/agent/catalog-pipeline.md`: source resources, generated indexes, runtime fetching.
- `docs/agent/domain-actions.md`: strangler layer for Campaign/Session, Character, Inventory, and Loot writes.
- `docs/agent/ui-flows.md`: player, GM/admin, party, camping, maps, pacts.
- `docs/agent/known-risks.md`: current risks, cleanup candidates, modernization notes.

## Work Guidance

For new features, decide first:

- Is this campaign-scoped, global, or catalog/resource data?
- Does it need to work in both legacy and `?db=v2` modes?
- Is the best source of truth `src/data/new_db.json`, Firestore v2 documents, generated catalog data, or raw `ressources/` files?
- Which UI shells need it: player, admin, party screen, camp screen, or all?

Update the durable docs whenever the answer is not obvious from the code.
