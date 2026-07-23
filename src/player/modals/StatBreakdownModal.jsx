import React, { useMemo } from 'react';
import { StatBreakdown } from '../components/StatBreakdown';
import AppDialogShell from '../../shared/components/dialogs/AppDialogShell';

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
export function StatBreakdownContent({ modalData, isWeapon = false }) {

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

    const subTitle = isWeapon ? 'Attack Bonus' : 'Total Bonus';

    return (
        <div className="space-y-5">
                <div className="text-center">
                    <div className="text-4xl font-bold leading-none text-primary">
                        {modalData.total >= 0 ? `+${modalData.total}` : modalData.total}
                    </div>
                    <div className="mt-2 text-sm uppercase text-muted-foreground">
                        {subTitle}
                    </div>
                </div>

                {modalData.breakdown && typeof modalData.breakdown === 'object' ? (
                    <StatBreakdown
                        rows={rows}
                        total={modalData.total}
                    />
                ) : (
                    <div className="whitespace-pre-wrap rounded-md bg-muted p-4 text-sm italic leading-6 text-muted-foreground">
                        {modalData.breakdown || "No specific breakdown available."}
                    </div>
                )}
        </div>
    );
}

export function StatBreakdownModal({ modalData, onClose, isWeapon = false }) {
    if (!modalData) return null;
    const title = modalData.title || modalData.item?.name || (isWeapon ? 'Weapon Attack' : 'Stat Detail');

    return (
        <AppDialogShell
            open={Boolean(modalData)}
            onOpenChange={(open) => { if (!open) onClose?.(); }}
            layerId="stat-breakdown-detail"
            title={title}
            description="Calculated value breakdown"
            size="sm"
        >
            <StatBreakdownContent modalData={modalData} isWeapon={isWeapon} />
        </AppDialogShell>
    );
}
