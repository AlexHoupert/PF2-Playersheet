import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const readSource = (path) => readFileSync(resolve(repoRoot, path), 'utf8');

test('items layout does not reference split module globals', () => {
    const source = readSource('src/admin/items/ItemsViewLayout.jsx');
    const staleGlobals = [
        'uniqueTypes',
        'uniqueCategories',
        'uniqueGroups',
        'uniqueRarities',
        'SHOP_INDEX_FILTER_OPTIONS',
    ];

    staleGlobals.forEach((name) => {
        assert.equal(source.includes(name), false, `${name} should be passed from ItemsView, not referenced globally`);
    });
    assert.match(source, /optionsMap=\{filterOptions\}/);
});

test('quest fallback reads stay centralized in selectors', () => {
    const playerSource = readSource('src/player/PlayerAppController.jsx');
    const gmSource = readSource('src/admin/QuestsView.jsx');

    assert.equal(playerSource.includes('activeCampaign?.quests'), false);
    assert.equal(playerSource.includes('db?.quests'), false);
    assert.equal(gmSource.includes('activeCampaign?.quests'), false);
    assert.equal(gmSource.includes('db?.quests'), false);
    assert.match(playerSource, /selectQuestLists/);
    assert.match(gmSource, /selectQuestLists/);
});
