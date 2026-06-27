import React, { useState, useEffect } from 'react';
import RichTextEditor from '../shared/components/RichTextEditor';
import QuestCard from '../shared/components/QuestCard';
import { useCampaign } from '../shared/context/CampaignContext';
import { selectQuestLists } from '../shared/db/selectors/campaignSelectors';

export default function QuestsView({ db }) {
    // Get activeCampaignId from context (this is CRITICAL for rewards distribution)
    const { activeCampaignId, activeCampaign, dataActions } = useCampaign();
    const { quests, archivedQuests, allQuests: rawQuests } = selectQuestLists(db, activeCampaign, activeCampaignId);
    const [isEditing, setIsEditing] = useState(false);
    const [editingQuest, setEditingQuest] = useState(null);
    const [saveStatus, setSaveStatus] = useState(null);
    const [expandedQuestIds, setExpandedQuestIds] = useState(new Set());

    // --- CONSTANTS ---
    const QUEST_TYPES = ['Main', 'Side', 'Bounty', 'Personal'];
    const STATUS_OPTIONS = ['Active', 'Completed', 'Failed', 'Dormant', 'Hidden'];

    // --- ACTIONS ---
    const runQuestAction = async (operation) => {
        if (!activeCampaignId) {
            alert("No active campaign selected.");
            return null;
        }
        setSaveStatus('saving');
        try {
            const result = await operation();
            setSaveStatus('success');
            setTimeout(() => setSaveStatus(null), 2000);
            return result;
        } catch (err) {
            console.error(err);
            setSaveStatus('error');
            alert(err?.message || String(err));
            return null;
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
            subquests: [],
            parentId: parentId
        };
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
        if (!rawQuests.some(q => q.id === questId)) {
            setIsEditing(false);
            setEditingQuest(null);
            return;
        }
        if (!window.confirm("Archive this quest AND its subquests?")) return;
        await runQuestAction(() => dataActions.quest.softDeleteQuest(activeCampaignId, questId));
        if (editingQuest?.id === questId) setIsEditing(false);
    };

    const handleRestore = async (questId) => {
        await runQuestAction(() => dataActions.quest.restoreQuest(activeCampaignId, questId));
    };

    const handleSaveEdit = async () => {
        if (!editingQuest.title) return alert("Title required");
        const questToSave = { ...editingQuest };
        delete questToSave.tempObjectivesText;
        const exists = rawQuests.some(q => q.id === questToSave.id);
        await runQuestAction(() =>
            exists
                ? dataActions.quest.updateQuest(activeCampaignId, questToSave.id, () => questToSave)
                : dataActions.quest.createQuest(activeCampaignId, questToSave)
        );
        setIsEditing(false);
        setEditingQuest(null);
    };

    const toggleExpand = (id) => {
        const newSet = new Set(expandedQuestIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setExpandedQuestIds(newSet);
    };

    const toggleObjective = async (questId, objIndex) => {
        const qIndex = quests.findIndex(q => q.id === questId);
        if (qIndex === -1) return;

        const q = quests[qIndex];
        const isCompleted = q.objectives[objIndex]?.completed;

        const msg = isCompleted
            ? `Mark objective "${q.objectives[objIndex].text}" as Incomplete?`
            : `Mark objective "${q.objectives[objIndex].text}" as Completed?`;

        if (!window.confirm(msg)) return;
        await runQuestAction(() =>
            dataActions.quest.toggleObjective(activeCampaignId, questId, objIndex, !isCompleted)
        );
    };

    const toggleObjectiveHidden = async (questId, objIndex) => {
        const qIndex = quests.findIndex(q => q.id === questId);
        if (qIndex === -1) return;

        const q = quests[qIndex];
        const isHidden = q.objectives[objIndex].hidden;
        const msg = isHidden
            ? `Reveal objective "${q.objectives[objIndex].text}" to players?`
            : `Hide objective "${q.objectives[objIndex].text}" from players?`;

        if (!window.confirm(msg)) return;

        await runQuestAction(() => dataActions.quest.toggleObjectiveHidden(activeCampaignId, questId, objIndex));
    };

    const revealSecret = async (questId, secretText) => {
        const qIndex = quests.findIndex(q => q.id === questId);
        if (qIndex === -1) return;
        const q = quests[qIndex];

        const target = `||${secretText}||`;
        if ((q.descriptionPublic || '').includes(target)) {
            await runQuestAction(() => dataActions.quest.revealSecret(activeCampaignId, questId, secretText));
        }
    };

    // Fix: RegExp constructor usage above was pseudo-code.
    // Real implementation inside the function below.

    // --- MAIN VIEW RENDER ---
    const topLevelQuests = quests.filter(q => !q.parentId);

    if (isEditing && editingQuest) {
        return (
            <div className="quest-editor-container">
                <div className="editor-header">
                    <h2>{editingQuest.id && quests.find(q => q.id === editingQuest.id) ? 'Edit Quest' : 'New Quest'}</h2>
                </div>
                {/* Edit Form */}
                <div className="quest-editor" style={{ padding: 20, maxWidth: 800, margin: '0 auto', background: '#1a1a1a', borderRadius: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                        {editingQuest.parentId && <span className="qc-badge badge-side">Subquest</span>}
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
                        <label>Short Description (Header)</label>
                        <input
                            className="modal-input"
                            value={editingQuest.shortDescription || ''}
                            onChange={e => setEditingQuest({ ...editingQuest, shortDescription: e.target.value })}
                            placeholder="Brief summary visible in the header..."
                        />
                    </div>

                    <div className="form-group">
                        <label>Public Description</label>
                        <RichTextEditor
                            value={editingQuest.descriptionPublic}
                            onChange={val => setEditingQuest({ ...editingQuest, descriptionPublic: val })}
                            style={{ height: 150 }}
                        />
                    </div>

                    <div className="form-group">
                        <label style={{ color: '#e57373' }}>GM Secrets</label>
                        <RichTextEditor
                            value={editingQuest.descriptionGM}
                            onChange={val => setEditingQuest({ ...editingQuest, descriptionGM: val })}
                            style={{ height: 150, border: '1px solid #d32f2f' }}
                        />
                    </div>

                    <div className="form-group">
                        <label>Objectives <span style={{ fontSize: '0.75em', color: '#888' }}>[x]=done [f]=failed [h]=hidden [or:X]=choice group rep(Faction,±N) {'{xp:N,gold:N}'}</span></label>
                        <textarea
                            className="modal-input"
                            style={{ height: 100, fontFamily: 'monospace' }}
                            value={editingQuest.tempObjectivesText !== undefined
                                ? editingQuest.tempObjectivesText
                                : editingQuest.objectives.map(o => {
                                    let line = '';
                                    if (o.completed) line += '[x] ';
                                    if (o.failed) line += '[f] ';
                                    if (o.hidden) line += '[h] ';
                                    if (o.choiceGroup) line += `[or:${o.choiceGroup}] `;
                                    line += o.text;
                                    // Append reputation rewards
                                    if (o.reputation?.length > 0) {
                                        o.reputation.forEach(rep => {
                                            const faction = rep.faction.includes(' ') ? `"${rep.faction}"` : rep.faction;
                                            line += ` rep(${faction},${rep.value > 0 ? '+' : ''}${rep.value})`;
                                        });
                                    }
                                    // Append xp/gold rewards
                                    if (o.xp > 0 || o.gold > 0) {
                                        const parts = [];
                                        if (o.xp > 0) parts.push(`xp:${o.xp}`);
                                        if (o.gold > 0) parts.push(`gold:${o.gold}`);
                                        line += ` {${parts.join(',')}}`;
                                    }
                                    return line;
                                }).join('\n')
                            }
                            onChange={e => {
                                const text = e.target.value;
                                const lines = text.split('\n');
                                const objs = lines.map(line => {
                                    const completed = line.trim().startsWith('[x]');
                                    let cleanLine = line.replace(/^\s*\[x\]\s*/i, '').trim();
                                    const hidden = cleanLine.startsWith('[h]') || cleanLine.startsWith('[s]') || cleanLine.startsWith('[secret]');
                                    if (hidden) cleanLine = cleanLine.replace(/^\[(h|s|secret)\]\s*/i, '').trim();

                                    // Parse rewards {xp:10,gold:50} and rep(Faction,+1)
                                    let xp = 0, gold = 0;
                                    const reputation = [];

                                    // Parse {xp:N,gold:N}
                                    const rewardMatch = cleanLine.match(/\{([^}]+)\}\s*$/);
                                    if (rewardMatch) {
                                        cleanLine = cleanLine.replace(/\{[^}]+\}\s*$/, '').trim();
                                        const rewardStr = rewardMatch[1];
                                        const xpMatch = rewardStr.match(/xp:\s*(\d+)/i);
                                        const goldMatch = rewardStr.match(/gold:\s*(\d+)/i);
                                        if (xpMatch) xp = parseInt(xpMatch[1]);
                                        if (goldMatch) gold = parseInt(goldMatch[1]);
                                    }

                                    // Parse rep("Faction",+1) or rep(Faction,-1)
                                    const repRegex = /rep\(\s*"?([^",]+)"?\s*,\s*([+-]?\d+)\s*\)/gi;
                                    let repMatch;
                                    while ((repMatch = repRegex.exec(cleanLine)) !== null) {
                                        reputation.push({ faction: repMatch[1].trim(), value: parseInt(repMatch[2]) });
                                    }
                                    cleanLine = cleanLine.replace(repRegex, '').trim();

                                    // Parse choice groups [or:X] where X is the group name
                                    let choiceGroup = null;
                                    const choiceMatch = cleanLine.match(/\[or:([^\]]+)\]/i);
                                    if (choiceMatch) {
                                        choiceGroup = choiceMatch[1].trim();
                                        cleanLine = cleanLine.replace(/\[or:[^\]]+\]\s*/i, '').trim();
                                    }

                                    // Parse failed state [f]
                                    const failed = cleanLine.startsWith('[f]');
                                    if (failed) cleanLine = cleanLine.replace(/^\[f\]\s*/i, '').trim();

                                    if (!cleanLine && line.trim() === '') return null;
                                    if (!cleanLine) return null;
                                    return { text: cleanLine, completed, hidden, xp, gold, reputation, choiceGroup, failed };
                                }).filter(Boolean);
                                setEditingQuest({ ...editingQuest, objectives: objs, tempObjectivesText: text });
                            }}
                            placeholder="Kill the Rat King {xp:50,gold:100}&#10;[or:statue] Bring statue to NPC A rep(Velran,+1)&#10;[or:statue] Bring statue to NPC B rep(Cultists,+1)&#10;[h] Secret task {xp:25}"
                        />

                        {/* Structured Objectives View */}
                        {editingQuest.objectives.length > 0 && (
                            <div style={{ marginTop: 10, fontSize: '0.85em', background: '#222', padding: 10, borderRadius: 4 }}>
                                <div style={{ color: '#888', marginBottom: 5 }}>Parsed Objectives:</div>
                                {editingQuest.objectives.map((obj, idx) => (
                                    <div key={idx} style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 8,
                                        padding: '4px 0',
                                        borderBottom: '1px solid #333',
                                        opacity: obj.hidden ? 0.5 : 1
                                    }}>
                                        <span style={{ width: 20, color: obj.completed ? '#4caf50' : obj.failed ? '#e57373' : '#555' }}>
                                            {obj.completed ? '✓' : obj.failed ? '✗' : '○'}
                                        </span>
                                        <span style={{
                                            flex: 1,
                                            color: obj.hidden ? '#888' : obj.failed ? '#666' : '#ccc',
                                            textDecoration: obj.failed ? 'line-through' : 'none'
                                        }}>
                                            {obj.hidden && <span style={{ fontSize: '0.7em', background: '#333', padding: '1px 4px', borderRadius: 3, marginRight: 5 }}>HIDDEN</span>}
                                            {obj.choiceGroup && <span style={{ fontSize: '0.7em', background: '#3a3a1a', color: '#c5a059', padding: '1px 4px', borderRadius: 3, marginRight: 5 }}>OR:{obj.choiceGroup}</span>}
                                            {obj.text}
                                        </span>
                                        {(obj.xp > 0 || obj.gold > 0 || obj.reputation?.length > 0) && (
                                            <span style={{ fontSize: '0.85em', display: 'flex', gap: 8 }}>
                                                {obj.xp > 0 && <span style={{ color: 'var(--text-gold)' }}>🏆{obj.xp}</span>}
                                                {obj.gold > 0 && <span style={{ color: 'var(--text-gold)' }}>💰{obj.gold}</span>}
                                                {obj.reputation?.map((rep, i) => (
                                                    <span key={i} style={{ color: rep.value >= 0 ? '#4caf50' : '#e57373' }}>
                                                        {rep.value >= 0 ? '⬆' : '⬇'}{rep.faction}({rep.value > 0 ? '+' : ''}{rep.value})
                                                    </span>
                                                ))}
                                            </span>
                                        )}
                                    </div>
                                ))}
                                {/* Total aggregated rewards */}
                                {editingQuest.objectives.some(o => o.xp > 0 || o.gold > 0 || o.reputation?.length > 0) && (
                                    <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px dashed #444', color: '#888' }}>
                                        <strong>Subtask Total:</strong>
                                        <span style={{ color: 'var(--text-gold)', marginLeft: 10 }}>
                                            🏆 {editingQuest.objectives.reduce((sum, o) => sum + (o.xp || 0), 0)} XP
                                        </span>
                                        <span style={{ color: 'var(--text-gold)', marginLeft: 10 }}>
                                            💰 {editingQuest.objectives.reduce((sum, o) => sum + (o.gold || 0), 0)} gp
                                        </span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Rewards Editor */}
                    <div className="form-section">
                        <h4>Rewards</h4>
                        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                            <div className="form-group">
                                <label>XP</label>
                                <input className="modal-input" type="number" style={{ width: 80 }} value={editingQuest.rewards.xp} onChange={e => setEditingQuest({ ...editingQuest, rewards: { ...editingQuest.rewards, xp: parseInt(e.target.value) || 0 } })} />
                            </div>
                            <div className="form-group">
                                <label>Gold</label>
                                <input className="modal-input" type="number" style={{ width: 80 }} value={editingQuest.rewards.gold} onChange={e => setEditingQuest({ ...editingQuest, rewards: { ...editingQuest.rewards, gold: parseFloat(e.target.value) || 0 } })} />
                            </div>
                            <div className="form-group" style={{ flex: 1 }}>
                                <label>Legacy Item Note</label>
                                <input className="modal-input" value={editingQuest.rewards.items} onChange={e => setEditingQuest({ ...editingQuest, rewards: { ...editingQuest.rewards, items: e.target.value } })} />
                            </div>
                        </div>

                        <div style={{ marginTop: 10 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 5 }}>
                                <label>Structured Item Rewards</label>
                                <button className="icon-btn" onClick={() => {
                                    const itemRewards = [...(editingQuest.rewards.itemRewards || [])];
                                    itemRewards.push({ name: '', qty: 1, target: 'lootBag' });
                                    setEditingQuest({ ...editingQuest, rewards: { ...editingQuest.rewards, itemRewards } });
                                }}>+ Add</button>
                            </div>
                            {(editingQuest.rewards.itemRewards || []).map((reward, idx) => (
                                <div key={idx} style={{ display: 'flex', gap: 8, marginBottom: 5, alignItems: 'center' }}>
                                    <input className="modal-input" placeholder="Item name" value={reward.name || reward.item?.name || ''} onChange={e => {
                                        const itemRewards = [...(editingQuest.rewards.itemRewards || [])];
                                        itemRewards[idx] = { ...itemRewards[idx], name: e.target.value, item: { ...(itemRewards[idx].item || {}), name: e.target.value } };
                                        setEditingQuest({ ...editingQuest, rewards: { ...editingQuest.rewards, itemRewards } });
                                    }} />
                                    <input className="modal-input" type="number" min="1" style={{ width: 70 }} value={reward.qty || 1} onChange={e => {
                                        const itemRewards = [...(editingQuest.rewards.itemRewards || [])];
                                        itemRewards[idx] = { ...itemRewards[idx], qty: parseInt(e.target.value) || 1 };
                                        setEditingQuest({ ...editingQuest, rewards: { ...editingQuest.rewards, itemRewards } });
                                    }} />
                                    <select className="modal-input" style={{ width: 120 }} value={reward.target || 'lootBag'} onChange={e => {
                                        const itemRewards = [...(editingQuest.rewards.itemRewards || [])];
                                        itemRewards[idx] = { ...itemRewards[idx], target: e.target.value };
                                        setEditingQuest({ ...editingQuest, rewards: { ...editingQuest.rewards, itemRewards } });
                                    }}>
                                        <option value="lootBag">Lootbag</option>
                                        <option value="party">Party once</option>
                                        <option value="each">Each PC</option>
                                    </select>
                                    <button className="icon-btn" onClick={() => {
                                        const itemRewards = [...(editingQuest.rewards.itemRewards || [])];
                                        itemRewards.splice(idx, 1);
                                        setEditingQuest({ ...editingQuest, rewards: { ...editingQuest.rewards, itemRewards } });
                                    }}>x</button>
                                </div>
                            ))}
                        </div>

                        <div style={{ marginTop: 10 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 5 }}>
                                <label>Reputation</label>
                                <button className="icon-btn" onClick={() => {
                                    const newRep = [...(editingQuest.rewards.reputation || [])];
                                    newRep.push({ faction: '', value: 1 });
                                    setEditingQuest({ ...editingQuest, rewards: { ...editingQuest.rewards, reputation: newRep } });
                                }}>+ Add</button>
                            </div>
                            {editingQuest.rewards.reputation?.map((rep, idx) => (
                                <div key={idx} style={{ display: 'flex', gap: 10, marginBottom: 5 }}>
                                    <input className="modal-input" placeholder="Faction" value={rep.faction} onChange={e => {
                                        const newRep = [...editingQuest.rewards.reputation];
                                        newRep[idx].faction = e.target.value;
                                        setEditingQuest({ ...editingQuest, rewards: { ...editingQuest.rewards, reputation: newRep } });
                                    }} />
                                    <input className="modal-input" type="number" style={{ width: 60 }} value={rep.value} onChange={e => {
                                        const newRep = [...editingQuest.rewards.reputation];
                                        newRep[idx].value = parseInt(e.target.value) || 0;
                                        setEditingQuest({ ...editingQuest, rewards: { ...editingQuest.rewards, reputation: newRep } });
                                    }} />
                                    <button className="icon-btn" style={{ color: '#d32f2f' }} onClick={() => {
                                        const newRep = editingQuest.rewards.reputation.filter((_, i) => i !== idx);
                                        setEditingQuest({ ...editingQuest, rewards: { ...editingQuest.rewards, reputation: newRep } });
                                    }}>✖</button>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="form-actions" style={{ marginTop: 20, display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                        <button className="set-btn" style={{ background: '#d32f2f', marginRight: 'auto' }} onClick={() => handleDelete(editingQuest.id)}>Delete</button>
                        <button className="set-btn" style={{ background: '#555' }} onClick={() => setIsEditing(false)}>Cancel</button>
                        <button className="set-btn" onClick={handleSaveEdit}>Save Quest</button>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="quests-view">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, padding: '0 10px' }}>
                <h2 style={{ fontFamily: 'Cinzel, serif', color: '#c5a059' }}>Quest Log</h2>
                <div>
                    {saveStatus === 'success' && <span style={{ color: '#4caf50', marginRight: 10 }}>Saved!</span>}
                    <button className="set-btn" onClick={() => handleCreate(null)}>+ New Quest</button>
                </div>
            </div>

            <div className="quest-list-container">
                {topLevelQuests.length === 0 && quests.length === 0 && (
                    <div style={{ color: '#777', textAlign: 'center', marginTop: 50 }}>No quests found. Start your adventure!</div>
                )}

                {topLevelQuests.map(q => (
                    <QuestCard
                        key={q.id}
                        quest={q}
                        quests={quests}
                        expandedQuestIds={expandedQuestIds}
                        onToggle={toggleExpand}
                        onEdit={handleEdit}
                        onCreateSub={handleCreate}
                        onToggleObjective={toggleObjective}
                        onToggleObjectiveHidden={toggleObjectiveHidden}
                        onRevealSecret={revealSecret}
                        isGM={true}
                    />
                ))}

                {/* Orphans catch-all */}
                {quests.filter(q => q.parentId && !quests.find(p => p.id === q.parentId)).length > 0 && (
                    <div style={{ marginTop: 30, padding: 20 }}>
                        <h4 style={{ color: '#f44336' }}>Orphaned Subquests</h4>
                        {quests.filter(q => q.parentId && !quests.find(p => p.id === q.parentId)).map(q => (
                            <QuestCard
                                key={q.id}
                                quest={q}
                                quests={quests} // Pass full list for recursion
                                expandedQuestIds={expandedQuestIds}
                                onToggle={toggleExpand}
                                onEdit={handleEdit}
                                onCreateSub={handleCreate}
                                onToggleObjective={toggleObjective}
                                onToggleObjectiveHidden={toggleObjectiveHidden}
                                onRevealSecret={revealSecret}
                                isGM={true}
                            />
                        ))}
                    </div>
                )}

                {archivedQuests.length > 0 && (
                    <div style={{ marginTop: 30, padding: 20, borderTop: '1px solid #333' }}>
                        <h4 style={{ color: '#888' }}>Archived Quests</h4>
                        {archivedQuests.map(q => (
                            <div
                                key={q.id}
                                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '8px 0', borderBottom: '1px solid #222' }}
                            >
                                <span style={{ color: '#aaa' }}>{q.title}</span>
                                <button className="set-btn" onClick={() => handleRestore(q.id)}>Restore</button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <style>{`
                /* Container */
                .quests-view { padding: 20px; height: 100%; overflow-y: auto; background: #121212; }
                .quest-list-container { max-width: 900px; margin: 0 auto; }
            `}</style>
        </div>
    );
}
