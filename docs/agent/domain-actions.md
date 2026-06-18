# Domain Actions

Last updated: 2026-06-17.

## Purpose

The project now has a first strangler layer for moving runtime writes away from broad legacy `setDb` updates.

Location:

- `src/shared/db/domain/inventoryReducers.js`
- `src/shared/db/domain/lootReducers.js`
- `src/shared/db/domain/campaignReducers.js`
- `src/shared/db/domain/questReducers.js`
- `src/shared/db/domain/encounterReducers.js`
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
- Does not route migrated writes through `writeLegacyDbDiffToV2`.

If Firestore config is missing, the adapter falls back to legacy mode.

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

## Remaining Direct Legacy Writes

Expected after the quest/encounter wave:

- Generic `updateActiveCampaign` remains a compatibility path because maps, camping, progress, and some pact/player-local flows still use it for non-migrated child collections.
- Map, camping, progress, pact, custom content, bestiary reveal-state, and global catalog writes still have direct/broad `setDb` paths.
- Player-created custom item catalog registration still uses `onSetDb` for global custom item storage.
- Some legacy fallback branches remain in `ItemsView` for trader/global behavior.
- `useFirestoreV2Db` still keeps broad diff writes for non-migrated paths.

Next migrations should add domain actions for maps, camping, progress, pacts, bestiary reveal-state, and global/custom content before switching V2 to default.
