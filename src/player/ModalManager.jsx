import React from 'react';
import { ModalLayerMount } from '../shared/overlays/ModalLayerProvider';

// Previously Extracted Modals
import { ConditionsModal } from './modals/ConditionsModal';
import { FormulaBookModal } from './modals/FormulaBookModal';
import { ItemDetailModal } from './modals/ItemDetailModal';
import { StatBreakdownModal } from './modals/StatBreakdownModal';

// Newly Grouped Modals
import {
    EditGoldModal, EditLevelModal, EditHPModal, EditSpeedModal,
    EditAttributeModal, EditProficiencyModal, EditArmorProficiencyModal,
    EditLanguagesModal, EditItemProficienciesModal, EditPerceptionModal,
    ManageHPModal, AddActionModal, ContextModal, AddLoreModal
} from './modals/SimpleModals';

import { ACModal, ShieldModal } from './modals/ACModals';

import {
    EditSpellProficiencyModal, EditSpellSlotsModal, SpellStatInfoModal
} from './modals/MagicModals';

// Existing Legacy Modals (assuming they are in same folder or simple components)
import QuickSheetModal from './QuickSheetModal';
import UserSettingsDialog from './modals/UserSettingsDialog';

// Helper for shop items in ItemDetailModal logic
import { getShopIndexItemByName } from '../shared/catalog/shopIndex';

/**
 * Manages the rendering of various modals based on modalMode.
 */
/**
 * Manages the rendering of various modals based on modalMode.
 * @param {Object} props
 * @param {string|null} props.modalMode - The current modal mode.
 * @param {Function} props.setModalMode - Function to set the modal mode.
 * @param {Object|null} props.modalData - Data associated with the current modal.
 * @param {Function} props.setModalData - Function to set the modal data.
 * @param {Object} props.character - The character object.
 * @param {Function} props.updateCharacter - Function to update the character.
 * @param {Object} props.characterActions - Targeted character edit actions.
 * @param {Function} props.onClose - Callback to close the modal.
 * @param {Function} props.onBack - Callback for back navigation.
 * @param {boolean} props.hasHistory - Whether there is modal history.
 * @param {Function} props.onContentLinkClick - Handler for content links.
 * @param {Array} props.dailyPrepQueue - Queue for daily preparation.
 * @param {Function} props.setDailyPrepQueue - Setter for prep queue.
 * @param {Function} props.toggleInventoryEquipped - Callback to toggle inventory equip.
 * @param {boolean} props.isLoadingShopDetail - Loading state for shop details.
 * @param {Object|null} props.shopDetailError - Error state for shop details.
 * @param {Function} props.toggleBloodmagic - Callback to toggle bloodmagic.
 * @param {Function} props.removeFromCharacter - Callback to remove item from character.
 * @param {Function} props.saveNewAction - Callback to save a new action.
 * @returns {JSX.Element|null}
 */
export function ModalManager(props) {
    const { modalMode } = props;
    if (!modalMode) return null;

    if (modalMode === 'catalog_detail') return <ModalManagerContent {...props} />;

    return (
        <ModalLayerMount id={`player-modal-${modalMode}`}>
            <ModalManagerContent {...props} />
        </ModalLayerMount>
    );
}

function ModalManagerContent({
    modalMode,
    setModalMode,
    modalData,
    setModalData,
    character,
    conditions,
    effects,
    readOnly,
    updateCharacter,
    characterActions,
    onClose,
    onBack,
    hasHistory,
    onContentLinkClick,

    // Feature specific props
    dailyPrepQueue,
    setDailyPrepQueue,
    toggleInventoryEquipped,
    isLoadingShopDetail,
    shopDetailError,

    // Callbacks
    toggleBloodmagic,
    removeFromCharacter,
    saveNewAction,
    onDailyPrep,
    userSettings,
    onSaveUserSettings
}) {

    // --- SIMPLE EDIT MODALS ---

    if (modalMode === 'hp') {
        return <ManageHPModal character={character} characterActions={characterActions} onClose={onClose} />;
    }
    if (modalMode === 'addAction') {
        return <AddActionModal onSave={saveNewAction} onClose={onClose} />;
    }
    if (modalMode === 'context') {
        return (
            <ContextModal
                character={character}
                modalData={modalData}
                updateCharacter={updateCharacter}
                onClose={onClose}
                setModalMode={setModalMode}
                toggleBloodmagic={toggleBloodmagic}
                removeFromCharacter={removeFromCharacter}
                onDailyPrep={onDailyPrep}
            />
        );
    }

    if (modalMode === 'user_settings') {
        return (
            <UserSettingsDialog
                open
                settings={userSettings}
                onSave={onSaveUserSettings}
                onClose={onClose}
            />
        );
    }

    if (modalMode === 'add_lore') {
        return <AddLoreModal character={character} updateCharacter={updateCharacter} onClose={onClose} />;
    }

    if (modalMode === 'gold') {
        return <EditGoldModal character={character} characterActions={characterActions} onClose={onClose} />;
    }
    if (modalMode === 'edit_level' || modalMode === 'level') { // Handle both just in case
        return <EditLevelModal character={character} updateCharacter={updateCharacter} onClose={onClose} />;
    }
    if (modalMode === 'edit_max_hp' || modalMode === 'hp') {
        return <EditHPModal character={character} characterActions={characterActions} onClose={onClose} />;
    }
    if (modalMode === 'edit_speed') {
        return <EditSpeedModal character={character} characterActions={characterActions} onClose={onClose} />;
    }
    if (modalMode === 'edit_attribute') {
        return <EditAttributeModal character={character} characterActions={characterActions} onClose={onClose} modalData={modalData} />;
    }
    if (modalMode === 'edit_proficiency') {
        return <EditProficiencyModal character={character} updateCharacter={updateCharacter} characterActions={characterActions} onClose={onClose} modalData={modalData} />;
    }
    if (modalMode === 'edit_armor_prof') {
        return <EditArmorProficiencyModal character={character} characterActions={characterActions} onClose={onClose} />;
    }
    if (modalMode === 'edit_languages') {
        return <EditLanguagesModal character={character} updateCharacter={updateCharacter} onClose={onClose} />;
    }
    if (modalMode === 'item_proficiencies') {
        return <EditItemProficienciesModal character={character} characterActions={characterActions} onClose={onClose} modalData={modalData} />;
    }

    // --- AC & DEFENSE MODALS ---

    if (modalMode === 'ac') {
        return <ACModal character={character} characterActions={characterActions} onClose={onClose} />;
    }
    if (modalMode === 'shield') {
        return <ShieldModal character={character} characterActions={characterActions} onClose={onClose} />;
    }
    if (modalMode === 'edit_perception') {
        return <EditPerceptionModal character={character} characterActions={characterActions} onClose={onClose} />;
    }


    // --- MAGIC MODALS ---

    if (modalMode === 'edit_spell_proficiency') {
        return <EditSpellProficiencyModal character={character} characterActions={characterActions} onClose={onClose} />;
    }
    if (modalMode === 'edit_spell_slots') {
        return <EditSpellSlotsModal character={character} characterActions={characterActions} onClose={onClose} modalData={modalData} />;
    }
    if (modalMode === 'spell_stat_info') {
        return <SpellStatInfoModal character={character} modalData={modalData} onClose={onClose} />;
    }


    // --- COMPLEX / FEATURE MODALS ---

    if (modalMode === 'quicksheet') {
        return <QuickSheetModal character={character} updateCharacter={updateCharacter} characterActions={characterActions} onClose={onClose} />;
    }

    if (modalMode === 'conditions' || modalMode === 'conditionInfo') {
        const condName = typeof modalData === 'string' ? modalData : modalData?.name;
        const effectId = typeof modalData === 'object' ? modalData?.id : null;
        const conditionValue = typeof modalData === 'object' ? modalData?.value : null;
        const previewOnly = typeof modalData === 'object' && Boolean(modalData?.previewOnly);
        const returnFocusKey = typeof modalData === 'object' ? modalData?.returnFocusKey : null;
        // If mode is 'conditions', initialCondition is likely null or undefined unless intended.
        // if mode is 'conditionInfo', initialCondition is condName.
        const initial = modalMode === 'conditionInfo' ? condName : null;

        return (
            <ConditionsModal
                character={character}
                effects={effects || conditions}
                onClose={onClose}
                initialCondition={initial}
                initialEffectId={effectId}
                initialConditionValue={conditionValue}
                initialPreviewOnly={previewOnly}
                returnFocusKey={returnFocusKey}
                onContentLinkClick={onContentLinkClick}
                onBack={hasHistory ? onBack : undefined}
                readOnly={readOnly}
            // Note: ConditionsModal handles "Back" internally for list nav, but if we want to pop history, we pass onBack.
            />
        );
    }

    if (modalMode === 'formula_book') {
        return (
            <FormulaBookModal
                character={character}
                updateCharacter={updateCharacter}
                characterActions={characterActions}
                dailyPrepQueue={dailyPrepQueue}
                setDailyPrepQueue={setDailyPrepQueue}
                setModalData={setModalData}
                setModalMode={setModalMode}
                onClose={onClose}
                mode={modalData?.mode || 'book'}
                title={modalData?.title || 'Formula Book'}
            />
        );
    }

    if (modalMode === 'weapon_detail' || modalMode === 'detail') {
        return (
            <StatBreakdownModal
                modalData={modalData}
                onClose={onClose}
                isWeapon={modalMode === 'weapon_detail'}
            />
        );
    }

    if (modalMode === 'catalog_detail' || modalMode === 'item' || modalMode === 'spell' || modalMode === 'feat' || modalMode === 'impulse') {
        // Calculate ItemDetailModal props logic that was inline in PlayerApp
        // We'll trust ModalManager is receiving the raw modalData.

        // Logic from PlayerApp:
        /*
            const isSpell = ...
            const isAction = ...
            const isFeatFromCatalog = ...
            const matchesShopItemProps = ...
            const isShopItem = ...
            const expectedSourceFile = ...
            const isLoadingShopDetail = ...
            const shopDetailError = ...
        */
        // Actually, isLoadingShopDetail and shopDetailError are passed as props to ModalManager from PlayerApp.
        // So we just pass them through.

        return (
            <ItemDetailModal
                character={character}
                updateCharacter={updateCharacter}
                modalData={modalData}
                toggleInventoryEquipped={toggleInventoryEquipped}
                onBack={onBack}
                onClose={onClose}
                hasHistory={hasHistory}
                isLoadingShopDetail={isLoadingShopDetail}
                shopDetailError={shopDetailError}
                onContentLinkClick={onContentLinkClick}
            />
        );
    }

    return null;
}
