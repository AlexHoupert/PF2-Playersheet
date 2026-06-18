import React, { useState, useMemo } from 'react';
import { ELEMENTS, BACKLASH_TIERS, BACKLASH_LABELS, BACKLASH_COLORS } from './pactsData';
import { selectDeviantAbility } from '../shared/db/selectors/abilitySelectors';
import { selectPact } from '../shared/db/selectors/pactSelectors';

/**
 * Player-facing pact view.
 * Shows the character's assigned pact, ability choices per level group,
 * unlocked awakenings, and backlash reference.
 *
 * Props:
 *   character  — character object (has .pact: { pactId, choices, unlockedAwakenings })
 *   db         — full db for selector-backed pact and deviant ability reads
 */
export default function PactView({ character, db }) {
    const pactData = character?.pact || {};
    const [expandedAbility, setExpandedAbility] = useState(null);

    const assignedPact = useMemo(() => {
        return selectPact(db, pactData.pactId);
    }, [pactData.pactId, db]);

    if (!assignedPact) {
        return (
            <div style={{ padding: 20, textAlign: 'center', color: '#555' }}>
                No elemental pact assigned.
            </div>
        );
    }

    const el = ELEMENTS[assignedPact.element] || ELEMENTS.Fire;

    const resolveAbility = (id) => selectDeviantAbility(db, id);

    return (
        <div style={{ padding: '12px 0', display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Pact Header */}
            <div style={{ background: el.bg, border: `1px solid ${el.dim}`, borderRadius: 8, padding: '12px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                    <span style={{ fontSize: '1.5em' }}>{el.icon}</span>
                    <div>
                        <div style={{ color: el.color, fontFamily: 'Cinzel, serif', fontSize: '1em', fontWeight: 'bold' }}>
                            {assignedPact.name}
                        </div>
                        <div style={{ fontSize: '0.75em', color: '#888' }}>{assignedPact.element} Element</div>
                    </div>
                </div>
                {assignedPact.description && (
                    <div
                        style={{ fontSize: '0.82em', color: '#bbb', marginTop: 8, lineHeight: 1.5 }}
                        dangerouslySetInnerHTML={{ __html: assignedPact.description }}
                    />
                )}
            </div>

            {/* Ability Groups */}
            {(assignedPact.abilityGroups || []).length > 0 && (
                <div>
                    <div style={{ fontSize: '0.7em', color: '#888', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
                        Deviant Abilities
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {assignedPact.abilityGroups.map((group, gIdx) => {
                            const chosenId = pactData.choices?.[gIdx];
                            const abilities = (group.abilityIds || []).map(resolveAbility).filter(Boolean);
                            if (abilities.length === 0) return null;
                            return (
                                <div key={gIdx}>
                                    {group.label && (
                                        <div style={{ fontSize: '0.72em', color: el.color, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                            {group.label}
                                        </div>
                                    )}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                        {abilities.map(ab => {
                                            const isChosen = chosenId === ab.id;
                                            const unlockedLevel = pactData.unlockedAwakenings?.[ab.id] || 0;
                                            const isExpanded = expandedAbility === ab.id;
                                            return (
                                                <div
                                                    key={ab.id}
                                                    style={{
                                                        background: isChosen ? el.bg : '#1a1a1d',
                                                        border: `1px solid ${isChosen ? el.color : '#2a2a2a'}`,
                                                        borderRadius: 6, overflow: 'hidden'
                                                    }}
                                                >
                                                    <div
                                                        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', cursor: 'pointer' }}
                                                        onClick={() => setExpandedAbility(isExpanded ? null : ab.id)}
                                                    >
                                                        <div style={{ flex: 1 }}>
                                                            <span style={{ color: isChosen ? el.color : '#aaa', fontWeight: isChosen ? 'bold' : 'normal', fontSize: '0.9em' }}>
                                                                {isChosen && '✓ '}{ab.name}
                                                            </span>
                                                            <span style={{ color: '#555', fontSize: '0.75em', marginLeft: 6 }}>Lv {ab.level}</span>
                                                        </div>
                                                        {unlockedLevel > 0 && (
                                                            <div style={{ display: 'flex', gap: 4 }}>
                                                                {[1, 2].filter(n => n <= unlockedLevel).map(n => (
                                                                    <span key={n} style={{ fontSize: '0.7em', padding: '1px 5px', background: '#1a3a1a', border: '1px solid #4caf50', color: '#81c784', borderRadius: 10 }}>
                                                                        Aw{n}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        )}
                                                        <span style={{ color: '#555', fontSize: '0.75em' }}>{isExpanded ? '▲' : '▼'}</span>
                                                    </div>

                                                    {isExpanded && (
                                                        <div style={{ borderTop: `1px solid ${isChosen ? el.dim : '#222'}`, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                                                            {/* Main description */}
                                                            {ab.description && (
                                                                <div
                                                                    style={{ fontSize: '0.82em', color: '#ccc', lineHeight: 1.5 }}
                                                                    dangerouslySetInnerHTML={{ __html: ab.description }}
                                                                />
                                                            )}

                                                            {/* Awakenings */}
                                                            {[1, 2].map(awLevel => {
                                                                const awKey = `awakening${awLevel}`;
                                                                const aw = ab[awKey];
                                                                if (!aw?.name) return null;
                                                                const isUnlocked = unlockedLevel >= awLevel;
                                                                return (
                                                                    <div
                                                                        key={awLevel}
                                                                        style={{
                                                                            background: isUnlocked ? '#0a1a0a' : '#0f0f0f',
                                                                            border: `1px solid ${isUnlocked ? '#2a4a2a' : '#222'}`,
                                                                            borderRadius: 4, padding: '8px 10px',
                                                                            opacity: isUnlocked ? 1 : 0.45
                                                                        }}
                                                                    >
                                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                                                            <span style={{ fontSize: '0.7em', padding: '1px 6px', background: isUnlocked ? '#1a3a1a' : '#1a1a1d', border: `1px solid ${isUnlocked ? '#4caf50' : '#444'}`, color: isUnlocked ? '#81c784' : '#555', borderRadius: 10 }}>
                                                                                Awakening {awLevel}
                                                                            </span>
                                                                            <span style={{ fontSize: '0.85em', color: isUnlocked ? '#c8e6c9' : '#666', fontWeight: 'bold' }}>{aw.name}</span>
                                                                            {aw.levelNote && <span style={{ fontSize: '0.7em', color: '#555' }}>({aw.levelNote})</span>}
                                                                        </div>
                                                                        {aw.description && (
                                                                            <div
                                                                                style={{ fontSize: '0.8em', color: isUnlocked ? '#bbb' : '#555', lineHeight: 1.5 }}
                                                                                dangerouslySetInnerHTML={{ __html: aw.description }}
                                                                            />
                                                                        )}
                                                                        {!isUnlocked && (
                                                                            <div style={{ fontSize: '0.72em', color: '#444', marginTop: 4 }}>🔒 Not yet unlocked</div>
                                                                        )}
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Backlash Reference */}
            <div style={{ background: '#1a1010', border: '1px solid #3a1a1a', borderRadius: 6, padding: '10px 12px' }}>
                <div style={{ fontSize: '0.7em', color: '#ef9a9a', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
                    Backlash Reference
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {BACKLASH_TIERS.map(tier => {
                        const tierData = assignedPact.backlash?.[tier] || {};
                        const tierColor = BACKLASH_COLORS[tier];
                        const effects = tierData.effects || [];
                        return (
                            <div key={tier} style={{ borderLeft: `2px solid ${tierColor}`, paddingLeft: 10 }}>
                                <div style={{ fontSize: '0.75em', color: tierColor, fontWeight: 'bold', marginBottom: 2 }}>
                                    {BACKLASH_LABELS[tier]}
                                </div>
                                {effects.length > 0 && (
                                    <div style={{ fontSize: '0.75em', color: '#888', marginBottom: tierData.description ? 4 : 0 }}>
                                        {effects.map((e, i) => (
                                            <span key={i}>{i > 0 ? ', ' : ''}{e.conditionName}{e.value ? ` ${e.value}` : ''}</span>
                                        ))}
                                    </div>
                                )}
                                {tierData.description && (
                                    <div
                                        style={{ fontSize: '0.78em', color: '#aaa', lineHeight: 1.4 }}
                                        dangerouslySetInnerHTML={{ __html: tierData.description }}
                                    />
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
