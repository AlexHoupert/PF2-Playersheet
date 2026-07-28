import test from 'node:test';
import assert from 'node:assert/strict';
import {
    addItemToCharacter,
    applyCharacterUpdate,
    transferInventoryItem,
} from '../src/shared/db/domain/inventoryReducers.js';
import {
    adjustCharacterAttribute,
    adjustCharacterClassDc,
    adjustCharacterGold,
    adjustCharacterHp,
    adjustCharacterMaxHp,
    adjustCharacterSpeed,
    adjustCharacterTempHp,
    setCharacterAttribute,
    setCharacterClassDc,
    setCharacterDailyCraftingMax,
    setCharacterGold,
    setCharacterHp,
    setCharacterMaxHp,
    setCharacterSpeed,
    setCharacterTempHp,
} from '../src/shared/db/domain/characterEditReducers.js';
import {
    applyLootBagUpdate,
    claimLootGoldState,
    claimLootItemState,
    setLootItemQuantity,
    splitLootGoldState,
    updateLootItem,
} from '../src/shared/db/domain/lootReducers.js';
import {
    addPartyXpInCampaign,
    applyCampaignUpdate,
    assignUserInDb,
    buildCampaignViewModel,
    createCharacterRecord,
    importLegacyCharacterInDb,
    restoreCampaignInDb,
    restoreCharacterInCampaign,
    revokeUserInDb,
    setCampaignXpThresholdInCampaign,
    setPartyXpInCampaign,
    softDeleteCampaignInDb,
    softDeleteCharacterInDb,
} from '../src/shared/db/domain/campaignReducers.js';
import {
    applyQuestUpdate,
    restoreQuestTreeInCampaign,
    softDeleteQuestTreeInCampaign,
    toggleQuestObjectiveInCampaign,
} from '../src/shared/db/domain/questReducers.js';
import {
    activateEncounterInCampaign,
    addAllPlayersToEncounterInCampaign,
    addCombatantToEncounterInCampaign,
    addConditionToCombatantInCampaign,
    applyEncounterUpdate,
    createEncounterInCampaign,
    endEncounterTurnInCampaign,
    removeCombatantFromEncounterInCampaign,
    restoreEncounterInCampaign,
    rollEncounterInitiativeInCampaign,
    setCombatantDefeatedInCampaign,
    softDeleteEncounterInCampaign,
    updateCombatantInEncounterInCampaign,
} from '../src/shared/db/domain/encounterReducers.js';
import {
    applyMapUpdate,
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

test('normalizes character runtime shape on create and update', () => {
    const created = createCharacterRecord({
        name: 'Legacy Hero',
        skills: { Intimidate: 2, perform: 4 },
        inventory: [],
    }, { createId: () => 'char1' });

    assert.equal(created.id, 'char1');
    assert.equal(created.skills.Intimidation, 2);
    assert.equal(created.skills.Performance, 4);
    assert.equal(created.skills.Intimidate, undefined);
    assert.equal(created.skills.perform, undefined);
    assert.deepEqual(created.impulses, []);
    assert.equal(created.isKineticist, false);
    assert.equal(created.isCaster, false);
    assert.equal(created.stats.attributes.strength, 0);
    assert.equal(created.stats.attributes.charisma, 0);
    assert.deepEqual(created.stats.hp, { current: 0, max: 1, temp: 0 });
    assert.equal(created.stats.speed.land, 25);
    assert.deepEqual(created.stats.saves, {});
    assert.equal(created.stats.ac.shield_raised, false);
    assert.equal(created.stats.ac.armor_equipped, false);
    assert.deepEqual(created.stats.proficiencies, {});
    assert.deepEqual(created.magic, { slots: {}, list: [] });
    assert.deepEqual(created.formulaBook, []);
    assert.deepEqual(created.languages, []);
    assert.deepEqual(created.senses, []);
    assert.deepEqual(created.proficiencies, {});
    assert.equal(created.stats.impulse_proficiency, 0);
    assert.equal(created.stats.spell_proficiency, 0);

    const updated = applyCharacterUpdate({
        id: 'char1',
        skills: { intimidate: 1, Perform: 3 },
        stats: {},
        inventory: [],
    }, (char) => char);

    assert.equal(updated.skills.Intimidation, 1);
    assert.equal(updated.skills.Performance, 3);
    assert.equal(updated.skills.intimidate, undefined);
    assert.equal(updated.skills.Perform, undefined);
    assert.equal(updated.stats.attributes.dexterity, 0);
    assert.equal(updated.stats.hp.max, 1);
    assert.equal(updated.stats.speed.land, 25);
    assert.deepEqual(updated.magic, { slots: {}, list: [] });
    assert.equal(updated.stats.impulse_proficiency, 0);
    assert.equal(updated.stats.spell_proficiency, 0);
});

test('character basis edit reducers normalize incomplete character shapes', () => {
    const legacyCharacter = {
        id: 'char1',
        gold: 'not-a-number',
        stats: {},
    };

    assert.equal(setCharacterGold(legacyCharacter, '10.456').gold, 10.46);
    assert.equal(adjustCharacterGold({ ...legacyCharacter, gold: 3 }, -10).gold, 0);

    const withAttribute = setCharacterAttribute(legacyCharacter, 'strength', '-1');
    assert.equal(withAttribute.stats.attributes.strength, -1);
    assert.equal(adjustCharacterAttribute(withAttribute, 'strength', 2).stats.attributes.strength, 1);

    assert.equal(setCharacterHp(legacyCharacter, '12').stats.hp.current, 12);
    assert.equal(adjustCharacterHp({ ...legacyCharacter, stats: { hp: { current: 5 } } }, -7).stats.hp.current, 0);
    assert.equal(setCharacterTempHp(legacyCharacter, '4').stats.hp.temp, 4);
    assert.equal(adjustCharacterTempHp({ ...legacyCharacter, stats: { hp: { temp: 1 } } }, -2).stats.hp.temp, 0);
    assert.equal(setCharacterMaxHp(legacyCharacter, 0).stats.hp.max, 1);
    assert.equal(adjustCharacterMaxHp({ ...legacyCharacter, stats: { hp: { max: 5 } } }, 3).stats.hp.max, 8);

    assert.equal(setCharacterSpeed(legacyCharacter, 'land', 30).stats.speed.land, 30);
    assert.equal(adjustCharacterSpeed({ ...legacyCharacter, stats: { speed: { land: 10 } } }, 'land', -20).stats.speed.land, 0);
    assert.equal(setCharacterClassDc(legacyCharacter, 18).stats.class_dc, 18);
    assert.equal(adjustCharacterClassDc({ ...legacyCharacter, stats: { class_dc: 10 } }, 2).stats.class_dc, 12);
    assert.equal(setCharacterDailyCraftingMax(legacyCharacter, '3.9').dailyCraftingMax, 3);
});

test('record updaters keep mutated records when callbacks return primitives', () => {
    const character = applyCharacterUpdate({ id: 'char1', gold: 0, stats: {}, inventory: [] }, (char) => char.gold = 10);
    assert.equal(character.gold, 10);
    assert.equal(character.id, 'char1');

    const nested = applyCharacterUpdate({ id: 'char1', level: 1, stats: {}, inventory: [] }, (char) => char.level = 3);
    assert.equal(nested.level, 3);

    const attribute = applyCharacterUpdate({ id: 'char1', stats: {}, inventory: [] }, (char) => char.stats.attributes.strength = 4);
    assert.equal(attribute.stats.attributes.strength, 4);

    const lootBag = applyLootBagUpdate({ id: 'loot1', name: 'Chest', items: [], goldValue: 0 }, (bag) => bag.goldValue = 25);
    assert.equal(lootBag.goldValue, 25);
    assert.equal(lootBag.id, 'loot1');

    const campaign = applyCampaignUpdate({ id: 'camp1', name: 'Old' }, (entry) => entry.name = 'New');
    assert.equal(campaign.name, 'New');

    const quest = applyQuestUpdate({ id: 'quest1', title: 'Old', objectives: [] }, (entry) => entry.title = 'New');
    assert.equal(quest.title, 'New');

    const encounter = applyEncounterUpdate({ id: 'enc1', name: 'Old', combatants: [] }, (entry) => entry.name = 'New');
    assert.equal(encounter.name, 'New');

    const map = applyMapUpdate({ id: 'map1', name: 'Old', pins: [] }, (entry) => entry.name = 'New');
    assert.equal(map.name, 'New');
});

test('record updaters still allow object return replacements', () => {
    const character = applyCharacterUpdate({ id: 'char1', gold: 0, stats: {}, inventory: [] }, (char) => ({
        ...char,
        gold: 5,
    }));

    assert.equal(character.gold, 5);
    assert.equal(character.id, 'char1');
});

test('loot quantity and customization target one stable item instance', () => {
    const bag = {
        id: 'loot1',
        items: [
            { instanceId: 'first', name: 'Healing Potion', qty: 2, level: 1 },
            { instanceId: 'second', name: 'Healing Potion', qty: 4, level: 1 },
        ],
    };

    const withQuantity = setLootItemQuantity(bag, { instanceId: 'second' }, 7);
    const customized = updateLootItem(withQuantity, { instanceId: 'first' }, { name: 'Marked Potion', level: 3 });

    assert.equal(customized.items.find(item => item.instanceId === 'first').name, 'Marked Potion');
    assert.equal(customized.items.find(item => item.instanceId === 'first').level, 3);
    assert.equal(customized.items.find(item => item.instanceId === 'second').name, 'Healing Potion');
    assert.equal(customized.items.find(item => item.instanceId === 'second').qty, 7);
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
    assert.equal(typeof firstClaim.lootBag.items[0].claimedAt, 'number');
    assert.equal(firstClaim.character.inventory[0].claimedAt, undefined);
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

    const uneven = splitLootGoldState({ id: 'loot2', items: [], goldValue: 10 }, [
        { id: 'char1', gold: 0 },
        { id: 'char2', gold: 0 },
        { id: 'char3', gold: 0 },
    ]);
    assert.equal(uneven.lootBag.goldValue, 0.01);
    assert.deepEqual(uneven.characters.map(char => char.gold), [3.33, 3.33, 3.33]);
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
        advancement: { xpThreshold: 1200 },
        characters: [
            { id: 'char1', xp: { current: 0, max: 1000 } },
            { id: 'char2', deletedAt: '2026-01-01T00:00:00.000Z', xp: { current: 5, max: 1000 } },
        ],
    };

    const setResult = setPartyXpInCampaign(campaign, 200);
    assert.equal(setResult.xp, 200);
    assert.equal(setResult.characters[0].xp.current, 200);
    assert.equal(setResult.characters[0].xp.max, 1200);
    assert.equal(setResult.characters[1].xp.current, 5);

    const addResult = addPartyXpInCampaign(setResult, 25, { notificationId: 123 });
    assert.equal(addResult.xp, 225);
    assert.equal(addResult.characters[0].xp.current, 225);
    assert.deepEqual(addResult.xpNotification, { id: 123, amount: 25 });
});

test('sets campaign xp threshold and syncs active character xp max only', () => {
    const campaign = {
        id: 'camp1',
        advancement: { xpThreshold: 1000 },
        characters: [
            { id: 'char1', xp: { current: 200, max: 1000 } },
            { id: 'char2', deletedAt: '2026-01-01T00:00:00.000Z', xp: { current: 5, max: 1000 } },
        ],
    };

    const result = setCampaignXpThresholdInCampaign(campaign, 1200);
    assert.equal(result.advancement.xpThreshold, 1200);
    assert.deepEqual(result.characters[0].xp, { current: 200, max: 1200 });
    assert.deepEqual(result.characters[1].xp, { current: 5, max: 1000 });

    const fallbackResult = setCampaignXpThresholdInCampaign(campaign, -1);
    assert.equal(fallbackResult.advancement.xpThreshold, 1000);
    assert.equal(fallbackResult.characters[0].xp.max, 1000);
});

test('quest structured item rewards apply to actors or quest lootbag', () => {
    const createId = idFactory();
    const campaign = {
        id: 'camp1',
        xp: 0,
        advancement: { xpThreshold: 1200 },
        characters: [
            { id: 'char1', gold: '0', xp: { current: 0, max: 1000 }, inventory: [] },
            { id: 'char2', gold: '0', xp: { current: 0, max: 1000 }, inventory: [] },
        ],
        lootBags: [],
        quests: [{
            id: 'quest1',
            title: 'Reward Test',
            status: 'Active',
            objectives: [{ text: 'Finish', completed: false }],
            rewards: {
                xp: 50,
                itemRewards: [
                    { name: 'Potion', qty: 2, target: 'each' },
                    { name: 'Rune', qty: 1, target: 'party' },
                    { name: 'Relic', qty: 1, target: 'lootBag' },
                ],
            },
        }],
    };

    const completed = toggleQuestObjectiveInCampaign(campaign, 'quest1', 0, true, { createId });
    assert.equal(completed.characters[0].xp.max, 1200);
    assert.equal(completed.characters[0].inventory.find(item => item.name === 'Potion').qty, 2);
    assert.equal(completed.characters[1].inventory.find(item => item.name === 'Potion').qty, 2);
    assert.equal(completed.characters[0].inventory.some(item => item.name === 'Rune'), true);
    assert.equal(completed.characters[1].inventory.some(item => item.name === 'Rune'), false);
    assert.equal(completed.lootBags[0].name, 'Quest Rewards');
    assert.equal(completed.lootBags[0].items[0].name, 'Relic');
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
    const playerCombatantId = encounter.combatants.find(c => c.type === 'player').id;

    assert.equal(encounter.isActive, true);
    assert.equal(encounter.combatants.length, 2);
    assert.equal(encounter.combatants.filter(c => c.type === 'player').length, 1);
    assert.equal(encounter.combatants.find(c => c.type === 'player').effectTargetId, 'char1');

    const creatureId = encounter.combatants.find(c => c.type === 'creature').id;
    assert.equal(
        encounter.combatants.find(c => c.id === creatureId).effectTargetId,
        `encounter:${encounter.id}:combatant:${creatureId}`
    );
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
    assert.equal(nextTurn.encounters[0].currentTurnCombatantId, creatureId);
    assert.equal(nextTurn.encounters[0].turnSequence, 1);

    const defeated = setCombatantDefeatedInCampaign(nextTurn, encounter.id, creatureId, {
        now: '2026-01-03T00:00:00.000Z',
        actorEmail: 'gm@example.com',
    });
    assert.equal(defeated.encounters[0].combatants.find(c => c.id === creatureId).currentHp, 0);
    assert.equal(defeated.encounters[0].combatants.find(c => c.id === creatureId).defeatedAt, '2026-01-03T00:00:00.000Z');
    assert.equal(defeated.encounters[0].currentTurnCombatantId, playerCombatantId);

    const revived = updateCombatantInEncounterInCampaign(defeated, encounter.id, creatureId, { currentHp: 2 });
    assert.equal(revived.encounters[0].combatants.find(c => c.id === creatureId).defeatedAt, undefined);

    const removed = removeCombatantFromEncounterInCampaign(revived, encounter.id, creatureId);
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
