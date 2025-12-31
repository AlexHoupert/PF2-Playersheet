import React, { useMemo } from 'react';
import { StatBreakdown } from '../components/StatBreakdown';

/**
 * @typedef {Object} BreakdownData
 * @property {number} [base] - Base value (e.g. 10 for AC/DC).
 * @property {number} [attribute] - Attribute bonus.
 * @property {number} [proficiency] - Proficiency bonus.
 * @property {number} [level] - Level bonus.
 * @property {number} [item] - Item bonus.
 * @property {number} [armor] - Armor penalty/bonus.
 * @property {Object.<string, number>} [others] - Other modifiers (key-value pairs).
 */

/**
 * @typedef {Object} ModalData
 * @property {string} [title] - Title of the modal.
 * @property {string|number} total - The total calculated value.
 * @property {BreakdownData} [breakdown] - The breakdown object.
 * @property {Object} [source] - Source information (e.g. attrName, profName, levelVal).
 * @property {Object} [item] - The item associated (for weapon details).
 */

/**
 * Modal for displaying a detailed breakdown of a statistic (Attack, Skill, Save, AC).
 * 
 * @param {Object} props
 * @param {ModalData} props.modalData - The data object containing values and breakdown.
 * @param {Function} props.onClose - Handler to close the modal.
 * @param {boolean} [props.isWeapon] - Whether this is a weapon breakdown (slightly different display).
 */
export function StatBreakdownModal({ modalData, onClose, isWeapon = false }) {

    // Logic to construct rows from breakdown data
    const rows = useMemo(() => {
        const r = [];
        if (!modalData?.breakdown || typeof modalData.breakdown !== 'object') return r;

        const { breakdown, source, base } = modalData;

        // Base 10 (mostly for AC/DC)
        if (base === 10) {
            r.push({ label: 'Base', val: 10 });
        }

        // Attribute
        if (breakdown.attribute !== undefined) {
            const label = `Attribute${source?.attrName ? ` (${source.attrName})` : ''}`;
            r.push({ label, val: breakdown.attribute });
        }

        // Proficiency
        if (breakdown.proficiency !== undefined) {
            const label = `Proficiency${source?.profName ? ` (${source.profName})` : ''}`;
            r.push({ label, val: breakdown.proficiency });
        }

        // Level
        if (breakdown.level !== undefined && breakdown.level !== 0) {
            const label = `Level${source?.levelVal ? ` (${source.levelVal})` : ''}`;
            r.push({ label, val: breakdown.level });
        }

        // Item
        if (breakdown.item !== undefined && breakdown.item !== 0) {
            r.push({ label: 'Item Bonus', val: breakdown.item });
        }

        // Armor Penalty (specific to skills usually)
        if (breakdown.armor !== undefined && breakdown.armor !== 0) {
            r.push({ label: 'Armor Penalty', val: breakdown.armor });
        }

        // Others / Potency / Dynamic keys
        Object.entries(breakdown).forEach(([k, v]) => {
            if (['attribute', 'proficiency', 'level', 'item', 'armor'].includes(k)) return;
            if (v === 0) return;
            // Capitalize label
            const label = k.charAt(0).toUpperCase() + k.slice(1);
            r.push({ label, val: v });
        });

        return r;
    }, [modalData]);

    const title = modalData.title || modalData.item?.name || (isWeapon ? 'Weapon Attack' : 'Stat Detail');
    const subTitle = isWeapon ? 'Attack Bonus' : 'Total Bonus';

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
                padding: 20,
                display: 'flex', flexDirection: 'column',
                boxShadow: '0 0 20px rgba(0,0,0,0.8)'
            }} onClick={e => e.stopPropagation()}>

                <h2 style={{
                    fontSize: '1.4em', marginBottom: 20, textAlign: 'center',
                    color: 'var(--text-gold)', fontFamily: 'Cinzel, serif',
                    borderBottom: '1px solid #5c4033', paddingBottom: 10
                }}>
                    {title}
                </h2>

                <div style={{ textAlign: 'center', marginBottom: 20 }}>
                    <div style={{ fontSize: '2.5em', color: 'var(--text-gold)', fontWeight: 'bold', lineHeight: 1 }}>
                        {modalData.total >= 0 ? `+${modalData.total}` : modalData.total}
                    </div>
                    <div style={{ fontSize: '1em', color: '#888', textTransform: 'uppercase', letterSpacing: 1 }}>
                        {subTitle}
                    </div>
                </div>

                {modalData.breakdown && typeof modalData.breakdown === 'object' ? (
                    <StatBreakdown
                        rows={rows}
                        total={modalData.total}
                    />
                ) : (
                    <div style={{
                        whiteSpace: 'pre-wrap', lineHeight: '1.6', color: '#ccc',
                        background: '#222', padding: 15, borderRadius: 8, fontStyle: 'italic'
                    }}>
                        {modalData.breakdown || "No specific breakdown available."}
                    </div>
                )}

                <button onClick={onClose} style={{
                    marginTop: 20, width: '100%', padding: '10px', background: '#c5a059',
                    border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 'bold', color: '#1a1a1d',
                    fontSize: '0.9em'
                }}>Close</button>

            </div>
        </div>
    );
}
