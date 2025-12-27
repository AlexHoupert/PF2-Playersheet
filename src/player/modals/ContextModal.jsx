import React from 'react';

export function ContextModal({ character, updateCharacter, modalData, setModalMode }) {
    if (!modalData) return null;

    const type = modalData.type; // 'spell', 'feat', 'attribute', etc.
    const item = modalData.item; // The actual object
    const title = item?.name || item?.title || (type ? type.replace(/_/g, ' ').toUpperCase() : 'OPTIONS');

    // -- Helper Actions --
    const toggleBloodmagic = () => {
        updateCharacter(c => {
            const list = c.magic?.list || [];
            // Find by name in the character's list
            const match = list.find(s => s.name === item.name);
            if (match) match.Bloodmagic = !match.Bloodmagic;
        });
    };

    const removeFromCharacter = (targetType) => {
        if (!confirm(`Are you sure you want to remove ${item.name}?`)) return;
        updateCharacter(c => {
            if (targetType === 'feat') {
                c.feats = c.feats.filter(f => (typeof f === 'string' ? f : f.name) !== item.name);
            } else if (targetType === 'spell') {
                if (c.magic && c.magic.list) {
                    c.magic.list = c.magic.list.filter(s => s.name !== item.name);
                }
            } else if (targetType === 'impulse') {
                c.impulses = c.impulses.filter(i => i.name !== item.name);
            }
        });
        setModalMode(null);
    };

    return (
        <>
            <h2 style={{ margin: '0 0 10px 0', color: 'var(--text-gold)', fontFamily: 'Cinzel, serif' }}>{title}</h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {/* Spell/Feat Actions */}
                {type === 'spell' && (
                    <button className="set-btn" onClick={toggleBloodmagic}>
                        {item.Bloodmagic ? 'Remove Bloodmagic' : 'Add Bloodmagic'}
                    </button>
                )}
                {(type === 'feat' || type === 'spell' || type === 'impulse') && (
                    <button className="set-btn" style={{ background: '#d32f2f', color: '#fff' }} onClick={() => removeFromCharacter(type)}>
                        Remove {type === 'feat' ? 'Feat' : type === 'spell' ? 'Spell' : 'Impulse'}
                    </button>
                )}

                {/* Stat Context Options */}
                {type === 'attribute' && (
                    <button className="set-btn" onClick={() => setModalMode('edit_attribute')}>Change Attribute</button>
                )}
                {type === 'skill' && (
                    <button className="set-btn" onClick={() => setModalMode('edit_proficiency')}>Change Proficiency</button>
                )}
                {type === 'speed' && (
                    <button className="set-btn" onClick={() => setModalMode('edit_speed')}>Change Speed</button>
                )}
                {type === 'class_dc' && (
                    <button className="set-btn" onClick={() => setModalMode('edit_proficiency')}>Change Class DC</button>
                )}
                {type === 'language' && (
                    <button className="set-btn" onClick={() => setModalMode('edit_languages')}>Edit Languages</button>
                )}
                {type === 'save' && (
                    <button className="set-btn" onClick={() => setModalMode('edit_proficiency')}>Change Proficiency</button>
                )}

                {/* AC & Defense */}
                {type === 'ac_button' && (
                    <button className="set-btn" onClick={() => setModalMode('edit_armor_prof')}>Change Armor Proficiency</button>
                )}
                {type === 'perception' && (
                    <button className="set-btn" onClick={() => setModalMode('edit_perception')}>Edit Perception</button>
                )}

                {/* HP / Level */}
                {(type === 'level' || type === 'hp' || type === 'max_hp') && (
                    <button className="set-btn" onClick={() => setModalMode(type === 'hp' ? 'hp' : 'edit_max_hp')}>
                        {type === 'hp' ? 'Manage HP' : 'Change Max HP'}
                    </button>
                )}
                {type === 'level' && (
                    <>
                        <button className="set-btn" onClick={() => setModalMode('edit_level')}>Change Character Level</button>
                        <button className="set-btn" style={{ marginTop: 10, background: '#222', border: '1px solid #c5a059', color: '#c5a059' }} onClick={() => setModalMode('quicksheet')}>Open Quick Sheet</button>
                    </>
                )}

                {/* Magic */}
                {type === 'spell_proficiency' && (
                    <button className="set-btn" onClick={() => setModalMode('edit_spell_proficiency')}>Edit Spell Proficiency</button>
                )}
                {type === 'spell_slots' && (
                    <button className="set-btn" onClick={() => setModalMode('edit_spell_slots')}>Edit Spell Slots</button>
                )}
            </div>
        </>
    );
}
