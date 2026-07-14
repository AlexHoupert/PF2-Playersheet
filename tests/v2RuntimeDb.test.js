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
