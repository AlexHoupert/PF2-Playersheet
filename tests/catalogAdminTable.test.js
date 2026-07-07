import test from 'node:test';
import assert from 'node:assert/strict';
import { CATALOG_ENTRY_STATUS } from '../src/shared/catalog/catalogEntryModel.js';
import {
    createCatalogEntryReference,
    filterCatalogEntryStates,
    getStandardCatalogContextActions,
    paginateCatalogEntryStates,
    sortCatalogEntryStates,
} from '../src/admin/catalog/useCatalogAdminTable.js';

const STATES = [
    {
        status: CATALOG_ENTRY_STATUS.ORIGINAL,
        key: 'spells/acid-splash.json',
        entry: {
            id: 'acid-splash',
            name: 'Acid Splash',
            level: 0,
            traits: ['acid', 'cantrip'],
            sourceFile: 'spells/acid-splash.json',
            catalogType: 'spell',
            catalogEntryStatus: CATALOG_ENTRY_STATUS.ORIGINAL,
        },
        effective: null,
    },
    {
        status: CATALOG_ENTRY_STATUS.EDITED,
        key: 'spells/uplifting-overture.json',
        entry: {
            id: 'uplifting-overture',
            name: 'Uplifting Overture',
            level: 0,
            traits: ['composition'],
            sourceFile: null,
            overrideSourceFile: 'spells/uplifting-overture.json',
            catalogType: 'spell',
            catalogEntryStatus: CATALOG_ENTRY_STATUS.EDITED,
            catalogOverrideId: 'spell_uplifting_overture',
        },
        effective: null,
        baseId: 'spells/uplifting-overture.json',
    },
    {
        status: CATALOG_ENTRY_STATUS.CUSTOM,
        key: 'spell_custom_song',
        entry: {
            id: 'custom-song',
            name: 'Custom Song',
            level: 2,
            traits: ['auditory'],
            sourceFile: null,
            catalogType: 'spell',
            catalogEntryStatus: CATALOG_ENTRY_STATUS.CUSTOM,
            catalogOverrideId: 'spell_custom_song',
        },
        effective: null,
    },
    {
        status: CATALOG_ENTRY_STATUS.DELETED,
        key: 'spells/hidden.json',
        entry: {
            id: 'hidden',
            name: 'Hidden Spell',
            level: 1,
            sourceFile: 'spells/hidden.json',
            catalogType: 'spell',
            catalogEntryStatus: CATALOG_ENTRY_STATUS.DELETED,
        },
        effective: null,
    },
];

test('catalog admin table default status filter hides deleted entries', () => {
    const filtered = filterCatalogEntryStates(STATES);
    assert.deepEqual(filtered.map((state) => state.entry.name), [
        'Acid Splash',
        'Uplifting Overture',
        'Custom Song',
    ]);
});

test('catalog admin table status filters can include deleted and isolate edited entries', () => {
    const editedOnly = filterCatalogEntryStates(STATES, {
        statusFilters: {
            [CATALOG_ENTRY_STATUS.ORIGINAL]: false,
            [CATALOG_ENTRY_STATUS.EDITED]: true,
            [CATALOG_ENTRY_STATUS.CUSTOM]: false,
            [CATALOG_ENTRY_STATUS.DELETED]: false,
        },
    });
    assert.deepEqual(editedOnly.map((state) => state.entry.name), ['Uplifting Overture']);

    const deletedOnly = filterCatalogEntryStates(STATES, {
        statusFilters: {
            [CATALOG_ENTRY_STATUS.ORIGINAL]: false,
            [CATALOG_ENTRY_STATUS.EDITED]: false,
            [CATALOG_ENTRY_STATUS.CUSTOM]: false,
            [CATALOG_ENTRY_STATUS.DELETED]: true,
        },
    });
    assert.deepEqual(deletedOnly.map((state) => state.entry.name), ['Hidden Spell']);
});

test('catalog admin table search checks configured row fields', () => {
    const byTrait = filterCatalogEntryStates(STATES, { search: 'composition' });
    assert.deepEqual(byTrait.map((state) => state.entry.name), ['Uplifting Overture']);

    const bySource = filterCatalogEntryStates(STATES, { search: 'acid-splash' });
    assert.deepEqual(bySource.map((state) => state.entry.name), ['Acid Splash']);
});

test('catalog admin table sorting and pagination are deterministic', () => {
    const sortedByLevelDesc = sortCatalogEntryStates(
        filterCatalogEntryStates(STATES),
        { key: 'level', direction: 'desc' }
    );
    assert.deepEqual(sortedByLevelDesc.map((state) => state.entry.name), [
        'Custom Song',
        'Acid Splash',
        'Uplifting Overture',
    ]);

    const pageTwo = paginateCatalogEntryStates(sortedByLevelDesc, { page: 2, itemsPerPage: 1 });
    assert.deepEqual(pageTwo.map((state) => state.entry.name), ['Acid Splash']);
});

test('catalog admin table references are stable catalog refs', () => {
    const ref = createCatalogEntryReference(STATES[1]);
    assert.deepEqual(ref, {
        refType: 'catalog',
        catalogType: 'spell',
        id: 'spell_uplifting_overture',
        baseId: 'spells/uplifting-overture.json',
        sourceFile: 'spells/uplifting-overture.json',
        label: 'Uplifting Overture',
        catalogOverrideId: 'spell_uplifting_overture',
        status: CATALOG_ENTRY_STATUS.EDITED,
    });
});

test('catalog admin table exposes standard context action labels', () => {
    assert.deepEqual(getStandardCatalogContextActions().map((action) => action.label), [
        'Preview',
        'Edit',
        'Clone',
        'Delete',
        'Copy Reference',
    ]);
    assert.deepEqual(getStandardCatalogContextActions({ includePreview: false }).map((action) => action.label), [
        'Edit',
        'Clone',
        'Delete',
        'Copy Reference',
    ]);
});
