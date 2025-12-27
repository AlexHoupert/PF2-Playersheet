import React, { useState } from 'react';
import {
    NEG_CONDS, POS_CONDS, VIS_CONDS, BINARY_CONDS, getConditionIcon
} from '../../shared/constants/conditions';
import { getConditionImgSrc, isConditionValued } from '../../shared/constants/conditionsCatalog';

export function ConditionsModal({ character, updateCharacter, onClose, onOpenInfo }) {
    // Defines
    const safeConds = character?.conditions || [];

    const hasActive = safeConds.some(c => isConditionValued(c.name) ? c.level > 0 : true);

    const [activeTab, setActiveTab] = useState(hasActive ? 'ACTIVE' : 'NEGATIVE');

    const TABS = ['ACTIVE', 'NEGATIVE', 'POSITIVE', 'VISIBILITY'];
    const DISPLAY_TABS = hasActive ? TABS : TABS.filter(t => t !== 'ACTIVE');

    const getListForTab = (tab) => {
        if (tab === 'ACTIVE') {
            return safeConds
                .filter(c => (c.level > 0))
                .map(c => c.name);
        }
        if (tab === 'NEGATIVE') return NEG_CONDS;
        if (tab === 'POSITIVE') return POS_CONDS;
        if (tab === 'VISIBILITY') return VIS_CONDS;
        return BINARY_CONDS;
    };

    const adjustCondition = (condName, delta) => {
        if (!condName) return;
        updateCharacter(c => {
            if (!c.conditions) c.conditions = [];
            const idx = c.conditions.findIndex(x => x.name === condName);
            const valued = isConditionValued(condName);

            if (!valued) {
                if (delta > 0) {
                    if (idx === -1) c.conditions.push({ name: condName, level: 1 });
                } else {
                    if (idx > -1) c.conditions.splice(idx, 1);
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

    const sortedList = getListForTab(activeTab).sort();

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 1100,
            display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 20
        }} onClick={onClose}>
            <div style={{
                backgroundColor: '#2b2b2e', border: '2px solid #c5a059',
                borderRadius: '8px', maxWidth: '500px', width: '100%',
                color: '#e0e0e0',
                display: 'flex',
                flexDirection: 'column',
                maxHeight: '90vh',
                minHeight: '50vh'
            }} onClick={e => e.stopPropagation()}>

                <div style={{ padding: '20px 20px 0 20px' }}>
                    <h2 style={{ textAlign: 'center', marginBottom: 15, marginTop: 0 }}>Conditions</h2>

                    <div style={{ display: 'flex', gap: 5, marginBottom: 10, flexWrap: 'nowrap', overflowX: 'auto', paddingBottom: 5 }}>
                        {DISPLAY_TABS.map(tab => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                style={{
                                    padding: '6px 10px', fontSize: '0.8em', flexShrink: 0,
                                    background: activeTab === tab ? '#c5a059' : '#333',
                                    color: activeTab === tab ? '#1a1a1d' : '#ccc',
                                    border: activeTab === tab ? '1px solid #c5a059' : '1px solid #444',
                                    cursor: 'pointer', fontFamily: 'Cinzel, serif',
                                    textTransform: 'uppercase'
                                }}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>
                </div>

                {/* LIST */}
                <div style={{ overflowY: 'auto', flex: 1, padding: '0 20px 20px 20px' }}>
                    {sortedList.length === 0 && (
                        <div style={{ textAlign: 'center', color: '#888', marginTop: 20 }}>
                            No conditions found.
                        </div>
                    )}

                    {sortedList.map(condName => {
                        const activeEntry = safeConds.find(c => c.name === condName);
                        const isActive = !!activeEntry;
                        const level = activeEntry ? activeEntry.level : 0;
                        const iconSrc = getConditionImgSrc(condName);
                        // fallback
                        const emojiIcon = getConditionIcon(condName);

                        return (
                            <div key={condName} style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                borderBottom: '1px solid #444',
                                padding: '8px 5px',
                                background: isActive && activeTab !== 'ACTIVE' ? 'rgba(197, 160, 89, 0.05)' : 'transparent'
                            }}>
                                <div
                                    style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}
                                    onClick={() => onOpenInfo && onOpenInfo(condName)}
                                >
                                    {iconSrc ? (
                                        <img src={iconSrc} alt="" style={{ width: 32, height: 32, objectFit: 'contain' }} />
                                    ) : (
                                        <div style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5em' }}>
                                            {emojiIcon || '⚪'}
                                        </div>
                                    )}
                                    <span style={{
                                        fontWeight: isActive ? 'bold' : 'normal',
                                        color: isActive ? '#c5a059' : '#e0e0e0',
                                        fontSize: '1em'
                                    }}>
                                        {condName}
                                    </span>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <button
                                        onClick={() => adjustCondition(condName, -1)}
                                        style={{
                                            background: '#1a1a1d', border: '1px solid #c5a059', color: '#c5a059',
                                            width: 32, height: 32, borderRadius: 4, cursor: 'pointer', fontSize: '1.2em',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                                        }}
                                    >
                                        -
                                    </button>

                                    <span style={{ width: 25, textAlign: 'center', fontWeight: 'bold', fontSize: '1.1em', color: '#fff' }}>
                                        {level}
                                    </span>

                                    <button
                                        onClick={() => adjustCondition(condName, 1)}
                                        style={{
                                            background: '#1a1a1d', border: '1px solid #c5a059', color: '#c5a059',
                                            width: 32, height: 32, borderRadius: 4, cursor: 'pointer', fontSize: '1.2em',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                                        }}
                                    >
                                        +
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div style={{ padding: 20, borderTop: '1px solid #444' }}>
                    <button onClick={onClose} style={{
                        width: '100%', padding: '8px', background: '#c5a059',
                        border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 'bold', color: '#1a1a1d',
                        fontSize: '0.9em'
                    }}>Close</button>
                </div>
            </div>
        </div>
    );
}
