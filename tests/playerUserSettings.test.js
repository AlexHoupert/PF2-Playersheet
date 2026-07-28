import assert from 'node:assert/strict';
import test from 'node:test';

import {
    DEFAULT_PLAYER_USER_SETTINGS,
    normalizePlayerUserSettings,
    SKILL_PROFICIENCY_DISPLAY,
} from '../src/player/settings/playerUserSettings.js';
import {
    isPlayerCatalogEntryEditable,
    resolvePlayerCatalogEditorMode,
} from '../src/player/catalog/playerCatalogEditing.js';

test('player settings normalize missing and invalid values safely', () => {
    assert.deepEqual(normalizePlayerUserSettings(), DEFAULT_PLAYER_USER_SETTINGS);
    assert.deepEqual(normalizePlayerUserSettings({
        skillProficiencyDisplay: 'STARS',
        loopPages: false,
    }), {
        skillProficiencyDisplay: SKILL_PROFICIENCY_DISPLAY.STARS,
        loopPages: false,
    });
    assert.equal(normalizePlayerUserSettings({ skillProficiencyDisplay: 'unknown' }).skillProficiencyDisplay, 'none');
});

test('player edit mode distinguishes generic actor forks from custom-only records', () => {
    assert.equal(isPlayerCatalogEntryEditable({
        catalogType: 'spell',
        entry: { name: 'Bless' },
        canAuthorCatalog: true,
    }), true);
    assert.equal(isPlayerCatalogEntryEditable({
        catalogType: 'feat',
        entry: { name: 'Fleet' },
        canAuthorCatalog: true,
        actorOwnedCustomOnly: true,
    }), false);
    assert.equal(isPlayerCatalogEntryEditable({
        catalogType: 'feat',
        entry: { name: 'Homebrew Feat', isCustom: true },
        canAuthorCatalog: true,
        actorOwnedCustomOnly: true,
    }), true);
});

test('player editor updates owned campaign entries and forks static entries', () => {
    const capabilities = { isTrustedPlayer: true };
    const owned = {
        id: 'spell_custom',
        mode: 'custom',
        ownerEmail: 'player@example.test',
        payload: { name: 'Personal Spell' },
    };
    assert.equal(resolvePlayerCatalogEditorMode({
        entry: { catalogEntryId: owned.id },
        catalogEntries: { [owned.id]: owned },
        capabilities,
        userEmail: 'PLAYER@example.test',
    }).editorMode, 'edit');
    assert.equal(resolvePlayerCatalogEditorMode({
        entry: { name: 'Bless' },
        catalogEntries: {},
        capabilities,
        userEmail: 'player@example.test',
    }).editorMode, 'clone');
});
