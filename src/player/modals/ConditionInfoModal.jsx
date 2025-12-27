import React from 'react';
import { getConditionCatalogEntry, getConditionImgSrc, isConditionValued } from '../../shared/constants/conditionsCatalog';
import { getConditionIcon } from '../../shared/constants/conditions';
import { formatText } from '../../shared/utils/rules';

export function ConditionInfoModal({ character, updateCharacter, modalData, setModalMode }) {
    const condName = typeof modalData === 'string' ? modalData : modalData?.name;
    const entry = getConditionCatalogEntry(condName);
    const iconSrc = getConditionImgSrc(condName);
    const active = character.conditions.find(c => c.name === condName);
    const level = active ? active.level : 0;
    const valued = isConditionValued(condName);

    const adjustCondition = (delta) => {
        if (!condName) return;
        updateCharacter(c => {
            const idx = c.conditions.findIndex(x => x.name === condName);
            if (!valued) {
                if (delta > 0) {
                    if (idx > -1) c.conditions[idx].level = 1;
                    else c.conditions.push({ name: condName, level: 1 });
                } else if (idx > -1) {
                    c.conditions.splice(idx, 1);
                }
                return;
            }

            if (delta > 0) {
                if (idx > -1) c.conditions[idx].level = (c.conditions[idx].level || 0) + 1;
                else c.conditions.push({ name: condName, level: 1 });
            } else if (idx > -1) {
                const nextLevel = (c.conditions[idx].level || 0) - 1;
                if (nextLevel <= 0) c.conditions.splice(idx, 1);
                else c.conditions[idx].level = nextLevel;
            }
        });
    };

    return (
        <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <button
                    type="button"
                    className="set-btn"
                    style={{ width: 'auto', padding: '8px 12px', marginTop: 0 }}
                    onClick={() => setModalMode('condition')}
                >
                    ← Back
                </button>
                <h2 style={{ margin: 0, flex: 1, textAlign: 'center' }}>{condName}</h2>
                <div style={{ width: 72 }} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, marginTop: 12 }}>
                {iconSrc ? (
                    <img src={iconSrc} alt="" style={{ width: 36, height: 36, objectFit: 'contain' }} />
                ) : (
                    <span style={{ fontSize: '1.8em' }}>{getConditionIcon(condName) || "⚪"}</span>
                )}

                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <button className="qty-btn" onClick={() => adjustCondition(-1)}>-</button>
                    <span style={{ minWidth: 24, textAlign: 'center' }}>{level}</span>
                    <button className="qty-btn" onClick={() => adjustCondition(1)}>+</button>
                </div>
            </div>

            <div
                className="formatted-content"
                dangerouslySetInnerHTML={{ __html: formatText(entry?.description || "No description.") }}
                style={{ marginTop: 12 }}
            />
        </>
    );
}
