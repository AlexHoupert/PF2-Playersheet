import React, { useState } from 'react';
import { useCampaign } from '../shared/context/CampaignContext';
import { getMergedActivities, getActivityDC, getDegreeOfSuccess, getEffectText, DC_TYPE_LABELS } from './campingData';
import { parseFoundry } from '../shared/utils/foundryParser';
import CampScreen from './CampScreen';

const DEGREE_COLORS = { crit: '#4caf50', success: '#c5a059', critFail: '#e53935' };
const DEGREE_LABELS = { crit: 'Critical Success', success: 'Success', critFail: 'Failure' };

export default function CampingView({ character }) {
    const { activeCampaign, updateActiveCampaign } = useCampaign();
    const camping = activeCampaign?.camping || {};
    const activities = getMergedActivities(camping.activities || []);
    const assignments = camping.assignments || {};

    const [selected, setSelected] = useState(null); // currently open activity
    const [rollInput, setRollInput] = useState('');
    const [localResult, setLocalResult] = useState(null); // { degree, effectText }
    const [showOverview, setShowOverview] = useState(false);

    const openActivity = (act) => {
        setSelected(act);
        setRollInput('');
        // Show existing result if any
        const existing = assignments[act.id];
        if (existing?.roll != null) {
            const dc = getActivityDC(act, camping);
            const degree = getDegreeOfSuccess(existing.roll, dc);
            setLocalResult({ degree, effectText: getEffectText(act, degree) });
        } else {
            setLocalResult(null);
        }
    };

    const handleAssign = () => {
        if (!selected) return;
        updateActiveCampaign(c => ({
            ...c,
            camping: {
                ...c.camping,
                assignments: {
                    ...(c.camping?.assignments || {}),
                    [selected.id]: {
                        ...(c.camping?.assignments?.[selected.id] || {}),
                        characterName: character.name,
                        roll: null,
                        result: null
                    }
                }
            }
        }));
    };

    const handleRoll = () => {
        if (!selected) return;
        const roll = parseInt(rollInput);
        if (isNaN(roll)) return;
        const dc = getActivityDC(selected, camping);
        const degree = getDegreeOfSuccess(roll, dc);
        const effectText = getEffectText(selected, degree);
        setLocalResult({ degree, effectText });
        updateActiveCampaign(c => ({
            ...c,
            camping: {
                ...c.camping,
                assignments: {
                    ...(c.camping?.assignments || {}),
                    [selected.id]: {
                        ...(c.camping?.assignments?.[selected.id] || {}),
                        characterName: character.name,
                        roll,
                        degree,
                        effectText
                    }
                }
            }
        }));
    };

    const handleUnassign = () => {
        if (!selected) return;
        updateActiveCampaign(c => {
            const newAssignments = { ...(c.camping?.assignments || {}) };
            delete newAssignments[selected.id];
            return { ...c, camping: { ...c.camping, assignments: newAssignments } };
        });
        setSelected(null);
    };

    const myAssignment = selected ? assignments[selected.id] : null;
    const isMyActivity = myAssignment?.characterName === character.name;
    const dc = selected ? getActivityDC(selected, camping) : null;
    const dcLabel = selected ? DC_TYPE_LABELS[selected.dcType] || 'DC' : null;

    return (
        <div style={{ paddingBottom: 20 }}>
            {/* Camp Overview Button */}
            <button
                onClick={() => setShowOverview(true)}
                style={{
                    width: '100%', padding: '8px 12px', marginBottom: 12,
                    background: '#1a1a2a', border: '1px solid #444', color: '#aaa',
                    borderRadius: 4, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    fontSize: '0.85em'
                }}
            >
                <span>🏕️ Camp Overview</span>
                <span style={{ color: '#555' }}>→</span>
            </button>

            {/* Activity List */}
            {activities.map(act => {
                const assignment = assignments[act.id];
                const isAssigned = !!assignment?.characterName;
                const isMine = assignment?.characterName === character.name;
                return (
                    <div
                        key={act.id}
                        className="item-row"
                        onClick={() => openActivity(act)}
                        style={{ cursor: 'pointer' }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', width: '100%', gap: 8 }}>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 'bold', color: isMine ? '#c5a059' : '#e0e0e0' }}>
                                    {act.name}
                                </div>
                                <div style={{ fontSize: '0.78em', color: '#888', marginTop: 2 }}>
                                    {act.skills.join(' / ')}
                                    {act.requirements && <span style={{ color: '#666', marginLeft: 6 }}>• {act.requirements}</span>}
                                </div>
                            </div>
                            {isAssigned && (
                                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                    <div style={{ fontSize: '0.8em', color: isMine ? '#c5a059' : '#aaa' }}>
                                        {assignment.characterName}
                                    </div>
                                    {assignment.degree && (
                                        <div style={{ fontSize: '0.7em', color: DEGREE_COLORS[assignment.degree] || '#888', fontWeight: 'bold' }}>
                                            {DEGREE_LABELS[assignment.degree]}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                );
            })}

            {/* Camp Overview Overlay */}
            {showOverview && (
                <div
                    style={{
                        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                        background: 'rgba(0,0,0,0.9)', zIndex: 2000,
                        display: 'flex', flexDirection: 'column'
                    }}
                    onClick={() => setShowOverview(false)}
                >
                    <div
                        style={{
                            background: '#1a1a1d', borderBottom: '1px solid #333',
                            padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                        }}
                        onClick={e => e.stopPropagation()}
                    >
                        <span style={{ fontFamily: 'Cinzel, serif', color: '#c5a059', fontWeight: 'bold' }}>
                            🏕️ Camp Overview
                        </span>
                        <button onClick={() => setShowOverview(false)} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '1.3em' }}>✕</button>
                    </div>
                    <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }} onClick={e => e.stopPropagation()}>
                        <CampScreen />
                    </div>
                </div>
            )}

            {/* Detail Modal */}
            {selected && (
                <div
                    style={{
                        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                        background: 'rgba(0,0,0,0.85)', zIndex: 2000,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16
                    }}
                    onClick={() => setSelected(null)}
                >
                    <div
                        style={{
                            background: '#2b2b2e', border: '2px solid #c5a059', borderRadius: 8,
                            padding: 20, maxWidth: 480, width: '100%', maxHeight: '85vh',
                            overflowY: 'auto', color: '#e0e0e0'
                        }}
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Header */}
                        <h2 style={{ margin: '0 0 4px 0', color: '#c5a059', fontFamily: 'Cinzel, serif' }}>
                            {selected.name}
                        </h2>
                        <div style={{ fontSize: '0.85em', color: '#aaa', marginBottom: 12 }}>
                            <span>{selected.skills.join(' / ')}</span>
                            {selected.requirements && (
                                <span style={{ marginLeft: 10, color: '#888', fontStyle: 'italic' }}>
                                    • {selected.requirements}
                                </span>
                            )}
                        </div>

                        {/* DC Info */}
                        <div style={{ background: '#222', borderRadius: 4, padding: '6px 10px', marginBottom: 12, fontSize: '0.85em', color: '#bbb' }}>
                            {dcLabel}: <strong style={{ color: '#fff' }}>{dc}</strong>
                        </div>

                        {/* Description */}
                        {selected.description && (
                            <div
                                style={{ fontSize: '0.9em', lineHeight: 1.6, marginBottom: 14, color: '#ccc' }}
                                dangerouslySetInnerHTML={{ __html: parseFoundry(selected.description) }}
                            />
                        )}

                        {/* Effect previews */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
                            {[['crit', selected.effectCrit], ['success', selected.effectSuccess], ['critFail', selected.effectCritFail]].map(([key, text]) => text ? (
                                <div key={key} style={{ padding: '6px 10px', borderRadius: 4, borderLeft: `3px solid ${DEGREE_COLORS[key]}`, background: '#1a1a1d', fontSize: '0.82em' }}>
                                    <span style={{ color: DEGREE_COLORS[key], fontWeight: 'bold', marginRight: 6 }}>{DEGREE_LABELS[key]}:</span>
                                    <span style={{ color: '#ccc' }} dangerouslySetInnerHTML={{ __html: parseFoundry(text) }} />
                                </div>
                            ) : null)}
                        </div>

                        {/* Assignment section */}
                        {myAssignment && !isMyActivity && (
                            <div style={{ background: '#1a1a1d', borderRadius: 4, padding: '8px 10px', marginBottom: 12, fontSize: '0.85em', color: '#aaa' }}>
                                Assigned to: <strong style={{ color: '#ccc' }}>{myAssignment.characterName}</strong>
                            </div>
                        )}

                        {/* Perform Action button */}
                        {!isMyActivity ? (
                            <button
                                onClick={handleAssign}
                                style={{
                                    width: '100%', padding: '10px', marginBottom: 12,
                                    background: '#1a3a1a', border: '1px solid #4caf50', color: '#81c784',
                                    borderRadius: 4, cursor: 'pointer', fontWeight: 'bold'
                                }}
                            >
                                Perform This Action ({character.name})
                            </button>
                        ) : (
                            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                                <div style={{ flex: 1, padding: '8px 10px', background: '#1a3a1a', border: '1px solid #4caf50', borderRadius: 4, fontSize: '0.85em', color: '#81c784', textAlign: 'center' }}>
                                    Assigned to you
                                </div>
                                <button
                                    onClick={handleUnassign}
                                    style={{ padding: '8px 12px', background: '#3a1a1a', border: '1px solid #e53935', color: '#ef9a9a', borderRadius: 4, cursor: 'pointer', fontSize: '0.8em' }}
                                >
                                    Give up
                                </button>
                            </div>
                        )}

                        {/* Roll Result */}
                        {isMyActivity && (
                            <div style={{ marginBottom: 12 }}>
                                <div style={{ fontSize: '0.85em', color: '#aaa', marginBottom: 6 }}>Roll Result</div>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <input
                                        type="number"
                                        value={rollInput}
                                        onChange={e => setRollInput(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && handleRoll()}
                                        placeholder={`vs DC ${dc}`}
                                        style={{
                                            flex: 1, padding: '8px 10px', background: '#1a1a1d',
                                            border: '1px solid #555', color: '#fff', borderRadius: 4,
                                            fontSize: '1em'
                                        }}
                                    />
                                    <button
                                        onClick={handleRoll}
                                        disabled={!rollInput}
                                        style={{
                                            padding: '8px 16px', background: '#673ab7', border: 'none',
                                            color: '#fff', borderRadius: 4, cursor: 'pointer', fontWeight: 'bold',
                                            opacity: rollInput ? 1 : 0.5
                                        }}
                                    >
                                        Roll
                                    </button>
                                </div>

                                {/* Result display */}
                                {localResult && (
                                    <div style={{
                                        marginTop: 10, padding: '10px 12px', borderRadius: 4,
                                        background: '#1a1a1d', borderLeft: `4px solid ${DEGREE_COLORS[localResult.degree]}`
                                    }}>
                                        <div style={{ fontWeight: 'bold', color: DEGREE_COLORS[localResult.degree], marginBottom: 4 }}>
                                            {DEGREE_LABELS[localResult.degree]}
                                        </div>
                                        <div style={{ fontSize: '0.9em', color: '#ccc', lineHeight: 1.5 }}
                                            dangerouslySetInnerHTML={{ __html: parseFoundry(localResult.effectText) }}
                                        />
                                    </div>
                                )}
                            </div>
                        )}

                        <button
                            onClick={() => setSelected(null)}
                            style={{
                                width: '100%', padding: 10, background: '#333', border: '1px solid #555',
                                color: '#ccc', borderRadius: 4, cursor: 'pointer'
                            }}
                        >
                            Close
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
