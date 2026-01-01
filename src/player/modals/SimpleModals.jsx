import React, { useState } from 'react';
import { getCondLevel } from '../../utils/rules';

const ARMOR_RANKS = [
    { value: 0, label: 'Untrained (+0)' },
    { value: 2, label: 'Trained (+2)' },
    { value: 4, label: 'Expert (+4)' },
    { value: 6, label: 'Master (+6)' },
    { value: 8, label: 'Legendary (+8)' }
];

/**
 * Modal to manage character gold.
 * @param {Object} props
 * @param {Object} props.character - The character object.
 * @param {Function} props.updateCharacter - Function to update the character state.
 * @param {Function} props.onClose - Function to close the modal.
 * @returns {JSX.Element}
 */
export function EditGoldModal({ character, updateCharacter, onClose }) {
    const [editVal, setEditVal] = useState("");
    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 1100,
            display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 20
        }} onClick={onClose}>
            <div style={{
                backgroundColor: '#2b2b2e', border: '2px solid #c5a059',
                padding: '20px', borderRadius: '8px', maxWidth: '300px', width: '100%',
                color: '#e0e0e0', textAlign: 'center'
            }} onClick={e => e.stopPropagation()}>
                <h2>Manage Gold</h2>
                <p style={{ textAlign: 'center', color: '#888' }}>Current: <span style={{ color: 'var(--text-gold)', fontWeight: 'bold' }}>{character.gold}</span></p>
                <div className="qty-control-box">
                    <button className="qty-btn" style={{ borderColor: 'var(--accent-red)', color: 'var(--accent-red)' }} onClick={() => updateCharacter(c => c.gold = parseFloat((c.gold - (parseFloat(editVal) || 0)).toFixed(2)))}>-</button>
                    <input type="number" className="modal-input" style={{ width: 100, textAlign: 'center' }} value={editVal} onChange={e => setEditVal(e.target.value)} placeholder="0" />
                    <button className="qty-btn" style={{ borderColor: 'var(--accent-green)', color: 'var(--accent-green)' }} onClick={() => updateCharacter(c => c.gold = parseFloat((c.gold + (parseFloat(editVal) || 0)).toFixed(2)))}>+</button>
                </div>
                <button className="set-btn" onClick={() => { updateCharacter(c => c.gold = parseFloat(editVal) || 0); setEditVal(""); onClose(); }}>Set to Value</button>
            </div>
        </div>
    );
}

/**
 * Modal to edit character level.
 * @param {Object} props
 * @param {Object} props.character - The character object.
 * @param {Function} props.updateCharacter - Function to update the character state.
 * @param {Function} props.onClose - Function to close the modal.
 * @returns {JSX.Element}
 */
export function EditLevelModal({ character, updateCharacter, onClose }) {
    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 1100,
            display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 20
        }} onClick={onClose}>
            <div style={{
                backgroundColor: '#2b2b2e', border: '2px solid #c5a059',
                padding: '20px', borderRadius: '8px', maxWidth: '300px', width: '100%',
                color: '#e0e0e0', textAlign: 'center'
            }} onClick={e => e.stopPropagation()}>
                <h2>Edit Level</h2>
                <div className="qty-control-box">
                    <button className="qty-btn" onClick={() => updateCharacter(c => c.level = Math.max(1, (c.level || 1) - 1))}>-</button>
                    <span style={{ fontSize: '2em', width: 60, textAlign: 'center' }}>{character.level}</span>
                    <button className="qty-btn" onClick={() => updateCharacter(c => c.level = (c.level || 1) + 1)}>+</button>
                </div>
                <button className="set-btn" onClick={onClose} style={{ marginTop: 20 }}>Close</button>
            </div>
        </div>
    );
}

/**
 * Modal to edit character Max HP.
 * @param {Object} props
 * @param {Object} props.character - The character object.
 * @param {Function} props.updateCharacter - Function to update the character state.
 * @param {Function} props.onClose - Function to close the modal.
 * @returns {JSX.Element}
 */
export function EditHPModal({ character, updateCharacter, onClose }) {
    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 1100,
            display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 20
        }} onClick={onClose}>
            <div style={{
                backgroundColor: '#2b2b2e', border: '2px solid #c5a059',
                padding: '20px', borderRadius: '8px', maxWidth: '300px', width: '100%',
                color: '#e0e0e0', textAlign: 'center'
            }} onClick={e => e.stopPropagation()}>
                <h2>Edit Max HP</h2>
                <div className="qty-control-box">
                    <button className="qty-btn" onClick={() => updateCharacter(c => c.stats.hp.max = Math.max(1, (c.stats.hp.max || 10) - 1))}>-</button>
                    <span style={{ fontSize: '2em', width: 80, textAlign: 'center' }}>{character.stats.hp.max}</span>
                    <button className="qty-btn" onClick={() => updateCharacter(c => c.stats.hp.max = (c.stats.hp.max || 10) + 1)}>+</button>
                </div>
                <button className="set-btn" onClick={onClose} style={{ marginTop: 20 }}>Close</button>
            </div>
        </div>
    );
}

/**
 * Modal to edit character speeds.
 * @param {Object} props
 * @param {Object} props.character - The character object.
 * @param {Function} props.updateCharacter - Function to update the character state.
 * @param {Function} props.onClose - Function to close the modal.
 * @returns {JSX.Element}
 */
export function EditSpeedModal({ character, updateCharacter, onClose }) {
    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 1100,
            display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 20
        }} onClick={onClose}>
            <div style={{
                backgroundColor: '#2b2b2e', border: '2px solid #c5a059',
                padding: '20px', borderRadius: '8px', maxWidth: '300px', width: '100%',
                color: '#e0e0e0', textAlign: 'center'
            }} onClick={e => e.stopPropagation()}>
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
                <button className="set-btn" onClick={onClose} style={{ marginTop: 20 }}>Close</button>
            </div>
        </div>
    );
}

/**
 * Modal to edit a specific attribute score.
 * @param {Object} props
 * @param {Object} props.character - The character object.
 * @param {Function} props.updateCharacter - Function to update the character state.
 * @param {Function} props.onClose - Function to close the modal.
 * @param {Object} props.modalData - Data containing the attribute key and label.
 * @returns {JSX.Element}
 */
export function EditAttributeModal({ character, updateCharacter, onClose, modalData }) {
    const key = modalData.item.key;
    const val = character.stats.attributes[key];
    const label = modalData.item.label;

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 1100,
            display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 20
        }} onClick={onClose}>
            <div style={{
                backgroundColor: '#2b2b2e', border: '2px solid #c5a059',
                padding: '20px', borderRadius: '8px', maxWidth: '300px', width: '100%',
                color: '#e0e0e0', textAlign: 'center'
            }} onClick={e => e.stopPropagation()}>
                <h2>Edit {label}</h2>
                <div className="qty-control-box">
                    <button className="qty-btn" onClick={() => updateCharacter(c => c.stats.attributes[key] = (c.stats.attributes[key] || 0) - 1)}>-</button>
                    <span style={{ fontSize: '2em', width: 60, textAlign: 'center' }}>{val >= 0 ? `+${val}` : val}</span>
                    <button className="qty-btn" onClick={() => updateCharacter(c => c.stats.attributes[key] = (c.stats.attributes[key] || 0) + 1)}>+</button>
                </div>
                <button className="set-btn" onClick={onClose} style={{ marginTop: 20 }}>Close</button>
            </div>
        </div>
    );
}

/**
 * Modal to edit skill, save, or impulse proficiencies.
 * @param {Object} props
 * @param {Object} props.character - The character object.
 * @param {Function} props.updateCharacter - Function to update the character state.
 * @param {Function} props.onClose - Function to close the modal.
 * @param {Object} props.modalData - Data defining the type (skill, save, impulse) and key to edit.
 * @returns {JSX.Element}
 */
export function EditProficiencyModal({ character, updateCharacter, onClose, modalData }) {
    const isSkill = modalData.type === 'skill';
    const isSave = modalData.type === 'save';
    const isImpulse = modalData.type === 'impulse';
    const key = isSkill ? modalData.item.key : (isSave ? String(modalData.item).toLowerCase() : 'class_dc');

    const currentVal = isSkill ? character.skills[key] : (isSave ? (character.stats.saves?.[key] || 0) : (isImpulse ? (character.stats.impulse_proficiency || 0) : character.stats.class_dc));

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 1100,
            display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 20
        }} onClick={onClose}>
            <div style={{
                backgroundColor: '#2b2b2e', border: '2px solid #c5a059',
                padding: '20px', borderRadius: '8px', maxWidth: '300px', width: '100%',
                color: '#e0e0e0', textAlign: 'center'
            }} onClick={e => e.stopPropagation()}>
                <h2>Edit {modalData?.item?.name || (isImpulse ? "Impulse Proficiency" : "Proficiency")}</h2>
                {isSkill || isSave || isImpulse ? (
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
                                    } else if (isImpulse) {
                                        c.stats.impulse_proficiency = r.value;
                                    }
                                });
                                onClose();
                            }}>
                                {r.label}
                            </button>
                        ))}
                    </div>
                ) : (
                    // Class DC might just be a number edit if no prof structure
                    <div className="qty-control-box">
                        <button className="qty-btn" onClick={() => updateCharacter(c => c.stats.class_dc = (c.stats.class_dc || 10) - 1)}>-</button>
                        <span style={{ fontSize: '2em', width: 60, textAlign: 'center' }}>{currentVal}</span>
                        <button className="qty-btn" onClick={() => updateCharacter(c => c.stats.class_dc = (c.stats.class_dc || 10) + 1)}>+</button>
                    </div>
                )}
                <button className="set-btn" onClick={onClose} style={{ marginTop: 20 }}>Close</button>
            </div>
        </div>
    );
}

/**
 * Modal to edit armor proficiencies (Light, Medium, Heavy, Unarmored).
 * @param {Object} props
 * @param {Object} props.character - The character object.
 * @param {Function} props.updateCharacter - Function to update the character state.
 * @param {Function} props.onClose - Function to close the modal.
 * @returns {JSX.Element}
 */
export function EditArmorProficiencyModal({ character, updateCharacter, onClose }) {
    const ARMOR_PROF_KEYS = ['Unarmored', 'Light', 'Medium', 'Heavy'];

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 1100,
            display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 20
        }} onClick={onClose}>
            <div style={{
                backgroundColor: '#2b2b2e', border: '2px solid #c5a059',
                padding: '20px', borderRadius: '8px', maxWidth: '300px', width: '100%',
                color: '#e0e0e0', textAlign: 'center'
            }} onClick={e => e.stopPropagation()}>
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
                <button className="set-btn" onClick={onClose} style={{ marginTop: 20 }}>Close</button>
            </div>
        </div>
    );
}

/**
 * Modal to edit known languages.
 * @param {Object} props
 * @param {Object} props.character - The character object.
 * @param {Function} props.updateCharacter - Function to update the character state.
 * @param {Function} props.onClose - Function to close the modal.
 * @returns {JSX.Element}
 */
export function EditLanguagesModal({ character, updateCharacter, onClose }) {
    const [langs, setLangs] = useState(character.languages.join(', '));
    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 1100,
            display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 20
        }} onClick={onClose}>
            <div style={{
                backgroundColor: '#2b2b2e', border: '2px solid #c5a059',
                padding: '20px', borderRadius: '8px', maxWidth: '400px', width: '100%',
                color: '#e0e0e0', textAlign: 'center'
            }} onClick={e => e.stopPropagation()}>
                <h2>Edit Languages</h2>
                <textarea
                    className="modal-input"
                    style={{ height: 150 }}
                    value={langs}
                    onChange={e => setLangs(e.target.value)}
                />
                <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                    <button className="set-btn" onClick={() => {
                        updateCharacter(c => c.languages = langs.split(',').map(s => s.trim()).filter(Boolean));
                        onClose();
                    }}>Save</button>
                    <button className="set-btn" onClick={onClose} style={{ background: '#444' }}>Cancel</button>
                </div>
            </div>
        </div>
    );
}

/**
 * Modal to edit weapon category/group proficiencies.
 * @param {Object} props
 * @param {Object} props.character - The character object.
 * @param {Function} props.updateCharacter - Function to update the character state.
 * @param {Function} props.onClose - Function to close the modal.
 * @param {Object} props.modalData - Should contain the item to derive categories from.
 * @returns {JSX.Element}
 */
export function EditItemProficienciesModal({ character, updateCharacter, onClose, modalData }) {
    const item = modalData.item;
    const keys = [];
    if (item.category) keys.push(item.category.charAt(0).toUpperCase() + item.category.slice(1));
    if (item.group) keys.push(item.group.charAt(0).toUpperCase() + item.group.slice(1));

    // Deduplicate
    const uniqueKeys = [...new Set(keys)];

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 1100,
            display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 20
        }} onClick={onClose}>
            <div style={{
                backgroundColor: '#2b2b2e', border: '2px solid #c5a059',
                padding: '20px', borderRadius: '8px', maxWidth: '300px', width: '100%',
                color: '#e0e0e0', textAlign: 'center'
            }} onClick={e => e.stopPropagation()}>
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
                <button className="set-btn" onClick={onClose} style={{ marginTop: 20 }}>Close</button>
            </div>
        </div>
    );
}

/**
 * Modal to edit perception proficiency.
 * @param {Object} props
 * @param {Object} props.character - The character object.
 * @param {Function} props.updateCharacter - Function to update the character state.
 * @param {Function} props.onClose - Function to close the modal.
 * @returns {JSX.Element}
 */
export function EditPerceptionModal({ character, updateCharacter, onClose }) {
    const currentVal = character.stats.perception || 0;
    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 1100,
            display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 20
        }} onClick={onClose}>
            <div style={{
                backgroundColor: '#2b2b2e', border: '2px solid #c5a059',
                padding: '20px', borderRadius: '8px', maxWidth: '300px', width: '100%',
                color: '#e0e0e0', textAlign: 'center'
            }} onClick={e => e.stopPropagation()}>
                <h2>Edit Perception</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {ARMOR_RANKS.map(r => (
                        <button key={r.value} className="btn-add-condition" style={{
                            borderColor: currentVal === r.value ? 'var(--text-gold)' : '#555',
                            color: currentVal === r.value ? 'var(--text-gold)' : '#ccc'
                        }} onClick={() => {
                            updateCharacter(c => {
                                if (!c.stats) c.stats = {};
                                c.stats.perception = r.value;
                            });
                            onClose();
                        }}>
                            {r.label}
                        </button>
                    ))}
                </div>
                <button className="set-btn" onClick={onClose} style={{ marginTop: 20 }}>Close</button>
            </div>
        </div>
    );
}

/**
 * Modal to manage Current and Temporary HP.
 * @param {Object} props
 * @param {Object} props.character - The character object.
 * @param {Function} props.updateCharacter - Function to update the character state.
 * @param {Function} props.onClose - Function to close the modal.
 * @returns {JSX.Element}
 */
export function ManageHPModal({ character, updateCharacter, onClose }) {
    const [editVal, setEditVal] = useState("");
    const [showTempHp, setShowTempHp] = useState(false);

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 1100,
            display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 20
        }} onClick={onClose}>
            <div style={{
                backgroundColor: '#2b2b2e', border: '2px solid #c5a059',
                padding: '20px', borderRadius: '8px', maxWidth: '300px', width: '100%',
                color: '#e0e0e0', textAlign: 'center'
            }} onClick={e => e.stopPropagation()}>
                <h2>Manage Hit Points</h2>
                <p style={{ textAlign: 'center', color: '#888' }}>
                    Current HP: <span style={{ color: 'var(--text-gold)', fontWeight: 'bold' }}>{character.stats.hp.current}</span>
                    <span style={{ fontSize: '0.8em', color: '#666' }}> / {Math.max(1, character.stats.hp.max - (getCondLevel('drained', character) * character.level))}</span>
                    &nbsp; | &nbsp;
                    <span
                        onClick={() => setShowTempHp(!showTempHp)}
                        style={{ cursor: 'pointer', textDecoration: 'underline', textDecorationStyle: 'dotted', textUnderlineOffset: 4, color: '#888' }}
                    >
                        Temp: <span style={{ color: 'var(--accent-blue)', fontWeight: 'bold' }}>{character.stats.hp.temp}</span>
                    </span>
                </p>

                <div className="modal-form-group" style={{ textAlign: 'center' }}>
                    <label>Hit Points</label>
                    <div className="qty-control-box">
                        <button className="qty-btn" onClick={() => updateCharacter(c => c.stats.hp.current = Math.max(0, c.stats.hp.current - (parseInt(editVal) || 0)))}>-</button>
                        <input type="number" className="modal-input" style={{ width: 100, textAlign: 'center' }} value={editVal} onChange={e => setEditVal(e.target.value)} placeholder="0" />
                        <button className="qty-btn" onClick={() => updateCharacter(c => c.stats.hp.current = Math.max(0, c.stats.hp.current + (parseInt(editVal) || 0)))}>+</button>
                    </div>
                    <div style={{ marginTop: 10 }}>
                        <button className="set-btn" onClick={() => { updateCharacter(c => c.stats.hp.current = parseInt(editVal) || 0); setEditVal(""); onClose(); }}>Set HP</button>
                    </div>
                </div>

                {showTempHp && (
                    <div className="modal-form-group" style={{ textAlign: 'center', marginTop: 20, borderTop: '1px solid #444', paddingTop: 20 }}>
                        <label style={{ color: 'var(--accent-blue)' }}>Temp HP</label>
                        <div className="qty-control-box">
                            <button className="qty-btn" onClick={() => updateCharacter(c => c.stats.hp.temp = Math.max(0, c.stats.hp.temp - (parseInt(editVal) || 0)))}>-</button>
                            <input type="number" className="modal-input" style={{ width: 100, textAlign: 'center' }} value={editVal} onChange={e => setEditVal(e.target.value)} placeholder="0" />
                            <button className="qty-btn" onClick={() => updateCharacter(c => c.stats.hp.temp = c.stats.hp.temp + (parseInt(editVal) || 0))}>+</button>
                        </div>
                        <button className="set-btn" onClick={() => { updateCharacter(c => c.stats.hp.temp = parseInt(editVal) || 0); setEditVal(""); onClose(); }}>Set Temp to Value</button>
                    </div>
                )}
                <button className="set-btn" onClick={onClose} style={{ marginTop: 20 }}>Close</button>
            </div>
        </div>
    );
}

/**
 * Modal to create a new custom action.
 * @param {Object} props
 * @param {Function} props.onSave - Callback to save the new action.
 * @param {Function} props.onClose - Function to close the modal.
 * @returns {JSX.Element}
 */
export function AddActionModal({ onSave, onClose }) {
    const [newAction, setNewAction] = useState({ name: '', type: 'Combat', subtype: 'Basic', skill: '', feat: '', description: '' });

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 1100,
            display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 20
        }} onClick={onClose}>
            <div style={{
                backgroundColor: '#2b2b2e', border: '2px solid #c5a059',
                padding: '20px', borderRadius: '8px', maxWidth: '300px', width: '100%',
                color: '#e0e0e0'
            }} onClick={e => e.stopPropagation()}>
                <h2>Create New Action</h2>
                <div className="modal-form-group">
                    <label>Name</label>
                    <input className="modal-input" value={newAction.name} onChange={e => setNewAction({ ...newAction, name: e.target.value })} placeholder="Action Name" />
                </div>
                <div className="modal-form-group">
                    <label>Type (comma separated)</label>
                    <input className="modal-input" value={newAction.type} onChange={e => setNewAction({ ...newAction, type: e.target.value })} placeholder="Combat, Movement" />
                </div>
                <div className="modal-form-group">
                    <label>Subtype</label>
                    <input className="modal-input" value={newAction.subtype} onChange={e => setNewAction({ ...newAction, subtype: e.target.value })} placeholder="Basic, Skill, Class..." />
                </div>
                <div className="modal-form-group">
                    <label>Skill (optional)</label>
                    <input className="modal-input" value={newAction.skill} onChange={e => setNewAction({ ...newAction, skill: e.target.value })} placeholder="Athletics" />
                </div>
                <div className="modal-form-group">
                    <label>Feat (optional)</label>
                    <input className="modal-input" value={newAction.feat} onChange={e => setNewAction({ ...newAction, feat: e.target.value })} placeholder="Feat Name" />
                </div>
                <div className="modal-form-group">
                    <label>Description</label>
                    <textarea className="modal-input" style={{ height: 100, fontFamily: 'inherit', resize: 'vertical' }} value={newAction.description} onChange={e => setNewAction({ ...newAction, description: e.target.value })} placeholder="Action description..." />
                </div>
                <button className="set-btn" onClick={() => onSave(newAction)}>Save Action</button>
                <button className="set-btn" onClick={onClose} style={{ marginTop: 10, background: '#444' }}>Cancel</button>
            </div>
        </div>
    );
}

/**
 * Context menu modal for various items (spells, feats, attributes, etc.).
 * @param {Object} props
 * @param {Object} props.character - The character object.
 * @param {Object} props.modalData - Data identifying the context entry.
 * @param {Function} props.updateCharacter - Function to update the character state.
 * @param {Function} props.onClose - Function to close the modal.
 * @param {Function} props.setModalMode - Function to switch modal modes.
 * @param {Function} props.toggleBloodmagic - Callback to toggle bloodmagic.
 * @param {Function} props.removeFromCharacter - Callback to remove item from character.
 * @returns {JSX.Element}
 */
export function ContextModal({ character, modalData, updateCharacter, onClose, setModalMode, toggleBloodmagic, removeFromCharacter }) {
    const type = modalData?.type;
    const item = modalData?.item;
    const title = item?.name || item?.title || (type ? type.replace(/_/g, ' ').toUpperCase() : 'OPTIONS');

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 1100,
            display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 20
        }} onClick={onClose}>
            <div style={{
                backgroundColor: '#2b2b2e', border: '2px solid #c5a059',
                padding: '20px', borderRadius: '8px', maxWidth: '300px', width: '100%',
                color: '#e0e0e0', textAlign: 'center'
            }} onClick={e => e.stopPropagation()}>
                <h2 style={{ margin: '0 0 10px 0', color: 'var(--text-gold)', fontFamily: 'Cinzel, serif' }}>{title}</h2>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {/* Spell/Feat Actions */}
                    {type === 'spell' && (
                        <button className="set-btn" onClick={() => { toggleBloodmagic(item); onClose(); }}>
                            {item.Bloodmagic ? 'Remove Bloodmagic' : 'Add Bloodmagic'}
                        </button>
                    )}
                    {(type === 'feat' || type === 'spell' || type === 'impulse') && (
                        <button className="set-btn" style={{ background: '#d32f2f', color: '#fff' }} onClick={() => { removeFromCharacter(item, type); onClose(); }}>
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
                        <button className="set-btn" onClick={() => setModalMode('edit_proficiency')}>Change Proficiency</button>
                    )}
                    {type === 'perception' && (
                        <button className="set-btn" onClick={() => setModalMode('edit_perception')}>Edit Perception</button>
                    )}

                    {/* HP / Level */}
                    {/* HP / Level */}
                    {(type === 'level' || type === 'hp' || type === 'max_hp') && (
                        <button className="set-btn" onClick={() => setModalMode('edit_max_hp')}>Change Max HP</button>
                    )}
                    {type === 'save' && (
                        <button className="set-btn" onClick={() => setModalMode('edit_proficiency')}>Change Proficiency</button>
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
                <button className="set-btn" onClick={onClose} style={{ marginTop: 20 }}>Close</button>
            </div>
        </div>
    );
}
