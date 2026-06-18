# Domain Actions

Last updated: 2026-06-18.

## Purpose

The project now has a first strangler layer for moving runtime writes away from broad legacy `setDb` updates.

Location:

- `src/shared/db/domain/inventoryReducers.js`
- `src/shared/db/domain/lootReducers.js`
- `src/shared/db/domain/campaignReducers.js`
- `src/shared/db/domain/questReducers.js`
- `src/shared/db/domain/encounterReducers.js`
- `src/shared/db/domain/mapReducers.js`
- `src/shared/db/domain/progressReducers.js`
- `src/shared/db/domain/campingReducers.js`
- `src/shared/db/domain/globalContentReducers.js`
- `src/shared/db/selectors/`
- `src/shared/db/domain/createDataActions.js`
- `src/shared/db/v2/repositories.js`

The UI still reads the legacy-shaped projection, but migrated write paths call `dataActions` from `CampaignContext`.

## Current API Surface

`CampaignContext` exposes:

- `dbMode`
- `dbStatus`
- `dataActions`

`dataActions.character`:

- `updateCharacter(campaignId, characterId, updater)`
- `createCharacter(campaignId, character)`
- `softDeleteCharacter(campaignId, characterId)`
- `restoreCharacter(campaignId, characterId)`
- `importLegacyCharacter(campaignId, character, legacyIndex)`

`dataActions.campaign`:

- `createCampaign(name)`
- `softDeleteCampaign(campaignId)`
- `restoreCampaign(campaignId)`
- `updateCampaign(campaignId, updater)`
- `setPartyXp(campaignId, xp)`
- `addPartyXp(campaignId, amount)`
- `clearNotification(campaignId, notificationId)`

`dataActions.member`:

- `assignUser(email, campaignId, characterId, role)`
- `revokeUser(email)`

`dataActions.inventory`:

- `addItem(campaignId, characterId, item, options)`
- `updateItem(campaignId, characterId, item, updater)`
- `removeItem(campaignId, characterId, item)`
- `setItemQuantity(campaignId, characterId, item, qty)`
- `transferItem(campaignId, fromCharacterId, toCharacterId, item, qty)`

`dataActions.loot`:

- `createLootBag(campaignId, lootBag)`
- `updateLootBag(campaignId, lootBagId, updater)`
- `addItems(campaignId, lootBagId, items)`
- `removeItems(campaignId, lootBagId, items)`
- `setItemQuantity(campaignId, lootBagId, items, qty)`
- `claimItem(campaignId, lootBagId, item, characterId)`
- `claimGold(campaignId, lootBagId, characterId, amount)`
- `splitGold(campaignId, lootBagId)`

`dataActions.quest`:

- `createQuest(campaignId, quest)`
- `updateQuest(campaignId, questId, updater)`
- `softDeleteQuest(campaignId, questId)`
- `restoreQuest(campaignId, questId)`
- `toggleObjective(campaignId, questId, objectiveIndex, completed)`
- `toggleObjectiveHidden(campaignId, questId, objectiveIndex)`
- `revealSecret(campaignId, questId, secretText)`

`dataActions.encounter`:

- `createEncounter(campaignId, nameOrEncounter)`
- `updateEncounter(campaignId, encounterId, updater)`
- `softDeleteEncounter(campaignId, encounterId)`
- `restoreEncounter(campaignId, encounterId)`
- `activateEncounter(campaignId, encounterId)`
- `addCombatant(campaignId, encounterId, type, data)`
- `addAllPlayers(campaignId, encounterId)`
- `removeCombatant(campaignId, encounterId, combatantId)`
- `updateCombatant(campaignId, encounterId, combatantId, updater)`
- `selectEntity(campaignId, encounterId, entityId)`
- `endTurn(campaignId, encounterId)`
- `resetRound(campaignId, encounterId)`
- `rollInitiativeAll(campaignId, encounterId, creatureDataById)`
- `addCondition(campaignId, encounterId, combatantId, condition)`

`dataActions.map`:

- `createMap(campaignId, nameOrMap)`
- `updateMap(campaignId, mapId, updater)`
- `softDeleteMap(campaignId, mapId)`
- `restoreMap(campaignId, mapId)`
- `reorderMaps(campaignId, orderedIds)`
- `setImageUrl(campaignId, mapId, imageUrl)`
- `upsertPin(campaignId, mapId, pin)`
- `deletePin(campaignId, mapId, pinId)`
- `setScale(campaignId, mapId, scale)`

`dataActions.progress`:

- `updateProgress(campaignId, patchOrUpdater)`
- `softDeleteEntry(campaignId, section, entryId)`
- `restoreEntry(campaignId, section, entryId)`

`dataActions.camping`:

- `updateSettings(campaignId, patchOrUpdater)`
- `upsertActivity(campaignId, activity)`
- `deleteActivity(campaignId, activityId)`
- `restoreActivity(campaignId, activityId)`
- `resetDefaultActivity(campaignId, activityId)`
- `assignActivity(campaignId, activityId, character)`
- `recordActivityRoll(campaignId, activityId, character, rollResult)`
- `unassignActivity(campaignId, activityId, character)`

`dataActions.bestiary`:

- `updateRevealState(creatureId, field, revealMode)`
- `saveCustomCreature(creature)`
- `updateCustomCreature(creatureId, updater)`
- `deleteCreature(creatureId)`
- `updateCreatureMetadata(creatureId, updater)`
- `initializeCreatureMetadata(metadataEntries)`

`dataActions.globalContent`:

- `saveCustomItem(item)`
- `deleteCustomItem(itemOrName)`
- `saveCustomAction(action)`
- `deleteCustomAction(actionOrName)`
- `saveCustomAbility(ability)`
- `deleteCustomAbility(abilityOrId)`
- `saveLoreArticle(article)`
- `deleteLoreArticle(articleOrId)`
- `moveLoreArticle(articleId, direction)`
- `clearRootNotification(notificationId)`

`dataActions.pact`:

- `savePact(pact)`
- `deletePact(pactOrId)`
- `saveDeviantAbility(ability)`
- `deleteDeviantAbility(abilityOrId)`

`dataActions.shop`:

- `createTrader(traderOrName, category)`
- `updateTrader(traderId, updater)`
- `deleteTrader(traderId)`
- `setTraderHidden(traderId, hidden)`
- `addItemsToTrader(traderId, items)`
- `removeItemsFromTrader(traderId, items)`
- `setItemAvailable(itemName, available)`
- `setFormulaAvailable(itemName, available)`

## Adapter Behavior

Legacy mode:

- Uses the same pure reducers against the legacy campaign snapshot.
- Writes through local `setDb`.
- Keeps current default mode behavior intact.

Firestore V2 mode:

- Uses repository transactions for character, inventory transfer, loot item claim, gold claim, and gold split.
- Uses targeted campaign, character, and member document writes for SessionManager flows.
- Uses targeted loot-bag document updates for loot bag create/update/add/remove/quantity.
- Uses targeted quest, campaign, and character transactions for quest rewards.
- Uses targeted encounter document updates for encounter CRUD, combatants, initiative, and turn state.
- Uses targeted map document updates for map CRUD/archive/restore, ordering, pins, scale, and image URL writes.
- Uses targeted campaign document updates for progress sections and top-level progress archives/restores.
- Uses targeted campaign document updates for camping settings, custom activities, assignments, rolls, and reset/archive/restore behavior.
- Uses targeted global config/custom document writes for shop/trader state, custom items/actions, custom abilities, pacts, deviant abilities, lore, bestiary reveal-state, bestiary metadata, custom creatures, and root-notification compatibility.
- Does not route migrated writes through `writeLegacyDbDiffToV2`.

If Firestore config is missing, the adapter falls back to legacy mode.

`createDataActions` accepts optional `repositories` and `firestore` parameters. `CampaignContext` injects the runtime Firestore repositories; tests inject fake repositories without loading Firebase.

## Identity Rules

- Inventory and loot items are normalized with `instanceId` on every domain write.
- Mutations prefer `instanceId`.
- Fallback matching by `id`, `_index`, name, equipment/prepared flags, and `addedAt` remains for old data.
- New inventory instances get new `instanceId`s.
- Stackable inventory additions merge by item name when the existing item is not equipped/prepared.
- Partial loot stack claims reduce the remaining loot quantity instead of marking the whole stack claimed.
- Full loot claims mark the loot item with `claimedBy` and are idempotent for the same claimant.

## Migrated UI Paths

Campaign/Session:

- Campaign create/archive/restore.
- Character create/archive/restore/import.
- User assign/revoke.
- Admin Player tab character card updates.
- Admin party XP set/add.

Soft delete:

- Campaigns and characters are archived with `deletedAt` and optional `deletedBy`.
- Restores remove `deletedAt`/`deletedBy` and set `restoredAt`/`restoredBy`.
- `CampaignContext.campaigns` and `activeCampaign.characters` expose only active records.
- `CampaignContext.archivedCampaigns` and `activeCampaign.archivedCharacters` expose archived records for restore UI.
- Quests/Subquests and Encounters are also archived with the same metadata and exposed as `activeCampaign.archivedQuests` and `activeCampaign.archivedEncounters`.
- Maps are archived with the same metadata and exposed as `activeCampaign.archivedMaps`.
- Top-level Progress entries are archived with the same metadata: reputation factions, research topics, calcifer stages, and material elements.
- Custom Camping activities are archived with the same metadata; default activity reset removes only the override record.
- Quest rewards use `rewardAppliedAt`/`rewardAppliedBy` markers so objective and quest rewards are idempotent. Rewards are not automatically rolled back if an objective is later marked incomplete.
- Quest reward notifications are campaign-scoped in `campaign.notificationQueue`; root `db.notificationQueue` remains a legacy fallback.

Player:

- Character updates routed through `dataActions.character.updateCharacter`.
- Inventory transfer routed through `dataActions.inventory.transferItem`.
- Loot item claim, gold claim, and gold split routed through `dataActions.loot`.
- Existing consume, buy, quantity, equip, rune, weapon load/fire, formula, and daily-prep handlers now benefit from targeted character-document writes because they use the local `updateCharacter` wrapper.

GM Items/Loot:

- Dragging catalog items to loot bags.
- Removing items from loot bags.
- Setting loot item quantity.
- Creating loot bags.
- Locking/unlocking loot visibility.
- Editing loot gold value.
- Adding loot via context menu.
- Giving items or formulas to a character.

GM Quests/Rewards:

- Quest create/update/archive/restore.
- Objective complete/incomplete and hidden toggles.
- Secret reveal.
- Objective and quest reward distribution to active characters.
- Campaign XP and campaign-scoped notification queue updates.

GM Encounters:

- Encounter create/archive/restore/activate.
- Add/remove/update combatants.
- Add all active players without duplicating existing combatants.
- Initiative, HP, visibility, selected entity, turn end/reset, creature initiative rolls, and conditions.
- CharacterCard edits inside the encounter detail panel use `dataActions.character.updateCharacter`.

GM Maps:

- Map create/update/archive/restore.
- Map order changes.
- Map image URL persistence after UI/server upload.
- Pin add/update/delete.
- Scale calibration persistence.

GM/Player Progress:

- Progress section updates for reputation, research, calcifer, and materials.
- Archive/restore for top-level progress entries.
- Player progress views read active-only progress data.

GM/Player Camping:

- Camping DC setting updates.
- Custom/default activity edits.
- Custom activity archive/restore.
- Default activity override reset.
- Player activity assignment, roll recording, and unassign.
- Assignments store `characterId` plus legacy-compatible `characterName`.

Global/Shop/Bestiary:

- GM ItemsView trader create/update/category/hide and trader inventory edits.
- GM ItemsView available item/formula toggles.
- GM/player custom item saves and custom action saves.
- GM AbilitiesView custom ability saves/deletes/clones and custom-creature ability assignment.
- GM BestiaryView custom creature saves/updates/deletes.
- GM BestiaryView catalog metadata, bestiary toggles, group edits, reveal-state, and metadata initialization.
- Encounter creature reveal-state updates.

Pacts/Lore:

- GM PactAdminView pact save/delete.
- GM DeviantAbilitiesAdminView deviant ability save/delete.
- GM LoreAdminView article create/save/delete/clone/move.

Player compatibility:

- Root notification fallback clearing uses `dataActions.globalContent.clearRootNotification`.
- Runtime skill-name repair uses `dataActions.character.updateCharacter`.

## Remaining Direct Legacy Writes

Expected after the Global Admin Content wave:

- Generic `updateActiveCampaign` remains a deprecated compatibility path in `CampaignContext`.
- `AdminApp` keeps a root-character fallback for the old campaignless admin/player mode.
- `useFirestoreV2Db` still keeps broad diff writes for non-migrated paths.

Next migrations should keep shrinking compatibility reads and the root legacy projection before switching V2 to default.
