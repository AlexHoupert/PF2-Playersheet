import test from 'node:test';
import assert from 'node:assert/strict';

import {
    buildCatalogEditorOverride,
    buildLegacyDbCatalogPayload,
    CATALOG_EDITOR_MODES,
    isStaticCatalogEdit,
} from '../src/shared/catalog/catalogEditorContract.js';

test('static editor save builds an override for the original source entry', () => {
    const staticSpell = { name: 'Uplifting Overture', sourceFile: 'spells/uplifting-overture.json' };
    const override = buildCatalogEditorOverride('spell', { name: 'Uplifting Overture', level: 0 }, {
        initialItem: staticSpell,
        editorMode: CATALOG_EDITOR_MODES.EDIT,
    });

    assert.equal(override.catalogType, 'spell');
    assert.equal(override.mode, 'override');
    assert.equal(override.baseId, 'spells/uplifting-overture.json');
    assert.equal(override.payload.level, 0);
});

test('custom editor save keeps a custom override id instead of creating a static override', () => {
    const customItem = { id: 'custom-bomb', name: 'Custom Bomb', isCustom: true, catalogOverrideId: 'item_custom-bomb' };
    const override = buildCatalogEditorOverride('item', { id: 'custom-bomb', name: 'Custom Bomb', level: 3 }, {
        initialItem: customItem,
        editorMode: CATALOG_EDITOR_MODES.EDIT,
    });

    assert.equal(override.catalogType, 'item');
    assert.equal(override.mode, 'custom');
    assert.equal(override.id, 'item_custom-bomb');
    assert.equal(override.baseId, null);
});

test('clone and create saves are custom catalog entries', () => {
    const source = { name: 'Fireball', sourceFile: 'spells/fireball.json' };
    const clone = buildCatalogEditorOverride('spell', { name: 'Fireball (Copy)', level: 3 }, {
        initialItem: source,
        editorMode: CATALOG_EDITOR_MODES.CLONE,
        id: 'spell_custom_fireball_copy',
    });
    const created = buildCatalogEditorOverride('spell', { name: 'New Spell', level: 1 }, {
        editorMode: CATALOG_EDITOR_MODES.CREATE,
        id: 'spell_custom_new_spell',
    });

    assert.equal(clone.mode, 'custom');
    assert.equal(clone.id, 'spell_custom_fireball_copy');
    assert.equal(created.mode, 'custom');
    assert.equal(created.id, 'spell_custom_new_spell');
});

test('static edit detection uses editor mode and stable source metadata', () => {
    assert.equal(isStaticCatalogEdit({
        editorMode: CATALOG_EDITOR_MODES.EDIT,
        initialItem: { name: 'Goblin', sourceFile: 'bestiary/goblin.json' },
    }), true);
    assert.equal(isStaticCatalogEdit({
        editorMode: CATALOG_EDITOR_MODES.CLONE,
        initialItem: { name: 'Goblin', sourceFile: 'bestiary/goblin.json' },
    }), false);
    assert.equal(isStaticCatalogEdit({
        editorMode: CATALOG_EDITOR_MODES.EDIT,
        initialItem: { name: 'Custom Goblin', isCustom: true },
    }), false);
});

test('legacy db payload builder keeps old custom collection shape for compatibility fallbacks', () => {
    const payload = buildLegacyDbCatalogPayload({ name: 'Abadar Scale' });

    assert.equal(payload.id, 'abadar_scale');
    assert.equal(payload._id, 'abadar_scale');
    assert.equal(payload.isCustom, true);
    assert.equal(payload.sourceFile, null);
});
