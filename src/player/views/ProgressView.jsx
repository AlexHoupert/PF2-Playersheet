import React, { useState } from 'react';
import { useCampaign } from '../../shared/context/CampaignContext';
import BottomSheet from '../../shared/components/BottomSheet';

// ─── Helpers ────────────────────────────────────────────────────────────────

function getProgressData(campaign) {
    return campaign?.progress || {
        reputation: { factions: [] },
        research: { topics: [] },
        calcifer: { currentProgress: 0, stages: [] },
        materials: { elements: [] },
    };
}

// Returns the active rank/stage/tier whose threshold has been met
function getActiveEntry(currentPts, entries) {
    const sorted = [...entries].sort((a, b) => a.threshold - b.threshold);
    let active = null;
    for (const e of sorted) {
        if (currentPts >= e.threshold) active = e;
    }
    return active;
}

/**
 * Computes segment-relative progress between the previous and next threshold.
 * Example: currentPts=23, thresholds=[10,20,40] → prev=20, next=40 → { seg:3, segMax:20 }
 */
function getSegmentProgress(currentPts, thresholds) {
    const sorted = [...thresholds].filter(t => t != null).sort((a, b) => a - b);

    let prev = 0;
    let next = null;
    for (const t of sorted) {
        if (currentPts >= t) prev = t;
        else { next = t; break; }
    }

    if (next === null) {
        // At or past last threshold — show full bar
        const last = sorted[sorted.length - 1] ?? 0;
        const secondLast = sorted.length > 1 ? sorted[sorted.length - 2] : 0;
        const segMax = last - secondLast || 1;
        return { seg: segMax, segMax, atMax: true, prev, next: null };
    }

    const seg = currentPts - prev;
    const segMax = next - prev;
    return { seg, segMax, atMax: false, prev, next };
}

// ─── Sub-Tab Nav ─────────────────────────────────────────────────────────────

const SUBTABS = [
    { id: 'reputation', label: 'Reputation', icon: '🤝' },
    { id: 'research',   label: 'Research',   icon: '📚' },
    { id: 'calcifer',   label: 'Calcifer',   icon: '🔥' },
    { id: 'materials',  label: 'Materials',  icon: '⚗️' },
];

function SubTabBar({ active, onChange }) {
    return (
        <div className="scroll-x" style={{
            display: 'flex', gap: 4, padding: '8px 12px',
            borderBottom: '1px solid #2a2a2a', background: '#141414',
            overflowX: 'auto', flexShrink: 0,
        }}>
            {SUBTABS.map(t => (
                <button
                    key={t.id}
                    onClick={() => onChange(t.id)}
                    style={{
                        padding: '6px 14px', borderRadius: 20, border: 'none',
                        background: active === t.id ? '#c5a059' : '#222',
                        color: active === t.id ? '#111' : '#bbb',
                        fontWeight: active === t.id ? 'bold' : 'normal',
                        fontSize: '0.85em', cursor: 'pointer', whiteSpace: 'nowrap',
                        display: 'flex', alignItems: 'center', gap: 5,
                    }}
                >
                    <span>{t.icon}</span>{t.label}
                </button>
            ))}
        </div>
    );
}

// ─── Progress Bar ────────────────────────────────────────────────────────────

function ProgressBar({ seg, segMax, color = '#4caf50', label }) {
    const pct = segMax > 0 ? Math.min(100, Math.max(0, (seg / segMax) * 100)) : 100;
    return (
        <div style={{ width: '100%' }}>
            <div style={{ height: 10, borderRadius: 5, background: '#2a2a2a', overflow: 'hidden' }}>
                <div style={{
                    width: `${pct}%`, height: '100%',
                    background: color, borderRadius: 5,
                    transition: 'width 0.4s ease',
                }} />
            </div>
            {label !== false && (
                <div style={{ fontSize: '0.75em', color: '#888', marginTop: 3, textAlign: 'right' }}>
                    {seg} / {segMax}
                </div>
            )}
        </div>
    );
}

// ─── REPUTATION TAB ──────────────────────────────────────────────────────────

function ReputationTab({ data }) {
    const [selected, setSelected] = useState(null);
    const factions = data.reputation?.factions || [];

    const selectedFaction = factions.find(f => f.id === selected);
    const activeRank = selectedFaction ? getActiveEntry(Math.abs(selectedFaction.currentPoints || 0), selectedFaction.ranks || []) : null;
    const unlockedPerks = activeRank?.perks || [];

    if (factions.length === 0) {
        return <EmptyState icon="🤝" text="No factions tracked yet." />;
    }

    return (
        <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {factions.map(faction => {
                const rank = getActiveEntry(Math.abs(faction.currentPoints || 0), faction.ranks || []);
                const isPositive = (faction.currentPoints || 0) >= 0;
                const barColor = isPositive ? '#4caf50' : '#e53935';
                const pts = Math.abs(faction.currentPoints || 0);
                const thresholds = (faction.ranks || []).map(r => r.threshold);
                const { seg, segMax } = getSegmentProgress(pts, thresholds);

                return (
                    <button
                        key={faction.id}
                        onClick={() => setSelected(faction.id)}
                        style={{
                            background: '#1a1a1a', border: '1px solid #2a2a2a',
                            borderRadius: 10, padding: '12px 14px', cursor: 'pointer',
                            textAlign: 'left', width: '100%',
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                            {faction.icon && <span style={{ fontSize: '1.4em' }}>{faction.icon}</span>}
                            <div style={{ flex: 1 }}>
                                <div style={{ color: '#e8e8e8', fontWeight: 'bold', fontSize: '0.95em' }}>
                                    {faction.name || 'Unnamed Faction'}
                                </div>
                                {rank && (
                                    <div style={{ color: '#c5a059', fontSize: '0.8em', marginTop: 2 }}>
                                        {rank.title}
                                    </div>
                                )}
                            </div>
                            <div style={{ color: isPositive ? '#4caf50' : '#e53935', fontSize: '0.9em', fontWeight: 'bold' }}>
                                {isPositive ? '+' : '-'}{Math.abs(faction.currentPoints || 0)}
                            </div>
                        </div>
                        <ProgressBar seg={seg} segMax={segMax} color={barColor} label={false} />
                        <div style={{ fontSize: '0.72em', color: '#666', marginTop: 3, textAlign: 'right' }}>
                            {seg} / {segMax}
                        </div>
                    </button>
                );
            })}

            <BottomSheet
                isOpen={!!selectedFaction}
                onClose={() => setSelected(null)}
                title={selectedFaction?.name}
            >
                {selectedFaction && (() => {
                    const isPositive = (selectedFaction.currentPoints || 0) >= 0;
                    const pts = Math.abs(selectedFaction.currentPoints || 0);
                    const thresholds = (selectedFaction.ranks || []).map(r => r.threshold);
                    const { seg, segMax, atMax, next } = getSegmentProgress(pts, thresholds);
                    return (
                        <div style={{ padding: '0 16px 24px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                                {selectedFaction.icon && <span style={{ fontSize: '2em' }}>{selectedFaction.icon}</span>}
                                <div>
                                    {activeRank ? (
                                        <div style={{ color: '#c5a059', fontWeight: 'bold', fontSize: '1.1em' }}>
                                            {activeRank.title}
                                        </div>
                                    ) : (
                                        <div style={{ color: '#888' }}>No rank achieved yet</div>
                                    )}
                                    <div style={{ color: '#888', fontSize: '0.85em', marginTop: 2 }}>
                                        {isPositive ? '+' : '-'}{Math.abs(selectedFaction.currentPoints || 0)} points total
                                        {!atMax && next != null && (
                                            <span> · {next - pts} to next rank</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <ProgressBar
                                seg={seg} segMax={segMax}
                                color={isPositive ? '#4caf50' : '#e53935'}
                            />
                            {unlockedPerks.length > 0 && (
                                <>
                                    <div style={{ marginTop: 20, marginBottom: 10, color: '#c5a059', fontWeight: 'bold', fontSize: '0.9em' }}>
                                        UNLOCKED PERKS
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                        {unlockedPerks.map((perk, i) => (
                                            <div key={i} style={{
                                                background: '#1a1a1a', border: '1px solid #2a2a2a',
                                                borderRadius: 8, padding: '10px 12px',
                                            }}>
                                                <div style={{ color: '#e8e8e8', fontWeight: 'bold', fontSize: '0.9em' }}>
                                                    {perk.name}
                                                </div>
                                                {perk.description && (
                                                    <div style={{ color: '#aaa', fontSize: '0.82em', marginTop: 4, lineHeight: 1.5 }}>
                                                        {perk.description}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}
                            {unlockedPerks.length === 0 && activeRank && (
                                <div style={{ marginTop: 16, color: '#666', fontSize: '0.85em', textAlign: 'center' }}>
                                    No perks for this rank.
                                </div>
                            )}
                        </div>
                    );
                })()}
            </BottomSheet>
        </div>
    );
}

// ─── RESEARCH TAB ────────────────────────────────────────────────────────────

function ResearchTab({ data }) {
    const [selected, setSelected] = useState(null);
    const topics = data.research?.topics || [];
    const selectedTopic = topics.find(t => t.id === selected);

    if (topics.length === 0) {
        return <EmptyState icon="📚" text="No research topics yet." />;
    }

    const dcMod = selectedTopic?.dcModified;
    const dcModColor = dcMod < 0 ? '#4caf50' : dcMod > 0 ? '#e53935' : '#888';

    return (
        <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {topics.map(topic => {
                const revealedCount = (topic.infoPoints || []).filter(p => p.revealed).length;
                const mod = topic.dcModified;
                return (
                    <button
                        key={topic.id}
                        onClick={() => setSelected(topic.id)}
                        style={{
                            background: '#1a1a1a', border: '1px solid #2a2a2a',
                            borderRadius: 10, padding: '12px 14px', cursor: 'pointer',
                            textAlign: 'left', width: '100%',
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div>
                                <div style={{ color: '#e8e8e8', fontWeight: 'bold', fontSize: '0.95em' }}>
                                    {topic.name || 'Unnamed Topic'}
                                </div>
                                <div style={{ color: '#888', fontSize: '0.78em', marginTop: 3, display: 'flex', gap: 10 }}>
                                    {revealedCount > 0
                                        ? <span>{revealedCount} clue{revealedCount !== 1 ? 's' : ''} revealed</span>
                                        : <span>No clues revealed</span>}
                                    {topic.dcRevealed && topic.dc != null
                                        ? <span>DC {topic.dc}</span>
                                        : <span>DC ???</span>}
                                </div>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
                                <div style={{ color: '#c5a059', fontSize: '0.85em', fontWeight: 'bold' }}>
                                    {topic.currentPoints || 0} pts
                                </div>
                                {mod != null && mod !== 0 && (
                                    <div style={{
                                        color: mod < 0 ? '#4caf50' : '#e53935',
                                        fontSize: '0.78em', fontWeight: 'bold',
                                    }}>
                                        mod {mod > 0 ? '+' : ''}{mod}
                                    </div>
                                )}
                            </div>
                        </div>
                    </button>
                );
            })}

            <BottomSheet
                isOpen={!!selectedTopic}
                onClose={() => setSelected(null)}
                title={selectedTopic?.name}
            >
                {selectedTopic && (() => {
                    const mod = selectedTopic.dcModified;
                    const modColor = mod != null && mod < 0 ? '#4caf50' : mod != null && mod > 0 ? '#e53935' : '#888';
                    const revealedPts = (selectedTopic.infoPoints || []).filter(p => p.revealed);
                    return (
                        <div style={{ padding: '0 16px 24px' }}>
                            {/* Stats row */}
                            <div style={{
                                display: 'flex', gap: 16, marginBottom: 20,
                                padding: '12px 14px', background: '#1a1a1a',
                                borderRadius: 10, border: '1px solid #2a2a2a',
                                flexWrap: 'wrap',
                            }}>
                                <div>
                                    <div style={{ color: '#666', fontSize: '0.72em', marginBottom: 2 }}>RESEARCH PTS</div>
                                    <div style={{ color: '#c5a059', fontWeight: 'bold', fontSize: '1.05em' }}>
                                        {selectedTopic.currentPoints || 0}
                                    </div>
                                </div>
                                <div>
                                    <div style={{ color: '#666', fontSize: '0.72em', marginBottom: 2 }}>DC</div>
                                    <div style={{ color: selectedTopic.dcRevealed ? '#e8e8e8' : '#444', fontWeight: 'bold', fontSize: '1.05em' }}>
                                        {selectedTopic.dcRevealed && selectedTopic.dc != null ? selectedTopic.dc : '???'}
                                    </div>
                                </div>
                                {mod != null && (
                                    <div>
                                        <div style={{ color: '#666', fontSize: '0.72em', marginBottom: 2 }}>DC MODIFIED</div>
                                        <div style={{ color: modColor, fontWeight: 'bold', fontSize: '1.05em' }}>
                                            {mod > 0 ? '+' : ''}{mod}
                                        </div>
                                    </div>
                                )}
                                <div>
                                    <div style={{ color: '#666', fontSize: '0.72em', marginBottom: 2 }}>CLUES</div>
                                    <div style={{ color: '#e8e8e8', fontWeight: 'bold', fontSize: '1.05em' }}>
                                        {revealedPts.length} revealed
                                    </div>
                                </div>
                            </div>

                            {/* Revealed info points */}
                            {revealedPts.length > 0 ? (
                                <>
                                    <div style={{ marginBottom: 10, color: '#c5a059', fontWeight: 'bold', fontSize: '0.9em' }}>
                                        REVEALED INFORMATION
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                        {revealedPts.map((pt, i) => (
                                            <div key={pt.id || i} style={{
                                                background: '#1a1a1a', border: '1px solid #2a2a2a',
                                                borderRadius: 8, padding: '10px 12px',
                                                color: '#d4d4d4', fontSize: '0.88em', lineHeight: 1.6,
                                            }}>
                                                {pt.text}
                                            </div>
                                        ))}
                                    </div>
                                </>
                            ) : (
                                <div style={{ color: '#555', textAlign: 'center', padding: '16px 0', fontSize: '0.85em' }}>
                                    No information revealed yet.
                                </div>
                            )}
                        </div>
                    );
                })()}
            </BottomSheet>
        </div>
    );
}

// ─── CALCIFER TAB ────────────────────────────────────────────────────────────

function CalciferTab({ data }) {
    const calcifer = data.calcifer || { currentProgress: 0, stages: [] };
    const stages = [...(calcifer.stages || [])].sort((a, b) => a.threshold - b.threshold);
    const currentProgress = calcifer.currentProgress || 0;

    const activeStage = getActiveEntry(currentProgress, stages);
    const nextStage = stages.find(s => s.threshold > currentProgress);
    const thresholds = stages.map(s => s.threshold);
    const { seg, segMax, atMax } = getSegmentProgress(currentProgress, thresholds);

    return (
        <div style={{ padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Flame Header */}
            <div style={{
                background: 'linear-gradient(135deg, #1a0800 0%, #2d1200 50%, #1a0800 100%)',
                border: '1px solid #5a2500',
                borderRadius: 14, padding: '20px 16px', textAlign: 'center',
            }}>
                <div style={{ fontSize: '3em', marginBottom: 8 }}>
                    {activeStage?.icon || '🔥'}
                </div>
                <div style={{ color: '#f97316', fontWeight: 'bold', fontSize: '1.1em', marginBottom: 4 }}>
                    {activeStage ? activeStage.name : 'Not yet awakened'}
                </div>
                <div style={{ color: '#888', fontSize: '0.82em' }}>
                    {nextStage
                        ? `Next: ${nextStage.name} at ${nextStage.threshold} pts`
                        : activeStage ? 'Maximum stage reached' : 'Feed Calcifer to begin'}
                </div>
            </div>

            {/* Flame Progress Bar — segment-relative */}
            <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#888', fontSize: '0.8em', marginBottom: 5 }}>
                    <span>Sustenance</span>
                    <span>{seg} / {segMax}</span>
                </div>
                <div style={{ height: 14, borderRadius: 7, background: '#1a0800', overflow: 'hidden', border: '1px solid #5a2500' }}>
                    <div style={{
                        width: `${segMax > 0 ? Math.min(100, (seg / segMax) * 100) : 100}%`,
                        height: '100%',
                        background: 'linear-gradient(90deg, #ea580c, #f97316, #fbbf24)',
                        borderRadius: 7, transition: 'width 0.4s ease',
                    }} />
                </div>
            </div>

            {/* Creature Card */}
            {activeStage?.creature && (
                <div style={{
                    background: '#1a1a1a', border: '1px solid #2a2a2a',
                    borderRadius: 10, padding: '12px 14px',
                }}>
                    <div style={{ color: '#c5a059', fontSize: '0.8em', fontWeight: 'bold', marginBottom: 8 }}>
                        CURRENT FORM
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span style={{ fontSize: '2em' }}>{activeStage.creature.icon || '🔥'}</span>
                        <div>
                            <div style={{ color: '#e8e8e8', fontWeight: 'bold' }}>{activeStage.creature.name}</div>
                            {activeStage.creature.level !== undefined && (
                                <div style={{ color: '#888', fontSize: '0.8em' }}>Level {activeStage.creature.level}</div>
                            )}
                        </div>
                    </div>
                    {activeStage.creature.description && (
                        <div style={{ color: '#aaa', fontSize: '0.82em', marginTop: 8, lineHeight: 1.5 }}>
                            {activeStage.creature.description}
                        </div>
                    )}
                </div>
            )}

            {/* Boons */}
            {(activeStage?.boons || []).length > 0 && (
                <div>
                    <div style={{ color: '#c5a059', fontWeight: 'bold', fontSize: '0.9em', marginBottom: 10 }}>
                        ACTIVE BOONS
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {(activeStage.boons || []).map((boon, i) => (
                            <div key={i} style={{
                                background: '#180e00', border: '1px solid #5a2500',
                                borderRadius: 8, padding: '10px 12px',
                            }}>
                                <div style={{ color: '#f97316', fontWeight: 'bold', fontSize: '0.9em' }}>{boon.name}</div>
                                {boon.description && (
                                    <div style={{ color: '#aaa', fontSize: '0.82em', marginTop: 4, lineHeight: 1.5 }}>
                                        {boon.description}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {stages.length === 0 && (
                <EmptyState icon="🔥" text="No stages configured yet." />
            )}
        </div>
    );
}

// ─── MATERIALS TAB ───────────────────────────────────────────────────────────

const ELEMENT_COLORS = {
    fire:  '#ef4444',
    water: '#3b82f6',
    wind:  '#a3e635',
    earth: '#a16207',
    wood:  '#22c55e',
    metal: '#94a3b8',
};

function MaterialsTab({ data }) {
    const [selected, setSelected] = useState(null);
    const elements = data.materials?.elements || [];
    const selectedElement = elements.find(e => e.id === selected);

    if (elements.length === 0) {
        return <EmptyState icon="⚗️" text="No elements configured yet." />;
    }

    function getActiveTier(element) {
        const tiers = [...(element.tiers || [])].sort((a, b) => a.threshold - b.threshold);
        let active = null;
        for (const t of tiers) {
            if ((element.currentProgress || 0) >= t.threshold) active = t;
        }
        return active;
    }

    const activeTier = selectedElement ? getActiveTier(selectedElement) : null;
    const unlockedItems = activeTier?.items?.filter(i => i.revealed) || [];

    return (
        <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {elements.map(element => {
                const color = element.color || ELEMENT_COLORS[element.name?.toLowerCase()] || '#c5a059';
                const tier = getActiveTier(element);
                const thresholds = (element.tiers || []).map(t => t.threshold);
                const { seg, segMax } = getSegmentProgress(element.currentProgress || 0, thresholds);

                return (
                    <button
                        key={element.id}
                        onClick={() => setSelected(element.id)}
                        style={{
                            background: '#1a1a1a', border: `1px solid ${color}33`,
                            borderRadius: 10, padding: '12px 14px', cursor: 'pointer',
                            textAlign: 'left', width: '100%',
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                            {element.icon && <span style={{ fontSize: '1.4em' }}>{element.icon}</span>}
                            <div style={{ flex: 1 }}>
                                <div style={{ color: '#e8e8e8', fontWeight: 'bold', fontSize: '0.95em' }}>
                                    {element.name || 'Unknown Element'}
                                </div>
                                {tier && (
                                    <div style={{ color, fontSize: '0.78em', marginTop: 2 }}>
                                        {tier.name}
                                    </div>
                                )}
                            </div>
                            <div style={{ color: '#888', fontSize: '0.82em' }}>
                                {seg} / {segMax}
                            </div>
                        </div>
                        <ProgressBar seg={seg} segMax={segMax} color={color} label={false} />
                    </button>
                );
            })}

            <BottomSheet
                isOpen={!!selectedElement}
                onClose={() => setSelected(null)}
                title={selectedElement ? `${selectedElement.icon || ''} ${selectedElement.name}`.trim() : ''}
            >
                {selectedElement && (() => {
                    const color = selectedElement.color || ELEMENT_COLORS[selectedElement.name?.toLowerCase()] || '#c5a059';
                    const thresholds = (selectedElement.tiers || []).map(t => t.threshold);
                    const { seg, segMax, atMax, next } = getSegmentProgress(selectedElement.currentProgress || 0, thresholds);
                    return (
                        <div style={{ padding: '0 16px 24px' }}>
                            <div style={{ marginBottom: 4 }}>
                                <ProgressBar seg={seg} segMax={segMax} color={color} />
                            </div>
                            {!atMax && next != null && (
                                <div style={{ color: '#666', fontSize: '0.78em', marginBottom: 12 }}>
                                    {next - (selectedElement.currentProgress || 0)} more to next tier
                                </div>
                            )}
                            {activeTier && (
                                <div style={{ color, fontSize: '0.9em', fontWeight: 'bold', marginBottom: 16 }}>
                                    Current Tier: {activeTier.name}
                                </div>
                            )}
                            {unlockedItems.length > 0 ? (
                                <>
                                    <div style={{ marginBottom: 10, color: '#c5a059', fontWeight: 'bold', fontSize: '0.9em' }}>
                                        UNLOCKED ITEMS
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                        {unlockedItems.map((item, i) => (
                                            <div key={item.id || i} style={{
                                                background: '#1a1a1a', border: `1px solid ${color}44`,
                                                borderRadius: 8, padding: '10px 12px',
                                                display: 'flex', alignItems: 'center', gap: 10,
                                            }}>
                                                <span style={{ fontSize: '1.2em' }}>🎁</span>
                                                <div>
                                                    <div style={{ color: '#e8e8e8', fontWeight: 'bold', fontSize: '0.9em' }}>
                                                        {item.name}
                                                    </div>
                                                    {item.link && (
                                                        <a
                                                            href={item.link}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            style={{ color, fontSize: '0.78em' }}
                                                        >
                                                            View Details ↗
                                                        </a>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            ) : (
                                <div style={{ color: '#555', textAlign: 'center', padding: '16px 0', fontSize: '0.85em' }}>
                                    No items unlocked yet.
                                </div>
                            )}
                        </div>
                    );
                })()}
            </BottomSheet>
        </div>
    );
}

// ─── Empty State ─────────────────────────────────────────────────────────────

function EmptyState({ icon, text }) {
    return (
        <div style={{ padding: 40, textAlign: 'center', color: '#555' }}>
            <div style={{ fontSize: '2.5em', marginBottom: 12 }}>{icon}</div>
            <div style={{ fontSize: '0.9em' }}>{text}</div>
        </div>
    );
}

// ─── Main View ───────────────────────────────────────────────────────────────

export default function ProgressView() {
    const { activeCampaign } = useCampaign();
    const [subTab, setSubTab] = useState('reputation');
    const data = getProgressData(activeCampaign);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', background: '#111' }}>
            <SubTabBar active={subTab} onChange={setSubTab} />
            <div style={{ flex: 1, overflowY: 'auto' }}>
                {subTab === 'reputation' && <ReputationTab data={data} />}
                {subTab === 'research'   && <ResearchTab   data={data} />}
                {subTab === 'calcifer'   && <CalciferTab   data={data} />}
                {subTab === 'materials'  && <MaterialsTab  data={data} />}
            </div>
        </div>
    );
}
