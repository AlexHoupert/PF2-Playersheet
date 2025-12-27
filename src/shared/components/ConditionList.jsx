import React from 'react';
import { getConditionImgSrc, isConditionValued } from '../../shared/constants/conditionsCatalog';
import { POS_CONDS, VIS_CONDS, getConditionIcon } from '../../shared/constants/conditions';

/**
 * Reusable list of active condition badges.
 */
export function ConditionList({ conditions = [], onConditionClick, onAddClick }) {
    const activeConditions = conditions.filter(c => c.level > 0);

    return (
        <div style={{ minHeight: 36 }}>
            <div className="conditions-container">
                {activeConditions.map(c => {
                    const lower = c.name.toLowerCase();
                    let badgeClass = "condition-badge";
                    if (POS_CONDS.includes(lower)) badgeClass += " cond-positive";
                    else if (VIS_CONDS.includes(lower)) badgeClass += " cond-visibility";

                    const isBinary = !isConditionValued(c.name);
                    const iconSrc = getConditionImgSrc(c.name);

                    return (
                        <div
                            key={c.name}
                            className={badgeClass}
                            onClick={onConditionClick ? (e) => onConditionClick(c, e) : undefined}
                            style={{ cursor: onConditionClick ? 'pointer' : 'default' }}
                        >
                            {iconSrc ? (
                                <img src={iconSrc} alt="" style={{ width: 20, height: 20, objectFit: 'contain' }} />
                            ) : (
                                <span style={{ fontSize: '1.2em' }}>{getConditionIcon(c.name) || "🔴"}</span>
                            )}
                            <span className="cond-name">{c.name}</span>
                            <span className={isBinary ? "cond-level-hidden" : "cond-level"}>{c.level}</span>
                        </div>
                    );
                })}
            </div>
            {activeConditions.length === 0 && onAddClick && (
                <button className="btn-add-condition" onClick={onAddClick}>
                    + Add Condition
                </button>
            )}
        </div>
    );
}
