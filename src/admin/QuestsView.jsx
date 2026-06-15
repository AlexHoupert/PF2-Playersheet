import React, { useState, useEffect } from 'react';
import RichTextEditor from '../shared/components/RichTextEditor';
import QuestCard from '../shared/components/QuestCard';
import { useCampaign } from '../shared/context/CampaignContext';

export default function QuestsView({ db, setDb }) {
    // Get activeCampaignId from context (this is CRITICAL for rewards distribution)
    const { activeCampaignId, activeCampaign } = useCampaign();
    const quests = activeCampaign?.quests || db?.quests || [];
    const [isEditing, setIsEditing] = useState(false);
    const [editingQuest, setEditingQuest] = useState(null);
    const [saveStatus, setSaveStatus] = useState(null);
    const [expandedQuestIds, setExpandedQuestIds] = useState(new Set());

    const withQuestScope = (sourceDb, updatedQuests, extra = {}) => {
        const nextDb = { ...sourceDb, ...extra, quests: updatedQuests };
        if (activeCampaignId && sourceDb.campaigns?.[activeCampaignId]) {
            nextDb.campaigns = {
                ...sourceDb.campaigns,
                [activeCampaignId]: {
                    ...sourceDb.campaigns[activeCampaignId],
                    ...extra.campaignOverride,
                    quests: updatedQuests,
                }
            };
        }
        delete nextDb.campaignOverride;
        return nextDb;
    };

    const persistDevDbFile = async (dbSnapshot) => {
        if (!import.meta.env.DEV || import.meta.env.VITE_ENABLE_DEV_FILE_WRITES !== 'true') return;
        await fetch('/api/files/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filePath: 'src/data/new_db.json', content: dbSnapshot })
        });
    };

    // --- CONSTANTS ---
    const QUEST_TYPES = ['Main', 'Side', 'Bounty', 'Personal'];
    const STATUS_OPTIONS = ['Active', 'Completed', 'Failed', 'Dormant', 'Hidden'];

    // --- ACTIONS ---
    const saveQuests = async (newQuests) => {
        setSaveStatus('saving');
        try {
            // Update Global State (propagates to PlayerApp)
            setDb(prev => withQuestScope(prev, newQuests));

            // Persist to File (for dev/reload)
            await persistDevDbFile(withQuestScope(db, newQuests));
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
        if (!window.confirm("Delete this quest AND its subquests?")) return;
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
        await saveQuests(updated);
        if (editingQuest?.id === questId) setIsEditing(false);
    };

    const handleSaveEdit = () => {
        if (!editingQuest.title) return alert("Title required");
        let updated = [...quests];
        const existingIdx = updated.findIndex(q => q.id === editingQuest.id);

        if (existingIdx > -1) updated[existingIdx] = editingQuest;
        else updated.push(editingQuest);

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

    const distributeRewards = (quest, characters) => {
        const rewards = quest.rewards || {};
        const notifications = [];
        let updatedChars = characters ? JSON.parse(JSON.stringify(characters)) : [];

        // 1. Notify Quest Complete
        notifications.push({ id: crypto.randomUUID(), type: 'quest', text: quest.title });

        // 2. XP
        if (rewards.xp > 0) {
            updatedChars.forEach(c => {
                if (!c.xp) c.xp = { current: 0, max: 1000 };
                c.xp.current = (c.xp.current || 0) + rewards.xp;
            });
            notifications.push({ id: crypto.randomUUID(), type: 'xp', amount: rewards.xp });
        }

        // 3. Gold
        if (rewards.gold > 0) {
            updatedChars.forEach(c => {
                let currentGold = parseFloat(c.gold || 0);
                currentGold += parseFloat(rewards.gold);
                c.gold = currentGold.toFixed(2);
            });
            notifications.push({ id: crypto.randomUUID(), type: 'gold', amount: rewards.gold });
        }

        // 4. Reputation
        if (rewards.reputation && rewards.reputation.length > 0) {
            rewards.reputation.forEach(rep => {
                notifications.push({
                    id: crypto.randomUUID(),
                    type: 'reputation',
                    faction: rep.faction,
                    amount: rep.value
                });
            });
        }

        return { updatedChars, notifications };
    };

    const toggleObjective = (questId, objIndex) => {
        const qIndex = quests.findIndex(q => q.id === questId);
        if (qIndex === -1) return;

        const q = quests[qIndex];
        const isCompleted = q.objectives[objIndex]?.completed;

        const msg = isCompleted
            ? `Mark objective "${q.objectives[objIndex].text}" as Incomplete?`
            : `Mark objective "${q.objectives[objIndex].text}" as Completed?`;

        if (!window.confirm(msg)) return;

        // Use functional update to ensure concurrency safety
        setDb(prevDb => {
            const dbQuests = prevDb.quests || [];
            const dbQIndex = dbQuests.findIndex(q => q.id === questId);

            // Safety check: if quest disappeared in background
            if (dbQIndex === -1) return prevDb;

            const updatedQuests = [...dbQuests];
            let updatedQ = { ...updatedQuests[dbQIndex] };
            updatedQ.objectives = [...updatedQ.objectives];

            // Enforce the intended toggle based on the UI state the user interacted with
            // Using User Intent (!isCompleted) is safer for "Mark as Completed" actions.
            updatedQ.objectives[objIndex] = {
                ...updatedQ.objectives[objIndex],
                completed: !isCompleted
            };

            // Auto-fail other objectives in the same choice group
            const justCompleted = !isCompleted;
            const choiceGroup = updatedQ.objectives[objIndex].choiceGroup;
            if (justCompleted && choiceGroup) {
                updatedQ.objectives = updatedQ.objectives.map((obj, i) => {
                    if (i !== objIndex && obj.choiceGroup === choiceGroup && !obj.completed) {
                        return { ...obj, failed: true };
                    }
                    return obj;
                });
            }

            // Check completion: count non-failed objectives for "all complete" check
            const nonFailedObjectives = updatedQ.objectives.filter(o => !o.failed);
            const reallyAllComplete = nonFailedObjectives.length > 0 && nonFailedObjectives.every(o => o.completed);

            // Logic: If just completing the last objective, and quest wasn't already marked Complete
            if (!isCompleted && reallyAllComplete && updatedQ.status !== 'Completed') {
                updatedQ.status = 'Completed';
                updatedQuests[dbQIndex] = updatedQ;

                // --- Distribute Rewards (Atomic with DB update) ---
                // NOTE: activeCampaignId comes from useCampaign() hook closure, NOT prevDb
                // This is critical because activeCampaignId is derived from localStorage in CampaignContext,
                // not stored in the db object. Using prevDb.activeCampaignId would always be undefined.
                if (!activeCampaignId) {
                    console.warn('[QuestsView] No activeCampaignId available for reward distribution');
                    // No active campaign, just save the quest update
                    const finalDb = withQuestScope(prevDb, updatedQuests);

                    persistDevDbFile(finalDb).catch(e => console.error(e));

                    return finalDb;
                }

                const campaigns = prevDb.campaigns || {};

                const isCampaignsArray = Array.isArray(campaigns);
                let campaign = isCampaignsArray
                    ? campaigns.find(c => c.id === activeCampaignId)
                    : campaigns[activeCampaignId];

                const campaignCharacters = campaign ? (campaign.characters || []) : [];

                const { updatedChars, notifications } = distributeRewards(updatedQ, campaignCharacters);

                // Also update campaign-level XP to stay in sync with character XP
                // The campaign.xp field is used by the Admin XP control
                const rewardXp = updatedQ.rewards?.xp || 0;
                const updatedCampaignXp = (campaign?.xp || 0) + rewardXp;

                // Reconstruct Campaigns with updated characters and XP
                let updatedCampaigns;
                if (isCampaignsArray) {
                    updatedCampaigns = campaigns.map(c =>
                        c.id === activeCampaignId
                            ? { ...c, characters: updatedChars, xp: updatedCampaignXp, quests: updatedQuests }
                            : c
                    );
                } else {
                    updatedCampaigns = {
                        ...campaigns,
                        [activeCampaignId]: {
                            ...campaign,
                            characters: updatedChars,
                            xp: updatedCampaignXp,
                            quests: updatedQuests
                        }
                    };
                }

                const finalDb = {
                    ...prevDb,
                    quests: updatedQuests,
                    campaigns: updatedCampaigns,
                    // Append new notifications to existing queue, preventing overwrite of concurrent removals
                    notificationQueue: [...(prevDb.notificationQueue || []), ...notifications]
                };

                // Side Effect: Persist to File
                // Note: fetch is async, but we send the calculated state immediately.
                persistDevDbFile(finalDb).catch(e => console.error(e));

                return finalDb;

            } else {
                // --- Objective Update (potentially with per-objective rewards) ---
                updatedQuests[dbQIndex] = updatedQ;

                const objective = updatedQ.objectives[objIndex];
                const hasObjRewards = !isCompleted && (objective.xp > 0 || objective.gold > 0 || objective.reputation?.length > 0);

                // If completing an objective with rewards, distribute them
                if (hasObjRewards && activeCampaignId) {
                    const campaigns = prevDb.campaigns || {};
                    const isCampaignsArray = Array.isArray(campaigns);
                    let campaign = isCampaignsArray
                        ? campaigns.find(c => c.id === activeCampaignId)
                        : campaigns[activeCampaignId];

                    const campaignCharacters = campaign ? (campaign.characters || []) : [];
                    let updatedChars = JSON.parse(JSON.stringify(campaignCharacters));
                    const notifications = [];

                    // Distribute objective XP
                    if (objective.xp > 0) {
                        updatedChars.forEach(c => {
                            if (!c.xp) c.xp = { current: 0, max: 1000 };
                            c.xp.current = (c.xp.current || 0) + objective.xp;
                        });
                        notifications.push({ id: crypto.randomUUID(), type: 'xp', amount: objective.xp });
                    }

                    // Distribute objective Gold
                    if (objective.gold > 0) {
                        updatedChars.forEach(c => {
                            let currentGold = parseFloat(c.gold || 0);
                            currentGold += parseFloat(objective.gold);
                            c.gold = currentGold.toFixed(2);
                        });
                        notifications.push({ id: crypto.randomUUID(), type: 'gold', amount: objective.gold });
                    }

                    // Distribute objective Reputation
                    if (objective.reputation?.length > 0) {
                        objective.reputation.forEach(rep => {
                            notifications.push({
                                id: crypto.randomUUID(),
                                type: 'reputation',
                                faction: rep.faction,
                                amount: rep.value
                            });
                        });
                    }

                    // Update campaign-level XP
                    const updatedCampaignXp = (campaign?.xp || 0) + (objective.xp || 0);

                    let updatedCampaigns;
                    if (isCampaignsArray) {
                        updatedCampaigns = campaigns.map(c =>
                            c.id === activeCampaignId
                                ? { ...c, characters: updatedChars, xp: updatedCampaignXp, quests: updatedQuests }
                                : c
                        );
                    } else {
                        updatedCampaigns = {
                            ...campaigns,
                            [activeCampaignId]: {
                                ...campaign,
                                characters: updatedChars,
                                xp: updatedCampaignXp,
                                quests: updatedQuests
                            }
                        };
                    }

                    const finalDb = {
                        ...prevDb,
                        quests: updatedQuests,
                        campaigns: updatedCampaigns,
                        notificationQueue: [...(prevDb.notificationQueue || []), ...notifications]
                    };

                    persistDevDbFile(finalDb).catch(e => console.error(e));

                    return finalDb;
                }

                // No per-objective rewards, just save the update
                const finalDb = withQuestScope(prevDb, updatedQuests);

                persistDevDbFile(finalDb).catch(e => console.error(e));

                return finalDb;
            }
        });
    };

    const toggleObjectiveHidden = (questId, objIndex) => {
        const qIndex = quests.findIndex(q => q.id === questId);
        if (qIndex === -1) return;

        const q = quests[qIndex];
        const isHidden = q.objectives[objIndex].hidden;
        const msg = isHidden
            ? `Reveal objective "${q.objectives[objIndex].text}" to players?`
            : `Hide objective "${q.objectives[objIndex].text}" from players?`;

        if (!window.confirm(msg)) return;

        const updatedQuests = [...quests];
        const updatedQ = { ...updatedQuests[qIndex] };
        updatedQ.objectives = [...updatedQ.objectives];
        updatedQ.objectives[objIndex] = { ...updatedQ.objectives[objIndex], hidden: !isHidden };
        updatedQuests[qIndex] = updatedQ;
        saveQuests(updatedQuests);
    };

    const revealSecret = (questId, secretText) => {
        const qIndex = quests.findIndex(q => q.id === questId);
        if (qIndex === -1) return;
        const updatedQuests = [...quests];
        const q = { ...updatedQuests[qIndex] };

        // Replace ||secretText|| with secretText
        // Escaping generic regex characters in secretText just in case
        const target = `||${secretText}||`;
        if (q.descriptionPublic.includes(target)) {
            // Replace all occurrences of this specific hidden block
            q.descriptionPublic = q.descriptionPublic.replaceAll(target, secretText);
            updatedQuests[qIndex] = q;
            saveQuests(updatedQuests);
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
                                <label>Items</label>
                                <input className="modal-input" value={editingQuest.rewards.items} onChange={e => setEditingQuest({ ...editingQuest, rewards: { ...editingQuest.rewards, items: e.target.value } })} />
                            </div>
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
            </div>

            <style>{`
                /* Container */
                .quests-view { padding: 20px; height: 100%; overflow-y: auto; background: #121212; }
                .quest-list-container { max-width: 900px; margin: 0 auto; }
            `}</style>
        </div>
    );
}
