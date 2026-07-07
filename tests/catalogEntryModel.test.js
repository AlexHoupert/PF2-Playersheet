import test from 'node:test';
import assert from 'node:assert/strict';
import {
    CATALOG_ENTRY_STATUS,
    buildCloneOverride,
    buildEditOverride,
    buildHideOverride,
    getCatalogEntryKey,
} from '../src/shared/catalog/catalogEntryModel.js';
import {
    mergeCatalogIndexWithOverrides,
    selectCatalogEntryStates,
    selectDeletedCatalogEntries,
    selectVisibleCatalogEntries,
} from '../src/shared/db/selectors/catalogOverrideSelectors.js';

test('catalog entry selectors expose original edited custom and deleted statuses', () => {
    const staticItems = [
        { id: 'fireball', name: 'Fireball', sourceFile: 'spells/fireball.json', level: 3 },
        { id: 'shield', name: 'Shield', sourceFile: 'spells/shield.json', level: 1 },
    ];
    const db = {
        catalogOverrides: {
            spell_fireball: {
                id: 'spell_fireball',
                catalogType: 'spell',
                baseId: 'spells/fireball.json',
                mode: 'override',
                label: 'Fireball',
                payload: {
                    id: 'fireball',
                    name: 'Fireball',
                    level: 4,
                    sourceFile: null,
                    overrideSourceFile: 'spells/fireball.json',
                },
            },
            spell_shield: {
                id: 'spell_shield',
                catalogType: 'spell',
                baseId: 'spells/shield.json',
                mode: 'hide',
                label: 'Shield',
                payload: {
                    name: 'Shield',
                    overrideSourceFile: 'spells/shield.json',
                },
            },
            spell_spark: {
                id: 'spell_spark',
                catalogType: 'spell',
                mode: 'custom',
                label: 'Spark',
                payload: {
                    id: 'spark',
                    name: 'Spark',
                    level: 0,
                    sourceFile: null,
                    isCustom: true,
                },
            },
        },
    };

    const states = selectCatalogEntryStates(staticItems, db, 'spell');
    assert.deepEqual(states.map((state) => [state.entry.name, state.status]), [
        ['Fireball', CATALOG_ENTRY_STATUS.EDITED],
        ['Shield', CATALOG_ENTRY_STATUS.DELETED],
        ['Spark', CATALOG_ENTRY_STATUS.CUSTOM],
    ]);

    const visible = selectVisibleCatalogEntries(staticItems, db, 'spell');
    assert.deepEqual(visible.map((item) => item.name), ['Fireball', 'Spark']);
    assert.equal(visible[0].level, 4);
    assert.equal(visible[0].catalogEntryStatus, CATALOG_ENTRY_STATUS.EDITED);
    assert.equal(visible[1].catalogEntryStatus, CATALOG_ENTRY_STATUS.CUSTOM);

    const deleted = selectDeletedCatalogEntries(staticItems, db, 'spell');
    assert.deepEqual(deleted.map((item) => item.name), ['Shield']);
    assert.equal(deleted[0].catalogEntryStatus, CATALOG_ENTRY_STATUS.DELETED);

    assert.deepEqual(mergeCatalogIndexWithOverrides(staticItems, db, 'spell').map((item) => item.name), ['Fireball', 'Spark']);
});

test('catalog matching prefers stable source keys over duplicate names', () => {
    const staticItems = [
        { id: 'lesser', name: 'Alchemist Fire', sourceFile: 'equipment/alchemist-fire-lesser.json', level: 1 },
        { id: 'moderate', name: 'Alchemist Fire', sourceFile: 'equipment/alchemist-fire-moderate.json', level: 3 },
    ];
    const db = {
        catalogOverrides: {
            item_moderate: {
                id: 'item_moderate',
                catalogType: 'item',
                baseId: 'equipment/alchemist-fire-moderate.json',
                mode: 'override',
                label: 'Alchemist Fire',
                payload: {
                    id: 'moderate',
                    name: 'Alchemist Fire',
                    level: 4,
                    sourceFile: null,
                    overrideSourceFile: 'equipment/alchemist-fire-moderate.json',
                },
            },
        },
    };

    const visible = selectVisibleCatalogEntries(staticItems, db, 'item');
    assert.deepEqual(visible.map((item) => item.level), [1, 4]);
    assert.equal(visible[0].catalogEntryStatus, CATALOG_ENTRY_STATUS.ORIGINAL);
    assert.equal(visible[1].catalogEntryStatus, CATALOG_ENTRY_STATUS.EDITED);
});

test('catalog override builders create edit clone and hide records', () => {
    const staticSpell = { id: 'fireball', name: 'Fireball', sourceFile: 'spells/fireball.json', level: 3 };

    const edit = buildEditOverride('spell', staticSpell, { id: 'fireball', name: 'Fireball', level: 4 });
    assert.equal(edit.id, 'spell_spells_fireball_json');
    assert.equal(edit.catalogType, 'spell');
    assert.equal(edit.mode, 'override');
    assert.equal(edit.baseId, 'spells/fireball.json');
    assert.equal(edit.payload.level, 4);
    assert.equal(edit.payload.sourceFile, null);
    assert.equal(edit.payload.overrideSourceFile, 'spells/fireball.json');
    assert.equal(edit.payload.isCustom, false);

    const clone = buildCloneOverride('spell', staticSpell, { name: 'Fireball (Copy)', level: 3 }, { id: 'spell_custom_fireball_copy' });
    assert.equal(clone.id, 'spell_custom_fireball_copy');
    assert.equal(clone.mode, 'custom');
    assert.equal(clone.baseId, null);
    assert.equal(clone.payload.isCustom, true);
    assert.equal(clone.payload.overrideSourceFile, null);

    const hide = buildHideOverride('spell', staticSpell);
    assert.equal(hide.id, 'spell_spells_fireball_json');
    assert.equal(hide.mode, 'hide');
    assert.equal(hide.baseId, 'spells/fireball.json');
    assert.equal(hide.payload.overrideSourceFile, 'spells/fireball.json');
});

test('catalog entry keys normalize resource prefixes and source paths', () => {
    assert.equal(
        getCatalogEntryKey({ sourceFile: 'ressources/spells/Fireball.json', name: 'Fireball' }, 'spell'),
        'spells/fireball.json'
    );
    assert.equal(
        getCatalogEntryKey({ sourceFile: 'resources/spells/Fireball.json', name: 'Fireball' }, 'spell'),
        'spells/fireball.json'
    );
});

test('catalog mutation semantics cover edit clone hide and deleted filter cases', () => {
    const staticItems = [
        { id: 'aid', name: 'Aid', sourceFile: 'actions/aid.json', level: 0 },
        { id: 'shove', name: 'Shove', sourceFile: 'actions/shove.json', level: 0 },
    ];
    const edit = buildEditOverride('action', staticItems[0], { ...staticItems[0], name: 'Aid Updated', level: 1 });
    const clone = buildCloneOverride('action', staticItems[0], { id: 'aid-copy', name: 'Aid Copy', level: 0 }, { id: 'action_aid_copy' });
    const hide = buildHideOverride('action', staticItems[1]);
    const db = { catalogOverrides: { [edit.id]: edit, [clone.id]: clone, [hide.id]: hide } };

    const states = selectCatalogEntryStates(staticItems, db, 'action');
    const visible = selectVisibleCatalogEntries(staticItems, db, 'action');
    const deleted = selectDeletedCatalogEntries(staticItems, db, 'action');

    assert.deepEqual(visible.map((entry) => [entry.name, entry.catalogEntryStatus]), [
        ['Aid Updated', CATALOG_ENTRY_STATUS.EDITED],
        ['Aid Copy', CATALOG_ENTRY_STATUS.CUSTOM],
    ]);
    assert.equal(visible.filter((entry) => entry.overrideSourceFile === 'actions/aid.json').length, 1);
    assert.deepEqual(deleted.map((entry) => [entry.name, entry.catalogEntryStatus]), [
        ['Shove', CATALOG_ENTRY_STATUS.DELETED],
    ]);
    assert.deepEqual(states.map((state) => state.status), [
        CATALOG_ENTRY_STATUS.EDITED,
        CATALOG_ENTRY_STATUS.DELETED,
        CATALOG_ENTRY_STATUS.CUSTOM,
    ]);
});
