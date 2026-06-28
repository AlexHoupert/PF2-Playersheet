import React, { useEffect, useMemo, useState } from 'react';
import SpellEditor, { buildSpellOverride } from './editors/SpellEditor';
import MultiSelectDropdown from '../shared/components/MultiSelectDropdown';
import BottomSheet from '../shared/components/BottomSheet';
import ContentPreviewCard from './components/ContentPreviewCard';
import { useWindowSize } from '../shared/hooks/useWindowSize';
import { SPELL_INDEX_FILTER_OPTIONS, SPELL_INDEX_ITEMS, fetchSpellDetailBySourceFile, fetchSpellRawJsonBySourceFile, normalizeSpellSourceFile } from '../shared/catalog/spellIndex';
import { readJsonApiResponse } from '../shared/utils/apiResponse';
import { useCampaign } from '../shared/context/CampaignContext';
import { useAppFeedback } from '../shared/feedback/AppFeedback';
import { mergeCatalogIndexWithOverrides } from '../shared/db/selectors/catalogOverrideSelectors';

const uniqueTypes = SPELL_INDEX_FILTER_OPTIONS.types;
const uniqueRarities = SPELL_INDEX_FILTER_OPTIONS.rarities;
const uniqueTraditions = SPELL_INDEX_FILTER_OPTIONS.traditions;
const uniqueTraits = SPELL_INDEX_FILTER_OPTIONS.traits;

export default function SpellsView({ onInspectItem }) {
    const { isMobile } = useWindowSize();
    const { db, dataActions } = useCampaign();
    const { notifyError } = useAppFeedback();

    const [itemSearch, setItemSearch] = useState('');
    const [filterType, setFilterType] = useState([]);
    const [filterRarity, setFilterRarity] = useState([]);
    const [filterTraditions, setFilterTraditions] = useState([]);
    const [filterTraits, setFilterTraits] = useState([]);
    const [itemPage, setItemPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(50);
    const [visibleColumns, setVisibleColumns] = useState(['name', 'level', 'traditions', 'rarity', 'scroll', 'wand']);
    const [showColSelector, setShowColSelector] = useState(false);

    const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' });

    const [editingItem, setEditingItem] = useState(null);
    const [contextMenu, setContextMenu] = useState(null);
    const [lastSelectedIndex, setLastSelectedIndex] = useState(-1);
    const [selectedItems, setSelectedItems] = useState([]);

    // Preview state
    const [previewItem, setPreviewItem] = useState(null);
    const [loadedDetail, setLoadedDetail] = useState(null);

    // Fetch full detail when preview item changes
    useEffect(() => {
        if (!previewItem?.sourceFile) { setLoadedDetail(null); return; }
        setLoadedDetail(null);
        fetchSpellDetailBySourceFile(previewItem.sourceFile)
            .then(detail => setLoadedDetail(detail))
            .catch(err => console.error('Failed to load spell detail', err));
    }, [previewItem?.sourceFile]);

    const catalogItems = useMemo(
        () => mergeCatalogIndexWithOverrides(SPELL_INDEX_ITEMS, db, 'spell'),
        [db]
    );

    const filteredItems = useMemo(() => {
        const searchLower = itemSearch.trim().toLowerCase();
        return catalogItems.filter(i => {
            if (filterType.length && !filterType.includes(i.type)) return false;
            if (filterRarity.length && !filterRarity.includes(i.rarity)) return false;
            if (filterTraditions.length && !filterTraditions.some(t => (i.traditions || []).includes(t))) return false;
            if (filterTraits.length && !filterTraits.every(t => (i.traits || []).includes(t))) return false;
            return i.name.toLowerCase().includes(searchLower);
        });
    }, [catalogItems, filterType, filterRarity, filterTraditions, filterTraits, itemSearch]);

    const sortedItems = useMemo(() => {
        const items = [...filteredItems];
        items.sort((a, b) => {
            let valA = a[sortConfig.key];
            let valB = b[sortConfig.key];
            if (sortConfig.key === 'traditions' || sortConfig.key === 'traits') {
                valA = (valA || []).join(', ');
                valB = (valB || []).join(', ');
            }
            if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
            if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
        return items;
    }, [filteredItems, sortConfig.direction, sortConfig.key]);

    const totalPages = useMemo(
        () => Math.max(1, Math.ceil(sortedItems.length / itemsPerPage)),
        [sortedItems.length, itemsPerPage]
    );

    const currentPage = Math.min(itemPage, totalPages);
    const paginatedItems = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        return sortedItems.slice(startIndex, startIndex + itemsPerPage);
    }, [currentPage, itemsPerPage, sortedItems]);

    useEffect(() => {
        if (itemPage !== currentPage) setItemPage(currentPage);
    }, [currentPage, itemPage]);

    const allColumns = useMemo(
        () => ['name', 'level', 'type', 'traditions', 'rarity', 'traits', 'scroll', 'wand'],
        []
    );

    const handleSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
        setSortConfig({ key, direction });
    };

    const handleToggleProperty = async (e, item, property, currentVal) => {
        e.stopPropagation();
        const newVal = !currentVal;

        try {
            if (!item.sourceFile) {
                console.error("No source file for spell", item);
                notifyError("Cannot modify this spell: Source file not found.");
                return;
            }

            // 1. Fetch RAW JSON
            const spellJson = await fetchSpellRawJsonBySourceFile(item.sourceFile);

            // 2. Modify
            if (!spellJson.system) spellJson.system = {};
            spellJson.system[property] = newVal;

            const spellOverride = buildSpellOverride(spellJson, spellJsonToEditorFormData(spellJson, item), item);
            const saveToDb = async () => {
                await dataActions.catalogOverride.saveCatalogOverride(spellOverride);
                setPreviewItem(prev => prev?.sourceFile === item.sourceFile ? { ...prev, [property]: newVal } : prev);
                setLoadedDetail(prev => prev ? { ...prev, system: { ...(prev.system || {}), [property]: newVal } } : prev);
            };

            if (import.meta.env.PROD) {
                await saveToDb();
                return;
            }

            // 3. Save
            const saveRes = await fetch('/api/files/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    filePath: `ressources/${normalizeSpellSourceFile(item.sourceFile)}`,
                    content: spellJson
                })
            });
            const saveData = await readJsonApiResponse(saveRes, 'Save spell availability');
            if (!saveData.success) throw new Error(saveData.error);

            // 4. Rebuild Index
            await fetch('/api/admin/rebuild-index/spells', { method: 'POST' });

            // 5. Reload
            window.location.reload();

        } catch (err) {
            if (dataActions?.catalogOverride?.saveCatalogOverride) {
                try {
                    const spellJson = await fetchSpellRawJsonBySourceFile(item.sourceFile);
                    if (!spellJson.system) spellJson.system = {};
                    spellJson.system[property] = newVal;
                    await dataActions.catalogOverride.saveCatalogOverride(
                        buildSpellOverride(spellJson, spellJsonToEditorFormData(spellJson, item), item)
                    );
                    return;
                } catch (dbErr) {
                    console.error(dbErr);
                    notifyError(`Error updating spell: ${err.message}; DB fallback failed: ${dbErr.message}`);
                    return;
                }
            }
            console.error(err);
            notifyError(`Error updating spell: ${err.message}`);
        }
    };

    const handleRowClick = (item) => {
        // Desktop: single click opens preview side panel
        // Mobile: single click just selects
        if (!isMobile) {
            setPreviewItem(item);
        }
    };

    const handleRowDoubleClick = (item) => {
        if (isMobile) {
            // Mobile: double tap opens preview
            setPreviewItem(item);
        } else {
            // Desktop: double click opens editor
            setEditingItem(item);
        }
    };

    const handleContextMenu = (e, item, index) => {
        e.preventDefault();
        let newSelected = [...selectedItems];
        if (!newSelected.includes(item.name)) {
            newSelected = [item.name];
            setSelectedItems(newSelected);
            setLastSelectedIndex(index);
        }
        setContextMenu({ x: e.clientX, y: e.clientY, items: newSelected, item });
    };

    const performContextAction = (action) => {
        const item = contextMenu?.item;
        if (!item) return;

        if (action === 'edit') {
            setEditingItem(item);
            setPreviewItem(null);
        } else if (action === 'preview') {
            setPreviewItem(item);
        }
        setContextMenu(null);
    };

    if (editingItem) {
        return (
            <SpellEditor
                initialItem={Object.keys(editingItem).length === 0 ? null : editingItem}
                onSave={(result) => {
                    setEditingItem(null);
                    if (!String(result?.message || '').includes('database')) window.location.reload();
                }}
                onSaveToDb={(override) => dataActions.catalogOverride.saveCatalogOverride(override)}
                onCancel={() => setEditingItem(null)}
            />
        );
    }

    // Preview content
    const previewContent = previewItem ? (
        <ContentPreviewCard
            item={loadedDetail || previewItem}
            entityType="spell"
            onEdit={() => { setEditingItem(previewItem); setPreviewItem(null); }}
            onClose={() => setPreviewItem(null)}
        />
    ) : null;

    return (
        <div className="admin-layout" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
            <div style={{ padding: 10, background: '#222', borderBottom: '1px solid #444', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <input
                    className="modal-input"
                    placeholder="Search Spells..."
                    value={itemSearch}
                    onChange={e => {
                        setItemSearch(e.target.value);
                        setItemPage(1);
                    }}
                    style={{ width: 200 }}
                />

                <button className="btn-add-condition" style={{ margin: 0, width: 'auto', background: '#4caf50' }} onClick={() => setEditingItem({})}>
                    + New Spell
                </button>

                <MultiSelectDropdown
                    label="Type"
                    options={uniqueTypes}
                    selected={filterType}
                    onChange={(next) => { setFilterType(next); setItemPage(1); }}
                />
                <MultiSelectDropdown
                    label="Rarity"
                    options={uniqueRarities}
                    selected={filterRarity}
                    onChange={(next) => { setFilterRarity(next); setItemPage(1); }}
                />
                <MultiSelectDropdown
                    label="Traditions"
                    options={uniqueTraditions}
                    selected={filterTraditions}
                    onChange={(next) => { setFilterTraditions(next); setItemPage(1); }}
                />
                <MultiSelectDropdown
                    label="Traits"
                    options={uniqueTraits}
                    selected={filterTraits}
                    onChange={(next) => { setFilterTraits(next); setItemPage(1); }}
                />

                <div style={{ position: 'relative' }}>
                    <button className="btn-add-condition" style={{ margin: 0, width: 'auto' }} onClick={() => setShowColSelector(!showColSelector)}>
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
                    onChange={(e) => {
                        setItemsPerPage(Number(e.target.value));
                        setItemPage(1);
                    }}
                >
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                </select>
            </div>

            {/* Table + Side panel */}
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
                            {paginatedItems.map((item, idx) => (
                                <tr
                                    key={idx}
                                    style={{
                                        borderBottom: '1px solid #444',
                                        background: previewItem?.name === item.name
                                            ? 'rgba(197,160,89,0.1)'
                                            : (idx % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent'),
                                        cursor: 'pointer'
                                    }}
                                    onClick={() => handleRowClick(item)}
                                    onDoubleClick={() => handleRowDoubleClick(item)}
                                    onContextMenu={(e) => handleContextMenu(e, item, idx)}
                                >
                                    {visibleColumns.map(c => (
                                        <td key={c} style={{ padding: 8 }}>
                                            {c === 'traditions' ? (item.traditions?.join(', ') || '-') :
                                                c === 'traits' ? (item.traits?.join(', ') || '-') :
                                                    (c === 'scroll' || c === 'wand') ? (
                                                        <input
                                                            type="checkbox"
                                                            checked={item[c === 'scroll' ? 'scroll_available' : 'wand_available'] || false}
                                                            onClick={e => e.stopPropagation()}
                                                            onChange={e => handleToggleProperty(e, item, c === 'scroll' ? 'scroll_available' : 'wand_available', item[c === 'scroll' ? 'scroll_available' : 'wand_available'])}
                                                            title={`Toggle ${c} availability`}
                                                        />
                                                    ) : item[c] || '-'}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    <div style={{ marginTop: 10, display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'center' }}>
                        <button disabled={currentPage === 1} onClick={() => setItemPage(p => Math.max(1, p - 1))}>Prev</button>
                        <span>Page {currentPage} of {totalPages}</span>
                        <button disabled={currentPage === totalPages} onClick={() => setItemPage(p => Math.min(totalPages, p + 1))}>Next</button>
                    </div>
                </div>

                {/* Desktop side preview panel */}
                {!isMobile && previewItem && (
                    <div style={{ width: 420, borderLeft: '1px solid #444', overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: 16 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                            <h4 style={{ margin: 0, color: '#aaa' }}>Preview</h4>
                            <button onClick={() => setPreviewItem(null)} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer' }}>✕</button>
                        </div>
                        {previewContent}
                    </div>
                )}
            </div>

            {/* Mobile preview BottomSheet */}
            {isMobile && (
                <BottomSheet
                    isOpen={!!previewItem}
                    onClose={() => setPreviewItem(null)}
                    title={previewItem?.name || 'Preview'}
                    height="85vh"
                >
                    {previewContent}
                </BottomSheet>
            )}

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
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="ctx-item" style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #444' }} onClick={() => performContextAction('preview')}>👁️ Preview</div>
                    <div className="ctx-item" style={{ padding: '8px 12px', cursor: 'pointer' }} onClick={() => performContextAction('edit')}>✏️ Edit Spell</div>
                    <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: -1 }} onClick={() => setContextMenu(null)}></div>
                </div>
            )}
        </div >
    );
}

function spellJsonToEditorFormData(spellJson, item) {
    const system = spellJson?.system || {};
    const traits = system.traits || {};
    return {
        name: spellJson?.name || item?.name || '',
        level: system.level?.value ?? item?.level ?? 0,
        traditions: traits.traditions || item?.traditions || [],
        traits: traits.value || item?.traits || [],
        rarity: traits.rarity || item?.rarity || 'common',
        time: system.time?.value || item?.time || item?.cast || '',
        range: system.range?.value || item?.range || '',
        target: system.target?.value || item?.target || '',
        area: system.area?.value || item?.area || '',
        duration: system.duration?.value || item?.duration || '',
        defense: system.defense?.save?.statistic || item?.defense || '',
        description: system.description?.value || item?.description || '',
        sourceFile: item?.sourceFile || null
    };
}
