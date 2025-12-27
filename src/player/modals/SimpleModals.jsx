import React, { useState } from 'react';
// getArmorClassData is not used in this file, removing import.

const ARMOR_RANKS = [
    { value: 0, label: 'Untrained (+0)' },
    { value: 2, label: 'Trained (+2)' },
    { value: 4, label: 'Expert (+4)' },
    { value: 6, label: 'Master (+6)' },
    { value: 8, label: 'Legendary (+8)' }
];

export function GoldModal({ character, updateCharacter }) {
    const [editVal, setEditVal] = useState("");
    return (
        <>
            <h2>Manage Gold</h2>
            <p style={{ textAlign: 'center', color: '#888' }}>Current: <span style={{ color: 'var(--text-gold)', fontWeight: 'bold' }}>{character.gold}</span></p>
            <div className="qty-control-box">
                <button className="qty-btn" style={{ borderColor: 'var(--accent-red)', color: 'var(--accent-red)' }} onClick={() => updateCharacter(c => c.gold = parseFloat((c.gold - (parseFloat(editVal) || 0)).toFixed(2)))}>-</button>
                <input type="number" className="modal-input" style={{ width: 100, textAlign: 'center' }} value={editVal} onChange={e => setEditVal(e.target.value)} placeholder="0" />
                <button className="qty-btn" style={{ borderColor: 'var(--accent-green)', color: 'var(--accent-green)' }} onClick={() => updateCharacter(c => c.gold = parseFloat((c.gold + (parseFloat(editVal) || 0)).toFixed(2)))}>+</button>
            </div>
            <button className="set-btn" onClick={() => { updateCharacter(c => c.gold = parseFloat(editVal) || 0); setEditVal(""); }}>Set to Value</button>
        </>
    );
}

export function AttributeModal({ character, updateCharacter, modalData }) {
    const key = modalData.item.key;
    const val = character.stats.attributes[key];
    const label = modalData.item.label;
    return (
        <>
            <h2>Edit {label}</h2>
            <div className="qty-control-box">
                <button className="qty-btn" onClick={() => updateCharacter(c => c.stats.attributes[key] = (c.stats.attributes[key] || 0) - 1)}>-</button>
                <span style={{ fontSize: '2em', width: 60, textAlign: 'center' }}>{val >= 0 ? `+${val}` : val}</span>
                <button className="qty-btn" onClick={() => updateCharacter(c => c.stats.attributes[key] = (c.stats.attributes[key] || 0) + 1)}>+</button>
            </div>
        </>
    );
}

export function ProficiencyModal({ character, updateCharacter, modalData, setModalMode }) {
    const isSkill = modalData.type === 'skill';
    const isSave = modalData.type === 'save';
    const key = isSkill ? modalData.item.key : (isSave ? String(modalData.item).toLowerCase() : 'class_dc');
    const currentVal = isSkill ? character.skills[key] : (isSave ? (character.stats.saves?.[key] || 0) : character.stats?.class_dc);

    return (
        <>
            <h2>Edit {modalData?.item?.name || "Proficiency"}</h2>
            {isSkill || isSave ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {ARMOR_RANKS.map(r => (
                        <button key={r.value} className="btn-add-condition" style={{
                            borderColor: currentVal === r.value ? 'var(--text-gold)' : '#555',
                            color: currentVal === r.value ? 'var(--text-gold)' : '#ccc'
                        }} onClick={() => {
                            updateCharacter(c => {
                                if (isSkill) c.skills[key] = r.value;
                                else if (isSave) {
                                    if (!c.stats.saves) c.stats.saves = {};
                                    c.stats.saves[key] = r.value;
                                }
                            });
                            setModalMode(null);
                        }}>
                            {r.label}
                        </button>
                    ))}
                </div>
            ) : (
                <div className="qty-control-box">
                    <button className="qty-btn" onClick={() => updateCharacter(c => c.stats.class_dc = (c.stats.class_dc || 10) - 1)}>-</button>
                    <span style={{ fontSize: '2em', width: 60, textAlign: 'center' }}>{currentVal}</span>
                    <button className="qty-btn" onClick={() => updateCharacter(c => c.stats.class_dc = (c.stats.class_dc || 10) + 1)}>+</button>
                </div>
            )}
        </>
    );
}

export function SpeedModal({ character, updateCharacter }) {
    return (
        <>
            <h2>Edit Speed</h2>
            {Object.entries(character.stats.speed).map(([k, v]) => (
                <div key={k} className="modal-form-group">
                    <label style={{ textTransform: 'capitalize' }}>{k}</label>
                    <div className="qty-control-box">
                        <button className="qty-btn" onClick={() => updateCharacter(c => c.stats.speed[k] = Math.max(0, (c.stats.speed[k] || 0) - 5))}>-5</button>
                        <span style={{ fontSize: '1.5em', width: 60, textAlign: 'center' }}>{v}</span>
                        <button className="qty-btn" onClick={() => updateCharacter(c => c.stats.speed[k] = (c.stats.speed[k] || 0) + 5)}>+5</button>
                    </div>
                </div>
            ))}
        </>
    );
}

export function ItemProficiencyModal({ character, updateCharacter, modalData }) {
    const item = modalData.item;
    const keys = [];
    if (item.category) keys.push(item.category.charAt(0).toUpperCase() + item.category.slice(1));
    if (item.group) keys.push(item.group.charAt(0).toUpperCase() + item.group.slice(1));
    const uniqueKeys = [...new Set(keys)];

    return (
        <>
            <h2>Weapon Proficiencies</h2>
            <div style={{ color: '#888', marginBottom: 15, textAlign: 'center' }}>{item.name}</div>
            {uniqueKeys.length === 0 && <div>No proficiency categories found for this item.</div>}
            {uniqueKeys.map(key => {
                const currentVal = (character.proficiencies && character.proficiencies[key]) || 0;
                return (
                    <div key={key} style={{ marginBottom: 15 }}>
                        <div style={{ fontSize: '0.9em', color: '#aaa', marginBottom: 5 }}>{key}</div>
                        <div style={{ display: 'flex', gap: 5, justifyContent: 'center' }}>
                            {ARMOR_RANKS.map(r => (
                                <button key={r.value} className="btn-add-condition" style={{
                                    padding: '5px 10px',
                                    borderColor: currentVal === r.value ? 'var(--text-gold)' : '#555',
                                    color: currentVal === r.value ? 'var(--text-gold)' : '#ccc',
                                    flex: 1
                                }} onClick={() => {
                                    updateCharacter(c => {
                                        if (!c.proficiencies) c.proficiencies = {};
                                        c.proficiencies[key] = r.value;
                                    });
                                }}>
                                    {r.label}
                                </button>
                            ))}
                        </div>
                    </div>
                );
            })}
            <div style={{ marginTop: 20, textAlign: 'center', fontSize: '0.8em', color: '#666' }}>
                Proficiency is usually derived from your Class. Editing this overrides derived values if implemented in stats.
            </div>
        </>
    );
}

export function LanguageModal({ character, updateCharacter, setModalMode }) {
    const [langs, setLangs] = useState(character.languages.join(', '));
    return (
        <>
            <h2>Edit Languages</h2>
            <textarea
                className="modal-input"
                style={{ height: 150 }}
                value={langs}
                onChange={e => setLangs(e.target.value)}
            />
            <button className="set-btn" onClick={() => {
                updateCharacter(c => c.languages = langs.split(',').map(s => s.trim()).filter(Boolean));
                setModalMode(null);
            }}>Save</button>
        </>
    );
}

export function ArmorProficiencyModal({ character, updateCharacter }) {
    const ARMOR_PROF_KEYS = ['Unarmored', 'Light', 'Medium', 'Heavy'];
    return (
        <>
            <h2>Armor Proficiencies</h2>
            <div className="prof-list" style={{ marginTop: 20 }}>
                {ARMOR_PROF_KEYS.map(key => {
                    const rawVal = character?.stats?.proficiencies?.[key.toLowerCase()] || 0;
                    return (
                        <div className="prof-row" key={key}>
                            <span className="prof-label">{key}</span>
                            <select
                                className="prof-select"
                                value={rawVal}
                                onChange={(e) => updateCharacter(c => {
                                    if (!c.stats) c.stats = {};
                                    if (!c.stats.proficiencies) c.stats.proficiencies = {};
                                    c.stats.proficiencies[key.toLowerCase()] = parseInt(e.target.value);
                                })}
                            >
                                {ARMOR_RANKS.map(r => (
                                    <option key={r.value} value={r.value}>{r.label}</option>
                                ))}
                            </select>
                        </div>
                    );
                })}
            </div>
        </>
    );
}

export function MaxHPModal({ character, updateCharacter }) {
    return (
        <>
            <h2>Edit Max HP</h2>
            <div className="qty-control-box">
                <button className="qty-btn" onClick={() => updateCharacter(c => c.stats.hp.max = Math.max(1, (c.stats.hp.max || 10) - 1))}>-</button>
                <span style={{ fontSize: '2em', width: 80, textAlign: 'center' }}>{character.stats.hp.max}</span>
                <button className="qty-btn" onClick={() => updateCharacter(c => c.stats.hp.max = (c.stats.hp.max || 10) + 1)}>+</button>
            </div>
        </>
    );
}

export function LevelModal({ character, updateCharacter }) {
    return (
        <>
            <h2>Edit Level</h2>
            <div className="qty-control-box">
                <button className="qty-btn" onClick={() => updateCharacter(c => c.level = Math.max(1, (c.level || 1) - 1))}>-</button>
                <span style={{ fontSize: '2em', width: 60, textAlign: 'center' }}>{character.level}</span>
                <button className="qty-btn" onClick={() => updateCharacter(c => c.level = (c.level || 1) + 1)}>+</button>
            </div>
        </>
    );
}

export function SpellStatModal({ character }) {
    const magic = character.magic || {};
    const attrName = magic.attribute || "Intelligence";
    const attrMod = parseInt(character.stats.attributes[(attrName || "").toLowerCase()]) || 0;
    const prof = parseFloat(magic.proficiency) || 0;
    const level = parseInt(character.level) || 0;

    const atkBonus = Math.floor(attrMod + prof + (prof > 0 ? level : 0));
    const dcVal = 10 + atkBonus;

    return (
        <>
            <h2>Spell Statistics</h2>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
                <div style={{ fontSize: '2em', color: 'var(--text-gold)', fontWeight: 'bold' }}>DC {dcVal}</div>
                <div style={{ fontSize: '1.5em', color: '#aaa' }}>Attack {atkBonus >= 0 ? '+' : ''}{atkBonus}</div>
            </div>
        </>
    );
}

export function SpellProficiencyModal({ character, updateCharacter }) {
    const magic = character.magic || {};
    const currentAttr = magic.attribute || "Intelligence";
    const currentProf = magic.proficiency || 0;

    return (
        <>
            <h2>Edit Spell Proficiency</h2>
            <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', marginBottom: 5, color: '#aaa' }}>Key Attribute</label>
                <select
                    className="prof-select"
                    value={currentAttr}
                    onChange={(e) => updateCharacter(c => {
                        if (!c.magic) c.magic = {};
                        c.magic.attribute = e.target.value;
                    })}
                >
                    {['Strength', 'Dexterity', 'Constitution', 'Intelligence', 'Wisdom', 'Charisma'].map(attr => (
                        <option key={attr} value={attr}>{attr}</option>
                    ))}
                </select>
            </div>
            <div>
                <label style={{ display: 'block', marginBottom: 5, color: '#aaa' }}>Proficiency Rank</label>
                <select
                    className="prof-select"
                    value={currentProf}
                    onChange={(e) => updateCharacter(c => {
                        if (!c.magic) c.magic = {};
                        c.magic.proficiency = parseInt(e.target.value);
                    })}
                >
                    {ARMOR_RANKS.map(r => (
                        <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                </select>
            </div>
        </>
    );
}

export function SpellSlotsModal({ character, updateCharacter, modalData, setModalData }) {
    const item = modalData?.item || {};
    const levelKey = item.level || '1';
    const slotKey = levelKey + "_max";

    const SLOT_LEVELS = ['f', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];

    return (
        <>
            <h2>Edit Spell Slots</h2>
            <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', marginBottom: 5, color: '#aaa' }}>Slot Level</label>
                <select
                    className="prof-select"
                    value={levelKey}
                    onChange={(e) => setModalData({
                        ...modalData,
                        item: { ...item, level: e.target.value }
                    })}
                >
                    <option value="f">Focus Points</option>
                    {SLOT_LEVELS.filter(l => l !== 'f').map(l => (
                        <option key={l} value={l}>Level {l}</option>
                    ))}
                </select>
            </div>

            <div className="qty-control-box">
                <button className="qty-btn" onClick={() => updateCharacter(c => {
                    if (!c.magic) c.magic = { slots: {} };
                    if (!c.magic.slots) c.magic.slots = {};
                    const cur = c.magic.slots[slotKey] || 0;
                    c.magic.slots[slotKey] = Math.max(0, cur - 1);
                })}>-</button>
                <span style={{ fontSize: '2em', width: 60, textAlign: 'center' }}>
                    {character?.magic?.slots?.[slotKey] || 0}
                </span>
                <button className="qty-btn" onClick={() => updateCharacter(c => {
                    if (!c.magic) c.magic = { slots: {} };
                    if (!c.magic.slots) c.magic.slots = {};
                    const cur = c.magic.slots[slotKey] || 0;
                    c.magic.slots[slotKey] = cur + 1;
                })}>+</button>
            </div>
        </>
    );
}


export function WeaponDetailModal({ modalData }) {
    return (
        <>
            <h2>{modalData.title}</h2>
            <div style={{ fontSize: '2em', textAlign: 'center', color: 'var(--text-gold)', margin: '10px 0' }}>
                {modalData.total >= 0 ? '+' : ''}{modalData.total}
            </div>

            {modalData.breakdown && typeof modalData.breakdown === 'object' ? (
                <div style={{ background: '#222', padding: 15, borderRadius: 8, fontSize: '0.9em' }}>
                    <div style={{ marginBottom: 10, color: '#aaa', textTransform: 'uppercase', fontSize: '0.8em', letterSpacing: 1 }}>Calculation</div>

                    {/* Base 10 if applicable */}
                    {modalData.base === 10 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                            <span>Base</span>
                            <span>10</span>
                        </div>
                    )}

                    {modalData.breakdown.attribute !== undefined && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                            <span>Attribute {modalData.source?.attrName ? `(${modalData.source.attrName})` : ''}</span>
                            <span>{modalData.breakdown.attribute >= 0 ? '+' : ''}{modalData.breakdown.attribute}</span>
                        </div>
                    )}

                    {modalData.breakdown.proficiency !== undefined && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                            <span>Proficiency {modalData.source?.profName ? `(${modalData.source.profName})` : ''}</span>
                            <span>{modalData.breakdown.proficiency >= 0 ? '+' : ''}{modalData.breakdown.proficiency}</span>
                        </div>
                    )}

                    {modalData.breakdown.level !== undefined && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                            <span>Level {modalData.source?.levelVal ? `(${modalData.source.levelVal})` : ''}</span>
                            <span>{modalData.breakdown.level >= 0 ? '+' : ''}{modalData.breakdown.level}</span>
                        </div>
                    )}

                    {modalData.breakdown.item !== undefined && modalData.breakdown.item !== 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, color: 'var(--text-gold)' }}>
                            <span>Item Bonus</span>
                            <span>{modalData.breakdown.item >= 0 ? '+' : ''}{modalData.breakdown.item}</span>
                        </div>
                    )}
                </div>
            ) : (
                <div style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6', color: '#ccc' }}>
                    {modalData.breakdown}
                </div>
            )}
        </>
    );
}

export function PerceptionModal({ character, updateCharacter, setModalMode }) {
    const currentVal = character.stats.perception || 0;
    return (
        <>
            <h2>Edit Perception</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {ARMOR_RANKS.map(r => (
                    <button key={r.value} className="btn-add-condition" style={{
                        borderColor: currentVal === r.value ? 'var(--text-gold)' : '#555',
                        color: currentVal === r.value ? 'var(--text-gold)' : '#ccc'
                    }} onClick={() => {
                        updateCharacter(c => c.stats.perception = r.value);
                        setModalMode(null);
                    }}>
                        {r.label}
                    </button>
                ))}
            </div>
        </>
    );
}
