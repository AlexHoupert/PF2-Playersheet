import React, { useState, useMemo } from 'react';
import RichTextEditor from '../shared/components/RichTextEditor';
import { useCampaign } from '../shared/context/CampaignContext';
import { useAppFeedback } from '../shared/feedback/AppFeedback';
import { copyRef } from '../shared/clipboard/refClipboard';
import { selectDeviantAbilityList } from '../shared/db/selectors/abilitySelectors';
import { selectPactUsageByAbility } from '../shared/db/selectors/pactSelectors';
import { buildDeviantAbilityClone, ELEMENTS, ELEMENT_NAMES, generateId } from './pactsData';
import { Button } from '@/components/ui/button';
import { AdminTableSurface, AdminTableToolbar } from '../admin/components/table';

const EMPTY_ABILITY = {
    id: '', name: '', element: 'Fire', level: 1,
    description: '',
    awakening1: { name: '', levelNote: '', description: '' },
    awakening2: { name: '', levelNote: '', description: '' },
};

export default function DeviantAbilitiesAdminView({ db }) {
    const { dataActions } = useCampaign();
    const { confirm, notifyError, notifySuccess } = useAppFeedback();
    const abilities = useMemo(() => selectDeviantAbilityList(db), [db]);
    const pactUsageByAbility = useMemo(() => selectPactUsageByAbility(db), [db]);

    const [search, setSearch] = useState('');
    const [filterEl, setFilterEl] = useState('');
    const [editing, setEditing] = useState(null);
    const [isNew, setIsNew] = useState(false);
    const [visibleColumnKeys, setVisibleColumnKeys] = useState(['name', 'element', 'level', 'pacts', 'awakenings', 'actions']);
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

    const editAbility = (ability) => {
        setIsNew(false);
        setEditing(cloneAbilityForEditor(ability));
    };

    const cloneAbility = (ability) => {
        setIsNew(true);
        setEditing(cloneAbilityForEditor(buildDeviantAbilityClone(ability)));
    };

    const copyAbilityReference = (ability) => {
        copyRef('deviantAbility', {
            ...ability,
            catalogType: 'deviantAbility',
            label: ability.name,
        });
        notifySuccess(`Reference copied: ${ability.name}`);
    };

    const setAwakening = (key, field, val) =>
        setEditing(prev => ({ ...prev, [key]: { ...(prev[key] || {}), [field]: val } }));

    const tableColumns = useMemo(() => [
        { key: 'name', label: 'Name' },
        { key: 'element', label: 'Element' },
        { key: 'level', label: 'Level' },
        { key: 'pacts', label: 'Pact(s)', sortable: false },
        { key: 'awakenings', label: 'Awakenings', sortable: false },
        { key: 'actions', label: 'Actions', sortable: false, filterable: false },
    ], []);

    const tableFilters = useMemo(() => [
        {
            id: 'element',
            label: 'Element',
            type: 'multi',
            options: ELEMENT_NAMES.map((element) => ({
                value: element,
                label: `${ELEMENTS[element]?.icon || ''} ${element}`.trim(),
            })),
            defaultValue: [],
        },
    ], []);

    const toolbarFilterValues = useMemo(() => ({
        element: filterEl ? [filterEl] : [],
    }), [filterEl]);

    const setToolbarFilterValues = (next) => {
        const elements = Array.isArray(next?.element) ? next.element : [];
        setFilterEl(elements[0] || '');
    };

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
        <div className="flex h-full flex-col gap-3 overflow-hidden p-4">
            <AdminTableToolbar
                search={search}
                onSearchChange={setSearch}
                searchPlaceholder="Search deviant abilities..."
                filters={tableFilters}
                filterValues={toolbarFilterValues}
                onFilterValuesChange={setToolbarFilterValues}
                columns={tableColumns}
                visibleColumns={visibleColumnKeys}
                onVisibleColumnsChange={setVisibleColumnKeys}
                resultMeta={`${visible.length} deviant abilities`}
                primaryActions={(
                    <Button type="button" size="sm" onClick={() => { setIsNew(true); setEditing(cloneAbilityForEditor(EMPTY_ABILITY)); }}>
                        + New Deviant Ability
                    </Button>
                )}
            />
            <AdminTableSurface
                columns={tableColumns.filter((column) => visibleColumnKeys.includes(column.key))}
                rows={visible}
                getRowKey={(ability) => ability.id || ability.name}
                getRowTestId={(ability) => `deviant-ability-row-${toTestId(ability.id || ability.name)}`}
                onRowDoubleClick={(_event, ability) => editAbility(ability)}
                renderCell={({ row: ability, column }) => renderDeviantAbilityCell({
                    ability,
                    column,
                    pactUsageByAbility,
                    editAbility,
                    cloneAbility,
                    copyAbilityReference,
                    del,
                })}
            />
        </div>
    );
}

function renderDeviantAbilityCell({
    ability,
    column,
    pactUsageByAbility,
    editAbility,
    cloneAbility,
    copyAbilityReference,
    del,
}) {
    if (column.key === 'element') {
        const element = ELEMENTS[ability.element] || ELEMENTS.Fire;
        return <span style={{ color: element.color }}>{element.icon} {ability.element}</span>;
    }
    if (column.key === 'pacts') return (pactUsageByAbility[ability.id] || []).join(', ') || '-';
    if (column.key === 'awakenings') {
        return `${[ability.awakening1?.name, ability.awakening2?.name].filter(Boolean).length}/2 defined`;
    }
    if (column.key === 'actions') {
        return (
            <div className="flex flex-wrap gap-1">
                <Button type="button" size="xs" variant="outline" onClick={(event) => { event.stopPropagation(); editAbility(ability); }}>Edit</Button>
                <Button type="button" size="xs" variant="outline" onClick={(event) => { event.stopPropagation(); cloneAbility(ability); }}>Clone</Button>
                <Button type="button" size="xs" variant="outline" onClick={(event) => { event.stopPropagation(); copyAbilityReference(ability); }}>Copy Reference</Button>
                <Button type="button" size="xs" variant="destructive" onClick={(event) => { event.stopPropagation(); del(ability.id); }}>Delete</Button>
            </div>
        );
    }
    return ability[column.key] ?? '-';
}

function cloneAbilityForEditor(ability = {}) {
    return {
        ...EMPTY_ABILITY,
        ...ability,
        awakening1: { ...(ability.awakening1 || {}) },
        awakening2: { ...(ability.awakening2 || {}) },
    };
}

function toTestId(value) {
    return String(value || 'entry')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'entry';
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
const actionButtonStyle = {
    padding: '4px 8px',
    background: '#222',
    border: '1px solid #555',
    color: '#ddd',
    borderRadius: 4,
    cursor: 'pointer',
    fontSize: '0.8em',
};
