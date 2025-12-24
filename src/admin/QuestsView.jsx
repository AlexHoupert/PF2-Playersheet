import React, { useState, useEffect } from 'react';
import db from '../data/new_db.json';
import RichTextEditor from '../shared/components/RichTextEditor';
import { formatText } from '../utils/rules';

export default function QuestsView() {
    const [quests, setQuests] = useState(db.quests || []);
    const [isEditing, setIsEditing] = useState(false);
    const [editingQuest, setEditingQuest] = useState(null);
    const [saveStatus, setSaveStatus] = useState(null);
    const [expandedQuestIds, setExpandedQuestIds] = useState(new Set());

    // --- CONSTANTS ---
    const QUEST_TYPES = ['Main', 'Side', 'Bounty', 'Personal'];
    const STATUS_OPTIONS = ['Active', 'Completed', 'Failed', 'Dormant'];

    // --- INIT ---
    useEffect(() => {
        if (!db.quests) {
            db.quests = [];
            setQuests([]);
        }
    }, []);

    // --- ACTIONS ---
    const saveQuests = async (newQuests) => {
        setSaveStatus('saving');
        try {
            setQuests(newQuests);
            db.quests = newQuests;
            const res = await fetch('/api/files/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filePath: 'src/data/new_db.json', content: db })
            });
            if (!res.ok) throw new Error("Failed to save DB");
            setSaveStatus('success');
            setTimeout(() => setSaveStatus(null), 2000);
        } catch (err) {
            console.error(err);
            setSaveStatus('error');
        }
    };

    const handleCreate = (parentId = null) => {
        const newQuest = {
            id: crypto.randomUUID(),
            title: parentId ? 'New Subquest' : 'New Quest',
            type: 'Side',
            status: 'Active',
            descriptionPublic: '',
            descriptionGM: '',
            objectives: [],
            rewards: { xp: 0, gold: 0, items: '', reputation: [] },
            subquests: [], // IDs of children
            parentId: parentId
        };

        // If subquest, we need to link it immediately or later? 
        // Better to link later on save, but for editing context we need to know.
        // Actually, let's just add it to the list, and update the parent's subquests array on save if needed.
        // Simpler: Just flat list for storage, hierarchy via 'parentId' property is easier to manage than nested arrays.
        // But the previous plan said "subquests": ["id"]. Let's stick to that for ordering.

        setEditingQuest(newQuest);
        setIsEditing(true);
    };

    const handleEdit = (q) => {
        setEditingQuest({
            ...q,
            rewards: { ...q.rewards, reputation: q.rewards?.reputation || [] } || { xp: 0, gold: 0, items: '', reputation: [] },
            subquests: q.subquests || [],
            objectives: q.objectives || []
        });
        setIsEditing(true);
    };

    const handleDelete = async (questId) => {
        if (!window.confirm("Delete this quest AND its subquests?")) return;

        // Recursive delete
        const idsToDelete = new Set([questId]);
        const collectChildren = (pid) => {
            const children = quests.filter(q => q.parentId === pid);
            children.forEach(c => {
                idsToDelete.add(c.id);
                collectChildren(c.id);
            });
        };
        collectChildren(questId);

        const updated = quests.filter(q => !idsToDelete.has(q.id));

        // Also remove from any parent's subquest list (if we strictly maintain that)
        // But we are moving to 'parentId' based for easier tree reconstruction, simpler for flat DB.
        // Let's ensure we clean up parent references if we rely on them.

        await saveQuests(updated);
    };

    const handleSaveEdit = () => {
        if (!editingQuest.title) return alert("Title required");

        let updated = [...quests];
        const existingIdx = updated.findIndex(q => q.id === editingQuest.id);

        // If it's a new subquest, ensure we set its parentId correctly
        if (editingQuest.parentId) {
            // It's already set in handleCreate, but let's make sure the PARENT knows about it if we enforce the 'subquests' array
            // Ideally we just rely on parentId for hierarchy building in UI to avoid dual-maintenance hell.
        }

        if (existingIdx > -1) {
            updated[existingIdx] = editingQuest;
        } else {
            updated.push(editingQuest);
        }

        saveQuests(updated);
        setIsEditing(false);
        setEditingQuest(null);
    };

    const toggleExpand = (id) => {
        const newSet = new Set(expandedQuestIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setExpandedQuestIds(newSet);
    };

    const toggleObjective = (questId, objIndex) => {
        const qIndex = quests.findIndex(q => q.id === questId);
        if (qIndex === -1) return;

        const updatedQuests = [...quests];
        const q = { ...updatedQuests[qIndex] };
        q.objectives = [...q.objectives];
        q.objectives[objIndex] = { ...q.objectives[objIndex], completed: !q.objectives[objIndex].completed };
        updatedQuests[qIndex] = q;

        saveQuests(updatedQuests);
    };

    // --- RENDER HELPERS ---

    const getStatusColor = (s) => {
        switch (s) {
            case 'Active': return '#2196f3';
            case 'Completed': return '#4caf50';
            case 'Failed': return '#f44336';
            case 'Dormant': return '#777';
            default: return '#777';
        }
    };

    // Recursive renderer
    const renderQuestRow = (quest, depth = 0) => {
        const isExpanded = expandedQuestIds.has(quest.id);
        const children = quests.filter(q => q.parentId === quest.id);
        const hasChildren = children.length > 0;

        return (
            <div key={quest.id} style={{ marginLeft: depth * 20, marginBottom: 5 }}>
                {/* HEADLINE */}
                <div
                    className="quest-row"
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        background: '#333',
                        padding: '8px 12px',
                        borderLeft: `4px solid ${getStatusColor(quest.status)}`,
                        borderRadius: 4,
                        marginBottom: 5,
                        cursor: 'pointer'
                    }}
                    onClick={() => toggleExpand(quest.id)}
                >
                    <div style={{ marginRight: 10, width: 20, textAlign: 'center' }}>
                        {hasChildren ? (isExpanded ? '▼' : '▶') : '•'}
                    </div>

                    <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span style={{ fontWeight: 'bold', fontSize: '1.1em' }}>{quest.title}</span>
                            <span className="trait-badge" style={{ fontSize: '0.7em', padding: '1px 6px' }}>{quest.type}</span>
                        </div>
                        {/* Progress Bar for Objectives */}
                        {quest.objectives.length > 0 && (
                            <div style={{ height: 4, background: '#555', marginTop: 4, borderRadius: 2, maxWidth: 200 }}>
                                <div style={{
                                    height: '100%',
                                    background: getStatusColor(quest.status),
                                    width: `${(quest.objectives.filter(o => o.completed).length / quest.objectives.length) * 100}%`,
                                    transition: 'width 0.3s'
                                }} />
                            </div>
                        )}
                    </div>

                    <div style={{ display: 'flex', gap: 5 }}>
                        <button className="icon-btn" onClick={(e) => { e.stopPropagation(); handleCreate(quest.id); }} title="Add Subquest">➕ Sub</button>
                        <button className="icon-btn" onClick={(e) => { e.stopPropagation(); handleEdit(quest); }} title="Edit">✏️</button>
                    </div>
                </div>

                {/* DETAILS (EXPANDED) */}
                {isExpanded && (
                    <div style={{ background: '#2a2a2a', padding: '10px 15px', marginLeft: 10, borderLeft: '1px solid #444', marginBottom: 10 }}>

                        {/* Status & Rewards Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, fontSize: '0.9em', color: '#ccc' }}>
                            <div><strong>Status:</strong> <span style={{ color: getStatusColor(quest.status) }}>{quest.status}</span></div>
                            <div style={{ display: 'flex', gap: 10 }}>
                                {quest.rewards?.xp > 0 && <span>🏆 {quest.rewards.xp} XP</span>}
                                {quest.rewards?.gold > 0 && <span>💰 {quest.rewards.gold} gp</span>}
                            </div>
                            {quest.rewards?.reputation && quest.rewards.reputation.map((rep, i) => (
                                <span key={i} title={`Reputation: ${rep.faction}`} style={{ color: rep.value >= 0 ? '#81c784' : '#e57373' }}>
                                    {rep.value >= 0 ? '▲' : '▼'} {rep.faction} ({rep.value > 0 ? '+' : ''}{rep.value})
                                </span>
                            ))}
                        </div>

                        {/* Public Description */}
                        {quest.descriptionPublic && (
                            <div style={{ marginBottom: 15 }}>
                                <strong style={{ color: '#8ec5ff' }}>Public Description:</strong>
                                <div
                                    className="formatted-content"
                                    dangerouslySetInnerHTML={{ __html: formatText(quest.descriptionPublic) }}
                                    style={{ marginTop: 5, color: '#e0e0e0' }}
                                />
                            </div>
                        )}

                        {/* GM Notes */}
                        {quest.descriptionGM && (
                            <div style={{ marginBottom: 15, background: '#251a1a', padding: 8, border: '1px dashed #d32f2f', borderRadius: 4 }}>
                                <strong style={{ color: '#ff8a80' }}>GM Secrets:</strong>
                                <div
                                    className="formatted-content"
                                    dangerouslySetInnerHTML={{ __html: formatText(quest.descriptionGM) }}
                                    style={{ marginTop: 5, color: '#ffcdd2' }}
                                />
                            </div>
                        )}

                        {/* Objectives */}
                        {quest.objectives.length > 0 && (
                            <div style={{ marginBottom: 10 }}>
                                <strong>Objectives:</strong>
                                <div style={{ marginTop: 5, display: 'flex', flexDirection: 'column', gap: 4 }}>
                                    {quest.objectives.map((obj, idx) => (
                                        <div
                                            key={idx}
                                            onClick={() => toggleObjective(quest.id, idx)}
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
                                                opacity: obj.completed ? 0.6 : 1,
                                                color: obj.hidden ? '#9fa8da' : 'inherit'
                                            }}
                                            title={obj.hidden ? "Hidden from Players" : ""}
                                        >
                                            <div style={{
                                                width: 16, height: 16, border: '1px solid #777', borderRadius: 3,
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                background: obj.completed ? '#4caf50' : 'transparent',
                                                borderColor: obj.hidden ? '#9fa8da' : '#777'
                                            }}>
                                                {obj.completed && '✓'}
                                            </div>
                                            <span style={{ textDecoration: obj.completed ? 'line-through' : 'none' }}>
                                                {obj.hidden && <span style={{ fontSize: '0.7em', border: '1px solid #9fa8da', borderRadius: 3, padding: '0 2px', marginRight: 4 }}>GM</span>}
                                                {obj.text}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Rewards (Items) */}
                        {quest.rewards?.items && (
                            <div style={{ marginTop: 10, fontSize: '0.9em', color: '#ffb74d' }}>
                                <strong>Item Rewards:</strong> {quest.rewards.items}
                            </div>
                        )}
                    </div>
                )}

                {/* Subquests Render */}
                {children.map(child => renderQuestRow(child, depth + 1))}
            </div>
        );
    };


    // --- EDIT MODE ---
    if (isEditing && editingQuest) {
        return (
            <div className="quest-editor" style={{ padding: 20, maxWidth: 800, margin: '0 auto' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                    <h2 style={{ margin: 0 }}>{editingQuest.id && quests.find(q => q.id === editingQuest.id) ? 'Edit Quest' : 'New Quest'}</h2>
                    {editingQuest.parentId && <span className="trait-badge">Subquest</span>}
                </div>

                <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 10 }}>
                    <div className="form-group">
                        <label>Title</label>
                        <input className="modal-input" value={editingQuest.title} onChange={e => setEditingQuest({ ...editingQuest, title: e.target.value })} />
                    </div>
                    <div className="form-group">
                        <label>Type</label>
                        <select className="modal-input" value={editingQuest.type} onChange={e => setEditingQuest({ ...editingQuest, type: e.target.value })}>
                            {QUEST_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                    </div>
                    <div className="form-group">
                        <label>Status</label>
                        <select className="modal-input" value={editingQuest.status} onChange={e => setEditingQuest({ ...editingQuest, status: e.target.value })}>
                            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>
                </div>

                <div className="form-group">
                    <label>Public Description (Visible to Players)</label>
                    <RichTextEditor
                        value={editingQuest.descriptionPublic}
                        onChange={val => setEditingQuest({ ...editingQuest, descriptionPublic: val })}
                        placeholder="The villagers need help..."
                        style={{ height: 150 }}
                    />
                </div>

                <div className="form-group">
                    <label style={{ color: '#ef9a9a' }}>GM Notes (Hidden)</label>
                    <RichTextEditor
                        value={editingQuest.descriptionGM}
                        onChange={val => setEditingQuest({ ...editingQuest, descriptionGM: val })}
                        placeholder="The villagers are actually cultists..."
                        style={{ height: 150, border: '1px solid #d32f2f' }}
                    />
                </div>

                <div className="form-group">
                    <label>Objectives (One per line)</label>
                    <textarea
                        className="modal-input"
                        style={{ height: 100, fontFamily: 'monospace' }}
                        value={editingQuest.tempObjectivesText !== undefined
                            ? editingQuest.tempObjectivesText
                            : editingQuest.objectives.map(o => (o.completed ? '[x] ' : '') + (o.hidden ? '[h] ' : '') + o.text).join('\n')
                        }
                        onChange={e => {
                            const text = e.target.value;
                            const lines = text.split('\n');
                            const objs = lines.map(line => {
                                const completed = line.trim().startsWith('[x]');
                                let cleanLine = line.replace(/^\s*\[x\]\s*/i, '').trim();

                                const hidden = cleanLine.startsWith('[h]') || cleanLine.startsWith('[s]') || cleanLine.startsWith('[secret]');
                                if (hidden) {
                                    cleanLine = cleanLine.replace(/^\[(h|s|secret)\]\s*/i, '').trim();
                                }

                                if (!cleanLine && line.trim() === '') return { text: '', completed: false, hidden: false, isEmpty: true };
                                if (!cleanLine) return null;
                                return { text: cleanLine, completed, hidden };
                            }).filter(Boolean);

                            setEditingQuest({
                                ...editingQuest,
                                objectives: objs,
                                tempObjectivesText: text
                            });
                        }}
                        placeholder="Kill the Rat King&#10;[x] Find the entrance&#10;[h] Secret Objective"
                    />
                </div>

                <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', gap: 10, background: '#222', padding: 10, borderRadius: 4 }}>
                    <div className="form-group">
                        <label>XP Reward</label>
                        <input className="modal-input" type="number" value={editingQuest.rewards.xp} onChange={e => setEditingQuest({ ...editingQuest, rewards: { ...editingQuest.rewards, xp: parseInt(e.target.value) || 0 } })} />
                    </div>
                    <div className="form-group">
                        <label>Gold (gp)</label>
                        <input className="modal-input" type="number" value={editingQuest.rewards.gold} onChange={e => setEditingQuest({ ...editingQuest, rewards: { ...editingQuest.rewards, gold: parseFloat(e.target.value) || 0 } })} />
                    </div>
                    <div className="form-group">
                        <label>Item Rewards (Text)</label>
                        <input className="modal-input" value={editingQuest.rewards.items} onChange={e => setEditingQuest({ ...editingQuest, rewards: { ...editingQuest.rewards, items: e.target.value } })} placeholder="+1 Longsword, 2x Healing Potion" />
                    </div>
                </div>

                {/* REPUTATION EDITOR */}
                <div style={{ marginTop: 10, background: '#222', padding: 10, borderRadius: 4 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                        <label>Reputation Rewards</label>
                        <button className="icon-btn" onClick={() => {
                            const newRep = [...(editingQuest.rewards.reputation || [])];
                            newRep.push({ faction: '', value: 1 });
                            setEditingQuest({ ...editingQuest, rewards: { ...editingQuest.rewards, reputation: newRep } });
                        }}>+ Add Faction</button>
                    </div>
                    {editingQuest.rewards.reputation && editingQuest.rewards.reputation.map((rep, idx) => (
                        <div key={idx} style={{ display: 'flex', gap: 10, marginBottom: 5 }}>
                            <input
                                className="modal-input"
                                placeholder="Faction Name"
                                value={rep.faction}
                                onChange={e => {
                                    const newRep = [...editingQuest.rewards.reputation];
                                    newRep[idx].faction = e.target.value;
                                    setEditingQuest({ ...editingQuest, rewards: { ...editingQuest.rewards, reputation: newRep } });
                                }}
                            />
                            <input
                                className="modal-input"
                                type="number"
                                style={{ width: 80 }}
                                value={rep.value}
                                onChange={e => {
                                    const newRep = [...editingQuest.rewards.reputation];
                                    newRep[idx].value = parseInt(e.target.value) || 0;
                                    setEditingQuest({ ...editingQuest, rewards: { ...editingQuest.rewards, reputation: newRep } });
                                }}
                            />
                            <button className="icon-btn" style={{ color: '#d32f2f' }} onClick={() => {
                                const newRep = editingQuest.rewards.reputation.filter((_, i) => i !== idx);
                                setEditingQuest({ ...editingQuest, rewards: { ...editingQuest.rewards, reputation: newRep } });
                            }}>✖</button>
                        </div>
                    ))}
                    {(!editingQuest.rewards.reputation || editingQuest.rewards.reputation.length === 0) && <div style={{ fontSize: '0.8em', color: '#666' }}>No reputation changes.</div>}
                </div>

                <div className="form-actions" style={{ marginTop: 20, display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                    <button className="set-btn" style={{ background: '#d32f2f', marginRight: 'auto' }} onClick={() => handleDelete(editingQuest.id)}>Delete</button>
                    <button className="set-btn" style={{ background: '#555' }} onClick={() => setIsEditing(false)}>Cancel</button>
                    <button className="set-btn" onClick={handleSaveEdit}>Save Quest</button>
                </div>
            </div>
        );
    }

    // --- MAIN VIEW ---
    // Only show TOP LEVEL quests (no parentId) in the main list, recursion handles the rest
    const topLevelQuests = quests.filter(q => !q.parentId);

    return (
        <div className="quests-view" style={{ padding: 20, height: '100%', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h2>Quest Log</h2>
                <div>
                    {saveStatus === 'success' && <span style={{ color: '#4caf50', marginRight: 10 }}>Saved!</span>}
                    <button className="set-btn" onClick={() => handleCreate(null)}>+ New Quest</button>
                </div>
            </div>

            <div className="quest-list-container">
                {topLevelQuests.length === 0 && quests.length === 0 && (
                    <div style={{ color: '#777', textAlign: 'center', marginTop: 50 }}>No quests found. Start your adventure!</div>
                )}

                {topLevelQuests.map(q => renderQuestRow(q))}

                {/* Catch-all for orphans if any data corruption */}
                {quests.filter(q => q.parentId && !quests.find(p => p.id === q.parentId)).length > 0 && (
                    <div style={{ marginTop: 30, borderTop: '1px solid #444', paddingTop: 10 }}>
                        <h4 style={{ color: '#f44336' }}>Orphaned Subquests (Parent Missing)</h4>
                        {quests.filter(q => q.parentId && !quests.find(p => p.id === q.parentId)).map(q => renderQuestRow(q))}
                    </div>
                )}
            </div>
        </div>
    );
}
