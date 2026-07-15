import test from 'node:test';
import assert from 'node:assert/strict';
import { createDataActions } from '../src/shared/db/domain/createDataActions.js';

const firestore = { app: { options: { projectId: 'test-project' } } };

function createActionHarness(db = {}) {
    const calls = [];
    const repositories = {
        memberRepo: {
            async assignUser(_firestore, campaignId, email, member) {
                calls.push(['member.assignUser', campaignId, email, member.characterId, member.assignedActorId]);
            },
            async revokeUser(_firestore, campaignId, email) {
                calls.push(['member.revokeUser', campaignId, email]);
            },
        },
        actorRepo: {
            async createActor(_firestore, campaignId, actor) {
                calls.push(['actor.createActor', campaignId, actor.id, actor.kind]);
            },
            async updateActor(_firestore, campaignId, actorId, updater) {
                const result = updater(db.__actorDocs?.[actorId] || { id: actorId, kind: 'pc', name: 'Hero', level: 1 });
                calls.push(['actor.updateActor', campaignId, actorId, result]);
            },
            async updateActors(_firestore, campaignId, actorIds, updater) {
                calls.push(['actor.updateActors', campaignId, actorIds]);
                updater(Object.fromEntries(actorIds.map(id => [
                    id,
                    { id, kind: 'pc', name: id, inventory: id === 'char1' ? [{ instanceId: 'torch1', name: 'Torch', qty: 1 }] : [] },
                ])));
            },
        },
        effectRepo: {
            async createEffect(_firestore, campaignId, effect) {
                calls.push(['effect.createEffect', campaignId, effect.id, effect.targetActorId, effect]);
            },
            async updateEffect(_firestore, campaignId, effectId, updater) {
                const result = updater({ id: effectId, campaignId, targetActorId: 'actor1', label: 'Frightened', category: 'condition' });
                calls.push(['effect.updateEffect', campaignId, effectId, result.value]);
            },
            async deleteEffect(_firestore, campaignId, effectId) {
                calls.push(['effect.deleteEffect', campaignId, effectId]);
            },
            async setEffectTemplate(_firestore, campaignId, template) {
                calls.push(['effect.setEffectTemplate', campaignId, template.id]);
            },
            async deleteEffectTemplate(_firestore, campaignId, templateId) {
                calls.push(['effect.deleteEffectTemplate', campaignId, templateId]);
            },
        },
        catalogOverrideRepo: {
            async setCatalogOverride(_firestore, override) {
                calls.push(['catalogOverride.setCatalogOverride', override.id, override.catalogType]);
            },
            async deleteCatalogOverride(_firestore, overrideId) {
                calls.push(['catalogOverride.deleteCatalogOverride', overrideId]);
            },
        },
        lootRepo: {
            async createLootBag(_firestore, campaignId, lootBag) {
                calls.push(['loot.createLootBag', campaignId, lootBag.id]);
            },
            async updateLootBagAndActor(_firestore, campaignId, lootBagId, actorId, updater) {
                calls.push(['loot.updateLootBagAndActor', campaignId, lootBagId, actorId]);
                updater({ id: lootBagId, items: [{ instanceId: 'loot_item', name: 'Rope', qty: 1 }], goldValue: 0 }, { id: actorId, kind: 'pc', inventory: [] });
            },
            async updateLootBagAndActors(_firestore, campaignId, lootBagId, actorIds, updater) {
                calls.push(['loot.updateLootBagAndActors', campaignId, lootBagId, actorIds]);
                updater(
                    { id: lootBagId, items: [], goldValue: 10 },
                    Object.fromEntries(actorIds.map(id => [id, { id, kind: 'pc', gold: 0 }]))
                );
            },
        },
        loreRepo: {
            async createDraft(_firestore, campaignId, article) {
                calls.push(['lore.createDraft', campaignId, article.id]);
                return article.id;
            },
            async saveDraft(_firestore, campaignId, articleId, updater) {
                calls.push(['lore.saveDraft', campaignId, articleId]);
                if (typeof updater === 'function') updater({ id: articleId, title: 'Draft' });
            },
            async publishArticle(_firestore, campaignId, articleId, options) {
                calls.push(['lore.publishArticle', campaignId, articleId, options.notify]);
            },
            async retractArticle(_firestore, campaignId, articleId) {
                calls.push(['lore.retractArticle', campaignId, articleId]);
            },
            async archiveArticle(_firestore, campaignId, articleId) {
                calls.push(['lore.archiveArticle', campaignId, articleId]);
            },
            async restoreArticle(_firestore, campaignId, articleId) {
                calls.push(['lore.restoreArticle', campaignId, articleId]);
            },
            async saveGroup(_firestore, campaignId, group) {
                calls.push(['lore.saveGroup', campaignId, group.id]);
                return group.id;
            },
            async markDeliveryRead(_firestore, campaignId, deliveryId) {
                calls.push(['lore.markDeliveryRead', campaignId, deliveryId]);
            },
            async saveNote(_firestore, campaignId, note) {
                calls.push(['lore.saveNote', campaignId, note.id]);
                return note.id;
            },
            async notifyBestiaryReveal(_firestore, campaignId, creature) {
                calls.push(['lore.notifyBestiaryReveal', campaignId, creature.id]);
            },
        },
        questRepo: {
            async updateQuestAndCampaignAndActors(_firestore, campaignId, questId, actorIds, updater) {
                calls.push(['quest.updateQuestAndCampaignAndActors', campaignId, questId, actorIds]);
                updater(
                    { id: questId, objectives: [{ text: 'Done', xp: 1 }], rewards: {} },
                    { id: campaignId, xp: 0 },
                    Object.fromEntries(actorIds.map(id => [id, { id, kind: 'pc', sheet: { id, xp: { current: 0, max: 1000 }, gold: 0 } }]))
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
            async updateCampaignAndActors(_firestore, campaignId, actorIds, updater) {
                calls.push(['campaign.updateCampaignAndActors', campaignId, actorIds]);
                updater(
                    { id: campaignId, xp: 0 },
                    Object.fromEntries(actorIds.map(id => [id, { id, kind: 'pc', sheet: { id, xp: { current: 0, max: 1000 } } }]))
                );
            },
        },
        globalRepo: {
            async updateGlobalConfig(_firestore, updater) {
                calls.push(['global.updateGlobalConfig']);
                updater({
                    shop: { traders: [{ id: 'trader1', name: 'Market', inventory: [] }] },
                    bestiary: { creatures: {} },
                    abilities: { custom: {}, deviant: {} },
                    pacts: {},
                    lore: { articles: [] },
                    notificationQueue: [{ id: 'notice1' }],
                });
            },
            async setCustomItem(_firestore, item) {
                calls.push(['global.setCustomItem', item.name]);
            },
            async setCustomAction(_firestore, action) {
                calls.push(['global.setCustomAction', action.name]);
            },
            async setCustomCreature(_firestore, creature) {
                calls.push(['global.setCustomCreature', creature.name]);
            },
            async updateCustomCreature(_firestore, creatureId, updater) {
                calls.push(['global.updateCustomCreature', creatureId]);
                updater({ id: creatureId, data: { items: [] } });
            },
            async deleteCustomCreature(_firestore, creatureId) {
                calls.push(['global.deleteCustomCreature', creatureId]);
            },
            async setLoreArticle(_firestore, article) {
                calls.push(['global.setLoreArticle', article.id]);
            },
            async deleteLoreArticle(_firestore, articleOrId) {
                calls.push(['global.deleteLoreArticle', articleOrId.id || articleOrId]);
            },
            async updateLoreArticles(_firestore, articleIds, updater) {
                calls.push(['global.updateLoreArticles', articleIds]);
                updater(Object.fromEntries(articleIds.map(id => [id, { id, title: id }])));
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
    const createdLootId = await actions.loot.createLootBag('camp1', { id: 'loot_new', name: 'New Chest' });
    await actions.loot.claimItem('camp1', 'loot1', { instanceId: 'loot_item' }, 'char1');
    await actions.quest.toggleObjective('camp1', 'quest1', 0, true);
    await actions.encounter.addCombatant('camp1', 'enc1', 'player', { id: 'char1', name: 'Hero' });
    await actions.map.upsertPin('camp1', 'map1', { id: 'pin1', label: 'Gate' });
    await actions.progress.updateProgress('camp1', { calcifer: { currentProgress: 2 } });
    await actions.camping.updateSettings('camp1', { zoneDC: 18 });
    await actions.campaign.setXpThreshold('camp1', 1200);

    assert.deepEqual(calls.map(call => call[0]), [
        'actor.updateActor',
        'actor.updateActors',
        'loot.createLootBag',
        'loot.updateLootBagAndActor',
        'quest.updateQuestAndCampaignAndActors',
        'encounter.updateEncounter',
        'map.updateMap',
        'campaign.updateCampaign',
        'campaign.updateCampaign',
        'campaign.updateCampaignAndActors',
    ]);
    assert.equal(createdLootId, 'loot_new');
    assert.deepEqual(calls.at(-1), ['campaign.updateCampaignAndActors', 'camp1', ['char1', 'char2']]);
});

test('v2 adapter routes campaign knowledge through the targeted lore repository', async () => {
    const { actions, calls } = createActionHarness();
    const articleId = await actions.lore.createDraft('camp1', { id: 'lore1', title: 'Old Road' });
    await actions.lore.saveDraft('camp1', articleId, { title: 'The Old Road' });
    await actions.lore.publishArticle('camp1', articleId, { notify: true });
    await actions.lore.markDeliveryRead('camp1', 'delivery1');
    await actions.lore.saveGroup('camp1', { id: 'group1', name: 'Roads', category: 'locations' });
    await actions.lore.saveNote('camp1', { actorId: 'char1', targetType: 'loreArticle', targetId: articleId, content: 'Unsafe at dusk.' });
    await actions.lore.notifyBestiaryReveal('camp1', { id: 'wolf', name: 'Winter Wolf' });
    await actions.lore.retractArticle('camp1', articleId);
    await actions.lore.archiveArticle('camp1', articleId);
    await actions.lore.restoreArticle('camp1', articleId);

    assert.deepEqual(calls.map(call => call[0]), [
        'lore.createDraft',
        'lore.saveDraft',
        'lore.publishArticle',
        'lore.markDeliveryRead',
        'lore.saveGroup',
        'lore.saveNote',
        'lore.notifyBestiaryReveal',
        'lore.retractArticle',
        'lore.archiveArticle',
        'lore.restoreArticle',
    ]);
    assert.equal(articleId, 'lore1');
    assert.equal(calls[2][3], true);
});

test('v2 adapter routes character basis edits through actor repository', async () => {
    const { actions, calls } = createActionHarness();

    await actions.character.setGold('camp1', 'char1', 7.25);
    await actions.character.adjustAttribute('camp1', 'char1', 'dexterity', 2);
    await actions.character.setHp('camp1', 'char1', 5);
    await actions.character.setTempHp('camp1', 'char1', 3);
    await actions.character.adjustMaxHp('camp1', 'char1', 4);
    await actions.character.setSpeed('camp1', 'char1', 'land', 30);
    await actions.character.adjustClassDc('camp1', 'char1', 1);
    await actions.character.setDailyCraftingMax('camp1', 'char1', 4);

    assert.deepEqual(calls.map(call => call[0]), [
        'actor.updateActor',
        'actor.updateActor',
        'actor.updateActor',
        'actor.updateActor',
        'actor.updateActor',
        'actor.updateActor',
        'actor.updateActor',
        'actor.updateActor',
    ]);
    assert.equal(calls[0][3].sheet.gold, 7.25);
    assert.equal(calls[1][3].stats.attributes.dexterity, 2);
    assert.equal(calls[2][3].stats.hp.current, 5);
    assert.equal(calls[3][3].stats.hp.temp, 3);
    assert.equal(calls[4][3].stats.hp.max, 5);
    assert.equal(calls[5][3].stats.speed.land, 30);
    assert.equal(calls[6][3].stats.class_dc, 11);
    assert.equal(calls[7][3].sheet.dailyCraftingMax, 4);
});

test('v2 adapter routes player sheet actor edits through actor repository', async () => {
    const { actions, calls } = createActionHarness();

    await actions.actor.setSkill('camp1', 'char1', 'Lore: Fire', 2);
    await actions.actor.setSave('camp1', 'char1', 'reflex', 4);
    await actions.actor.setArmorProficiency('camp1', 'char1', 'Light', 2);
    await actions.actor.setProficiency('camp1', 'char1', 'Simple', 2);
    await actions.actor.setSpellProficiency('camp1', 'char1', 4);
    await actions.actor.setImpulseProficiency('camp1', 'char1', 6);
    await actions.actor.setPerception('camp1', 'char1', 2);
    await actions.actor.setMagicAttribute('camp1', 'char1', 'Wisdom');
    await actions.actor.setMagicProficiency('camp1', 'char1', 4);
    await actions.actor.setMagicSlot('camp1', 'char1', '3_curr', 2);
    await actions.actor.setEquipmentState('camp1', 'char1', { shield_raised: true });

    assert.deepEqual(calls.map(call => call[0]), Array.from({ length: 11 }, () => 'actor.updateActor'));
    assert.equal(calls[0][3].stats.skills['Lore: Fire'], 2);
    assert.equal(calls[0][3].sheet.skills['Lore: Fire'], 2);
    assert.equal(calls[1][3].stats.saves.reflex, 4);
    assert.equal(calls[2][3].stats.proficiencies.light, 2);
    assert.equal(calls[3][3].sheet.proficiencies.Simple, 2);
    assert.equal(calls[4][3].stats.spell_proficiency, 4);
    assert.equal(calls[5][3].stats.impulse_proficiency, 6);
    assert.equal(calls[6][3].stats.perception, 2);
    assert.equal(calls[7][3].magic.attribute, 'Wisdom');
    assert.equal(calls[8][3].magic.proficiency, 4);
    assert.equal(calls[9][3].magic.slots['3_curr'], 2);
    assert.equal(calls[10][3].stats.ac.shield_raised, true);
});

test('v2 adapter stores character lifecycle as pc actors', async () => {
    const { actions, calls } = createActionHarness({
        users: {
            'player@example.com': { campaignId: 'camp1', characterId: 'char1', actorId: 'char1' },
        },
    });

    await actions.member.assignUser('PLAYER@example.com', 'camp1', 'char1');
    await actions.character.createCharacter('camp1', { id: 'char2', name: 'New Hero' });
    await actions.character.softDeleteCharacter('camp1', 'char1');
    await actions.character.restoreCharacter('camp1', 'char1');
    await actions.character.importLegacyCharacter('camp1', { id: 'char3', name: 'Imported' }, 0);

    assert.deepEqual(calls.map(call => call[0]), [
        'member.assignUser',
        'actor.createActor',
        'actor.updateActor',
        'member.assignUser',
        'actor.updateActor',
        'actor.createActor',
    ]);
    assert.equal(calls[0][4], 'char1');
});

test('v2 adapter exposes actor, effect, and catalog override repositories', async () => {
    const { actions, calls } = createActionHarness();

    await actions.actor.createActor('camp1', { id: 'actor1', kind: 'pc', name: 'Hero' });
    await actions.actor.updateActor('camp1', 'actor1', actor => ({ ...actor, name: 'Renamed Hero' }));
    await actions.actor.softDeleteActor('camp1', 'actor1');
    await actions.effect.createEffect('camp1', 'actor1', { id: 'effect1', label: 'Frightened', value: 1 });
    await actions.effect.updateEffect('camp1', 'effect1', effect => ({ ...effect, value: 2 }));
    await actions.effect.deleteEffect('camp1', 'effect1');
    await actions.effect.saveEffectTemplate('camp1', { id: 'slippery', label: 'Slippery' });
    await actions.effect.deleteEffectTemplate('camp1', 'slippery');
    await actions.catalogOverride.saveCatalogOverride({ id: 'spell_fireball', catalogType: 'spell', payload: { name: 'Fireball' } });
    await actions.catalogOverride.deleteCatalogOverride('spell_fireball');

    assert.deepEqual(calls.map(call => call[0]), [
        'actor.createActor',
        'actor.updateActor',
        'actor.updateActor',
        'effect.createEffect',
        'effect.updateEffect',
        'effect.deleteEffect',
        'effect.setEffectTemplate',
        'effect.deleteEffectTemplate',
        'catalogOverride.setCatalogOverride',
        'catalogOverride.deleteCatalogOverride',
    ]);
});

test('v2 adapter creates standard condition, persistent damage, and custom badge effects', async () => {
    const { actions, calls } = createActionHarness();

    await actions.effect.createStandardCondition('camp1', 'actor1', 'Frightened', 2);
    await actions.effect.createPersistentDamage('camp1', 'encounter:enc1:combatant:goblin1', {
        damageType: 'fire',
        mode: 'dice',
        diceCount: 1,
        dieSize: 6,
    });
    await actions.effect.createCustomBadge('camp1', 'actor1', 'Covered in Glue');

    assert.deepEqual(calls.map(call => call[0]), [
        'effect.createEffect',
        'effect.createEffect',
        'effect.createEffect',
    ]);
    assert.equal(calls[0][4].category, 'condition');
    assert.equal(calls[0][4].value, 2);
    assert(calls[0][4].modifiers.some(modifier => modifier.selector === 'all.checks'));
    assert.equal(calls[1][4].category, 'damage_effect');
    assert.equal(calls[1][4].targetActorId, 'encounter:enc1:combatant:goblin1');
    assert.equal(calls[1][4].modifiers[0].mode, 'persistent_damage');
    assert.equal(calls[2][4].category, 'custom');
    assert.deepEqual(calls[2][4].modifiers, []);
});

test('v2 adapter uses catalog overrides for custom content and global repositories for shop metadata', async () => {
    const { actions, calls } = createActionHarness({
        lore: {
            articles: [
                { id: 'article1', title: 'One', category: 'history', sortOrder: 0 },
                { id: 'article2', title: 'Two', category: 'history', sortOrder: 1 },
            ],
        },
    });

    await actions.globalContent.saveCustomItem({ name: 'Widget' });
    await actions.globalContent.saveCustomAction({ name: '[gold]Trip[/gold]' });
    await actions.globalContent.saveCustomAbility({ id: 'custom-trip', name: 'Trip' });
    await actions.globalContent.saveLoreArticle({ id: 'article3', title: 'Three' });
    await actions.globalContent.moveLoreArticle('article2', 'up');
    await actions.globalContent.deleteLoreArticle('article1');
    await actions.globalContent.clearRootNotification('notice1');
    await actions.pact.savePact({ id: 'ember', name: 'Ember Pact' });
    await actions.pact.saveDeviantAbility({ id: 'spark', name: 'Spark' });
    await actions.bestiary.saveCustomCreature({ _id: 'custom-goblin', name: 'Goblin Boss' });
    await actions.bestiary.updateCustomCreature('custom-goblin', entry => entry);
    await actions.bestiary.deleteCreature('custom-goblin');
    await actions.bestiary.initializeCreatureMetadata([{ id: 'wolf' }]);
    await actions.shop.addItemsToTrader('trader1', [{ name: 'Widget' }]);
    await actions.shop.setItemAvailable('Widget', true);
    await actions.bestiary.updateRevealState('goblin', 'hp', 'public');

    assert.deepEqual(calls.map(call => call[0]), [
        'catalogOverride.setCatalogOverride',
        'catalogOverride.setCatalogOverride',
        'catalogOverride.setCatalogOverride',
        'global.setLoreArticle',
        'global.updateLoreArticles',
        'global.deleteLoreArticle',
        'global.updateGlobalConfig',
        'global.updateGlobalConfig',
        'global.updateGlobalConfig',
        'catalogOverride.setCatalogOverride',
        'catalogOverride.setCatalogOverride',
        'global.updateGlobalConfig',
        'catalogOverride.deleteCatalogOverride',
        'global.updateGlobalConfig',
        'global.updateGlobalConfig',
        'global.updateGlobalConfig',
        'global.updateGlobalConfig',
    ]);
});

test('v2 adapter uses targeted actor updates for pact offers and awakening points', async () => {
    const { actions, calls } = createActionHarness({
        abilities: {
            deviant: {
                spark: {
                    id: 'spark',
                    name: 'Spark',
                    level: 1,
                    awakening1: { name: 'Bright Spark' },
                },
            },
        },
        pacts: {
            ember: {
                id: 'ember',
                name: 'Ember Pact',
                dedication: { id: 'ember-dedication', name: 'Ember Dedication' },
                abilityGroups: [{ label: 'Initial', abilityIds: ['spark'] }],
            },
        },
        __actorDocs: {
            actor1: {
                id: 'actor1',
                kind: 'pc',
                name: 'Hero',
                level: 1,
                pactOffer: { id: 'legacy-root-offer', pactId: 'ember', status: 'pending' },
                sheet: {
                    id: 'actor1',
                    name: 'Hero',
                    level: 1,
                    pactOffer: { id: 'offer1', pactId: 'ember', status: 'pending' },
                },
            },
        },
    });

    await actions.pact.offerPactToActors('camp1', ['actor2'], 'ember');
    await actions.pact.acceptPactOffer('camp1', 'actor1', 'offer1', 'spark');
    assert.deepEqual(calls.map(call => call[0]), ['actor.updateActor', 'actor.updateActor']);
    assert.equal(calls[1][3].sheet.pact.pactId, 'ember');
    assert.equal(calls[1][3].sheet.pact.choices[0], 'spark');
    assert.equal(calls[1][3].pactOffer, undefined);
    assert.equal(calls[1][3].sheet.pactOffer, undefined);

    const { actions: pointActions, calls: pointCalls } = createActionHarness({
        abilities: {
            deviant: {
                spark: {
                    id: 'spark',
                    name: 'Spark',
                    level: 1,
                    awakening1: { name: 'Bright Spark' },
                },
            },
        },
        pacts: { ember: { id: 'ember', name: 'Ember Pact' } },
        __actorDocs: {
            actor1: {
                id: 'actor1',
                kind: 'pc',
                name: 'Hero',
                level: 1,
                sheet: {
                    id: 'actor1',
                    name: 'Hero',
                    level: 1,
                    pact: { pactId: 'ember', choices: { 0: 'spark' }, awakeningPoints: 1, unlockedAwakenings: {} },
                },
            },
        },
    });
    await pointActions.pact.spendAwakeningPoint('camp1', 'actor1', 'spark', 1);

    assert.deepEqual(pointCalls.map(call => call[0]), ['actor.updateActor']);
    assert.equal(pointCalls[0][3].sheet.pact.unlockedAwakenings.spark, 1);
});

test('v2 pact reject clears stale sheet-level offers', async () => {
    const { actions, calls } = createActionHarness({
        __actorDocs: {
            actor1: {
                id: 'actor1',
                kind: 'pc',
                sheet: {
                    id: 'actor1',
                    name: 'Hero',
                    pactOffer: { id: 'offer1', pactId: 'ember', status: 'pending' },
                },
            },
        },
    });

    await actions.pact.rejectPactOffer('camp1', 'actor1', 'offer1');

    assert.equal(calls[0][0], 'actor.updateActor');
    assert.equal(calls[0][3].pactOffer, undefined);
    assert.equal(calls[0][3].sheet.pactOffer, undefined);
});
