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

const LanguagesTab = ({ languages, updateCharacter }) => {
    const [localText, setLocalText] = useState(languages.join(', '));

    return (
        <div className="qs-content">
            <h3>Languages</h3>
            <textarea
                className="qs-textarea"
                value={localText}
                onChange={e => setLocalText(e.target.value)}
            />
            <button className="qs-btn-save" onClick={() => {
                updateCharacter(c => c.languages = localText.split(',').map(s => s.trim()).filter(Boolean));
            }}>Update Languages</button>
        </div>
    );
};

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
                    const val = character.stats.speed?.[key] ?? 0;
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
                const val = character.stats.saves?.[key] || 0;
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
            </div>

            {renderAttributes()}

            <div className="qs-split">
                {renderSpeeds()}
                {renderClassDC()}
            </div>

            <div className="qs-section">
                <h3>Class Options</h3>
                <div style={{ display: 'flex', gap: 30, justifyContent: 'center' }}>
                    <div
                        style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#ccc', cursor: 'pointer' }}
                        onClick={() => updateCharacter(c => c.isKineticist = !c.isKineticist)}
                    >
                        <div className={`qs-switch ${character.isKineticist ? 'active' : ''}`}>
                            <div className="qs-slider"></div>
                        </div>
                        Kineticist
                    </div>

                    <div
                        style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#ccc', cursor: 'pointer' }}
                        onClick={() => updateCharacter(c => c.isCaster = !c.isCaster)}
                    >
                        <div className={`qs-switch ${character.isCaster ? 'active' : ''}`}>
                            <div className="qs-slider"></div>
                        </div>
                        Spellcaster
                    </div>
                </div>
            </div>

            {renderSaves()}
        </div>
    );

    const renderProficienciesTab = () => {
        const armorKeys = ['Unarmored', 'Light', 'Medium', 'Heavy'];
        const standardWeapons = ['Simple', 'Martial', 'Advanced', 'Unarmed'];
        const existingProfs = Object.keys(character.proficiencies || {}).map(k => k.charAt(0).toUpperCase() + k.slice(1));
        const allWeaponKeys = [...new Set([...standardWeapons, ...existingProfs])]
            .filter(k => !armorKeys.includes(k) && k !== 'Class DC' && k !== 'Spell DC')
            .sort();

        return (
            <div className="qs-content">
                <div className="qs-section">
                    <h3>Magic & Impulses</h3>
                    <div className="qs-row">
                        <span className="qs-row-label">Spell Prof</span>
                        {renderProficiencyToggle(character.stats.spell_proficiency || 0, (v) => updateCharacter(c => {
                            if (!c.stats) c.stats = {};
                            c.stats.spell_proficiency = v;
                        }))}
                    </div>
                    <div className="qs-row">
                        <span className="qs-row-label">Impulse Prof</span>
                        {renderProficiencyToggle(character.stats.impulse_proficiency || 0, (v) => updateCharacter(c => {
                            if (!c.stats) c.stats = {};
                            c.stats.impulse_proficiency = v;
                        }))}
                    </div>
                </div>

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
                        const val = (character.proficiencies && character.proficiencies[k]) || 0;
                        return (
                            <div key={k} className="qs-row">
                                <span className="qs-row-label">{k}</span>
                                {renderProficiencyToggle(val, (v) => updateCharacter(c => {
                                    if (!c.proficiencies || Array.isArray(c.proficiencies)) c.proficiencies = { ...c.proficiencies };
                                    c.proficiencies[k] = v;
                                }))}
                            </div>
                        );
                    })}
                </div>
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
                    {tab === 'languages' && <LanguagesTab languages={character.languages} updateCharacter={updateCharacter} />}
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
                    .qs-section h3 { border-bottom: 1px solid #444; padding-bottom: 5px; margin-bottom: 15px; color: #eee; font-size: 0.9em; text-transform: uppercase; letter-spacing: 1px; }
                    .qs-grid-3 { display: grid; grid-template-columns: repeat(auto-fit, minmax(80px, 1fr)); gap: 10px; }
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

                    /* Switch CSS */
                    .qs-switch {
                        width: 36px; height: 20px; background: #333; border-radius: 20px; position: relative; transition: 0.3s; border: 1px solid #555;
                    }
                    .qs-switch.active { background: #c5a059; border-color: #c5a059; }
                    .qs-slider {
                        width: 16px; height: 16px; background: #fff; border-radius: 50%; position: absolute; top: 1px; left: 1px; transition: 0.3s;
                    }
                    .qs-switch.active .qs-slider { left: 17px; background: #000; }
                `}</style>
            </div>
        </div>
    );
}

