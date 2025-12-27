import React, { useState } from 'react';
import { NEG_CONDS, POS_CONDS, VIS_CONDS, getConditionIcon } from '../../shared/constants/conditions';
import { conditionsCatalog, getConditionCatalogEntry, getConditionImgSrc, isConditionValued } from '../../shared/constants/conditionsCatalog';

export function ConditionModal({ character, updateCharacter, setModalData, setModalMode }) {
    const [condTab, setCondTab] = useState('active');

    const allConditions = Object.keys(conditionsCatalog).sort();
    const activeConditions = character.conditions.filter(c => c.level > 0).map(c => c.name);

    const adjustCondition = (condName, delta) => {
        const valued = isConditionValued(condName);
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

    let listToRender = [];
    if (condTab === 'active') {
        listToRender = activeConditions;
    } else {
        let catList = [];
        if (condTab === 'negative') catList = NEG_CONDS;
        else if (condTab === 'positive') catList = POS_CONDS;
        else if (condTab === 'visibility') catList = VIS_CONDS;

        catList = catList.map(s => s.toLowerCase());
        listToRender = allConditions.filter(c => catList.includes(c.toLowerCase()));
    }

    return (
        <>
            <h2>Conditions</h2>
            <div className="modal-tabs">
                {activeConditions.length > 0 && (
                    <button className={`tab-btn ${condTab === 'active' ? 'active' : ''}`} onClick={() => setCondTab('active')}>Active</button>
                )}
                <button className={`tab-btn ${condTab === 'negative' ? 'active' : ''}`} onClick={() => setCondTab('negative')}>Negative</button>
                <button className={`tab-btn ${condTab === 'positive' ? 'active' : ''}`} onClick={() => setCondTab('positive')}>Positive</button>
                <button className={`tab-btn ${condTab === 'visibility' ? 'active' : ''}`} onClick={() => setCondTab('visibility')}>Visibility</button>
            </div>
            <div style={{ maxHeight: '50vh', overflowY: 'auto' }}>
                {listToRender.length === 0 && <div style={{ padding: 10, color: '#666' }}>No conditions found.</div>}
                {listToRender.map(condName => {
                    const active = character.conditions.find(c => c.name === condName);
                    const level = active ? active.level : 0;
                    const iconSrc = getConditionImgSrc(condName);
                    return (
                        <div key={condName} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px', borderBottom: '1px solid #333' }}>
                            <button
                                type="button"
                                onClick={() => { setModalData(condName); setModalMode('conditionInfo'); }}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 8,
                                    background: 'transparent',
                                    border: 'none',
                                    color: 'inherit',
                                    padding: 0,
                                    cursor: 'pointer',
                                    font: 'inherit',
                                    textAlign: 'left'
                                }}
                                title="View description"
                            >
                                {iconSrc ? (
                                    <img src={iconSrc} alt="" style={{ width: 20, height: 20, objectFit: 'contain' }} />
                                ) : (
                                    <span style={{ width: 20, display: 'inline-flex', justifyContent: 'center' }}>{getConditionIcon(condName) || "⚪"}</span>
                                )}
                                <span>{condName}</span>
                            </button>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <button className="qty-btn" style={{ width: 30, height: 30, fontSize: '1em' }} onClick={() => adjustCondition(condName, -1)}>-</button>
                                <span style={{ width: 20, textAlign: 'center', fontWeight: 'bold' }}>{level}</span>
                                <button className="qty-btn" style={{ width: 30, height: 30, fontSize: '1em' }} onClick={() => adjustCondition(condName, 1)}>+</button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </>
    );
}
