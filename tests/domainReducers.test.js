import test from 'node:test';
import assert from 'node:assert/strict';
import {
    addItemToCharacter,
    transferInventoryItem,
} from '../src/shared/db/domain/inventoryReducers.js';
import {
    claimLootGoldState,
    claimLootItemState,
    splitLootGoldState,
} from '../src/shared/db/domain/lootReducers.js';
import {
    addPartyXpInCampaign,
    assignUserInDb,
    buildCampaignViewModel,
    importLegacyCharacterInDb,
    restoreCampaignInDb,
    restoreCharacterInCampaign,
    revokeUserInDb,
    setPartyXpInCampaign,
    softDeleteCampaignInDb,
    softDeleteCharacterInDb,
} from '../src/shared/db/domain/campaignReducers.js';
import {
    restoreQuestTreeInCampaign,
    softDeleteQuestTreeInCampaign,
    toggleQuestObjectiveInCampaign,
} from '../src/shared/db/domain/questReducers.js';
import {
    activateEncounterInCampaign,
    addAllPlayersToEncounterInCampaign,
    addCombatantToEncounterInCampaign,
    addConditionToCombatantInCampaign,
    createEncounterInCampaign,
    endEncounterTurnInCampaign,
    removeCombatantFromEncounterInCampaign,
    restoreEncounterInCampaign,
    rollEncounterInitiativeInCampaign,
    softDeleteEncounterInCampaign,
    updateCombatantInEncounterInCampaign,
} from '../src/shared/db/domain/encounterReducers.js';
import {
    createMapRecord,
    deleteMapPinInCampaign,
    reorderMapsInCampaign,
    restoreMapInCampaign,
    setMapScaleInCampaign,
    softDeleteMapInCampaign,
    upsertMapInCampaign,
    upsertMapPinInCampaign,
} from '../src/shared/db/domain/mapReducers.js';
import {
    getProgress,
    restoreProgressEntryInCampaign,
    softDeleteProgressEntryInCampaign,
    updateProgressInCampaign,
} from '../src/shared/db/domain/progressReducers.js';
import {
    assignCampingActivityInCampaign,
    recordCampingActivityRollInCampaign,
    resetDefaultCampingActivityInCampaign,
    restoreCampingActivityInCampaign,
    softDeleteCampingActivityInCampaign,
    unassignCampingActivityInCampaign,
    updateCampingInCampaign,
    upsertCampingActivityInCampaign,
} from '../src/shared/db/domain/campingReducers.js';

function idFactory() {
    let index = 0;
    return () => `test_id_${++index}`;
}

test('adds stable instance ids and stacks stackable inventory items', () => {
    const createId = idFactory();
    const character = {
        id: 'char1',
        inventory: [{ name: 'Healing Potion', type: 'consumable', qty: 1 }],
    };

    const result = addItemToCharacter(character, { name: 'Healing Potion', type: 'consumable' }, {
        qty: 2,
        createId,
    });

    assert.equal(result.inventory.length, 1);
    assert.equal(result.inventory[0].qty, 3);
    assert.equal(result.inventory[0].instanceId, 'test_id_1');
});

test('keeps non-stackable items as separate instances', () => {
    const createId = idFactory();
    const character = { id: 'char1', inventory: [] };

    const withFirstSword = addItemToCharacter(character, { name: 'Longsword', type: 'weapon' }, { createId });
    const withSecondSword = addItemToCharacter(withFirstSword, { name: 'Longsword', type: 'weapon' }, { createId });

    assert.equal(withSecondSword.inventory.length, 2);
    assert.notEqual(withSecondSword.inventory[0].instanceId, withSecondSword.inventory[1].instanceId);
});

test('transfers item quantities between characters by item identity', () => {
    const createId = idFactory();
    const campaign = {
        id: 'camp1',
        characters: [
            { id: 'char1', inventory: [{ instanceId: 'item1', name: 'Arrow', type: 'ammunition', qty: 5 }] },
            { id: 'char2', inventory: [{ instanceId: 'item2', name: 'Arrow', type: 'ammunition', qty: 1 }] },
        ],
    };

    const result = transferInventoryItem(campaign, 'char1', 'char2', { instanceId: 'item1' }, 3, { createId });

    assert.equal(result.characters[0].inventory[0].qty, 2);
    assert.equal(result.characters[1].inventory.length, 1);
    assert.equal(result.characters[1].inventory[0].qty, 4);
});

test('claims loot once and records the claimant without duplicating inventory', () => {
    const createId = idFactory();
    const lootBag = {
        id: 'loot1',
        items: [{ name: 'Elixir', type: 'consumable', qty: 1 }],
        goldValue: 0,
    };
    const character = { id: 'char1', inventory: [] };

    const firstClaim = claimLootItemState(lootBag, character, { name: 'Elixir' }, {
        createId,
        claimedBy: 'char1',
    });
    const secondClaim = claimLootItemState(firstClaim.lootBag, firstClaim.character, { name: 'Elixir' }, {
        createId,
        claimedBy: 'char1',
    });

    assert.equal(firstClaim.lootBag.items[0].claimedBy, 'char1');
    assert.equal(secondClaim.character.inventory.length, 1);
    assert.throws(() => claimLootItemState(firstClaim.lootBag, { id: 'char2', inventory: [] }, { name: 'Elixir' }, {
        createId,
        claimedBy: 'char2',
    }));
});

test('claims partial loot stacks without marking the remaining stack claimed', () => {
    const createId = idFactory();
    const lootBag = {
        id: 'loot1',
        items: [{ instanceId: 'loot_item_1', name: 'Arrow', type: 'ammunition', qty: 10 }],
        goldValue: 0,
    };
    const character = { id: 'char1', inventory: [] };

    const result = claimLootItemState(lootBag, character, { instanceId: 'loot_item_1', qty: 4 }, {
        createId,
        claimedBy: 'char1',
    });

    assert.equal(result.lootBag.items[0].qty, 6);
    assert.equal(result.lootBag.items[0].claimedBy, undefined);
    assert.equal(result.character.inventory[0].qty, 4);
});

test('claims and splits loot gold deterministically', () => {
    const lootBag = { id: 'loot1', items: [], goldValue: 10 };
    const character = { id: 'char1', gold: 2 };

    const claimed = claimLootGoldState(lootBag, character, 4);
    assert.equal(claimed.lootBag.goldValue, 6);
    assert.equal(claimed.character.gold, 6);

    const split = splitLootGoldState(claimed.lootBag, [
        { id: 'char1', gold: 0 },
        { id: 'char2', gold: 1 },
        { id: 'char3', gold: 2 },
    ]);

    assert.equal(split.lootBag.goldValue, 0);
    assert.deepEqual(split.characters.map(char => char.gold), [2, 3, 4]);
});

test('soft deletes and restores campaigns without removing campaign data', () => {
    const db = {
        campaigns: {
            camp1: { id: 'camp1', name: 'Campaign', characters: [{ id: 'char1', name: 'Hero' }] },
        },
    };

    const deleted = softDeleteCampaignInDb(db, 'camp1', { now: '2026-01-01T00:00:00.000Z', actorEmail: 'gm@example.com' });
    assert.equal(deleted.campaigns.camp1.deletedAt, '2026-01-01T00:00:00.000Z');
    assert.equal(deleted.campaigns.camp1.characters[0].name, 'Hero');

    const restored = restoreCampaignInDb(deleted, 'camp1', { now: '2026-01-02T00:00:00.000Z', actorEmail: 'gm@example.com' });
    assert.equal(restored.campaigns.camp1.deletedAt, undefined);
    assert.equal(restored.campaigns.camp1.restoredAt, '2026-01-02T00:00:00.000Z');
});

test('soft deletes characters, clears assignments, and restores without reassignment', () => {
    const db = {
        users: {
            'player@example.com': { role: 'player', campaignId: 'camp1', characterId: 'char1' },
            'other@example.com': { role: 'player', campaignId: 'camp1', characterId: 'char2' },
        },
        campaigns: {
            camp1: {
                id: 'camp1',
                characters: [
                    { id: 'char1', name: 'Hero', inventory: [{ name: 'Rope' }] },
                    { id: 'char2', name: 'Other' },
                ],
            },
        },
    };

    const deleted = softDeleteCharacterInDb(db, 'camp1', 'char1', { now: '2026-01-01T00:00:00.000Z' });
    const viewModel = buildCampaignViewModel(deleted.campaigns.camp1);
    assert.equal(viewModel.characters.length, 1);
    assert.equal(viewModel.archivedCharacters[0].id, 'char1');
    assert.equal(deleted.users['player@example.com'].characterId, null);
    assert.equal(deleted.users['other@example.com'].characterId, 'char2');

    const restoredCampaign = restoreCharacterInCampaign(deleted.campaigns.camp1, 'char1', { now: '2026-01-02T00:00:00.000Z' });
    assert.equal(restoredCampaign.characters.find(char => char.id === 'char1').deletedAt, undefined);
    assert.equal(deleted.users['player@example.com'].characterId, null);
});

test('assigns and revokes users with normalized email keys', () => {
    const assigned = assignUserInDb({ users: {} }, 'Player@Example.COM ', 'camp1', 'char1', 'player');
    assert.deepEqual(assigned.users['player@example.com'], {
        role: 'player',
        campaignId: 'camp1',
        characterId: 'char1',
    });

    const revoked = revokeUserInDb(assigned, 'PLAYER@example.com');
    assert.equal(revoked.users['player@example.com'], undefined);
});

test('imports legacy characters and normalizes inventory identity', () => {
    const createId = idFactory();
    const db = {
        characters: [{ name: 'Legacy Hero', inventory: [{ name: 'Rope' }] }],
        campaigns: { camp1: { id: 'camp1', characters: [] } },
    };

    const result = importLegacyCharacterInDb(db, 'camp1', db.characters[0], 0, { createId });
    assert.equal(result.characters.length, 0);
    assert.equal(result.campaigns.camp1.characters[0].name, 'Legacy Hero');
    assert(result.campaigns.camp1.characters[0].id);
    assert(result.campaigns.camp1.characters[0].inventory[0].instanceId);
});

test('sets and adds party xp for active characters only', () => {
    const campaign = {
        id: 'camp1',
        xp: 10,
        characters: [
            { id: 'char1', xp: { current: 0, max: 1000 } },
            { id: 'char2', deletedAt: '2026-01-01T00:00:00.000Z', xp: { current: 5, max: 1000 } },
        ],
    };

    const setResult = setPartyXpInCampaign(campaign, 200);
    assert.equal(setResult.xp, 200);
    assert.equal(setResult.characters[0].xp.current, 200);
    assert.equal(setResult.characters[1].xp.current, 5);

    const addResult = addPartyXpInCampaign(setResult, 25, { notificationId: 123 });
    assert.equal(addResult.xp, 225);
    assert.equal(addResult.characters[0].xp.current, 225);
    assert.deepEqual(addResult.xpNotification, { id: 123, amount: 25 });
});

test('soft deletes and restores quest trees', () => {
    const campaign = {
        id: 'camp1',
        quests: [
            { id: 'quest1', title: 'Parent' },
            { id: 'quest2', title: 'Child', parentId: 'quest1' },
            { id: 'quest3', title: 'Other' },
        ],
    };

    const deleted = softDeleteQuestTreeInCampaign(campaign, 'quest1', { now: '2026-01-01T00:00:00.000Z' });
    assert.equal(deleted.quests.find(q => q.id === 'quest1').deletedAt, '2026-01-01T00:00:00.000Z');
    assert.equal(deleted.quests.find(q => q.id === 'quest2').deletedAt, '2026-01-01T00:00:00.000Z');
    assert.equal(deleted.quests.find(q => q.id === 'quest3').deletedAt, undefined);

    const restored = restoreQuestTreeInCampaign(deleted, 'quest1', { now: '2026-01-02T00:00:00.000Z' });
    assert.equal(restored.quests.find(q => q.id === 'quest1').deletedAt, undefined);
    assert.equal(restored.quests.find(q => q.id === 'quest2').deletedAt, undefined);
    assert.equal(restored.quests.find(q => q.id === 'quest1').restoredAt, '2026-01-02T00:00:00.000Z');
});

test('quest objective rewards are idempotent and ignore deleted characters', () => {
    const createId = idFactory();
    const campaign = {
        id: 'camp1',
        xp: 0,
        characters: [
            { id: 'char1', gold: '0', xp: { current: 0, max: 1000 } },
            { id: 'char2', deletedAt: '2026-01-01T00:00:00.000Z', gold: '0', xp: { current: 0, max: 1000 } },
        ],
        quests: [{
            id: 'quest1',
            title: 'Find the Key',
            status: 'Active',
            objectives: [
                { text: 'Take the left route', choiceGroup: 'route', xp: 10, gold: 2, reputation: [{ faction: 'Town', value: 1 }] },
                { text: 'Take the right route', choiceGroup: 'route', xp: 10 },
            ],
            rewards: { xp: 20, gold: 5, reputation: [{ faction: 'Guild', value: 2 }] },
        }],
    };

    const completed = toggleQuestObjectiveInCampaign(campaign, 'quest1', 0, true, {
        now: '2026-01-01T00:00:00.000Z',
        actorEmail: 'gm@example.com',
        createId,
    });
    const repeated = toggleQuestObjectiveInCampaign(completed, 'quest1', 0, true, {
        now: '2026-01-02T00:00:00.000Z',
        actorEmail: 'gm@example.com',
        createId,
    });

    const quest = repeated.quests[0];
    assert.equal(quest.status, 'Completed');
    assert.equal(quest.objectives[1].failed, true);
    assert.equal(repeated.xp, 30);
    assert.equal(repeated.characters[0].xp.current, 30);
    assert.equal(repeated.characters[0].gold, '7.00');
    assert.equal(repeated.characters[1].xp.current, 0);
    assert.equal(repeated.notificationQueue.length, 7);
});

test('encounter reducer creates, activates, updates, archives, and restores encounters', () => {
    const createId = idFactory();
    const initial = {
        id: 'camp1',
        characters: [
            { id: 'char1', name: 'Hero', stats: { hp: { current: 8, max: 10 } } },
            { id: 'char2', name: 'Archived', deletedAt: '2026-01-01T00:00:00.000Z' },
        ],
        encounters: [],
    };

    const created = createEncounterInCampaign(initial, 'Ambush', { createId });
    const withPlayers = addAllPlayersToEncounterInCampaign(created.campaign, created.encounter.id, { createId });
    const withCreature = addCombatantToEncounterInCampaign(withPlayers, created.encounter.id, 'creature', {
        _catalogId: 'goblin',
        name: 'Goblin',
        system: { attributes: { hp: { max: 6 } }, perception: { value: 5 } },
    }, { createId });
    const active = activateEncounterInCampaign(withCreature, created.encounter.id);
    const encounter = active.encounters[0];

    assert.equal(encounter.isActive, true);
    assert.equal(encounter.combatants.length, 2);
    assert.equal(encounter.combatants.filter(c => c.type === 'player').length, 1);

    const creatureId = encounter.combatants.find(c => c.type === 'creature').id;
    const damaged = updateCombatantInEncounterInCampaign(active, encounter.id, creatureId, { currentHp: 3 });
    assert.equal(damaged.encounters[0].combatants.find(c => c.id === creatureId).currentHp, 3);

    const conditioned = addConditionToCombatantInCampaign(damaged, encounter.id, creatureId, 'Off-Guard');
    assert.deepEqual(conditioned.encounters[0].combatants.find(c => c.id === creatureId).conditions, ['Off-Guard']);

    const rolled = rollEncounterInitiativeInCampaign(conditioned, encounter.id, {
        creatureDataById: { goblin: { system: { perception: { value: 5 } } } },
        rollD20: () => 10,
    });
    assert.equal(rolled.encounters[0].combatants.find(c => c.id === creatureId).initiative, 15);

    const nextTurn = endEncounterTurnInCampaign(rolled, encounter.id);
    assert.equal(nextTurn.encounters[0].currentTurnIndex, 1);

    const removed = removeCombatantFromEncounterInCampaign(nextTurn, encounter.id, creatureId);
    assert.equal(removed.encounters[0].combatants.length, 1);

    const deleted = softDeleteEncounterInCampaign(removed, encounter.id, { now: '2026-01-01T00:00:00.000Z' });
    assert.equal(deleted.encounters[0].deletedAt, '2026-01-01T00:00:00.000Z');
    assert.equal(deleted.encounters[0].isActive, false);

    const restored = restoreEncounterInCampaign(deleted, encounter.id, { now: '2026-01-02T00:00:00.000Z' });
    assert.equal(restored.encounters[0].deletedAt, undefined);
    assert.equal(restored.encounters[0].restoredAt, '2026-01-02T00:00:00.000Z');
});

test('map reducer creates, archives, restores, reorders, and edits map details', () => {
    const createId = idFactory();
    const map = createMapRecord('World Map', { createId, order: 1000 });
    const campaign = upsertMapInCampaign({ id: 'camp1', maps: [] }, map, { createId });

    assert.equal(campaign.maps[0].name, 'World Map');
    assert.equal(campaign.maps[0].visibleToPlayers, false);

    const withPin = upsertMapPinInCampaign(campaign, map.id, {
        id: 'pin1',
        label: 'Capital',
        x: 0.25,
        y: 0.75,
        visibleToPlayers: true,
    });
    assert.equal(withPin.maps[0].pins.length, 1);

    const scaled = setMapScaleInCampaign(withPin, map.id, {
        pointA: { x: 0, y: 0 },
        pointB: { x: 1, y: 0 },
        realDistance: 500,
        unit: 'km',
    });
    assert.equal(scaled.maps[0].scale.realDistance, 500);

    const deletedPin = deleteMapPinInCampaign(scaled, map.id, 'pin1');
    assert.equal(deletedPin.maps[0].pins.length, 0);

    const archived = softDeleteMapInCampaign(deletedPin, map.id, { now: '2026-01-01T00:00:00.000Z' });
    assert.equal(archived.maps[0].deletedAt, '2026-01-01T00:00:00.000Z');
    assert.equal(archived.maps[0].visibleToPlayers, false);

    const restored = restoreMapInCampaign(archived, map.id, { now: '2026-01-02T00:00:00.000Z' });
    assert.equal(restored.maps[0].deletedAt, undefined);
    assert.equal(restored.maps[0].restoredAt, '2026-01-02T00:00:00.000Z');

    const withSecond = upsertMapInCampaign(restored, { id: 'map2', name: 'Dungeon', order: 2000 }, { createId });
    const reordered = reorderMapsInCampaign(withSecond, ['map2', map.id]);
    assert(reordered.maps.find(entry => entry.id === 'map2').order < reordered.maps.find(entry => entry.id === map.id).order);
});

test('progress reducer updates campaign progress and archives top-level entries', () => {
    const campaign = {
        id: 'camp1',
        progress: {
            reputation: {
                factions: [
                    { id: 'fac1', name: 'Guild', ranks: [{ id: 'rank1', title: 'Friend' }] },
                ],
            },
            research: {
                topics: [{ id: 'topic1', name: 'Ancient Door', infoPoints: [{ id: 'info1', text: 'Runes' }] }],
            },
            calcifer: {
                currentProgress: 3,
                stages: [{ id: 'stage1', name: 'Spark', boons: [{ id: 'boon1', name: 'Warmth' }] }],
            },
            materials: {
                elements: [{ id: 'fire', name: 'Fire', tiers: [{ id: 'tier1', items: [{ id: 'item1', name: 'Coal' }] }] }],
            },
        },
    };

    const updated = updateProgressInCampaign(campaign, {
        calcifer: { ...campaign.progress.calcifer, currentProgress: 8 },
    });
    assert.equal(updated.progress.calcifer.currentProgress, 8);

    const archived = softDeleteProgressEntryInCampaign(updated, 'research', 'topic1', {
        now: '2026-01-01T00:00:00.000Z',
        actorEmail: 'gm@example.com',
    });
    assert.equal(archived.progress.research.topics[0].deletedAt, '2026-01-01T00:00:00.000Z');
    assert.equal(archived.progress.research.topics[0].infoPoints[0].text, 'Runes');
    assert.equal(getProgress(archived, { activeOnly: true }).research.topics.length, 0);

    const restored = restoreProgressEntryInCampaign(archived, 'research', 'topic1', {
        now: '2026-01-02T00:00:00.000Z',
        actorEmail: 'gm@example.com',
    });
    assert.equal(restored.progress.research.topics[0].deletedAt, undefined);
    assert.equal(restored.progress.research.topics[0].restoredAt, '2026-01-02T00:00:00.000Z');
});

test('camping reducer updates settings, archives activities, and guards assignments', () => {
    const campaign = updateCampingInCampaign({ id: 'camp1' }, {
        zoneDC: 18,
        encounterDC: 20,
        foragingDC: 15,
    });
    assert.equal(campaign.camping.zoneDC, 18);

    const withActivity = upsertCampingActivityInCampaign(campaign, {
        id: 'custom_watch',
        name: 'Custom Watch',
        skills: ['Perception'],
        dcType: 'zone',
    });
    assert.equal(withActivity.camping.activities[0].name, 'Custom Watch');

    const assigned = assignCampingActivityInCampaign(withActivity, 'custom_watch', {
        id: 'char1',
        name: 'Hero',
    }, { now: '2026-01-01T00:00:00.000Z' });
    assert.equal(assigned.camping.assignments.custom_watch.characterId, 'char1');

    assert.throws(() => assignCampingActivityInCampaign(assigned, 'custom_watch', {
        id: 'char2',
        name: 'Other',
    }));

    const rolled = recordCampingActivityRollInCampaign(assigned, 'custom_watch', {
        id: 'char1',
        name: 'Hero',
    }, { roll: 22, degree: 'success', effectText: 'Done' });
    assert.equal(rolled.camping.assignments.custom_watch.roll, 22);
    assert.equal(rolled.camping.assignments.custom_watch.effectText, 'Done');

    const unassigned = unassignCampingActivityInCampaign(rolled, 'custom_watch', { id: 'char1', name: 'Hero' });
    assert.equal(unassigned.camping.assignments.custom_watch, undefined);

    const archived = softDeleteCampingActivityInCampaign(assigned, 'custom_watch', {
        now: '2026-01-02T00:00:00.000Z',
    });
    assert.equal(archived.camping.activities[0].deletedAt, '2026-01-02T00:00:00.000Z');
    assert.equal(archived.camping.assignments.custom_watch, undefined);

    const restored = restoreCampingActivityInCampaign(archived, 'custom_watch', {
        now: '2026-01-03T00:00:00.000Z',
    });
    assert.equal(restored.camping.activities[0].deletedAt, undefined);
    assert.equal(restored.camping.activities[0].restoredAt, '2026-01-03T00:00:00.000Z');

    const reset = resetDefaultCampingActivityInCampaign(restored, 'custom_watch');
    assert.equal(reset.camping.activities.length, 0);
});
