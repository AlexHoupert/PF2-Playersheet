/**
 * ContentPreviewCard — Renders a rich preview for Spells, Feats, Actions, and Impulses.
 * Used in the side preview panel and mobile BottomSheet.
 */
import React from 'react';

const RARITY_COLORS = {
    common: '#444',
    uncommon: '#98513d',
    rare: '#002664',
    unique: '#54166e',
};

function TraitPill({ trait }) {
    return (
        <span style={{
            display: 'inline-block',
            padding: '2px 8px',
            borderRadius: 3,
            fontSize: '0.75em',
            fontWeight: 600,
            textTransform: 'capitalize',
            background: '#444',
            color: '#eee',
            border: '1px solid #666',
            marginRight: 4,
            marginBottom: 4,
        }}>
            {trait}
        </span>
    );
}

function DetailRow({ label, value }) {
    if (!value) return null;
    return (
        <div style={{ display: 'flex', gap: 8, padding: '4px 0', borderBottom: '1px solid #333' }}>
            <span style={{ color: '#999', fontWeight: 600, fontSize: '0.8em', minWidth: 80, flexShrink: 0 }}>{label}</span>
            <span style={{ color: '#ddd', fontSize: '0.85em' }}>{value}</span>
        </div>
    );
}

export default function ContentPreviewCard({ item, entityType, isLoading = false, onEdit, onClose }) {
    if (!item) return null;

    const rarityColor = RARITY_COLORS[item.rarity] || RARITY_COLORS.common;

    // Determine header info based on entity type
    let levelLabel = '';
    if (entityType === 'spell' || entityType === 'impulse') {
        levelLabel = item.level != null ? `Rank ${item.level}` : '';
    } else if (entityType === 'feat') {
        levelLabel = item.level != null ? `Level ${item.level}` : '';
    } else if (entityType === 'action') {
        const costMap = { '1': '◆', '2': '◆◆', '3': '◆◆◆', 'R': '↺', 'F': '◇', 'P': '—' };
        levelLabel = costMap[item.typeCode] || item.typeCode || '';
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Action bar */}
            <div style={{ display: 'flex', gap: 8, padding: '8px 0', borderBottom: '1px solid #333', flexShrink: 0, flexWrap: 'wrap' }}>
                {onEdit && (
                    <button
                        className="nav-btn"
                        style={{ background: '#4caf50', color: '#fff' }}
                        onClick={onEdit}
                    >
                        ✏️ Edit
                    </button>
                )}
                {onClose && (
                    <button
                        className="nav-btn"
                        style={{ background: '#555', color: '#ccc' }}
                        onClick={onClose}
                    >
                        ✕ Close
                    </button>
                )}
            </div>

            {/* Content */}
            <div style={{ flex: 1, overflowY: 'auto', paddingTop: 8 }}>
                {/* Header block with rarity border */}
                <div style={{
                    borderTop: `3px solid ${rarityColor}`,
                    background: '#1a1a1d',
                    padding: '12px 16px',
                    marginBottom: 12,
                    borderRadius: '0 0 6px 6px',
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <h3 style={{ margin: 0, color: '#f5deb3', fontSize: '1.1em' }}>{item.name}</h3>
                        <span style={{ color: '#c5a059', fontWeight: 600, fontSize: '0.9em' }}>{levelLabel}</span>
                    </div>

                    {/* Traits */}
                    {item.traits?.length > 0 && (
                        <div style={{ marginTop: 6 }}>
                            {item.rarity && item.rarity !== 'common' && (
                                <span style={{
                                    display: 'inline-block',
                                    padding: '2px 8px',
                                    borderRadius: 3,
                                    fontSize: '0.75em',
                                    fontWeight: 600,
                                    textTransform: 'capitalize',
                                    background: rarityColor,
                                    color: '#fff',
                                    marginRight: 4,
                                    marginBottom: 4,
                                }}>
                                    {item.rarity}
                                </span>
                            )}
                            {item.traits.map(t => <TraitPill key={t} trait={t} />)}
                        </div>
                    )}
                </div>

                {/* Metadata rows */}
                <div style={{ padding: '0 4px', marginBottom: 12 }}>
                    {/* Spell/Impulse specific */}
                    {(entityType === 'spell' || entityType === 'impulse') && (
                        <>
                            <DetailRow label="Traditions" value={item.traditions?.join(', ')} />
                            <DetailRow label="Cast" value={item.time} />
                            <DetailRow label="Range" value={item.range} />
                            <DetailRow label="Area" value={item.area} />
                            <DetailRow label="Target" value={item.target} />
                            <DetailRow label="Duration" value={item.duration} />
                            <DetailRow label="Defense" value={item.defense} />
                        </>
                    )}

                    {/* Feat specific */}
                    {entityType === 'feat' && (
                        <>
                            <DetailRow label="Category" value={item.category} />
                            <DetailRow label="Action" value={item.actionType} />
                            <DetailRow label="Prerequisites" value={
                                Array.isArray(item.prerequisites)
                                    ? item.prerequisites.join(', ')
                                    : item.prerequisites
                            } />
                        </>
                    )}

                    {/* Action specific */}
                    {entityType === 'action' && (
                        <>
                            <DetailRow label="Type" value={item.type || item.userType} />
                            <DetailRow label="Subtype" value={item.subtype || item.userSubtype} />
                            <DetailRow label="Skill" value={item.skill} />
                            <DetailRow label="Feat Prereq" value={item.feat} />
                        </>
                    )}
                </div>

                {/* Description */}
                {item.description ? (
                    <div style={{
                        padding: '12px 16px',
                        background: '#1a1a1d',
                        borderRadius: 6,
                        color: '#ccc',
                        fontSize: '0.85em',
                        lineHeight: 1.6,
                    }}>
                        <div dangerouslySetInnerHTML={{ __html: item.description }} />
                    </div>
                ) : isLoading ? (
                    <div style={{ padding: 12, color: '#888', fontStyle: 'italic', fontSize: '0.85em' }}>
                        Loading description...
                    </div>
                ) : (
                    <div style={{ padding: 12, color: '#666', fontStyle: 'italic', fontSize: '0.85em' }}>
                        No description available
                    </div>
                )}
            </div>
        </div>
    );
}
