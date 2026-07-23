import test from 'node:test';
import assert from 'node:assert/strict';
import {
    buildCatalogDetailViewModel,
    normalizeTraits,
    resolveCatalogImageUrl,
} from '../src/shared/catalog/catalogDetailViewModel.js';

test('catalog image URLs resolve against the deployed ressources directory', () => {
    const iconPath = 'icons/equipment/alchemical-items/alchemical-bombs/blight-bomb.webp';

    assert.equal(resolveCatalogImageUrl(iconPath, { isProd: true }), `/ressources/${iconPath}`);
    assert.equal(resolveCatalogImageUrl(`/ressources/${iconPath}`, { isProd: true }), `/ressources/${iconPath}`);
    assert.equal(resolveCatalogImageUrl(iconPath, { isProd: false }), `/api/static/${iconPath}`);
});

test('normalizes shared catalog metadata for spells', () => {
    const model = buildCatalogDetailViewModel({
        catalogType: 'spell',
        entry: {
            id: 'bless',
            name: 'Bless',
            rank: 1,
            traits: ['concentrate', 'divine', 'concentrate'],
            traditions: ['divine', 'occult'],
            duration: '1 minute',
            description: '<p>Bless allies.</p>',
        },
    });

    assert.equal(model.catalogType, 'spell');
    assert.equal(model.levelLabel, 'Rank 1');
    assert.deepEqual(model.traits, ['concentrate', 'divine']);
    assert.deepEqual(model.metadata.find((row) => row.label === 'Traditions'), {
        label: 'Traditions',
        value: 'divine, occult',
    });
    assert.equal(model.description, '<p>Bless allies.</p>');
});

test('keeps zero armor dexterity caps in item details', () => {
    const model = buildCatalogDetailViewModel({
        catalogType: 'item',
        entry: {
            id: 'heavy-armor',
            name: 'Heavy Armor',
            type: 'Armor',
            system: { acBonus: 6, dexCap: 0 },
        },
    });

    assert.deepEqual(model.metadata.find((row) => row.label === 'AC Bonus')?.value, '+6');
    assert.deepEqual(model.metadata.find((row) => row.label === 'Dex Cap')?.value, '0');
});

test('normalizes object and comma-separated trait shapes', () => {
    assert.deepEqual(normalizeTraits({ value: ['fire', 'arcane'] }), ['fire', 'arcane']);
    assert.deepEqual(normalizeTraits('fire, arcane, fire'), ['fire', 'arcane']);
});
