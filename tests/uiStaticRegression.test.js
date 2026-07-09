import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const readSource = (path) => readFileSync(resolve(repoRoot, path), 'utf8');

function listSourceFiles(dir) {
    const absolute = resolve(repoRoot, dir);
    return readdirSync(absolute).flatMap((entry) => {
        const fullPath = resolve(absolute, entry);
        const relativePath = `${dir}/${entry}`.replaceAll('\\', '/');
        const stats = statSync(fullPath);
        if (stats.isDirectory()) return listSourceFiles(relativePath);
        return /\.(jsx?|tsx?)$/.test(entry) ? [relativePath] : [];
    });
}

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
    assert.match(source, /AdminTableToolbar/);
    assert.match(source, /filters=\{itemFilters\}/);
    assert.equal(source.includes('FilterBar'), false);
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
    const tableSource = readSource('src/admin/catalog/CatalogAdminTableView.jsx');
    const selectorSource = readSource('src/shared/db/selectors/catalogOverrideSelectors.js');

    assert.match(viewSource, /CatalogAdminTableView/);
    assert.match(viewSource, /getAllActionIndexItems/);
    assert.equal(viewSource.includes('Clone/Override'), false);
    assert.match(tableSource, /catalogOverride\.saveCatalogOverride/);
    assert.match(tableSource, /buildHideOverride/);
    assert.match(tableSource, /deleteCatalogOverride/);
    assert.match(tableSource, /copyRef/);
    assert.match(selectorSource, /actionToCatalogOverride/);
    assert.match(editorSource, /onSaveToDb/);
    assert.match(editorSource, /buildActionOverride/);
    assert.match(editorSource, /import\.meta\.env\.PROD/);
    assert.match(editorSource, /sourceFile: null/);
    assert.match(editorSource, /readJsonApiResponse\(res, 'Save action'\)/);
});

test('admin spells use catalog override fallback instead of deployed-only file writes', () => {
    const viewSource = readSource('src/admin/SpellsView.jsx');
    const editorSource = readSource('src/admin/editors/SpellEditor.jsx');
    const tableSource = readSource('src/admin/catalog/CatalogAdminTableView.jsx');

    assert.match(viewSource, /CatalogAdminTableView/);
    assert.match(viewSource, /spellJsonToEditorFormData/);
    assert.equal(viewSource.includes('Static spell files can only be edited'), false);
    assert.match(tableSource, /catalogOverride\.saveCatalogOverride/);
    assert.match(editorSource, /onSaveToDb/);
    assert.match(editorSource, /buildSpellOverride/);
    assert.match(editorSource, /catalogType = 'spell'/);
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
    const tableSource = readSource('src/admin/catalog/CatalogAdminTableView.jsx');

    assert.match(featViewSource, /CatalogAdminTableView/);
    assert.match(tableSource, /catalogOverride\.saveCatalogOverride/);
    assert.match(tableSource, /buildHideOverride/);
    assert.match(featEditorSource, /onSaveToDb/);
    assert.match(featEditorSource, /buildFeatOverride/);
    assert.match(featEditorSource, /readJsonApiResponse\(res, 'Save feat'\)/);
    assert.equal(featEditorSource.includes('Deployed feat overrides are not enabled yet'), false);

    assert.match(impulseViewSource, /CatalogAdminTableView/);
    assert.match(impulseEditorSource, /onSaveToDb/);
    assert.match(impulseEditorSource, /buildImpulseOverride/);
    assert.match(impulseEditorSource, /readJsonApiResponse\(res, 'Save impulse'\)/);
    assert.equal(impulseEditorSource.includes('Deployed impulse overrides are not enabled yet'), false);
});

test('admin item production editing skips file writes and uses database fallback', () => {
    const editorSource = readSource('src/admin/editors/ItemEditor.jsx');
    const layoutSource = readSource('src/admin/items/ItemsViewLayout.jsx');

    assert.match(editorSource, /dbOnly \|\| import\.meta\.env\.PROD/);
    assert.match(editorSource, /onSaveToDb/);
    assert.match(editorSource, /onSaveCatalogEntry/);
    assert.match(editorSource, /buildItemOverride/);
    assert.match(editorSource, /buildCatalogEditorOverride/);
    assert.match(editorSource, /readJsonApiResponse\(res, 'Save item'\)/);
    assert.match(layoutSource, /onSaveCatalogEntry/);
    assert.match(layoutSource, /catalogOverride\.saveCatalogOverride/);
});

test('catalog editors use the shared catalog editor save contract', () => {
    const sources = {
        ability: readSource('src/admin/AbilitiesView.jsx'),
        action: readSource('src/admin/editors/ActionEditor.jsx'),
        creature: readSource('src/admin/editors/CreatureEditor.jsx'),
        feat: readSource('src/admin/editors/FeatEditor.jsx'),
        impulse: readSource('src/admin/editors/ImpulseEditor.jsx'),
        item: readSource('src/admin/editors/ItemEditor.jsx'),
        spell: readSource('src/admin/editors/SpellEditor.jsx'),
    };

    Object.entries(sources).forEach(([name, source]) => {
        assert.match(source, /buildCatalogEditorOverride/, `${name} should delegate override creation to the shared contract`);
    });
    assert.match(sources.creature, /isStaticCatalogEdit/);
    assert.match(sources.creature, /onSaveCatalogEntry/);
    assert.match(readSource('src/admin/BestiaryView.jsx'), /onSaveCatalogEntry/);
});

test('catalog admin views keep legacy custom merges inside catalog selectors', () => {
    const adminFiles = listSourceFiles('src/admin');
    const allowed = new Set([
        'src/admin/catalog/CatalogAdminTableView.jsx',
        'src/admin/catalog/useCatalogAdminTable.js',
    ]);
    const forbiddenPatterns = [
        /db\??\.shop\??\.customItems/,
        /db\??\.bestiary\??\.customCreatures/,
        /db\??\.actions\b/,
        /db\??\.spells\b/,
        /db\??\.abilities\??\.custom/,
        /Object\.values\([^)]*customItems/,
        /Object\.values\([^)]*customCreatures/,
        /window\.location\.reload/,
        /Clone\/Override/,
    ];

    adminFiles
        .filter((file) => !allowed.has(file))
        .forEach((file) => {
            const source = readSource(file);
            forbiddenPatterns.forEach((pattern) => {
                assert.equal(pattern.test(source), false, `${file} should not reintroduce ${pattern}`);
            });
        });
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

test('player page cutover uses registry renderer instead of header mode switch', () => {
    const playerSource = readSource('src/player/PlayerAppController.jsx');
    const pageCarouselSource = readSource('src/player/navigation/PlayerPageCarousel.jsx');
    const rendererSource = readSource('src/player/navigation/PlayerPageRenderer.jsx');
    const hookSource = readSource('src/player/navigation/usePlayerPageNavigation.js');
    const bottomNavSource = readSource('src/player/navigation/PlayerBottomNav.jsx');
    const carouselSource = readSource('src/player/navigation/PlayerSubpageCarousel.jsx');
    const iconSource = readSource('src/player/navigation/playerNavIcons.js');
    const swipeSource = readSource('src/player/navigation/usePlayerSubpageSwipe.js');
    const swipeCoreSource = readSource('src/player/navigation/playerSubpageSwipe.js');

    assert.match(playerSource, /usePlayerPageNavigation/);
    assert.match(playerSource, /PlayerPageCarousel/);
    assert.match(pageCarouselSource, /PlayerPageRenderer/);
    assert.match(pageCarouselSource, /Carousel/);
    assert.match(playerSource, /PlayerDesktopNav/);
    assert.match(playerSource, /buildPlayerInteractionLockState/);
    assert.match(playerSource, /onDrawerOpenChange=\{setPlayerNavDrawerOpen\}/);
    assert.equal(playerSource.includes('player-mode-toggle'), false);
    assert.equal(playerSource.includes('usePlayerNavigation'), false);
    assert.equal(playerSource.includes('activeTab ==='), false);
    assert.equal(playerSource.includes('setAppMode'), false);
    assert.match(rendererSource, /PLAYER_PAGE_IDS\.CRAFTING/);
    assert.match(rendererSource, /PlayerPlaceholderPage/);
    assert.match(hookSource, /playerPage/);
    assert.match(hookSource, /playerTab/);
    assert.match(hookSource, /usePlayerSubpageSwipe/);
    assert.equal(bottomNavSource.includes('disabled={Boolean(page.future)}'), false);
    assert.match(bottomNavSource, /getPlayerNavIconSrc\(page\.icon\)/);
    assert.match(bottomNavSource, /onDrawerOpenChange/);
    assert.match(carouselSource, /CarouselContent/);
    assert.match(carouselSource, /loop: pages\.length > 1/);
    assert.match(carouselSource, /getPlayerNavIconSrc\(page\.icon\)/);
    assert.match(iconSource, /heart-beats/);
    assert.match(iconSource, /rolled-cloth/);
    assert.match(swipeSource, /hasBlockingPlayerOverlay/);
    assert.match(swipeCoreSource, /bottom-sheet-backdrop\.open/);
    assert.match(swipeCoreSource, /item-catalog-overlay/);
});

test('player popup host owns pact, notification, and xp popups', () => {
    const playerSource = readSource('src/player/PlayerAppController.jsx');
    const hostSource = readSource('src/player/popups/PlayerPopupHost.jsx');
    const queueSource = readSource('src/player/popups/playerPopupQueue.js');
    const ackSource = readSource('src/player/popups/popupAckStore.js');

    assert.match(playerSource, /PlayerPopupHost/);
    assert.equal(playerSource.includes("PactOfferModal from"), false);
    assert.equal(playerSource.includes("NotificationOverlay from"), false);
    assert.equal(playerSource.includes("XpOverlay from"), false);
    assert.doesNotMatch(playerSource, /<PactOfferModal\b/);
    assert.doesNotMatch(playerSource, /<NotificationOverlay\b/);
    assert.doesNotMatch(playerSource, /<XpOverlay\b/);
    assert.match(hostSource, /usePlayerPopupQueue/);
    assert.match(hostSource, /PactOfferModal/);
    assert.match(hostSource, /NotificationOverlay/);
    assert.match(hostSource, /XpOverlay/);
    assert.match(queueSource, /PLAYER_POPUP_PRIORITIES/);
    assert.match(ackSource, /pf2e-player-popup-acks/);
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
    const normalizerSource = readSource('src/shared/db/v2/normalizers.js');
    const legacyProjectionSource = readSource('src/shared/db/v2/legacyProjection.js');

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
    assert.equal(normalizerSource.includes('composeLegacyDbFromV2Documents'), false);
    assert.match(legacyProjectionSource, /LEGACY IMPORT\/BACKUP\/TEST ONLY/);
    assert.match(legacyProjectionSource, /composeLegacyDbFromV2Documents/);
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

test('legacy import hooks and projections stay out of runtime modules', () => {
    const runtimeSources = [
        'src/App.jsx',
        'src/main.jsx',
        'src/shared/context/CampaignContext.jsx',
        'src/shared/db/v2/useFirestoreV2Db.js',
        'src/shared/db/v2/runtimeDb.js',
        'src/shared/db/v2/viewModel.js',
        'src/admin/AdminApp.jsx',
        'src/player/PlayerAppController.jsx',
        'src/player/PartyScreen.jsx',
        'src/camping/CampScreen.jsx',
    ];

    runtimeSources.forEach((path) => {
        const source = readSource(path);
        assert.equal(source.includes('legacy-import'), false, `${path} should not import legacy import helpers`);
        assert.equal(source.includes('usePersistedDb'), false, `${path} should not import legacy persisted DB`);
        assert.equal(source.includes('composeLegacyDbFromV2Documents'), false, `${path} should not import legacy projection`);
        assert.equal(source.includes('writeLegacyDbDiffToV2'), false, `${path} should not broad-diff legacy DB`);
    });

    assert.match(readSource('src/admin/FirebaseMigrator.jsx'), /legacy-import\/usePersistedDb/);
    assert.match(readSource('src/shared/db/legacy-import/usePersistedDb.js'), /LEGACY IMPORT\/BACKUP ONLY/);
    assert.match(readSource('src/shared/db/legacy-import/migrateDb.js'), /LEGACY IMPORT\/BACKUP ONLY/);
});

test('runtime views do not reintroduce root compatibility read fallbacks', () => {
    const runtimeSources = [
        'src/App.jsx',
        'src/admin/AdminApp.jsx',
        'src/admin/AdminTabContent.jsx',
        'src/admin/ItemsView.jsx',
        'src/admin/items/ItemsViewLayout.jsx',
        'src/admin/QuestsView.jsx',
        'src/admin/EncounterView.jsx',
        'src/admin/MapAdminView.jsx',
        'src/admin/ProgressAdminView.jsx',
        'src/admin/BestiaryView.jsx',
        'src/admin/LoreAdminView.jsx',
        'src/player/PlayerAppController.jsx',
        'src/player/PartyScreen.jsx',
        'src/player/views/InventoryView.jsx',
        'src/player/views/LoreView.jsx',
        'src/player/views/StatsView.jsx',
        'src/camping/CampScreen.jsx',
    ];
    const forbidden = [
        /db\.characters/,
        /db\.quests/,
        /db\.lootBags/,
        /activeCampaign\?\.quests\s*\|\|/,
        /activeCampaign\?\.lootBags\s*\|\|/,
        /campaign\.characters/,
        /activeCampaign\.characters/,
        /legacyProjection/,
        /legacy-import/,
    ];

    runtimeSources.forEach((path) => {
        const source = readSource(path);
        forbidden.forEach((pattern) => {
            assert.equal(pattern.test(source), false, `${path} reintroduced compatibility read fallback: ${pattern}`);
        });
    });
});

test('v2 normalizers remain focused and legacy projection is isolated', () => {
    const normalizerSource = readSource('src/shared/db/v2/normalizers.js');
    const projectionSource = readSource('src/shared/db/v2/legacyProjection.js');

    assert.ok(normalizerSource.split('\n').length < 700);
    assert.equal(normalizerSource.includes('actorToLegacyCharacter'), false);
    assert.equal(normalizerSource.includes('composeLegacyDbFromV2Documents'), false);
    assert.match(projectionSource, /actorToLegacyCharacter/);
    assert.match(projectionSource, /V2_COLLECTIONS\.characters/);
});

test('createDataActions delegates extracted domain action factories', () => {
    const actionSource = readSource('src/shared/db/domain/createDataActions.js');

    assert.match(actionSource, /createActionContext/);
    assert.match(actionSource, /createActorActions/);
    assert.match(actionSource, /createCampaignActions/);
    assert.match(actionSource, /createCampingActions/);
    assert.match(actionSource, /createCharacterActions/);
    assert.match(actionSource, /createEffectActions/);
    assert.match(actionSource, /createEncounterActions/);
    assert.match(actionSource, /createGlobalContentActions/);
    assert.match(actionSource, /createInventoryActions/);
    assert.match(actionSource, /createLootActions/);
    assert.match(actionSource, /createMapActions/);
    assert.match(actionSource, /createMemberActions/);
    assert.match(actionSource, /createProgressActions/);
    assert.match(actionSource, /createQuestActions/);
    assert.match(actionSource, /createCatalogOverrideActions/);
    assert.match(actionSource, /actor: actorActions/);
    assert.match(actionSource, /campaign: campaignActions/);
    assert.match(actionSource, /camping: campingActions/);
    assert.match(actionSource, /character: characterActions/);
    assert.match(actionSource, /encounter: encounterActions/);
    assert.match(actionSource, /effect: effectActions/);
    assert.match(actionSource, /inventory: inventoryActions/);
    assert.match(actionSource, /loot: lootActions/);
    assert.match(actionSource, /map: mapActions/);
    assert.match(actionSource, /member: memberActions/);
    assert.match(actionSource, /progress: progressActions/);
    assert.match(actionSource, /quest: questActions/);
    assert.match(actionSource, /catalogOverride: catalogOverrideActions/);
    assert.equal(actionSource.includes('const createEffect ='), false);
    assert.equal(actionSource.includes('const createActor ='), false);
    assert.equal(actionSource.includes('const createCampaign ='), false);
    assert.equal(actionSource.includes('const createCharacter ='), false);
    assert.equal(actionSource.includes('const createLootBag ='), false);
    assert.equal(actionSource.includes('const createQuest ='), false);
    assert.equal(actionSource.includes('const createEncounter ='), false);
    assert.equal(actionSource.includes('const createMap ='), false);
    assert.equal(actionSource.includes('const updateProgress ='), false);
    assert.equal(actionSource.includes('const updateCamping ='), false);
    assert.equal(actionSource.includes('const assignUser ='), false);
    assert.equal(actionSource.includes('const saveCatalogOverride ='), false);
    assert.ok(actionSource.split('\n').length < 120);
});

test('catalog details and item rows use shared reusable controllers', () => {
    const adminSource = readSource('src/admin/AdminApp.jsx');
    const playerCatalogSource = readSource('src/player/hooks/usePlayerCatalogInspection.js');
    const inventorySource = readSource('src/player/views/InventoryView.jsx');
    const shopSource = readSource('src/player/ShopView.jsx');
    const itemsLayoutSource = readSource('src/admin/items/ItemsViewLayout.jsx');
    const detailControllerSource = readSource('src/shared/hooks/useCatalogDetailController.js');
    const catalogTableSource = readSource('src/admin/catalog/CatalogAdminTableView.jsx');
    const itemEditorSource = readSource('src/admin/editors/ItemEditor.jsx');

    assert.match(adminSource, /useCatalogDetailController/);
    assert.match(playerCatalogSource, /useCatalogDetailController/);
    assert.match(detailControllerSource, /mergeCatalogDetailIntoEntry/);
    assert.match(catalogTableSource, /mergeCatalogDetailIntoEntry/);
    assert.match(catalogTableSource, /DEFAULT_DETAIL_SOURCE_FILE/);
    assert.match(catalogTableSource, /previewSourceFile/);
    assert.match(catalogTableSource, /isLoading=\{detailLoading\}/);
    assert.doesNotMatch(catalogTableSource, /\[catalogType, detailSourceFile, fetchDetailBySourceFile, previewItem\]/);
    assert.equal(adminSource.includes('fetchShopItemDetailBySourceFile'), false);
    assert.equal(playerCatalogSource.includes('fetchShopItemDetailBySourceFile'), false);
    assert.match(itemEditorSource, /fetchShopItemDetailBySourceFile/);
    assert.match(itemEditorSource, /mergeCatalogDetailIntoEntry/);
    assert.match(itemEditorSource, /buildItemEditorFormData\(merged\)/);
    assert.match(inventorySource, /ItemRow/);
    assert.match(shopSource, /ItemRow/);
    assert.match(itemsLayoutSource, /ItemRow/);
});

test('creature and deviant ability admin surfaces keep catalog and pact semantics separate', () => {
    const bestiarySource = readSource('src/admin/BestiaryView.jsx');
    const creatureEditorSource = readSource('src/admin/editors/CreatureEditor.jsx');
    const deviantSource = readSource('src/pacts/DeviantAbilitiesAdminView.jsx');

    assert.match(bestiarySource, /mergeCreatureDetailIntoEntry/);
    assert.match(creatureEditorSource, /mergeCreatureDetailIntoEntry/);
    assert.match(bestiarySource, /updateCreatureMetadata/);
    assert.match(bestiarySource, /catalogOverride\.saveCatalogOverride/);
    assert.match(deviantSource, /saveDeviantAbility/);
    assert.match(deviantSource, /deleteDeviantAbility/);
    assert.match(deviantSource, /buildDeviantAbilityClone/);
    assert.match(deviantSource, /copyRef\('deviantAbility'/);
    assert.match(deviantSource, />Edit</);
    assert.match(deviantSource, />Clone</);
    assert.match(deviantSource, />Delete</);
    assert.match(deviantSource, />Copy Reference</);
});

test('gm catalog tables use shared admin table UI primitives', () => {
    const catalogTableSource = readSource('src/admin/catalog/CatalogAdminTableView.jsx');
    const itemsLayoutSource = readSource('src/admin/items/ItemsViewLayout.jsx');
    const bestiarySource = readSource('src/admin/BestiaryView.jsx');
    const abilitiesSource = readSource('src/admin/AbilitiesView.jsx');
    const deviantSource = readSource('src/pacts/DeviantAbilitiesAdminView.jsx');
    const toolbarSource = readSource('src/admin/components/table/AdminTableToolbar.jsx');
    const columnMenuSource = readSource('src/admin/components/table/AdminColumnMenu.jsx');
    const paginationSource = readSource('src/admin/components/table/AdminPagination.jsx');
    const filterDrawerSource = readSource('src/admin/components/table/AdminFilterDrawer.jsx');
    const contextMenuSource = readSource('src/admin/components/table/AdminContextMenu.jsx');

    [catalogTableSource, bestiarySource, abilitiesSource, deviantSource].forEach((source) => {
        assert.match(source, /AdminTableToolbar/);
        assert.match(source, /AdminTableSurface/);
    });
    assert.match(itemsLayoutSource, /AdminTableToolbar/);
    assert.match(itemsLayoutSource, /AdminPagination/);

    [catalogTableSource, bestiarySource, abilitiesSource, deviantSource].forEach((source) => {
        assert.equal(source.includes('FilterBar'), false);
        assert.equal(source.includes('<table'), false);
        assert.equal(source.includes("position: 'fixed', top:"), false);
        assert.equal(source.includes('Desktop context menu'), false);
    });

    assert.match(toolbarSource, /AdminActiveFilterChips/);
    assert.match(toolbarSource, /countActiveFilters/);
    assert.equal(toolbarSource.includes('min-h-[4.5rem]'), false);
    assert.match(filterDrawerSource, /DrawerContent/);
    assert.match(filterDrawerSource, /bg-card/);
    assert.match(filterDrawerSource, /modal=\{false\}/);
    assert.match(filterDrawerSource, /noBodyStyles/);
    assert.match(filterDrawerSource, /shouldScaleBackground=\{false\}/);
    assert.equal(filterDrawerSource.includes('bg-sidebar'), false);
    assert.match(filterDrawerSource, /md:grid-cols-\[minmax\(13rem,1fr\)_minmax\(0,2fr\)\]/);
    assert.match(columnMenuSource, /DropdownMenu modal=\{false\}/);
    assert.match(columnMenuSource, /zoom-in-100/);
    assert.match(columnMenuSource, /zoom-out-100/);
    assert.match(paginationSource, /ChevronsLeft/);
    assert.match(paginationSource, /ChevronsRight/);
    assert.match(paginationSource, /PaginationEllipsis/);
    assert.equal(catalogTableSource.includes('className="admin-layout'), false);
    assert.match(contextMenuSource, /ContextMenu modal=\{false\}/);
    assert.match(contextMenuSource, /zoom-in-100/);
    assert.match(contextMenuSource, /zoom-out-100/);
});

test('runtime feedback and debug logging use shared helpers in migrated surfaces', () => {
    const mainSource = readSource('src/main.jsx');
    const contextSource = readSource('src/shared/context/CampaignContext.jsx');
    const defensesSource = readSource('src/player/sections/DefensesSection.jsx');
    const actorSheetSource = readSource('src/shared/components/ActorSheetCard.jsx');
    const debugLogSource = readSource('src/shared/utils/debugLog.js');

    assert.match(mainSource, /AppFeedbackProvider/);
    assert.match(contextSource, /useAppFeedback/);
    assert.match(contextSource, /notifyError\(err\)/);
    assert.equal(contextSource.includes('alert(err?.message'), false);
    assert.match(defensesSource, /debugLog\(/);
    assert.equal(defensesSource.includes('console.log('), false);
    assert.equal(actorSheetSource.includes('console.log('), false);
    assert.match(debugLogSource, /import\.meta\.env\.DEV/);
});

test('player blocking overlays register with the modal layer', () => {
    const mainSource = readSource('src/main.jsx');
    const modalLayerSource = readSource('src/shared/overlays/ModalLayerProvider.jsx');
    const overlaySurfaceSource = readSource('src/shared/overlays/OverlaySurface.jsx');
    const modalManagerSource = readSource('src/player/ModalManager.jsx');
    const itemActionsSource = readSource('src/player/ItemActionsModal.jsx');
    const itemDetailSource = readSource('src/player/modals/ItemDetailModal.jsx');
    const spellSelectorSource = readSource('src/player/modals/SpellScrollSelectorModal.jsx');
    const pactOfferSource = readSource('src/pacts/PactOfferModal.jsx');
    const feedbackSource = readSource('src/shared/feedback/AppFeedback.jsx');
    const bottomSheetSource = readSource('src/shared/components/BottomSheet.jsx');
    const catalogOverlaySource = readSource('src/player/components/LazyCatalogOverlay.jsx');
    const itemCatalogSource = readSource('src/player/ItemCatalog.jsx');
    const notificationSource = readSource('src/player/components/NotificationOverlay.jsx');
    const xpSource = readSource('src/player/components/XpOverlay.jsx');
    const conditionsSource = readSource('src/player/modals/ConditionsModal.jsx');
    const swipeSource = readSource('src/player/navigation/playerSubpageSwipe.js');

    assert.match(mainSource, /ModalLayerProvider/);
    assert.match(modalLayerSource, /registerModal/);
    assert.match(modalLayerSource, /modalLayerGesturesSuspended/);
    assert.match(overlaySurfaceSource, /modal-layer-scroll-body/);
    assert.match(modalManagerSource, /ModalLayerMount/);
    assert.match(itemActionsSource, /ModalLayerMount/);
    assert.match(itemDetailSource, /ModalLayerMount/);
    assert.match(spellSelectorSource, /ModalLayerMount/);
    assert.match(pactOfferSource, /ModalLayerMount/);
    assert.match(feedbackSource, /OverlaySurface/);
    assert.match(bottomSheetSource, /ModalLayerMount/);
    assert.match(catalogOverlaySource, /ModalLayerMount/);
    assert.match(itemCatalogSource, /data-player-interaction-lock/);
    assert.match(notificationSource, /ModalLayerMount/);
    assert.match(notificationSource, /suspendPageGestures: true/);
    assert.match(xpSource, /ModalLayerMount/);
    assert.match(xpSource, /suspendPageGestures: true/);
    assert.match(swipeSource, /modalLayerGesturesSuspended/);
    assert.equal(conditionsSource.includes('body.style.position'), false);
    assert.equal(conditionsSource.includes("body.style.overflow = 'hidden'"), false);
});

test('runtime source does not use native browser dialogs', () => {
    const forbidden = [
        /window\.confirm/,
        /window\.prompt/,
        /window\.alert/,
        /\balert\(/,
    ];

    listSourceFiles('src').forEach((path) => {
        const source = readSource(path);
        forbidden.forEach((pattern) => {
            assert.equal(pattern.test(source), false, `${path} uses native browser dialog: ${pattern}`);
        });
    });

    const feedbackSource = readSource('src/shared/feedback/AppFeedback.jsx');
    const overlaySurfaceSource = readSource('src/shared/overlays/OverlaySurface.jsx');
    assert.match(feedbackSource, /confirm: async/);
    assert.match(feedbackSource, /prompt: async/);
    assert.match(feedbackSource, /OverlaySurface/);
    assert.match(overlaySurfaceSource, /role = 'dialog'/);
    assert.match(overlaySurfaceSource, /role=\{role\}/);
});

test('console log output is dev-gated through debugLog helper', () => {
    listSourceFiles('src').forEach((path) => {
        const source = readSource(path);
        if (path === 'src/shared/utils/debugLog.js') {
            assert.match(source, /import\.meta\.env\.DEV/);
            assert.match(source, /console\.log/);
            return;
        }
        assert.equal(source.includes('console.log'), false, `${path} should use debugLog instead of console.log`);
    });

    assert.match(readSource('src/shared/db/legacy-import/usePersistedDb.js'), /debugLog/);
    assert.match(readSource('src/shared/db/legacy-import/migrateDb.js'), /debugLog/);
});
