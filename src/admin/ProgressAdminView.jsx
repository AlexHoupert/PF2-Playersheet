import React, { useState } from 'react';
import { useCampaign } from '../shared/context/CampaignContext';
import { getProgress as getProgressState, splitProgressEntries } from '../shared/db/domain/progressReducers';
import { createInstanceId } from '../shared/db/domain/inventoryReducers';

function getProgress(campaign) {
    return {
        reputation: { factions: [], ...(campaign?.progress?.reputation || {}) },
        research:   { topics: [],   ...(campaign?.progress?.research   || {}) },
        calcifer:   { currentProgress: 0, stages: [], ...(campaign?.progress?.calcifer || {}) },
        materials:  { elements: [],  ...(campaign?.progress?.materials  || {}) },
    };
}

// ─── Shared UI Atoms ─────────────────────────────────────────────────────────

function SectionHeader({ title, onAdd, addLabel = '+ Add' }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <h3 style={{ margin: 0, color: '#c5a059', fontSize: '1em' }}>{title}</h3>
            {onAdd && (
                <button className="btn-add-condition" style={{ margin: 0 }} onClick={onAdd}>
                    {addLabel}
                </button>
            )}
        </div>
    );
}

function Field({ label, children, style = {} }) {
    return (
        <div style={{ marginBottom: 10, ...style }}>
            {label && <label style={{ display: 'block', color: '#888', fontSize: '0.78em', marginBottom: 4 }}>{label}</label>}
            {children}
        </div>
    );
}

function Input({ value, onChange, type = 'text', placeholder, style = {} }) {
    return (
        <input
            className="modal-input"
            type={type}
            value={value ?? ''}
            onChange={e => onChange(type === 'number' ? (parseFloat(e.target.value) || 0) : e.target.value)}
            placeholder={placeholder}
            style={{ width: '100%', ...style }}
        />
    );
}

function Textarea({ value, onChange, placeholder, rows = 3 }) {
    return (
        <textarea
            className="modal-input"
            rows={rows}
            value={value ?? ''}
            onChange={e => onChange(e.target.value)}
            placeholder={placeholder}
            style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit' }}
        />
    );
}

function Card({ children, style = {} }) {
    return (
        <div style={{
            background: '#1a1a1a', border: '1px solid #2a2a2a',
            borderRadius: 10, padding: '12px 14px', marginBottom: 10,
            ...style,
        }}>
            {children}
        </div>
    );
}

function Toggle({ checked, onChange, label }) {
    return (
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none' }}>
            <div
                onClick={() => onChange(!checked)}
                style={{
                    width: 36, height: 20, borderRadius: 10,
                    background: checked ? '#4caf50' : '#333',
                    position: 'relative', transition: 'background 0.2s', flexShrink: 0,
                }}
            >
                <div style={{
                    position: 'absolute', top: 3, left: checked ? 18 : 3,
                    width: 14, height: 14, borderRadius: 7, background: '#fff',
                    transition: 'left 0.2s',
                }} />
            </div>
            {label && <span style={{ color: '#aaa', fontSize: '0.85em' }}>{label}</span>}
        </label>
    );
}

function DeleteBtn({ onClick }) {
    return (
        <button
            onClick={onClick}
            title="Delete"
            style={{
                background: 'none', border: 'none', color: '#666',
                cursor: 'pointer', fontSize: '1em', padding: '2px 6px',
                flexShrink: 0,
            }}
        >
            🗑
        </button>
    );
}

function ArchivedEntries({ title, entries, onRestore }) {
    if (!entries?.length) return null;
    return (
        <div style={{ marginTop: 18, paddingTop: 12, borderTop: '1px solid #2a2a2a' }}>
            <div style={{ color: '#777', fontSize: '0.78em', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
                {title}
            </div>
            {entries.map(entry => (
                <div key={entry.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', background: '#141414', border: '1px solid #252525', borderRadius: 6, marginBottom: 6 }}>
                    <span style={{ flex: 1, color: '#999', fontSize: '0.85em' }}>{entry.icon ? `${entry.icon} ` : ''}{entry.name || entry.title || '(untitled)'}</span>
                    <button
                        onClick={() => onRestore(entry.id)}
                        style={{ padding: '4px 9px', background: '#1a2a1a', border: '1px solid #2e7d32', color: '#81c784', borderRadius: 4, cursor: 'pointer', fontSize: '0.78em' }}
                    >
                        Restore
                    </button>
                </div>
            ))}
        </div>
    );
}

// ─── Sub-Tab Nav ─────────────────────────────────────────────────────────────

const SUBTABS = [
    { id: 'reputation', label: '🤝 Reputation' },
    { id: 'research',   label: '📚 Research'   },
    { id: 'calcifer',   label: '🔥 Calcifer'   },
    { id: 'materials',  label: '⚗️ Materials'  },
];

function SubTabBar({ active, onChange }) {
    return (
        <div style={{
            display: 'flex', gap: 4, padding: '0 0 16px 0',
            borderBottom: '1px solid #2a2a2a', marginBottom: 16, flexWrap: 'wrap',
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
                        fontSize: '0.85em', cursor: 'pointer',
                    }}
                >
                    {t.label}
                </button>
            ))}
        </div>
    );
}

// ─── REPUTATION ADMIN ─────────────────────────────────────────────────────────

function ReputationAdmin({ progress, save, archiveEntry, restoreEntry }) {
    const [expandedFaction, setExpandedFaction] = useState(null);
    const [expandedRank, setExpandedRank] = useState({});
    const { active: factions, archived: archivedFactions } = splitProgressEntries(progress, 'reputation');
    const allFactions = progress.reputation.factions;

    const updateFactions = (fn) => {
        const next = [...allFactions];
        fn(next);
        save({ reputation: { ...progress.reputation, factions: next } });
    };

    const addFaction = () => {
        updateFactions(f => f.push({
            id: createInstanceId('pid'), name: 'New Faction', icon: '🤝',
            currentPoints: 0, maxPoints: 10, ranks: [],
        }));
    };

    const updateFaction = (id, patch) => {
        updateFactions(f => {
            const i = f.findIndex(x => x.id === id);
            if (i >= 0) f[i] = { ...f[i], ...patch };
        });
    };

    const deleteFaction = (id) => {
        if (!window.confirm('Archive this faction? It can be restored later.')) return;
        archiveEntry('reputation', id);
        if (expandedFaction === id) setExpandedFaction(null);
    };

    const addRank = (factionId) => {
        updateFactions(f => {
            const faction = f.find(x => x.id === factionId);
            if (faction) {
                if (!faction.ranks) faction.ranks = [];
                faction.ranks.push({ id: createInstanceId('pid'), threshold: 0, title: 'New Rank', perks: [] });
            }
        });
    };

    const updateRank = (factionId, rankId, patch) => {
        updateFactions(f => {
            const faction = f.find(x => x.id === factionId);
            if (faction) {
                const ri = faction.ranks.findIndex(r => r.id === rankId);
                if (ri >= 0) faction.ranks[ri] = { ...faction.ranks[ri], ...patch };
            }
        });
    };

    const deleteRank = (factionId, rankId) => {
        updateFactions(f => {
            const faction = f.find(x => x.id === factionId);
            if (faction) faction.ranks = faction.ranks.filter(r => r.id !== rankId);
        });
    };

    const addPerk = (factionId, rankId) => {
        updateFactions(f => {
            const faction = f.find(x => x.id === factionId);
            if (faction) {
                const rank = faction.ranks.find(r => r.id === rankId);
                if (rank) {
                    if (!rank.perks) rank.perks = [];
                    rank.perks.push({ id: createInstanceId('pid'), name: 'New Perk', description: '' });
                }
            }
        });
    };

    const updatePerk = (factionId, rankId, perkId, patch) => {
        updateFactions(f => {
            const faction = f.find(x => x.id === factionId);
            if (faction) {
                const rank = faction.ranks.find(r => r.id === rankId);
                if (rank) {
                    const pi = rank.perks.findIndex(p => p.id === perkId);
                    if (pi >= 0) rank.perks[pi] = { ...rank.perks[pi], ...patch };
                }
            }
        });
    };

    const deletePerk = (factionId, rankId, perkId) => {
        updateFactions(f => {
            const faction = f.find(x => x.id === factionId);
            if (faction) {
                const rank = faction.ranks.find(r => r.id === rankId);
                if (rank) rank.perks = rank.perks.filter(p => p.id !== perkId);
            }
        });
    };

    return (
        <div>
            <SectionHeader title="Factions" onAdd={addFaction} addLabel="+ Faction" />
            {factions.length === 0 && (
                <div style={{ color: '#555', textAlign: 'center', padding: '24px 0', fontSize: '0.85em' }}>No factions yet. Add one above.</div>
            )}
            {factions.map(faction => (
                <Card key={faction.id}>
                    {/* Faction Header */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                        <button
                            onClick={() => setExpandedFaction(expandedFaction === faction.id ? null : faction.id)}
                            style={{ background: 'none', border: 'none', color: '#c5a059', cursor: 'pointer', fontSize: '1.1em', padding: 0 }}
                        >
                            {expandedFaction === faction.id ? '▼' : '▶'}
                        </button>
                        <span style={{ color: '#e8e8e8', fontWeight: 'bold', flex: 1 }}>
                            {faction.icon} {faction.name || 'Unnamed'}
                        </span>
                        <span style={{ color: '#888', fontSize: '0.85em' }}>
                            {faction.currentPoints || 0}/{faction.maxPoints || 10}
                        </span>
                        <DeleteBtn onClick={() => deleteFaction(faction.id)} />
                    </div>

                    {expandedFaction === faction.id && (
                        <div style={{ borderTop: '1px solid #2a2a2a', paddingTop: 12 }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                <Field label="Name">
                                    <Input value={faction.name} onChange={v => updateFaction(faction.id, { name: v })} placeholder="Faction name" />
                                </Field>
                                <Field label="Icon (emoji)">
                                    <Input value={faction.icon} onChange={v => updateFaction(faction.id, { icon: v })} placeholder="🤝" />
                                </Field>
                                <Field label="Current Points">
                                    <Input type="number" value={faction.currentPoints} onChange={v => updateFaction(faction.id, { currentPoints: v })} />
                                </Field>
                                <Field label="Max Points">
                                    <Input type="number" value={faction.maxPoints} onChange={v => updateFaction(faction.id, { maxPoints: v })} />
                                </Field>
                            </div>

                            {/* Ranks */}
                            <div style={{ marginTop: 12 }}>
                                <SectionHeader title="Ranks" onAdd={() => addRank(faction.id)} addLabel="+ Rank" />
                                {(faction.ranks || [])
                                    .sort((a, b) => a.threshold - b.threshold)
                                    .map(rank => (
                                    <div key={rank.id} style={{
                                        background: '#111', borderRadius: 8, padding: 10,
                                        marginBottom: 8, border: '1px solid #333',
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                            <button
                                                onClick={() => setExpandedRank(prev => ({ ...prev, [rank.id]: !prev[rank.id] }))}
                                                style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '0.9em', padding: 0 }}
                                            >
                                                {expandedRank[rank.id] ? '▼' : '▶'}
                                            </button>
                                            <span style={{ color: '#ddd', fontSize: '0.9em', flex: 1 }}>
                                                ≥{rank.threshold}: {rank.title || 'Unnamed rank'}
                                            </span>
                                            <DeleteBtn onClick={() => deleteRank(faction.id, rank.id)} />
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: 8 }}>
                                            <Field label="Threshold">
                                                <Input type="number" value={rank.threshold}
                                                    onChange={v => updateRank(faction.id, rank.id, { threshold: v })} />
                                            </Field>
                                            <Field label="Title">
                                                <Input value={rank.title} placeholder="e.g. Friend of the Crown"
                                                    onChange={v => updateRank(faction.id, rank.id, { title: v })} />
                                            </Field>
                                        </div>
                                        {expandedRank[rank.id] && (
                                            <div style={{ borderTop: '1px solid #2a2a2a', paddingTop: 8, marginTop: 4 }}>
                                                <SectionHeader title="Perks" onAdd={() => addPerk(faction.id, rank.id)} addLabel="+ Perk" />
                                                {(rank.perks || []).map(perk => (
                                                    <div key={perk.id} style={{ marginBottom: 8 }}>
                                                        <div style={{ display: 'flex', gap: 6 }}>
                                                            <Input value={perk.name} placeholder="Perk name"
                                                                onChange={v => updatePerk(faction.id, rank.id, perk.id, { name: v })}
                                                                style={{ flex: 1 }}
                                                            />
                                                            <DeleteBtn onClick={() => deletePerk(faction.id, rank.id, perk.id)} />
                                                        </div>
                                                        <Textarea value={perk.description} rows={2} placeholder="Description…"
                                                            onChange={v => updatePerk(faction.id, rank.id, perk.id, { description: v })} />
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </Card>
            ))}
            <ArchivedEntries title="Archived Factions" entries={archivedFactions} onRestore={id => restoreEntry('reputation', id)} />
        </div>
    );
}

// ─── RESEARCH ADMIN ───────────────────────────────────────────────────────────

function ResearchAdmin({ progress, save, archiveEntry, restoreEntry }) {
    const [expanded, setExpanded] = useState(null);
    const { active: topics, archived: archivedTopics } = splitProgressEntries(progress, 'research');
    const allTopics = progress.research.topics;

    const updateTopics = (fn) => {
        const next = [...allTopics];
        fn(next);
        save({ research: { ...progress.research, topics: next } });
    };

    const addTopic = () => {
        updateTopics(t => t.push({
            id: createInstanceId('pid'), name: 'New Topic', currentPoints: 0, maxPoints: 10,
            dc: null, dcModified: null, dcRevealed: false, infoPoints: [],
        }));
    };

    const updateTopic = (id, patch) => {
        updateTopics(t => {
            const i = t.findIndex(x => x.id === id);
            if (i >= 0) t[i] = { ...t[i], ...patch };
        });
    };

    const deleteTopic = (id) => {
        if (!window.confirm('Archive this topic? It can be restored later.')) return;
        archiveEntry('research', id);
        if (expanded === id) setExpanded(null);
    };

    const addInfo = (topicId) => {
        updateTopics(t => {
            const topic = t.find(x => x.id === topicId);
            if (topic) {
                if (!topic.infoPoints) topic.infoPoints = [];
                topic.infoPoints.push({ id: createInstanceId('pid'), text: '', revealed: false });
            }
        });
    };

    const updateInfo = (topicId, infoId, patch) => {
        updateTopics(t => {
            const topic = t.find(x => x.id === topicId);
            if (topic) {
                const ii = topic.infoPoints.findIndex(p => p.id === infoId);
                if (ii >= 0) topic.infoPoints[ii] = { ...topic.infoPoints[ii], ...patch };
            }
        });
    };

    const deleteInfo = (topicId, infoId) => {
        updateTopics(t => {
            const topic = t.find(x => x.id === topicId);
            if (topic) topic.infoPoints = topic.infoPoints.filter(p => p.id !== infoId);
        });
    };

    return (
        <div>
            <SectionHeader title="Research Topics" onAdd={addTopic} addLabel="+ Topic" />
            {topics.length === 0 && (
                <div style={{ color: '#555', textAlign: 'center', padding: '24px 0', fontSize: '0.85em' }}>No topics yet. Add one above.</div>
            )}
            {topics.map(topic => (
                <Card key={topic.id}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: expanded === topic.id ? 12 : 0 }}>
                        <button
                            onClick={() => setExpanded(expanded === topic.id ? null : topic.id)}
                            style={{ background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', fontSize: '1.1em', padding: 0 }}
                        >
                            {expanded === topic.id ? '▼' : '▶'}
                        </button>
                        <span style={{ color: '#e8e8e8', fontWeight: 'bold', flex: 1 }}>{topic.name || 'Unnamed Topic'}</span>
                        <span style={{ color: '#888', fontSize: '0.82em' }}>
                            {topic.currentPoints || 0} pts · DC {topic.dcRevealed && topic.dc ? topic.dc : '???'}
                        </span>
                        <DeleteBtn onClick={() => deleteTopic(topic.id)} />
                    </div>

                    {expanded === topic.id && (
                        <div style={{ borderTop: '1px solid #2a2a2a', paddingTop: 12 }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px', gap: 8 }}>
                                <Field label="Topic Name">
                                    <Input value={topic.name} onChange={v => updateTopic(topic.id, { name: v })} placeholder="Topic name" />
                                </Field>
                                <Field label="Points">
                                    <Input type="number" value={topic.currentPoints} onChange={v => updateTopic(topic.id, { currentPoints: v })} />
                                </Field>
                                <Field label="Max Pts">
                                    <Input type="number" value={topic.maxPoints} onChange={v => updateTopic(topic.id, { maxPoints: v })} />
                                </Field>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '80px 80px 1fr', gap: 8, alignItems: 'end' }}>
                                <Field label="DC Value">
                                    <Input type="number" value={topic.dc ?? ''} onChange={v => updateTopic(topic.id, { dc: v || null })} placeholder="—" />
                                </Field>
                                <Field label="DC Modified">
                                    <Input
                                        type="number"
                                        value={topic.dcModified ?? ''}
                                        onChange={v => updateTopic(topic.id, { dcModified: v === '' ? null : v })}
                                        placeholder="0"
                                        style={{
                                            color: (topic.dcModified ?? 0) < 0 ? '#4caf50'
                                                 : (topic.dcModified ?? 0) > 0 ? '#e53935'
                                                 : undefined,
                                            fontWeight: topic.dcModified != null && topic.dcModified !== 0 ? 'bold' : 'normal',
                                        }}
                                    />
                                </Field>
                                <Field label=" ">
                                    <div style={{ paddingBottom: 4 }}>
                                        <Toggle
                                            checked={!!topic.dcRevealed}
                                            onChange={v => updateTopic(topic.id, { dcRevealed: v })}
                                            label="DC Revealed to Players"
                                        />
                                    </div>
                                </Field>
                            </div>

                            {/* Info Points */}
                            <div style={{ marginTop: 12 }}>
                                <SectionHeader title="Information Points" onAdd={() => addInfo(topic.id)} addLabel="+ Info" />
                                {(topic.infoPoints || []).map((pt, i) => (
                                    <div key={pt.id} style={{
                                        background: '#111', borderRadius: 8, padding: '8px 10px',
                                        marginBottom: 8, border: '1px solid #333',
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
                                            <span style={{ color: '#555', fontSize: '0.8em', paddingTop: 4, flexShrink: 0 }}>#{i + 1}</span>
                                            <Textarea
                                                value={pt.text}
                                                rows={2}
                                                placeholder="Information text..."
                                                onChange={v => updateInfo(topic.id, pt.id, { text: v })}
                                            />
                                            <DeleteBtn onClick={() => deleteInfo(topic.id, pt.id)} />
                                        </div>
                                        <Toggle
                                            checked={!!pt.revealed}
                                            onChange={v => updateInfo(topic.id, pt.id, { revealed: v })}
                                            label="Revealed"
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </Card>
            ))}
            <ArchivedEntries title="Archived Topics" entries={archivedTopics} onRestore={id => restoreEntry('research', id)} />
        </div>
    );
}

// ─── CALCIFER ADMIN ───────────────────────────────────────────────────────────

function CalciferAdmin({ progress, save, archiveEntry, restoreEntry }) {
    const [expandedStage, setExpandedStage] = useState(null);
    const calcifer = progress.calcifer;
    const { active: activeStages, archived: archivedStages } = splitProgressEntries(progress, 'calcifer');
    const stages = [...activeStages].sort((a, b) => a.threshold - b.threshold);

    const updateCalcifer = (patch) => {
        save({ calcifer: { ...calcifer, ...patch } });
    };

    const updateStages = (fn) => {
        const next = [...(calcifer.stages || [])];
        fn(next);
        updateCalcifer({ stages: next });
    };

    const addStage = () => {
        updateStages(s => s.push({
            id: createInstanceId('pid'), threshold: 0, name: 'New Stage', icon: '🔥',
            creature: null, boons: [],
        }));
    };

    const updateStage = (id, patch) => {
        updateStages(s => {
            const i = s.findIndex(x => x.id === id);
            if (i >= 0) s[i] = { ...s[i], ...patch };
        });
    };

    const deleteStage = (id) => {
        if (!window.confirm('Archive this stage? It can be restored later.')) return;
        archiveEntry('calcifer', id);
        if (expandedStage === id) setExpandedStage(null);
    };

    const addBoon = (stageId) => {
        updateStages(s => {
            const stage = s.find(x => x.id === stageId);
            if (stage) {
                if (!stage.boons) stage.boons = [];
                stage.boons.push({ id: createInstanceId('pid'), name: 'New Boon', description: '' });
            }
        });
    };

    const updateBoon = (stageId, boonId, patch) => {
        updateStages(s => {
            const stage = s.find(x => x.id === stageId);
            if (stage) {
                const bi = stage.boons.findIndex(b => b.id === boonId);
                if (bi >= 0) stage.boons[bi] = { ...stage.boons[bi], ...patch };
            }
        });
    };

    const deleteBoon = (stageId, boonId) => {
        updateStages(s => {
            const stage = s.find(x => x.id === stageId);
            if (stage) stage.boons = stage.boons.filter(b => b.id !== boonId);
        });
    };

    return (
        <div>
            {/* Global progress control */}
            <Card>
                <SectionHeader title="Current Progress" />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <Field label="Current Points">
                        <Input
                            type="number"
                            value={calcifer.currentProgress}
                            onChange={v => updateCalcifer({ currentProgress: v })}
                        />
                    </Field>
                    <Field label="Add / Subtract">
                        <div style={{ display: 'flex', gap: 6 }}>
                            <button
                                className="btn-add-condition"
                                style={{ margin: 0, flex: 1 }}
                                onClick={() => {
                                    const amt = prompt('Add points:');
                                    if (!amt) return;
                                    const n = parseFloat(amt) || 0;
                                    updateCalcifer({ currentProgress: (calcifer.currentProgress || 0) + n });
                                }}
                            >+ Feed</button>
                            <button
                                style={{
                                    flex: 1, padding: '6px 10px', background: '#333',
                                    border: 'none', borderRadius: 6, color: '#aaa',
                                    cursor: 'pointer', fontSize: '0.85em',
                                }}
                                onClick={() => {
                                    const amt = prompt('Subtract points:');
                                    if (!amt) return;
                                    const n = parseFloat(amt) || 0;
                                    updateCalcifer({ currentProgress: Math.max(0, (calcifer.currentProgress || 0) - n) });
                                }}
                            >– Drain</button>
                        </div>
                    </Field>
                </div>
            </Card>

            {/* Stages */}
            <SectionHeader title="Stages" onAdd={addStage} addLabel="+ Stage" />
            {stages.length === 0 && (
                <div style={{ color: '#555', textAlign: 'center', padding: '24px 0', fontSize: '0.85em' }}>No stages yet. Add one above.</div>
            )}
            {stages.map(stage => (
                <Card key={stage.id}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: expandedStage === stage.id ? 12 : 0 }}>
                        <button
                            onClick={() => setExpandedStage(expandedStage === stage.id ? null : stage.id)}
                            style={{ background: 'none', border: 'none', color: '#f97316', cursor: 'pointer', fontSize: '1.1em', padding: 0 }}
                        >
                            {expandedStage === stage.id ? '▼' : '▶'}
                        </button>
                        <span style={{ color: '#e8e8e8', fontWeight: 'bold', flex: 1 }}>
                            {stage.icon} {stage.name} <span style={{ color: '#888', fontWeight: 'normal', fontSize: '0.85em' }}>(≥{stage.threshold})</span>
                        </span>
                        <DeleteBtn onClick={() => deleteStage(stage.id)} />
                    </div>

                    {expandedStage === stage.id && (
                        <div style={{ borderTop: '1px solid #2a2a2a', paddingTop: 12 }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 60px', gap: 8 }}>
                                <Field label="Stage Name">
                                    <Input value={stage.name} onChange={v => updateStage(stage.id, { name: v })} placeholder="Stage name" />
                                </Field>
                                <Field label="Threshold">
                                    <Input type="number" value={stage.threshold} onChange={v => updateStage(stage.id, { threshold: v })} />
                                </Field>
                                <Field label="Icon">
                                    <Input value={stage.icon} onChange={v => updateStage(stage.id, { icon: v })} placeholder="🔥" />
                                </Field>
                            </div>

                            {/* Creature */}
                            <div style={{ marginTop: 12, padding: 10, background: '#111', borderRadius: 8, border: '1px solid #333' }}>
                                <div style={{ color: '#f97316', fontSize: '0.8em', fontWeight: 'bold', marginBottom: 8 }}>CREATURE CARD</div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 60px 40px', gap: 8 }}>
                                    <Field label="Creature Name">
                                        <Input
                                            value={stage.creature?.name ?? ''}
                                            onChange={v => updateStage(stage.id, { creature: { ...(stage.creature || {}), name: v } })}
                                            placeholder="e.g. Calcifer"
                                        />
                                    </Field>
                                    <Field label="Level">
                                        <Input
                                            type="number"
                                            value={stage.creature?.level ?? ''}
                                            onChange={v => updateStage(stage.id, { creature: { ...(stage.creature || {}), level: v } })}
                                        />
                                    </Field>
                                    <Field label="Icon">
                                        <Input
                                            value={stage.creature?.icon ?? ''}
                                            onChange={v => updateStage(stage.id, { creature: { ...(stage.creature || {}), icon: v } })}
                                            placeholder="🔥"
                                        />
                                    </Field>
                                </div>
                                <Field label="Description">
                                    <Textarea
                                        value={stage.creature?.description ?? ''}
                                        rows={2}
                                        placeholder="Brief description of this form..."
                                        onChange={v => updateStage(stage.id, { creature: { ...(stage.creature || {}), description: v } })}
                                    />
                                </Field>
                            </div>

                            {/* Boons */}
                            <div style={{ marginTop: 12 }}>
                                <SectionHeader title="Boons" onAdd={() => addBoon(stage.id)} addLabel="+ Boon" />
                                {(stage.boons || []).map(boon => (
                                    <div key={boon.id} style={{
                                        background: '#111', borderRadius: 8, padding: '8px 10px',
                                        marginBottom: 8, border: '1px solid #333',
                                    }}>
                                        <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                                            <Input value={boon.name} placeholder="Boon name"
                                                onChange={v => updateBoon(stage.id, boon.id, { name: v })}
                                                style={{ flex: 1 }}
                                            />
                                            <DeleteBtn onClick={() => deleteBoon(stage.id, boon.id)} />
                                        </div>
                                        <Textarea value={boon.description} rows={2} placeholder="Boon description…"
                                            onChange={v => updateBoon(stage.id, boon.id, { description: v })} />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </Card>
            ))}
            <ArchivedEntries title="Archived Stages" entries={archivedStages} onRestore={id => restoreEntry('calcifer', id)} />
        </div>
    );
}

// ─── MATERIALS ADMIN ──────────────────────────────────────────────────────────

const ELEMENT_COLORS = {
    fire: '#ef4444', water: '#3b82f6', wind: '#a3e635',
    earth: '#a16207', wood: '#22c55e', metal: '#94a3b8',
};

const DEFAULT_ELEMENTS = [
    { name: 'Fire',  icon: '🔥', color: '#ef4444' },
    { name: 'Water', icon: '💧', color: '#3b82f6' },
    { name: 'Wind',  icon: '🌪️', color: '#a3e635' },
    { name: 'Earth', icon: '🪨', color: '#a16207' },
    { name: 'Wood',  icon: '🪵', color: '#22c55e' },
    { name: 'Metal', icon: '⚙️', color: '#94a3b8' },
];

function MaterialsAdmin({ progress, save, archiveEntry, restoreEntry }) {
    const [expandedEl, setExpandedEl] = useState(null);
    const [expandedTier, setExpandedTier] = useState({});
    const { active: elements, archived: archivedElements } = splitProgressEntries(progress, 'materials');
    const allElements = progress.materials.elements;

    const updateElements = (fn) => {
        const next = [...allElements];
        fn(next);
        save({ materials: { ...progress.materials, elements: next } });
    };

    const addElement = () => {
        const def = DEFAULT_ELEMENTS[elements.length % DEFAULT_ELEMENTS.length];
        updateElements(e => e.push({
            id: createInstanceId('pid'), name: def.name, icon: def.icon, color: def.color,
            currentProgress: 0, maxProgress: 100, tiers: [],
        }));
    };

    const updateElement = (id, patch) => {
        updateElements(e => {
            const i = e.findIndex(x => x.id === id);
            if (i >= 0) e[i] = { ...e[i], ...patch };
        });
    };

    const deleteElement = (id) => {
        if (!window.confirm('Archive this element? It can be restored later.')) return;
        archiveEntry('materials', id);
        if (expandedEl === id) setExpandedEl(null);
    };

    const addTier = (elId) => {
        updateElements(e => {
            const el = e.find(x => x.id === elId);
            if (el) {
                if (!el.tiers) el.tiers = [];
                el.tiers.push({ id: createInstanceId('pid'), threshold: 0, name: 'Tier 1', items: [] });
            }
        });
    };

    const updateTier = (elId, tierId, patch) => {
        updateElements(e => {
            const el = e.find(x => x.id === elId);
            if (el) {
                const ti = el.tiers.findIndex(t => t.id === tierId);
                if (ti >= 0) el.tiers[ti] = { ...el.tiers[ti], ...patch };
            }
        });
    };

    const deleteTier = (elId, tierId) => {
        updateElements(e => {
            const el = e.find(x => x.id === elId);
            if (el) el.tiers = el.tiers.filter(t => t.id !== tierId);
        });
    };

    const addItem = (elId, tierId) => {
        updateElements(e => {
            const el = e.find(x => x.id === elId);
            if (el) {
                const tier = el.tiers.find(t => t.id === tierId);
                if (tier) {
                    if (!tier.items) tier.items = [];
                    tier.items.push({ id: createInstanceId('pid'), name: 'New Item', link: '', revealed: false });
                }
            }
        });
    };

    const updateItem = (elId, tierId, itemId, patch) => {
        updateElements(e => {
            const el = e.find(x => x.id === elId);
            if (el) {
                const tier = el.tiers.find(t => t.id === tierId);
                if (tier) {
                    const ii = tier.items.findIndex(i => i.id === itemId);
                    if (ii >= 0) tier.items[ii] = { ...tier.items[ii], ...patch };
                }
            }
        });
    };

    const deleteItem = (elId, tierId, itemId) => {
        updateElements(e => {
            const el = e.find(x => x.id === elId);
            if (el) {
                const tier = el.tiers.find(t => t.id === tierId);
                if (tier) tier.items = tier.items.filter(i => i.id !== itemId);
            }
        });
    };

    return (
        <div>
            <SectionHeader title="Elements" onAdd={addElement} addLabel="+ Element" />
            {elements.length === 0 && (
                <div style={{ color: '#555', textAlign: 'center', padding: '24px 0', fontSize: '0.85em' }}>No elements yet. Add one above.</div>
            )}
            {elements.map(el => {
                const color = el.color || ELEMENT_COLORS[el.name?.toLowerCase()] || '#c5a059';
                return (
                    <Card key={el.id} style={{ borderColor: `${color}33` }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: expandedEl === el.id ? 12 : 0 }}>
                            <button
                                onClick={() => setExpandedEl(expandedEl === el.id ? null : el.id)}
                                style={{ background: 'none', border: 'none', color, cursor: 'pointer', fontSize: '1.1em', padding: 0 }}
                            >
                                {expandedEl === el.id ? '▼' : '▶'}
                            </button>
                            <span style={{ fontSize: '1.2em' }}>{el.icon}</span>
                            <span style={{ color: '#e8e8e8', fontWeight: 'bold', flex: 1 }}>{el.name}</span>
                            <span style={{ color: '#888', fontSize: '0.82em' }}>
                                {el.currentProgress || 0}/{el.maxProgress || 100}
                            </span>
                            <DeleteBtn onClick={() => deleteElement(el.id)} />
                        </div>

                        {expandedEl === el.id && (
                            <div style={{ borderTop: '1px solid #2a2a2a', paddingTop: 12 }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 60px 60px 80px 80px', gap: 8 }}>
                                    <Field label="Name">
                                        <Input value={el.name} onChange={v => updateElement(el.id, { name: v })} />
                                    </Field>
                                    <Field label="Icon">
                                        <Input value={el.icon} onChange={v => updateElement(el.id, { icon: v })} />
                                    </Field>
                                    <Field label="Color">
                                        <input
                                            type="color"
                                            value={el.color || '#c5a059'}
                                            onChange={e => updateElement(el.id, { color: e.target.value })}
                                            style={{ width: '100%', height: 36, border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}
                                        />
                                    </Field>
                                    <Field label="Progress">
                                        <Input type="number" value={el.currentProgress} onChange={v => updateElement(el.id, { currentProgress: v })} />
                                    </Field>
                                    <Field label="Max">
                                        <Input type="number" value={el.maxProgress} onChange={v => updateElement(el.id, { maxProgress: v })} />
                                    </Field>
                                </div>

                                {/* Tiers */}
                                <div style={{ marginTop: 12 }}>
                                    <SectionHeader title="Tiers" onAdd={() => addTier(el.id)} addLabel="+ Tier" />
                                    {(el.tiers || [])
                                        .sort((a, b) => a.threshold - b.threshold)
                                        .map(tier => (
                                        <div key={tier.id} style={{
                                            background: '#111', borderRadius: 8, padding: '8px 10px',
                                            marginBottom: 8, border: '1px solid #333',
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                                <button
                                                    onClick={() => setExpandedTier(p => ({ ...p, [tier.id]: !p[tier.id] }))}
                                                    style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '0.9em', padding: 0 }}
                                                >
                                                    {expandedTier[tier.id] ? '▼' : '▶'}
                                                </button>
                                                <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: 6, flex: 1 }}>
                                                    <Input type="number" value={tier.threshold}
                                                        onChange={v => updateTier(el.id, tier.id, { threshold: v })}
                                                        placeholder="Threshold"
                                                    />
                                                    <Input value={tier.name}
                                                        onChange={v => updateTier(el.id, tier.id, { name: v })}
                                                        placeholder="Tier name"
                                                    />
                                                </div>
                                                <DeleteBtn onClick={() => deleteTier(el.id, tier.id)} />
                                            </div>

                                            {expandedTier[tier.id] && (
                                                <div style={{ borderTop: '1px solid #222', paddingTop: 8 }}>
                                                    <SectionHeader title="Items" onAdd={() => addItem(el.id, tier.id)} addLabel="+ Item" />
                                                    {(tier.items || []).map(item => (
                                                        <div key={item.id} style={{
                                                            background: '#0d0d0d', borderRadius: 6, padding: '6px 8px',
                                                            marginBottom: 6, border: '1px solid #2a2a2a',
                                                        }}>
                                                            <div style={{ display: 'flex', gap: 6, marginBottom: 5 }}>
                                                                <Input value={item.name} placeholder="Item name"
                                                                    onChange={v => updateItem(el.id, tier.id, item.id, { name: v })}
                                                                    style={{ flex: 1 }}
                                                                />
                                                                <DeleteBtn onClick={() => deleteItem(el.id, tier.id, item.id)} />
                                                            </div>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                                <Input value={item.link} placeholder="Link URL (optional)"
                                                                    onChange={v => updateItem(el.id, tier.id, item.id, { link: v })}
                                                                    style={{ flex: 1 }}
                                                                />
                                                                <Toggle
                                                                    checked={!!item.revealed}
                                                                    onChange={v => updateItem(el.id, tier.id, item.id, { revealed: v })}
                                                                    label="Revealed"
                                                                />
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </Card>
                );
            })}
            <ArchivedEntries title="Archived Elements" entries={archivedElements} onRestore={id => restoreEntry('materials', id)} />
        </div>
    );
}

// ─── Main Admin View ──────────────────────────────────────────────────────────

export default function ProgressAdminView() {
    const { activeCampaign, dataActions } = useCampaign();
    const [subTab, setSubTab] = useState('reputation');

    if (!activeCampaign) {
        return (
            <div style={{ padding: 40, textAlign: 'center', color: '#555' }}>
                <div style={{ fontSize: '2em', marginBottom: 12 }}>📋</div>
                <div>No campaign selected.</div>
            </div>
        );
    }

    const progress = getProgressState(activeCampaign);
    const campaignId = activeCampaign.id;

    const runProgressAction = (action) => {
        return Promise.resolve(action).catch(err => {
            console.error(err);
            alert(err?.message || String(err));
        });
    };

    const save = (sectionPatch) => {
        runProgressAction(dataActions.progress.updateProgress(campaignId, sectionPatch));
    };

    const archiveEntry = (section, id) => {
        runProgressAction(dataActions.progress.softDeleteEntry(campaignId, section, id));
    };

    const restoreEntry = (section, id) => {
        runProgressAction(dataActions.progress.restoreEntry(campaignId, section, id));
    };

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
                <SubTabBar active={subTab} onChange={setSubTab} />
                {subTab === 'reputation' && <ReputationAdmin progress={progress} save={save} archiveEntry={archiveEntry} restoreEntry={restoreEntry} />}
                {subTab === 'research'   && <ResearchAdmin   progress={progress} save={save} archiveEntry={archiveEntry} restoreEntry={restoreEntry} />}
                {subTab === 'calcifer'   && <CalciferAdmin   progress={progress} save={save} archiveEntry={archiveEntry} restoreEntry={restoreEntry} />}
                {subTab === 'materials'  && <MaterialsAdmin  progress={progress} save={save} archiveEntry={archiveEntry} restoreEntry={restoreEntry} />}
            </div>
        </div>
    );
}
