import React, { useState, useMemo } from 'react';
import RichTextEditor from '../shared/components/RichTextEditor';
import { useCampaign } from '../shared/context/CampaignContext';
import { useAppFeedback } from '../shared/feedback/AppFeedback';
import { selectDeviantAbilityList } from '../shared/db/selectors/abilitySelectors';
import { selectPactUsageByAbility } from '../shared/db/selectors/pactSelectors';
import { ELEMENTS, ELEMENT_NAMES, generateId } from './pactsData';

const EMPTY_ABILITY = {
    id: '', name: '', element: 'Fire', level: 1,
    description: '',
    awakening1: { name: '', levelNote: '', description: '' },
    awakening2: { name: '', levelNote: '', description: '' },
};

export default function DeviantAbilitiesAdminView({ db }) {
    const { dataActions } = useCampaign();
    const { confirm, notifyError } = useAppFeedback();
    const abilities = useMemo(() => selectDeviantAbilityList(db), [db]);
    const pactUsageByAbility = useMemo(() => selectPactUsageByAbility(db), [db]);

    const [search, setSearch] = useState('');
    const [filterEl, setFilterEl] = useState('');
    const [editing, setEditing] = useState(null);
    const [isNew, setIsNew] = useState(false);
    const runDataAction = (action) => {
        Promise.resolve(action).catch(err => {
            console.error(err);
            notifyError(err);
        });
    };

    const visible = useMemo(() =>
        abilities.filter(a =>
            (!filterEl || a.element === filterEl) &&
            (!search || a.name.toLowerCase().includes(search.toLowerCase()))
        ), [abilities, filterEl, search]);

    const save = () => {
        if (!editing?.name?.trim()) return;
        const id = editing.id || generateId(editing.name);
        const record = { ...editing, id };
        runDataAction(dataActions.pact.saveDeviantAbility(record));
        setEditing(null);
    };

    const del = async (id) => {
        const confirmed = await confirm({
            title: 'Delete deviant ability',
            message: 'Delete this deviant ability?',
            confirmLabel: 'Delete',
            danger: true,
        });
        if (!confirmed) return;
        runDataAction(dataActions.pact.deleteDeviantAbility(id));
        if (editing?.id === id) setEditing(null);
    };

    const setAwakening = (key, field, val) =>
        setEditing(prev => ({ ...prev, [key]: { ...prev[key], [field]: val } }));

    if (editing) {
        const el = ELEMENTS[editing.element] || ELEMENTS.Fire;
        return (
            <div style={{ padding: 20, maxWidth: 700, overflowY: 'auto', height: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                    <h2 style={{ margin: 0, fontFamily: 'Cinzel, serif', color: el.color }}>
                        {isNew ? 'New Deviant Ability' : `Edit: ${editing.name}`}
                    </h2>
                    <button onClick={() => setEditing(null)} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '1.3em' }}>✕</button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 80px', gap: 10 }}>
                        <Field label="Name">
                            <input value={editing.name} onChange={e => setEditing(p => ({ ...p, name: e.target.value }))} style={inputStyle} />
                        </Field>
                        <Field label="Element">
                            <select value={editing.element} onChange={e => setEditing(p => ({ ...p, element: e.target.value }))} style={inputStyle}>
                                {ELEMENT_NAMES.map(el => <option key={el} value={el}>{ELEMENTS[el].icon} {el}</option>)}
                            </select>
                        </Field>
                        <Field label="Level">
                            <input type="number" min={1} max={20} value={editing.level} onChange={e => setEditing(p => ({ ...p, level: parseInt(e.target.value) || 1 }))} style={inputStyle} />
                        </Field>
                    </div>

                    <Field label="Description">
                        <RichTextEditor value={editing.description} onChange={v => setEditing(p => ({ ...p, description: v }))} placeholder="Ability description..." style={{ minHeight: 120, background: '#111' }} />
                    </Field>

                    {/* Awakenings */}
                    {[1, 2].map(n => {
                        const key = `awakening${n}`;
                        const aw = editing[key] || {};
                        return (
                            <div key={key} style={{ background: '#1a1a1d', border: `1px solid ${el.dim}`, borderRadius: 6, padding: 12 }}>
                                <div style={{ fontSize: '0.75em', color: el.color, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
                                    Awakening {n}
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px', gap: 8, marginBottom: 8 }}>
                                    <Field label="Name">
                                        <input value={aw.name || ''} onChange={e => setAwakening(key, 'name', e.target.value)} style={inputStyle} />
                                    </Field>
                                    <Field label="GM Note (optional)">
                                        <input value={aw.levelNote || ''} onChange={e => setAwakening(key, 'levelNote', e.target.value)} placeholder="e.g. Level 8+" style={inputStyle} />
                                    </Field>
                                </div>
                                <Field label="Description">
                                    <RichTextEditor value={aw.description || ''} onChange={v => setAwakening(key, 'description', v)} placeholder={`Awakening ${n} description...`} style={{ minHeight: 80, background: '#111' }} />
                                </Field>
                            </div>
                        );
                    })}

                    <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={save} disabled={!editing.name?.trim()} style={{ flex: 1, padding: 10, background: el.color, border: 'none', color: '#111', borderRadius: 4, cursor: 'pointer', fontWeight: 'bold', opacity: editing.name?.trim() ? 1 : 0.5 }}>Save</button>
                        <button onClick={() => setEditing(null)} style={{ padding: '10px 20px', background: '#333', border: '1px solid #555', color: '#ccc', borderRadius: 4, cursor: 'pointer' }}>Cancel</button>
                        {editing.id && <button onClick={() => del(editing.id)} style={{ padding: '10px 12px', background: '#3a1a1a', border: '1px solid #e53935', color: '#ef9a9a', borderRadius: 4, cursor: 'pointer' }}>Delete</button>}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
            {/* Toolbar */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                <input className="modal-input" placeholder="Search deviant abilities..." value={search} onChange={e => setSearch(e.target.value)} style={{ width: 220 }} />
                <select className="modal-input" value={filterEl} onChange={e => setFilterEl(e.target.value)} style={{ width: 'auto' }}>
                    <option value="">All Elements</option>
                    {ELEMENT_NAMES.map(el => <option key={el} value={el}>{ELEMENTS[el].icon} {el}</option>)}
                </select>
                <button className="btn-add-condition" style={{ margin: 0, width: 'auto', background: '#4caf50' }} onClick={() => { setIsNew(true); setEditing({ ...EMPTY_ABILITY }); }}>
                    + New Deviant Ability
                </button>
            </div>

            {/* Table */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9em' }}>
                    <thead>
                        <tr style={{ background: '#333', textAlign: 'left' }}>
                            {['Name', 'Element', 'Level', 'Pact(s)', 'Awakenings'].map(h => (
                                <th key={h} style={{ padding: '8px 10px' }}>{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {visible.length === 0 && (
                            <tr><td colSpan={5} style={{ padding: 20, textAlign: 'center', color: '#555' }}>No deviant abilities yet. Create one above.</td></tr>
                        )}
                        {visible.map((a, i) => {
                            const el = ELEMENTS[a.element] || ELEMENTS.Fire;
                            const awCount = [a.awakening1?.name, a.awakening2?.name].filter(Boolean).length;
                            return (
                                <tr key={a.id} style={{ borderBottom: '1px solid #333', background: i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent', cursor: 'pointer' }}
                                    onDoubleClick={() => { setIsNew(false); setEditing({ ...a, awakening1: { ...a.awakening1 }, awakening2: { ...a.awakening2 } }); }}
                                    onClick={() => { setIsNew(false); setEditing({ ...a, awakening1: { ...a.awakening1 }, awakening2: { ...a.awakening2 } }); }}
                                >
                                    <td style={{ padding: '8px 10px', fontWeight: 'bold', color: '#e0e0e0' }}>{a.name}</td>
                                    <td style={{ padding: '8px 10px' }}>
                                        <span style={{ color: el.color }}>{el.icon} {a.element}</span>
                                    </td>
                                    <td style={{ padding: '8px 10px', color: '#aaa' }}>{a.level}</td>
                                    <td style={{ padding: '8px 10px', color: '#999' }}>
                                        {(pactUsageByAbility[a.id] || []).join(', ') || '-'}
                                    </td>
                                    <td style={{ padding: '8px 10px', color: '#888' }}>{awCount}/2 defined</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function Field({ label, children }) {
    return (
        <div>
            <div style={{ fontSize: '0.75em', color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>{label}</div>
            {children}
        </div>
    );
}

const inputStyle = { width: '100%', padding: '7px 10px', background: '#111', border: '1px solid #444', color: '#fff', borderRadius: 4, fontSize: '0.9em', boxSizing: 'border-box' };
