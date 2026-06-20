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

test('items layout receives lootbag selection state from ItemsView', () => {
    const viewSource = readSource('src/admin/ItemsView.jsx');
    const layoutSource = readSource('src/admin/items/ItemsViewLayout.jsx');

    assert.match(viewSource, /setSelectedLootId=\{setSelectedLootId\}/);
    assert.match(layoutSource, /setSelectedLootId,/);
    assert.match(layoutSource, /sameId\(selectedLootId, entry\.id\)/);
});

test('admin actions use database fallback instead of deployed file writes', () => {
    const viewSource = readSource('src/admin/ActionsView.jsx');
    const editorSource = readSource('src/admin/editors/ActionEditor.jsx');

    assert.match(viewSource, /saveCustomAction/);
    assert.match(viewSource, /normalizeCustomActionRecord/);
    assert.match(editorSource, /onSaveToDb/);
    assert.match(editorSource, /import\.meta\.env\.PROD/);
    assert.match(editorSource, /sourceFile: null/);
    assert.match(editorSource, /readJsonApiResponse\(res, 'Save action'\)/);
});

test('admin spells use catalog override fallback instead of deployed-only file writes', () => {
    const viewSource = readSource('src/admin/SpellsView.jsx');
    const editorSource = readSource('src/admin/editors/SpellEditor.jsx');

    assert.match(viewSource, /catalogOverride\.saveCatalogOverride/);
    assert.match(viewSource, /spellJsonToEditorFormData/);
    assert.equal(viewSource.includes('Static spell files can only be edited'), false);
    assert.match(editorSource, /onSaveToDb/);
    assert.match(editorSource, /buildSpellOverride/);
    assert.match(editorSource, /catalogType: 'spell'/);
    assert.match(editorSource, /import\.meta\.env\.PROD/);
    assert.match(editorSource, /readJsonApiResponse\(res, 'Save spell'\)/);
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

test('player basis edit modals use targeted character actions', () => {
    const sources = [
        'src/player/modals/ACModals.jsx',
        'src/player/modals/SimpleModals.jsx',
        'src/player/modals/FormulaBookModal.jsx',
        'src/player/QuickSheetModal.jsx',
    ];
    const forbiddenPatterns = [
        /updateCharacter\(c\s*=>\s*c\./,
        /updateCharacter\(c\s*=>\s*c\.gold\s*=/,
        /updateCharacter\(c\s*=>\s*c\.stats\.attributes/,
        /updateCharacter\(c\s*=>\s*c\.stats\.hp\.(current|temp|max)\s*=/,
        /updateCharacter\(c\s*=>\s*c\.stats\.speed/,
        /updateCharacter\(c\s*=>\s*c\.stats\.class_dc\s*=/,
        /updateCharacter\(c\s*=>\s*c\.dailyCraftingMax\s*=/,
    ];

    sources.forEach((path) => {
        const source = readSource(path);
        forbiddenPatterns.forEach((pattern) => {
            assert.equal(pattern.test(source), false, `${path} contains a direct basis-value update: ${pattern}`);
        });
    });

    assert.match(readSource('src/player/modals/SimpleModals.jsx'), /characterActions/);
    assert.match(readSource('src/player/modals/FormulaBookModal.jsx'), /setDailyCraftingMax/);
    assert.match(readSource('src/player/QuickSheetModal.jsx'), /characterActions/);
});

test('firestore v2 runtime no longer broad-diffs legacy projections', () => {
    const source = readSource('src/shared/db/v2/useFirestoreV2Db.js');
    const appSource = readSource('src/App.jsx');

    assert.equal(source.includes('writeLegacyDbDiffToV2'), false);
    assert.match(source, /legacyProjection/);
    assert.match(source, /v2Store/);
    assert.match(appSource, /legacyProjection/);
    assert.match(appSource, /v2Store/);
    assert.equal(appSource.includes('setDb='), false);
});

test('runtime views do not carry legacy setDb or character condition contracts', () => {
    const runtimeSources = [
        'src/App.jsx',
        'src/admin/AdminApp.jsx',
        'src/admin/AdminTabContent.jsx',
        'src/admin/EncounterView.jsx',
        'src/admin/encounter/EncounterPanels.jsx',
        'src/admin/components/CharacterCard.jsx',
        'src/player/PlayerAppController.jsx',
        'src/player/views/StatsView.jsx',
        'src/player/views/CompanionTab.jsx',
        'src/player/hooks/usePlayerInventoryActions.js',
    ];

    runtimeSources.forEach((path) => {
        const source = readSource(path);
        assert.equal(source.includes('setDb'), false, `${path} should not carry setDb`);
        assert.equal(source.includes('character.conditions'), false, `${path} should not read character.conditions`);
        assert.equal(source.includes('character.companion'), false, `${path} should not read character.companion`);
        assert.equal(source.includes('has_companion'), false, `${path} should not use has_companion`);
    });
});
