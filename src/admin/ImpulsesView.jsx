import React, { useEffect, useMemo, useState } from 'react';
import ImpulseEditor from './editors/ImpulseEditor';
import MultiSelectDropdown from '../shared/components/MultiSelectDropdown';
import { IMPULSE_INDEX_FILTER_OPTIONS, IMPULSE_INDEX_ITEMS } from '../shared/catalog/impulseIndex';

const uniqueTypes = IMPULSE_INDEX_FILTER_OPTIONS.types;
const uniqueRarities = IMPULSE_INDEX_FILTER_OPTIONS.rarities;
const uniqueTraditions = IMPULSE_INDEX_FILTER_OPTIONS.traditions;
const uniqueTraits = IMPULSE_INDEX_FILTER_OPTIONS.traits;
const uniqueSchools = IMPULSE_INDEX_FILTER_OPTIONS.schools;

export default function ImpulsesView({ onInspectItem }) {
    const [itemSearch, setItemSearch] = useState('');
    const [filterType, setFilterType] = useState([]);
    const [filterRarity, setFilterRarity] = useState([]);
    const [filterTraditions, setFilterTraditions] = useState([]);
    const [filterTraits, setFilterTraits] = useState([]);
    const [filterSchool, setFilterSchool] = useState([]);
    const [itemPage, setItemPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(50);
    const [visibleColumns, setVisibleColumns] = useState(['name', 'level', 'traits', 'rarity']);
    const [showColSelector, setShowColSelector] = useState(false);

    const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' });

    const [editingItem, setEditingItem] = useState(null);
    const [contextMenu, setContextMenu] = useState(null);
    const [lastSelectedIndex, setLastSelectedIndex] = useState(-1);
    const [selectedItems, setSelectedItems] = useState([]);

    const filteredItems = useMemo(() => {
        const searchLower = itemSearch.trim().toLowerCase();
        return IMPULSE_INDEX_ITEMS.filter(i => {
            if (filterType.length && !filterType.includes(i.type)) return false;
            if (filterRarity.length && !filterRarity.includes(i.rarity)) return false;
            if (filterSchool.length && !filterSchool.includes(i.school)) return false;
            if (filterTraditions.length && !filterTraditions.some(t => i.traditions.includes(t))) return false;
            if (filterTraits.length && !filterTraits.every(t => i.traits.includes(t))) return false;
            return i.name.toLowerCase().includes(searchLower);
        });
    }, [filterType, filterRarity, filterTraditions, filterTraits, filterSchool, itemSearch]);

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
        () => ['name', 'level', 'type', 'traditions', 'school', 'rarity', 'traits'],
        []
    );

    const handleSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
        setSortConfig({ key, direction });
    };

    const handleContextMenu = (e, item, index) => {
        e.preventDefault();
        let newSelected = [...selectedItems];
        if (!newSelected.includes(item.name)) {
            newSelected = [item.name];
            setSelectedItems(newSelected);
            setLastSelectedIndex(index);
        }
        setContextMenu({ x: e.clientX, y: e.clientY, items: newSelected });
    };

    const performContextAction = (action) => {
        const targets = contextMenu?.items || [];
        if (targets.length === 0) return;

        if (action === 'edit') {
            const itemName = targets[0];
            const item = sortedItems.find(i => i.name === itemName);
            if (item) setEditingItem(item);
        }
        setContextMenu(null);
    };

    if (editingItem) {
        return (
            <ImpulseEditor
                initialItem={Object.keys(editingItem).length === 0 ? null : editingItem}
                onSave={() => window.location.reload()}
                onCancel={() => setEditingItem(null)}
            />
        );
    }

    return (
        <div className="admin-layout" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
            <div style={{ padding: 10, background: '#222', borderBottom: '1px solid #444', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <input
                    className="modal-input"
                    placeholder="Search Impulses..."
                    value={itemSearch}
                    onChange={e => {
                        setItemSearch(e.target.value);
                        setItemPage(1);
                    }}
                    style={{ width: 200 }}
                />

                <button className="btn-add-condition" style={{ margin: 0, width: 'auto', background: '#4caf50' }} onClick={() => setEditingItem({})}>
                    + New Impulse
                </button>

                <MultiSelectDropdown
                    label="Rarity"
                    options={uniqueRarities}
                    selected={filterRarity}
                    onChange={(next) => { setFilterRarity(next); setItemPage(1); }}
                />
                <MultiSelectDropdown
                    label="Traits"
                    options={uniqueTraits}
                    selected={filterTraits}
                    onChange={(next) => { setFilterTraits(next); setItemPage(1); }}
                />
                {/* Impulses often don't user School/Traditions, but we leave them as optional filters */}
                {uniqueSchools && uniqueSchools.length > 0 && <MultiSelectDropdown
                    label="School/Element"
                    options={uniqueSchools}
                    selected={filterSchool}
                    onChange={(next) => { setFilterSchool(next); setItemPage(1); }}
                />}

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
                                        background: (idx % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent'),
                                        cursor: 'pointer'
                                    }}
                                    onDoubleClick={() => onInspectItem?.(item)}
                                    onContextMenu={(e) => handleContextMenu(e, item, idx)}
                                >
                                    {visibleColumns.map(c => (
                                        <td key={c} style={{ padding: 8 }}>
                                            {c === 'traditions' ? (item.traditions?.join(', ') || '-') :
                                                c === 'traits' ? (item.traits?.join(', ') || '-') :
                                                    item[c] || '-'
                                            }
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
            </div>


            {
                contextMenu && (
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
                        <div className="ctx-item" style={{ padding: '8px 12px', cursor: 'pointer' }} onClick={() => performContextAction('edit')}>Edit Impulse</div>
                        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: -1 }} onClick={() => setContextMenu(null)}></div>
                    </div>
                )
            }
        </div >
    );
}
