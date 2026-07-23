import React, { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { getAllAbilities, ABILITY_INDEX_FILTER_OPTIONS } from '../shared/catalog/abilityIndex';
import { normalizeAbilityCatalogEntry } from '../shared/catalog/abilityModel';
import { parseFoundry } from '../shared/utils/foundryParser';
import MultiSelectDropdown from '../shared/components/MultiSelectDropdown';
import BottomSheet from '../shared/components/BottomSheet';
import { useWindowSize } from '../shared/hooks/useWindowSize';
import { copyRef } from '../shared/clipboard/refClipboard';
import { useCampaign } from '../shared/context/CampaignContext';
import { useAppFeedback } from '../shared/feedback/AppFeedback';
import { selectCustomCreature, selectCustomCreatures } from '../shared/db/selectors/bestiarySelectors';
import { buildHideOverride, CATALOG_ENTRY_STATUS } from '../shared/catalog/catalogEntryModel';
import { selectCatalogEntryStates } from '../shared/db/selectors/catalogOverrideSelectors';
import {
    buildCatalogEditorOverride,
    buildCatalogSafeId,
    CATALOG_EDITOR_MODES,
} from '../shared/catalog/catalogEditorContract';
import { AdminPagination, AdminTableSurface, AdminTableToolbar } from './components/table';
import FormDialog from '../shared/components/dialogs/FormDialog';
import PickerDialog from '../shared/components/dialogs/PickerDialog';

const DEFAULT_PAGE_SIZE = 100;

const TYPE_OPTIONS = [
    { code: 'P', label: 'Passive' },
    { code: 'R', label: 'Reaction' },
    { code: 'F', label: 'Free Action' },
    { code: '1', label: '1 Action' },
    { code: '2', label: '2 Actions' },
    { code: '3', label: '3 Actions' },
];

function typeLabel(typeCode) {
    if (typeCode === 'P') return '-';
    if (typeCode === 'R') return 'R';
    if (typeCode === 'F') return 'F';
    return `${typeCode}A`;
}

function typeCodeToSystem(typeCode) {
    if (typeCode === 'P') return { actionType: { value: 'passive' }, actions: { value: null } };
    if (typeCode === 'R') return { actionType: { value: 'reaction' }, actions: { value: null } };
    if (typeCode === 'F') return { actionType: { value: 'free' }, actions: { value: null } };
    return { actionType: { value: 'action' }, actions: { value: parseInt(typeCode, 10) || 1 } };
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
    return {
        id: `custom-${Date.now()}`,
        name: '',
        typeCode: 'P',
        traits: [],
        category: '',
        description: '',
        isCustom: true,
        editorMode: CATALOG_EDITOR_MODES.CREATE,
    };
}

function AbilityFormModal({ initial, onSave, onClose }) {
    const [form, setForm] = useState(initial);
    const set = (key, value) => setForm(prev => ({ ...prev, [key]: value }));
    const valid = form.name.trim().length > 0;

    return (
        <FormDialog
            open
            onOpenChange={(open) => { if (!open) onClose?.(); }}
            layerId="ability-editor"
            title={initial.editorMode === CATALOG_EDITOR_MODES.CREATE || !initial.name ? 'New Ability' : 'Edit Ability'}
            description="Configure the ability and its action metadata."
            size="md"
            submitLabel="Save"
            submitDisabled={!valid}
            onSubmit={() => valid && onSave(form)}
            cancelLabel="Cancel"
        >
                <div className="flex flex-col gap-3">
                    <div>
                        <label style={{ color: '#888', fontSize: '0.8em', display: 'block', marginBottom: 4 }}>Name *</label>
                        <input className="modal-input" value={form.name} onChange={event => set('name', event.target.value)} style={{ width: '100%' }} autoFocus />
                    </div>
                    <div style={{ display: 'flex', gap: 10 }}>
                        <div style={{ flex: 1 }}>
                            <label style={{ color: '#888', fontSize: '0.8em', display: 'block', marginBottom: 4 }}>Action Type</label>
                            <select className="modal-input" value={form.typeCode} onChange={event => set('typeCode', event.target.value)} style={{ width: '100%' }}>
                                {TYPE_OPTIONS.map(option => <option key={option.code} value={option.code}>{option.label}</option>)}
                            </select>
                        </div>
                        <div style={{ flex: 1 }}>
                            <label style={{ color: '#888', fontSize: '0.8em', display: 'block', marginBottom: 4 }}>Category</label>
                            <input className="modal-input" value={form.category} onChange={event => set('category', event.target.value)} placeholder="optional" style={{ width: '100%' }} />
                        </div>
                    </div>
                    <div>
                        <label style={{ color: '#888', fontSize: '0.8em', display: 'block', marginBottom: 4 }}>Traits</label>
                        <MultiSelectDropdown
                            label="Add traits..."
                            options={ABILITY_INDEX_FILTER_OPTIONS.traits}
                            selected={form.traits}
                            onChange={value => set('traits', value)}
                        />
                    </div>
                    <div>
                        <label style={{ color: '#888', fontSize: '0.8em', display: 'block', marginBottom: 4 }}>Description (HTML allowed)</label>
                        <textarea
                            className="modal-input"
                            value={form.description}
                            onChange={event => set('description', event.target.value)}
                            style={{ width: '100%', minHeight: 120, resize: 'vertical', fontFamily: 'monospace', fontSize: '0.85em' }}
                        />
                    </div>
                </div>
        </FormDialog>
    );
}

function CreaturePickerModal({ db, onPick, onClose }) {
    const creatures = Object.values(selectCustomCreatures(db));
    const [search, setSearch] = useState('');
    const filtered = creatures.filter(creature => creature.name.toLowerCase().includes(search.toLowerCase()));

    return (
        <PickerDialog open onOpenChange={(open) => { if (!open) onClose?.(); }} layerId="ability-creature-picker" title="Give to Creature" description="Select a custom creature." size="sm" showConfirm={false} cancelLabel="Cancel" bodyClassName="flex min-h-0 flex-col p-0">
                <div style={{ padding: '8px 16px', borderBottom: '1px solid #222' }}>
                    <input className="modal-input" placeholder="Search creatures..." value={search} onChange={event => setSearch(event.target.value)} style={{ width: '100%' }} autoFocus />
                </div>
                <div style={{ overflowY: 'auto', flex: 1 }}>
                    {filtered.length === 0 && (
                        <div style={{ color: '#555', textAlign: 'center', padding: 24, fontSize: '0.9em' }}>
                            No custom creatures found.<br />Create one in the Bestiary tab first.
                        </div>
                    )}
                    {filtered.map(creature => (
                        <div
                            key={creature.id}
                            onClick={() => onPick(creature.id)}
                            style={{ padding: '9px 16px', cursor: 'pointer', borderBottom: '1px solid #222', color: '#ddd', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                        >
                            <span>{creature.name}</span>
                            <span style={{ color: '#888', fontSize: '0.8em' }}>{creature.type || 'npc'}</span>
                        </div>
                    ))}
                </div>
        </PickerDialog>
    );
}

function AbilityPreviewContent({ selected, setAbilityForm, copyRef, showToast, setCreaturePicker }) {
    return (
        <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                <h4 style={{ color: '#f5deb3', margin: 0 }}>{selected.name}</h4>
                <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => setAbilityForm({ ...selected, editorMode: CATALOG_EDITOR_MODES.EDIT })} title="Edit" style={{ background: 'none', border: 'none', color: '#c9a86c', cursor: 'pointer', fontSize: '1.1em' }}>Edit</button>
                    <button onClick={() => { copyRef('ability', selected); showToast('Reference copied'); }} title="Copy Reference" style={{ background: 'none', border: 'none', color: '#c9a86c', cursor: 'pointer', fontSize: '1.1em' }}>Ref</button>
                    <button onClick={() => setCreaturePicker(selected)} title="Give to Creature" style={{ background: 'none', border: 'none', color: '#c9a86c', cursor: 'pointer', fontSize: '1.1em' }}>Give</button>
                </div>
            </div>
            <div style={{ color: '#888', fontSize: '0.8em', marginBottom: 8 }}>
                {selected.typeCode === 'P' ? 'Passive' : selected.typeCode === 'R' ? 'Reaction' : selected.typeCode === 'F' ? 'Free Action' : `${selected.typeCode} Action(s)`}
                {selected.category ? ` - ${selected.category}` : ''}
                {selected.isCustom && <span style={{ color: '#c9a86c', marginLeft: 6 }}>Custom</span>}
            </div>
            {(selected.traits || []).length > 0 && (
                <div style={{ marginBottom: 10 }}>
                    {selected.traits.map(trait => (
                        <span key={trait} style={{ display: 'inline-block', padding: '2px 6px', marginRight: 4, marginBottom: 4, borderRadius: 3, background: '#555', color: '#fff', fontSize: '0.75em' }}>{trait}</span>
                    ))}
                </div>
            )}
            <div style={{ color: '#ccc', fontSize: '0.85em', lineHeight: 1.6 }} dangerouslySetInnerHTML={{ __html: parseFoundry(selected.description) }} />
        </>
    );
}

export default function AbilitiesView({ db }) {
    const { dataActions } = useCampaign();
    const { confirm, notifyError } = useAppFeedback();
    const { isMobile } = useWindowSize();

    const allAbilities = useMemo(() => {
        return selectCatalogEntryStates(getAllAbilities(), db, 'ability')
            .map(state => normalizeAbilityEntry(state.effective || state.entry, state))
            .filter(Boolean);
    }, [db]);

    const [search, setSearch] = useState('');
    const [typeFilter, setTypeFilter] = useState(null);
    const [traitFilter, setTraitFilter] = useState([]);
    const [statusFilter, setStatusFilter] = useState([]);
    const [selected, setSelected] = useState(null);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
    const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' });
    const [filterOpen, setFilterOpen] = useState(false);
    const [focusFilterId, setFocusFilterId] = useState(null);
    const [visibleColumnKeys, setVisibleColumnKeys] = useState(['typeCode', 'name', 'traits', 'catalogStatusLabel']);
    const [abilityForm, setAbilityForm] = useState(null);
    const [creaturePicker, setCreaturePicker] = useState(null);
    const [toast, setToast] = useState(null);

    const runDataAction = (action) => {
        Promise.resolve(action).catch(error => {
            console.error(error);
            notifyError(error);
        });
    };

    const tableFilters = useMemo(() => ([
        { id: 'typeCode', label: 'Type', options: TYPE_OPTIONS.map(option => ({ value: option.code, label: option.label })) },
        { id: 'traits', label: 'Traits', options: ABILITY_INDEX_FILTER_OPTIONS.traits },
        { id: 'catalogStatus', label: 'Status', options: ['Original', 'Edited', 'Custom', 'Deleted'] },
    ]), []);

    const tableFilterValues = useMemo(() => ({
        typeCode: typeFilter ? [typeFilter] : [],
        traits: traitFilter,
        catalogStatus: statusFilter,
    }), [typeFilter, traitFilter, statusFilter]);

    const setTableFilterValues = (values = {}) => {
        setTypeFilter(values.typeCode?.[0] || null);
        setTraitFilter(values.traits || []);
        setStatusFilter(values.catalogStatus || []);
        setPage(1);
    };

    const tableColumns = useMemo(() => ([
        { key: 'typeCode', label: 'Type' },
        { key: 'name', label: 'Name' },
        { key: 'traits', label: 'Traits' },
        { key: 'catalogStatusLabel', label: 'Status' },
    ]), []);

    const visibleColumns = useMemo(
        () => tableColumns.filter(column => visibleColumnKeys.includes(column.key)),
        [tableColumns, visibleColumnKeys]
    );

    const filtered = useMemo(() => {
        const query = search.trim().toLowerCase();
        return allAbilities.filter(ability => {
            if (typeFilter && ability.typeCode !== typeFilter) return false;
            if (traitFilter.length && !traitFilter.every(trait => ability.traits.includes(trait))) return false;
            if (statusFilter.length) {
                if (!statusFilter.includes(ability.catalogStatusLabel)) return false;
            } else if (ability.catalogEntryStatus === CATALOG_ENTRY_STATUS.DELETED) {
                return false;
            }
            return !query || ability.name.toLowerCase().includes(query);
        });
    }, [allAbilities, typeFilter, traitFilter, statusFilter, search]);

    const sorted = useMemo(() => {
        const items = [...filtered];
        items.sort((a, b) => {
            const aValue = getAbilitySortValue(a, sortConfig.key);
            const bValue = getAbilitySortValue(b, sortConfig.key);
            if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
            return (a.name || '').localeCompare(b.name || '');
        });
        return items;
    }, [filtered, sortConfig]);

    const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
    const safePage = Math.min(page, totalPages);
    const pageItems = sorted.slice((safePage - 1) * pageSize, safePage * pageSize);

    const showToast = (msg) => {
        const key = Date.now();
        setToast({ msg, key });
        setTimeout(() => setToast(current => current?.key === key ? null : current), 2200);
    };

    const saveCustomAbility = (ability) => {
        const editorMode = abilityForm?.editorMode || (abilityForm?.isCustom ? CATALOG_EDITOR_MODES.EDIT : CATALOG_EDITOR_MODES.CREATE);
        const saved = { ...ability, isCustom: editorMode !== CATALOG_EDITOR_MODES.EDIT || Boolean(abilityForm?.isCustom) };
        runDataAction(dataActions.catalog.saveCatalogOverride(buildAbilityOverride(saved, abilityForm, {
            editorMode,
            baseEntry: abilityForm,
        })));
        setAbilityForm(null);
        setSelected(saved);
    };

    const deleteAbility = async (ability) => {
        const isCustom = ability.catalogEntryStatus === CATALOG_ENTRY_STATUS.CUSTOM || (ability.isCustom && !ability.overrideSourceFile && !ability.sourceFile);
        const confirmed = await confirm({
            title: 'Delete ability',
            message: isCustom
                ? `Delete custom ability "${ability.name}"?`
                : `Hide static ability "${ability.name}" from default catalog lists?`,
            confirmLabel: 'Delete',
            danger: true,
        });
        if (!confirmed) return;
        if (isCustom && ability.catalogOverrideId) {
            runDataAction(dataActions.catalog.deleteCatalogOverride(ability.catalogOverrideId));
        } else if (isCustom) {
            runDataAction(dataActions.globalContent.deleteCustomAbility(ability));
        } else {
            runDataAction(dataActions.catalog.saveCatalogOverride(buildHideOverride('ability', ability)));
        }
        if (selected?.id === ability.id) setSelected(null);
    };

    const cloneAbility = (ability) => {
        const clone = { ...ability, id: `custom-${Date.now()}`, name: `${ability.name} (Copy)`, isCustom: true };
        runDataAction(dataActions.catalog.saveCatalogOverride(buildAbilityOverride(clone, ability, {
            editorMode: CATALOG_EDITOR_MODES.CLONE,
        })));
        setSelected(clone);
        showToast(`Cloned "${clone.name}"`);
    };

    const giveAbilityToCreature = (ability, creatureId) => {
        runDataAction(dataActions.bestiary.updateCustomCreature(creatureId, entry => ({
            ...entry,
            data: { ...entry.data, items: [...(entry.data?.items || []), buildFoundryItem(ability)] },
        })));
        const creatureName = selectCustomCreature(db, creatureId)?.name || 'creature';
        showToast(`"${ability.name}" added to ${creatureName}`);
        setCreaturePicker(null);
    };

    const getAbilityRowActions = (ability) => ([
        { id: 'copy-reference', label: 'Copy Reference', onSelect: () => { copyRef('ability', ability); showToast('Reference copied'); } },
        { id: 'give-to-creature', label: 'Give to Creature', onSelect: () => setCreaturePicker(ability) },
        { id: 'clone', label: 'Clone', onSelect: () => cloneAbility(ability) },
        { id: 'edit', label: 'Edit', onSelect: () => setAbilityForm({ ...ability, editorMode: CATALOG_EDITOR_MODES.EDIT }) },
        { id: 'delete', label: 'Delete', danger: true, onSelect: () => deleteAbility(ability) },
    ]);

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <AdminTableToolbar
                search={search}
                onSearchChange={(value) => { setSearch(value); setPage(1); }}
                searchPlaceholder="Search abilities..."
                filters={tableFilters}
                filterValues={tableFilterValues}
                onFilterValuesChange={setTableFilterValues}
                filterOpen={filterOpen}
                onFilterOpenChange={setFilterOpen}
                focusFilterId={focusFilterId}
                columns={tableColumns}
                visibleColumns={visibleColumnKeys}
                onVisibleColumnsChange={setVisibleColumnKeys}
                resultMeta={`${sorted.length} abilities`}
                primaryActions={(
                    <Button type="button" onClick={() => setAbilityForm(newBlankAbility())}>
                        + New Ability
                    </Button>
                )}
            />

            <div style={{ flex: 1, display: 'flex', gap: 12, minHeight: 0, overflow: 'hidden' }}>
                <div style={{ flex: 1, display: 'flex', minWidth: 0, flexDirection: 'column', overflow: 'hidden' }}>
                    <AdminTableSurface
                        columns={visibleColumns}
                        rows={pageItems}
                        getRowKey={(row) => row.id ?? row.name}
                        sortConfig={sortConfig}
                        onSort={(key) => setSortConfig(prev => ({
                            key,
                            direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
                        }))}
                        onHeaderFilter={(column) => {
                            const filterId = column.key === 'catalogStatusLabel' ? 'catalogStatus' : column.key;
                            if (tableFilters.some(filter => filter.id === filterId)) {
                                setFocusFilterId(filterId);
                                setFilterOpen(true);
                            }
                        }}
                        isRowSelected={(row) => selected?.id === row.id}
                        onRowClick={(_event, row) => setSelected(row)}
                        onRowDoubleClick={(_event, row) => setAbilityForm({ ...row, editorMode: CATALOG_EDITOR_MODES.EDIT })}
                        getRowActions={getAbilityRowActions}
                        renderCell={({ row, column }) => renderAbilityCell(row, column)}
                        emptyLabel={allAbilities.length === 0 ? 'No abilities indexed yet. Run npm run build:abilities to build the index.' : 'No abilities found.'}
                    />
                    <AdminPagination
                        page={safePage}
                        totalPages={totalPages}
                        total={sorted.length}
                        pageSize={pageSize}
                        pageSizeOptions={[25, 50, 100]}
                        label="abilities"
                        onPageChange={setPage}
                        onPageSizeChange={(nextSize) => { setPageSize(nextSize); setPage(1); }}
                    />
                </div>

                {!isMobile && (
                    <div style={{ width: 360, overflowY: 'auto', background: '#1a1a1a', borderRadius: 6, padding: 16, flexShrink: 0 }}>
                        {selected ? (
                            <AbilityPreviewContent selected={selected} setAbilityForm={setAbilityForm} copyRef={copyRef} showToast={showToast} setCreaturePicker={setCreaturePicker} />
                        ) : (
                            <div style={{ color: '#444', textAlign: 'center', marginTop: 40 }}>
                                Click a row to preview.<br />Right-click for options.
                            </div>
                        )}
                    </div>
                )}
            </div>

            {isMobile && (
                <BottomSheet isOpen={!!selected} onClose={() => setSelected(null)} title={selected?.name || ''} height="70vh">
                    <div style={{ padding: '8px 16px', overflowY: 'auto', height: '100%' }}>
                        {selected && <AbilityPreviewContent selected={selected} setAbilityForm={setAbilityForm} copyRef={copyRef} showToast={showToast} setCreaturePicker={setCreaturePicker} />}
                    </div>
                </BottomSheet>
            )}

            {abilityForm && <AbilityFormModal initial={abilityForm} onSave={saveCustomAbility} onClose={() => setAbilityForm(null)} />}

            {creaturePicker && (
                <CreaturePickerModal
                    db={db}
                    onPick={(creatureId) => giveAbilityToCreature(creaturePicker, creatureId)}
                    onClose={() => setCreaturePicker(null)}
                />
            )}

            {toast && (
                <div style={{ position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)', background: '#2b2b2e', border: '1px solid #c9a86c', color: '#f5deb3', padding: '8px 20px', borderRadius: 6, zIndex: 4000, fontSize: '0.9em', pointerEvents: 'none' }}>
                    {toast.msg}
                </div>
            )}
        </div>
    );
}

function renderAbilityCell(ability, column) {
    if (column.key === 'typeCode') {
        return (
            <span className="inline-flex items-center gap-1 text-muted-foreground">
                {ability.isCustom ? <span title="Custom" className="text-primary">*</span> : null}
                {typeLabel(ability.typeCode)}
            </span>
        );
    }
    if (column.key === 'traits') {
        const traits = ability.traits || [];
        return <span className="text-muted-foreground">{traits.slice(0, 4).join(', ')}{traits.length > 4 ? '...' : ''}</span>;
    }
    if (column.key === 'catalogStatusLabel') {
        return <span className="text-muted-foreground">{ability.catalogStatusLabel}</span>;
    }
    return ability[column.key] ?? '-';
}

function getAbilitySortValue(ability, key) {
    if (key === 'traits') return (ability.traits || []).join(', ').toLowerCase();
    if (key === 'typeCode') return String(ability.typeCode || '').toLowerCase();
    return String(ability[key] ?? '').toLowerCase();
}

function normalizeAbilityEntry(ability, state) {
    const normalized = normalizeAbilityCatalogEntry(ability);
    if (!normalized) return null;
    const status = state?.status || ability.catalogEntryStatus || CATALOG_ENTRY_STATUS.ORIGINAL;
    return {
        ...normalized,
        catalogEntryStatus: status,
        catalogStatusLabel: status.charAt(0).toUpperCase() + status.slice(1),
        catalogOverrideId: normalized.catalogOverrideId || state?.overrideId || null,
        catalogEntryKey: normalized.catalogEntryKey || state?.key || null,
        isCustom: status === CATALOG_ENTRY_STATUS.CUSTOM || Boolean(normalized.isCustom),
        isOverride: status === CATALOG_ENTRY_STATUS.EDITED || Boolean(normalized.isOverride),
        isDeleted: status === CATALOG_ENTRY_STATUS.DELETED || Boolean(normalized.isDeleted),
    };
}

export function buildAbilityOverride(abilityRecord, initialAbility, options = {}) {
    const safeId = buildCatalogSafeId(abilityRecord?.id || initialAbility?.id || abilityRecord?.name || 'ability');
    return buildCatalogEditorOverride(options.catalogType || 'ability', {
        ...abilityRecord,
        id: safeId,
        _id: safeId,
    }, {
        formData: abilityRecord,
        initialItem: initialAbility,
        baseEntry: options.baseEntry,
        editorMode: options.editorMode,
        id: initialAbility?.catalogOverrideId || `ability_${safeId}`,
        label: abilityRecord?.name || initialAbility?.name || safeId,
    });
}
