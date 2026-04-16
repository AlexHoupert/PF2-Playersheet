import React from 'react';
import { useCampaign } from '../shared/context/CampaignContext';
import { getMergedActivities, getActivityDC, DC_TYPE_LABELS } from './campingData';
import { parseFoundry } from '../shared/utils/foundryParser';

const DEGREE_COLORS = { crit: '#4caf50', success: '#c5a059', critFail: '#e53935' };
const DEGREE_LABELS = { crit: 'Critical Success', success: 'Success', critFail: 'Failure' };

export default function CampScreen() {
    const { activeCampaign } = useCampaign();
    const camping = activeCampaign?.camping || {};
    const activities = getMergedActivities(camping.activities || []);
    const assignments = camping.assignments || {};

    const zoneDC = camping.zoneDC ?? '—';
    const foragingDC = camping.foragingDC ?? '—';
    const encounterDC = camping.encounterDC ?? '—';

    const assigned = activities.filter(act => assignments[act.id]?.characterName);
    const unassigned = activities.filter(act => !assignments[act.id]?.characterName);

    return (
        <div style={{ padding: '0 4px', paddingBottom: 30, color: '#e0e0e0' }}>
            {/* Header - DC Overview */}
            <div style={{
                display: 'flex', gap: 10, marginBottom: 20, marginTop: 8,
                flexWrap: 'wrap'
            }}>
                {[
                    { label: 'Zone DC', value: zoneDC },
                    { label: 'Foraging DC', value: foragingDC },
                    { label: 'Encounter DC', value: encounterDC }
                ].map(({ label, value }) => (
                    <div key={label} style={{
                        flex: '1 1 80px', background: '#1a1a1d', border: '1px solid #444',
                        borderRadius: 6, padding: '8px 12px', textAlign: 'center'
                    }}>
                        <div style={{ fontSize: '0.72em', color: '#888', textTransform: 'uppercase', marginBottom: 2 }}>{label}</div>
                        <div style={{ fontWeight: 'bold', color: '#c5a059', fontSize: '1.2em' }}>{value}</div>
                    </div>
                ))}
            </div>

            {/* Assigned Activities */}
            {assigned.length === 0 ? (
                <div style={{ color: '#555', fontStyle: 'italic', textAlign: 'center', padding: '30px 0' }}>
                    No camping activities assigned yet.
                </div>
            ) : (
                <>
                    <div style={{ fontSize: '0.75em', color: '#666', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
                        Assigned Activities
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
                        {assigned.map(act => {
                            const a = assignments[act.id];
                            const dc = getActivityDC(act, camping);
                            return (
                                <div key={act.id} style={{
                                    background: '#222', border: '1px solid #333', borderRadius: 6,
                                    padding: '10px 12px'
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: a.effectText ? 8 : 0 }}>
                                        <div>
                                            <div style={{ fontWeight: 'bold', color: '#e0e0e0' }}>{act.name}</div>
                                            <div style={{ fontSize: '0.78em', color: '#888', marginTop: 2 }}>
                                                {act.skills.join(' / ')} • {DC_TYPE_LABELS[act.dcType] || 'DC'}: {dc}
                                            </div>
                                        </div>
                                        <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 12 }}>
                                            <div style={{ fontSize: '0.85em', color: '#c5a059', fontWeight: 'bold' }}>
                                                {a.characterName}
                                            </div>
                                            {a.roll != null && (
                                                <div style={{ fontSize: '0.75em', color: '#777' }}>Roll: {a.roll}</div>
                                            )}
                                            {a.degree && (
                                                <div style={{ fontSize: '0.75em', color: DEGREE_COLORS[a.degree] || '#888', fontWeight: 'bold' }}>
                                                    {DEGREE_LABELS[a.degree]}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Effect text */}
                                    {a.effectText && (
                                        <div style={{
                                            padding: '6px 10px', borderRadius: 4,
                                            borderLeft: `3px solid ${DEGREE_COLORS[a.degree] || '#555'}`,
                                            background: '#1a1a1d', fontSize: '0.82em', color: '#ccc', lineHeight: 1.5
                                        }}
                                            dangerouslySetInnerHTML={{ __html: parseFoundry(a.effectText) }}
                                        />
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </>
            )}

            {/* Unassigned Activities */}
            {unassigned.length > 0 && (
                <>
                    <div style={{ fontSize: '0.75em', color: '#555', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
                        Unassigned ({unassigned.length})
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {unassigned.map(act => (
                            <div key={act.id} style={{
                                background: '#1a1a1d', border: '1px solid #333', borderRadius: 4,
                                padding: '4px 10px', fontSize: '0.8em', color: '#555'
                            }}>
                                {act.name}
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}
