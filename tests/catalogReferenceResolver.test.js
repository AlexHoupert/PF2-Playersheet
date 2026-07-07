import test from 'node:test';
import assert from 'node:assert/strict';
import { CATALOG_ENTRY_STATUS } from '../src/shared/catalog/catalogEntryModel.js';
import { createCatalogReference, copyRef, normalizeStoredReference } from '../src/shared/clipboard/refClipboard.js';
import {
    resolveCatalogLinkCore,
    resolveCatalogReferenceCore,
    resolveCatalogReferenceEntryCore,
} from '../src/shared/catalog/catalogReferenceResolverCore.js';

const staticSpells = [
    { id: 'fireball', name: 'Fireball', sourceFile: 'spells/fireball.json', level: 3, catalogType: 'spell' },
    { id: 'shield', name: 'Shield', sourceFile: 'spells/shield.json', level: 1, catalogType: 'spell' },
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
        spell_custom_song: {
            id: 'spell_custom_song',
            catalogType: 'spell',
            mode: 'custom',
            label: 'Custom Song',
            payload: {
                id: 'custom-song',
                name: 'Custom Song',
                level: 2,
                sourceFile: null,
                isCustom: true,
            },
        },
    },
};

test('catalog references use the canonical catalog ref shape with legacy compatibility fields', () => {
    const stored = copyRef('spell', staticSpells[0]);
    assert.equal(stored.refType, 'catalog');
    assert.equal(stored.catalogType, 'spell');
    assert.equal(stored.type, 'spell');
    assert.equal(stored.name, 'Fireball');
    assert.equal(stored.data.catalogRef.baseId, 'spells/fireball.json');

    const roundtrip = normalizeStoredReference({ _pf2ref: 1, type: 'spell', name: 'Fireball', data: staticSpells[0] });
    assert.equal(roundtrip.refType, 'catalog');
    assert.equal(roundtrip.data.catalogRef.catalogType, 'spell');
});

test('catalog reference resolver returns edited effective entries', () => {
    const ref = createCatalogReference('spell', staticSpells[0]);
    const resolved = resolveCatalogReferenceCore(ref, db, { staticItems: staticSpells });
    assert.equal(resolved.status, CATALOG_ENTRY_STATUS.EDITED);
    assert.equal(resolved.entry.name, 'Fireball');
    assert.equal(resolved.entry.level, 4);
    assert.equal(resolved.entry.overrideSourceFile, 'spells/fireball.json');
});

test('catalog reference resolver handles custom and deleted entries', () => {
    const custom = resolveCatalogLinkCore('spell', 'Custom Song', db, { staticItems: staticSpells });
    assert.equal(custom.status, CATALOG_ENTRY_STATUS.CUSTOM);
    assert.equal(custom.entry.name, 'Custom Song');

    const deleted = resolveCatalogLinkCore('spell', 'Shield', db, { staticItems: staticSpells });
    assert.equal(deleted.status, CATALOG_ENTRY_STATUS.DELETED);
    assert.equal(deleted.isDeleted, true);
    assert.equal(deleted.entry.name, 'Shield');
});

test('catalog reference resolver exposes entry shortcut', () => {
    const entry = resolveCatalogReferenceEntryCore({ catalogType: 'spell', label: 'Fireball' }, db, { staticItems: staticSpells });
    assert.equal(entry.level, 4);
});
