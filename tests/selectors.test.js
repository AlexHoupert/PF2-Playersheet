import test from 'node:test';
import assert from 'node:assert/strict';
import {
    selectActiveCampaign,
    selectCampaignBuckets,
    selectCampaignChildLists,
    selectRootFallbackList,
    selectTargetCampaignId,
} from '../src/shared/db/selectors/campaignSelectors.js';
import { selectMyCharacter } from '../src/shared/db/selectors/characterSelectors.js';
import { selectCustomAbilityList, selectDeviantAbilityList } from '../src/shared/db/selectors/abilitySelectors.js';
import { selectBestiaryRevealState, selectCustomCreature } from '../src/shared/db/selectors/bestiarySelectors.js';
import { selectLoreArticlesByCategory } from '../src/shared/db/selectors/loreSelectors.js';
import { selectPactList } from '../src/shared/db/selectors/pactSelectors.js';
import { selectShop, selectVisibleTraders } from '../src/shared/db/selectors/shopSelectors.js';
import { composeLegacyDbFromV2Documents } from '../src/shared/db/v2/normalizers.js';

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

test('character and root fallback selectors keep legacy reads centralized', () => {
    const db = {
        quests: [{ id: 'legacyQuest' }],
        campaigns: {
            camp1: {
                id: 'camp1',
                quests: [],
                characters: [{ id: 'char1', name: 'Hero' }],
            },
        },
    };

    assert.equal(selectMyCharacter(db.campaigns.camp1, { characterId: 'char1' }).name, 'Hero');
    assert.equal(selectRootFallbackList(db, 'quests', 'camp1')[0].id, 'legacyQuest');
});

test('selectors read v2 projection with campaign subcollections and global config', () => {
    const db = composeLegacyDbFromV2Documents([
        { path: 'global/config', data: {
            shop: {
                traders: [{ id: 'trader1', name: 'Market' }, { id: 'hidden', name: 'Hidden', hidden: true }],
                availableItems: ['Rope'],
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
    assert.deepEqual(selectVisibleTraders(db).map(trader => trader.id), ['trader1']);
    assert.equal(selectBestiaryRevealState(db, 'goblin').hp, 'public');
    assert.equal(selectCustomCreature(db, 'custom-goblin').name, 'Goblin Boss');
    assert.equal(selectCustomAbilityList(db)[0].name, 'Trip');
    assert.equal(selectDeviantAbilityList(db)[0].name, 'Spark');
    assert.equal(selectPactList(db)[0].name, 'Ember Pact');
    assert.equal(selectLoreArticlesByCategory(db, 'history')[0].id, 'article1');
});
