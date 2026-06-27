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

test('player spell catalog uses catalog overrides and preserves rank zero spells', () => {
    const overlaySource = readSource('src/player/components/LazyCatalogOverlay.jsx');
    const playerSource = readSource('src/player/PlayerAppController.jsx');
    const inventoryActionsSource = readSource('src/player/hooks/usePlayerInventoryActions.js');
    const spellSelectorSource = readSource('src/player/modals/SpellScrollSelectorModal.jsx');
    const itemCatalogSource = readSource('src/player/ItemCatalog.jsx');
    const itemsLayoutSource = readSource('src/admin/items/ItemsViewLayout.jsx');

    assert.match(overlaySource, /mergeCatalogIndexWithOverrides/);
    assert.match(overlaySource, /items=\{mergeCatalogIndexWithOverrides\(state\.config\.items, db, mode\)\}/);
    assert.match(playerSource, /<LazyCatalogOverlay[\s\S]*mode="spell"[\s\S]*db=\{db\}/);
    assert.match(inventoryActionsSource, /Number\(item\.level\)/);
    assert.equal(inventoryActionsSource.includes('item.level && typeof item.level'), false);
    assert.match(spellSelectorSource, /mergeCatalogIndexWithOverrides\(SPELL_INDEX_ITEMS, db, 'spell'\)/);
    assert.match(itemsLayoutSource, /<SpellScrollSelectorModal[\s\S]*db=\{db\}/);
    assert.match(itemCatalogSource, /const hasLevel = item\.level !== undefined/);
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
    const contextSource = readSource('src/shared/context/CampaignContext.jsx');
    const runtimeDbSource = readSource('src/shared/db/v2/runtimeDb.js');
    const sessionSource = readSource('src/admin/views/SessionManager.jsx');

    assert.equal(source.includes('writeLegacyDbDiffToV2'), false);
    assert.equal(source.includes('composeLegacyDbFromV2Documents'), false);
    assert.equal(source.includes('composeLegacyProjectionForImport'), false);
    assert.equal(source.includes('legacyProjection'), false);
    assert.equal(source.includes('updateLegacyProjection'), false);
    assert.match(source, /v2Store/);
    assert.equal(appSource.includes('legacyProjection'), false);
    assert.equal(appSource.includes('importDb'), false);
    assert.equal(appSource.includes('legacyDb'), false);
    assert.match(appSource, /v2Store/);
    assert.equal(appSource.includes('setDb='), false);
    assert.equal(contextSource.includes('legacyUserInfo'), false);
    assert.equal(contextSource.includes('importDb'), false);
    assert.equal(sessionSource.includes('importDb'), false);
    assert.equal(sessionSource.includes('legacyCharacters'), false);
    assert.equal(runtimeDbSource.includes('db.quests ='), false);
    assert.equal(runtimeDbSource.includes('db.lootBags ='), false);
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

test('admin xp threshold writes use targeted campaign action', () => {
    const adminSource = readSource('src/admin/AdminTabContent.jsx');

    assert.match(adminSource, /setXpThreshold\(activeCampaign\.id, xpThreshold\)/);
    assert.equal(adminSource.includes('campaign.characters ='), false);
    assert.equal(adminSource.includes('campaign.updateCampaign(activeCampaign.id'), false);
});

test('migrated inventory screens use central item identity helpers', () => {
    const sources = [
        'src/shared/components/ActorSheetCard.jsx',
        'src/player/views/InventoryView.jsx',
        'src/player/hooks/usePlayerInventoryActions.js',
        'src/player/modals/ItemDetailModal.jsx',
        'src/admin/ItemsView.jsx',
        'src/admin/items/ItemsViewLayout.jsx',
    ];
    const forbiddenPatterns = [
        /inventory\.findIndex\(i\s*=>\s*i\.name\s*===/,
        /inventory\.findIndex\(i\s*=>[\s\S]{0,120}i\.name\s*===/,
        /inventory\.find\(i\s*=>\s*i\.name\s*===/,
        /inventory\.find\(i\s*=>[\s\S]{0,120}i\.name\s*===/,
        /c\.inventory\.findIndex\(i\s*=>[\s\S]{0,140}i\.name\s*===/,
        /c\.inventory\.find\(i\s*=>[\s\S]{0,140}i\.name\s*===/,
        /char\.inventory\.findIndex\(i\s*=>[\s\S]{0,140}i\.name\s*===/,
        /char\.inventory\.find\(i\s*=>[\s\S]{0,140}i\.name\s*===/,
    ];

    sources.forEach((path) => {
        const source = readSource(path);
        assert.match(source, /findInventoryItemIndex|resolveInventoryItemIdentity|getItemIdentityKey/);
        forbiddenPatterns.forEach((pattern) => {
            assert.equal(pattern.test(source), false, `${path} contains local item identity matching: ${pattern}`);
        });
    });

    assert.equal(readSource('src/admin/ItemsView.jsx').includes('i.instanceId || i.name'), false);
    assert.equal(readSource('src/admin/items/ItemsViewLayout.jsx').includes('i.instanceId || i.name'), false);
});

test('creature presentation uses shared reveal constants and encounter actor sheets use real callbacks', () => {
    const creatureCardSource = readSource('src/shared/components/CreatureCard.jsx');
    const bestiarySource = readSource('src/admin/BestiaryView.jsx');
    const loreSource = readSource('src/player/views/LoreView.jsx');
    const encounterPanelsSource = readSource('src/admin/encounter/EncounterPanels.jsx');
    const partySource = readSource('src/player/PartyScreen.jsx');
    const characterCardSource = readSource('src/admin/components/CharacterCard.jsx');

    assert.match(creatureCardSource, /normalizeCreatureRevealState/);
    assert.match(creatureCardSource, /onSkillClick/);
    assert.match(creatureCardSource, /buildCreatureSkillViewModel/);
    assert.match(bestiarySource, /buildBestiaryCreatureEntries/);
    assert.match(loreSource, /buildBestiaryCreatureEntries/);
    assert.equal(bestiarySource.includes('const DEFAULT_REVEAL_STATE'), false);
    assert.equal(creatureCardSource.includes('const DEFAULT_REVEAL_STATE'), false);
    assert.match(encounterPanelsSource, /ActorSheetCard/);
    assert.match(partySource, /ActorSheetCard/);
    assert.equal(encounterPanelsSource.includes('setModalMode={() =>'), false);
    assert.equal(encounterPanelsSource.includes('setModalData={() =>'), false);
    assert.match(characterCardSource, /ActorSheetCard/);
    assert.equal(characterCardSource.includes('StatsView'), false);
    assert.equal(characterCardSource.includes('InventoryView'), false);
    assert.equal(characterCardSource.includes('MagicView'), false);
});

test('encounter effect UI uses actor effects instead of prompt condition writes', () => {
    const encounterSource = readSource('src/admin/EncounterView.jsx');
    const dialogSource = readSource('src/admin/encounter/EncounterEffectDialogs.jsx');

    assert.equal(encounterSource.includes("prompt('Add condition"), false);
    assert.equal(encounterSource.includes('dataActions.encounter.addCondition'), false);
    assert.match(encounterSource, /effect\.createStandardCondition/);
    assert.match(encounterSource, /effect\.createPersistentDamage/);
    assert.match(encounterSource, /effect\.createCustomBadge/);
    assert.match(dialogSource, /@\/components\/ui\/dialog/);
    assert.match(dialogSource, /@\/components\/ui\/command/);
    assert.match(dialogSource, /Add Affliction/);
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

test('createDataActions delegates extracted domain action factories', () => {
    const actionSource = readSource('src/shared/db/domain/createDataActions.js');

    assert.match(actionSource, /createActionContext/);
    assert.match(actionSource, /createActorActions/);
    assert.match(actionSource, /createCampaignActions/);
    assert.match(actionSource, /createCharacterActions/);
    assert.match(actionSource, /createEffectActions/);
    assert.match(actionSource, /createMemberActions/);
    assert.match(actionSource, /createCatalogOverrideActions/);
    assert.match(actionSource, /actor: actorActions/);
    assert.match(actionSource, /campaign: campaignActions/);
    assert.match(actionSource, /character: characterActions/);
    assert.match(actionSource, /effect: effectActions/);
    assert.match(actionSource, /member: memberActions/);
    assert.match(actionSource, /catalogOverride: catalogOverrideActions/);
    assert.equal(actionSource.includes('const createEffect ='), false);
    assert.equal(actionSource.includes('const createActor ='), false);
    assert.equal(actionSource.includes('const createCampaign ='), false);
    assert.equal(actionSource.includes('const createCharacter ='), false);
    assert.equal(actionSource.includes('const assignUser ='), false);
    assert.equal(actionSource.includes('const saveCatalogOverride ='), false);
});
