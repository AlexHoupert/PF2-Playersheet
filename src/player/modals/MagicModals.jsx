import React from 'react';
import { StatBreakdown } from '../components/StatBreakdown';

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
 * @param {Function} props.updateCharacter - Function to update the character state.
 * @param {Function} props.onClose - Function to close the modal.
 * @returns {JSX.Element}
 */
export function EditSpellProficiencyModal({ character, updateCharacter, onClose }) {
    const magic = character.magic || {};
    const currentAttr = magic.attribute || "Intelligence";
    const currentProf = magic.proficiency || 0;

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 1100,
            display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 20
        }} onClick={onClose}>
            <div style={{
                backgroundColor: '#2b2b2e', border: '2px solid #c5a059',
                padding: '20px', borderRadius: '8px', maxWidth: '300px', width: '100%',
                color: '#e0e0e0', textAlign: 'center'
            }} onClick={e => e.stopPropagation()}>
                <h2>Edit Spell Proficiency</h2>
                <div style={{ marginBottom: 20 }}>
                    <label style={{ display: 'block', marginBottom: 5, color: '#aaa' }}>Key Attribute</label>
                    <select
                        className="prof-select"
                        value={currentAttr}
                        onChange={(e) => updateCharacter(c => {
                            if (!c.magic) c.magic = {};
                            c.magic.attribute = e.target.value;
                        })}
                    >
                        {['Strength', 'Dexterity', 'Constitution', 'Intelligence', 'Wisdom', 'Charisma'].map(attr => (
                            <option key={attr} value={attr}>{attr}</option>
                        ))}
                    </select>
                </div>
                <div>
                    <label style={{ display: 'block', marginBottom: 5, color: '#aaa' }}>Proficiency Rank</label>
                    <select
                        className="prof-select"
                        value={currentProf}
                        onChange={(e) => updateCharacter(c => {
                            if (!c.magic) c.magic = {};
                            c.magic.proficiency = parseInt(e.target.value);
                        })}
                    >
                        {ARMOR_RANKS.map(r => (
                            <option key={r.value} value={r.value}>{r.label}</option>
                        ))}
                    </select>
                </div>
                <button className="set-btn" onClick={onClose} style={{ marginTop: 20 }}>Close</button>
            </div>
        </div>
    );
}

/**
 * Modal to edit spell slots (max/current).
 * @param {Object} props
 * @param {Object} props.character - The character object.
 * @param {Function} props.updateCharacter - Function to update the character state.
 * @param {Function} props.onClose - Function to close the modal.
 * @param {Object} props.modalData - Data containing the spell item or level.
 * @returns {JSX.Element}
 */
export function EditSpellSlotsModal({ character, updateCharacter, onClose, modalData }) {
    const item = modalData?.item || {};
    const levelKey = item.level || '1';
    const setModalData = modalData.setModalData; // We need to handle this pattern or change it.
    // In PlayerApp, setModalData was passed directly? No, it used the state setter.
    // The Original Code: onChange={(e) => setModalData({ ...modalData, item: { ...item, level: e.target.value } })}
    // So this modal needs internal state for the selected level if we want to change it.
    // Or we pass `setModalData` as a prop if we want to persist it in parent state (which was modalData).

    // Better: use internal state for the level since it's just navigation within the modal.
    const [selectedLevel, setSelectedLevel] = React.useState(levelKey);
    const slotKey = selectedLevel + "_max";

    const SLOT_LEVELS = ['f', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 1100,
            display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 20
        }} onClick={onClose}>
            <div style={{
                backgroundColor: '#2b2b2e', border: '2px solid #c5a059',
                padding: '20px', borderRadius: '8px', maxWidth: '300px', width: '100%',
                color: '#e0e0e0', textAlign: 'center'
            }} onClick={e => e.stopPropagation()}>
                <h2>Edit Spell Slots</h2>
                <div style={{ marginBottom: 20 }}>
                    <label style={{ display: 'block', marginBottom: 5, color: '#aaa' }}>Slot Level</label>
                    <select
                        className="prof-select"
                        value={selectedLevel}
                        onChange={(e) => setSelectedLevel(e.target.value)}
                    >
                        <option value="f">Focus Points</option>
                        {SLOT_LEVELS.filter(l => l !== 'f').map(l => (
                            <option key={l} value={l}>Level {l}</option>
                        ))}
                    </select>
                </div>

                <div className="qty-control-box">
                    <button className="qty-btn" onClick={() => updateCharacter(c => {
                        if (!c.magic) c.magic = { slots: {} };
                        if (!c.magic.slots) c.magic.slots = {};
                        const cur = c.magic.slots[slotKey] || 0;
                        c.magic.slots[slotKey] = Math.max(0, cur - 1);
                    })}>-</button>
                    <span style={{ fontSize: '2em', width: 60, textAlign: 'center' }}>
                        {character?.magic?.slots?.[slotKey] || 0}
                    </span>
                    <button className="qty-btn" onClick={() => updateCharacter(c => {
                        if (!c.magic) c.magic = { slots: {} };
                        if (!c.magic.slots) c.magic.slots = {};
                        const cur = c.magic.slots[slotKey] || 0;
                        c.magic.slots[slotKey] = cur + 1;
                    })}>+</button>
                </div>
                <button className="set-btn" onClick={onClose} style={{ marginTop: 20 }}>Close</button>
            </div>
        </div>
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
    let title = 'Spell Statistics';
    let dcVal = 0;
    let atkBonus = 0;
    let rows = [];

    if (type === 'class_dc' || type === 'impulse_attack') {
        // Impulse / Class DC Stats
        title = type === 'class_dc' ? 'Class DC Breakdown' : 'Impulse Attack Breakdown';
        const profRank = character.stats.impulse_proficiency || 0;
        const level = parseInt(character.level) || 1;
        const conMod = character.stats.attributes?.constitution ?? 0;
        const rankLabel = ARMOR_RANKS.find(r => r.value === profRank)?.label.split(' ')[0] || 'Untrained';

        const profBonus = profRank > 0 ? (level + profRank) : 0;
        atkBonus = profBonus + conMod;
        dcVal = 10 + atkBonus;

        rows = [
            { label: type === 'class_dc' ? "Base" : null, val: type === 'class_dc' ? 10 : null },
            { label: `Constitution (${conMod})`, val: conMod },
            { label: `Proficiency (${rankLabel})`, val: profRank },
            { label: profRank > 0 ? "Level" : null, val: profRank > 0 ? level : null }
        ].filter(r => r.label !== null);

    } else {
        // Magic Stats
        title = type === 'dc' ? 'Spell DC Breakdown' : 'Spell Attack Breakdown';
        const magic = character.magic || {};
        const attrName = magic.attribute || "Intelligence";
        const attrMod = parseInt(character.stats.attributes[(attrName || "").toLowerCase()]) || 0;
        const prof = parseFloat(magic.proficiency) || 0;
        const level = parseInt(character.level) || 0;
        const rankLabel = ARMOR_RANKS.find(r => r.value === prof)?.label.split(' ')[0] || 'Untrained';

        const profBonus = prof + (prof > 0 ? level : 0);
        atkBonus = Math.floor(attrMod + profBonus);
        dcVal = 10 + atkBonus;

        rows = [
            { label: type === 'dc' ? "Base" : null, val: type === 'dc' ? 10 : null },
            { label: `${attrName} (${attrMod})`, val: attrMod },
            { label: `Proficiency (${rankLabel})`, val: prof },
            { label: prof > 0 ? "Level" : null, val: prof > 0 ? level : null }
        ].filter(r => r.label !== null);
    }

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 1100,
            display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 20
        }} onClick={onClose}>
            <div style={{
                backgroundColor: '#2b2b2e', border: '2px solid #c5a059',
                borderRadius: '8px', maxWidth: '400px', width: '100%',
                color: '#e0e0e0',
                padding: 20
            }} onClick={e => e.stopPropagation()}>

                <h2 style={{ fontSize: '1.4em', marginBottom: 20, textAlign: 'center', color: 'var(--text-gold)', fontFamily: 'Cinzel, serif', borderBottom: '1px solid #5c4033', paddingBottom: 10 }}>{title}</h2>

                <div style={{ textAlign: 'center', marginBottom: 20 }}>
                    <div style={{ fontSize: '2.5em', color: 'var(--text-gold)', fontWeight: 'bold', lineHeight: 1 }}>
                        {(type === 'dc' || type === 'class_dc') ? dcVal : (atkBonus >= 0 ? `+${atkBonus}` : atkBonus)}
                    </div>
                    <div style={{ fontSize: '1em', color: '#888', textTransform: 'uppercase', letterSpacing: 1 }}>
                        {(type === 'dc' || type === 'class_dc') ? 'Difficulty Class' : 'Attack Bonus'}
                    </div>
                </div>

                <StatBreakdown
                    rows={rows}
                    total={(type === 'dc' || type === 'class_dc') ? dcVal : atkBonus}
                    totalLabel="Total"
                />

                <button onClick={onClose} style={{
                    marginTop: 20, width: '100%', padding: '10px', background: '#c5a059',
                    border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 'bold', color: '#1a1a1d',
                    fontSize: '0.9em'
                }}>Close</button>
            </div>
        </div>
    );
}
