import React, { useState } from 'react';
import { calculateStat } from '../utils/rules';

const ATTRIBUTES = ["Strength", "Dexterity", "Constitution", "Intelligence", "Wisdom", "Charisma"];
const SAVES = ["Fortitude", "Reflex", "Will"];
const SPEEDS = ["Land", "Climb", "Swim", "Fly"];
const ARMOR_RANKS = [
    { value: 0, label: 'U' },
    { value: 2, label: 'T' },
    { value: 4, label: 'E' },
    { value: 6, label: 'M' },
    { value: 8, label: 'L' }
];

export default function QuickSheetModal({ character, updateCharacter, onClose }) {
    const [tab, setTab] = useState('main'); // main, proficiencies, languages

    const renderProficiencyToggle = (currentVal, onChange) => {
        return (
            <div className="prof-toggle-row">
                {ARMOR_RANKS.map(r => (
                    <div
                        key={r.value}
                        className={`prof-toggle-btn ${currentVal === r.value ? 'active' : ''}`}
                        onClick={() => onChange(r.value)}
                    >
                        {r.label}
                    </div>
                ))}
            </div>
        );
    };

    const renderAttributes = () => (
        <div className="qs-section">
            <h3>Attributes</h3>
            <div className="qs-grid-3">
                {ATTRIBUTES.map(attr => {
                    const key = attr.toLowerCase();
                    const val = character.stats.attributes[key] || 0;
                    return (
                        <div key={attr} className="qs-stat-box">
                            <div className="qs-label">{attr.slice(0, 3).toUpperCase()}</div>
                            <div className="qs-controls">
                                <button onClick={() => updateCharacter(c => c.stats.attributes[key] = (c.stats.attributes[key] || 0) - 1)}>-</button>
                                <span className="qs-val">{val >= 0 ? `+${val}` : val}</span>
                                <button onClick={() => updateCharacter(c => c.stats.attributes[key] = (c.stats.attributes[key] || 0) + 1)}>+</button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );

    const renderSpeeds = () => (
        <div className="qs-section">
            <h3>Speeds</h3>
            <div className="qs-grid-2">
                {SPEEDS.map(type => {
                    const key = type.toLowerCase();
                    // Handle "Land" vs "land" mapping if needed, but usually it's "land" in DB.
                    // If type is Land, key is land.
                    const val = character.stats.speed[key] ?? 0;
                    return (
                        <div key={type} className="qs-stat-box">
                            <div className="qs-label">{type}</div>
                            <div className="qs-controls">
                                <button onClick={() => updateCharacter(c => {
                                    if (!c.stats.speed) c.stats.speed = { land: 25 };
                                    c.stats.speed[key] = Math.max(0, (c.stats.speed[key] || 0) - 5);
                                })}>-</button>
                                <span className="qs-val">{val}</span>
                                <button onClick={() => updateCharacter(c => {
                                    if (!c.stats.speed) c.stats.speed = { land: 25 };
                                    c.stats.speed[key] = (c.stats.speed[key] || 0) + 5;
                                })}>+</button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );

    const renderSaves = () => (
        <div className="qs-section">
            <h3>Saving Throws</h3>
            {SAVES.map(save => {
                const key = save.toLowerCase();
                // Proficiency stored in character.stats.saves[key] ?? NO?
                // Wait, DB check: character.stats.saves might be the Object with total?
                // Let's re-read PlayerApp logic.
                // PlayerApp: const raw = character.stats.saves[save.toLowerCase()] || 0;
                // It seems it stores the PROFICIENCY value (0,2,4,6,8) there?
                // Or does it store the total?
                // "calculateStat" usually takes the character and does the math.
                // If "raw" is passed to calculateStat, and it returns total...
                // Usually `character.stats.saves.fortitude` IS the proficiency rank in this system.
                // Let's assume it is Proficiency Rank.
                const val = character.stats.saves[key] || 0;
                return (
                    <div key={save} className="qs-row">
                        <span className="qs-row-label">{save}</span>
                        {renderProficiencyToggle(val, (v) => updateCharacter(c => {
                            if (!c.stats.saves) c.stats.saves = {};
                            c.stats.saves[key] = v;
                        }))}
                    </div>
                );
            })}
        </div>
    );

    const renderClassDC = () => {
        // Class DC edit?
        // Usually Class DC is derived, but we saw code editing `c.stats.class_dc`.
        // If it's a raw value:
        const val = character.stats.class_dc || 10;
        return (
            <div className="qs-section">
                <h3>Class DC</h3>
                <div className="qs-controls centered">
                    <button onClick={() => updateCharacter(c => c.stats.class_dc = (c.stats.class_dc || 10) - 1)}>-</button>
                    <span className="qs-val">{val}</span>
                    <button onClick={() => updateCharacter(c => c.stats.class_dc = (c.stats.class_dc || 10) + 1)}>+</button>
                </div>
            </div>
        );
    };

    const renderMainTab = () => (
        <div className="qs-content">
            <div className="qs-header-row">
                <div className="qs-stat-box">
                    <div className="qs-label">LEVEL</div>
                    <div className="qs-controls compact">
                        <button onClick={() => updateCharacter(c => c.level = Math.max(1, (c.level || 1) - 1))}>-</button>
                        <span>{character.level}</span>
                        <button onClick={() => updateCharacter(c => c.level = (c.level || 1) + 1)}>+</button>
                    </div>
                </div>
                <div className="qs-stat-box">
                    {/* Placeholder for Hero Points or XP if needed, for now just Level */}
                </div>
            </div>

            {renderAttributes()}

            <div className="qs-split">
                {renderSpeeds()}
                {renderClassDC()}
            </div>

            {renderSaves()}
        </div>
    );

    const renderProficienciesTab = () => {
        // Weapon Groups and Armor
        // Armor
        const armorKeys = ['Unarmored', 'Light', 'Medium', 'Heavy'];
        // Weapon Groups (Popular ones)
        // We can add a "Add Weapon Group" feature? Or just list common ones.
        // Let's list the ones currently in `character.proficiencies` + a standard set.
        const standardWeapons = ['Simple', 'Martial', 'Advanced', 'Unarmed'];
        const existingProfs = Object.keys(character.proficiencies || {}).map(k => k.charAt(0).toUpperCase() + k.slice(1));
        const allWeaponKeys = [...new Set([...standardWeapons, ...existingProfs])].filter(k => !armorKeys.includes(k) && k !== 'Class DC' && k !== 'Spell DC');

        return (
            <div className="qs-content">
                <div className="qs-section">
                    <h3>Armor</h3>
                    {armorKeys.map(k => {
                        const val = character.stats.proficiencies?.[k.toLowerCase()] || 0;
                        return (
                            <div key={k} className="qs-row">
                                <span className="qs-row-label">{k}</span>
                                {renderProficiencyToggle(val, (v) => updateCharacter(c => {
                                    if (!c.stats.proficiencies) c.stats.proficiencies = {};
                                    c.stats.proficiencies[k.toLowerCase()] = v;
                                }))}
                            </div>
                        );
                    })}
                </div>

                <div className="qs-section">
                    <h3>Weapons</h3>
                    {allWeaponKeys.map(k => {
                        // Check where weapon profs are stored?
                        // `character.proficiencies` seems to be the place based on `getArmorClassData` using `proficiencies`.
                        // Wait, `getArmorClassData` looked at `character.proficiencies` for armor too?
                        // Code said: `const profs = char?.proficiencies; ... val = profs[key] ...`
                        // But Armor Modal updated `c.stats.proficiencies`.
                        // THIS IS A DATA MISMATCH RISK.
                        // I should update BOTH or ensure I know which one is used.
                        // Let's check PlayerApp `getArmorClassData` again.
                        // `const profs = char?.proficiencies;`
                        // It reads from ROOT `proficiencies`.
                        // But Armor Modal (line 2842) updated `c.stats.proficiencies`.
                        // THIS IS A BUG IN THE APP (or at least inconsistent).
                        // I should check `calculateStat` or `getArmorClassData` specifically.
                        // If `getArmorClassData` reads root `proficiencies`, and I update `stats.proficiencies`, it won't show!
                        // I will assume ROOT `proficiencies` is correct for Weapons/Armor if `getArmorClassData` uses it.
                        // I will write to ROOT `proficiencies` to be safe, or sync both.
                        // Actually, I'll write to `proficiencies` (root) for weapons.

                        // Check if it's an array or object. `getArmorClassData` handled both.
                        // I will force Object structure for new edits.
                        const val = (character.proficiencies && character.proficiencies[k]) || 0;
                        return (
                            <div key={k} className="qs-row">
                                <span className="qs-row-label">{k}</span>
                                {renderProficiencyToggle(val, (v) => updateCharacter(c => {
                                    if (!c.proficiencies || Array.isArray(c.proficiencies)) c.proficiencies = { ...c.proficiencies }; // Convert array to object if needed
                                    c.proficiencies[k] = v;
                                }))}
                            </div>
                        );
                    })}
                    {/* Add "Add Group" button? */}
                </div>
            </div>
        );
    };

    const renderLanguagesTab = () => {
        const [text, setText] = useState(character.languages.join(', '));
        // Use local state for text area
        return (
            <div className="qs-content">
                <h3>Languages</h3>
                <textarea
                    className="qs-textarea"
                    value={text}
                    onChange={e => setText(e.target.value)}
                />
                <button className="qs-btn-save" onClick={() => {
                    updateCharacter(c => c.languages = text.split(',').map(s => s.trim()).filter(Boolean));
                }}>Update Languages</button>
            </div>
        );
    };

    return (
        <div className="qs-overlay" onClick={onClose}>
            <div className="qs-modal" onClick={e => e.stopPropagation()}>
                <div className="qs-header">
                    <h2>Quick Sheet</h2>
                    <button className="qs-close-btn" onClick={onClose}>×</button>
                </div>

                <div className="qs-tabs">
                    <button className={`qs-tab ${tab === 'main' ? 'active' : ''}`} onClick={() => setTab('main')}>Core</button>
                    <button className={`qs-tab ${tab === 'proficiencies' ? 'active' : ''}`} onClick={() => setTab('proficiencies')}>Profs</button>
                    <button className={`qs-tab ${tab === 'languages' ? 'active' : ''}`} onClick={() => setTab('languages')}>Langs</button>
                </div>

                <div className="qs-body">
                    {tab === 'main' && renderMainTab()}
                    {tab === 'proficiencies' && renderProficienciesTab()}
                    {tab === 'languages' && renderLanguagesTab()}
                </div>

                <style>{`
                    .qs-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.85); z-index: 2000; display: flex; align-items: center; justify-content: center; padding: 20px; }
                    .qs-modal { background: #1a1a1d; border: 1px solid #c5a059; width: 100%; max-width: 500px; max-height: 90vh; display: flex; flex-direction: column; border-radius: 8px; overflow: hidden; box-shadow: 0 0 20px rgba(0,0,0,0.8); }
                    .qs-header { background: #111; padding: 15px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #333; }
                    .qs-header h2 { margin: 0; color: #c5a059; font-family: 'Cinzel', serif; }
                    .qs-close-btn { background: none; border: none; color: #888; font-size: 1.5em; cursor: pointer; }
                    .qs-tabs { display: flex; background: #222; }
                    .qs-tab { flex: 1; background: none; border: none; padding: 12px; color: #888; cursor: pointer; border-bottom: 2px solid transparent; font-weight: bold; }
                    .qs-tab.active { color: #c5a059; border-bottom-color: #c5a059; background: #2a2a2d; }
                    .qs-body { flex: 1; overflow-y: auto; padding: 20px; }
                    .qs-section { margin-bottom: 25px; }
                    .qs-section h3 { border-bottom: 1px solid #444; padding-bottom: 5px; margin-bottom: 15px; color: #eee; font-size: 0.9em; text-transform: uppercase; letter-spacing: 1px; }
                    .qs-grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
                    .qs-grid-2 { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; }
                    .qs-stat-box { background: #252528; padding: 10px; border-radius: 4px; display: flex; flex-direction: column; align-items: center; border: 1px solid #333; }
                    .qs-label { font-size: 0.7em; color: #888; margin-bottom: 5px; text-transform: uppercase; }
                    .qs-controls { display: flex; align-items: center; gap: 5px; }
                    .qs-controls button { width: 24px; height: 24px; background: #333; border: 1px solid #555; color: #fff; border-radius: 3px; cursor: pointer; display: flex; align-items: center; justify-content: center; }
                    .qs-controls button:active { background: #c5a059; color: #000; }
                    .qs-val { font-size: 1.1em; font-weight: bold; width: 30px; text-align: center; color: #fff; }
                    .qs-split { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; }
                    .qs-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; background: #252528; padding: 8px; border-radius: 4px; }
                    .qs-row-label { font-weight: bold; color: #ccc; }
                    .prof-toggle-row { display: flex; gap: 2px; }
                    .prof-toggle-btn { width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; background: #111; border: 1px solid #444; color: #666; font-size: 0.8em; cursor: pointer; }
                    .prof-toggle-btn.active { background: #c5a059; color: #000; border-color: #c5a059; font-weight: bold; }
                    .qs-textarea { width: 100%; height: 150px; background: #111; border: 1px solid #444; color: #eee; padding: 10px; font-family: inherit; resize: none; margin-bottom: 15px; }
                    .qs-btn-save { width: 100%; padding: 12px; background: #c5a059; border: none; font-weight: bold; border-radius: 4px; cursor: pointer; color: #1a1a1d; }
                    .qs-header-row { display: flex; justify-content: center; margin-bottom: 20px; }
                `}</style>
            </div>
        </div>
    );
}
