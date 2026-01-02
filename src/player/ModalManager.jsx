import React from 'react';

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
    ManageHPModal, AddActionModal, ContextModal
} from './modals/SimpleModals';

import { ACModal, ShieldModal } from './modals/ACModals';

import {
    EditSpellProficiencyModal, EditSpellSlotsModal, SpellStatInfoModal
} from './modals/MagicModals';

// Existing Legacy Modals (assuming they are in same folder or simple components)
import QuickSheetModal from './QuickSheetModal';

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
export function ModalManager({
    modalMode,
    setModalMode,
    modalData,
    setModalData,
    character,
    updateCharacter,
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
    saveNewAction
}) {

    if (!modalMode) return null;

    // --- SIMPLE EDIT MODALS ---

    if (modalMode === 'hp') {
        return <ManageHPModal character={character} updateCharacter={updateCharacter} onClose={onClose} />;
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
            />
        );
    }

    if (modalMode === 'gold') {
        return <EditGoldModal character={character} updateCharacter={updateCharacter} onClose={onClose} />;
    }
    if (modalMode === 'edit_level' || modalMode === 'level') { // Handle both just in case
        return <EditLevelModal character={character} updateCharacter={updateCharacter} onClose={onClose} />;
    }
    if (modalMode === 'edit_max_hp' || modalMode === 'hp') {
        return <EditHPModal character={character} updateCharacter={updateCharacter} onClose={onClose} />;
    }
    if (modalMode === 'edit_speed') {
        return <EditSpeedModal character={character} updateCharacter={updateCharacter} onClose={onClose} />;
    }
    if (modalMode === 'edit_attribute') {
        return <EditAttributeModal character={character} updateCharacter={updateCharacter} onClose={onClose} modalData={modalData} />;
    }
    if (modalMode === 'edit_proficiency') {
        return <EditProficiencyModal character={character} updateCharacter={updateCharacter} onClose={onClose} modalData={modalData} />;
    }
    if (modalMode === 'edit_armor_prof') {
        return <EditArmorProficiencyModal character={character} updateCharacter={updateCharacter} onClose={onClose} />;
    }
    if (modalMode === 'edit_languages') {
        return <EditLanguagesModal character={character} updateCharacter={updateCharacter} onClose={onClose} />;
    }
    if (modalMode === 'item_proficiencies') {
        return <EditItemProficienciesModal character={character} updateCharacter={updateCharacter} onClose={onClose} modalData={modalData} />;
    }

    // --- AC & DEFENSE MODALS ---

    if (modalMode === 'ac') {
        return <ACModal character={character} updateCharacter={updateCharacter} onClose={onClose} />;
    }
    if (modalMode === 'shield') {
        return <ShieldModal character={character} updateCharacter={updateCharacter} onClose={onClose} />;
    }
    if (modalMode === 'edit_perception') {
        return <EditPerceptionModal character={character} updateCharacter={updateCharacter} onClose={onClose} />;
    }


    // --- MAGIC MODALS ---

    if (modalMode === 'edit_spell_proficiency') {
        return <EditSpellProficiencyModal character={character} updateCharacter={updateCharacter} onClose={onClose} />;
    }
    if (modalMode === 'edit_spell_slots') {
        return <EditSpellSlotsModal character={character} updateCharacter={updateCharacter} onClose={onClose} modalData={modalData} />;
    }
    if (modalMode === 'spell_stat_info') {
        return <SpellStatInfoModal character={character} modalData={modalData} onClose={onClose} />;
    }


    // --- COMPLEX / FEATURE MODALS ---

    if (modalMode === 'quicksheet') {
        return <QuickSheetModal character={character} updateCharacter={updateCharacter} onClose={onClose} />;
    }

    if (modalMode === 'conditions' || modalMode === 'conditionInfo') {
        const condName = typeof modalData === 'string' ? modalData : modalData?.name;
        // If mode is 'conditions', initialCondition is likely null or undefined unless intended.
        // if mode is 'conditionInfo', initialCondition is condName.
        const initial = modalMode === 'conditionInfo' ? condName : null;

        return (
            <ConditionsModal
                character={character}
                updateCharacter={updateCharacter}
                onClose={onClose}
                initialCondition={initial}
                onContentLinkClick={onContentLinkClick}
                onBack={hasHistory ? onBack : undefined}
            // Note: ConditionsModal handles "Back" internally for list nav, but if we want to pop history, we pass onBack.
            />
        );
    }

    if (modalMode === 'formula_book') {
        return (
            <FormulaBookModal
                character={character}
                updateCharacter={updateCharacter}
                dailyPrepQueue={dailyPrepQueue}
                setDailyPrepQueue={setDailyPrepQueue}
                setModalData={setModalData}
                setModalMode={setModalMode}
                onClose={onClose}
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

    if (modalMode === 'item') {
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
