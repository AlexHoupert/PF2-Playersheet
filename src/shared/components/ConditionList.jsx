import React, { useLayoutEffect, useRef, useState } from 'react';
import { ClosableEffectChip } from './ClosableEffectChip';
import { shouldUseCompactAddButton } from './conditionListLayout';
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
    const listRef = useRef(null);
    const fullMeasureRef = useRef(null);
    const compactMeasureRef = useRef(null);
    const [compactAdd, setCompactAdd] = useState(false);

    useLayoutEffect(() => {
        const list = listRef.current;
        if (!list || readOnly || active.length === 0) {
            setCompactAdd(false);
            return undefined;
        }

        const update = () => {
            const itemWidths = [...list.querySelectorAll('.effect-chip')]
                .map((item) => item.getBoundingClientRect().width);
            setCompactAdd(shouldUseCompactAddButton({
                containerWidth: list.clientWidth,
                itemWidths,
                fullWidth: fullMeasureRef.current?.getBoundingClientRect().width || 0,
                compactWidth: compactMeasureRef.current?.getBoundingClientRect().width || 0,
                gap: 6,
            }));
        };

        update();
        const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(update) : null;
        observer?.observe(list);
        document.fonts?.ready?.then(update);
        return () => observer?.disconnect();
    }, [active, readOnly]);

    return (
        <div
            ref={listRef}
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
                <>
                    <button
                        type="button"
                        data-testid="condition-add-button"
                        className="condition-list__add"
                        data-compact={compactAdd}
                        aria-label="Add condition"
                        onClick={onAdd}
                    >
                        {compactAdd ? '+' : '+ Add Condition'}
                    </button>
                    <span ref={fullMeasureRef} className="condition-list__add condition-list__add-measure" aria-hidden="true">+ Add Condition</span>
                    <span ref={compactMeasureRef} className="condition-list__add condition-list__add-measure" aria-hidden="true">+</span>
                </>
            )}
            {active.length === 0 && readOnly && <span className="condition-list__empty">No active effects</span>}
        </div>
    );
}
