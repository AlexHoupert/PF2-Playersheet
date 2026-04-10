/**
 * CreatureAbilityModal - Displays expanded details for creature abilities and actions
 * Shows full description with parsed @Localize, @UUID, @Check, @Damage references
 */
import React from 'react';
import { getActionIcon } from '../../utils/bestiaryUtils';
import { parseFoundry, ACTION_ICONS } from '../utils/foundryParser';

export default function CreatureAbilityModal({ ability, onClose, onContentLinkClick }) {
    if (!ability) return null;

    const actionType = ability.system?.actionType?.value;
    const actionCount = ability.system?.actions?.value;
    const icon = getActionIcon(ability);
    const traits = ability.system?.traits?.value || [];
    const description = ability.system?.description?.value || '';

    // Parse requirements, trigger, etc.
    const requirements = ability.system?.requirements || '';
    const trigger = ability.system?.trigger || '';
    const frequency = ability.system?.frequency?.value
        ? `${ability.system.frequency.value} per ${ability.system.frequency.per || 'day'}`
        : '';

    const getActionLabel = () => {
        if (actionType === 'passive') return 'Passive';
        if (actionType === 'reaction') return 'Reaction';
        if (actionType === 'free') return 'Free Action';
        if (actionCount === 1) return 'Single Action';
        if (actionCount === 2) return 'Two Actions';
        if (actionCount === 3) return 'Three Actions';
        return 'Action';
    };

    return (
        <div
            className="modal-backdrop"
            onClick={onClose}
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(0,0,0,0.7)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 2000
            }}
        >
            <div
                className="creature-ability-modal"
                onClick={e => e.stopPropagation()}
                style={{
                    background: '#1e1e21',
                    border: '2px solid #c9a86c',
                    borderRadius: 8,
                    padding: 20,
                    maxWidth: 600,
                    maxHeight: '80vh',
                    overflow: 'auto',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.5)'
                }}
            >
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                    <div>
                        <h3 style={{ margin: 0, color: '#f5deb3', display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span className="action-icon" style={{ fontSize: '1.2em' }}>{icon}</span>
                            {ability.name}
                        </h3>
                        <div style={{ color: '#888', fontSize: '0.9em', marginTop: 4 }}>
                            {getActionLabel()}
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: '#888',
                            fontSize: '1.5em',
                            cursor: 'pointer',
                            padding: 0,
                            lineHeight: 1
                        }}
                    >
                        ×
                    </button>
                </div>

                {/* Traits */}
                {traits.length > 0 && (
                    <div style={{ marginBottom: 12 }}>
                        {traits.map((trait, i) => (
                            <span
                                key={i}
                                style={{
                                    display: 'inline-block',
                                    padding: '2px 8px',
                                    marginRight: 4,
                                    borderRadius: 3,
                                    background: '#555',
                                    color: '#fff',
                                    fontSize: '0.8em',
                                    textTransform: 'capitalize'
                                }}
                            >
                                {trait}
                            </span>
                        ))}
                    </div>
                )}

                {/* Trigger */}
                {trigger && (
                    <div style={{ marginBottom: 12, color: '#ccc' }}>
                        <strong style={{ color: '#c9a86c' }}>Trigger</strong> {trigger}
                    </div>
                )}

                {/* Requirements */}
                {requirements && (
                    <div style={{ marginBottom: 12, color: '#ccc' }}>
                        <strong style={{ color: '#c9a86c' }}>Requirements</strong> {requirements}
                    </div>
                )}

                {/* Frequency */}
                {frequency && (
                    <div style={{ marginBottom: 12, color: '#ccc' }}>
                        <strong style={{ color: '#c9a86c' }}>Frequency</strong> {frequency}
                    </div>
                )}

                {/* Description */}
                <div
                    className="ability-description"
                    style={{
                        color: '#ddd',
                        lineHeight: 1.6
                    }}
                    onClick={onContentLinkClick}
                    dangerouslySetInnerHTML={{ __html: parseFoundry(description) }}
                />
            </div>
        </div>
    );
}
