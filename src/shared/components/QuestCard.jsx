import React from 'react';
import { parseFoundry } from '../utils/foundryParser';

const getStatusColor = (s) => {
    switch (s) {
        case 'Active': return '#2196f3';
        case 'Completed': return '#4caf50';
        case 'Failed': return '#f44336';
        case 'Dormant': return '#777';
        default: return '#777';
    }
};

const getStatusIcon = (s) => {
    switch (s) {
        case 'Active': return '⚔️';
        case 'Completed': return '✅';
        case 'Failed': return '❌';
        case 'Dormant': return '💤';
        default: return '❓';
    }
};

export default function QuestCard({ quest, quests, expandedQuestIds, onToggle, onEdit, onCreateSub, onToggleObjective, onToggleObjectiveHidden, onRevealSecret, depth = 0, isGM = false }) {
    const isExpanded = expandedQuestIds.has(quest.id);
    const children = quests.filter(q => q.parentId === quest.id);
    const hasChildren = children.length > 0;

    // Completion Calc - exclude hidden and failed objectives from player view
    const visibleObjectives = isGM
        ? quest.objectives.filter(o => !o.failed) // GM: show all except failed for progress
        : quest.objectives.filter(o => !o.hidden && !o.failed); // Player: hide hidden & failed
    const totalObj = visibleObjectives.length;
    const completedObj = visibleObjectives.filter(o => o.completed).length;
    const progress = totalObj > 0 ? (completedObj / totalObj) * 100 : 0;

    const handleExpand = (e) => {
        if (e) e.stopPropagation();
        onToggle(quest.id);
    };

    // Helper for Status Badge
    const getBadgeClass = (status) => {
        switch (status) {
            case 'Active': return 'active';
            case 'Completed': return 'complete';
            case 'Failed': return 'failed';
            default: return '';
        }
    };

    return (
        <div style={{ marginLeft: depth * 15 }}>
            <div className={`quest-panel ${isExpanded ? 'open' : ''}`}>
                <div className="quest-summary" onClick={handleExpand}>
                    <div className="quest-summary-content">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            {hasChildren && <span style={{ fontSize: '0.8em', color: '#888' }}>{isExpanded ? '▼' : '▶'}</span>}
                            <div className="quest-title">{quest.title}</div>
                        </div>
                        {/* Header Short Description */}
                        <div className="quest-short-desc" dangerouslySetInnerHTML={{ __html: parseFoundry(quest.shortDescription || quest.descriptionPublic || '', { secretMode: isGM ? 'reveal' : 'hide' }) }} />
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span className={`quest-status-badge ${getBadgeClass(quest.status)}`}>{quest.status}</span>
                        {isGM && (onEdit || onCreateSub) && (
                            <div style={{ display: 'flex', gap: 4 }}>
                                {onCreateSub && <button className="icon-btn" onClick={(e) => { e.stopPropagation(); onCreateSub(quest.id); }} title="Add Subquest">➕</button>}
                                {onEdit && <button className="icon-btn" onClick={(e) => { e.stopPropagation(); onEdit(quest); }} title="Edit">✏️</button>}
                            </div>
                        )}
                    </div>
                </div>

                {isExpanded && (
                    <div className="quest-body">
                        {/* GM Secrets */}
                        {isGM && quest.descriptionGM && (
                            <div style={{ background: '#2a1a1a', padding: 10, border: '1px dashed #ef5350', borderRadius: 4, marginBottom: 15 }}>
                                <div style={{ color: '#ef5350', fontSize: '0.75em', textTransform: 'uppercase', marginBottom: 5 }}>GM Secrets</div>
                                <div className="formatted-content" style={{ color: '#ccc', fontSize: '0.95em' }} dangerouslySetInnerHTML={{ __html: parseFoundry(quest.descriptionGM, { secretMode: 'reveal' }) }} />
                            </div>
                        )}

                        {/* Full Description */}
                        {quest.descriptionPublic && (
                            <div
                                className="formatted-content"
                                style={{ marginBottom: 15 }}
                                dangerouslySetInnerHTML={{ __html: parseFoundry(quest.descriptionPublic, { secretMode: isGM ? 'reveal' : 'hide' }) }}
                                onContextMenu={(e) => {
                                    if (isGM && onRevealSecret) {
                                        // Check if clicked exactly on a revealable secret
                                        const target = e.target;
                                        if (target.classList.contains('gm-secret-revealable')) {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            if (window.confirm(`Reveal this text to players?\n"${target.innerText}"`)) {
                                                onRevealSecret(quest.id, target.innerText);
                                            }
                                        }
                                    }
                                }}
                            />
                        )}

                        {/* Objectives */}
                        {totalObj > 0 && (
                            <>
                                <div className="quest-progress-bar">
                                    <div className="quest-progress-fill" style={{ width: `${progress}%` }}></div>
                                </div>
                                <div className="quest-progress-text">Progress: {completedObj}/{totalObj}</div>

                                <ul className="quest-objectives">
                                    {quest.objectives.map((obj, idx) => {
                                        if (!isGM && obj.hidden) return null;
                                        if (!isGM && obj.failed) return null; // Hide failed objectives from players
                                        return (
                                            <li
                                                key={idx}
                                                className={`quest-objective ${obj.completed ? 'completed' : ''} ${obj.failed ? 'failed' : ''}`}
                                                style={{
                                                    cursor: isGM ? 'pointer' : 'default',
                                                    opacity: (isGM && (obj.hidden || obj.failed)) ? 0.5 : 1,
                                                    textDecoration: obj.failed ? 'line-through' : 'none'
                                                }}
                                                onClick={(e) => {
                                                    if (isGM && onToggleObjective) {
                                                        e.stopPropagation();
                                                        onToggleObjective(quest.id, idx);
                                                    }
                                                }}
                                                onContextMenu={(e) => {
                                                    if (isGM && onToggleObjectiveHidden) {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        onToggleObjectiveHidden(quest.id, idx);
                                                    }
                                                }}
                                                title={isGM ? "Click to toggle complete, Right-click to toggle hidden" : ""}
                                            >
                                                <div className="quest-checkbox" style={{ color: obj.failed ? '#e57373' : undefined }}>
                                                    {obj.completed ? '✓' : obj.failed ? '✗' : ''}
                                                </div>
                                                <div className="quest-obj-text">
                                                    {obj.hidden && <span style={{ fontSize: '0.7em', background: '#333', color: '#999', border: '1px solid #555', padding: '1px 4px', borderRadius: 3, marginRight: 6 }}>HIDDEN</span>}
                                                    {isGM && obj.choiceGroup && <span style={{ fontSize: '0.7em', background: '#3a3a1a', color: '#c5a059', padding: '1px 4px', borderRadius: 3, marginRight: 6 }}>OR:{obj.choiceGroup}</span>}
                                                    {obj.text}
                                                </div>
                                            </li>
                                        );
                                    })}
                                </ul>
                            </>
                        )}

                        {/* Rewards - aggregate quest rewards + objective rewards */}
                        {(() => {
                            // Calculate totals from objectives (exclude hidden and failed for players)
                            const visibleForRewards = isGM
                                ? quest.objectives.filter(o => !o.failed)
                                : quest.objectives.filter(o => !o.hidden && !o.failed);
                            const objXp = visibleForRewards.reduce((sum, o) => sum + (o.xp || 0), 0);
                            const objGold = visibleForRewards.reduce((sum, o) => sum + (o.gold || 0), 0);
                            // Aggregate reputation from objectives
                            const objReputation = visibleForRewards.flatMap(o => o.reputation || []);
                            // Combine with quest-level rewards
                            const totalXp = (quest.rewards?.xp || 0) + objXp;
                            const totalGold = (quest.rewards?.gold || 0) + objGold;
                            const allReputation = [...(quest.rewards?.reputation || []), ...objReputation];
                            const hasRewards = totalXp > 0 || totalGold > 0 || quest.rewards?.items || allReputation.length > 0;

                            if (!hasRewards) return null;

                            return (
                                <div className="quest-rewards" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 15, paddingTop: 15, borderTop: '1px dashed #444' }}>
                                    {totalXp > 0 && <div className="quest-reward-pill">🏆 {totalXp} XP</div>}
                                    {totalGold > 0 && <div className="quest-reward-pill">💰 {totalGold} gp</div>}
                                    {quest.rewards?.items && <div className="quest-reward-pill">Items note: {quest.rewards.items}</div>}
                                    {(quest.rewards?.itemRewards || []).map((reward, index) => (
                                        <div key={`${reward.name}-${index}`} className="quest-reward-pill">
                                            Item: {reward.qty || 1}x {reward.name || reward.item?.name} ({reward.target || 'lootBag'})
                                        </div>
                                    ))}
                                    {allReputation.map((rep, i) => (
                                        <div key={i} className="quest-reward-pill" style={{ borderColor: rep.value >= 0 ? '#4caf50' : '#e57373', color: rep.value >= 0 ? '#4caf50' : '#e57373' }}>
                                            <span style={{ fontSize: '1.2em', marginRight: 4 }}>{rep.value >= 0 ? '⬆' : '⬇'}</span>
                                            {rep.faction} ({rep.value > 0 ? '+' : ''}{rep.value})
                                        </div>
                                    ))}
                                </div>
                            );
                        })()}
                    </div>
                )}
            </div>

            {/* Recursive Children */}
            {children.map(child => (
                <QuestCard
                    key={child.id}
                    quest={child}
                    quests={quests}
                    expandedQuestIds={expandedQuestIds}
                    onToggle={onToggle}
                    onEdit={onEdit}
                    onCreateSub={onCreateSub}
                    onToggleObjective={onToggleObjective}
                    onToggleObjectiveHidden={onToggleObjectiveHidden}
                    onRevealSecret={onRevealSecret}
                    depth={depth + 1}
                    isGM={isGM}
                />
            ))}
        </div>
    );
}
