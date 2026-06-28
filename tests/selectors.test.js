import test from 'node:test';
import assert from 'node:assert/strict';
import {
    selectActiveCampaign,
    selectCampaignBuckets,
    selectCampaignChildLists,
    selectLootBagLists,
    selectQuestLists,
    selectRootFallbackList,
    selectTargetCampaignId,
} from '../src/shared/db/selectors/campaignSelectors.js';
import { selectActorBuckets, selectMyActor, selectOwnedActors, selectPcActors } from '../src/shared/db/selectors/actorSelectors.js';
import { selectActiveCharacters, selectMyCharacter } from '../src/shared/db/selectors/characterSelectors.js';
import {
    getCombatantEffectTargetId,
    selectActorEffects,
    selectCombatantEffectBadges,
    selectCombatantEffects,
    selectConditionEffects,
    selectConditionViewModels,
    selectVisibleEffectTemplates,
} from '../src/shared/db/selectors/effectSelectors.js';
import {
    selectCustomAbility,
    selectCustomAbilityList,
    selectDeviantAbility,
    selectDeviantAbilityList,
} from '../src/shared/db/selectors/abilitySelectors.js';
import {
    selectBestiaryCreatureMetadataEntry,
    selectBestiaryRevealState,
    selectCustomCreature,
    selectCustomCreatureData,
    selectCustomCreatureList,
} from '../src/shared/db/selectors/bestiarySelectors.js';
import { selectLoreArticle, selectLoreArticlesByCategory } from '../src/shared/db/selectors/loreSelectors.js';
import { selectPact, selectPactList } from '../src/shared/db/selectors/pactSelectors.js';
import {
    selectAvailableFormulaNames,
    selectAvailableItemNames,
    selectCustomShopItem,
    selectShop,
    selectShopTraders,
    selectVisibleTraders,
} from '../src/shared/db/selectors/shopSelectors.js';
import {
    mergeCatalogIndexWithOverrides,
    selectCatalogOverrideEntries,
} from '../src/shared/db/selectors/catalogOverrideSelectors.js';
import { composeLegacyDbFromV2Documents } from '../src/shared/db/v2/legacyProjection.js';

test('campaign selectors separate active and archived campaigns and characters', () => {
    const db = {
        campaigns: {
            active: {
                id: 'active',
                characters: [{ id: 'char1', name: 'Hero' }, { id: 'char2', name: 'Old', deletedAt: '2026-01-01' }],
            },
            archived: { id: 'archived', deletedAt: '2026-01-01', characters: [{ id: 'char3' }] },
        },
    };

    const buckets = selectCampaignBuckets(db);
    const targetId = selectTargetCampaignId({
        campaigns: buckets.campaigns,
        isGM: true,
        selectedCampaignId: 'missing',
        userInfo: null,
    });
    const activeCampaign = selectActiveCampaign(buckets.campaigns, targetId);
    const childLists = selectCampaignChildLists(activeCampaign);

    assert.equal(Object.keys(buckets.campaigns).length, 1);
    assert.equal(Object.keys(buckets.archivedCampaigns).length, 1);
    assert.equal(targetId, 'active');
    assert.equal(childLists.characters.length, 1);
    assert.equal(childLists.archivedCharacters[0].id, 'char2');
});

test('character selectors derive compatibility characters from pc actors', () => {
    const db = {
        quests: [{ id: 'legacyQuest' }],
        campaigns: {
            camp1: {
                id: 'camp1',
                quests: [],
                characters: [{ id: 'char1', name: 'Stale Hero' }],
                actors: [{
                    id: 'char1',
                    kind: 'pc',
                    name: 'Actor Hero',
                    sheet: { id: 'char1', name: 'Hero' },
                }],
            },
        },
    };

    assert.equal(selectMyCharacter(db.campaigns.camp1, { characterId: 'char1' }).name, 'Hero');
    assert.equal(selectMyCharacter(db.campaigns.camp1, { assignedActorId: 'char1' }).name, 'Hero');
    assert.equal(selectMyCharacter({ id: 'legacyOnly', characters: [{ id: 'char1', name: 'Legacy Hero' }] }, { characterId: 'char1' }), null);
});

test('root fallback selectors keep legacy quest reads centralized', () => {
    const db = {
        quests: [{ id: 'legacyQuest' }],
        campaigns: { camp1: { id: 'camp1', quests: [] } },
    };

    assert.equal(selectRootFallbackList(db, 'quests', 'camp1')[0].id, 'legacyQuest');
});

test('character selectors prefer pc actors over stale character projection', () => {
    const campaign = {
        id: 'camp1',
        characters: [{ id: 'pc1', name: 'Stale Hero', level: 1 }],
        actors: [{
            id: 'pc1',
            kind: 'pc',
            name: 'Actor Hero',
            level: 5,
            sheet: { id: 'pc1', name: 'Actor Sheet Hero', level: 6 },
        }],
    };

    assert.deepEqual(selectActiveCharacters(campaign).map(character => character.name), ['Actor Sheet Hero']);
    assert.equal(selectMyCharacter(campaign, { assignedActorId: 'pc1' }).level, 6);
});

test('quest and lootbag selectors prefer campaign data and fall back to legacy roots', () => {
    const db = {
        quests: [
            { id: 'legacyQuest' },
            { id: 'archivedLegacyQuest', deletedAt: '2026-01-01' },
        ],
        lootBags: [
            { id: 'legacyLoot', name: 'Old Chest' },
            { id: 'archivedLegacyLoot', name: 'Old Archive', deletedAt: '2026-01-01' },
        ],
        campaigns: {
            empty: { id: 'empty', quests: [], lootBags: [] },
            active: {
                id: 'active',
                quests: [
                    { id: 'campaignQuest' },
                    { id: 'archivedCampaignQuest', deletedAt: '2026-01-02' },
                ],
                lootBags: [
                    { id: 'campaignLoot', name: 'Chest' },
                    { id: 'archivedCampaignLoot', name: 'Archive', deletedAt: '2026-01-02' },
                ],
            },
        },
    };

    const rootQuestLists = selectQuestLists(db, db.campaigns.empty, 'empty');
    assert.deepEqual(rootQuestLists.quests.map(q => q.id), ['legacyQuest']);
    assert.deepEqual(rootQuestLists.archivedQuests.map(q => q.id), ['archivedLegacyQuest']);

    const campaignQuestLists = selectQuestLists(db, db.campaigns.active, 'active');
    assert.deepEqual(campaignQuestLists.quests.map(q => q.id), ['campaignQuest']);
    assert.deepEqual(campaignQuestLists.archivedQuests.map(q => q.id), ['archivedCampaignQuest']);

    const rootLootLists = selectLootBagLists(db, db.campaigns.empty, 'empty');
    assert.deepEqual(rootLootLists.lootBags.map(bag => bag.id), ['legacyLoot']);
    assert.deepEqual(rootLootLists.archivedLootBags.map(bag => bag.id), ['archivedLegacyLoot']);

    const campaignLootLists = selectLootBagLists(db, db.campaigns.active, 'active');
    assert.deepEqual(campaignLootLists.lootBags.map(bag => bag.id), ['campaignLoot']);
    assert.deepEqual(campaignLootLists.archivedLootBags.map(bag => bag.id), ['archivedCampaignLoot']);
});

test('selectors read v2 projection with campaign subcollections and global config', () => {
    const db = composeLegacyDbFromV2Documents([
        { path: 'global/config', data: {
            shop: {
                traders: [{ id: 'trader1', name: 'Market' }, { id: 'hidden', name: 'Hidden', hidden: true }],
                availableItems: ['Rope'],
                availableFormulas: ['Rope'],
                customItems: { 'Hero Snack': { name: 'Hero Snack' } },
            },
            bestiary: { creatures: { goblin: { revealState: { hp: 'public' } } } },
            abilities: {
                custom: { trip: { id: 'trip', name: 'Trip' } },
                deviant: { spark: { id: 'spark', name: 'Spark', level: 2 } },
            },
            pacts: { ember: { id: 'ember', name: 'Ember Pact' } },
        } },
        { path: 'customCreatures/custom-goblin', data: { id: 'custom-goblin', name: 'Goblin Boss', data: { _id: 'custom-goblin' } } },
        { path: 'loreArticles/article1', data: { id: 'article1', title: 'Lore', category: 'history', sortOrder: 0 } },
        { path: 'campaigns/camp1', data: { id: 'camp1', name: 'Campaign' } },
        { path: 'campaigns/camp1/characters/char1', data: { id: 'char1', name: 'Hero' } },
        { path: 'campaigns/camp1/quests/quest1', data: { id: 'quest1', title: 'Quest' } },
    ]);

    const buckets = selectCampaignBuckets(db);
    assert.equal(buckets.campaigns.camp1.characters[0].id, 'char1');
    assert.equal(buckets.campaigns.camp1.quests[0].id, 'quest1');
    assert.deepEqual(selectShop(db).availableItems, ['Rope']);
    assert.deepEqual(selectAvailableItemNames(db), ['Rope']);
    assert.deepEqual(selectAvailableFormulaNames(db), ['Rope']);
    assert.equal(selectCustomShopItem(db, 'Hero Snack').name, 'Hero Snack');
    assert.deepEqual(selectShopTraders(db).map(trader => trader.id), ['trader1', 'hidden']);
    assert.deepEqual(selectVisibleTraders(db).map(trader => trader.id), ['trader1']);
    assert.equal(selectBestiaryRevealState(db, 'goblin').hp, 'public');
    assert.equal(selectBestiaryCreatureMetadataEntry(db, 'goblin').revealState.hp, 'public');
    assert.equal(selectCustomCreature(db, 'custom-goblin').name, 'Goblin Boss');
    assert.equal(selectCustomCreatureData(db, 'custom-goblin')._id, 'custom-goblin');
    assert.deepEqual(selectCustomCreatureList(db).map(creature => creature.id), ['custom-goblin']);
    assert.equal(selectCustomAbility(db, 'trip').name, 'Trip');
    assert.equal(selectCustomAbilityList(db)[0].name, 'Trip');
    assert.equal(selectDeviantAbility(db, 'spark').name, 'Spark');
    assert.equal(selectDeviantAbilityList(db)[0].name, 'Spark');
    assert.equal(selectPact(db, 'ember').name, 'Ember Pact');
    assert.equal(selectPactList(db)[0].name, 'Ember Pact');
    assert.equal(selectLoreArticle(db, 'article1').title, 'Lore');
    assert.equal(selectLoreArticlesByCategory(db, 'history')[0].id, 'article1');
});

test('actor and effect selectors expose v2 actor viewmodels', () => {
    const campaign = {
        id: 'camp1',
        actors: [
            { id: 'pc1', kind: 'pc', name: 'Hero' },
            { id: 'companion1', kind: 'animal_companion', name: 'Wolf', ownerActorId: 'pc1' },
            { id: 'old', kind: 'pc', name: 'Old Hero', deletedAt: '2026-01-01' },
        ],
        actorEffects: [
            { id: 'frightened', targetActorId: 'pc1', category: 'condition', label: 'Frightened', value: 1 },
            { id: 'disabled', targetActorId: 'pc1', category: 'condition', label: 'Hidden', disabled: true },
            { id: 'item', targetActorId: 'pc1', category: 'item', label: 'Scales' },
        ],
        effectTemplates: [
            { id: 'slippery', label: 'Slippery' },
            { id: 'internal', label: 'Internal', hiddenFromPicker: true },
        ],
    };

    const buckets = selectActorBuckets(campaign);
    assert.deepEqual(buckets.actors.map(actor => actor.id), ['pc1', 'companion1']);
    assert.deepEqual(buckets.archivedActors.map(actor => actor.id), ['old']);
    assert.equal(selectMyActor(campaign, { actorId: 'pc1' }).name, 'Hero');
    assert.deepEqual(selectOwnedActors(campaign, 'pc1').map(actor => actor.id), ['companion1']);
    assert.deepEqual(selectPcActors(campaign).map(actor => actor.id), ['pc1']);
    assert.deepEqual(selectActorEffects(campaign, 'pc1').map(effect => effect.id), ['frightened', 'item']);
    assert.deepEqual(selectConditionEffects(campaign, 'pc1').map(effect => effect.id), ['frightened']);
    assert.deepEqual(selectConditionViewModels(campaign, 'pc1'), [{
        id: 'frightened',
        sourceEffectId: 'frightened',
        name: 'Frightened',
        level: 1,
        hidden: undefined,
        disabled: undefined,
    }]);
    assert.deepEqual(selectVisibleEffectTemplates(campaign).map(template => template.id), ['slippery']);
});

test('combatant effect selectors resolve player and creature effect targets', () => {
    const creatureCombatant = {
        id: 'goblin1',
        type: 'creature',
        effectTargetId: 'encounter:enc1:combatant:goblin1',
    };
    const playerCombatant = {
        id: 'pc-card',
        type: 'player',
        playerId: 'pc1',
    };
    const campaign = {
        actorEffects: [
            { id: 'offguard', targetActorId: creatureCombatant.effectTargetId, category: 'condition', label: 'Off-Guard', value: 1 },
            { id: 'fire', targetActorId: creatureCombatant.effectTargetId, category: 'damage_effect', label: '1d6 fire persistent', value: { formula: '1d6 fire persistent', damageType: 'fire' } },
            { id: 'frightened', targetActorId: 'pc1', category: 'condition', label: 'Frightened', value: 1 },
        ],
    };

    assert.equal(getCombatantEffectTargetId('enc1', playerCombatant), 'pc1');
    assert.equal(getCombatantEffectTargetId('enc1', creatureCombatant), creatureCombatant.effectTargetId);
    assert.deepEqual(selectCombatantEffects(campaign, 'enc1', creatureCombatant).map(effect => effect.id), ['offguard', 'fire']);
    assert.deepEqual(selectCombatantEffects(campaign, 'enc1', playerCombatant).map(effect => effect.id), ['frightened']);
    assert.deepEqual(selectCombatantEffectBadges(campaign, 'enc1', creatureCombatant).map(badge => badge.label), ['Off-Guard', '1d6 fire persistent']);
});

test('catalog override selector merges custom override and hide records', () => {
    const staticItems = [
        { id: 'fireball', name: 'Fireball', sourceFile: 'spells/fireball.json', level: 3 },
        { id: 'hidden', name: 'Hidden Spell', sourceFile: 'spells/hidden.json', level: 1 },
    ];
    const db = {
        catalogOverrides: {
            override_fireball: {
                id: 'override_fireball',
                catalogType: 'spell',
                baseId: 'spells/fireball.json',
                mode: 'override',
                label: 'Fireball',
                payload: {
                    name: 'Fireball',
                    level: 4,
                    sourceFile: null,
                    overrideSourceFile: 'spells/fireball.json',
                },
            },
            custom_spark: {
                id: 'custom_spark',
                catalogType: 'spell',
                mode: 'custom',
                label: 'Spark',
                payload: { name: 'Spark', level: 1, sourceFile: null },
            },
            hide_hidden: {
                id: 'hide_hidden',
                catalogType: 'spell',
                baseId: 'spells/hidden.json',
                mode: 'hide',
                label: 'Hidden Spell',
                payload: {},
            },
        },
    };

    const merged = mergeCatalogIndexWithOverrides(staticItems, db, 'spell');
    assert.deepEqual(merged.map(item => item.name), ['Fireball', 'Spark']);
    assert.equal(merged[0].level, 4);
    assert.equal(merged[0].overrideSourceFile, 'spells/fireball.json');
    assert.equal(merged[1].isCustom, true);
    assert.deepEqual(selectCatalogOverrideEntries(db, 'spell').map(item => item.name), ['Fireball', 'Spark']);
});
