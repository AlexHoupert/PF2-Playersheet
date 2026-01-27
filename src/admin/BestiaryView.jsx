/**
 * BestiaryView - Admin panel for managing creatures and hazards
 * Features: List/filter/sort, CRUD operations, JSON import, reveal state management
 * 
 * Architecture: Creature DATA comes from catalog (static JSON files), 
 * while db only stores METADATA (group, bestiary visibility, revealState, falseData)
 */
import React, { useMemo, useState, useEffect } from 'react';
import { useCampaign } from '../shared/context/CampaignContext';
import MultiSelectDropdown from '../shared/components/MultiSelectDropdown';
import CreatureCard from '../shared/components/CreatureCard';
import CreatureAbilityModal from '../shared/components/CreatureAbilityModal';
import CreatureEditor from './editors/CreatureEditor';
import { getRecallKnowledgeDC, generateFalseData } from '../utils/bestiaryUtils';
import { getAllCreatures, fetchCreatureData } from '../shared/catalog/creatureIndex';

// Default reveal state for new creatures
const DEFAULT_REVEAL_STATE = {
    name: 'hidden', level: 'hidden', traits: 'hidden', ac: 'hidden',
    hp: 'hidden', saves: 'hidden', immunities: 'hidden', resistances: 'hidden',
    weaknesses: 'hidden', speed: 'hidden', attacks: 'hidden', abilities: 'hidden',
    perception: 'hidden', senses: 'hidden', skills: 'hidden', attributes: 'hidden',
    size: 'precise'
};

export default function BestiaryView({ db, setDb }) {
    const { activeCampaign } = useCampaign();

    // List state
    const [search, setSearch] = useState('');
    const [filterType, setFilterType] = useState([]);
    const [filterRarity, setFilterRarity] = useState([]);
    const [filterTraits, setFilterTraits] = useState([]);
    const [filterGroup, setFilterGroup] = useState([]);
    const [filterBestiary, setFilterBestiary] = useState(false);
    const [page, setPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(25);
    const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' });
    const [visibleColumns, setVisibleColumns] = useState(['name', 'level', 'type', 'group', 'bestiary']);
    const [showColSelector, setShowColSelector] = useState(false);

    // Selection & context menu
    const [selectedItems, setSelectedItems] = useState([]);
    const [contextMenu, setContextMenu] = useState(null);

    // Editor state
    const [editingCreature, setEditingCreature] = useState(null);
    const [previewCreature, setPreviewCreature] = useState(null);
    const [loadedCreatureData, setLoadedCreatureData] = useState(null);
    const [jsonImportText, setJsonImportText] = useState('');
    const [importError, setImportError] = useState('');

    // Ability modal state
    const [selectedAbility, setSelectedAbility] = useState(null);

    // Fetch full creature data when preview creature changes
    useEffect(() => {
        if (!previewCreature?.id) {
            setLoadedCreatureData(null);
            return;
        }

        if (previewCreature.isCustom) {
            const customData = db.bestiary?.customCreatures?.[previewCreature.id]?.data;
            if (customData) {
                setLoadedCreatureData(customData);
                return;
            }
        }

        // Fetch the full creature data
        fetchCreatureData(previewCreature.id).then(data => {
            if (data) {
                setLoadedCreatureData(data);
            }
        });
    }, [previewCreature?.id, db.bestiary?.customCreatures]);

    // Fetch full creature data when editing creature changes
    useEffect(() => {
        if (!editingCreature?.id || editingCreature.data) {
            // Already has data or no creature selected
            return;
        }

        // If it's a custom creature in DB, we already have the data in db.bestiary.customCreatures
        // But editingCreature object might be lightweight.
        // If it was clicked from list, it has 'isCustom'.

        if (editingCreature.isCustom) {
            const customData = db.bestiary?.customCreatures?.[editingCreature.id]?.data;
            if (customData) {
                setEditingCreature(prev => ({ ...prev, data: customData }));
                return;
            }
        }

        // Fetch the full creature data for editing
        fetchCreatureData(editingCreature.id).then(data => {
            if (data) {
                setEditingCreature(prev => ({ ...prev, data }));
            }
        });
    }, [editingCreature?.id, db.bestiary?.customCreatures]);

    // Get all creatures from INDEX (lightweight), merged with db METADATA
    // Full creature data is fetched on-demand when editing/previewing
    const creatures = useMemo(() => {
        const indexItems = getAllCreatures(); // Returns lightweight index items

        // Merge in custom creatures from DB
        const customCreatures = Object.values(db.bestiary?.customCreatures || {}).map(cData => {
            const sys = cData.data?.system || {};
            // If it's a full creature object, extract lightweight props for list
            return {
                id: cData.id,
                sourceFile: null, // Custom DB creatures have no sourceFile
                type: cData.type || 'npc',
                name: cData.name || 'Unnamed',
                level: sys.details?.level?.value ?? 0,
                rarity: sys.traits?.rarity || 'common',
                traits: sys.traits?.value || [],
                isCustom: true // Flag to identify DB creatures
            };
        });

        const distinctItems = [...customCreatures, ...indexItems];
        const dbMetadata = db.bestiary?.creatures || {};

        // Deduplicate by ID (some catalog sources may have duplicates)
        const seenIds = new Set();

        return distinctItems
            .filter(item => {
                if (seenIds.has(item.id)) return false;
                seenIds.add(item.id);
                return true;
            })
            .map(item => {
                const meta = dbMetadata[item.id] || {};
                return {
                    id: item.id,
                    sourceFile: item.sourceFile,
                    type: item.type || 'npc',
                    // From index (lightweight)
                    name: item.name || 'Unknown',
                    level: item.level ?? 0,
                    rarity: item.rarity || 'common',
                    traits: item.traits || [],
                    isCustom: item.isCustom || false,
                    // From db metadata
                    group: meta.group || 'Uncategorized',
                    bestiary: meta.bestiary || false,
                    revealState: meta.revealState || { ...DEFAULT_REVEAL_STATE },
                    falseData: meta.falseData
                };
            });
    }, [db.bestiary?.creatures, db.bestiary?.customCreatures]);

    // Extract unique filter options
    const uniqueTypes = useMemo(() => ['creature', 'hazard'], []);
    const uniqueRarities = useMemo(() => ['common', 'uncommon', 'rare', 'unique'], []);
    const uniqueTraits = useMemo(() => {
        const allTraits = new Set();
        creatures.forEach(c => c.traits?.forEach(t => allTraits.add(t)));
        return Array.from(allTraits).sort();
    }, [creatures]);
    const uniqueGroups = useMemo(() => {
        const allGroups = new Set();
        creatures.forEach(c => allGroups.add(c.group || 'Uncategorized'));
        return Array.from(allGroups).sort();
    }, [creatures]);

    // Filter and sort
    const filteredCreatures = useMemo(() => {
        const searchLower = search.trim().toLowerCase();
        return creatures.filter(c => {
            if (filterType.length && !filterType.includes(c.type)) return false;
            if (filterRarity.length && !filterRarity.includes(c.rarity)) return false;
            if (filterTraits.length && !filterTraits.every(t => c.traits?.includes(t))) return false;
            if (filterGroup.length && !filterGroup.includes(c.group)) return false;
            if (filterBestiary && !c.bestiary) return false;
            return c.name.toLowerCase().includes(searchLower);
        });
    }, [creatures, search, filterType, filterRarity, filterTraits, filterGroup, filterBestiary]);

    const sortedCreatures = useMemo(() => {
        const items = [...filteredCreatures];
        items.sort((a, b) => {
            let valA = a[sortConfig.key];
            let valB = b[sortConfig.key];
            if (Array.isArray(valA)) valA = valA.join(', ');
            if (Array.isArray(valB)) valB = valB.join(', ');
            if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
            if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
            // Secondary sort by id for stability
            return a.id.localeCompare(b.id);
        });
        return items;
    }, [filteredCreatures, sortConfig]);

    const totalPages = useMemo(
        () => Math.max(1, Math.ceil(sortedCreatures.length / itemsPerPage)),
        [sortedCreatures.length, itemsPerPage]
    );

    const currentPage = Math.min(page, totalPages);
    const paginatedCreatures = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        return sortedCreatures.slice(startIndex, startIndex + itemsPerPage);
    }, [currentPage, itemsPerPage, sortedCreatures]);

    useEffect(() => {
        if (page !== currentPage) setPage(currentPage);
    }, [currentPage, page]);

    // Handlers
    const handleSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
        setSortConfig({ key, direction });
    };

    const handleContextMenu = (e, creature) => {
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY, creature });
    };

    // Save only METADATA to db (not full creature data - that comes from catalog)
    const handleSave = (creatureData) => {
        const id = creatureData.id;
        if (!id) {
            alert('Cannot save: creature must have an ID from the catalog');
            return;
        }

        const level = creatureData.data?.system?.details?.level?.value ?? 0;

        // Only store metadata - NOT the full creature data
        setDb(prev => ({
            ...prev,
            bestiary: {
                ...prev.bestiary,
                creatures: {
                    ...prev.bestiary?.creatures,
                    [id]: {
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
                    }
                }
            }
        }));
        setEditingCreature(null);
        setJsonImportText('');
    };

    const handleDelete = (id) => {
        if (!confirm('Delete this creature?')) return;
        setDb(prev => {
            const newCreatures = { ...prev.bestiary?.creatures };
            delete newCreatures[id];
            return {
                ...prev,
                bestiary: { ...prev.bestiary, creatures: newCreatures }
            };
        });
        setContextMenu(null);
    };

    const handleEdit = async (creature) => {
        // Edit existing creature - fetch data and open editor
        const data = await fetchCreatureData(creature.id);
        if (!data) {
            alert('Failed to load creature data');
            setContextMenu(null);
            return;
        }
        setEditingCreature({ ...creature, data: data });
        setContextMenu(null);
    };

    const handleClone = async (creature) => {
        // Clone creature - fetch data and create a copy with new ID
        const data = await fetchCreatureData(creature.id);
        if (!data) {
            alert('Failed to load creature data');
            setContextMenu(null);
            return;
        }
        // Create cloned creature with null ID (will get new ID on save)
        setEditingCreature({
            ...creature,
            id: null,
            sourceFile: null,
            data: { ...data, _id: null, name: (data.name || creature.name) + ' (Copy)' }
        });
        setContextMenu(null);
    };

    const toggleBestiary = (id) => {
        setDb(prev => ({
            ...prev,
            bestiary: {
                ...prev.bestiary,
                creatures: {
                    ...prev.bestiary?.creatures,
                    [id]: {
                        ...prev.bestiary?.creatures?.[id],
                        bestiary: !prev.bestiary?.creatures?.[id]?.bestiary
                    }
                }
            }
        }));
    };

    const updateRevealState = (id, field, state) => {
        setDb(prev => ({
            ...prev,
            bestiary: {
                ...prev.bestiary,
                creatures: {
                    ...prev.bestiary?.creatures,
                    [id]: {
                        ...prev.bestiary?.creatures?.[id],
                        revealState: {
                            ...prev.bestiary?.creatures?.[id]?.revealState,
                            [field]: state
                        }
                    }
                }
            }
        }));
    };

    const handleImportJSON = () => {
        try {
            const parsed = JSON.parse(jsonImportText);
            if (!parsed.name) throw new Error('JSON must have a name field');

            const creatureData = {
                id: null,
                type: parsed.type === 'hazard' ? 'hazard' : 'npc',
                data: parsed,
                bestiary: false,
                revealState: { ...DEFAULT_REVEAL_STATE }
            };

            setEditingCreature(creatureData);
            setImportError('');
        } catch (err) {
            setImportError('Invalid JSON: ' + err.message);
        }
    };

    // NOTE: Creatures now auto-load from catalog via getAllCreatures()
    // This button is no longer needed - keeping for backwards compatibility
    // but now it only ensures metadata entries exist
    const [importingCatalog, setImportingCatalog] = useState(false);
    const handleInitMetadataFromCatalog = () => {
        setImportingCatalog(true);
        const catalogCreatures = getAllCreatures();
        let initialized = 0;

        setDb(prev => {
            const existingIds = Object.keys(prev.bestiary?.creatures || {});
            const newMetadata = { ...prev.bestiary?.creatures };

            catalogCreatures.forEach(creature => {
                if (!existingIds.includes(creature.id)) {
                    const level = creature.data?.system?.details?.level?.value ?? 0;
                    // Store only METADATA, not full creature data
                    newMetadata[creature.id] = {
                        id: creature.id,
                        group: 'Uncategorized',
                        bestiary: false,
                        revealState: { ...DEFAULT_REVEAL_STATE },
                        falseData: generateFalseData({
                            hp: creature.data?.system?.attributes?.hp?.max ?? 0,
                            fortitude: creature.data?.system?.saves?.fortitude?.value ?? 0,
                            reflex: creature.data?.system?.saves?.reflex?.value ?? 0,
                            will: creature.data?.system?.saves?.will?.value ?? 0,
                            ac: creature.data?.system?.attributes?.ac?.value ?? 10,
                            perception: creature.data?.system?.perception?.mod ?? 0,
                        }, level)
                    };
                    initialized++;
                }
            });

            alert(`Initialized metadata for ${initialized} creatures.`);
            return {
                ...prev,
                bestiary: { ...prev.bestiary, creatures: newMetadata }
            };
        });
        setImportingCatalog(false);
    };

    const allColumns = ['name', 'level', 'type', 'group', 'rarity', 'traits', 'bestiary'];

    // Render editor
    if (editingCreature) {
        return (
            <CreatureEditor
                initialCreature={editingCreature}
                onSave={() => {
                    setEditingCreature(null);
                    // Reload page to refresh catalog after rebuild
                    window.location.reload();
                }}
                onCancel={() => setEditingCreature(null)}
                onSaveToDb={(creatureData) => {
                    setDb(prev => ({
                        ...prev,
                        bestiary: {
                            ...prev.bestiary,
                            customCreatures: {
                                ...prev.bestiary?.customCreatures,
                                [creatureData._id]: {
                                    id: creatureData._id,
                                    type: creatureData.type,
                                    name: creatureData.name,
                                    data: creatureData
                                }
                            }
                        }
                    }));
                }}
            />
        );
    }

    // Render list view
    return (
        <div className="admin-layout" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
            {/* Toolbar */}
            <div style={{ padding: 10, background: '#222', borderBottom: '1px solid #444', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <input
                    className="modal-input"
                    placeholder="Search creatures..."
                    value={search}
                    onChange={e => { setSearch(e.target.value); setPage(1); }}
                    style={{ width: 200 }}
                />

                <button
                    className="btn-add-condition"
                    style={{ margin: 0, width: 'auto', background: '#4caf50' }}
                    onClick={() => setEditingCreature({ type: 'npc', data: {}, bestiary: false, revealState: { ...DEFAULT_REVEAL_STATE } })}
                >
                    + New Creature
                </button>

                <button
                    className="btn-add-condition"
                    style={{ margin: 0, width: 'auto', background: '#2196f3' }}
                    onClick={handleInitMetadataFromCatalog}
                    disabled={importingCatalog}
                >
                    {importingCatalog ? 'Initializing...' : '📥 Init Metadata'}
                </button>

                <MultiSelectDropdown
                    label="Type"
                    options={uniqueTypes}
                    selected={filterType}
                    onChange={next => { setFilterType(next); setPage(1); }}
                />
                <MultiSelectDropdown
                    label="Rarity"
                    options={uniqueRarities}
                    selected={filterRarity}
                    onChange={next => { setFilterRarity(next); setPage(1); }}
                />
                <MultiSelectDropdown
                    label="Traits"
                    options={uniqueTraits}
                    selected={filterTraits}
                    onChange={next => { setFilterTraits(next); setPage(1); }}
                />
                <MultiSelectDropdown
                    label="Group"
                    options={uniqueGroups}
                    selected={filterGroup}
                    onChange={next => { setFilterGroup(next); setPage(1); }}
                />

                <label style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#aaa' }}>
                    <input
                        type="checkbox"
                        checked={filterBestiary}
                        onChange={e => { setFilterBestiary(e.target.checked); setPage(1); }}
                    />
                    In Bestiary Only
                </label>

                <div style={{ position: 'relative' }}>
                    <button
                        className="btn-add-condition"
                        style={{ margin: 0, width: 'auto' }}
                        onClick={() => setShowColSelector(!showColSelector)}
                    >
                        Columns ▾
                    </button>
                    {showColSelector && (
                        <div style={{ position: 'absolute', top: '100%', left: 0, background: '#333', border: '1px solid #555', padding: 10, zIndex: 10, minWidth: 150 }}>
                            {allColumns.map(col => (
                                <div key={col} style={{ display: 'flex', gap: 5, marginBottom: 5 }}>
                                    <input
                                        type="checkbox"
                                        checked={visibleColumns.includes(col)}
                                        onChange={() => {
                                            setVisibleColumns(prev => prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col]);
                                        }}
                                    />
                                    <span style={{ textTransform: 'capitalize' }}>{col}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <select
                    className="modal-input"
                    style={{ width: 'auto' }}
                    value={itemsPerPage}
                    onChange={e => { setItemsPerPage(Number(e.target.value)); setPage(1); }}
                >
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                </select>

                <span style={{ color: '#888' }}>{sortedCreatures.length} creatures</span>
            </div>

            {/* Table */}
            <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                <div style={{ flex: 1, overflow: 'auto', padding: 10 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9em' }}>
                        <thead>
                            <tr style={{ background: '#333', textAlign: 'left' }}>
                                {visibleColumns.map(c => (
                                    <th
                                        key={c}
                                        style={{ padding: 8, textTransform: 'capitalize', cursor: 'pointer', userSelect: 'none' }}
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
                                        background: idx % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent',
                                        cursor: 'pointer'
                                    }}
                                    onDoubleClick={() => setPreviewCreature(creature)}
                                    onContextMenu={e => handleContextMenu(e, creature)}
                                >
                                    {visibleColumns.map(c => (
                                        <td key={c} style={{ padding: 8 }}>
                                            {c === 'bestiary' ? (
                                                <input
                                                    type="checkbox"
                                                    checked={creature.bestiary || false}
                                                    onChange={() => toggleBestiary(creature.id)}
                                                    onClick={e => e.stopPropagation()}
                                                />
                                            ) : c === 'traits' ? (
                                                creature.traits?.slice(0, 3).join(', ') + (creature.traits?.length > 3 ? '...' : '') || '-'
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
                    <div style={{ marginTop: 10, display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'center' }}>
                        <button disabled={currentPage === 1} onClick={() => setPage(p => Math.max(1, p - 1))}>Prev</button>
                        <span>Page {currentPage} of {totalPages}</span>
                        <button disabled={currentPage === totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>Next</button>
                    </div>
                </div>

                {/* Preview pane */}
                {previewCreature && (
                    <div style={{ width: 520, borderLeft: '1px solid #444', overflow: 'auto', padding: 16 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                            <h4 style={{ margin: 0, color: '#aaa' }}>Preview</h4>
                            <button onClick={() => setPreviewCreature(null)} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer' }}>✕</button>
                        </div>
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
                            <div style={{ padding: 20, textAlign: 'center', color: '#888' }}>
                                Loading creature data...
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Context Menu */}
            {contextMenu && (
                <div
                    style={{
                        position: 'fixed',
                        top: contextMenu.y,
                        left: contextMenu.x,
                        background: '#2b2b2e',
                        border: '1px solid #c5a059',
                        borderRadius: 4,
                        zIndex: 2000,
                        minWidth: 150,
                        boxShadow: '0 2px 10px rgba(0,0,0,0.5)'
                    }}
                    onClick={e => e.stopPropagation()}
                >
                    <div
                        className="ctx-item"
                        style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #444' }}
                        onClick={() => handleEdit(contextMenu.creature)}
                    >
                        ✏️ Edit
                    </div>
                    <div
                        className="ctx-item"
                        style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #444' }}
                        onClick={() => handleClone(contextMenu.creature)}
                    >
                        📋 Clone
                    </div>
                    <div
                        className="ctx-item"
                        style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #444' }}
                        onClick={() => { setPreviewCreature(contextMenu.creature); setContextMenu(null); }}
                    >
                        👁️ Preview
                    </div>
                    <div
                        className="ctx-item"
                        style={{ padding: '8px 12px', cursor: 'pointer', color: '#e57373' }}
                        onClick={() => handleDelete(contextMenu.creature.id)}
                    >
                        🗑️ Delete
                    </div>
                    <div
                        style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: -1 }}
                        onClick={() => setContextMenu(null)}
                    />
                </div>
            )}

            {/* Ability Modal */}
            {selectedAbility && (
                <CreatureAbilityModal
                    ability={selectedAbility}
                    onClose={() => setSelectedAbility(null)}
                />
            )}
        </div>
    );
}
