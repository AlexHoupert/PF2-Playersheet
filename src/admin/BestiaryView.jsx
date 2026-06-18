/**
 * BestiaryView - Admin panel for managing creatures and hazards
 * Features: List/filter/sort, CRUD operations, JSON import, reveal state management
 *
 * Architecture: Creature DATA comes from catalog (static JSON files),
 * while db only stores METADATA (group, bestiary visibility, revealState, falseData)
 */
import React, { useMemo, useState, useEffect } from 'react';
import { useCampaign } from '../shared/context/CampaignContext';
import FilterBar from './components/FilterBar';
import BottomSheet from '../shared/components/BottomSheet';
import CreatureCard from '../shared/components/CreatureCard';
import CreatureAbilityModal from '../shared/components/CreatureAbilityModal';
import CreatureEditor from './editors/CreatureEditor';
import { useWindowSize } from '../shared/hooks/useWindowSize';
import { getRecallKnowledgeDC, generateFalseData } from '../utils/bestiaryUtils';
import { getAllCreatures, fetchCreatureData } from '../shared/catalog/creatureIndex';
import { copyRef, getInMemoryRef } from '../shared/clipboard/refClipboard';
import { selectCustomAbilityList } from '../shared/db/selectors/abilitySelectors';
import { selectBestiaryCreatureMetadata, selectCustomCreatures } from '../shared/db/selectors/bestiarySelectors';

// Default reveal state for new creatures
const DEFAULT_REVEAL_STATE = {
    name: 'hidden', level: 'hidden', traits: 'hidden', ac: 'hidden',
    hp: 'hidden', saves: 'hidden', immunities: 'hidden', resistances: 'hidden',
    weaknesses: 'hidden', speed: 'hidden', attacks: 'hidden', abilities: 'hidden',
    perception: 'hidden', senses: 'hidden', skills: 'hidden', attributes: 'hidden',
    size: 'precise'
};

// Column priority map for responsive hiding
const COL_PRIORITY = {
    name: undefined,      // always visible
    level: undefined,
    type: 2,              // tablet+
    traits: 2,
    bestiary: 2,
    rarity: 3,            // desktop only
    group: 3,
};

export default function BestiaryView({ db, setDb, initialFilterType, onContentLinkClick }) {
    const { dataActions } = useCampaign();
    const { isMobile } = useWindowSize();

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
    const [showColSelector, setShowColSelector] = useState(false);

    // ── Selection / context menu / toast ────────────────────────────────────
    const [contextMenu, setContextMenu] = useState(null);
    const [toast, setToast] = useState(null);

    const showToast = (msg) => {
        const key = Date.now();
        setToast({ msg, key });
        setTimeout(() => setToast(t => t?.key === key ? null : t), 2200);
    };
    const runDataAction = (action) => {
        Promise.resolve(action).catch(err => {
            console.error(err);
            alert(err?.message || String(err));
        });
    };

    const pasteAbilityToCreature = (creature) => {
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
    const [jsonImportText, setJsonImportText] = useState('');
    const [importError, setImportError] = useState('');
    const [selectedAbility, setSelectedAbility] = useState(null);

    // Fetch full creature data when preview creature changes
    useEffect(() => {
        if (!previewCreature?.id) { setLoadedCreatureData(null); return; }
        if (previewCreature.isCustom) {
            const customData = selectCustomCreatures(db)[previewCreature.id]?.data;
            if (customData) { setLoadedCreatureData(customData); return; }
        }
        fetchCreatureData(previewCreature.id).then(data => { if (data) setLoadedCreatureData(data); });
    }, [previewCreature?.id, db]);

    // Fetch full creature data when editing creature changes
    useEffect(() => {
        if (!editingCreature?.id || editingCreature.data) return;
        if (editingCreature.isCustom) {
            const customData = selectCustomCreatures(db)[editingCreature.id]?.data;
            if (customData) { setEditingCreature(prev => ({ ...prev, data: customData })); return; }
        }
        fetchCreatureData(editingCreature.id).then(data => {
            if (data) setEditingCreature(prev => ({ ...prev, data }));
        });
    }, [editingCreature?.id, db]);

    // ── Data: merge index + custom creatures ─────────────────────────────────
    const creatures = useMemo(() => {
        const indexItems = getAllCreatures();
        const customCreatures = Object.values(selectCustomCreatures(db)).map(cData => {
            const sys = cData.data?.system || {};
            return {
                id: cData.id,
                sourceFile: null,
                type: cData.type || 'npc',
                name: cData.name || 'Unnamed',
                level: sys.details?.level?.value ?? 0,
                rarity: sys.traits?.rarity || 'common',
                traits: sys.traits?.value || [],
                isCustom: true
            };
        });
        const distinctItems = [...customCreatures, ...indexItems];
        const dbMetadata = selectBestiaryCreatureMetadata(db);
        const seenIds = new Set();
        return distinctItems
            .filter(item => { if (seenIds.has(item.id)) return false; seenIds.add(item.id); return true; })
            .map(item => {
                const meta = dbMetadata[item.id] || {};
                return {
                    id: item.id, sourceFile: item.sourceFile,
                    type: item.type || 'npc',
                    name: item.name || 'Unknown',
                    level: item.level ?? 0,
                    rarity: item.rarity || 'common',
                    traits: item.traits || [],
                    isCustom: item.isCustom || false,
                    group: meta.group || 'Uncategorized',
                    bestiary: meta.bestiary || false,
                    revealState: meta.revealState || { ...DEFAULT_REVEAL_STATE },
                    falseData: meta.falseData
                };
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

    const filterOptionsMap = useMemo(() => ({
        type:     uniqueTypes,
        rarity:   uniqueRarities,
        traits:   uniqueTraits,
        group:    uniqueGroups,
        bestiary: true,
    }), [uniqueTypes, uniqueRarities, uniqueTraits, uniqueGroups]);

    // ── Filtering ────────────────────────────────────────────────────────────
    const filteredCreatures = useMemo(() => {
        const q = search.trim().toLowerCase();
        return creatures.filter(c => {
            const { type, rarity, traits, group, bestiary } = activeFilters;
            if (type?.length && !type.includes(c.type)) return false;
            if (rarity?.length && !rarity.includes(c.rarity)) return false;
            if (traits?.length && !traits.every(t => c.traits?.includes(t))) return false;
            if (group?.length && !group.includes(c.group)) return false;
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

    const handleContextMenu = (e, creature) => {
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY, creature });
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

    const handleSave = (creatureData) => {
        const id = creatureData.id;
        if (!id) { alert('Cannot save: creature must have an ID from the catalog'); return; }
        const level = creatureData.data?.system?.details?.level?.value ?? 0;
        runDataAction(dataActions.bestiary.updateCreatureMetadata(id, {
            id,
            group: creatureData.group || 'Uncategorized',
            bestiary: creatureData.bestiary || false,
            revealState: creatureData.revealState || { ...DEFAULT_REVEAL_STATE },
            falseData: creatureData.falseData || generateFalseData({
                hp: creatureData.data?.system?.attributes?.hp?.max ?? 0,
                fortitude: creatureData.data?.system?.saves?.fortitude?.value ?? 0,
                reflex: creatureData.data?.system?.saves?.reflex?.value ?? 0,
                will: creatureData.data?.system?.saves?.will?.value ?? 0,
                ac: creatureData.data?.system?.attributes?.ac?.value ?? 10,
                perception: creatureData.data?.system?.perception?.mod ?? 0
            }, level)
        }));
        setEditingCreature(null);
        setJsonImportText('');
    };

    const handleDelete = (id) => {
        if (!confirm('Delete this creature?')) return;
        runDataAction(dataActions.bestiary.deleteCreature(id));
        setContextMenu(null);
        if (previewCreature?.id === id) setPreviewCreature(null);
    };

    const handleEdit = async (creature) => {
        if (creature.isCustom) {
            const data = selectCustomCreatures(db)[creature.id]?.data;
            if (!data) { alert('Custom creature data not found in database'); setContextMenu(null); return; }
            setEditingCreature({ ...creature, data });
            setContextMenu(null);
            setPreviewCreature(null);
            return;
        }
        const data = await fetchCreatureData(creature.id);
        if (!data) { alert('Failed to load creature data'); setContextMenu(null); return; }
        setEditingCreature({ ...creature, data });
        setContextMenu(null);
        setPreviewCreature(null);
    };

    const handleClone = async (creature) => {
        const rawData = creature.isCustom
            ? selectCustomCreatures(db)[creature.id]?.data
            : await fetchCreatureData(creature.id);
        if (!rawData) { alert('Failed to load creature data'); setContextMenu(null); return; }
        // Deep-copy so the clone shares no nested object references with the original
        const data = JSON.parse(JSON.stringify(rawData));
        setEditingCreature({
            ...creature, id: null, sourceFile: null,
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
                    revealState: { ...DEFAULT_REVEAL_STATE },
                    falseData: generateFalseData({ hp: 0, fortitude: 0, reflex: 0, will: 0, ac: 10, perception: 0 }, creature.level ?? 0)
                };
            return newEntry;
        }));
    };

    const handleSetGroup = (creature) => {
        const newGroup = prompt('Enter group name:', creature.group || 'Uncategorized');
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
                : { id, group: newGroup.trim() || 'Uncategorized', bestiary: false, revealState: { ...DEFAULT_REVEAL_STATE } };
            return newEntry;
        }));
        setContextMenu(null);
    };

    const updateRevealState = (id, field, state) => {
        runDataAction(dataActions.bestiary.updateRevealState(id, field, state));
    };

    const handleImportJSON = () => {
        try {
            const parsed = JSON.parse(jsonImportText);
            if (!parsed.name) throw new Error('JSON must have a name field');
            setEditingCreature({ id: null, type: parsed.type === 'hazard' ? 'hazard' : 'npc', data: parsed, bestiary: false, revealState: { ...DEFAULT_REVEAL_STATE } });
            setImportError('');
        } catch (err) { setImportError('Invalid JSON: ' + err.message); }
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
                revealState: { ...DEFAULT_REVEAL_STATE },
                falseData: generateFalseData({ hp: 0, fortitude: 0, reflex: 0, will: 0, ac: 10, perception: 0 }, level)
            }];
        });
        runDataAction(dataActions.bestiary.initializeCreatureMetadata(metadataEntries));
        alert(`Initialized metadata for ${metadataEntries.length} creatures.`);
        setImportingCatalog(false);
    };

    const allColumns = ['name', 'level', 'type', 'group', 'rarity', 'traits', 'bestiary'];

    // ── Render editor ─────────────────────────────────────────────────────────
    if (editingCreature) {
        return (
            <CreatureEditor
                initialCreature={editingCreature}
                customAbilities={selectCustomAbilityList(db)}
                onSave={(data) => {
                    setEditingCreature(null);
                    if (!data?.message?.includes('Database')) window.location.reload();
                }}
                onCancel={() => setEditingCreature(null)}
                onSaveToDb={(creatureData) => {
                    return dataActions.bestiary.saveCustomCreature(creatureData);
                }}
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
                    onClick={() => { copyRef('creature', previewCreature); showToast('Reference copied'); }}
                >
                    📎 Copy Ref
                </button>
                {previewCreature.isCustom && (
                    <button
                        className="nav-btn"
                        style={{ color: '#e57373' }}
                        onClick={() => handleDelete(previewCreature.id)}
                    >
                        🗑️ Delete
                    </button>
                )}
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
                    />
                ) : (
                    <div style={{ padding: 20, textAlign: 'center', color: '#888' }}>Loading creature data...</div>
                )}
            </div>
        </div>
    ) : null;

    // ── Render list view ──────────────────────────────────────────────────────
    return (
        <div className="admin-layout" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
            {/* ── Toolbar ── */}
            <div style={{ padding: 10, background: '#222', borderBottom: '1px solid #444', flexShrink: 0 }}>
                <FilterBar
                    search={search}
                    onSearch={(v) => { setSearch(v); setPage(1); }}
                    searchPlaceholder="Search creatures..."
                    activeFilters={activeFilters}
                    onFiltersChange={(f) => { setActiveFilters(f); setPage(1); }}
                    columns={['type', 'rarity', 'traits', 'group', 'bestiary']}
                    optionsMap={filterOptionsMap}
                    columnLabels={{ bestiary: 'In Bestiary', type: 'Type', rarity: 'Rarity', traits: 'Traits', group: 'Group' }}
                    extraRight={
                        <div style={{ display: 'flex', gap: 6 }}>
                            <button
                                className="btn-add-condition"
                                style={{ margin: 0, width: 'auto', background: '#4caf50' }}
                                onClick={() => setEditingCreature({ type: 'npc', data: {}, bestiary: false, revealState: { ...DEFAULT_REVEAL_STATE } })}
                            >
                                + New
                            </button>
                            <button
                                className="btn-add-condition"
                                style={{ margin: 0, width: 'auto', background: '#2196f3' }}
                                onClick={handleInitMetadataFromCatalog}
                                disabled={importingCatalog}
                                title="Initialize metadata from catalog"
                            >
                                📥
                            </button>
                        </div>
                    }
                />

                {/* Secondary toolbar row: columns selector + page size */}
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6, flexWrap: 'wrap' }}>
                    <span style={{ color: '#888', fontSize: '0.85em' }}>{sortedCreatures.length} creatures</span>

                    <div style={{ position: 'relative' }}>
                        <button
                            className="btn-add-condition"
                            style={{ margin: 0, width: 'auto', fontSize: '0.8em', padding: '4px 8px' }}
                            onClick={() => setShowColSelector(!showColSelector)}
                        >
                            Columns ▾
                        </button>
                        {showColSelector && (
                            <div style={{ position: 'absolute', top: '100%', left: 0, background: '#333', border: '1px solid #555', padding: 10, zIndex: 10, minWidth: 150 }}>
                                {allColumns.map(col => (
                                    <div key={col} style={{ display: 'flex', gap: 5, marginBottom: 5 }}>
                                        <input type="checkbox"
                                            checked={visibleColumns.includes(col)}
                                            onChange={() => setVisibleColumns(prev => prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col])}
                                        />
                                        <span style={{ textTransform: 'capitalize', color: '#ccc', fontSize: '0.9em' }}>{col}</span>
                                    </div>
                                ))}
                                <button onClick={() => setShowColSelector(false)} style={{ marginTop: 6, width: '100%', background: '#444', border: 'none', color: '#ccc', padding: '4px', cursor: 'pointer', borderRadius: 3 }}>Close</button>
                            </div>
                        )}
                    </div>

                    <select
                        className="modal-input"
                        style={{ width: 'auto', fontSize: '0.85em' }}
                        value={itemsPerPage}
                        onChange={e => { setItemsPerPage(Number(e.target.value)); setPage(1); }}
                    >
                        <option value={25}>25/page</option>
                        <option value={50}>50/page</option>
                        <option value={100}>100/page</option>
                    </select>
                </div>
            </div>

            {/* ── Table + Side panel ── */}
            <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                <div style={{ flex: 1, overflow: 'auto', padding: 10 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9em' }}>
                        <thead>
                            <tr style={{ background: '#333', textAlign: 'left' }}>
                                {visibleColumns.map(c => (
                                    <th
                                        key={c}
                                        data-priority={COL_PRIORITY[c]}
                                        style={{ padding: 8, textTransform: 'capitalize', cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                                        onClick={() => handleSort(c)}
                                    >
                                        {c} {sortConfig.key === c ? (sortConfig.direction === 'asc' ? '▲' : '▼') : ''}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {paginatedCreatures.map((creature, idx) => (
                                <tr
                                    key={creature.id}
                                    style={{
                                        borderBottom: '1px solid #444',
                                        background: previewCreature?.id === creature.id
                                            ? 'rgba(197,160,89,0.1)'
                                            : idx % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent',
                                        cursor: 'pointer'
                                    }}
                                    onClick={() => handleRowClick(creature)}
                                    onDoubleClick={() => handleRowDoubleClick(creature)}
                                    onContextMenu={e => handleContextMenu(e, creature)}
                                >
                                    {visibleColumns.map(c => (
                                        <td key={c} data-priority={COL_PRIORITY[c]} style={{ padding: '8px' }}>
                                            {c === 'bestiary' ? (
                                                <input
                                                    type="checkbox"
                                                    checked={creature.bestiary || false}
                                                    onChange={() => toggleBestiary(creature)}
                                                    onClick={e => e.stopPropagation()}
                                                />
                                            ) : c === 'traits' ? (
                                                creature.traits?.slice(0, 3).join(', ') + (creature.traits?.length > 3 ? '…' : '') || '-'
                                            ) : (
                                                creature[c] ?? '-'
                                            )}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {/* Pagination */}
                    <div style={{ marginTop: 10, display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' }}>
                        <button className="page-btn" disabled={currentPage === 1} onClick={() => setPage(1)}>«</button>
                        <button className="page-btn" disabled={currentPage === 1} onClick={() => setPage(p => p - 1)}>‹ Prev</button>
                        <span style={{ color: '#aaa', fontSize: '0.9em' }}>Page {currentPage} / {totalPages}</span>
                        <button className="page-btn" disabled={currentPage === totalPages} onClick={() => setPage(p => p + 1)}>Next ›</button>
                        <button className="page-btn" disabled={currentPage === totalPages} onClick={() => setPage(totalPages)}>»</button>
                    </div>
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

            {/* ── Desktop context menu ── */}
            {contextMenu && (
                <div
                    style={{
                        position: 'fixed', top: contextMenu.y, left: contextMenu.x,
                        background: '#2b2b2e', border: '1px solid #c5a059', borderRadius: 4,
                        zIndex: 2000, minWidth: 160, boxShadow: '0 2px 10px rgba(0,0,0,0.5)'
                    }}
                    onClick={e => e.stopPropagation()}
                >
                    {[
                        { label: '📎 Copy Reference', onClick: () => { copyRef('creature', contextMenu.creature); showToast('Reference copied'); setContextMenu(null); } },
                        { label: '📁 Set Group', onClick: () => handleSetGroup(contextMenu.creature) },
                        contextMenu.creature.isCustom && {
                            label: '📥 Paste Referenced Ability',
                            disabled: getInMemoryRef()?.type !== 'ability',
                            onClick: () => pasteAbilityToCreature(contextMenu.creature)
                        },
                        { label: '✏️ Edit', onClick: () => handleEdit(contextMenu.creature) },
                        { label: '📋 Clone', onClick: () => handleClone(contextMenu.creature) },
                        { label: '👁️ Preview', onClick: () => { setPreviewCreature(contextMenu.creature); setContextMenu(null); } },
                        { label: '🗑️ Delete', color: '#e57373', onClick: () => handleDelete(contextMenu.creature.id) },
                    ].filter(Boolean).map((item, i, arr) => (
                        <div
                            key={i}
                            className="ctx-item"
                            style={{
                                padding: '8px 12px', cursor: item.disabled ? 'default' : 'pointer',
                                borderBottom: i < arr.length - 1 ? '1px solid #444' : 'none',
                                color: item.disabled ? '#555' : item.color || '#ddd',
                            }}
                            onClick={item.disabled ? undefined : item.onClick}
                        >
                            {item.label}
                        </div>
                    ))}
                    <div style={{ position: 'fixed', inset: 0, zIndex: -1 }} onClick={() => setContextMenu(null)} />
                </div>
            )}

            {/* Ability Modal */}
            {selectedAbility && (
                <CreatureAbilityModal
                    ability={selectedAbility}
                    onClose={() => setSelectedAbility(null)}
                    onContentLinkClick={onContentLinkClick}
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
