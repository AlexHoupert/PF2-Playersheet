import test from 'node:test';
import assert from 'node:assert/strict';
import { createDataActions } from '../src/shared/db/domain/createDataActions.js';

const firestore = { app: { options: { projectId: 'test-project' } } };

function createActionHarness(db = {}) {
    const calls = [];
    const repositories = {
        characterRepo: {
            async updateCharacter(_firestore, campaignId, characterId, updater) {
                calls.push(['character.updateCharacter', campaignId, characterId]);
                updater({ id: characterId, inventory: [] });
            },
            async updateCharacters(_firestore, campaignId, characterIds, updater) {
                calls.push(['character.updateCharacters', campaignId, characterIds]);
                updater(Object.fromEntries(characterIds.map(id => [
                    id,
                    { id, inventory: id === 'char1' ? [{ instanceId: 'torch1', name: 'Torch', qty: 1 }] : [] },
                ])));
            },
        },
        lootRepo: {
            async updateLootBagAndCharacter(_firestore, campaignId, lootBagId, characterId, updater) {
                calls.push(['loot.updateLootBagAndCharacter', campaignId, lootBagId, characterId]);
                updater({ id: lootBagId, items: [{ instanceId: 'loot_item', name: 'Rope', qty: 1 }], goldValue: 0 }, { id: characterId, inventory: [] });
            },
        },
        questRepo: {
            async updateQuestAndCampaignAndCharacters(_firestore, campaignId, questId, characterIds, updater) {
                calls.push(['quest.updateQuestAndCampaignAndCharacters', campaignId, questId, characterIds]);
                updater(
                    { id: questId, objectives: [{ text: 'Done', xp: 1 }], rewards: {} },
                    { id: campaignId, xp: 0 },
                    Object.fromEntries(characterIds.map(id => [id, { id, xp: { current: 0, max: 1000 }, gold: 0 }]))
                );
            },
        },
        encounterRepo: {
            async updateEncounter(_firestore, campaignId, encounterId, updater) {
                calls.push(['encounter.updateEncounter', campaignId, encounterId]);
                updater({ id: encounterId, combatants: [] });
            },
        },
        mapRepo: {
            async updateMap(_firestore, campaignId, mapId, updater) {
                calls.push(['map.updateMap', campaignId, mapId]);
                updater({ id: mapId, pins: [] });
            },
        },
        campaignRepo: {
            async updateCampaign(_firestore, campaignId, updater) {
                calls.push(['campaign.updateCampaign', campaignId]);
                updater({ id: campaignId });
            },
        },
        globalRepo: {
            async updateGlobalConfig(_firestore, updater) {
                calls.push(['global.updateGlobalConfig']);
                updater({ shop: { traders: [{ id: 'trader1', name: 'Market', inventory: [] }] }, bestiary: { creatures: {} } });
            },
            async setCustomItem(_firestore, item) {
                calls.push(['global.setCustomItem', item.name]);
            },
            async setCustomAction(_firestore, action) {
                calls.push(['global.setCustomAction', action.name]);
            },
        },
    };

    const actions = createDataActions({
        db,
        firestore,
        mode: 'firestore-v2',
        repositories,
        setDb: () => {
            throw new Error('setDb must not be called for V2 adapter actions');
        },
        createId: (prefix = 'id') => `${prefix}_test`,
    });
    return { actions, calls };
}

test('v2 adapter uses targeted repositories for migrated campaign domains', async () => {
    const { actions, calls } = createActionHarness({
        campaigns: {
            camp1: {
                characters: [{ id: 'char1' }, { id: 'char2' }],
                quests: [{ id: 'quest1' }],
            },
        },
    });

    await actions.inventory.addItem('camp1', 'char1', { name: 'Torch' });
    await actions.inventory.transferItem('camp1', 'char1', 'char2', { instanceId: 'torch1', name: 'Torch' }, 1);
    await actions.loot.claimItem('camp1', 'loot1', { instanceId: 'loot_item' }, 'char1');
    await actions.quest.toggleObjective('camp1', 'quest1', 0, true);
    await actions.encounter.addCombatant('camp1', 'enc1', 'player', { id: 'char1', name: 'Hero' });
    await actions.map.upsertPin('camp1', 'map1', { id: 'pin1', label: 'Gate' });
    await actions.progress.updateProgress('camp1', { calcifer: { currentProgress: 2 } });
    await actions.camping.updateSettings('camp1', { zoneDC: 18 });

    assert.deepEqual(calls.map(call => call[0]), [
        'character.updateCharacter',
        'character.updateCharacters',
        'loot.updateLootBagAndCharacter',
        'quest.updateQuestAndCampaignAndCharacters',
        'encounter.updateEncounter',
        'map.updateMap',
        'campaign.updateCampaign',
        'campaign.updateCampaign',
    ]);
});

test('v2 adapter uses global repositories for shop and custom content', async () => {
    const { actions, calls } = createActionHarness();

    await actions.globalContent.saveCustomItem({ name: 'Widget' });
    await actions.globalContent.saveCustomAction({ name: '[gold]Trip[/gold]' });
    await actions.shop.addItemsToTrader('trader1', [{ name: 'Widget' }]);
    await actions.shop.setItemAvailable('Widget', true);
    await actions.bestiary.updateRevealState('goblin', 'hp', 'public');

    assert.deepEqual(calls.map(call => call[0]), [
        'global.setCustomItem',
        'global.setCustomAction',
        'global.updateGlobalConfig',
        'global.updateGlobalConfig',
        'global.updateGlobalConfig',
    ]);
});
