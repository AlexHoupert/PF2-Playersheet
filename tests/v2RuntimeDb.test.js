import test from 'node:test';
import assert from 'node:assert/strict';
import { composeRuntimeDbFromV2Store } from '../src/shared/db/v2/runtimeDb.js';

test('runtime lore uses collection articles over stale global lore articles', () => {
    const db = composeRuntimeDbFromV2Store({
        global: {
            lore: {
                articles: [],
                groups: ['Regional'],
            },
        },
        loreArticles: {
            history: {
                id: 'history',
                title: 'Recovered History',
                category: 'history',
            },
            npc: {
                id: 'npc',
                title: 'Recovered NPC',
                category: 'npcs',
            },
        },
    });

    assert.deepEqual(db.lore.groups, ['Regional']);
    assert.deepEqual(
        db.lore.articles.map((article) => article.id),
        ['history', 'npc']
    );
});

test('runtime campaign view maps campaign-scoped lore collections to lists', () => {
    const db = composeRuntimeDbFromV2Store({
        campaigns: {
            campaign: {
                id: 'campaign',
                loreArticles: { article: { id: 'article', title: 'Campaign Lore' } },
                loreGroups: { group: { id: 'group', name: 'History' } },
                loreDeliveries: { delivery: { id: 'delivery', articleId: 'article', actorId: 'pc' } },
                knowledgeNotes: { note: { id: 'note', actorId: 'pc', targetId: 'article' } },
            },
        },
    });

    const campaign = db.campaigns.campaign;
    assert.deepEqual(campaign.loreArticles.map((entry) => entry.id), ['article']);
    assert.deepEqual(campaign.loreGroups.map((entry) => entry.id), ['group']);
    assert.deepEqual(campaign.loreDeliveries.map((entry) => entry.id), ['delivery']);
    assert.deepEqual(campaign.knowledgeNotes.map((entry) => entry.id), ['note']);
});
