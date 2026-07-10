import React from 'react';
import { getConditionImgSrc } from '../constants/conditionsCatalog';
import { getConditionIcon, NEG_CONDS, POS_CONDS } from '../constants/conditions';
import './ConditionList.css';

const CATEGORY_ICONS = {
    damage_effect: 'FIRE',
    affliction: 'AFF',
    custom: 'NOTE',
};

export function ConditionList({ conditions = [], onClick, onAdd, readOnly = false }) {
    const active = Array.isArray(conditions) ? conditions : [];

    return (
        <div className="condition-list" aria-label="Active conditions">
            {active.map((condition) => {
                const lowerName = String(condition.name || '').toLowerCase();
                const image = condition.category === 'condition' ? getConditionImgSrc(condition.name) : null;
                const isNegative = condition.category === 'condition' && NEG_CONDS.includes(lowerName);
                const isPositive = condition.category === 'condition' && POS_CONDS.includes(lowerName);
                const variant = condition.variant || condition.category || 'condition';
                const icon = image
                    ? null
                    : condition.category === 'condition'
                        ? getConditionIcon(condition.name) || 'O'
                        : CATEGORY_ICONS[condition.category] || 'FX';

                return (
                    <button
                        key={condition.id}
                        type="button"
                        data-testid={`condition-badge-${String(condition.id || condition.name).toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
                        className={[
                            'condition-list__badge',
                            `condition-list__badge--${variant}`,
                            isNegative && 'condition-list__badge--negative',
                            isPositive && 'condition-list__badge--positive',
                        ].filter(Boolean).join(' ')}
                        onClick={() => onClick?.(condition)}
                    >
                        {image ? <img src={image} alt="" className="condition-list__image" /> : <span className="condition-list__icon">{icon}</span>}
                        <span>{condition.label}</span>
                    </button>
                );
            })}

            {active.length === 0 && !readOnly && (
                <button type="button" data-testid="condition-add-button" className="condition-list__add" onClick={onAdd}>
                    + ADD CONDITION
                </button>
            )}
        </div>
    );
}
