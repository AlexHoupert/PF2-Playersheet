import React, { useEffect, useMemo, useState } from 'react';
import ItemEditor from './editors/ItemEditor';
import MultiSelectDropdown from '../shared/components/MultiSelectDropdown';
import { SHOP_CATEGORIES } from '../shared/constants/shop';
import { deepClone } from '../shared/utils/deepClone';
import { SHOP_INDEX_FILTER_OPTIONS, SHOP_INDEX_ITEMS } from '../shared/catalog/shopIndex';
import { shouldStack } from '../shared/utils/inventoryUtils';

const uniqueTypes = SHOP_INDEX_FILTER_OPTIONS.types;
const uniqueCategories = SHOP_INDEX_FILTER_OPTIONS.categories;
const uniqueRarities = SHOP_INDEX_FILTER_OPTIONS.rarities;
const uniqueTraits = SHOP_INDEX_FILTER_OPTIONS.traits;

export default function ItemsView({ db, setDb, onInspectItem }) {
    const [itemSearch, setItemSearch] = useState('');
    const [itemFilterType, setItemFilterType] = useState([]);
    const [itemFilterCategory, setItemFilterCategory] = useState([]);
    const [itemFilterRarity, setItemFilterRarity] = useState([]);
    const [itemFilterTraits, setItemFilterTraits] = useState([]);
    const [itemFilterAvailable, setItemFilterAvailable] = useState(false);
    const [itemFilterFormulaAvailable, setItemFilterFormulaAvailable] = useState(false);
    const [itemPage, setItemPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(50);
    const [visibleColumns, setVisibleColumns] = useState(['name', 'level', 'price', 'type', 'rarity']);
    const [showColSelector, setShowColSelector] = useState(false);

    const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' });
    const [selectedItems, setSelectedItems] = useState([]);
    const [lastSelectedIndex, setLastSelectedIndex] = useState(-1);
    const [contextMenu, setContextMenu] = useState(null);

    const [editingItem, setEditingItem] = useState(null); // null = list, {} = create, object = edit

    const [newTraderName, setNewTraderName] = useState('');

    const availableList = db.shop?.availableItems || [];

    const filteredItems = useMemo(() => {
        const searchLower = itemSearch.trim().toLowerCase();
        return SHOP_INDEX_ITEMS.filter(i => {
            if (itemFilterType.length && !itemFilterType.includes(i.type)) return false;
            if (itemFilterCategory.length && !itemFilterCategory.includes(i.category)) return false;
            if (itemFilterRarity.length && !itemFilterRarity.includes(i.rarity)) return false;
            if (itemFilterTraits.length && !itemFilterTraits.every(t => (i.traits?.value || []).includes(t))) return false;

            if (itemFilterAvailable && !(db.shop?.availableItems || []).includes(i.name)) return false;
            if (itemFilterFormulaAvailable && !(db.shop?.availableFormulas || []).includes(i.name)) return false;

            return i.name.toLowerCase().includes(searchLower);
        });
    }, [itemFilterCategory, itemFilterRarity, itemFilterTraits, itemFilterType, itemSearch, itemFilterAvailable, itemFilterFormulaAvailable, db.shop]);

    const sortedItems = useMemo(() => {
        const items = [...filteredItems];
        items.sort((a, b) => {
            let valA = a[sortConfig.key];
            let valB = b[sortConfig.key];
            if (typeof valA === 'object' && valA !== null) valA = valA.value || 0;
            if (typeof valB === 'object' && valB !== null) valB = valB.value || 0;
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
        () => ['name', 'level', 'price', 'damage', 'range', 'type', 'category', 'group', 'rarity', 'traits'],
        []
    );

    const handleSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
        setSortConfig({ key, direction });
    };

    const toggleItemAvailability = (itemName) => {
        setDb(prev => {
            const next = deepClone(prev);
            if (!next.shop) next.shop = { availableItems: [], traders: [], availableFormulas: [] };
            const list = next.shop.availableItems || [];
            next.shop.availableItems = list.includes(itemName)
                ? list.filter(i => i !== itemName)
                : [...list, itemName];
            return next;
        });
    };

    const toggleFormulaAvailability = (itemName) => {
        setDb(prev => {
            const next = deepClone(prev);
            if (!next.shop) next.shop = { availableItems: [], traders: [], availableFormulas: [] };
            const list = next.shop.availableFormulas || [];
            next.shop.availableFormulas = list.includes(itemName)
                ? list.filter(i => i !== itemName)
                : [...list, itemName];
            return next;
        });
    };

    const createTrader = () => {
        const name = newTraderName.trim();
        if (!name) return;
        setDb(prev => {
            const next = deepClone(prev);
            if (!next.shop) next.shop = { availableItems: [], traders: [] };
            next.shop.traders = [
                ...(next.shop.traders || []),
                { id: Date.now(), name, category: SHOP_CATEGORIES[0], inventory: [] }
            ];
            return next;
        });
        setNewTraderName('');
    };

    const deleteTrader = (id) => {
        if (!window.confirm('Delete this trader?')) return;
        setDb(prev => {
            const next = deepClone(prev);
            next.shop.traders = (next.shop.traders || []).filter(t => t.id !== id);
            return next;
        });
    };

    const updateTrader = (id, fn) => {
        setDb(prev => {
            const next = deepClone(prev);
            const traderIndex = (next.shop.traders || []).findIndex(t => t.id === id);
            if (traderIndex === -1) return prev;
            fn(next.shop.traders[traderIndex]);
            return next;
        });
    };

    const handleRowClick = (e, item, index) => {
        if (e.target.type === 'checkbox') return;

        let newSelected = [...selectedItems];
        const name = item.name;

        if (e.ctrlKey || e.metaKey) {
            if (newSelected.includes(name)) newSelected = newSelected.filter(n => n !== name);
            else newSelected.push(name);
            setLastSelectedIndex(index);
        } else if (e.shiftKey && lastSelectedIndex !== -1) {
            const start = Math.min(lastSelectedIndex, index);
            const end = Math.max(lastSelectedIndex, index);
            const range = paginatedItems.slice(start, end + 1).map(i => i.name);
            range.forEach(n => {
                if (!newSelected.includes(n)) newSelected.push(n);
            });
        } else {
            newSelected = [name];
            setLastSelectedIndex(index);
        }

        setSelectedItems(newSelected);
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

    const performContextAction = (action, payload) => {
        const targets = contextMenu?.items || [];
        if (targets.length === 0) return;

        if (action === 'edit') {
            const itemName = targets[0]; // Edit single item
            const item = sortedItems.find(i => i.name === itemName);
            if (item) setEditingItem(item);
            setContextMenu(null);
            return;
        }

        setDb(prev => {
            const next = deepClone(prev);
            if (!next.shop) next.shop = { availableItems: [], traders: [], availableFormulas: [] };

            targets.forEach(itemName => {
                if (action === 'availability') {
                    const list = next.shop.availableItems || [];
                    if (payload === true && !list.includes(itemName)) list.push(itemName);
                    if (payload === false && list.includes(itemName)) {
                        next.shop.availableItems = list.filter(n => n !== itemName);
                    }
                } else if (action === 'formulaAvailability') {
                    if (!next.shop.availableFormulas) next.shop.availableFormulas = [];
                    const list = next.shop.availableFormulas;
                    if (payload === true && !list.includes(itemName)) list.push(itemName);
                    if (payload === false && list.includes(itemName)) {
                        next.shop.availableFormulas = list.filter(n => n !== itemName);
                    }
                } else if (action === 'assignTrader') {
                    const trader = next.shop.traders.find(t => t.id === payload);
                    if (trader) {
                        const existingNames = new Set();
                        trader.inventory.forEach(it => {
                            if (typeof it === 'string') existingNames.add(it);
                            else if (it?.name) existingNames.add(it.name);
                        });
                        if (!existingNames.has(itemName)) trader.inventory.push(itemName);
                    }
                } else if (action === 'givePlayer') {
                    const char = next.characters[payload];
                    if (char) {
                        const stackable = shouldStack({ name: itemName });
                        const existing = stackable ? (char.inventory || []).find(i => i.name === itemName) : null;

                        if (!char.inventory) char.inventory = [];

                        if (existing) existing.qty = (existing.qty || 1) + 1;
                        else char.inventory.push({ name: itemName, qty: 1 });
                    }
                } else if (action === 'giveFormula') {
                    const char = next.characters[payload];
                    if (char) {
                        if (!char.formulaBook) char.formulaBook = [];
                        if (!char.formulaBook.includes(itemName)) {
                            char.formulaBook.push(itemName);
                        }
                    }
                } else if (action === 'addToLoot') {
                    const bag = (next.lootBags || []).find(b => b.id === payload);
                    if (bag) {
                        // Find item details to add full object
                        const fullItem = sortedItems.find(i => i.name === itemName);
                        if (fullItem) {
                            bag.items.push({
                                ...fullItem,
                                instanceId: crypto.randomUUID(),
                                addedAt: Date.now()
                            });
                        }
                    }
                }
            });

            return next;
        });
        setContextMenu(null);
    };

    if (editingItem) {
        return (
            <ItemEditor
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
                    placeholder="Search..."
                    value={itemSearch}
                    onChange={e => {
                        setItemSearch(e.target.value);
                        setItemPage(1);
                    }}
                    style={{ width: 200 }}
                />

                <button className="btn-add-condition" style={{ margin: 0, width: 'auto', background: '#4caf50' }} onClick={() => setEditingItem({})}>
                    + New Item
                </button>

                <MultiSelectDropdown
                    label="Type"
                    options={uniqueTypes}
                    selected={itemFilterType}
                    onChange={(next) => {
                        setItemFilterType(next);
                        setItemPage(1);
                    }}
                />
                <MultiSelectDropdown
                    label="Category"
                    options={uniqueCategories}
                    selected={itemFilterCategory}
                    onChange={(next) => {
                        setItemFilterCategory(next);
                        setItemPage(1);
                    }}
                />
                <MultiSelectDropdown
                    label="Rarity"
                    options={uniqueRarities}
                    selected={itemFilterRarity}
                    onChange={(next) => {
                        setItemFilterRarity(next);
                        setItemPage(1);
                    }}
                />
                <MultiSelectDropdown
                    label="Traits"
                    options={uniqueTraits}
                    selected={itemFilterTraits}
                    onChange={(next) => {
                        setItemFilterTraits(next);
                        setItemPage(1);
                    }}
                />

                <div style={{ display: 'flex', gap: 5 }}>
                    <button
                        className={`btn-add-condition ${itemFilterAvailable ? 'active' : ''}`}
                        style={{ margin: 0, width: 'auto', border: itemFilterAvailable ? '1px solid var(--text-gold)' : '1px solid #444' }}
                        onClick={() => setItemFilterAvailable(p => !p)}
                        title="Show only Available Items"
                    >
                        Avail
                    </button>
                    <button
                        className={`btn-add-condition ${itemFilterFormulaAvailable ? 'active' : ''}`}
                        style={{ margin: 0, width: 'auto', border: itemFilterFormulaAvailable ? '1px solid var(--text-gold)' : '1px solid #444' }}
                        onClick={() => setItemFilterFormulaAvailable(p => !p)}
                        title="Show only Available Formulas"
                    >
                        Formula
                    </button>
                </div>

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
                <div style={{ flex: 3, overflow: 'auto', padding: 10, order: 2 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9em' }}>
                        <thead>
                            <tr style={{ background: '#333', textAlign: 'left' }}>
                                <th style={{ padding: 8 }}>Avail</th>
                                <th style={{ padding: 8 }}>Formula</th>
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
                            {paginatedItems.map((item, idx) => {
                                const isSelected = selectedItems.includes(item.name);
                                return (
                                    <tr
                                        key={idx}
                                        draggable
                                        onDragStart={(e) => {
                                            e.dataTransfer.setData('text/plain', JSON.stringify(item));
                                            e.dataTransfer.effectAllowed = 'copy';
                                            // Optional: Create a drag image if we want
                                        }}
                                        style={{
                                            borderBottom: '1px solid #444',
                                            background: isSelected
                                                ? 'rgba(197, 160, 89, 0.2)'
                                                : (idx % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent'),
                                            cursor: 'grab'
                                        }}
                                        onClick={(e) => handleRowClick(e, item, idx)}
                                        onDoubleClick={() => onInspectItem?.(item)}
                                        onContextMenu={(e) => handleContextMenu(e, item, idx)}
                                    >
                                        <td style={{ padding: 8 }}>
                                            <input
                                                type="checkbox"
                                                checked={availableList.includes(item.name)}
                                                onChange={(e) => {
                                                    e.stopPropagation();
                                                    toggleItemAvailability(item.name);
                                                }}
                                                onClick={(e) => e.stopPropagation()}
                                            />
                                        </td>
                                        <td style={{ padding: 8 }}>
                                            <input
                                                type="checkbox"
                                                checked={(db.shop?.availableFormulas || []).includes(item.name)}
                                                onChange={(e) => {
                                                    e.stopPropagation();
                                                    toggleFormulaAvailability(item.name);
                                                }}
                                                onClick={(e) => e.stopPropagation()}
                                            />
                                        </td>
                                        {visibleColumns.map(c => (
                                            <td key={c} style={{ padding: 8 }}>
                                                {c === 'price' ? `${item.price} gp` :
                                                    c === 'traits' ? (item.traits?.value?.join(', ') || '-') :
                                                        c === 'damage' ? (item.damage ? (typeof item.damage === 'string' ? item.damage : `${item.damage.dice}${item.damage.die} ${item.damage.damageType}`) : '-') :
                                                            c === 'range' ? (item.range ? `${item.range} ft` : '-') :
                                                                item[c]
                                                }
                                            </td>
                                        ))}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>

                    <div style={{ marginTop: 10, display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'center' }}>
                        <button disabled={currentPage === 1} onClick={() => setItemPage(p => Math.max(1, p - 1))}>Prev</button>
                        <span>Page {currentPage} of {totalPages}</span>
                        <button disabled={currentPage === totalPages} onClick={() => setItemPage(p => Math.min(totalPages, p + 1))}>Next</button>
                    </div>
                </div>

                <div style={{ flex: 1, background: '#1a1a1d', borderRight: '1px solid #444', padding: 10, overflow: 'auto', order: 1, display: 'flex', flexDirection: 'column', gap: 20 }}>

                    {/* TRADERS SECTION */}
                    <div>
                        <h3>Traders</h3>
                        <div style={{ display: 'flex', gap: 5, marginBottom: 15 }}>
                            <input className="modal-input" placeholder="New Trader Name" value={newTraderName} onChange={e => setNewTraderName(e.target.value)} />
                            <button className="btn-add-condition" style={{ margin: 0 }} onClick={createTrader}>+</button>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {(db.shop?.traders || []).map(trader => (
                                <div key={trader.id} style={{ background: '#2b2b2e', padding: 10, borderRadius: 4, border: '1px solid #444' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                                        <select
                                            className="modal-input"
                                            style={{ width: 'auto' }}
                                            value={trader.category}
                                            onChange={e => updateTrader(trader.id, t => { t.category = e.target.value; })}
                                        >
                                            {SHOP_CATEGORIES.map(cat => (
                                                <option key={cat} value={cat}>{cat}</option>
                                            ))}
                                        </select>

                                        {trader.name}
                                        <button style={{ background: 'none', border: 'none', cursor: 'pointer' }} onClick={() => deleteTrader(trader.id)}>🗑️</button>
                                    </div>
                                    <div style={{ fontSize: '0.8em', color: '#888' }}>{trader.inventory.length} items assigned</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* LOOT BAGS SECTION */}
                    <div style={{ borderTop: '1px solid #444', paddingTop: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3>Loot Bags 💰</h3>
                            <button className="btn-add-condition" style={{ margin: 0, padding: '2px 8px' }} onClick={() => {
                                const name = prompt("Bag Name:");
                                if (name) setDb(prev => ({ ...prev, lootBags: [...(prev.lootBags || []), { id: crypto.randomUUID(), name, items: [], isLocked: true }] }));
                            }}>+</button>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
                            {(db.lootBags || []).map(bag => (
                                <div
                                    key={bag.id}
                                    style={{ background: '#222', padding: 10, borderRadius: 4, border: `1px solid ${bag.isLocked ? '#d32f2f' : '#4caf50'}` }}
                                    onDragOver={e => e.preventDefault()}
                                    onDrop={e => {
                                        e.preventDefault();
                                        try {
                                            const data = JSON.parse(e.dataTransfer.getData('text/plain'));
                                            if (data && data.name) { // Simple check, dropped items are just the item object
                                                const itemToAdd = data;
                                                setDb(prev => {
                                                    const newDb = deepClone(prev);
                                                    const targetBag = (newDb.lootBags || []).find(b => b.id === bag.id);
                                                    if (targetBag) {
                                                        targetBag.items.push({ ...itemToAdd, instanceId: crypto.randomUUID() });
                                                    }
                                                    return newDb;
                                                });
                                            }
                                        } catch (err) { console.error("Failed to drop item:", err); }
                                    }}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontWeight: 'bold' }}>{bag.name}</span>
                                        <div style={{ display: 'flex', gap: 5 }}>
                                            <button
                                                className="icon-btn"
                                                title={bag.isLocked ? "Locked (Hidden)" : "Unlocked (Visible)"}
                                                onClick={() => setDb(prev => {
                                                    const newDb = deepClone(prev);
                                                    const bags = newDb.lootBags || [];
                                                    const b = bags.find(x => x.id === bag.id);
                                                    if (b) b.isLocked = !b.isLocked;
                                                    return newDb;
                                                })}
                                            >
                                                {bag.isLocked ? '🔒' : '🔓'}
                                            </button>
                                            <button className="icon-btn" style={{ color: '#d32f2f' }} onClick={() => {
                                                if (confirm('Delete Bag?')) setDb(prev => ({ ...prev, lootBags: prev.lootBags.filter(b => b.id !== bag.id) }));
                                            }}>🗑️</button>
                                        </div>
                                    </div>
                                    <div style={{ fontSize: '0.8em', color: '#888', marginTop: 4 }}>
                                        {bag.items.length} items • {bag.isLocked ? 'Hidden' : 'Visible'}
                                    </div>
                                    {/* List items briefly */}
                                    {bag.items.length > 0 && (
                                        <div style={{ marginTop: 5, fontSize: '0.75em', maxHeight: 60, overflowY: 'auto' }}>
                                            {bag.items.map((it, idx) => {
                                                const isClaimed = Boolean(it.claimedBy);
                                                return (
                                                    <div key={it.instanceId || idx} style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                        <span style={{
                                                            textDecoration: isClaimed ? 'line-through' : 'none',
                                                            color: isClaimed ? '#666' : '#bfbfbf',
                                                            flex: 1
                                                        }}>
                                                            {it.name}
                                                            {isClaimed && <span style={{
                                                                display: 'inline-block',
                                                                marginLeft: 5,
                                                                fontSize: '0.8em',
                                                                background: '#333',
                                                                padding: '1px 4px',
                                                                borderRadius: 2,
                                                                textDecoration: 'none',
                                                                color: '#c5a059'
                                                            }}>
                                                                Taken by {it.claimedBy}
                                                            </span>}
                                                        </span>
                                                        <span style={{ cursor: 'pointer', color: '#d32f2f' }} onClick={() => setDb(p => {
                                                            const bags = [...(p.lootBags || [])];
                                                            const b = bags.find(x => x.id === bag.id);
                                                            if (b) b.items = b.items.filter((_, i) => i !== idx);
                                                            return { ...p, lootBags: bags };
                                                        })}>×</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
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
                            minWidth: 180,
                            boxShadow: '0 2px 10px rgba(0,0,0,0.5)'
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="ctx-item" onClick={() => performContextAction('availability', true)}>Make Available</div>
                        <div className="ctx-item" onClick={() => performContextAction('availability', false)}>Make Unavailable</div>
                        <div style={{ borderTop: '1px solid #444', margin: '2px 0' }}></div>
                        <div className="ctx-item" onClick={() => performContextAction('formulaAvailability', true)}>Make Formula Available</div>
                        <div className="ctx-item" onClick={() => performContextAction('formulaAvailability', false)}>Make Formula Unavailable</div>
                        <div style={{ borderTop: '1px solid #444', margin: '2px 0' }}></div>
                        <div className="ctx-item" onClick={() => performContextAction('edit')}>Edit Item</div>
                        <div style={{ borderTop: '1px solid #444', margin: '2px 0' }}></div>

                        <div className="ctx-header">Assign to Trader</div>
                        {db.shop.traders.map(t => (
                            <div key={t.id} className="ctx-item sub" onClick={() => performContextAction('assignTrader', t.id)}>{t.name}</div>
                        ))}
                        {db.shop.traders.length === 0 && <div className="ctx-item sub disabled">No Traders</div>}

                        <div style={{ borderTop: '1px solid #444', margin: '2px 0' }}></div>
                        <div className="ctx-header">Add to Loot Bag</div>
                        {(db.lootBags || []).map(b => (
                            <div key={b.id} className="ctx-item sub" onClick={() => performContextAction('addToLoot', b.id)}>{b.name}</div>
                        ))}
                        {(!db.lootBags || db.lootBags.length === 0) && <div className="ctx-item sub disabled">No Loot Bags</div>}

                        <div style={{ borderTop: '1px solid #444', margin: '2px 0' }}></div>
                        <div className="ctx-header">Give to Player</div>
                        {db.characters.map((c, i) => (
                            <div key={c.id} className="ctx-item sub" onClick={() => performContextAction('givePlayer', i)}>{c.name}</div>
                        ))}

                        <div style={{ borderTop: '1px solid #444', margin: '2px 0' }}></div>
                        <div className="ctx-header">Give Formula to Player</div>
                        {db.characters.map((c, i) => (
                            <div key={c.id} className="ctx-item sub" onClick={() => performContextAction('giveFormula', i)}>{c.name}</div>
                        ))}

                        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: -1 }} onClick={() => setContextMenu(null)}></div>
                    </div>
                )
            }
            <style>{`.ctx-item { padding: 8px 12px; cursor: pointer; } .ctx-item:hover { background: #444; } .ctx-item.sub { padding-left: 20px; font-size: 0.9em; } .ctx-header { padding: 4px 12px; color: #888; font-size: 0.75em; text-transform: uppercase; } .ctx-item.disabled { color: #666; cursor: default; }`}</style>
        </div >
    );
}
