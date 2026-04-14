import React, { useState } from 'react';
import { useCampaign } from '../../shared/context/CampaignContext';
import BottomSheet from '../../shared/components/BottomSheet';
import { useWindowSize } from '../../shared/hooks/useWindowSize';

// ─── Helpers ────────────────────────────────────────────────────────────────

function getProgressData(campaign) {
    return campaign?.progress || {
        reputation: { factions: [] },
        research: { topics: [] },
        calcifer: { currentProgress: 0, stages: [] },
        materials: { elements: [] },
    };
}

// Returns the active rank object for a faction given its currentPoints
function getActiveRank(faction) {
    const ranks = faction.ranks || [];
    // ranks are sorted by threshold ascending; active = last rank whose threshold <= currentPoints
    const sorted = [...ranks].sort((a, b) => a.threshold - b.threshold);
    let active = null;
    for (const r of sorted) {
        if (faction.currentPoints >= r.threshold) active = r;
    }
    return active;
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

function ProgressBar({ current, max, color = '#4caf50', showText = true }) {
    const pct = max > 0 ? Math.min(100, Math.max(0, (current / max) * 100)) : 0;
    return (
        <div style={{ width: '100%' }}>
            <div style={{
                height: 10, borderRadius: 5, background: '#2a2a2a', overflow: 'hidden', position: 'relative',
            }}>
                <div style={{
                    width: `${pct}%`, height: '100%',
                    background: color, borderRadius: 5,
                    transition: 'width 0.4s ease',
                }} />
            </div>
            {showText && (
                <div style={{ fontSize: '0.75em', color: '#888', marginTop: 3, textAlign: 'right' }}>
                    {current} / {max}
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
    const activeRank = selectedFaction ? getActiveRank(selectedFaction) : null;
    const unlockedPerks = activeRank?.perks || [];

    if (factions.length === 0) {
        return <EmptyState icon="🤝" text="No factions tracked yet." />;
    }

    return (
        <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {factions.map(faction => {
                const rank = getActiveRank(faction);
                const isPositive = (faction.currentPoints || 0) >= 0;
                const barColor = isPositive ? '#4caf50' : '#e53935';
                const max = faction.maxPoints || 10;
                const current = Math.abs(faction.currentPoints || 0);
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
                        <ProgressBar current={current} max={max} color={barColor} showText={false} />
                    </button>
                );
            })}

            <BottomSheet
                isOpen={!!selectedFaction}
                onClose={() => setSelected(null)}
                title={selectedFaction?.name}
            >
                {selectedFaction && (
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
                                    {selectedFaction.currentPoints || 0} / {selectedFaction.maxPoints || 10} points
                                </div>
                            </div>
                        </div>
                        <ProgressBar
                            current={Math.abs(selectedFaction.currentPoints || 0)}
                            max={selectedFaction.maxPoints || 10}
                            color={(selectedFaction.currentPoints || 0) >= 0 ? '#4caf50' : '#e53935'}
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
                )}
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

    return (
        <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {topics.map(topic => {
                const maxPts = topic.maxPoints || 10;
                const revealedCount = (topic.infoPoints || []).filter(p => p.revealed).length;
                const totalCount = (topic.infoPoints || []).length;
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
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                            <div>
                                <div style={{ color: '#e8e8e8', fontWeight: 'bold', fontSize: '0.95em' }}>
                                    {topic.name || 'Unnamed Topic'}
                                </div>
                                <div style={{ color: '#888', fontSize: '0.78em', marginTop: 2 }}>
                                    {totalCount > 0 ? `${revealedCount}/${totalCount} clues revealed` : 'No clues'}
                                    {topic.dcRevealed && topic.dc
                                        ? ` · DC ${topic.dc}`
                                        : topic.dcRevealed ? '' : ' · DC ???'}
                                </div>
                            </div>
                            <div style={{ color: '#c5a059', fontSize: '0.85em', fontWeight: 'bold', textAlign: 'right' }}>
                                <div>{topic.currentPoints || 0} pts</div>
                            </div>
                        </div>
                        <ProgressBar
                            current={topic.currentPoints || 0}
                            max={maxPts}
                            color="#3b82f6"
                            showText={false}
                        />
                    </button>
                );
            })}

            <BottomSheet
                isOpen={!!selectedTopic}
                onClose={() => setSelected(null)}
                title={selectedTopic?.name}
            >
                {selectedTopic && (
                    <div style={{ padding: '0 16px 24px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                            <div style={{ color: '#888', fontSize: '0.85em' }}>
                                Research Points: <span style={{ color: '#c5a059', fontWeight: 'bold' }}>
                                    {selectedTopic.currentPoints || 0} / {selectedTopic.maxPoints || 10}
                                </span>
                            </div>
                            <div style={{ color: '#888', fontSize: '0.85em' }}>
                                DC: <span style={{ color: selectedTopic.dcRevealed ? '#e8e8e8' : '#555' }}>
                                    {selectedTopic.dcRevealed && selectedTopic.dc ? selectedTopic.dc : '???'}
                                </span>
                            </div>
                        </div>
                        <ProgressBar
                            current={selectedTopic.currentPoints || 0}
                            max={selectedTopic.maxPoints || 10}
                            color="#3b82f6"
                        />
                        {(selectedTopic.infoPoints || []).length > 0 && (
                            <>
                                <div style={{ marginTop: 20, marginBottom: 10, color: '#c5a059', fontWeight: 'bold', fontSize: '0.9em' }}>
                                    REVEALED INFORMATION
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    {(selectedTopic.infoPoints || [])
                                        .filter(p => p.revealed)
                                        .map((pt, i) => (
                                            <div key={pt.id || i} style={{
                                                background: '#1a1a1a', border: '1px solid #2a2a2a',
                                                borderRadius: 8, padding: '10px 12px',
                                                color: '#d4d4d4', fontSize: '0.88em', lineHeight: 1.6,
                                            }}>
                                                {pt.text}
                                            </div>
                                        ))}
                                </div>
                                {(selectedTopic.infoPoints || []).filter(p => p.revealed).length === 0 && (
                                    <div style={{ color: '#555', textAlign: 'center', padding: '16px 0', fontSize: '0.85em' }}>
                                        No information revealed yet.
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                )}
            </BottomSheet>
        </div>
    );
}

// ─── CALCIFER TAB ────────────────────────────────────────────────────────────

function CalciferTab({ data }) {
    const calcifer = data.calcifer || { currentProgress: 0, stages: [] };
    const stages = [...(calcifer.stages || [])].sort((a, b) => a.threshold - b.threshold);
    const currentProgress = calcifer.currentProgress || 0;

    // Determine active stage
    let activeStage = null;
    for (const s of stages) {
        if (currentProgress >= s.threshold) activeStage = s;
    }
    const nextStage = stages.find(s => s.threshold > currentProgress);
    const maxProgress = stages.length > 0 ? Math.max(...stages.map(s => s.threshold)) : 100;
    const pct = maxProgress > 0 ? Math.min(100, (currentProgress / maxProgress) * 100) : 0;

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

            {/* Flame Progress Bar */}
            <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#888', fontSize: '0.8em', marginBottom: 5 }}>
                    <span>Sustenance</span>
                    <span>{currentProgress} / {maxProgress}</span>
                </div>
                <div style={{ height: 14, borderRadius: 7, background: '#1a0800', overflow: 'hidden', border: '1px solid #5a2500' }}>
                    <div style={{
                        width: `${pct}%`, height: '100%',
                        background: 'linear-gradient(90deg, #ea580c, #f97316, #fbbf24)',
                        borderRadius: 7, transition: 'width 0.4s ease',
                    }} />
                </div>
                {/* Stage markers */}
                {stages.length > 1 && (
                    <div style={{ position: 'relative', height: 16, marginTop: 2 }}>
                        {stages.map((s, i) => {
                            const markerPct = maxProgress > 0 ? (s.threshold / maxProgress) * 100 : 0;
                            return (
                                <div key={i} style={{
                                    position: 'absolute', left: `${markerPct}%`,
                                    transform: 'translateX(-50%)',
                                    width: 1, height: 6, background: '#5a2500', top: 0,
                                }} />
                            );
                        })}
                    </div>
                )}
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

    // Get active tier (highest tier whose threshold <= currentProgress)
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
                const maxPts = element.maxProgress || 100;
                const tier = getActiveTier(element);
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
                                {element.currentProgress || 0} / {maxPts}
                            </div>
                        </div>
                        <ProgressBar
                            current={element.currentProgress || 0}
                            max={maxPts}
                            color={color}
                            showText={false}
                        />
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
                    return (
                        <div style={{ padding: '0 16px 24px' }}>
                            <div style={{ marginBottom: 12 }}>
                                <ProgressBar
                                    current={selectedElement.currentProgress || 0}
                                    max={selectedElement.maxProgress || 100}
                                    color={color}
                                />
                            </div>
                            {activeTier && (
                                <div style={{ color, fontSize: '0.9em', fontWeight: 'bold', marginBottom: 16 }}>
                                    Current Tier: {activeTier.name}
                                </div>
                            )}
                            {unlockedItems.length > 0 && (
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
                                                            style={{ color: color, fontSize: '0.78em' }}
                                                        >
                                                            View Details ↗
                                                        </a>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}
                            {unlockedItems.length === 0 && (
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
