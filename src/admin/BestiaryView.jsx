/**
 * BestiaryView - Admin panel for managing creatures and hazards
 * Features: List/filter/sort, CRUD operations, JSON import, reveal state management
 *
 * Architecture: Creature DATA comes from catalog (static JSON files),
 * while db only stores METADATA (group, bestiary visibility, revealState, falseData)
 */
import { useMemo, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useCampaign } from '../shared/context/CampaignContext';
import { useAppFeedback } from '../shared/feedback/AppFeedback';
import BottomSheet from '../shared/components/BottomSheet';
import CreatureCard from '../shared/components/CreatureCard';
import CreatureAbilityModal from '../shared/components/CreatureAbilityModal';
import CreatureSkillDetailDialog from '../shared/components/CreatureSkillDetailDialog';
import CreatureEditor from './editors/CreatureEditor';
import { useWindowSize } from '../shared/hooks/useWindowSize';
import { generateFalseData } from '../utils/bestiaryUtils';
import { deepClone } from '../shared/utils/deepClone';
import { getAllCreatures, fetchCreatureData } from '../shared/catalog/creatureIndex';
import { mergeCreatureDetailIntoEntry } from '../shared/catalog/catalogDetailMerge';
import { selectCustomAbilityList } from '../shared/db/selectors/abilitySelectors';
import { selectBestiaryCreatureMetadata, selectCustomCreatures } from '../shared/db/selectors/bestiarySelectors';
import { DEFAULT_CREATURE_REVEAL_STATE, buildBestiaryCreatureEntries } from '../shared/bestiary/creaturePresentation';
import { buildHideOverride } from '../shared/catalog/catalogEntryModel';
import { selectCatalogEntryStates } from '../shared/db/selectors/catalogOverrideSelectors';
import { AdminPagination, AdminTableSurface, AdminTableToolbar } from './components/table';
import { selectCampaignLoreArticles } from '../shared/db/selectors/loreSelectors';
import { selectLoreBacklinks } from '../shared/lore/loreSelectors';
import { useLoreAdminStore } from '../shared/lore/useLoreStores';

export default function BestiaryView({ db, initialFilterType, onContentLinkClick }) {
    const { activeCampaign, activeCampaignId, dataActions, dbMode } = useCampaign();
    const { confirm, notifyError, notifySuccess, prompt } = useAppFeedback();
    const { isMobile } = useWindowSize();
    const loreStore = useLoreAdminStore({
        campaignId: activeCampaignId,
        enabled: dbMode === 'firestore-v2',
        fallbackArticles: selectCampaignLoreArticles(activeCampaign, db),
        fallbackGroups: activeCampaign?.loreGroups || [],
        fallbackDeliveries: activeCampaign?.loreDeliveries || [],
        fallbackNotes: activeCampaign?.knowledgeNotes || [],
    });

    // ── Filter / search state ────────────────────────────────────────────────
    const [search, setSearch] = useState('');
    const [activeFilters, setActiveFilters] = useState(
        initialFilterType?.length ? { type: initialFilterType } : {}
    );

    useEffect(() => {
        setActiveFilters(prev => {
            if (initialFilterType?.length) return { ...prev, type: initialFilterType };
            const n = { ...prev }; delete n.type; return n;
        });
        setPage(1);
    }, [JSON.stringify(initialFilterType)]);

    // ── Pagination / sort / column state ────────────────────────────────────
    const [page, setPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(25);
    const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' });
    const [visibleColumns, setVisibleColumns] = useState(['name', 'level', 'type', 'group', 'bestiary']);
    const [filterOpen, setFilterOpen] = useState(false);
    const [focusFilterId, setFocusFilterId] = useState(null);

    // ── Selection / context menu / toast ────────────────────────────────────
    const [, setContextMenu] = useState(null);
    const [toast, setToast] = useState(null);

    const showToast = (msg) => {
        const key = Date.now();
        setToast({ msg, key });
        setTimeout(() => setToast(t => t?.key === key ? null : t), 2200);
    };
    const runDataAction = (action) => {
        Promise.resolve(action).catch(err => {
            console.error(err);
            notifyError(err);
        });
    };

    const copyCreatureRef = async (creature) => {
        const { copyRef } = await import('../shared/clipboard/refClipboard');
        copyRef('creature', creature);
        showToast('Reference copied');
    };

    const pasteAbilityToCreature = async (creature) => {
        const { getInMemoryRef } = await import('../shared/clipboard/refClipboard');
        const ref = getInMemoryRef();
        if (!ref || ref.type !== 'ability') { showToast('No ability reference in clipboard'); return; }
        const ability = ref.data;
        const foundryItem = {
            _id: `ability-${Date.now()}`,
            name: ability.name,
            type: 'action',
            img: '',
            system: {
                actionType: { value: ability.typeCode === 'P' ? 'passive' : ability.typeCode === 'R' ? 'reaction' : ability.typeCode === 'F' ? 'free' : 'action' },
                actions: { value: ['1', '2', '3'].includes(ability.typeCode) ? parseInt(ability.typeCode) : null },
                description: { value: ability.description || '' },
                traits: { value: ability.traits || [] },
            },
        };
        runDataAction(dataActions.bestiary.updateCustomCreature(creature.id, entry => ({
            ...entry,
            data: { ...entry.data, items: [...(entry.data?.items || []), foundryItem] }
        })));
        showToast(`"${ability.name}" added to ${creature.name}`);
        setContextMenu(null);
    };

    // ── Editor / preview state ───────────────────────────────────────────────
    const [editingCreature, setEditingCreature] = useState(null);
    const [previewCreature, setPreviewCreature] = useState(null);
    const [loadedCreatureData, setLoadedCreatureData] = useState(null);
    const [selectedAbility, setSelectedAbility] = useState(null);
    const [selectedSkill, setSelectedSkill] = useState(null);
    const loreBacklinks = useMemo(() => previewCreature?.id
        ? selectLoreBacklinks(loreStore.articles, 'creature', previewCreature.id)
        : [], [loreStore.articles, previewCreature?.id]);

    // Fetch full creature data when preview creature changes
    useEffect(() => {
        if (!previewCreature?.id) { setLoadedCreatureData(null); return; }
        if (previewCreature.isCustom) {
            const customData = selectCustomCreatures(db)[previewCreature.id]?.data;
            if (customData) {
                setLoadedCreatureData(mergeCreatureDetailIntoEntry(customData, previewCreature).data);
                return;
            }
            if (previewCreature.data) {
                setLoadedCreatureData(mergeCreatureDetailIntoEntry(previewCreature.data, previewCreature).data);
                return;
            }
        }
        fetchCreatureData(previewCreature.id).then(data => {
            if (data) setLoadedCreatureData(mergeCreatureDetailIntoEntry(data, previewCreature).data);
        });
    }, [previewCreature?.id, db]);

    // Fetch full creature data when editing creature changes
    useEffect(() => {
        if (!editingCreature?.id || editingCreature.data) return;
        if (editingCreature.isCustom) {
            const customData = selectCustomCreatures(db)[editingCreature.id]?.data;
            if (customData) {
                setEditingCreature(prev => mergeCreatureDetailIntoEntry(customData, prev));
                return;
            }
        }
        fetchCreatureData(editingCreature.id).then(data => {
            if (data) setEditingCreature(prev => mergeCreatureDetailIntoEntry(data, prev));
        });
    }, [editingCreature?.id, db]);

    // ── Data: merge index + custom creatures ─────────────────────────────────
    const creatures = useMemo(() => {
        return buildBestiaryCreatureEntries({
            entryStates: selectCatalogEntryStates(getAllCreatures(), db, 'creature'),
            metadata: selectBestiaryCreatureMetadata(db),
            includeUnpublished: true,
        });
    }, [db]);

    // ── Filter options ────────────────────────────────────────────────────────
    const uniqueTypes    = useMemo(() => ['creature', 'hazard'], []);
    const uniqueRarities = useMemo(() => ['common', 'uncommon', 'rare', 'unique'], []);
    const uniqueTraits   = useMemo(() => {
        const s = new Set(); creatures.forEach(c => c.traits?.forEach(t => s.add(t))); return [...s].sort();
    }, [creatures]);
    const uniqueGroups   = useMemo(() => {
        const s = new Set(); creatures.forEach(c => s.add(c.group || 'Uncategorized')); return [...s].sort();
    }, [creatures]);

    const tableFilters = useMemo(() => ([
        { id: 'type', label: 'Type', options: uniqueTypes },
        { id: 'rarity', label: 'Rarity', options: uniqueRarities },
        { id: 'traits', label: 'Traits', options: uniqueTraits },
        { id: 'group', label: 'Group', options: uniqueGroups },
        { id: 'CatalogStatus', label: 'Catalog Status', options: ['Original', 'Edited', 'Custom', 'Deleted'] },
        { id: 'bestiary', label: 'In Bestiary', type: 'boolean' },
    ]), [uniqueTypes, uniqueRarities, uniqueTraits, uniqueGroups]);

    // ── Filtering ────────────────────────────────────────────────────────────
    const filteredCreatures = useMemo(() => {
        const q = search.trim().toLowerCase();
        return creatures.filter(c => {
            const { type, rarity, traits, group, bestiary, CatalogStatus } = activeFilters;
            if (type?.length && !type.includes(c.type)) return false;
            if (rarity?.length && !rarity.includes(c.rarity)) return false;
            if (traits?.length && !traits.every(t => c.traits?.includes(t))) return false;
            if (group?.length && !group.includes(c.group)) return false;
            if (CatalogStatus?.length) {
                if (!CatalogStatus.includes(c.catalogStatusLabel)) return false;
            } else if (c.isDeleted) {
                return false;
            }
            if (bestiary === true && !c.bestiary) return false;
            if (bestiary === false && c.bestiary) return false;
            return !q || c.name.toLowerCase().includes(q);
        });
    }, [creatures, search, activeFilters]);

    // ── Sorting ──────────────────────────────────────────────────────────────
    const sortedCreatures = useMemo(() => {
        const items = [...filteredCreatures];
        items.sort((a, b) => {
            let valA = a[sortConfig.key];
            let valB = b[sortConfig.key];
            if (Array.isArray(valA)) valA = valA.join(', ');
            if (Array.isArray(valB)) valB = valB.join(', ');
            if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
            if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
            return a.id.localeCompare(b.id);
        });
        return items;
    }, [filteredCreatures, sortConfig]);

    const totalPages = useMemo(() => Math.max(1, Math.ceil(sortedCreatures.length / itemsPerPage)), [sortedCreatures.length, itemsPerPage]);
    const currentPage = Math.min(page, totalPages);
    const paginatedCreatures = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return sortedCreatures.slice(start, start + itemsPerPage);
    }, [currentPage, itemsPerPage, sortedCreatures]);

    useEffect(() => { if (page !== currentPage) setPage(currentPage); }, [currentPage, page]);

    // ── Handlers ─────────────────────────────────────────────────────────────
    const handleSort = (key) => {
        setSortConfig(prev => ({ key, direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc' }));
    };

    const handleRowClick = (creature) => {
        // Single click: open preview (desktop side panel)
        if (!isMobile) setPreviewCreature(creature);
    };

    const handleRowDoubleClick = (creature) => {
        if (isMobile) {
            // Mobile: double tap opens preview
            setPreviewCreature(creature);
        } else {
            // Desktop: double-click opens edit dialog
            handleEdit(creature);
        }
    };

    const handleDelete = async (creature) => {
        const confirmed = await confirm({
            title: 'Delete creature',
            message: creature?.isCustom
                ? `Delete custom creature "${creature.name}"?`
                : `Hide static creature "${creature?.name}" from default catalog lists?`,
            confirmLabel: 'Delete',
            danger: true,
        });
        if (!confirmed) return;
        const id = creature?.id;
        if (creature?.isCustom) {
            runDataAction(Promise.all([
                dataActions.bestiary.deleteCreature(id),
                creature.catalogOverrideId ? dataActions.catalog.deleteCatalogOverride(creature.catalogOverrideId) : Promise.resolve(),
            ]));
        } else {
            runDataAction(dataActions.catalog.saveCatalogOverride(buildHideOverride('creature', creature)));
        }
        setContextMenu(null);
        if (previewCreature?.id === id) setPreviewCreature(null);
    };

    const handleEdit = async (creature) => {
        if (creature.data) {
            setEditingCreature(mergeCreatureDetailIntoEntry(creature.data, { ...creature, editorMode: 'edit' }));
            setContextMenu(null);
            setPreviewCreature(null);
            return;
        }
        if (creature.isCustom) {
            const data = selectCustomCreatures(db)[creature.id]?.data;
            if (!data) {
                notifyError('Custom creature data not found in database');
                setContextMenu(null);
                return;
            }
            setEditingCreature(mergeCreatureDetailIntoEntry(data, { ...creature, editorMode: 'edit' }));
            setContextMenu(null);
            setPreviewCreature(null);
            return;
        }
        const data = await fetchCreatureData(creature.id);
        if (!data) {
            notifyError('Failed to load creature data');
            setContextMenu(null);
            return;
        }
        setEditingCreature(mergeCreatureDetailIntoEntry(data, { ...creature, editorMode: 'edit' }));
        setContextMenu(null);
        setPreviewCreature(null);
    };

    const handleClone = async (creature) => {
        const rawData = creature.data || (creature.isCustom
            ? selectCustomCreatures(db)[creature.id]?.data
            : await fetchCreatureData(creature.id));
        if (!rawData) {
            notifyError('Failed to load creature data');
            setContextMenu(null);
            return;
        }
        // Deep-copy so the clone shares no nested object references with the original
        const data = deepClone(mergeCreatureDetailIntoEntry(rawData, creature).data);
        setEditingCreature({
            ...creature, id: null, _id: null, catalogOverrideId: null, editorMode: 'clone',
            data: { ...data, _id: null, name: (data.name || creature.name) + ' (Copy)' }
        });
        setContextMenu(null);
        setPreviewCreature(null);
    };

    const toggleBestiary = (creature) => {
        const id = creature.id;
        runDataAction(dataActions.bestiary.updateCreatureMetadata(id, existing => {
            const hasMetadata = existing && (
                existing.group ||
                existing.revealState ||
                existing.falseData ||
                typeof existing.bestiary === 'boolean'
            );
            const newEntry = hasMetadata
                ? { ...existing, bestiary: !existing.bestiary }
                : {
                    id,
                    group: creature.group || 'Uncategorized',
                    bestiary: true,
                    revealState: { ...DEFAULT_CREATURE_REVEAL_STATE },
                    falseData: generateFalseData({ hp: 0, fortitude: 0, reflex: 0, will: 0, ac: 10, perception: 0 }, creature.level ?? 0)
                };
            return newEntry;
        }));
    };

    const handleSetGroup = async (creature) => {
        const newGroup = await prompt({
            title: 'Set creature group',
            message: 'Enter group name:',
            inputLabel: 'Group',
            initialValue: creature.group || 'Uncategorized',
            confirmLabel: 'Set group',
        });
        if (newGroup === null) return;
        const id = creature.id;
        runDataAction(dataActions.bestiary.updateCreatureMetadata(id, existing => {
            const hasMetadata = existing && (
                existing.group ||
                existing.revealState ||
                existing.falseData ||
                typeof existing.bestiary === 'boolean'
            );
            const newEntry = hasMetadata
                ? { ...existing, group: newGroup.trim() || 'Uncategorized' }
                : { id, group: newGroup.trim() || 'Uncategorized', bestiary: false, revealState: { ...DEFAULT_CREATURE_REVEAL_STATE } };
            return newEntry;
        }));
        setContextMenu(null);
    };

    const updateRevealState = (id, field, state) => {
        runDataAction(dataActions.bestiary.updateRevealState(id, field, state));
    };

    const [importingCatalog, setImportingCatalog] = useState(false);
    const handleInitMetadataFromCatalog = () => {
        setImportingCatalog(true);
        const catalogCreatures = getAllCreatures();
        const existingIds = new Set(Object.keys(selectBestiaryCreatureMetadata(db)));
        const metadataEntries = catalogCreatures.flatMap(creature => {
            if (existingIds.has(creature.id)) return [];
            const level = creature.data?.system?.details?.level?.value ?? 0;
            return [{
                id: creature.id, group: 'Uncategorized', bestiary: false,
                revealState: { ...DEFAULT_CREATURE_REVEAL_STATE },
                falseData: generateFalseData({ hp: 0, fortitude: 0, reflex: 0, will: 0, ac: 10, perception: 0 }, level)
            }];
        });
        runDataAction(dataActions.bestiary.initializeCreatureMetadata(metadataEntries));
        notifySuccess(`Initialized metadata for ${metadataEntries.length} creatures.`);
        setImportingCatalog(false);
    };

    const tableColumns = useMemo(() => ([
        { key: 'name', label: 'Name' },
        { key: 'level', label: 'Level' },
        { key: 'type', label: 'Type' },
        { key: 'group', label: 'Group' },
        { key: 'rarity', label: 'Rarity' },
        { key: 'traits', label: 'Traits' },
        { key: 'catalogStatusLabel', label: 'Catalog Status' },
        { key: 'bestiary', label: 'Bestiary' },
    ]), []);
    const visibleTableColumns = useMemo(
        () => tableColumns.filter(column => visibleColumns.includes(column.key)),
        [tableColumns, visibleColumns]
    );
    const getCreatureRowActions = (creature) => ([
        { id: 'copy-reference', label: 'Copy Reference', onSelect: () => copyCreatureRef(creature) },
        { id: 'set-group', label: 'Set Group', onSelect: () => handleSetGroup(creature) },
        creature.isCustom ? {
            id: 'paste-ability',
            label: 'Paste Referenced Ability',
            onSelect: () => pasteAbilityToCreature(creature),
        } : null,
        { id: 'edit', label: 'Edit', onSelect: () => handleEdit(creature) },
        { id: 'clone', label: 'Clone', onSelect: () => handleClone(creature) },
        { id: 'preview', label: 'Preview', onSelect: () => setPreviewCreature(creature) },
        { id: 'delete', label: 'Delete', danger: true, onSelect: () => handleDelete(creature) },
    ].filter(Boolean));

    // ── Render editor ─────────────────────────────────────────────────────────
    if (editingCreature) {
        return (
            <CreatureEditor
                initialCreature={editingCreature}
                catalogType="creature"
                editorMode={editingCreature.editorMode || (editingCreature.sourceFile || editingCreature.catalogOverrideId ? 'edit' : 'create')}
                baseEntry={editingCreature.editorMode === 'create' ? null : editingCreature}
                customAbilities={selectCustomAbilityList(db)}
                onSave={() => {
                    setEditingCreature(null);
                }}
                onCancel={() => setEditingCreature(null)}
                onSaveToDb={(creatureData) => {
                    return dataActions.bestiary.saveCustomCreature(creatureData);
                }}
                onSaveCatalogEntry={(override) => dataActions.catalog.saveCatalogOverride(override)}
            />
        );
    }

    // ── Preview panel content (shared between side panel and BottomSheet) ─────
    const previewContent = previewCreature ? (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Action bar inside preview */}
            <div style={{ display: 'flex', gap: 8, padding: isMobile ? '8px 16px' : '8px 0', borderBottom: '1px solid #333', flexShrink: 0, flexWrap: 'wrap' }}>
                <button
                    className="nav-btn"
                    style={{ background: '#4caf50', color: '#fff' }}
                    onClick={() => handleEdit(previewCreature)}
                >
                    ✏️ Edit
                </button>
                <button
                    className="nav-btn"
                    onClick={() => handleClone(previewCreature)}
                >
                    📋 Clone
                </button>
                <button
                    className="nav-btn"
                    onClick={() => copyCreatureRef(previewCreature)}
                >
                    📎 Copy Ref
                </button>
                <button
                    className="nav-btn"
                    disabled={!activeCampaignId}
                    onClick={() => Promise.resolve(dataActions.lore.notifyBestiaryReveal(activeCampaignId, {
                        id: previewCreature.id,
                        name: previewCreature.name,
                    })).then(() => notifySuccess('Party notified about this Bestiary update')).catch(notifyError)}
                >
                    Notify party
                </button>
                <button
                    className="nav-btn"
                    style={{ color: '#e57373' }}
                    onClick={() => handleDelete(previewCreature)}
                >
                    🗑️ Delete
                </button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '8px 16px' : 0 }}>
                {loadedCreatureData ? (
                    <CreatureCard
                        creature={{ ...previewCreature, data: loadedCreatureData }}
                        isGM={true}
                        revealState={previewCreature.revealState}
                        falseData={previewCreature.falseData}
                        onRevealChange={(field, state) => updateRevealState(previewCreature.id, field, state)}
                        onAbilityClick={(ability) => setSelectedAbility(ability)}
                        onSkillClick={(skill) => setSelectedSkill(skill)}
                    />
                ) : (
                    <div style={{ padding: 20, textAlign: 'center', color: '#888' }}>Loading creature data...</div>
                )}
                {loreBacklinks.length > 0 && (
                    <section style={{ margin: '14px 0', padding: 12, borderTop: '1px solid #4c4136' }}>
                        <h3 style={{ margin: '0 0 8px', color: 'var(--text-gold)' }}>Referenced by Knowledge</h3>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            {loreBacklinks.map((article) => <span key={article.id} style={{ border: '1px solid #514a40', padding: '4px 8px', borderRadius: 4 }}>{article.title}</span>)}
                        </div>
                    </section>
                )}
            </div>
        </div>
    ) : null;

    // ── Render list view ──────────────────────────────────────────────────────
    return (
        <div className="admin-layout" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
            <AdminTableToolbar
                search={search}
                onSearchChange={(value) => { setSearch(value); setPage(1); }}
                searchPlaceholder="Search creatures..."
                filters={tableFilters}
                filterValues={activeFilters}
                onFilterValuesChange={(values) => { setActiveFilters(values); setPage(1); }}
                filterOpen={filterOpen}
                onFilterOpenChange={setFilterOpen}
                focusFilterId={focusFilterId}
                columns={tableColumns}
                visibleColumns={visibleColumns}
                onVisibleColumnsChange={setVisibleColumns}
                resultMeta={`${sortedCreatures.length} creatures`}
                primaryActions={(
                    <>
                        <Button
                            type="button"
                            onClick={() => setEditingCreature({ type: 'npc', data: {}, bestiary: false, revealState: { ...DEFAULT_CREATURE_REVEAL_STATE }, editorMode: 'create' })}
                        >
                            + New
                        </Button>
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={handleInitMetadataFromCatalog}
                            disabled={importingCatalog}
                            title="Initialize metadata from catalog"
                        >
                            Import Metadata
                        </Button>
                    </>
                )}
            />

            {/* ── Table + Side panel ── */}
            <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                <div style={{ flex: 1, display: 'flex', minWidth: 0, flexDirection: 'column', overflow: 'hidden', padding: 10 }}>
                    <AdminTableSurface
                        columns={visibleTableColumns}
                        rows={paginatedCreatures}
                        getRowKey={(creature) => creature.id}
                        sortConfig={sortConfig}
                        onSort={handleSort}
                        onHeaderFilter={(column) => {
                            const filterId = column.key === 'catalogStatusLabel' ? 'CatalogStatus' : column.key;
                            if (tableFilters.some(filter => filter.id === filterId)) {
                                setFocusFilterId(filterId);
                                setFilterOpen(true);
                            }
                        }}
                        isRowSelected={(creature) => previewCreature?.id === creature.id}
                        onRowClick={(_event, creature) => handleRowClick(creature)}
                        onRowDoubleClick={(_event, creature) => handleRowDoubleClick(creature)}
                        getRowActions={getCreatureRowActions}
                        renderCell={({ row, column }) => renderCreatureTableCell(row, column, toggleBestiary)}
                        emptyLabel="No creatures found."
                    />
                    <AdminPagination
                        page={currentPage}
                        totalPages={totalPages}
                        total={sortedCreatures.length}
                        pageSize={itemsPerPage}
                        pageSizeOptions={[25, 50, 100]}
                        label="creatures"
                        onPageChange={setPage}
                        onPageSizeChange={(nextSize) => { setItemsPerPage(nextSize); setPage(1); }}
                    />
                </div>

                {/* ── Desktop side preview panel ── */}
                {!isMobile && previewCreature && (
                    <div style={{ width: 520, borderLeft: '1px solid #444', overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: 16 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                            <h4 style={{ margin: 0, color: '#aaa' }}>Preview</h4>
                            <button onClick={() => setPreviewCreature(null)} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer' }}>✕</button>
                        </div>
                        {previewContent}
                    </div>
                )}
            </div>

            {/* ── Mobile preview BottomSheet ── */}
            {isMobile && (
                <BottomSheet
                    isOpen={!!previewCreature}
                    onClose={() => setPreviewCreature(null)}
                    title={previewCreature?.name || 'Preview'}
                    height="85vh"
                >
                    {previewContent}
                </BottomSheet>
            )}

            {/* Ability Modal */}
            {selectedAbility && (
                <CreatureAbilityModal
                    ability={selectedAbility}
                    onClose={() => setSelectedAbility(null)}
                    onContentLinkClick={onContentLinkClick}
                />
            )}

            {selectedSkill && (
                <CreatureSkillDetailDialog
                    skill={selectedSkill}
                    onClose={() => setSelectedSkill(null)}
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

function renderCreatureTableCell(creature, column, toggleBestiary) {
    if (column.key === 'bestiary') {
        return (
            <input
                type="checkbox"
                checked={creature.bestiary || false}
                onChange={() => toggleBestiary(creature)}
                onClick={event => event.stopPropagation()}
            />
        );
    }
    if (column.key === 'traits') {
        const traits = creature.traits || [];
        return <span className="text-muted-foreground">{traits.slice(0, 3).join(', ')}{traits.length > 3 ? '...' : ''}</span>;
    }
    if (column.key === 'catalogStatusLabel') {
        return <span className="text-muted-foreground">{creature.catalogStatusLabel || 'Original'}</span>;
    }
    return creature[column.key] ?? '-';
}
