import React, { useEffect, useState, useMemo } from 'react';
import { useCampaign } from '../../shared/context/CampaignContext';
import { useAppFeedback } from '../../shared/feedback/AppFeedback';
import { selectConditionViewModels } from '../../shared/db/selectors/effectSelectors';
import {
    COMPANION_TYPES, FAMILIAR_GROUPS, COMPANION_GROUPS, SPECIALIZATIONS,
    FAMILIAR_ABILITIES, MASTER_ABILITIES, COMPANION_DEFAULTS, ACTION_COST_SYMBOLS
} from '../../data/companionData';
import './CompanionTab.css';
import { deepClone } from '../../shared/utils/deepClone';

// ── Condition constants (simple list for companions) ─────────────────────────
const CONDITIONS = [
    'Blinded', 'Clumsy', 'Confused', 'Dazzled', 'Deafened', 'Doomed',
    'Drained', 'Dying', 'Enfeebled', 'Fascinated', 'Fatigued', 'Fleeing',
    'Frightened', 'Grabbed', 'Immobilized', 'Off-Guard', 'Paralyzed',
    'Petrified', 'Prone', 'Quickened', 'Restrained', 'Sickened',
    'Slowed', 'Stunned', 'Stupefied', 'Unconscious', 'Wounded'
];
const VALUED_CONDITIONS = ['Clumsy', 'Doomed', 'Drained', 'Dying', 'Enfeebled', 'Frightened', 'Sickened', 'Slowed', 'Stunned', 'Stupefied', 'Wounded'];

function isFamiliarType(typeId) { return FAMILIAR_GROUPS.includes(typeId); }

// ── Sub-components ───────────────────────────────────────────────────────────

function TraitPill({ label }) {
    return <span className="comp-trait">{label}</span>;
}

function ActionCost({ cost }) {
    const sym = ACTION_COST_SYMBOLS[cost] ?? cost;
    if (!sym) return null;
    return <span className="comp-action-cost">{sym}</span>;
}

function AttackRow({ attack, onEdit, onRemove, editing }) {
    const fmtBonus = n => (n >= 0 ? `+${n}` : `${n}`);
    return (
        <div className="comp-ability-row comp-ability-row--attack">
            <div className="comp-ability-icon">⚔️</div>
            <div className="comp-ability-main">
                <span className="comp-ability-name">{attack.name}</span>
                <span className="comp-ability-attack-stats">
                    {fmtBonus(attack.bonus ?? 0)} · {attack.damage} {attack.damageType}
                </span>
                {attack.traits?.length > 0 && (
                    <div className="comp-ability-traits">
                        {attack.traits.map(t => <TraitPill key={t} label={t} />)}
                    </div>
                )}
            </div>
            {editing && (
                <div className="comp-ability-edit-btns">
                    <button className="comp-btn-icon" onClick={onEdit}>✏️</button>
                    <button className="comp-btn-icon comp-btn-icon--danger" onClick={onRemove}>✕</button>
                </div>
            )}
        </div>
    );
}

function AbilityRow({ ability, onEdit, onRemove, editing }) {
    const [expanded, setExpanded] = useState(false);
    return (
        <div className="comp-ability-row" onClick={() => setExpanded(e => !e)}>
            <div className="comp-ability-icon">
                {ability.traits?.includes('minion') ? '⚡' : '✦'}
            </div>
            <div className="comp-ability-main">
                <div className="comp-ability-header-row">
                    <span className="comp-ability-name">{ability.name}</span>
                    <ActionCost cost={ability.actionCost} />
                    {ability.traits?.filter(t => t !== 'minion').map(t => <TraitPill key={t} label={t} />)}
                </div>
                {expanded && ability.description && (
                    <p className="comp-ability-desc">{ability.description}</p>
                )}
            </div>
            {editing && (
                <div className="comp-ability-edit-btns" onClick={e => e.stopPropagation()}>
                    <button className="comp-btn-icon" onClick={onEdit}>✏️</button>
                    <button className="comp-btn-icon comp-btn-icon--danger" onClick={onRemove}>✕</button>
                </div>
            )}
        </div>
    );
}

function FamiliarAbilityPill({ name, onRemove, editing }) {
    const data = [...FAMILIAR_ABILITIES, ...MASTER_ABILITIES].find(a => a.name === name);
    const [showTip, setShowTip] = useState(false);
    return (
        <div className="comp-fam-pill" onMouseEnter={() => setShowTip(true)} onMouseLeave={() => setShowTip(false)}>
            <span onClick={() => setShowTip(s => !s)}>{name}</span>
            {editing && <button className="comp-pill-remove" onClick={onRemove}>✕</button>}
            {showTip && data?.description && (
                <div className="comp-fam-tooltip">{data.description}</div>
            )}
        </div>
    );
}

// ── Edit Panel ───────────────────────────────────────────────────────────────

function CompanionEditPanel({ companion, onSave, onCancel }) {
    const [form, setForm] = useState(() => ({
        type: companion?.type || 'young',
        specialization: companion?.specialization || '',
        name: companion?.name || '',
        species: companion?.species || '',
        hp: { ...( companion?.hp || { current: 20, max: 20 }) },
        ac: companion?.ac ?? 16,
        perception: companion?.perception ?? 5,
        speeds: { land: 25, fly: 0, swim: 0, climb: 0, burrow: 0, ...(companion?.speeds || {}) },
        saves: { fortitude: 5, reflex: 5, will: 3, ...(companion?.saves || {}) },
        attacks: deepClone(companion?.attacks || []),
        abilities: deepClone(companion?.abilities || []),
        familiarAbilities: [...(companion?.familiarAbilities || [])],
        masterAbilities: [...(companion?.masterAbilities || [])],
        notes: companion?.notes || '',
    }));

    const [editingAttack, setEditingAttack] = useState(null); // null | {idx, data}
    const [editingAbility, setEditingAbility] = useState(null);
    const [abilitySearch, setAbilitySearch] = useState('');
    const [activeSection, setActiveSection] = useState('basics');

    const set = (key, val) => setForm(f => ({ ...f, [key]: val }));
    const setNested = (key, sub, val) => setForm(f => ({ ...f, [key]: { ...f[key], [sub]: val } }));

    const isFamiliar = isFamiliarType(form.type);

    const applyDefaults = (typeId) => {
        const defaults = COMPANION_DEFAULTS[typeId];
        if (!defaults) return;
        setForm(f => ({
            ...f, type: typeId,
            hp: { ...defaults.hp },
            ac: defaults.ac,
            perception: defaults.perception,
            speeds: { land: 25, fly: 0, swim: 0, climb: 0, burrow: 0, ...defaults.speeds },
            saves: { ...defaults.saves },
            attacks: deepClone(defaults.attacks || []),
            abilities: deepClone(defaults.abilities || []),
        }));
    };

    const attackTemplate = { name: '', bonus: 0, damage: '1d6', damageType: 'piercing', traits: [] };
    const abilityTemplate = { name: '', actionCost: '1', description: '', traits: [] };

    const saveAttack = (data) => {
        const attacks = [...form.attacks];
        if (editingAttack.idx === -1) attacks.push(data);
        else attacks[editingAttack.idx] = data;
        set('attacks', attacks);
        setEditingAttack(null);
    };

    const saveAbility = (data) => {
        const abilities = [...form.abilities];
        if (editingAbility.idx === -1) abilities.push(data);
        else abilities[editingAbility.idx] = data;
        set('abilities', abilities);
        setEditingAbility(null);
    };

    const filteredFamAbilities = useMemo(() => {
        const q = abilitySearch.toLowerCase();
        return FAMILIAR_ABILITIES.filter(a => !form.familiarAbilities.includes(a.name) && (!q || a.name.toLowerCase().includes(q)));
    }, [form.familiarAbilities, abilitySearch]);

    const filteredMasterAbilities = useMemo(() => {
        return MASTER_ABILITIES.filter(a => !form.masterAbilities.includes(a.name));
    }, [form.masterAbilities]);

    const SECTIONS = isFamiliar
        ? ['basics', 'stats', 'famabilities']
        : ['basics', 'stats', 'attacks', 'abilities'];

    return (
        <div className="comp-edit-panel">
            <div className="comp-edit-header">
                <h3>Configure Companion</h3>
                <button className="comp-btn-icon" onClick={onCancel}>✕</button>
            </div>

            {/* Section tabs */}
            <div className="comp-edit-tabs">
                {SECTIONS.map(s => (
                    <button key={s} className={`comp-edit-tab ${activeSection === s ? 'active' : ''}`}
                        onClick={() => setActiveSection(s)}>
                        {{ basics: 'Identity', stats: 'Stats', famabilities: 'Abilities', attacks: 'Attacks', abilities: 'Actions' }[s]}
                    </button>
                ))}
            </div>

            <div className="comp-edit-body">
                {/* ── BASICS ── */}
                {activeSection === 'basics' && (
                    <div className="comp-edit-section">
                        <div className="comp-edit-field">
                            <label>Name</label>
                            <input className="modal-input" value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Ember" />
                        </div>
                        <div className="comp-edit-field">
                            <label>Species / Creature Type</label>
                            <input className="modal-input" value={form.species} onChange={e => set('species', e.target.value)} placeholder="e.g. Raven, Bear, Homunculus" />
                        </div>
                        <div className="comp-edit-field">
                            <label>Companion Type</label>
                            <select className="modal-input" value={form.type} onChange={e => applyDefaults(e.target.value)}>
                                <optgroup label="Familiar">
                                    {COMPANION_TYPES.filter(t => FAMILIAR_GROUPS.includes(t.id)).map(t => (
                                        <option key={t.id} value={t.id}>{t.label}</option>
                                    ))}
                                </optgroup>
                                <optgroup label="Animal Companion">
                                    {COMPANION_TYPES.filter(t => COMPANION_GROUPS.includes(t.id)).map(t => (
                                        <option key={t.id} value={t.id}>{t.label}</option>
                                    ))}
                                </optgroup>
                            </select>
                            <p className="comp-edit-hint">{COMPANION_TYPES.find(t => t.id === form.type)?.description}</p>
                        </div>
                        {form.type === 'specialized' && (
                            <div className="comp-edit-field">
                                <label>Specialization</label>
                                <select className="modal-input" value={form.specialization} onChange={e => set('specialization', e.target.value)}>
                                    <option value="">— choose —</option>
                                    {SPECIALIZATIONS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                                </select>
                                {form.specialization && (
                                    <p className="comp-edit-hint">{SPECIALIZATIONS.find(s => s.id === form.specialization)?.description}</p>
                                )}
                            </div>
                        )}
                        <div className="comp-edit-field">
                            <label>Notes</label>
                            <textarea className="modal-input" rows={3} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Backstory, appearance, special traits..." />
                        </div>
                    </div>
                )}

                {/* ── STATS ── */}
                {activeSection === 'stats' && (
                    <div className="comp-edit-section">
                        <div className="comp-edit-row-3">
                            <div className="comp-edit-field">
                                <label>Max HP</label>
                                <input type="number" className="modal-input" value={form.hp.max}
                                    onChange={e => setNested('hp', 'max', parseInt(e.target.value) || 0)} />
                            </div>
                            <div className="comp-edit-field">
                                <label>Current HP</label>
                                <input type="number" className="modal-input" value={form.hp.current}
                                    onChange={e => setNested('hp', 'current', parseInt(e.target.value) || 0)} />
                            </div>
                            <div className="comp-edit-field">
                                <label>AC</label>
                                <input type="number" className="modal-input" value={form.ac}
                                    onChange={e => set('ac', parseInt(e.target.value) || 0)} />
                            </div>
                        </div>
                        <div className="comp-edit-row-3">
                            <div className="comp-edit-field">
                                <label>Perception</label>
                                <input type="number" className="modal-input" value={form.perception}
                                    onChange={e => set('perception', parseInt(e.target.value) || 0)} />
                            </div>
                            <div className="comp-edit-field">
                                <label>Fortitude</label>
                                <input type="number" className="modal-input" value={form.saves.fortitude}
                                    onChange={e => setNested('saves', 'fortitude', parseInt(e.target.value) || 0)} />
                            </div>
                            <div className="comp-edit-field">
                                <label>Reflex</label>
                                <input type="number" className="modal-input" value={form.saves.reflex}
                                    onChange={e => setNested('saves', 'reflex', parseInt(e.target.value) || 0)} />
                            </div>
                        </div>
                        <div className="comp-edit-row-3">
                            <div className="comp-edit-field">
                                <label>Will</label>
                                <input type="number" className="modal-input" value={form.saves.will}
                                    onChange={e => setNested('saves', 'will', parseInt(e.target.value) || 0)} />
                            </div>
                        </div>
                        <hr className="comp-edit-divider" />
                        <p className="comp-edit-subheading">Speeds (0 = not available)</p>
                        <div className="comp-edit-row-3">
                            {['land', 'fly', 'swim', 'climb', 'burrow'].map(spd => (
                                <div key={spd} className="comp-edit-field">
                                    <label style={{ textTransform: 'capitalize' }}>{spd}</label>
                                    <input type="number" className="modal-input" value={form.speeds[spd] || 0}
                                        onChange={e => setNested('speeds', spd, parseInt(e.target.value) || 0)} />
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* ── FAMILIAR ABILITIES ── */}
                {activeSection === 'famabilities' && (
                    <div className="comp-edit-section">
                        <p className="comp-edit-subheading">Familiar Abilities (choose 2 per day)</p>
                        <div className="comp-edit-pills">
                            {form.familiarAbilities.map(n => (
                                <div key={n} className="comp-fam-pill comp-fam-pill--selected">
                                    {n}
                                    <button className="comp-pill-remove" onClick={() => set('familiarAbilities', form.familiarAbilities.filter(x => x !== n))}>✕</button>
                                </div>
                            ))}
                        </div>
                        <input className="modal-input" style={{ marginTop: 8 }} placeholder="Search abilities..." value={abilitySearch} onChange={e => setAbilitySearch(e.target.value)} />
                        <div className="comp-ability-picker">
                            {filteredFamAbilities.map(a => (
                                <div key={a.name} className="comp-ability-picker-item" onClick={() => set('familiarAbilities', [...form.familiarAbilities, a.name])}>
                                    <span className="comp-ability-picker-name">{a.name}</span>
                                    <span className="comp-ability-picker-desc">{a.description}</span>
                                </div>
                            ))}
                        </div>

                        <hr className="comp-edit-divider" />
                        <p className="comp-edit-subheading">Master Abilities</p>
                        <div className="comp-edit-pills">
                            {form.masterAbilities.map(n => (
                                <div key={n} className="comp-fam-pill comp-fam-pill--master">
                                    {n}
                                    <button className="comp-pill-remove" onClick={() => set('masterAbilities', form.masterAbilities.filter(x => x !== n))}>✕</button>
                                </div>
                            ))}
                        </div>
                        <div className="comp-ability-picker">
                            {filteredMasterAbilities.map(a => (
                                <div key={a.name} className="comp-ability-picker-item" onClick={() => set('masterAbilities', [...form.masterAbilities, a.name])}>
                                    <span className="comp-ability-picker-name">{a.name}</span>
                                    <span className="comp-ability-picker-desc">{a.description}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* ── ATTACKS ── */}
                {activeSection === 'attacks' && !editingAttack && (
                    <div className="comp-edit-section">
                        {form.attacks.map((atk, i) => (
                            <div key={i} className="comp-edit-list-item">
                                <span>{atk.name} · {atk.damage} {atk.damageType}</span>
                                <div>
                                    <button className="comp-btn-icon" onClick={() => setEditingAttack({ idx: i, data: { ...atk, traits: [...atk.traits] } })}>✏️</button>
                                    <button className="comp-btn-icon comp-btn-icon--danger" onClick={() => set('attacks', form.attacks.filter((_, j) => j !== i))}>✕</button>
                                </div>
                            </div>
                        ))}
                        <button className="comp-btn-add" onClick={() => setEditingAttack({ idx: -1, data: { ...attackTemplate, traits: [] } })}>+ Add Attack</button>
                    </div>
                )}
                {activeSection === 'attacks' && editingAttack && (
                    <AttackEditor
                        data={editingAttack.data}
                        onSave={saveAttack}
                        onCancel={() => setEditingAttack(null)}
                    />
                )}

                {/* ── ABILITIES ── */}
                {activeSection === 'abilities' && !editingAbility && (
                    <div className="comp-edit-section">
                        {form.abilities.map((ab, i) => (
                            <div key={i} className="comp-edit-list-item">
                                <span>{ab.name} {ab.actionCost && `[${ab.actionCost}◆]`}</span>
                                <div>
                                    <button className="comp-btn-icon" onClick={() => setEditingAbility({ idx: i, data: { ...ab, traits: [...(ab.traits || [])] } })}>✏️</button>
                                    <button className="comp-btn-icon comp-btn-icon--danger" onClick={() => set('abilities', form.abilities.filter((_, j) => j !== i))}>✕</button>
                                </div>
                            </div>
                        ))}
                        <button className="comp-btn-add" onClick={() => setEditingAbility({ idx: -1, data: { ...abilityTemplate, traits: [] } })}>+ Add Action / Ability</button>
                    </div>
                )}
                {activeSection === 'abilities' && editingAbility && (
                    <AbilityEditor
                        data={editingAbility.data}
                        onSave={saveAbility}
                        onCancel={() => setEditingAbility(null)}
                    />
                )}
            </div>

            <div className="comp-edit-footer">
                <button className="comp-btn-secondary" onClick={onCancel}>Cancel</button>
                <button className="comp-btn-primary" onClick={() => onSave(form)}>Save Companion</button>
            </div>
        </div>
    );
}

function AttackEditor({ data, onSave, onCancel }) {
    const [form, setForm] = useState({ ...data });
    const [traitsInput, setTraitsInput] = useState((data.traits || []).join(', '));
    const DAMAGE_TYPES = ['piercing', 'slashing', 'bludgeoning', 'fire', 'cold', 'electricity', 'acid', 'poison', 'mental', 'force', 'sonic'];
    return (
        <div className="comp-edit-section">
            <h4 style={{ color: '#c5a059', margin: '0 0 12px' }}>Edit Attack</h4>
            <div className="comp-edit-field"><label>Name</label>
                <input className="modal-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div className="comp-edit-row-3">
                <div className="comp-edit-field"><label>Attack Bonus</label>
                    <input type="number" className="modal-input" value={form.bonus} onChange={e => setForm(f => ({ ...f, bonus: parseInt(e.target.value) || 0 }))} /></div>
                <div className="comp-edit-field"><label>Damage Dice</label>
                    <input className="modal-input" value={form.damage} onChange={e => setForm(f => ({ ...f, damage: e.target.value }))} placeholder="1d8" /></div>
                <div className="comp-edit-field"><label>Damage Type</label>
                    <select className="modal-input" value={form.damageType} onChange={e => setForm(f => ({ ...f, damageType: e.target.value }))}>
                        {DAMAGE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select></div>
            </div>
            <div className="comp-edit-field"><label>Traits (comma-separated)</label>
                <input className="modal-input" value={traitsInput} onChange={e => setTraitsInput(e.target.value)} placeholder="agile, finesse, reach" /></div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button className="comp-btn-secondary" onClick={onCancel}>Cancel</button>
                <button className="comp-btn-primary" onClick={() => onSave({ ...form, traits: traitsInput.split(',').map(s => s.trim()).filter(Boolean) })}>Save Attack</button>
            </div>
        </div>
    );
}

function AbilityEditor({ data, onSave, onCancel }) {
    const [form, setForm] = useState({ ...data });
    const [traitsInput, setTraitsInput] = useState((data.traits || []).join(', '));
    return (
        <div className="comp-edit-section">
            <h4 style={{ color: '#c5a059', margin: '0 0 12px' }}>Edit Action / Ability</h4>
            <div className="comp-edit-field"><label>Name</label>
                <input className="modal-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div className="comp-edit-field"><label>Action Cost</label>
                <select className="modal-input" value={form.actionCost} onChange={e => setForm(f => ({ ...f, actionCost: e.target.value }))}>
                    <option value="">— Passive —</option>
                    <option value="F">Free Action (⟳)</option>
                    <option value="R">Reaction (⟲)</option>
                    <option value="1">1 Action (◆)</option>
                    <option value="2">2 Actions (◆◆)</option>
                    <option value="3">3 Actions (◆◆◆)</option>
                </select></div>
            <div className="comp-edit-field"><label>Description</label>
                <textarea className="modal-input" rows={4} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
            <div className="comp-edit-field"><label>Traits (comma-separated)</label>
                <input className="modal-input" value={traitsInput} onChange={e => setTraitsInput(e.target.value)} /></div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button className="comp-btn-secondary" onClick={onCancel}>Cancel</button>
                <button className="comp-btn-primary" onClick={() => onSave({ ...form, traits: traitsInput.split(',').map(s => s.trim()).filter(Boolean) })}>Save Ability</button>
            </div>
        </div>
    );
}

// ── Condition Adder ──────────────────────────────────────────────────────────

function ConditionAdder({ conditions, onChange }) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [value, setValue] = useState(1);

    const filtered = CONDITIONS.filter(c =>
        !conditions.find(ex => ex.name === c) &&
        c.toLowerCase().includes(search.toLowerCase())
    );

    const add = (name) => {
        const needsVal = VALUED_CONDITIONS.includes(name);
        onChange([...conditions, { name, value: needsVal ? value : null }]);
        setOpen(false);
        setSearch('');
    };

    const remove = (name) => onChange(conditions.filter(c => c.name !== name));

    const change = (name, v) => onChange(conditions.map(c => c.name === name ? { ...c, value: v } : c));

    return (
        <div className="comp-conditions">
            {conditions.map(c => (
                <div key={c.name} className="comp-condition-pill">
                    <span onClick={() => remove(c.name)}>{c.name}{c.value != null ? ` ${c.value}` : ''}</span>
                    {c.value != null && (
                        <div className="comp-cond-controls">
                            <button onClick={() => change(c.name, Math.max(1, c.value - 1))}>−</button>
                            <button onClick={() => change(c.name, c.value + 1)}>+</button>
                        </div>
                    )}
                </div>
            ))}
            <button className="comp-condition-add-btn" onClick={() => setOpen(o => !o)}>+</button>
            {open && (
                <div className="comp-condition-picker">
                    <input autoFocus className="modal-input" placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} />
                    {VALUED_CONDITIONS.includes(search) || <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0' }}>
                        <span style={{ color: '#888', fontSize: '0.8em' }}>Value:</span>
                        <input type="number" className="modal-input" style={{ width: 60 }} value={value} min={1} onChange={e => setValue(parseInt(e.target.value) || 1)} />
                    </div>}
                    <div className="comp-condition-list">
                        {filtered.map(c => <div key={c} className="comp-condition-option" onClick={() => add(c)}>{c}</div>)}
                    </div>
                    <button className="comp-btn-icon" onClick={() => setOpen(false)} style={{ marginTop: 6 }}>✕ Close</button>
                </div>
            )}
        </div>
    );
}

// ── HP Bar ───────────────────────────────────────────────────────────────────

function HpBar({ current, max, onChange }) {
    const [editing, setEditing] = useState(false);
    const [temp, setTemp] = useState('');
    const pct = max > 0 ? Math.max(0, Math.min(100, (current / max) * 100)) : 0;
    const color = pct > 60 ? '#4caf50' : pct > 30 ? '#ff9800' : '#f44336';

    const adjust = (delta) => onChange(Math.max(0, Math.min(max, current + delta)));

    const commit = () => {
        const v = parseInt(temp);
        if (!isNaN(v)) onChange(Math.max(0, Math.min(max, v)));
        setEditing(false);
    };

    return (
        <div className="comp-hp-section">
            <div className="comp-hp-bar-bg">
                <div className="comp-hp-bar-fill" style={{ width: `${pct}%`, background: color }} />
            </div>
            <div className="comp-hp-controls">
                <button className="comp-hp-btn" onClick={() => adjust(-5)}>−5</button>
                <button className="comp-hp-btn" onClick={() => adjust(-1)}>−1</button>
                {editing ? (
                    <input autoFocus className="comp-hp-input" value={temp}
                        onChange={e => setTemp(e.target.value)}
                        onBlur={commit}
                        onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }} />
                ) : (
                    <span className="comp-hp-value" onClick={() => { setTemp(String(current)); setEditing(true); }}>
                        {current}<span className="comp-hp-max">/{max}</span>
                    </span>
                )}
                <button className="comp-hp-btn" onClick={() => adjust(1)}>+1</button>
                <button className="comp-hp-btn" onClick={() => adjust(5)}>+5</button>
            </div>
        </div>
    );
}

// ── Main Tab ─────────────────────────────────────────────────────────────────

function actorToCompanionForm(actor) {
    if (!actor) return null;
    const sheet = actor.sheet || {};
    return {
        ...sheet,
        id: actor.id,
        name: sheet.name || actor.name || '',
        type: sheet.type || actor.progression?.type || (actor.kind === 'familiar' ? 'familiar' : 'young'),
        specialization: sheet.specialization || actor.progression?.specialization || '',
        species: sheet.species || actor.baseTemplateId || '',
        hp: { current: 0, max: 1, ...(sheet.hp || actor.stats?.hp || {}) },
        ac: sheet.ac ?? actor.stats?.ac ?? 16,
        perception: sheet.perception ?? actor.stats?.perception ?? 5,
        speeds: { land: 25, ...(sheet.speeds || actor.stats?.speed || {}) },
        saves: { fortitude: 5, reflex: 5, will: 3, ...(sheet.saves || actor.stats?.saves || {}) },
        attacks: Array.isArray(sheet.attacks) ? sheet.attacks : [],
        abilities: Array.isArray(sheet.abilities) ? sheet.abilities : [],
        familiarAbilities: Array.isArray(sheet.familiarAbilities) ? sheet.familiarAbilities : [],
        masterAbilities: Array.isArray(sheet.masterAbilities) ? sheet.masterAbilities : [],
        notes: sheet.notes || '',
    };
}

function companionFormToActorInput(companion, { ownerActor, existingActor } = {}) {
    const type = companion?.type || 'young';
    const kind = isFamiliarType(type)
        ? 'familiar'
        : type === 'pet'
            ? 'pet'
            : 'animal_companion';
    const sheet = { ...(existingActor?.sheet || {}), ...(companion || {}) };
    delete sheet.conditions;
    return {
        ...(existingActor || {}),
        kind,
        ownerActorId: ownerActor?.id || existingActor?.ownerActorId || null,
        controllerActorId: ownerActor?.id || existingActor?.controllerActorId || null,
        controllerUserEmail: existingActor?.controllerUserEmail || ownerActor?.controllerUserEmail || null,
        commandMode: existingActor?.commandMode || (kind === 'familiar' ? 'direct_follower' : 'command_animal'),
        ruleset: existingActor?.ruleset || ownerActor?.ruleset || 'pf2e_remaster',
        name: companion?.name || existingActor?.name || 'Unnamed Companion',
        level: Number.isFinite(Number(companion?.level)) ? Number(companion.level) : (ownerActor?.level || existingActor?.level || 1),
        baseTemplateId: companion?.species || companion?.type || existingActor?.baseTemplateId || null,
        progression: {
            ...(existingActor?.progression || {}),
            type,
            specialization: companion?.specialization || null,
        },
        selectionSlots: {
            ...(existingActor?.selectionSlots || {}),
            familiarAbilities: companion?.familiarAbilities || [],
            masterAbilities: companion?.masterAbilities || [],
        },
        sourceStatus: existingActor?.sourceStatus || 'manual_current',
        sheet,
        stats: {
            ...(existingActor?.stats || {}),
            hp: companion?.hp || { current: 0, max: 1 },
            ac: companion?.ac ?? null,
            perception: companion?.perception ?? null,
            saves: companion?.saves || {},
            speed: companion?.speeds || { land: 25 },
        },
        inventory: existingActor?.inventory || companion?.inventory || [],
        magic: existingActor?.magic || companion?.magic || { slots: {}, list: [] },
    };
}

export default function CompanionTab({ character, ownerActor, companionActors = [], dataActions, activeCampaignId }) {
    const { activeCampaign } = useCampaign();
    const { notifyError } = useAppFeedback();
    const companionActor = companionActors[0] || null;
    const companion = useMemo(() => actorToCompanionForm(companionActor), [companionActor]);
    const companionConditions = useMemo(
        () => selectConditionViewModels(activeCampaign, companionActor?.id)
            .map(condition => ({ ...condition, value: condition.level })),
        [activeCampaign, companionActor?.id]
    );
    const [showEdit, setShowEdit] = useState(!companion);
    const [editingMode, setEditingMode] = useState(false);

    useEffect(() => {
        if (companion) setShowEdit(false);
    }, [companion?.id]);

    const save = (data) => {
        if (!activeCampaignId || !ownerActor?.id || !dataActions?.actor) {
            notifyError('No active actor is available for companion updates.');
            return;
        }
        const actorInput = companionFormToActorInput(data, { ownerActor, existingActor: companionActor });
        const action = companionActor?.id
            ? dataActions.actor.updateActor(activeCampaignId, companionActor.id, () => actorInput)
            : dataActions.actor.createActor(activeCampaignId, actorInput);
        Promise.resolve(action).catch(err => {
            console.error(err);
            notifyError(err);
        });
        setShowEdit(false);
        setEditingMode(false);
    };

    const setCompanionField = (fn) => {
        if (!companionActor?.id || !activeCampaignId || !dataActions?.actor) return;
        const nextCompanion = { ...(companion || {}) };
        fn(nextCompanion);
        const actorInput = companionFormToActorInput(nextCompanion, { ownerActor, existingActor: companionActor });
        Promise.resolve(dataActions.actor.updateActor(activeCampaignId, companionActor.id, () => actorInput)).catch(err => {
            console.error(err);
            notifyError(err);
        });
    };

    const setCompanionConditions = (conditions) => {
        if (!companionActor?.id || !activeCampaignId || !dataActions?.effect) return;
        const deletes = companionConditions
            .filter(condition => condition.sourceEffectId || condition.id)
            .map(condition => dataActions.effect.deleteEffect(activeCampaignId, condition.sourceEffectId || condition.id));
        const creates = conditions.map(condition => dataActions.effect.createEffect(activeCampaignId, companionActor.id, {
            label: condition.name,
            category: 'condition',
            value: condition.value ?? condition.level ?? 1,
            source: { type: 'manual', name: condition.name, actorId: companionActor.id },
        }));
        Promise.all([...deletes, ...creates]).catch(err => {
            console.error(err);
            notifyError(err);
        });
    };

    if (showEdit) {
        return (
            <div className="comp-tab">
                <CompanionEditPanel
                    companion={companion}
                    onSave={save}
                    onCancel={companion ? () => setShowEdit(false) : undefined}
                />
            </div>
        );
    }

    if (!companion) return null;

    const typeInfo = COMPANION_TYPES.find(t => t.id === companion.type);
    const isFamiliar = isFamiliarType(companion.type);
    const fmtBonus = n => { const v = parseInt(n); return isNaN(v) ? '?' : (v >= 0 ? `+${v}` : `${v}`); };

    const speedEntries = Object.entries(companion.speeds || { land: 25 })
        .filter(([, v]) => v > 0)
        .map(([k, v]) => `${v} ft ${k !== 'land' ? k : ''}`).join(' · ');

    const specInfo = companion.specialization ? SPECIALIZATIONS.find(s => s.id === companion.specialization) : null;

    return (
        <div className="comp-tab">
            {/* ── Header ── */}
            <div className="comp-header">
                <div className="comp-header-left">
                    <div className="comp-type-badge">
                        {typeInfo?.icon} {typeInfo?.label}
                        {specInfo && <span className="comp-spec-badge">· {specInfo.label}</span>}
                    </div>
                    <h2 className="comp-name">{companion.name || 'Unnamed'}</h2>
                    {companion.species && <div className="comp-species">{companion.species}</div>}
                </div>
                <button className="comp-btn-edit" onClick={() => setShowEdit(true)}>⚙️</button>
            </div>

            {/* ── HP Bar ── */}
            <div className="comp-card">
                <div className="comp-card-label">Hit Points</div>
                <HpBar
                    current={companion.hp?.current ?? 0}
                    max={companion.hp?.max ?? 0}
                    onChange={v => setCompanionField(c => { c.hp = { ...c.hp, current: v }; })}
                />
            </div>

            {/* ── Conditions ── */}
            <div className="comp-card">
                <div className="comp-card-label">Conditions</div>
                <ConditionAdder
                    conditions={companionConditions}
                    onChange={setCompanionConditions}
                />
            </div>

            {/* ── Core Stats ── */}
            <div className="comp-card comp-stats-grid">
                <div className="comp-stat-box">
                    <div className="comp-stat-val">{companion.ac ?? '?'}</div>
                    <div className="comp-stat-lbl">AC</div>
                </div>
                <div className="comp-stat-box">
                    <div className="comp-stat-val">{fmtBonus(companion.perception)}</div>
                    <div className="comp-stat-lbl">Perception</div>
                </div>
                <div className="comp-stat-box comp-stat-box--wide">
                    <div className="comp-stat-val comp-stat-speed">{speedEntries || '25 ft'}</div>
                    <div className="comp-stat-lbl">Speed</div>
                </div>
            </div>

            {/* ── Saves ── */}
            <div className="comp-card comp-saves-row">
                {[['Fortitude', 'fortitude'], ['Reflex', 'reflex'], ['Will', 'will']].map(([label, key]) => (
                    <div key={key} className="comp-save-box">
                        <div className="comp-save-val">{fmtBonus(companion.saves?.[key])}</div>
                        <div className="comp-save-lbl">{label}</div>
                    </div>
                ))}
            </div>

            {/* ── Familiar Abilities ── */}
            {isFamiliar && (
                <>
                    {companion.familiarAbilities?.length > 0 && (
                        <div className="comp-card">
                            <div className="comp-card-label">Familiar Abilities</div>
                            <div className="comp-fam-pills-row">
                                {companion.familiarAbilities.map(n => (
                                    <FamiliarAbilityPill key={n} name={n} editing={editingMode} onRemove={() => setCompanionField(c => { c.familiarAbilities = c.familiarAbilities.filter(x => x !== n); })} />
                                ))}
                            </div>
                        </div>
                    )}
                    {companion.masterAbilities?.length > 0 && (
                        <div className="comp-card">
                            <div className="comp-card-label">Master Abilities</div>
                            <div className="comp-fam-pills-row">
                                {companion.masterAbilities.map(n => (
                                    <FamiliarAbilityPill key={n} name={n} editing={editingMode} onRemove={() => setCompanionField(c => { c.masterAbilities = c.masterAbilities.filter(x => x !== n); })} />
                                ))}
                            </div>
                        </div>
                    )}
                    {companion.abilities?.filter(a => !a.traits?.includes('minion')).length > 0 && (
                        <div className="comp-card">
                            <div className="comp-card-label">Actions</div>
                            {companion.abilities?.filter(a => !a.traits?.includes('minion')).map((ab, i) => (
                                <AbilityRow key={i} ability={ab} editing={editingMode}
                                    onEdit={() => {}} onRemove={() => {}} />
                            ))}
                        </div>
                    )}
                </>
            )}

            {/* ── Animal Companion: Attacks + Abilities ── */}
            {!isFamiliar && (
                <>
                    {companion.attacks?.length > 0 && (
                        <div className="comp-card">
                            <div className="comp-card-label">Attacks</div>
                            {companion.attacks.map((atk, i) => (
                                <AttackRow key={i} attack={atk} editing={editingMode}
                                    onEdit={() => {}} onRemove={() => {}} />
                            ))}
                        </div>
                    )}
                    {companion.abilities?.length > 0 && (
                        <div className="comp-card">
                            <div className="comp-card-label">Actions & Abilities</div>
                            {companion.abilities.map((ab, i) => (
                                <AbilityRow key={i} ability={ab} editing={editingMode}
                                    onEdit={() => {}} onRemove={() => {}} />
                            ))}
                        </div>
                    )}
                </>
            )}

            {/* ── Notes ── */}
            {companion.notes && (
                <div className="comp-card">
                    <div className="comp-card-label">Notes</div>
                    <p className="comp-notes">{companion.notes}</p>
                </div>
            )}

            {/* ── Footer ── */}
            <div className="comp-footer">
                <button className="comp-btn-secondary" onClick={() => setShowEdit(true)}>⚙️ Edit Companion</button>
            </div>
        </div>
    );
}
