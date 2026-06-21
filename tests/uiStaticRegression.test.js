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

    assert.match(viewSource, /catalogOverride\.saveCatalogOverride/);
    assert.match(viewSource, /mergeCatalogIndexWithOverrides/);
    assert.match(viewSource, /normalizeCustomActionRecord/);
    assert.match(editorSource, /onSaveToDb/);
    assert.match(editorSource, /buildActionOverride/);
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

test('admin feats and impulses use catalog override production editing', () => {
    const featViewSource = readSource('src/admin/FeatsView.jsx');
    const featEditorSource = readSource('src/admin/editors/FeatEditor.jsx');
    const impulseViewSource = readSource('src/admin/ImpulsesView.jsx');
    const impulseEditorSource = readSource('src/admin/editors/ImpulseEditor.jsx');

    assert.match(featViewSource, /catalogOverride\.saveCatalogOverride/);
    assert.match(featViewSource, /mergeCatalogIndexWithOverrides/);
    assert.match(featEditorSource, /onSaveToDb/);
    assert.match(featEditorSource, /buildFeatOverride/);
    assert.match(featEditorSource, /readJsonApiResponse\(res, 'Save feat'\)/);
    assert.equal(featEditorSource.includes('Deployed feat overrides are not enabled yet'), false);

    assert.match(impulseViewSource, /catalogOverride\.saveCatalogOverride/);
    assert.match(impulseViewSource, /mergeCatalogIndexWithOverrides/);
    assert.match(impulseEditorSource, /onSaveToDb/);
    assert.match(impulseEditorSource, /buildImpulseOverride/);
    assert.match(impulseEditorSource, /readJsonApiResponse\(res, 'Save impulse'\)/);
    assert.equal(impulseEditorSource.includes('Deployed impulse overrides are not enabled yet'), false);
});

test('admin item production editing skips file writes and uses database fallback', () => {
    const editorSource = readSource('src/admin/editors/ItemEditor.jsx');

    assert.match(editorSource, /dbOnly \|\| import\.meta\.env\.PROD/);
    assert.match(editorSource, /onSaveToDb/);
    assert.match(editorSource, /readJsonApiResponse\(res, 'Save item'\)/);
});

test('item icon previews use deployed static ressources path', () => {
    const pickerSource = readSource('src/shared/components/ImagePicker.jsx');
    const editorSource = readSource('src/admin/editors/ItemEditor.jsx');

    assert.match(pickerSource, /import\.meta\.env\.PROD \? '\/ressources' : '\/api\/static'/);
    assert.match(editorSource, /import\.meta\.env\.PROD \? '\/ressources' : '\/api\/static'/);
    assert.equal(pickerSource.includes('return `/api/static/${basePath}`'), false);
    assert.equal(editorSource.includes("import.meta.env.PROD ? '' : '/api/static'"), false);
});

test('quest fallback reads stay centralized in selectors', () => {
    const playerSource = readSource('src/player/PlayerAppController.jsx');
    const gmSource = readSource('src/admin/QuestsView.jsx');

    assert.equal(playerSource.includes('activeCampaign?.quests'), false);
    assert.equal(playerSource.includes('db?.quests'), false);
    assert.equal(gmSource.includes('activeCampaign?.quests'), false);
    assert.equal(gmSource.includes('db?.quests'), false);
    assert.match(playerSource, /quests: playerQuests/);
    assert.match(gmSource, /selectQuestLists/);
});

test('player basis edit modals use targeted character actions', () => {
    const sources = [
        'src/player/modals/ACModals.jsx',
        'src/player/modals/MagicModals.jsx',
        'src/player/modals/SimpleModals.jsx',
        'src/player/modals/FormulaBookModal.jsx',
        'src/player/QuickSheetModal.jsx',
        'src/player/views/MagicView.jsx',
        'src/player/sections/DefensesSection.jsx',
    ];
    const forbiddenPatterns = [
        /updateCharacter\(c\s*=>\s*c\./,
        /updateCharacter\(c\s*=>\s*c\.gold\s*=/,
        /updateCharacter\(c\s*=>\s*c\.stats\.attributes/,
        /updateCharacter\(c\s*=>\s*c\.stats\.hp\.(current|temp|max)\s*=/,
        /updateCharacter\(c\s*=>\s*c\.stats\.speed/,
        /updateCharacter\(c\s*=>\s*c\.stats\.class_dc\s*=/,
        /updateCharacter\(c\s*=>\s*c\.dailyCraftingMax\s*=/,
        /updateCharacter\(c\s*=>[\s\S]{0,180}c\.stats\.saves/,
        /updateCharacter\(c\s*=>[\s\S]{0,180}c\.stats\.proficiencies/,
        /updateCharacter\(c\s*=>[\s\S]{0,180}c\.stats\.spell_proficiency/,
        /updateCharacter\(c\s*=>[\s\S]{0,180}c\.stats\.impulse_proficiency/,
        /updateCharacter\(c\s*=>[\s\S]{0,180}c\.magic\.slots/,
        /updateCharacter\(c\s*=>[\s\S]{0,180}c\.stats\.ac\.(shield_raised|armor_equipped|shield_hp)/,
        /updateCharacter\(c\s*=>[\s\S]{0,180}c\.proficiencies\[/,
        /updateCharacter\(c\s*=>[\s\S]{0,180}c\.skills\[/,
    ];

    sources.forEach((path) => {
        const source = readSource(path);
        forbiddenPatterns.forEach((pattern) => {
            assert.equal(pattern.test(source), false, `${path} contains a direct basis-value update: ${pattern}`);
        });
    });

    assert.match(readSource('src/player/modals/SimpleModals.jsx'), /characterActions/);
    assert.match(readSource('src/player/modals/MagicModals.jsx'), /setMagicSlot/);
    assert.match(readSource('src/player/modals/FormulaBookModal.jsx'), /setDailyCraftingMax/);
    assert.match(readSource('src/player/QuickSheetModal.jsx'), /characterActions/);
    assert.match(readSource('src/player/sections/DefensesSection.jsx'), /setEquipmentState/);
});

test('firestore v2 runtime no longer broad-diffs legacy projections', () => {
    const source = readSource('src/shared/db/v2/useFirestoreV2Db.js');
    const appSource = readSource('src/App.jsx');

    assert.equal(source.includes('writeLegacyDbDiffToV2'), false);
    assert.match(source, /legacyProjection/);
    assert.match(source, /v2Store/);
    assert.match(appSource, /legacyProjection/);
    assert.match(appSource, /importDb/);
    assert.equal(appSource.includes('legacyDb'), false);
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

test('v2 runtime actions do not inject or call characterRepo', () => {
    const actionSource = readSource('src/shared/db/domain/createDataActions.js');
    const contextSource = readSource('src/shared/context/CampaignContext.jsx');
    const hookSource = readSource('src/shared/db/v2/useFirestoreV2Db.js');
    const runtimeDbSource = readSource('src/shared/db/v2/runtimeDb.js');
    const viewModelSource = readSource('src/shared/db/v2/viewModel.js');
    const characterSelectorsSource = readSource('src/shared/db/selectors/characterSelectors.js');

    assert.equal(actionSource.includes('repos.characterRepo'), false);
    assert.equal(contextSource.includes('characterRepo'), false);
    assert.equal(hookSource.includes('V2_COLLECTIONS.characters'), false);
    assert.equal(runtimeDbSource.includes('V2_COLLECTIONS.characters'), false);
    assert.equal(viewModelSource.includes('V2_COLLECTIONS.characters'), false);
    assert.equal(characterSelectorsSource.includes('campaign?.characters'), false);
});
