import React from 'react';
import { ClosableEffectChip } from './ClosableEffectChip';
import './ConditionList.css';

export function ConditionList({
    conditions = [],
    onClick,
    onAdd,
    onRemove,
    removingIds = new Set(),
    readOnly = false,
}) {
    const active = Array.isArray(conditions) ? conditions : [];

    return (
        <div
            className="condition-list"
            data-empty={active.length === 0}
            aria-label="Active conditions and effects"
        >
            {active.map((effect) => (
                <ClosableEffectChip
                    key={effect.id}
                    effect={effect}
                    removable={!readOnly && effect.canRemove !== false && !effect.derived}
                    removing={removingIds.has(effect.id)}
                    onOpen={onClick}
                    onRemove={onRemove}
                />
            ))}

            {!readOnly && (
                <button type="button" data-testid="condition-add-button" className="condition-list__add" onClick={onAdd}>
                    + Add Condition
                </button>
            )}
            {active.length === 0 && readOnly && <span className="condition-list__empty">No active effects</span>}
        </div>
    );
}
