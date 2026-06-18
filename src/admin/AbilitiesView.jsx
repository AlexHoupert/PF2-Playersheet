import React, { useMemo, useState } from 'react';
import { getAllAbilities, ABILITY_INDEX_FILTER_OPTIONS } from '../shared/catalog/abilityIndex';
import { parseFoundry } from '../shared/utils/foundryParser';
import MultiSelectDropdown from '../shared/components/MultiSelectDropdown';
import BottomSheet from '../shared/components/BottomSheet';
import { useWindowSize } from '../shared/hooks/useWindowSize';
import { copyRef } from '../shared/clipboard/refClipboard';
import { useCampaign } from '../shared/context/CampaignContext';
import { selectCustomAbilityList } from '../shared/db/selectors/abilitySelectors';
import { selectCustomCreatures } from '../shared/db/selectors/bestiarySelectors';

const PAGE_SIZE = 100;

const TYPE_TABS = [
    { code: null, label: 'All' },
    { code: 'P',  label: 'Passive' },
    { code: 'R',  label: 'Reaction' },
    { code: 'F',  label: 'Free' },
    { code: '1',  label: '1 Action' },
    { code: '2',  label: '2 Actions' },
    { code: '3',  label: '3 Actions' },
];

const TYPE_OPTIONS = [
    { code: 'P', label: 'Passive' },
    { code: 'R', label: 'Reaction' },
    { code: 'F', label: 'Free Action' },
    { code: '1', label: '1 Action' },
    { code: '2', label: '2 Actions' },
    { code: '3', label: '3 Actions' },
];

function typeLabel(typeCode) {
    if (typeCode === 'P') return '—';
    if (typeCode === 'R') return 'R';
    if (typeCode === 'F') return 'F';
    return `${typeCode}A`;
}

function typeCodeToSystem(typeCode) {
    if (typeCode === 'P') return { actionType: { value: 'passive' }, actions: { value: null } };
    if (typeCode === 'R') return { actionType: { value: 'reaction' }, actions: { value: null } };
    if (typeCode === 'F') return { actionType: { value: 'free' }, actions: { value: null } };
    return { actionType: { value: 'action' }, actions: { value: parseInt(typeCode) || 1 } };
}

function buildFoundryItem(ability) {
    const sys = typeCodeToSystem(ability.typeCode);
    return {
        _id: `ability-${Date.now()}-${Math.floor(Math.random() * 9999)}`,
        name: ability.name,
        type: 'action',
        img: '',
        system: {
            ...sys,
            description: { value: ability.description },
            traits: { value: ability.traits || [] },
            category: ability.category || '',
        },
    };
}

function newBlankAbility() {
    return { id: `custom-${Date.now()}`, name: '', typeCode: 'P', traits: [], category: '', description: '', isCustom: true };
}

// ── Ability Form Modal ────────────────────────────────────────────────────────
function AbilityFormModal({ initial, onSave, onClose }) {
    const [form, setForm] = useState(initial);
    const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));
    const valid = form.name.trim().length > 0;

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3100 }}
            onClick={onClose}>
            <div style={{ background: '#1e1e21', border: '1px solid #c9a86c', borderRadius: 8, width: 'min(560px, 95vw)', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
                onClick={e => e.stopPropagation()}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0, color: '#f5deb3' }}>{initial.isCustom && initial.name ? 'Edit Ability' : 'New Ability'}</h3>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#888', fontSize: '1.4em', cursor: 'pointer' }}>×</button>
                </div>
                <div style={{ padding: 16, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div>
                        <label style={{ color: '#888', fontSize: '0.8em', display: 'block', marginBottom: 4 }}>Name *</label>
                        <input className="modal-input" value={form.name} onChange={e => set('name', e.target.value)} style={{ width: '100%' }} autoFocus />
                    </div>
                    <div style={{ display: 'flex', gap: 10 }}>
                        <div style={{ flex: 1 }}>
                            <label style={{ color: '#888', fontSize: '0.8em', display: 'block', marginBottom: 4 }}>Action Type</label>
                            <select className="modal-input" value={form.typeCode} onChange={e => set('typeCode', e.target.value)} style={{ width: '100%' }}>
                                {TYPE_OPTIONS.map(o => <option key={o.code} value={o.code}>{o.label}</option>)}
                            </select>
                        </div>
                        <div style={{ flex: 1 }}>
                            <label style={{ color: '#888', fontSize: '0.8em', display: 'block', marginBottom: 4 }}>Category</label>
                            <input className="modal-input" value={form.category} onChange={e => set('category', e.target.value)} placeholder="optional" style={{ width: '100%' }} />
                        </div>
                    </div>
                    <div>
                        <label style={{ color: '#888', fontSize: '0.8em', display: 'block', marginBottom: 4 }}>Traits</label>
                        <MultiSelectDropdown
                            label="Add traits..."
                            options={ABILITY_INDEX_FILTER_OPTIONS.traits}
                            selected={form.traits}
                            onChange={v => set('traits', v)}
                        />
                    </div>
                    <div>
                        <label style={{ color: '#888', fontSize: '0.8em', display: 'block', marginBottom: 4 }}>Description (HTML allowed)</label>
                        <textarea
                            className="modal-input"
                            value={form.description}
                            onChange={e => set('description', e.target.value)}
                            style={{ width: '100%', minHeight: 120, resize: 'vertical', fontFamily: 'monospace', fontSize: '0.85em' }}
                        />
                    </div>
                </div>
                <div style={{ padding: '10px 16px', borderTop: '1px solid #333', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                    <button onClick={onClose} style={{ padding: '6px 16px', background: '#333', border: '1px solid #555', color: '#ccc', borderRadius: 4, cursor: 'pointer' }}>Cancel</button>
                    <button onClick={() => valid && onSave(form)} disabled={!valid}
                        style={{ padding: '6px 16px', background: valid ? '#c9a86c' : '#555', border: 'none', color: valid ? '#111' : '#888', borderRadius: 4, cursor: valid ? 'pointer' : 'default', fontWeight: 'bold' }}>
                        Save
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── Creature Picker Modal ─────────────────────────────────────────────────────
function CreaturePickerModal({ db, onPick, onClose }) {
    const creatures = Object.values(selectCustomCreatures(db));
    const [search, setSearch] = useState('');
    const filtered = creatures.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3100 }}
            onClick={onClose}>
            <div style={{ background: '#1e1e21', border: '1px solid #c9a86c', borderRadius: 8, width: 'min(420px, 95vw)', maxHeight: '70vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
                onClick={e => e.stopPropagation()}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0, color: '#f5deb3' }}>Give to Creature</h3>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#888', fontSize: '1.4em', cursor: 'pointer' }}>×</button>
                </div>
                <div style={{ padding: '8px 16px', borderBottom: '1px solid #222' }}>
                    <input className="modal-input" placeholder="Search creatures..." value={search} onChange={e => setSearch(e.target.value)} style={{ width: '100%' }} autoFocus />
                </div>
                <div style={{ overflowY: 'auto', flex: 1 }}>
                    {filtered.length === 0 && (
                        <div style={{ color: '#555', textAlign: 'center', padding: 24, fontSize: '0.9em' }}>
                            No custom creatures found.<br />Create one in the Bestiary tab first.
                        </div>
                    )}
                    {filtered.map(c => (
                        <div key={c.id} onClick={() => onPick(c.id)}
                            style={{ padding: '9px 16px', cursor: 'pointer', borderBottom: '1px solid #222', color: '#ddd', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span>{c.name}</span>
                            <span style={{ color: '#888', fontSize: '0.8em' }}>{c.type || 'npc'}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

// ── Shared preview body (used in both desktop panel and mobile BottomSheet) ────
function AbilityPreviewContent({ selected, setAbilityForm, copyRef, showToast, setCreaturePicker }) {
    return (
        <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                <h4 style={{ color: '#f5deb3', margin: 0 }}>{selected.name}</h4>
                <div style={{ display: 'flex', gap: 6 }}>
                    {selected.isCustom && (
                        <button onClick={() => setAbilityForm({ ...selected })} title="Edit"
                            style={{ background: 'none', border: 'none', color: '#c9a86c', cursor: 'pointer', fontSize: '1.1em' }}>✏️</button>
                    )}
                    <button onClick={() => { copyRef('ability', selected); showToast('Reference copied'); }} title="Copy Reference"
                        style={{ background: 'none', border: 'none', color: '#c9a86c', cursor: 'pointer', fontSize: '1.1em' }}>📎</button>
                    <button onClick={() => setCreaturePicker(selected)} title="Give to Creature"
                        style={{ background: 'none', border: 'none', color: '#c9a86c', cursor: 'pointer', fontSize: '1.1em' }}>🐉</button>
                </div>
            </div>
            <div style={{ color: '#888', fontSize: '0.8em', marginBottom: 8 }}>
                {selected.typeCode === 'P' ? 'Passive' : selected.typeCode === 'R' ? 'Reaction' : selected.typeCode === 'F' ? 'Free Action' : `${selected.typeCode} Action(s)`}
                {selected.category ? ` · ${selected.category}` : ''}
                {selected.isCustom && <span style={{ color: '#c9a86c', marginLeft: 6 }}>★ Custom</span>}
            </div>
            {(selected.traits || []).length > 0 && (
                <div style={{ marginBottom: 10 }}>
                    {selected.traits.map(t => (
                        <span key={t} style={{ display: 'inline-block', padding: '2px 6px', marginRight: 4, marginBottom: 4, borderRadius: 3, background: '#555', color: '#fff', fontSize: '0.75em' }}>{t}</span>
                    ))}
                </div>
            )}
            <div style={{ color: '#ccc', fontSize: '0.85em', lineHeight: 1.6 }} dangerouslySetInnerHTML={{ __html: parseFoundry(selected.description) }} />
        </>
    );
}

// ── Main View ─────────────────────────────────────────────────────────────────
export default function AbilitiesView({ db, setDb }) {
    const { dataActions } = useCampaign();
    const { isMobile } = useWindowSize();

    // Merge indexed abilities with custom db abilities (custom takes priority by name)
    const allAbilities = useMemo(() => {
        const indexed = getAllAbilities();
        const custom  = selectCustomAbilityList(db);
        const customNames = new Set(custom.map(a => a.name));
        return [...custom, ...indexed.filter(a => !customNames.has(a.name))];
    }, [db]);

    const [search, setSearch]           = useState('');
    const [typeFilter, setTypeFilter]   = useState(null);
    const [traitFilter, setTraitFilter] = useState([]);
    const [selected, setSelected]       = useState(null);
    const [page, setPage]               = useState(1);
    const [contextMenu, setContextMenu] = useState(null); // { x, y, ability }
    const [abilityForm, setAbilityForm] = useState(null); // ability object | null
    const [creaturePicker, setCreaturePicker] = useState(null); // ability | null
    const [toast, setToast]             = useState(null); // { msg, key }
    const runDataAction = (action) => {
        Promise.resolve(action).catch(err => {
            console.error(err);
            alert(err?.message || String(err));
        });
    };

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return allAbilities.filter(a => {
            if (typeFilter && a.typeCode !== typeFilter) return false;
            if (traitFilter.length && !traitFilter.every(t => a.traits.includes(t))) return false;
            if (q && !a.name.toLowerCase().includes(q)) return false;
            return true;
        });
    }, [allAbilities, typeFilter, traitFilter, search]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const safePage   = Math.min(page, totalPages);
    const pageItems  = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

    // ── Toasts ──────────────────────────────────────────────────────────────
    const showToast = (msg) => {
        const key = Date.now();
        setToast({ msg, key });
        setTimeout(() => setToast(t => t?.key === key ? null : t), 2200);
    };

    // ── Custom Ability CRUD ─────────────────────────────────────────────────
    const saveCustomAbility = (ability) => {
        const saved = { ...ability, isCustom: true };
        runDataAction(dataActions.globalContent.saveCustomAbility(saved));
        setAbilityForm(null);
        setSelected(saved);
    };

    const deleteCustomAbility = (ability) => {
        if (!window.confirm(`Delete "${ability.name}"? This cannot be undone.`)) return;
        runDataAction(dataActions.globalContent.deleteCustomAbility(ability));
        if (selected?.id === ability.id) setSelected(null);
        setContextMenu(null);
    };

    const cloneAbility = (ability) => {
        const clone = { ...ability, id: `custom-${Date.now()}`, name: `${ability.name} (Copy)`, isCustom: true };
        runDataAction(dataActions.globalContent.saveCustomAbility(clone));
        setSelected(clone);
        setContextMenu(null);
        showToast(`Cloned "${clone.name}"`);
    };

    // ── Give to Creature ────────────────────────────────────────────────────
    const giveAbilityToCreature = (ability, creatureId) => {
        runDataAction(dataActions.bestiary.updateCustomCreature(creatureId, entry => ({
            ...entry,
            data: { ...entry.data, items: [...(entry.data?.items || []), buildFoundryItem(ability)] }
        })));
        const creatureName = db?.bestiary?.customCreatures?.[creatureId]?.name || 'creature';
        showToast(`"${ability.name}" added to ${creatureName}`);
        setCreaturePicker(null);
        setContextMenu(null);
    };

    // ── Context Menu ─────────────────────────────────────────────────────────
    const handleContextMenu = (e, ability) => {
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY, ability });
    };

    const closeContextMenu = () => setContextMenu(null);

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
            onClick={closeContextMenu}>

            {/* Toolbar */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10, flexShrink: 0 }}>
                <input
                    className="modal-input"
                    placeholder="Search abilities..."
                    value={search}
                    onChange={e => { setSearch(e.target.value); setPage(1); }}
                    style={{ flex: 1, minWidth: 150 }}
                />
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {TYPE_TABS.map(tab => (
                        <button key={tab.code ?? 'all'} onClick={() => { setTypeFilter(tab.code); setPage(1); }}
                            style={{ padding: '4px 10px', border: '1px solid #444', borderRadius: 4, cursor: 'pointer', fontSize: '0.8em', background: typeFilter === tab.code ? '#c9a86c' : '#2a2a2a', color: typeFilter === tab.code ? '#111' : '#ccc' }}>
                            {tab.label}
                        </button>
                    ))}
                </div>
                <MultiSelectDropdown label="Traits" options={ABILITY_INDEX_FILTER_OPTIONS.traits} selected={traitFilter} onChange={v => { setTraitFilter(v); setPage(1); }} />
                <span style={{ color: '#555', fontSize: '0.8em', whiteSpace: 'nowrap' }}>{filtered.length} abilities</span>
                <button className="set-btn" onClick={() => setAbilityForm(newBlankAbility())}
                    style={{ padding: '5px 12px', fontSize: '0.85em', marginLeft: 'auto', whiteSpace: 'nowrap' }}>
                    + New Ability
                </button>
            </div>

            {/* Content: list + preview */}
            <div style={{ flex: 1, display: 'flex', gap: 12, overflow: 'hidden' }}>
                {/* List */}
                <div style={{ flex: 1, overflowY: 'auto', background: '#1a1a1a', borderRadius: 6 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85em' }}>
                        <thead>
                            <tr style={{ position: 'sticky', top: 0, background: '#1e1e21', borderBottom: '1px solid #333' }}>
                                <th style={{ padding: '6px 12px', textAlign: 'center', color: '#888', width: 50 }}>Type</th>
                                <th style={{ padding: '6px 12px', textAlign: 'left', color: '#888' }}>Name</th>
                                <th style={{ padding: '6px 12px', textAlign: 'left', color: '#888' }}>Traits</th>
                            </tr>
                        </thead>
                        <tbody>
                            {pageItems.map(a => (
                                <tr key={a.id ?? a.name}
                                    onClick={() => setSelected(a)}
                                    onContextMenu={e => handleContextMenu(e, a)}
                                    style={{ cursor: 'pointer', borderBottom: '1px solid #222', background: selected?.name === a.name ? '#2c2c1e' : 'transparent' }}>
                                    <td style={{ padding: '5px 12px', color: '#888', textAlign: 'center' }}>
                                        {a.isCustom && <span title="Custom" style={{ color: '#c9a86c', marginRight: 4, fontSize: '0.7em' }}>★</span>}
                                        {typeLabel(a.typeCode)}
                                    </td>
                                    <td style={{ padding: '5px 12px', color: '#ddd' }}>{a.name}</td>
                                    <td style={{ padding: '5px 12px', color: '#666', fontSize: '0.8em' }}>
                                        {(a.traits || []).slice(0, 4).join(', ')}{(a.traits || []).length > 4 ? '…' : ''}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {allAbilities.length === 0 && (
                        <div style={{ color: '#555', textAlign: 'center', padding: 40 }}>
                            No abilities indexed yet.<br />Run <code>npm run build:abilities</code> to build the index.
                        </div>
                    )}
                    {totalPages > 1 && (
                        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, padding: '8px 0', borderTop: '1px solid #222' }}>
                            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={safePage === 1}
                                style={{ padding: '3px 10px', background: '#2a2a2a', border: '1px solid #444', color: '#ccc', cursor: 'pointer', borderRadius: 3 }}>‹</button>
                            <span style={{ color: '#888', fontSize: '0.85em' }}>Page {safePage} / {totalPages}</span>
                            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={safePage === totalPages}
                                style={{ padding: '3px 10px', background: '#2a2a2a', border: '1px solid #444', color: '#ccc', cursor: 'pointer', borderRadius: 3 }}>›</button>
                        </div>
                    )}
                </div>

                {/* Desktop: preview panel */}
                {!isMobile && (
                    <div style={{ width: 360, overflowY: 'auto', background: '#1a1a1a', borderRadius: 6, padding: 16, flexShrink: 0 }}>
                        {selected ? <AbilityPreviewContent selected={selected} setAbilityForm={setAbilityForm} copyRef={copyRef} showToast={showToast} setCreaturePicker={setCreaturePicker} /> : (
                            <div style={{ color: '#444', textAlign: 'center', marginTop: 40 }}>
                                Click a row to preview.<br />Right-click for options.
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Mobile: preview BottomSheet */}
            {isMobile && (
                <BottomSheet isOpen={!!selected} onClose={() => setSelected(null)} title={selected?.name || ''} height="70vh">
                    <div style={{ padding: '8px 16px', overflowY: 'auto', height: '100%' }}>
                        {selected && <AbilityPreviewContent selected={selected} setAbilityForm={setAbilityForm} copyRef={copyRef} showToast={showToast} setCreaturePicker={setCreaturePicker} />}
                    </div>
                </BottomSheet>
            )}

            {/* Context Menu */}
            {contextMenu && (
                <div style={{ position: 'fixed', top: contextMenu.y, left: contextMenu.x, background: '#2b2b2e', border: '1px solid #c5a059', borderRadius: 4, zIndex: 2000, minWidth: 180, boxShadow: '0 2px 10px rgba(0,0,0,0.5)' }}
                    onClick={e => e.stopPropagation()}>
                    <div className="ctx-item" style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #333' }}
                        onClick={() => { copyRef('ability', contextMenu.ability); showToast('Reference copied'); closeContextMenu(); }}>
                        📎 Copy Reference
                    </div>
                    <div className="ctx-item" style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #333' }}
                        onClick={() => { setCreaturePicker(contextMenu.ability); closeContextMenu(); }}>
                        🐉 Give to Creature
                    </div>
                    <div className="ctx-item" style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #333' }}
                        onClick={() => cloneAbility(contextMenu.ability)}>
                        📋 Clone
                    </div>
                    {contextMenu.ability.isCustom && (<>
                        <div className="ctx-item" style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #333' }}
                            onClick={() => { setAbilityForm({ ...contextMenu.ability }); closeContextMenu(); }}>
                            ✏️ Edit
                        </div>
                        <div className="ctx-item" style={{ padding: '8px 12px', cursor: 'pointer', color: '#e57373' }}
                            onClick={() => deleteCustomAbility(contextMenu.ability)}>
                            🗑️ Delete
                        </div>
                    </>)}
                    {/* Backdrop */}
                    <div style={{ position: 'fixed', inset: 0, zIndex: -1 }} onClick={closeContextMenu} />
                </div>
            )}

            {/* Ability Form Modal */}
            {abilityForm && <AbilityFormModal initial={abilityForm} onSave={saveCustomAbility} onClose={() => setAbilityForm(null)} />}

            {/* Creature Picker Modal */}
            {creaturePicker && (
                <CreaturePickerModal
                    db={db}
                    onPick={(creatureId) => giveAbilityToCreature(creaturePicker, creatureId)}
                    onClose={() => setCreaturePicker(null)}
                />
            )}

            {/* Toast */}
            {toast && (
                <div style={{ position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)', background: '#2b2b2e', border: '1px solid #c9a86c', color: '#f5deb3', padding: '8px 20px', borderRadius: 6, zIndex: 4000, fontSize: '0.9em', pointerEvents: 'none' }}>
                    {toast.msg}
                </div>
            )}
        </div>
    );
}
