import React from 'react';
import { calculateImpulseAttackAndClassDC, calculateSpellAttackAndDC } from '../../utils/rules';
import FormDialog from '../../shared/components/dialogs/FormDialog';
import AppDialogShell from '../../shared/components/dialogs/AppDialogShell';
import { StatBreakdownContent } from './StatBreakdownModal';

const ARMOR_RANKS = [
    { value: 0, label: 'Untrained (+0)' },
    { value: 2, label: 'Trained (+2)' },
    { value: 4, label: 'Expert (+4)' },
    { value: 6, label: 'Master (+6)' },
    { value: 8, label: 'Legendary (+8)' }
];

/**
 * Modal to edit spell proficiency attribute and rank.
 * @param {Object} props
 * @param {Object} props.character - The character object.
 * @param {Object} props.characterActions - Targeted character edit actions.
 * @param {Function} props.onClose - Function to close the modal.
 * @returns {JSX.Element}
 */
export function EditSpellProficiencyModal({ character, characterActions, onClose }) {
    const magic = character.magic || {};
    const currentAttr = magic.attribute || "Intelligence";
    const currentProf = magic.proficiency || 0;

    return (
        <FormDialog
            open
            onOpenChange={(open) => { if (!open) onClose?.(); }}
            layerId="edit-spell-proficiency"
            title="Edit Spell Proficiency"
            description="Choose the key attribute and proficiency rank."
            size="sm"
            showSubmit={false}
            cancelLabel="Close"
        >
                <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">Key Attribute</label>
                    <select
                        className="prof-select w-full"
                        value={currentAttr}
                        onChange={(e) => characterActions?.setMagicAttribute(e.target.value)}
                    >
                        {['Strength', 'Dexterity', 'Constitution', 'Intelligence', 'Wisdom', 'Charisma'].map(attr => (
                            <option key={attr} value={attr}>{attr}</option>
                        ))}
                    </select>
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">Proficiency Rank</label>
                    <select
                        className="prof-select w-full"
                        value={currentProf}
                        onChange={(e) => characterActions?.setMagicProficiency(parseInt(e.target.value))}
                    >
                        {ARMOR_RANKS.map(r => (
                            <option key={r.value} value={r.value}>{r.label}</option>
                        ))}
                    </select>
                </div>
        </FormDialog>
    );
}

/**
 * Modal to edit spell slots (max/current).
 * @param {Object} props
 * @param {Object} props.character - The character object.
 * @param {Object} props.characterActions - Targeted character edit actions.
 * @param {Function} props.onClose - Function to close the modal.
 * @param {Object} props.modalData - Data containing the spell item or level.
 * @returns {JSX.Element}
 */
export function EditSpellSlotsModal({ character, characterActions, onClose, modalData }) {
    const item = modalData?.item || {};
    const levelKey = item.level || '1';
    const [selectedLevel, setSelectedLevel] = React.useState(levelKey);
    const slotKey = selectedLevel + "_max";

    const SLOT_LEVELS = ['f', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];

    return (
        <FormDialog
            open
            onOpenChange={(open) => { if (!open) onClose?.(); }}
            layerId="edit-spell-slots"
            title="Edit Spell Slots"
            description="Select a slot level and set its maximum."
            size="sm"
            showSubmit={false}
            cancelLabel="Close"
        >
                <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">Slot Level</label>
                    <select
                        className="prof-select w-full"
                        value={selectedLevel}
                        onChange={(e) => setSelectedLevel(e.target.value)}
                    >
                        <option value="f">Focus Points</option>
                        {SLOT_LEVELS.filter(l => l !== 'f').map(l => (
                            <option key={l} value={l}>Level {l}</option>
                        ))}
                    </select>
                </div>

                <div className="qty-control-box mt-5">
                    <button className="qty-btn" onClick={() => {
                        const cur = character?.magic?.slots?.[slotKey] || 0;
                        characterActions?.setMagicSlot(slotKey, Math.max(0, cur - 1));
                    }}>-</button>
                    <span style={{ fontSize: '2em', width: 60, textAlign: 'center' }}>
                        {character?.magic?.slots?.[slotKey] || 0}
                    </span>
                    <button className="qty-btn" onClick={() => {
                        const cur = character?.magic?.slots?.[slotKey] || 0;
                        characterActions?.setMagicSlot(slotKey, cur + 1);
                    }}>+</button>
                </div>
        </FormDialog>
    );
}

/**
 * Modal to view spell statistics breakdown.
 * @param {Object} props
 * @param {Object} props.character - The character object.
 * @param {Object} props.modalData - Data identifying the stat type (dc, attack, class_dc).
 * @param {Function} props.onClose - Function to close the modal.
 * @returns {JSX.Element}
 */
export function SpellStatInfoModal({ character, modalData, onClose }) {
    const type = modalData?.type || 'dc';

    const isImpulse = type === 'class_dc' || type === 'impulse_attack';
    const isDc = type === 'dc' || type === 'class_dc';

    const spellStats = !isImpulse ? calculateSpellAttackAndDC(character) : null;
    const impulseStats = isImpulse ? calculateImpulseAttackAndClassDC(character) : null;

    const attackCalc = isImpulse ? impulseStats.attack : spellStats.attack;
    const dcCalc = isImpulse ? impulseStats.classDC : spellStats.dc;
    const activeCalc = isDc ? dcCalc : attackCalc;

    const title = isImpulse
        ? (isDc ? 'Class DC Breakdown' : 'Impulse Attack Breakdown')
        : (isDc ? 'Spell DC Breakdown' : 'Spell Attack Breakdown');

    return (
        <AppDialogShell
            open
            onOpenChange={(open) => { if (!open) onClose?.(); }}
            layerId="spell-stat-breakdown"
            title={title}
            description="Calculated value breakdown"
            size="sm"
        >
            <StatBreakdownContent
                modalData={{
                    title,
                    total: activeCalc.total,
                    base: isDc ? 10 : 0,
                    breakdown: activeCalc.breakdown,
                    source: {
                        attrName: activeCalc.source?.attrFull,
                        profName: activeCalc.source?.profName,
                    },
                }}
                isWeapon={!isDc}
            />
        </AppDialogShell>
    );
}
