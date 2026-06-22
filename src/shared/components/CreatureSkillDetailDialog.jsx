import React from 'react';

const formatBonus = (value) => Number(value || 0) >= 0 ? `+${Number(value || 0)}` : `${Number(value || 0)}`;

export default function CreatureSkillDetailDialog({ skill, onClose }) {
    if (!skill) return null;

    return (
        <div
            className="modal-backdrop"
            onClick={onClose}
            style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.7)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 2000,
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
                    width: 'min(520px, calc(100vw - 32px))',
                    maxHeight: '80vh',
                    overflow: 'auto',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
                }}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginBottom: 16 }}>
                    <div>
                        <h3 style={{ margin: 0, color: '#f5deb3' }}>{skill.label}</h3>
                        {skill.creatureName && (
                            <div style={{ color: '#888', fontSize: '0.9em', marginTop: 4 }}>
                                {skill.creatureName}{skill.creatureLevel !== null ? ` · Level ${skill.creatureLevel}` : ''}
                            </div>
                        )}
                    </div>
                    <button
                        onClick={onClose}
                        style={{ background: 'none', border: 'none', color: '#888', fontSize: '1.5em', cursor: 'pointer', padding: 0, lineHeight: 1 }}
                    >
                        ×
                    </button>
                </div>

                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 14 }}>
                    <span style={{ color: '#c9a86c', fontWeight: 'bold' }}>Modifier</span>
                    <span style={{ color: '#fff', fontSize: '1.5em', fontWeight: 'bold' }}>{formatBonus(skill.bonus)}</span>
                </div>

                {skill.specials?.length > 0 && (
                    <div style={{ marginBottom: 14 }}>
                        <div style={{ color: '#c9a86c', fontWeight: 'bold', marginBottom: 6 }}>Special Uses</div>
                        {skill.specials.map(special => (
                            <div key={special.id} style={{ color: '#ddd', padding: '4px 0' }}>
                                {formatBonus(special.bonus)} {special.label}
                            </div>
                        ))}
                    </div>
                )}

                {skill.notes && (
                    <div style={{ color: '#ddd', lineHeight: 1.5 }}>
                        <div style={{ color: '#c9a86c', fontWeight: 'bold', marginBottom: 6 }}>Notes</div>
                        {skill.notes}
                    </div>
                )}
            </div>
        </div>
    );
}
