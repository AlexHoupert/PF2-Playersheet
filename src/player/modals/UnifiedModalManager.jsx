import React from 'react';

// Complex Modals
import { ItemModal } from './ItemModal';
import { ContextModal } from './ContextModal';
import { ConditionModal } from './ConditionModal';
import { ConditionInfoModal } from './ConditionInfoModal';
import { ActionModal } from './ActionModal';
import { ShieldModal } from './ShieldModal';
import { HPModal } from './HPModal';
import { FormulaBookModal } from './FormulaBookModal';

// Simple Modals
import {
    GoldModal, AttributeModal, ProficiencyModal, SpeedModal,
    ItemProficiencyModal, ArmorProficiencyModal, MaxHPModal,
    LevelModal, SpellStatModal, SpellProficiencyModal,
    SpellSlotsModal, WeaponDetailModal, LanguageModal, PerceptionModal
} from './SimpleModals';

// Legacy / External Modals
import QuickSheetModal from '../QuickSheetModal';

export function UnifiedModalManager({
    modalMode,
    setModalMode,
    modalData,
    setModalData,
    character,
    updateCharacter,
    close
}) {
    if (!modalMode) return null;

    // Helper to switch to Context Menu
    const onOpenContext = (type, item) => {
        setModalData({ type, item });
        setModalMode('context');
    };

    // Shared Props
    const commonProps = {
        character,
        updateCharacter,
        modalData,
        setModalData,
        setModalMode,
        onClose: close,
        onOpenContext
    };

    let ContentComponent = null;

    switch (modalMode) {
        // Complex
        case 'item':
            ContentComponent = ItemModal;
            break;
        case 'context':
            ContentComponent = ContextModal;
            break;
        case 'condition':
            ContentComponent = ConditionModal;
            break;
        case 'conditionInfo':
            ContentComponent = ConditionInfoModal;
            break;
        case 'addAction':
            ContentComponent = ActionModal;
            break;
        case 'shield':
            ContentComponent = ShieldModal;
            break;
        case 'hp':
            ContentComponent = HPModal;
            break;
        case 'formula_book':
            ContentComponent = FormulaBookModal;
            break;
        case 'quicksheet':
            // Logic handled internally or just render component
            return <QuickSheetModal character={character} updateCharacter={updateCharacter} onClose={close} />;

        // Simple
        case 'gold':
            ContentComponent = GoldModal;
            break;
        case 'edit_attribute':
            ContentComponent = AttributeModal;
            break;
        case 'edit_proficiency':
        case 'class_dc': // Map class_dc to ProficiencyModal (logic inside handles key)
            ContentComponent = ProficiencyModal;
            break;
        case 'edit_speed':
            ContentComponent = SpeedModal;
            break;
        case 'item_proficiencies':
            ContentComponent = ItemProficiencyModal;
            break;
        case 'edit_armor_prof':
            ContentComponent = ArmorProficiencyModal;
            break;
        case 'edit_max_hp':
            ContentComponent = MaxHPModal;
            break;
        case 'edit_level':
            ContentComponent = LevelModal;
            break;
        case 'edit_perception':
            ContentComponent = PerceptionModal;
            break;
        case 'spell_stat_info':
            ContentComponent = SpellStatModal;
            break;
        case 'edit_spell_proficiency':
            ContentComponent = SpellProficiencyModal;
            break;
        case 'edit_spell_slots':
            ContentComponent = SpellSlotsModal;
            break;
        case 'detail':
        case 'weapon_detail':
            ContentComponent = WeaponDetailModal;
            break;
        case 'edit_languages':
            ContentComponent = LanguageModal;
            break;

        default:
            return null;
    }

    return (
        <div className="modal-overlay" onClick={close}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <button className="modal-close" onClick={close}>&times;</button>
                {ContentComponent && <ContentComponent {...commonProps} />}
            </div>
        </div>
    );
}
