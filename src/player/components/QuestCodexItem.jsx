import React from 'react';
import { parseFoundry } from '../../shared/utils/foundryParser';

export default function QuestCodexItem({ quest, onToggleObjective }) {
    // Calculate progress - exclude hidden and failed objectives from player view
    const visibleObjectives = quest.objectives.filter(o => !o.hidden && !o.failed);
    const totalObj = visibleObjectives.length;
    const completedObj = visibleObjectives.filter(o => o.completed).length;
    const progress = totalObj > 0 ? (completedObj / totalObj) * 100 : 0;

    const [expanded, setExpanded] = React.useState(false);

    // Status Badge Helper
    const getBadgeClass = (status) => {
        switch (status) {
            case 'Active': return 'active';
            case 'Completed': return 'complete';
            case 'Failed': return 'failed';
            default: return '';
        }
    };

    return (
        <details className="quest-panel" open={expanded} onToggle={(e) => setExpanded(e.target.open)}>
            <summary className="quest-summary">
                <div className="quest-summary-content">
                    <div className="quest-title">{quest.title}</div>
                    <div className="quest-short-desc" dangerouslySetInnerHTML={{ __html: parseFoundry(quest.shortDescription || quest.descriptionPublic || '') }} />
                </div>
                <span className={`quest-status-badge ${getBadgeClass(quest.status)}`}>{quest.status}</span>
            </summary>

            <div className="quest-body">
                {/* Full Description if open */}
                {quest.descriptionPublic && (
                    <div className="formatted-content" style={{ marginBottom: 15 }} dangerouslySetInnerHTML={{ __html: parseFoundry(quest.descriptionPublic) }} />
                )}

                {/* Progress Bar */}
                {totalObj > 0 && (
                    <>
                        <div className="quest-progress-bar">
                            <div className="quest-progress-fill" style={{ width: `${progress}%` }}></div>
                        </div>
                        <div className="quest-progress-text">
                            Progress: {completedObj}/{totalObj}
                        </div>
                    </>
                )}

                {/* Task List */}
                {totalObj > 0 && (
                    <ul className="quest-objectives">
                        {quest.objectives.map((obj, idx) => {
                            if (obj.hidden) return null; // Hide GM stuff
                            return (
                                <li
                                    key={idx}
                                    className={`quest-objective ${obj.completed ? 'completed' : ''}`}
                                    onClick={() => onToggleObjective && onToggleObjective(quest.id, idx)}
                                >
                                    <div className="quest-checkbox">{obj.completed ? '✓' : ''}</div>
                                    <div className="quest-obj-text">{obj.text}</div>
                                </li>
                            );
                        })}
                    </ul>
                )}

                {/* Rewards - aggregate quest rewards + objective rewards (exclude hidden and failed) */}
                {(() => {
                    const visibleObjectives = quest.objectives.filter(o => !o.hidden && !o.failed);
                    const objXp = visibleObjectives.reduce((sum, o) => sum + (o.xp || 0), 0);
                    const objGold = visibleObjectives.reduce((sum, o) => sum + (o.gold || 0), 0);
                    const objReputation = visibleObjectives.flatMap(o => o.reputation || []);
                    const totalXp = (quest.rewards?.xp || 0) + objXp;
                    const totalGold = (quest.rewards?.gold || 0) + objGold;
                    const allReputation = [...(quest.rewards?.reputation || []), ...objReputation];
                    const hasRewards = totalXp > 0 || totalGold > 0 || quest.rewards?.items || allReputation.length > 0;

                    if (!hasRewards) return null;

                    return (
                        <div className="quest-rewards">
                            {totalXp > 0 && <div className="quest-reward-pill">🏆 {totalXp} XP</div>}
                            {totalGold > 0 && <div className="quest-reward-pill">💰 {totalGold} gp</div>}
                            {quest.rewards?.items && <div className="quest-reward-pill">Items note: {quest.rewards.items}</div>}
                            {(quest.rewards?.itemRewards || []).map((reward, index) => (
                                <div key={`${reward.name}-${index}`} className="quest-reward-pill">
                                    Item: {reward.qty || 1}x {reward.name || reward.item?.name}
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
        </details>
    );
}
