import ShopView from '../ShopView';
import { StatsView } from '../views/StatsView';
import { ActionsView } from '../views/ActionsView';
import { InventoryView } from '../views/InventoryView';
import { MagicView } from '../views/MagicView';
import { FeatsView } from '../views/FeatsView';
import { ImpulsesView } from '../views/ImpulsesView';
import PlayerQuestsView from '../views/PlayerQuestsView';
import LoreView from '../views/LoreView';
import CompanionTab from '../views/CompanionTab';
import MapsView from '../views/MapsView';
import ProgressView from '../views/ProgressView';
import CampScreen from '../../camping/CampScreen';
import PactView from '../../pacts/PactView';
import DeviantView from '../../pacts/DeviantView';
import PlayerPlaceholderPage from './PlayerPlaceholderPage';
import PlayerKnowledgeNotesOverview from '../lore/PlayerKnowledgeNotesOverview.jsx';
import { PLAYER_PAGE_IDS } from './playerPageRegistry';

const ACTION_TAB_BY_PAGE = {
    [PLAYER_PAGE_IDS.COMBAT]: 'Combat',
    [PLAYER_PAGE_IDS.MOVEMENT]: 'Movement',
    [PLAYER_PAGE_IDS.GENERAL]: 'Skills',
    [PLAYER_PAGE_IDS.DOWNTIME]: 'Downtime',
    [PLAYER_PAGE_IDS.CAMPING_SKILLS]: 'Camping',
};

const INVENTORY_TAB_BY_PAGE = {
    [PLAYER_PAGE_IDS.EQUIPMENT]: 'Equipment',
    [PLAYER_PAGE_IDS.CONSUMABLES]: 'Consumables',
    [PLAYER_PAGE_IDS.MISC]: 'Misc',
    [PLAYER_PAGE_IDS.LOOT]: 'Loot',
};

const LORE_CATEGORY_BY_PAGE = {
    [PLAYER_PAGE_IDS.HISTORY]: 'History',
    [PLAYER_PAGE_IDS.LOCATIONS]: 'Locations',
    [PLAYER_PAGE_IDS.NPCS]: 'NPCs',
    [PLAYER_PAGE_IDS.BESTIARY]: 'Bestiary',
    [PLAYER_PAGE_IDS.OTHER]: 'Other',
};

export default function PlayerPageRenderer({
    activePageId,
    isPageActive = true,
    activeCampaign,
    actorRules,
    character,
    characterActions,
    characterConditions,
    characterEffects,
    capabilities,
    canEditCatalogEntry,
    dataActions,
    db,
    fireWeapon,
    handleBuyFormula,
    handleConsumeItem,
    handleLongPress,
    inspectInventoryItem,
    loadWeapon,
    myActor,
    loreStore,
    loreTarget,
    onNavigateLoreArticle,
    onNavigateLoreCreature,
    onGoToPage,
    onAuthorCatalogEntry,
    onEditCatalogEntry,
    ownedCompanionActors,
    playerQuests,
    readOnly = false,
    rulesCharacter,
    runDataAction,
    setActionModal,
    setCatalogMode,
    setModalData,
    setModalMode,
    toggleInventoryEquipped,
    updateCharacter,
    userSettings,
    onChangeSkillSort,
}) {
    if (activePageId === PLAYER_PAGE_IDS.STATUS) {
        return (
            <StatsView
                character={rulesCharacter}
                campaign={activeCampaign}
                rulesViewModel={actorRules}
                conditions={characterConditions}
                displayEffects={characterEffects}
                characterActions={characterActions}
                onOpenModal={(mode, data) => {
                    setModalData(data ?? null);
                    setModalMode(mode);
                }}
                onLongPress={handleLongPress}
                onRemoveEffect={(effect) => {
                    if (readOnly || !activeCampaign?.id || !effect?.id) return Promise.resolve();
                    return runDataAction(dataActions.effect.deleteEffect(activeCampaign.id, effect.id));
                }}
                readOnly={readOnly}
                userSettings={userSettings}
                onChangeSkillSort={onChangeSkillSort}
            />
        );
    }

    if (activePageId === PLAYER_PAGE_IDS.FEATS) {
        return (
            <FeatsView
                character={rulesCharacter}
                setModalData={setModalData}
                setModalMode={setModalMode}
                setCatalogMode={setCatalogMode}
                onLongPress={handleLongPress}
                readOnly={readOnly}
                canAuthorCatalog={Boolean(capabilities?.canCreatePlayerContent)}
                onAuthorCatalogEntry={onAuthorCatalogEntry}
                canEditCatalogEntry={canEditCatalogEntry}
                onEditCatalogEntry={onEditCatalogEntry}
            />
        );
    }

    if (activePageId === PLAYER_PAGE_IDS.MAGIC) {
        return (
            <MagicView
                character={rulesCharacter}
                characterActions={characterActions}
                setModalData={setModalData}
                setModalMode={setModalMode}
                setCatalogMode={setCatalogMode}
                onLongPress={handleLongPress}
                readOnly={readOnly}
                canAuthorCatalog={Boolean(capabilities?.canCreatePlayerContent)}
                onAuthorCatalogEntry={onAuthorCatalogEntry}
                canEditCatalogEntry={canEditCatalogEntry}
                onEditCatalogEntry={onEditCatalogEntry}
            />
        );
    }

    if (activePageId === PLAYER_PAGE_IDS.IMPULSES) {
        return (
            <ImpulsesView
                character={rulesCharacter}
                setModalData={setModalData}
                setModalMode={setModalMode}
                setCatalogMode={setCatalogMode}
                onLongPress={handleLongPress}
                readOnly={readOnly}
                canAuthorCatalog={Boolean(capabilities?.canCreatePlayerContent)}
                onAuthorCatalogEntry={onAuthorCatalogEntry}
                canEditCatalogEntry={canEditCatalogEntry}
                onEditCatalogEntry={onEditCatalogEntry}
            />
        );
    }

    if (activePageId === PLAYER_PAGE_IDS.DEVIANT) {
        return <DeviantView character={rulesCharacter} db={db} readOnly={readOnly} />;
    }

    if (activePageId === PLAYER_PAGE_IDS.PACT) {
        return <PactView character={character} db={db} readOnly={readOnly} />;
    }

    if (activePageId === PLAYER_PAGE_IDS.COMPANION) {
        return (
            <CompanionTab
                character={character}
                ownerActor={myActor}
                companionActors={ownedCompanionActors}
                dataActions={dataActions}
                activeCampaignId={activeCampaign?.id}
                readOnly={readOnly}
            />
        );
    }

    if (activePageId === PLAYER_PAGE_IDS.PROFICIENCIES) {
        return (
            <PlayerPlaceholderPage
                title="Proficiencies"
                description="A dedicated overview for weapon, armor, spell, impulse, and skill proficiencies will live here."
            />
        );
    }

    if (ACTION_TAB_BY_PAGE[activePageId]) {
        return (
            <ActionsView
                character={rulesCharacter}
                initialTab={ACTION_TAB_BY_PAGE[activePageId]}
                hideTabs={true}
                onOpenModal={(mode, data) => {
                    setModalMode(mode);
                    setModalData(data);
                }}
                onLongPress={(item, type) => handleLongPress(item, type)}
                readOnly={readOnly}
                canAuthorCatalog={Boolean(capabilities?.canCreatePlayerContent)}
                onAuthorCatalogEntry={onAuthorCatalogEntry}
                setCatalogMode={setCatalogMode}
                canEditCatalogEntry={canEditCatalogEntry}
                onEditCatalogEntry={onEditCatalogEntry}
            />
        );
    }

    if (activePageId === PLAYER_PAGE_IDS.EXPLORATION) {
        return (
            <PlayerPlaceholderPage
                title="Exploration"
                description="Exploration activities will be separated from the general action list in a later pass."
            />
        );
    }

    if (INVENTORY_TAB_BY_PAGE[activePageId]) {
        return (
            <InventoryView
                character={character}
                db={db}
                initialSubTab={INVENTORY_TAB_BY_PAGE[activePageId]}
                hideTabs={true}
                onUpdateCharacter={updateCharacter}
                onAuthorCatalogEntry={onAuthorCatalogEntry}
                canAuthorCatalog={Boolean(capabilities?.canCreatePlayerContent)}
                canEditCatalogEntry={canEditCatalogEntry}
                onEditCatalogEntry={onEditCatalogEntry}
                onOpenModal={(mode, data) => {
                    setModalMode(mode);
                    setModalData(data);
                }}
                onInspectItem={inspectInventoryItem}
                onConsumeItem={handleConsumeItem}
                onToggleEquip={toggleInventoryEquipped}
                onFireWeapon={fireWeapon}
                onLoadWeapon={loadWeapon}
                onLongPress={handleLongPress}
                onClaimLoot={(bag, item) => {
                    if (!activeCampaign?.id || !character?.id) return;
                    runDataAction(dataActions.loot.claimItem(activeCampaign.id, bag.id, item, character.id));
                }}
                onClaimGold={(bagId, amount) => {
                    if (!activeCampaign?.id || !character?.id) return;
                    runDataAction(dataActions.loot.claimGold(activeCampaign.id, bagId, character.id, amount));
                }}
                onSplitGold={(bagId) => {
                    if (!activeCampaign?.id) return;
                    runDataAction(dataActions.loot.splitGold(activeCampaign.id, bagId));
                }}
                onOpenShop={() => onGoToPage(PLAYER_PAGE_IDS.SHOP)}
                readOnly={readOnly}
            />
        );
    }

    if (activePageId === PLAYER_PAGE_IDS.SHOP) {
        return (
            <ShopView
                db={db}
                onInspectItem={(item) => {
                    setModalData(item);
                    setModalMode('catalog_detail');
                }}
                onBuyItem={(item) => {
                    if (readOnly) return;
                    const scrollMatch = item.name.match(/(?:Scroll of Rank (\d+)|Scroll of (\d+)(?:st|nd|rd|th)?-rank Spell)/i);
                    const wandMatch = item.name.match(/(?:Wand of Rank (\d+)|Magic Wand \((\d+)(?:st|nd|rd|th)?-Rank Spell\))/i);

                    if (scrollMatch) {
                        setActionModal({ mode: 'SELECT_SPELL', rank: parseInt(scrollMatch[1] || scrollMatch[2]), type: 'scroll', baseItem: item });
                    } else if (wandMatch) {
                        setActionModal({ mode: 'SELECT_SPELL', rank: parseInt(wandMatch[1] || wandMatch[2]), type: 'wand', baseItem: item });
                    } else {
                        setActionModal({ mode: 'BUY_RESTOCK', item });
                    }
                }}
                onBuyFormula={readOnly ? undefined : handleBuyFormula}
                knownFormulas={character.formulaBook || []}
            />
        );
    }

    if (activePageId === PLAYER_PAGE_IDS.CRAFTING) {
        return (
            <PlayerPlaceholderPage
                title="Crafting"
                description="Crafting workflows will be split out from inventory and formula handling in a later pass."
            />
        );
    }

    if (LORE_CATEGORY_BY_PAGE[activePageId]) {
        return (
            <LoreView
                db={db}
                initialCategory={LORE_CATEGORY_BY_PAGE[activePageId]}
                loreStore={loreStore}
                campaignId={activeCampaign?.id}
                actorId={myActor?.id || character?.id}
                dataActions={dataActions}
                actors={activeCampaign?.actors || []}
                initialArticleId={loreTarget?.articleId || null}
                initialCreatureId={loreTarget?.creatureId || null}
                onNavigateArticle={onNavigateLoreArticle}
                onNavigateCreature={onNavigateLoreCreature}
                contributions={activeCampaign?.loreContributions || []}
                canAuthorContributions={Boolean(capabilities?.canAuthorCampaignContent)}
                readOnly={readOnly}
            />
        );
    }

    if (activePageId === PLAYER_PAGE_IDS.NOTES) {
        return (
            <PlayerKnowledgeNotesOverview
                active={isPageActive}
                db={db}
                loreStore={loreStore}
                campaignId={activeCampaign?.id}
                actorId={myActor?.id || character?.id}
                dataActions={dataActions}
                actors={activeCampaign?.actors || []}
                onNavigateArticle={onNavigateLoreArticle}
                onNavigateCreature={onNavigateLoreCreature}
                readOnly={readOnly}
            />
        );
    }

    if (activePageId === PLAYER_PAGE_IDS.QUESTS) {
        return <PlayerQuestsView quests={playerQuests} />;
    }

    if (activePageId === PLAYER_PAGE_IDS.PROGRESS) {
        return <ProgressView />;
    }

    if (activePageId === PLAYER_PAGE_IDS.MAPS) {
        return <MapsView />;
    }

    if (activePageId === PLAYER_PAGE_IDS.CAMP) {
        return <CampScreen />;
    }

    return <PlayerPlaceholderPage title="Player page" />;
}
