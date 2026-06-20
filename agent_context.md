# Agent Context

Last deep scan: 2026-06-20.

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
- Node test runner via `node --test tests/*.test.js`; `npm run check` runs tests, the broad-write guard, and a Vite app build.
- A minimal Python project exists only for `openpyxl`; current app scripts are Node-based.

## Entry Points

- `src/main.jsx` wraps `<App />` in `AuthProvider`.
- `src/App.jsx` starts Firestore V2 directly on the `v2-convergence` branch and selects route shells. Player, Admin, Party, and Camp route shells are loaded with `React.lazy`.
  - Legacy `usePersistedDb` is no longer part of the normal app entry on this branch.
  - `?db=v2` is no longer required on this branch; the old query-param distinction is kept only in docs/history until final cleanup.
  - `?admin=true`: GM/admin app.
  - `?party=true`: read-only party encounter screen.
  - `?camp=true`: camp overview screen.
  - no special query: player app.
- `src/shared/context/CampaignContext.jsx` derives active campaign, GM status, user assignment, and scoped domain actions.

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
- `tests/`: domain reducer, data-action adapter, selector, broad-write guard, and Firestore v2 normalizer tests.

## Persistence Summary

The `v2-convergence` branch starts from Firestore V2. The UI still mostly consumes a legacy-shaped compatibility projection, but `useFirestoreV2Db` also builds a V2-native view model for the ongoing read-model cutover.

Legacy/import compatibility:

- `src/shared/db/usePersistedDb.js`
- LocalStorage key `pf2e-data`.
- Optional Firestore document `data/master`.
- Adds `_lastWriteTimestamp` for echo suppression.
- Runs `migrateDb` before use.
- Not used by `src/App.jsx` on `v2-convergence`; keep it as import/backup/reference code until the legacy cleanup phase.

Firestore V2 runtime:

- `src/shared/db/v2/useFirestoreV2Db.js`
- LocalStorage key `pf2e-data-v2-projection`.
- Subscribes to normalized collections from `src/shared/db/v2/schema.js`.
- Uses `composeRuntimeDbFromV2Store` in `CampaignContext` as the normal runtime compatibility DB; this is derived from V2 documents, not from the legacy projection hook output.
- Still creates `legacyProjection` for explicit import/backup compatibility and remaining migration tests.
- Uses `composeV2ViewModelFromDocuments` to expose a native grouped V2 view model through `dbStatus.v2ViewModel`.
- Returns `{ legacyProjection, v2Store, status }`; the projection is a temporary compatibility read model, not a write contract.
- Broad legacy DB diffs are no longer part of the V2 runtime write path. `writeLegacyDbDiffToV2` is isolated to migration/import code.
- Campaign/Session, Character, Actor, Actor Effect, Inventory, Loot, Quests/Rewards, Encounters, Maps, Progress, Camping, shop/trader, global custom content, Pacts, Abilities, Lore, Bestiary metadata/custom creatures, catalog overrides, and Player runtime fallbacks now go through `CampaignContext.dataActions` and targeted V2 repositories/transactions where migrated.
- `CampaignContext` and global-facing views use pure selectors under `src/shared/db/selectors/` for campaign/character/actor/effect, shop, pact, ability, lore, and bestiary reads.

Firestore V2 collections include `campaigns`, campaign subcollections `actors`, `actorEffects`, `effectTemplates`, `quests`, `lootBags`, `encounters`, `maps`, `members`, plus top-level `global`, `catalogOverrides`, `loreArticles`, and `migrationBackups`. Old `characters`, `customItems`, `customCreatures`, and `customActions` collections remain readable transition/import data, but new runtime writes should not target them.

V2 is the convergence branch runtime, but the branch is not yet production-cutover ready. Before deploying it as the play branch, use `docs/agent/v2-default-readiness.md` for the required manual smoke checklist and Firestore rules audit.

## Domain Actions Snapshot

`CampaignContext` exposes `dataActions`, `dbMode`, and `dbStatus`.

Current domain action files:

- `src/shared/db/domain/createDataActions.js`: adapter selection and public action API.
- `src/shared/db/domain/campaignReducers.js`: campaign/session reducers, soft delete, user assignment, party XP.
- `src/shared/db/domain/inventoryReducers.js`: pure character/inventory reducers and identity normalization.
- `src/shared/db/domain/characterEditReducers.js`: pure Player basis-value reducers for gold, attributes, HP, speed, Class DC, and daily crafting batches.
- `src/shared/db/domain/actorReducers.js`: pure actor, actor effect, effect template, and catalog override record helpers.
- `src/shared/db/domain/lootReducers.js`: pure loot-bag, claim, and gold reducers.
- `src/shared/db/domain/questReducers.js`: pure quest, objective, reward, notification, and quest soft-delete reducers.
- `src/shared/db/domain/encounterReducers.js`: pure encounter, combatant, initiative, turn, condition, and encounter soft-delete reducers.
- `src/shared/db/domain/mapReducers.js`: pure map, pin, scale, order, and map soft-delete reducers.
- `src/shared/db/domain/progressReducers.js`: pure progress normalization, active-only filtering, section updates, and top-level progress soft-delete reducers.
- `src/shared/db/domain/campingReducers.js`: pure camping settings, activity, assignment, roll, and custom activity soft-delete reducers.
- `src/shared/db/domain/globalContentReducers.js`: pure shop/trader, global custom content, pact, ability, lore, bestiary metadata/custom creature, notification, and reveal-state reducers.
- `src/shared/db/selectors/`: pure read selectors for campaign, character, actor, effect, inventory, shop, bestiary, progress, pact, ability, and lore data.
- `src/shared/db/v2/repositories.js`: targeted Firestore v2 document updates and transactions.

Migrated paths:

- Campaign create/archive/restore and SessionManager campaign list restore UI.
- Character create/archive/restore/import and SessionManager character restore UI.
- User assign/revoke and Admin Player tab user revoke.
- Admin Player tab character updates and party XP set/add.
- PC character lifecycle writes campaign-scoped `actors(kind="pc")`; `CampaignContext` exposes `actors`, `archivedActors`, and `myActor` in addition to transitional character viewmodels derived from PC Actors.
- `ConditionsModal`, Player Stats, Admin CharacterCard backlash, and item mutagen effects use campaign-scoped `actorEffects`; runtime UI no longer writes `character.conditions`.
- `CompanionTab` reads and writes owned companion Actors (`animal_companion`, `familiar`, `pet`) instead of `character.companion`; companion conditions use `actorEffects`.
- Deployed item, spell, action, feat, impulse, ability, and creature editing writes Firestore `catalogOverrides`; static resource file APIs remain local-dev helpers.

- Player local `updateCharacter` wrapper remains for not-yet-migrated PC sheet edits, but V2 character compatibility actions now write PC Actor documents through the actor repository rather than the old characters collection.
- Player basis edits for gold, attributes, current/temp/max HP, speed, Class DC, and Formula Book daily batch max use targeted `dataActions.character` methods.
- Player item transfer.
- Player loot item claim, gold claim, and gold split.
- GM ItemsView loot bag add/remove/quantity/create/lock/gold updates.
- GM ItemsView item/formula assignment to characters.
- GM QuestsView quest create/update/archive/restore, objective toggles, secret reveal, and reward distribution.
- GM EncounterView encounter create/archive/restore/activate, combatants, HP, initiative, turn state, selected entity, visibility, conditions, and CharacterCard edits.
- GM MapAdminView map create/update/archive/restore, order changes, image URL persistence, pin edits, and scale calibration.
- GM ProgressAdminView progress section updates and top-level archive/restore for factions, topics, stages, and elements.
- Player ProgressView reads active-only Progress data.
- GM/player Camping views update DC settings, custom/default activities, assignments, rolls, and unassigns through `dataActions.camping`.
- Camping assignments store `characterId` plus `characterName`; old name-only assignments remain readable.
- GM ItemsView trader create/update/hide/inventory and shop availability/formula writes use `dataActions.shop`.
- GM and player custom item/action saves use `dataActions.globalContent`.
- GM AbilitiesView custom ability saves/deletes/clones and custom-creature ability assignment use `dataActions.globalContent` and `dataActions.bestiary`.
- GM PactAdminView and DeviantAbilitiesAdminView use `dataActions.pact`.
- GM LoreAdminView uses `dataActions.globalContent` with `loreArticles`.
- GM BestiaryView custom creature save/update/delete, metadata edits, bestiary toggles, group edits, reveal-state, and catalog metadata initialization use `dataActions.bestiary`.
- Encounter creature reveal-state writes use `dataActions.bestiary.updateRevealState`.
- Player root-notification clearing uses `dataActions.globalContent.clearRootNotification`.
- Player skill-name runtime repair uses `dataActions.character.updateCharacter`.
- Pacts, Abilities, Lore, Bestiary, Shop, Items, Encounter, Party, and Player inventory reads use selector helpers instead of component-local root-field fallbacks.

Soft delete uses `deletedAt`/`deletedBy`; restore removes those fields and sets `restoredAt`/`restoredBy`. `CampaignContext.campaigns`, actor-first character selectors, `activeCampaign.quests`, `activeCampaign.encounters`, and `activeCampaign.maps` expose active records; `archivedCampaigns`, actor-first archived character selectors, `activeCampaign.archivedQuests`, `activeCampaign.archivedEncounters`, and `activeCampaign.archivedMaps` expose archived records.

Quest rewards are idempotent via applied markers and are not automatically rolled back if an objective is later marked incomplete. Quest reward notifications are campaign-scoped via `campaign.notificationQueue`; root `db.notificationQueue` remains a legacy fallback.

Broad UI and context writes have been removed from Player/Admin route trees and `CampaignContext`. The only permitted broad write path is the legacy adapter implementation inside `createDataActions`; all runtime UI writes should go through `dataActions`. `scripts/check_broad_writes.js` also guards against reintroducing runtime `character.conditions`, `character.companion`, root `db.characters`, and unguarded production `/api/files/save` dependencies.

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

Bundle model:

- `vite.config.js` isolates large catalog decoders into explicit data chunks: `ability-index`, `shop-index`, `creature-index`, `feat-index`, `spell-index`, `impulse-index`, `action-index`, plus `pacts-data`.
- Shared dropdown/editor primitives are isolated in `shared-ui` to keep admin feature routes from importing player-common chunks just for small shared components.
- `ImagePicker` loads `icon_catalog.json` as a JSON asset instead of a JavaScript chunk.
- `RichTextEditor` lazy-loads Action/Item/Spell UUID dropdown catalogs only when those dropdowns open.
- Player `LoreView` and `PartyScreen` lazy-load the creature index for bestiary/creature detail paths.
- Remaining large data chunks are expected until player/admin catalog modals are converted to async-data flows rather than static index imports.

## Core Rule Helpers

- `src/utils/rules.js`: stats, conditions, spell attack/DC, impulse attack/class DC.
- `src/shared/utils/combatUtils.js`: weapon capacity, weapon attack bonus, inventory buckets, equipability.
- `src/utils/rules/damage.js`: weapon damage and crit profile.
- `src/utils/rules/runes.js`: rune parse/apply/remove.
- `src/shared/utils/foundryParser.js`: Foundry/PF2e markup to HTML and content-link spans.
- `src/shared/utils/inventoryUtils.js`: stackability.

## Known Architectural State

- `src/player/PlayerApp.jsx` is now a route shell; `src/player/PlayerAppController.jsx` is a thin orchestrator backed by hooks in `src/player/hooks/`.
- Player controller hooks: `usePlayerNavigation`, `usePlayerModalState`, `usePlayerCatalogInspection`, `usePlayerCharacterActions`, and `usePlayerInventoryActions`.
- `src/admin/AdminApp.jsx` delegates tab rendering to `src/admin/AdminTabContent.jsx`, and admin tab views are lazy loaded.
- `src/admin/ItemsView.jsx` is now the data/action controller for `src/admin/items/ItemsViewLayout.jsx`.
- `src/admin/EncounterView.jsx` delegates sidebar/info-panel rendering to `src/admin/encounter/EncounterPanels.jsx`.
- Character runtime shape normalization lives in `src/shared/db/domain/characterShape.js` and is applied by `migrateDb`, V2 normalizers, character creation, and character updates.
- Admin and player flows share `ModalManager` and catalog detail fetching patterns.
- Direct browser prompts/alerts/confirms are common.
- `dangerouslySetInnerHTML` is used for parsed PF2e/Foundry content. Treat `parseFoundry` and trusted source assumptions carefully.
- There are many visible symbol/icon strings; terminal output showed mojibake for some files. Before changing display text or icons, verify browser rendering and file encoding.

## Documentation Index

- `docs/agent/architecture.md`: route tree, app composition, main data flow.
- `docs/agent/data-and-persistence.md`: legacy DB, Firestore v2, migration, rules.
- `docs/agent/v2-default-readiness.md`: checklist and Firestore rules audit for a future V2 default switch.
- `docs/agent/catalog-pipeline.md`: source resources, generated indexes, runtime fetching.
- `docs/agent/domain-actions.md`: strangler layer for Campaign/Session, Character, Inventory, and Loot writes.
- `docs/agent/migration-backlog.md`: remaining broad writes grouped by domain and guarded migrated files.
- `docs/agent/migration-wave-maps-progress-camping.md`: current step-by-step wave status and assessments for Maps, Progress, and Camping.
- `docs/agent/ui-flows.md`: player, GM/admin, party, camping, maps, pacts.
- `docs/agent/known-risks.md`: current risks, cleanup candidates, modernization notes.

## Work Guidance

For new features, decide first:

- Is this campaign-scoped, global, or catalog/resource data?
- Is this runtime work, or legacy import/backup compatibility?
- Is the best source of truth `src/data/new_db.json`, Firestore v2 documents, generated catalog data, or raw `ressources/` files?
- Which UI shells need it: player, admin, party screen, camp screen, or all?

Update the durable docs whenever the answer is not obvious from the code.
