import React, { useEffect, useMemo, useState } from 'react';
import { useCampaign } from '../shared/context/CampaignContext';
import ItemEditor from './editors/ItemEditor';
import MultiSelectDropdown from '../shared/components/MultiSelectDropdown';
import { SHOP_CATEGORIES } from '../shared/constants/shop';
import { deepClone } from '../shared/utils/deepClone';
import { SHOP_INDEX_FILTER_OPTIONS, SHOP_INDEX_ITEMS, fetchShopItemDetailBySourceFile } from '../shared/catalog/shopIndex';
import { shouldStack } from '../shared/utils/inventoryUtils';
import SpellScrollSelectorModal from '../player/modals/SpellScrollSelectorModal';

const uniqueTypes = SHOP_INDEX_FILTER_OPTIONS.types;
const uniqueCategories = SHOP_INDEX_FILTER_OPTIONS.categories;
const uniqueRarities = SHOP_INDEX_FILTER_OPTIONS.rarities;
const uniqueTraits = SHOP_INDEX_FILTER_OPTIONS.traits;
// Extract unique groups dynamically
const uniqueGroups = Array.from(new Set(SHOP_INDEX_ITEMS.map(i => i.group).filter(Boolean))).sort();

export default function ItemsView({ db, setDb, onInspectItem }) {
    const { activeCampaign } = useCampaign();
    const [itemSearch, setItemSearch] = useState('');
    const [itemFilterType, setItemFilterType] = useState([]);
    const [itemFilterCategory, setItemFilterCategory] = useState([]);
    const [itemFilterRarity, setItemFilterRarity] = useState([]);
    const [itemFilterTraits, setItemFilterTraits] = useState([]);
    const [itemFilterGroup, setItemFilterGroup] = useState([]); // NEW Group Filter
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
    const [scrollSelectorData, setScrollSelectorData] = useState(null);

    const [newTraderName, setNewTraderName] = useState('');

    // --- SPLIT VIEW STATE ---
    const [inspectingTraderId, setInspectingTraderId] = useState(null);
    const [inspectingLootId, setInspectingLootId] = useState(null);
    const [applyFiltersToInspector, setApplyFiltersToInspector] = useState(false);
    const [inspectorSortConfig, setInspectorSortConfig] = useState({ key: 'name', direction: 'asc' });

    const availableList = db.shop?.availableItems || [];

    // Helper to filter items
    const getFilteredItems = (items) => {
        const searchLower = itemSearch.trim().toLowerCase();
        return items.filter(i => {
            if (itemFilterType.length && !itemFilterType.includes(i.type)) return false;
            // Trader/Loot items might not have all fields populated if they are simple objects, 
            // but for full items they should.
            // (The derivation logic below ensures they are resolved against SHOP_INDEX_ITEMS).

            if (itemFilterCategory.length && !itemFilterCategory.includes(i.category)) return false;
            if (itemFilterRarity.length && !itemFilterRarity.includes(i.rarity)) return false;
            if (itemFilterTraits.length && !itemFilterTraits.every(t => (i.traits?.value || []).includes(t))) return false;
            if (itemFilterGroup.length && !itemFilterGroup.includes(i.group)) return false;

            if (itemFilterAvailable && !(db.shop?.availableItems || []).includes(i.name)) return false;
            if (itemFilterFormulaAvailable && !(db.shop?.availableFormulas || []).includes(i.name)) return false;

            return i.name.toLowerCase().includes(searchLower);
        });
    };

    // Helper to sort items
    const getSortedItems = (items, config) => {
        const copy = [...items];
        copy.sort((a, b) => {
            let valA = a[config.key];
            let valB = b[config.key];
            if (typeof valA === 'object' && valA !== null) valA = valA.value || 0;
            if (typeof valB === 'object' && valB !== null) valB = valB.value || 0;
            if (valA < valB) return config.direction === 'asc' ? -1 : 1;
            if (valA > valB) return config.direction === 'asc' ? 1 : -1;
            return 0;
        });
        return copy;
    };

    // Global List
    const filteredGlobalItems = useMemo(() => {
        // Merge custom items from DB
        const customItemsRaw = Object.values(db.shop?.customItems || {});
        const flatCustomItems = customItemsRaw.map(i => ({
            name: i.name,
            level: i.system?.level?.value ?? 0,
            price: i.system?.price?.value?.gp ?? 0,
            type: i.type ? (i.type.charAt(0).toUpperCase() + i.type.slice(1)) : 'Item',
            category: i.system?.category || '',
            group: i.system?.group || '',
            rarity: i.system?.traits?.rarity || 'common',
            traits: { value: i.system?.traits?.value || [] },
            description: i.system?.description?.value,
            bulk: i.system?.bulk?.value,
            img: i.img,
            sourceFile: null,
            isCustom: true,
            // Store full data for editing
            data: i
        }));

        // Combine with static index
        // Prefer custom items if names collide? Or show both? Name collision issues.
        // Set deduplication preferred specific to this view?
        // Let's just concat for now.
        const combined = [...flatCustomItems, ...SHOP_INDEX_ITEMS];

        return getFilteredItems(combined);
    }, [itemFilterCategory, itemFilterRarity, itemFilterTraits, itemFilterType, itemFilterGroup, itemSearch, itemFilterAvailable, itemFilterFormulaAvailable, db.shop]);

    const sortedGlobalItems = useMemo(() => {
        return getSortedItems(filteredGlobalItems, sortConfig);
    }, [filteredGlobalItems, sortConfig]);

    const totalPages = useMemo(
        () => Math.max(1, Math.ceil(sortedGlobalItems.length / itemsPerPage)),
        [sortedGlobalItems.length, itemsPerPage]
    );

    const currentPage = Math.min(itemPage, totalPages);
    const paginatedItems = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        return sortedGlobalItems.slice(startIndex, startIndex + itemsPerPage);
    }, [currentPage, itemsPerPage, sortedGlobalItems]);

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

    const handleInspectorSort = (key) => {
        let direction = 'asc';
        if (inspectorSortConfig.key === key && inspectorSortConfig.direction === 'asc') direction = 'desc';
        setInspectorSortConfig({ key, direction });
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
        if (inspectingTraderId === id) setInspectingTraderId(null);
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
        } else if (e.shiftKey && lastSelectedIndex !== -1 && index >= 0) {
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

        // Smart Positioning
        let x = e.clientX;
        let y = e.clientY;
        const winH = window.innerHeight;
        // Determine if we should open upwards (if in bottom 40% of screen)
        const openUpwards = y > winH * 0.6;

        // Adjust Y for bottom alignment if opening upwards is better
        // We can't know exact height, but we can set `bottom` style instead of `top`
        // or just offset y.

        setContextMenu({ x, y, items: newSelected, openUpwards });
    };

    const performContextAction = (action, payload, itemOverride = null) => {
        // Resolve targets to Item Objects
        let targets = [];
        if (itemOverride) {
            targets = [itemOverride];
        } else {
            const names = contextMenu?.items || [];
            targets = names.map(name => {
                return sortedGlobalItems.find(i => i.name === name) || SHOP_INDEX_ITEMS.find(i => i.name === name) || { name };
            });
        }

        if (targets.length === 0) return;

        // SCROLL CHECK (Only if not already overridden)
        if (!itemOverride && (action === 'addToLoot' || action === 'givePlayer' || action === 'assignTrader')) {
            const firstScroll = targets.find(i => i.name.match(/(?:Scroll of Rank (\d+)|Scroll of (\d+)(?:st|nd|rd|th)?-rank Spell)|(?:Wand of Rank (\d+)|Magic Wand \((\d+)(?:st|nd|rd|th)?-Rank Spell\))/i));
            if (firstScroll) {
                const scrollMatch = firstScroll.name.match(/(?:Scroll of Rank (\d+)|Scroll of (\d+)(?:st|nd|rd|th)?-rank Spell)/i);
                const wandMatch = firstScroll.name.match(/(?:Wand of Rank (\d+)|Magic Wand \((\d+)(?:st|nd|rd|th)?-Rank Spell\))/i);

                if (scrollMatch) {
                    setScrollSelectorData({ mode: 'SELECT_SPELL', rank: parseInt(scrollMatch[1] || scrollMatch[2]), type: 'scroll', baseItem: firstScroll, action, payload });
                    setContextMenu(null);
                    return;
                } else if (wandMatch) {
                    setScrollSelectorData({ mode: 'SELECT_SPELL', rank: parseInt(wandMatch[1] || wandMatch[2]), type: 'wand', baseItem: firstScroll, action, payload });
                    setContextMenu(null);
                    return;
                }
            }
        }

        if (action === 'edit') {
            const item = targets[0];
            if (item && item.sourceFile) {
                // Fetch full item data including description
                fetchShopItemDetailBySourceFile(item.sourceFile)
                    .then(fullItem => setEditingItem(fullItem))
                    .catch(err => {
                        console.error('Failed to fetch item details:', err);
                        setEditingItem(item); // Fallback to index data
                    });
            } else if (item) {
                if (item.isCustom && item.data) {
                    setEditingItem(item.data); // Load full custom data
                } else {
                    setEditingItem(item);
                }
            }
            setContextMenu(null);
            return;
        }

        if (action === 'clone') {
            const item = targets[0];
            if (item) {
                const cloned = { ...item, name: item.name + ' (Copy)' };
                setEditingItem(cloned);
            }
            setContextMenu(null);
            return;
        }

        if (action === 'delete') {
            if (!confirm(`Are you sure you want to delete ${targets.length} items? This cannot be undone.`)) return;

            setDb(prev => {
                const next = deepClone(prev);
                if (!next.shop) next.shop = { customItems: {} };

                targets.forEach(item => {
                    const name = item.name;
                    // Only delete from customItems
                    if (next.shop.customItems && next.shop.customItems[name]) {
                        delete next.shop.customItems[name];
                    }
                });
                return next;
            });
            setContextMenu(null);
            return;
        }

        setDb(prev => {
            const next = deepClone(prev);
            if (!next.shop) next.shop = { availableItems: [], traders: [], availableFormulas: [] };

            targets.forEach(item => {
                const itemName = item.name;

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
                        // Store full item if it has customizations (like spell), otherwise just name
                        const itemToStore = item.system?.spell ? item : itemName;
                        // Check existence by name
                        const existing = trader.inventory.some(i => (typeof i === 'string' ? i : i.name) === itemName);
                        if (!existing) trader.inventory.push(itemToStore);
                    }
                } else if (action === 'givePlayer') {
                    const campaignId = activeCampaign?.id;
                    if (!campaignId) return next;
                    const char = next.campaigns?.[campaignId]?.characters?.[payload] || next.characters?.[payload]; // support both structs? assumption: useCampaign gives activeCampaign
                    // Wait, activeCampaign has characters, payload is index? Or ID?
                    // In previous code render it was index. `activeCampaign.characters` is array.
                    // But `char` derivation needs checking.
                    // Let's assume payload is index in activeCampaign.characters
                    if (char) {
                        const stackable = shouldStack(item);
                        const existing = stackable ? (char.inventory || []).find(i => i.name === itemName) : null;
                        if (!char.inventory) char.inventory = [];
                        if (existing) {
                            existing.qty = (existing.qty || 1) + 1;
                        } else {
                            // Push FULL item to preserve properties
                            char.inventory.push({ ...item, qty: 1, instanceId: crypto.randomUUID(), addedAt: Date.now() });
                        }
                    }
                } else if (action === 'giveFormula') {
                    const campaignId = activeCampaign?.id;
                    if (!campaignId) return next;
                    const char = next.campaigns?.[campaignId]?.characters?.[payload] || next.characters?.[payload];
                    if (char) {
                        if (!char.formulaBook) char.formulaBook = [];
                        if (!char.formulaBook.includes(itemName)) {
                            char.formulaBook.push(itemName);
                        }
                    }
                } else if (action === 'addToLoot') {
                    const bag = (next.lootBags || []).find(b => b.id === payload);
                    if (bag) {
                        // Use validated item data
                        bag.items.push({
                            ...item,
                            instanceId: crypto.randomUUID(),
                            addedAt: Date.now()
                        });
                    }
                }
            });
            return next;
        });
        setContextMenu(null);
    };

    // ... DRAG HANDLERS ...
    const handleDragStart = (e, item, source) => {
        e.dataTransfer.setData('application/json', JSON.stringify({ item, source }));
    };

    const handleDropOnTrader = (e, traderId) => {
        e.preventDefault();
        const dataStr = e.dataTransfer.getData('application/json');
        if (!dataStr) return;
        try {
            const { item } = JSON.parse(dataStr);
            if (!item || !item.name) return;
            setDb(prev => {
                const next = deepClone(prev);
                const trader = next.shop.traders.find(t => t.id === traderId);
                if (trader) {
                    const existing = trader.inventory.map(x => (typeof x === 'string' ? x : x.name));
                    if (!existing.includes(item.name)) {
                        trader.inventory.push(item.name);
                    }
                }
                return next;
            });
        } catch (err) { }
    };

    const handleDropOnLoot = (e, bagId) => {
        e.preventDefault();
        const dataStr = e.dataTransfer.getData('application/json');
        if (!dataStr) return;
        try {
            const { item } = JSON.parse(dataStr);
            if (!item || !item.name) return;

            // QTY Prompt for stackables
            let qty = 1;
            if (shouldStack(item)) {
                const res = prompt(`Quantity for ${item.name}?`, "1");
                if (res === null) return;
                qty = parseInt(res) || 1;
            }

            setDb(prev => {
                const next = deepClone(prev);
                const bag = next.lootBags.find(b => b.id === bagId);
                if (bag) {
                    // Check for existing stackable item
                    const stackable = shouldStack(item);
                    const existing = stackable ? bag.items.find(i => i.name === item.name && !i.claimedBy) : null;

                    if (existing) {
                        existing.qty = (existing.qty || 1) + qty;
                    } else {
                        // Add potentially multiple if not stackable? No, usually distinct instances if not stackable.
                        // But if user requested 5 swords, we might want 5 instances.
                        // For non-stackable, let's loop. For stackable, we did logic above.
                        if (stackable) {
                            bag.items.push({ ...item, qty, instanceId: crypto.randomUUID(), addedAt: Date.now() });
                        } else {
                            for (let i = 0; i < qty; i++) {
                                bag.items.push({ ...item, instanceId: crypto.randomUUID(), addedAt: Date.now() });
                            }
                        }
                    }
                }
                return next;
            });
        } catch (err) { }
    };

    const handleDropOnGlobal = (e) => {
        // Handle removal if dragging BACK from Trader/Loot
        e.preventDefault();
        const dataStr = e.dataTransfer.getData('application/json');
        if (!dataStr) return;
        try {
            const { item, source } = JSON.parse(dataStr);
            if (source === 'trader' && inspectingTraderId) {
                setDb(prev => {
                    const next = deepClone(prev);
                    const trader = next.shop.traders.find(t => t.id === inspectingTraderId);
                    if (trader) {
                        trader.inventory = trader.inventory.filter(i => (typeof i === 'string' ? i : i.name) !== item.name);
                    }
                    return next;
                });
            }
            if (source === 'loot' && inspectingLootId) {
                setDb(prev => {
                    const next = deepClone(prev);
                    const bag = next.lootBags.find(b => b.id === inspectingLootId);
                    if (bag) {
                        // If stackable, decrement? Or remove all? 
                        // Dragging usually implies moving the whole "stack" represented by the row.
                        bag.items = bag.items.filter(i => i.instanceId !== item.instanceId);
                    }
                    return next;
                });
            }
        } catch (err) { }
    };

    // --- RENDER HELPERS ---
    const renderTable = (items, source, onRowClickOverride = null, sortCfg = sortConfig, onSort = handleSort) => (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9em' }}>
            <thead>
                <tr style={{ background: '#333', textAlign: 'left', position: 'sticky', top: 0 }}>
                    {source === 'global' && <th style={{ padding: 8 }}>Avail</th>}
                    {source === 'global' && <th style={{ padding: 8 }}>Formula</th>}
                    {visibleColumns.map(c => (
                        <th key={c} style={{ padding: 8, textTransform: 'capitalize', cursor: 'pointer' }} onClick={() => onSort(c)}>
                            {c} {sortCfg.key === c ? (sortCfg.direction === 'asc' ? '▲' : '▼') : ''}
                        </th>
                    ))}
                    {source === 'loot' && <th style={{ padding: 8 }}>Qty/Avail</th>}
                </tr>
            </thead>
            <tbody>
                {items.map((item, idx) => {
                    const isSelected = selectedItems.includes(item.name);
                    return (
                        <tr
                            key={item.instanceId || idx}
                            draggable
                            onDragStart={(e) => handleDragStart(e, item, source)}
                            style={{
                                borderBottom: '1px solid #444',
                                background: isSelected ? 'rgba(197, 160, 89, 0.2)' : (idx % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent'),
                                cursor: 'grab'
                            }}
                            onClick={(e) => onRowClickOverride ? onRowClickOverride(e, item) : handleRowClick(e, item, idx)}
                            onDoubleClick={() => onInspectItem?.(item)}
                            onContextMenu={(e) => handleContextMenu(e, item, idx)}
                        >
                            {source === 'global' && (
                                <>
                                    <td style={{ padding: 8 }}>
                                        <input type="checkbox" checked={availableList.includes(item.name)} onChange={(e) => { e.stopPropagation(); toggleItemAvailability(item.name); }} onClick={(e) => e.stopPropagation()} />
                                    </td>
                                    <td style={{ padding: 8 }}>
                                        <input type="checkbox" checked={(db.shop?.availableFormulas || []).includes(item.name)} onChange={(e) => { e.stopPropagation(); toggleFormulaAvailability(item.name); }} onClick={(e) => e.stopPropagation()} />
                                    </td>
                                </>
                            )}
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
                            {source === 'loot' && (
                                <td style={{ padding: 8 }}>
                                    {(item.qty || 1) > 1 && <span style={{ marginRight: 5, color: '#aaa' }}>x{item.qty}</span>}
                                    {item.claimedBy ? <span style={{ color: '#c5a059' }}>Claimed: {item.claimedBy}</span> : <span style={{ color: '#4caf50' }}>Available</span>}
                                </td>
                            )}
                        </tr>
                    );
                })}
            </tbody>
        </table>
    );

    // ... RENDER ...

    // Derived Active Data
    const activeTrader = db.shop?.traders?.find(t => t.id === inspectingTraderId);
    const activeLootBag = db.lootBags?.find(b => b.id === inspectingLootId);

    // Resolve Items Logic
    const rawTraderItems = activeTrader ? activeTrader.inventory.map(name => {
        const found = SHOP_INDEX_ITEMS.find(i => i.name === (typeof name === 'string' ? name : name.name));
        return found || (typeof name === 'object' ? name : { name, price: 0 }); // Fallback
    }) : [];

    const rawLootItems = activeLootBag ? activeLootBag.items : [];

    // Filter & Sort for Inspector
    const processedTraderItems = useMemo(() => {
        let items = rawTraderItems;
        if (applyFiltersToInspector) {
            items = getFilteredItems(items);
        }
        return getSortedItems(items, inspectorSortConfig);
    }, [rawTraderItems, applyFiltersToInspector, inspectorSortConfig, itemFilterType, itemFilterCategory, itemFilterRarity, itemFilterTraits, itemFilterGroup, itemSearch, itemFilterAvailable, itemFilterFormulaAvailable]);

    const processedLootItems = useMemo(() => {
        let items = rawLootItems;
        if (applyFiltersToInspector) {
            items = getFilteredItems(items);
        }
        return getSortedItems(items, inspectorSortConfig);
    }, [rawLootItems, applyFiltersToInspector, inspectorSortConfig, itemFilterType, itemFilterCategory, itemFilterRarity, itemFilterTraits, itemFilterGroup, itemSearch, itemFilterAvailable, itemFilterFormulaAvailable]);

    if (editingItem) {
        return (
            <ItemEditor
                initialItem={Object.keys(editingItem).length === 0 ? null : editingItem}
                onSave={() => window.location.reload()}
                onCancel={() => setEditingItem(null)}
                onSaveToDb={(itemData) => {
                    setDb(prev => ({
                        ...prev,
                        shop: {
                            ...prev.shop,
                            customItems: {
                                ...prev.shop?.customItems,
                                [itemData.name]: itemData // Key by Name for ShopView lookup compatibility (or ID)
                                // If we key by Name, we assume distinct names. ItemEditor 'safeId' was name-based.
                            }
                        }
                    }));
                }}
            />
        );
    }

    return (
        <div className="admin-layout" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
            {/* TOOLBAR */}
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

                <MultiSelectDropdown label="Type" options={uniqueTypes} selected={itemFilterType} onChange={(v) => { setItemFilterType(v); setItemPage(1); }} />
                <MultiSelectDropdown label="Group" options={uniqueGroups} selected={itemFilterGroup} onChange={(v) => { setItemFilterGroup(v); setItemPage(1); }} />
                <MultiSelectDropdown label="Category" options={uniqueCategories} selected={itemFilterCategory} onChange={(v) => { setItemFilterCategory(v); setItemPage(1); }} />
                <MultiSelectDropdown label="Rarity" options={uniqueRarities} selected={itemFilterRarity} onChange={(v) => { setItemFilterRarity(v); setItemPage(1); }} />

                <div style={{ display: 'flex', gap: 5 }}>
                    <button className={`btn-add-condition ${itemFilterAvailable ? 'active' : ''}`} style={{ margin: 0, width: 'auto', border: itemFilterAvailable ? '1px solid var(--text-gold)' : '1px solid #444' }} onClick={() => setItemFilterAvailable(p => !p)}>Avail</button>
                    <button className={`btn-add-condition ${itemFilterFormulaAvailable ? 'active' : ''}`} style={{ margin: 0, width: 'auto', border: itemFilterFormulaAvailable ? '1px solid var(--text-gold)' : '1px solid #444' }} onClick={() => setItemFilterFormulaAvailable(p => !p)}>Formula</button>
                </div>

                {/* ... Column selection & Page Size ... */}
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
                <select className="modal-input" style={{ width: 'auto', marginLeft: 'auto' }} value={itemsPerPage} onChange={(e) => { setItemsPerPage(Number(e.target.value)); setItemPage(1); }}>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                </select>
            </div>

            <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                {/* LEFT MAIN AREA */}
                <div style={{ flex: 3, display: 'flex', flexDirection: 'column', borderRight: '1px solid #444', overflow: 'hidden' }}>

                    {/* GLOBAL LIST (Top or Full) */}
                    <div
                        style={{ flex: 1, overflow: 'auto', padding: 0 }}
                        onDrop={handleDropOnGlobal}
                        onDragOver={e => e.preventDefault()}
                    >
                        {renderTable(paginatedItems, 'global')}
                    </div>
                    <div style={{ padding: 5, borderTop: '1px solid #444', background: '#222', display: 'flex', justifyContent: 'center', gap: 10 }}>
                        <button disabled={currentPage === 1} onClick={() => setItemPage(p => Math.max(1, p - 1))}>Prev</button>
                        <span>Page {currentPage} of {totalPages}</span>
                        <button disabled={currentPage === totalPages} onClick={() => setItemPage(p => Math.min(totalPages, p + 1))}>Next</button>
                    </div>

                    {/* INSPECTOR SPLIT (Bottom) */}
                    {(activeTrader || activeLootBag) && (
                        <div style={{
                            height: '50%', // Fixed 50% height
                            maxHeight: '50vh',
                            borderTop: '4px solid #c5a059',
                            display: 'flex',
                            flexDirection: 'column',
                            background: '#1a1a1a',
                            flexShrink: 0 // Don't shrink below 50% if possible, or adjust
                        }}
                            onDrop={(e) => {
                                if (activeTrader) handleDropOnTrader(e, activeTrader.id);
                                if (activeLootBag) handleDropOnLoot(e, activeLootBag.id);
                            }}
                            onDragOver={e => e.preventDefault()}
                        >
                            <div style={{ padding: 10, background: '#333', color: '#fff', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span>
                                    {activeTrader ? `Trader: ${activeTrader.name}` : `Loot: ${activeLootBag.name} (${activeLootBag.items.length} items)`}
                                </span>

                                <div style={{ display: 'flex', alignItems: 'center', gap: 15 }}>
                                    {/* Apply Filters Switch */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.9em', fontWeight: 'normal' }}>
                                        <input
                                            type="checkbox"
                                            checked={applyFiltersToInspector}
                                            onChange={() => setApplyFiltersToInspector(p => !p)}
                                            style={{ cursor: 'pointer' }}
                                        />
                                        <span onClick={() => setApplyFiltersToInspector(p => !p)} style={{ cursor: 'pointer' }}>Apply Filters</span>
                                    </div>

                                    {activeLootBag && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                            <span style={{ color: '#ffd700', fontSize: '0.9em' }}>Gold:</span>
                                            <input
                                                type="number"
                                                className="modal-input"
                                                style={{ width: 80, padding: 2, background: '#222', border: '1px solid #555' }}
                                                value={activeLootBag.goldValue || 0}
                                                onChange={(e) => {
                                                    const val = parseFloat(e.target.value) || 0;
                                                    setDb(prev => {
                                                        const next = deepClone(prev);
                                                        const b = next.lootBags.find(x => x.id === activeLootBag.id);
                                                        if (b) b.goldValue = val;
                                                        return next;
                                                    });
                                                }}
                                            />
                                        </div>
                                    )}

                                    <button onClick={() => { setInspectingTraderId(null); setInspectingLootId(null); }}>Close Inspector</button>
                                </div>
                            </div>
                            <div style={{ flex: 1, overflow: 'auto' }}>
                                {activeTrader && renderTable(processedTraderItems, 'trader', (e, item) => handleRowClick(e, item, -1), inspectorSortConfig, handleInspectorSort)}
                                {activeLootBag && renderTable(processedLootItems, 'loot', (e, item) => handleRowClick(e, item, -1), inspectorSortConfig, handleInspectorSort)}
                            </div>
                        </div>
                    )}
                </div>

                {/* RIGHT SIDEBAR (Manager) */}
                <div style={{ flex: 1, background: '#1a1a1d', padding: 10, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 20 }}>

                    {/* TRADERS SECTION */}
                    <div>
                        <h3>Traders</h3>
                        <div style={{ display: 'flex', gap: 5, marginBottom: 15 }}>
                            <input className="modal-input" placeholder="New Trader Name" value={newTraderName} onChange={e => setNewTraderName(e.target.value)} />
                            <button className="btn-add-condition" style={{ margin: 0 }} onClick={createTrader}>+</button>
                        </div>
                        {/* ... keep traders list ... */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {(db.shop?.traders || []).map(trader => (
                                <div key={trader.id} style={{ background: inspectingTraderId === trader.id ? '#3e2723' : '#2b2b2e', padding: 10, borderRadius: 4, border: '1px solid #444' }}>
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
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8em', color: '#888' }}>
                                        <span>{trader.inventory.length} items</span>
                                        <button className="icon-btn" style={{ color: '#c5a059', fontSize: '1.2em' }} title="Inspect" onClick={() => { setInspectingLootId(null); setInspectingTraderId(trader.id); }}>👁️</button>
                                    </div>
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
                                    style={{ background: inspectingLootId === bag.id ? '#3e2723' : '#222', padding: 10, borderRadius: 4, border: `1px solid ${bag.isLocked ? '#d32f2f' : '#4caf50'}` }}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontWeight: 'bold' }}>{bag.name}</span>
                                        <div style={{ display: 'flex', gap: 5 }}>
                                            <button className="icon-btn" title="Inspect" onClick={() => { setInspectingTraderId(null); setInspectingLootId(bag.id); }}>👁️</button>
                                            <button className="icon-btn" onClick={() => setDb(prev => {
                                                const newDb = deepClone(prev);
                                                const b = (newDb.lootBags || []).find(x => x.id === bag.id);
                                                if (b) b.isLocked = !b.isLocked;
                                                return newDb;
                                            })}>{bag.isLocked ? '🔒' : '🔓'}</button>
                                            <button className="icon-btn" style={{ color: '#d32f2f' }} onClick={() => {
                                                if (confirm('Delete Bag?')) setDb(prev => ({ ...prev, lootBags: prev.lootBags.filter(b => b.id !== bag.id) }));
                                            }}>🗑️</button>
                                        </div>
                                    </div>
                                    <div style={{ fontSize: '0.8em', color: '#888', marginTop: 4 }}>
                                        {bag.items.length} items {bag.goldValue > 0 ? `• ${bag.goldValue} gp` : ''} • {bag.isLocked ? 'Hidden' : 'Visible'}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Context Menu (re-using state) */}
            {contextMenu && (
                <div
                    style={{
                        position: 'fixed',
                        top: contextMenu.openUpwards ? 'auto' : contextMenu.y,
                        bottom: contextMenu.openUpwards ? (window.innerHeight - contextMenu.y) : 'auto',
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
                    <div className="ctx-item" onClick={() => performContextAction('edit')}>✏️ Edit Item</div>
                    <div className="ctx-item" onClick={() => performContextAction('clone')}>📋 Clone Item</div>
                    <div className="ctx-item" style={{ color: '#ef9a9a' }} onClick={() => performContextAction('delete')}>🗑️ Delete Item</div>
                    <div style={{ borderTop: '1px solid #444', margin: '2px 0' }}></div>

                    {/* SUBMENUS */}

                    {/* Trader Submenu */}
                    <div className="ctx-item ctx-submenu-parent">
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>Assign to Trader</span>
                            <span>▶</span>
                        </div>
                        <div className="ctx-submenu" style={contextMenu.openUpwards ? { bottom: 0, top: 'auto', borderBottom: '1px solid #c5a059', borderTop: '1px solid #c5a059' } : {}}>
                            {db.shop.traders.length === 0 && <div className="ctx-item disabled">No Traders</div>}
                            {db.shop.traders.map(t => (
                                <div key={t.id} className="ctx-item" onClick={() => performContextAction('assignTrader', t.id)}>{t.name}</div>
                            ))}
                        </div>
                    </div>

                    {/* Loot Bag Submenu */}
                    <div className="ctx-item ctx-submenu-parent">
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>Add to Loot Bag</span>
                            <span>▶</span>
                        </div>
                        <div className="ctx-submenu" style={contextMenu.openUpwards ? { bottom: 0, top: 'auto', borderBottom: '1px solid #c5a059', borderTop: '1px solid #c5a059' } : {}}>
                            {(!db.lootBags || db.lootBags.length === 0) && <div className="ctx-item disabled">No Loot Bags</div>}
                            {(db.lootBags || []).map(b => (
                                <div key={b.id} className="ctx-item" onClick={() => performContextAction('addToLoot', b.id)}>{b.name}</div>
                            ))}
                        </div>
                    </div>

                    {/* Player Submenus */}
                    <div className="ctx-item ctx-submenu-parent">
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>Give to Player</span>
                            <span>▶</span>
                        </div>
                        <div className="ctx-submenu" style={contextMenu.openUpwards ? { bottom: 0, top: 'auto', borderBottom: '1px solid #c5a059', borderTop: '1px solid #c5a059' } : {}}>
                            {(activeCampaign?.characters || []).map((c, i) => (
                                <div key={c.id} className="ctx-item" onClick={() => performContextAction('givePlayer', i)}>{c.name}</div>
                            ))}
                        </div>
                    </div>

                    <div className="ctx-item ctx-submenu-parent">
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>Give Formula to Player</span>
                            <span>▶</span>
                        </div>
                        <div className="ctx-submenu" style={contextMenu.openUpwards ? { bottom: 0, top: 'auto', borderBottom: '1px solid #c5a059', borderTop: '1px solid #c5a059' } : {}}>
                            {(activeCampaign?.characters || []).map((c, i) => (
                                <div key={c.id} className="ctx-item" onClick={() => performContextAction('giveFormula', i)}>{c.name}</div>
                            ))}
                        </div>
                    </div>

                    <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: -1 }} onClick={() => setContextMenu(null)}></div>
                </div>
            )}
            <style>{`
                .ctx-item { padding: 8px 12px; cursor: pointer; color: #ddd; } 
                .ctx-item:hover { background: #444; color: #fff; } 
                .ctx-item.disabled { color: #666; cursor: default; } 
                .icon-btn { background:none; border:none; cursor:pointer; font-size: 1.1em; padding: 2px; } 
                .icon-btn:hover { background: #444; border-radius: 4px; }
                
                /* Submenus */
                .ctx-submenu-parent { position: relative; }
                .ctx-submenu {
                    display: none;
                    position: absolute;
                    left: 100%;
                    top: -1px;
                    background: #2b2b2e;
                    border: 1px solid #c5a059;
                    min-width: 160px;
                    box-shadow: 2px 2px 10px rgba(0,0,0,0.5);
                    z-index: 2005;
                }
                .ctx-submenu-parent:hover .ctx-submenu { display: block; }
            `}</style>
            {/* Spell Selector Modal */}
            {scrollSelectorData && (
                <SpellScrollSelectorModal
                    rank={scrollSelectorData.rank}
                    type={scrollSelectorData.type}
                    onCancel={() => setScrollSelectorData(null)}
                    onSelect={(spell) => {
                        const { baseItem, type, rank, action, payload } = scrollSelectorData;
                        const newItem = { ...baseItem };
                        // Clone system to avoid mutation
                        newItem.system = baseItem.system ? JSON.parse(JSON.stringify(baseItem.system)) : {};

                        // Preserve linkage to Shop Index for properties lookup
                        newItem.system.originalName = baseItem.name;

                        // Set Name
                        newItem.name = `${type === 'scroll' ? 'Scroll' : 'Wand'} of ${spell.name} (Rank ${rank})`;

                        // Embed Spell Index Entry
                        newItem.system.spell = spell;

                        // Initialize Wand Charges
                        if (type === 'wand') {
                            newItem.system.wand = { charges: 1, max: 1 };
                        }

                        // Execute context action with overridden item
                        performContextAction(action, payload, newItem);
                        setScrollSelectorData(null);
                    }}
                />
            )}
        </div>
    );
}
