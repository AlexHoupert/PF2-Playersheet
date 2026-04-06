import React, { useEffect, useMemo, useState } from 'react';
import { useCampaign } from '../shared/context/CampaignContext';
import ItemEditor from './editors/ItemEditor';
import { SHOP_CATEGORIES } from '../shared/constants/shop';
import { deepClone } from '../shared/utils/deepClone';
import { SHOP_INDEX_FILTER_OPTIONS, SHOP_INDEX_ITEMS, fetchShopItemDetailBySourceFile } from '../shared/catalog/shopIndex';
import { shouldStack } from '../shared/utils/inventoryUtils';
import SpellScrollSelectorModal from '../player/modals/SpellScrollSelectorModal';
import FilterDialog from './components/FilterDialog';

const uniqueTypes = SHOP_INDEX_FILTER_OPTIONS.types;
const uniqueCategories = SHOP_INDEX_FILTER_OPTIONS.categories;
const uniqueRarities = SHOP_INDEX_FILTER_OPTIONS.rarities;
const uniqueGroups = Array.from(new Set(SHOP_INDEX_ITEMS.map(i => i.group).filter(Boolean))).sort();

const COLUMNS_CONFIG = {
    name: { label: 'Name', type: 'text' },
    level: { label: 'Level', type: 'number' },
    price: { label: 'Price', type: 'number' },
    type: { label: 'Type', type: 'select', options: uniqueTypes },
    category: { label: 'Category', type: 'select', options: uniqueCategories },
    group: { label: 'Group', type: 'select', options: uniqueGroups },
    rarity: { label: 'Rarity', type: 'select', options: uniqueRarities },
    traits: { label: 'Traits', type: 'text' },
    damage: { label: 'Damage', type: 'text' },
    range: { label: 'Range', type: 'text' },
    bulk: { label: 'Bulk', type: 'text' }
};

// Scrollbar styling
const scrollbarStyles = `
    .items-view-scroll::-webkit-scrollbar { width: 8px; height: 8px; }
    .items-view-scroll::-webkit-scrollbar-track { background: #1a1a1a; }
    .items-view-scroll::-webkit-scrollbar-thumb { background: #444; border-radius: 4px; }
    .items-view-scroll::-webkit-scrollbar-thumb:hover { background: #555; }
`;

// Card wrapper for consistent styling
const Card = ({ children, style, className, ...rest }) => (
    <div className={className} style={{
        background: '#1a1a1a',
        borderRadius: 8,
        border: '1px solid #333',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        ...style
    }} {...rest}>
        {children}
    </div>
);

export default function ItemsView({ db, setDb, onInspectItem }) {
    const { activeCampaign } = useCampaign();

    // --- STATE ---
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(50);

    // Layout Mode
    const [sideMode, setSideMode] = useState('none');
    const [selectedTraderId, setSelectedTraderId] = useState(null);
    const [selectedLootId, setSelectedLootId] = useState(null);
    const [sidePage, setSidePage] = useState(1);

    // Filters
    const [activeFilters, setActiveFilters] = useState({});
    const [showFilterDialog, setShowFilterDialog] = useState(false);
    const [applySideFilters, setApplySideFilters] = useState(false);

    // Columns
    const [visibleColumns, setVisibleColumns] = useState(() => {
        try {
            const saved = localStorage.getItem('itemsViewColumns');
            return saved ? JSON.parse(saved) : ['name', 'level', 'price', 'type', 'rarity'];
        } catch {
            return ['name', 'level', 'price', 'type', 'rarity'];
        }
    });
    const [showColSelector, setShowColSelector] = useState(false);

    // Sorting
    const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' });
    const [sideSortConfig, setSideSortConfig] = useState({ key: 'name', direction: 'asc' });

    // Selection (main table)
    const [selectedItems, setSelectedItems] = useState([]);
    const [lastSelectedIndex, setLastSelectedIndex] = useState(-1);

    // Selection (side panel)
    const [selectedSideItems, setSelectedSideItems] = useState([]);
    const [lastSideSelectedIndex, setLastSideSelectedIndex] = useState(-1);

    const [editingItem, setEditingItem] = useState(null);
    const [contextMenu, setContextMenu] = useState(null);
    const [contextSubMenu, setContextSubMenu] = useState(null);
    const [pendingSpellAction, setPendingSpellAction] = useState(null);

    useEffect(() => {
        localStorage.setItem('itemsViewColumns', JSON.stringify(visibleColumns));
    }, [visibleColumns]);

    // --- DATA PREP ---
    const globalItems = useMemo(() => {
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
            data: i
        }));
        return [...flatCustomItems, ...SHOP_INDEX_ITEMS];
    }, [db.shop?.customItems]);

    const filterItem = (item, filters, searchTerm) => {
        if (searchTerm && !item.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;

        if (filters.Available === true && !(db.shop?.availableItems || []).includes(item.name)) return false;
        if (filters.Available === false && (db.shop?.availableItems || []).includes(item.name)) return false;

        if (filters.Formula === true && !(db.shop?.availableFormulas || []).includes(item.name)) return false;
        if (filters.Formula === false && (db.shop?.availableFormulas || []).includes(item.name)) return false;

        for (const [key, val] of Object.entries(filters)) {
            if (key === 'Available' || key === 'Formula') continue;
            if (!val || (Array.isArray(val) && val.length === 0)) continue;
            const itemVal = item[key];
            if (Array.isArray(val)) {
                if (!val.includes(itemVal)) return false;
            } else if (typeof val === 'string') {
                if (!String(itemVal || '').toLowerCase().includes(val.toLowerCase())) return false;
            }
        }
        return true;
    };

    const filteredGlobalItems = useMemo(() => {
        return globalItems.filter(i => filterItem(i, activeFilters, search));
    }, [globalItems, activeFilters, search, db.shop]);

    const sortedGlobalItems = useMemo(() => {
        return [...filteredGlobalItems].sort((a, b) => {
            let valA = a[sortConfig.key];
            let valB = b[sortConfig.key];
            if (typeof valA === 'object' && valA?.value) valA = valA.value;
            if (typeof valB === 'object' && valB?.value) valB = valB.value;
            if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
            if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }, [filteredGlobalItems, sortConfig]);

    const totalPages = Math.max(1, Math.ceil(sortedGlobalItems.length / itemsPerPage));
    const paginatedItems = sortedGlobalItems.slice((page - 1) * itemsPerPage, page * itemsPerPage);

    // --- SIDE PANEL DATA ---
    const activeTrader = db.shop?.traders?.find(t => t.id === selectedTraderId);
    const campaignLootBags = activeCampaign?.lootBags || [];
    const activeLoot = campaignLootBags.find(b => b.id === selectedLootId);

    const sideItems = useMemo(() => {
        let items = [];
        if (sideMode === 'trader' && activeTrader) {
            items = activeTrader.inventory.map(entry => {
                const name = typeof entry === 'string' ? entry : entry.name;
                const base = globalItems.find(i => i.name === name) || { name, type: 'Unknown', level: 0, price: 0 };
                return { ...base, ...entry, _isRef: typeof entry === 'string' };
            });
        } else if (sideMode === 'loot' && activeLoot) {
            items = activeLoot.items.map((item, idx) => ({ ...item, _sideIdx: idx }));
        }
        return items.sort((a, b) => {
            let valA = a[sideSortConfig.key];
            let valB = b[sideSortConfig.key];
            if (valA < valB) return sideSortConfig.direction === 'asc' ? -1 : 1;
            if (valA > valB) return sideSortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }, [sideMode, activeTrader, activeLoot, globalItems, sideSortConfig, db.shop]);

    const filteredSideItems = useMemo(() => {
        return applySideFilters ? sideItems.filter(i => filterItem(i, activeFilters, search)) : sideItems;
    }, [sideItems, applySideFilters, activeFilters, search]);

    // Side List Pagination (10 max)
    const sideLists = useMemo(() => {
        let list = [];
        if (sideMode === 'trader') list = db.shop?.traders || [];
        if (sideMode === 'loot') list = campaignLootBags;
        const max = 10;
        const total = Math.ceil(list.length / max) || 1;
        const current = Math.min(sidePage, total);
        return { sliced: list.slice((current - 1) * max, current * max), total, current };
    }, [db.shop, campaignLootBags, sideMode, sidePage]);

    // --- HANDLERS ---
    const handleSort = (key) => setSortConfig(p => ({ key, direction: p.key === key && p.direction === 'asc' ? 'desc' : 'asc' }));
    const handleSideSort = (key) => setSideSortConfig(p => ({ key, direction: p.key === key && p.direction === 'asc' ? 'desc' : 'asc' }));

    // Main table selection
    const handleSelect = (e, item, index) => {
        if (e.ctrlKey || e.metaKey) {
            setSelectedItems(prev => prev.some(i => i.name === item.name) ? prev.filter(i => i.name !== item.name) : [...prev, item]);
            setLastSelectedIndex(index);
        } else if (e.shiftKey && lastSelectedIndex !== -1) {
            const start = Math.min(lastSelectedIndex, index);
            const end = Math.max(lastSelectedIndex, index);
            const range = paginatedItems.slice(start, end + 1);
            const combined = [...selectedItems];
            range.forEach(r => { if (!combined.some(c => c.name === r.name)) combined.push(r); });
            setSelectedItems(combined);
        } else {
            setSelectedItems([item]);
            setLastSelectedIndex(index);
        }
    };

    // Side panel selection
    const handleSideSelect = (e, item, index) => {
        const key = item.instanceId || item.name;
        if (e.ctrlKey || e.metaKey) {
            setSelectedSideItems(prev => prev.some(i => (i.instanceId || i.name) === key) ? prev.filter(i => (i.instanceId || i.name) !== key) : [...prev, item]);
            setLastSideSelectedIndex(index);
        } else if (e.shiftKey && lastSideSelectedIndex !== -1) {
            const start = Math.min(lastSideSelectedIndex, index);
            const end = Math.max(lastSideSelectedIndex, index);
            const range = filteredSideItems.slice(start, end + 1);
            const combined = [...selectedSideItems];
            range.forEach(r => { if (!combined.some(c => (c.instanceId || c.name) === (r.instanceId || r.name))) combined.push(r); });
            setSelectedSideItems(combined);
        } else {
            setSelectedSideItems([item]);
            setLastSideSelectedIndex(index);
        }
    };

    const handleDragStart = (e, item, source) => {
        let dragging;
        if (source === 'global') {
            dragging = selectedItems.some(i => i.name === item.name) ? [...selectedItems] : [item];
        } else {
            const key = item.instanceId || item.name;
            dragging = selectedSideItems.some(i => (i.instanceId || i.name) === key) ? [...selectedSideItems] : [item];
        }
        e.dataTransfer.setData('app/items', JSON.stringify({ items: dragging, source }));
    };

    const handleDrop = (e, targetType, targetId) => {
        e.preventDefault();
        const data = e.dataTransfer.getData('app/items');
        if (!data) return;
        const { items, source } = JSON.parse(data);

        setDb(prev => {
            const next = deepClone(prev);
            if (targetType === 'trader' && targetId) {
                const t = next.shop.traders.find(x => x.id === targetId);
                if (t) items.forEach(i => { if (!t.inventory.some(x => (typeof x === 'string' ? x : x.name) === i.name)) t.inventory.push(i.name); });
            } else if (targetType === 'loot' && targetId && activeCampaign) {
                const campData = next.campaigns[activeCampaign.id];
                const b = campData?.lootBags?.find(x => x.id === targetId);
                if (b) items.forEach(i => {
                    const stackable = shouldStack(i);
                    const existing = stackable ? b.items.find(x => x.name === i.name && !x.claimedBy) : null;
                    if (existing) existing.qty = (existing.qty || 1) + 1;
                    else b.items.push({ ...i, qty: 1, instanceId: crypto.randomUUID(), addedAt: Date.now() });
                });
            } else if (targetType === 'global') {
                // Dragging from side panel to main table removes items
                if (source === 'trader' && selectedTraderId) {
                    const t = next.shop.traders.find(x => x.id === selectedTraderId);
                    if (t) t.inventory = t.inventory.filter(x => !items.some(d => d.name === (typeof x === 'string' ? x : x.name)));
                } else if (source === 'loot' && selectedLootId && activeCampaign) {
                    const campData = next.campaigns[activeCampaign.id];
                    const b = campData?.lootBags?.find(x => x.id === selectedLootId);
                    if (b) b.items = b.items.filter(x => !items.some(d => d.instanceId ? d.instanceId === x.instanceId : d.name === x.name));
                }
                setSelectedSideItems([]);
            }
            return next;
        });
    };

    // --- CONTEXT MENU ---
    const handleContextMenu = (e, item, source) => {
        e.preventDefault();
        if (source === 'global') {
            if (!selectedItems.some(i => i.name === item.name)) setSelectedItems([item]);
        } else {
            const key = item.instanceId || item.name;
            if (!selectedSideItems.some(i => (i.instanceId || i.name) === key)) setSelectedSideItems([item]);
        }
        setContextMenu({ x: e.clientX, y: e.clientY, item, source });
        setContextSubMenu(null);
    };

    const closeContextMenu = () => { setContextMenu(null); setContextSubMenu(null); };

    // Helper: detect scroll/wand items that need spell selection
    const detectScrollWand = (item) => {
        const scrollMatch = item.name.match(/(?:Scroll of Rank (\d+)|Scroll of (\d+)(?:st|nd|rd|th)?-rank Spell)/i);
        if (scrollMatch) return { type: 'scroll', rank: parseInt(scrollMatch[1] || scrollMatch[2]) };
        const wandMatch = item.name.match(/(?:Wand of Rank (\d+)|Magic Wand \((\d+)(?:st|nd|rd|th)?-Rank Spell\))/i);
        if (wandMatch) return { type: 'wand', rank: parseInt(wandMatch[1] || wandMatch[2]) };
        return null;
    };

    // Helper: execute the actual item action (shared between performAction and spell selection callback)
    const executeItemAction = (action, arg, items) => {
        setDb(prev => {
            const next = deepClone(prev);
            if (!next.shop) next.shop = {};
            if (!next.shop.availableItems) next.shop.availableItems = [];
            if (!next.shop.availableFormulas) next.shop.availableFormulas = [];
            const campData = activeCampaign ? next.campaigns[activeCampaign.id] : null;

            items.forEach(t => {
                if (action === 'makeAvailable' && !next.shop.availableItems.includes(t.name)) next.shop.availableItems.push(t.name);
                if (action === 'makeUnavailable') next.shop.availableItems = next.shop.availableItems.filter(x => x !== t.name);
                if (action === 'addFormula' && !next.shop.availableFormulas.includes(t.name)) next.shop.availableFormulas.push(t.name);
                if (action === 'removeFormula') next.shop.availableFormulas = next.shop.availableFormulas.filter(x => x !== t.name);
                if (action === 'addToTrader' && arg) {
                    const tr = next.shop.traders?.find(x => x.id === arg);
                    if (tr && !tr.inventory.some(x => (typeof x === 'string' ? x : x.name) === t.name)) tr.inventory.push(t.name);
                }
                if (action === 'addToLoot' && arg && campData) {
                    const bag = campData.lootBags?.find(x => x.id === arg);
                    if (bag) bag.items.push({ ...t, qty: 1, instanceId: crypto.randomUUID() });
                }
                if (action === 'giveToPlayer' && arg && campData) {
                    const p = campData.characters?.find(x => x.id === arg);
                    if (p) { if (!p.inventory) p.inventory = []; p.inventory.push({ ...t, instanceId: crypto.randomUUID() }); }
                }
                if (action === 'giveFormulaToPlayer' && arg && campData) {
                    const p = campData.characters?.find(x => x.id === arg);
                    if (p) { if (!p.formulas) p.formulas = []; if (!p.formulas.includes(t.name)) p.formulas.push(t.name); }
                }
                if (action === 'delete') {
                    if (t.isCustom && next.shop.customItems) delete next.shop.customItems[t.name];
                }
            });
            return next;
        });
    };

    const performAction = (action, arg) => {
        closeContextMenu();
        const source = contextMenu?.source || 'global';
        const targets = source === 'global'
            ? (selectedItems.length > 0 ? selectedItems : [contextMenu?.item].filter(Boolean))
            : (selectedSideItems.length > 0 ? selectedSideItems : [contextMenu?.item].filter(Boolean));

        if (action === 'edit') { setEditingItem(targets[0]); return; }
        if (action === 'clone') { setEditingItem({ ...targets[0], name: `${targets[0].name} (Copy)`, isCustom: true }); return; }
        if (action === 'newItem') { setEditingItem({ name: '', isCustom: true }); return; }
        if (action === 'inspect' && onInspectItem) { onInspectItem(targets[0]); return; }

        // Side panel specific actions
        if (action === 'removeFromSide') {
            setDb(prev => {
                const next = deepClone(prev);
                if (source === 'trader' && selectedTraderId) {
                    const t = next.shop.traders.find(x => x.id === selectedTraderId);
                    if (t) t.inventory = t.inventory.filter(x => !targets.some(d => d.name === (typeof x === 'string' ? x : x.name)));
                } else if (source === 'loot' && selectedLootId && activeCampaign) {
                    const campData = next.campaigns[activeCampaign.id];
                    const b = campData?.lootBags?.find(x => x.id === selectedLootId);
                    if (b) b.items = b.items.filter(x => !targets.some(d => d.instanceId ? d.instanceId === x.instanceId : d.name === x.name));
                }
                return next;
            });
            setSelectedSideItems([]);
            return;
        }

        if (action === 'setAmount' && source === 'loot') {
            const newQty = prompt('Enter quantity:', targets[0].qty || 1);
            if (newQty === null) return;
            const qty = parseInt(newQty, 10) || 1;
            setDb(prev => {
                const next = deepClone(prev);
                const campData = activeCampaign ? next.campaigns[activeCampaign.id] : null;
                const b = campData?.lootBags?.find(x => x.id === selectedLootId);
                if (b) {
                    targets.forEach(t => {
                        const item = b.items.find(x => x.instanceId === t.instanceId);
                        if (item) item.qty = qty;
                    });
                }
                return next;
            });
            return;
        }

        // For addToLoot, giveToPlayer, addToTrader: check if any target is a scroll/wand needing spell selection
        if (['addToLoot', 'giveToPlayer', 'addToTrader'].includes(action) && targets.length > 0) {
            const firstTarget = targets[0];
            const swInfo = detectScrollWand(firstTarget);
            if (swInfo) {
                // Intercept: show spell picker before completing the action
                setPendingSpellAction({ action, arg, baseItem: firstTarget, ...swInfo });
                return;
            }
        }

        executeItemAction(action, arg, targets);
    };

    const handleCreateTrader = () => {
        const name = prompt('Trader Name:');
        if (!name?.trim()) return;
        const category = prompt('Category (Alchemy, Blacksmith, Remedies, Magic, Adventuring, Special):', 'General');
        if (category === null) return;
        setDb(prev => {
            const next = deepClone(prev);
            if (!next.shop) next.shop = {};
            if (!next.shop.traders) next.shop.traders = [];
            next.shop.traders.push({ id: Date.now(), name: name.trim(), inventory: [], category: category.trim() || 'General' });
            return next;
        });
    };

    const handleCreateLoot = () => {
        const name = prompt("Loot Bag Name:");
        if (!name || !activeCampaign) return;
        setDb(prev => {
            const next = deepClone(prev);
            const campData = next.campaigns[activeCampaign.id];
            if (!campData.lootBags) campData.lootBags = [];
            campData.lootBags.push({ id: Date.now(), name, items: [], goldValue: 0 });
            return next;
        });
    };

    // Double-click handler for info modal
    const handleDoubleClick = (item) => {
        if (onInspectItem) {
            onInspectItem(item);
        }
    };

    const tableColumns = ['Available', 'Formula', ...visibleColumns];
    const isSelected = (item) => selectedItems.some(i => i.name === item.name);
    const isSideSelected = (item) => selectedSideItems.some(i => (i.instanceId || i.name) === (item.instanceId || item.name));

    // Context menu item component
    const CtxItem = ({ icon, label, onClick, danger, hasSubmenu, onMouseEnter }) => (
        <div
            onClick={onClick}
            onMouseEnter={onMouseEnter}
            style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '6px 12px', cursor: 'pointer',
                color: danger ? '#e57373' : '#ddd', background: 'transparent', transition: 'background 0.15s'
            }}
            onMouseOver={(e) => e.currentTarget.style.background = '#333'}
            onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
        >
            <span style={{ width: 18, textAlign: 'center', opacity: 0.7 }}>{icon}</span>
            <span style={{ flex: 1 }}>{label}</span>
            {hasSubmenu && <span style={{ opacity: 0.5 }}>▶</span>}
        </div>
    );

    const CtxDivider = () => <div style={{ height: 1, background: '#444', margin: '4px 0' }} />;

    // Grid layout changes based on sideMode: 3fr main, 2fr side
    const gridTemplate = sideMode === 'none'
        ? 'auto 1fr / 1fr'
        : 'auto 1fr / 3fr 2fr';

    // Button style for consistency
    const toolbarBtnStyle = {
        margin: 0,
        padding: '6px 12px',
        background: '#333',
        border: '1px solid #444',
        color: '#ddd',
        borderRadius: 4,
        cursor: 'pointer',
        fontSize: '0.9em',
        whiteSpace: 'nowrap',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6
    };

    return (
        <>
            <style>{scrollbarStyles}</style>
            <div style={{ display: 'grid', gridTemplate, gap: 10, height: '100%', overflow: 'hidden' }}>
                {/* TOOLBAR CARD - spans full width */}
                <Card style={{ gridColumn: '1 / -1', flexDirection: 'row', alignItems: 'center', padding: '10px 15px', gap: 10 }}>
                    <input
                        className="modal-input"
                        placeholder="Search..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        style={{ width: 180 }}
                    />
                    <button style={toolbarBtnStyle} onClick={() => performAction('newItem')}>New Item</button>
                    <button
                        style={{ ...toolbarBtnStyle, background: Object.keys(activeFilters).length > 0 ? '#c5a059' : '#333', color: Object.keys(activeFilters).length > 0 ? '#000' : '#ddd' }}
                        onClick={() => setShowFilterDialog(true)}
                    >
                        Filter{Object.keys(activeFilters).length > 0 ? ` (${Object.keys(activeFilters).length})` : ''}
                    </button>
                    <div style={{ position: 'relative' }}>
                        <button style={toolbarBtnStyle} onClick={() => setShowColSelector(!showColSelector)}>
                            Columns <span style={{ opacity: 0.6 }}>▾</span>
                        </button>
                        {showColSelector && (
                            <div style={{ position: 'absolute', top: '100%', left: 0, background: '#1a1a1a', border: '1px solid #444', padding: 8, zIndex: 1000, minWidth: 160, boxShadow: '0 4px 12px rgba(0,0,0,0.5)', borderRadius: 6, marginTop: 4 }}>
                                {Object.keys(COLUMNS_CONFIG).map(colKey => (
                                    <label key={colKey} style={{ display: 'flex', gap: 8, padding: '4px 6px', cursor: 'pointer', color: '#ddd', fontSize: '0.9em' }}>
                                        <input type="checkbox" checked={visibleColumns.includes(colKey)} onChange={() => setVisibleColumns(prev => prev.includes(colKey) ? prev.filter(c => c !== colKey) : [...prev, colKey])} />
                                        {COLUMNS_CONFIG[colKey].label}
                                    </label>
                                ))}
                            </div>
                        )}
                    </div>

                    <div style={{ marginLeft: 'auto', display: 'flex', gap: 0, border: '1px solid #444', borderRadius: 4, overflow: 'hidden', flexShrink: 0 }}>
                        <button style={{ padding: '6px 16px', minWidth: 60, background: sideMode === 'none' ? '#c5a059' : '#222', color: sideMode === 'none' ? '#000' : '#888', border: 'none', cursor: 'pointer', fontWeight: 500 }} onClick={() => setSideMode('none')}>Items</button>
                        <button style={{ padding: '6px 16px', minWidth: 60, background: sideMode === 'trader' ? '#c5a059' : '#222', color: sideMode === 'trader' ? '#000' : '#888', border: 'none', cursor: 'pointer', borderLeft: '1px solid #444', fontWeight: 500 }} onClick={() => { setSideMode('trader'); setSelectedSideItems([]); }}>Trader</button>
                        <button style={{ padding: '6px 16px', minWidth: 60, background: sideMode === 'loot' ? '#c5a059' : '#222', color: sideMode === 'loot' ? '#000' : '#888', border: 'none', cursor: 'pointer', borderLeft: '1px solid #444', fontWeight: 500 }} onClick={() => { setSideMode('loot'); setSelectedSideItems([]); }}>Loot</button>
                    </div>
                </Card>

                {/* MAIN TABLE CARD */}
                <Card style={{ minHeight: 0 }} onDrop={e => handleDrop(e, 'global')} onDragOver={e => e.preventDefault()}>
                    <div className="items-view-scroll" style={{ flex: 1, overflow: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9em' }}>
                            <thead style={{ position: 'sticky', top: 0, background: '#222', zIndex: 10 }}>
                                <tr>
                                    {tableColumns.map(col => {
                                        const isMeta = col === 'Available' || col === 'Formula';
                                        return (
                                            <th key={col} style={{ padding: 8, textAlign: 'left', cursor: !isMeta ? 'pointer' : 'default', color: '#aaa', borderBottom: '1px solid #444' }} onClick={() => !isMeta && handleSort(col)}>
                                                {col === 'Available' ? 'Av' : col === 'Formula' ? 'Fm' : COLUMNS_CONFIG[col]?.label || col}
                                                {!isMeta && sortConfig.key === col && (sortConfig.direction === 'asc' ? ' ▲' : ' ▼')}
                                            </th>
                                        );
                                    })}
                                </tr>
                            </thead>
                            <tbody>
                                {paginatedItems.map((item, idx) => (
                                    <tr
                                        key={item.instanceId || idx}
                                        draggable
                                        onDragStart={e => handleDragStart(e, item, 'global')}
                                        onContextMenu={e => handleContextMenu(e, item, 'global')}
                                        onClick={e => handleSelect(e, item, idx)}
                                        onDoubleClick={() => handleDoubleClick(item)}
                                        style={{
                                            borderBottom: '1px solid #333',
                                            background: isSelected(item) ? 'rgba(197, 160, 89, 0.25)' : (idx % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent'),
                                            cursor: 'pointer'
                                        }}
                                    >
                                        {tableColumns.map(col => {
                                            if (col === 'Available') return <td key={col} style={{ padding: 8 }}><input type="checkbox" checked={(db.shop?.availableItems || []).includes(item.name)} onChange={(e) => { e.stopPropagation(); performAction((db.shop?.availableItems || []).includes(item.name) ? 'makeUnavailable' : 'makeAvailable'); }} onClick={e => e.stopPropagation()} /></td>;
                                            if (col === 'Formula') return <td key={col} style={{ padding: 8 }}><input type="checkbox" checked={(db.shop?.availableFormulas || []).includes(item.name)} onChange={(e) => { e.stopPropagation(); performAction((db.shop?.availableFormulas || []).includes(item.name) ? 'removeFormula' : 'addFormula'); }} onClick={e => e.stopPropagation()} /></td>;
                                            return <td key={col} style={{ padding: 8, color: '#ddd' }}>{item[col]}</td>;
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {/* Pagination */}
                    <div style={{ padding: 8, borderTop: '1px solid #333', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10, background: '#1a1a1a' }}>
                        <button disabled={page === 1} onClick={() => setPage(p => p - 1)}>◀</button>
                        <span style={{ fontSize: '0.85em' }}>Page {page} / {totalPages}</span>
                        <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>▶</button>
                        <select value={itemsPerPage} onChange={e => { setItemsPerPage(Number(e.target.value)); setPage(1); }} style={{ marginLeft: 10 }}>
                            <option value={25}>25</option>
                            <option value={50}>50</option>
                            <option value={100}>100</option>
                        </select>
                    </div>
                </Card>

                {/* SIDE PANEL (Trader/Loot List + Inventory) */}
                {sideMode !== 'none' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minHeight: 0 }}>
                        {/* TRADERS/LOOT LIST */}
                        <Card style={{ flex: '0 0 auto', maxHeight: '35%' }}>
                            <div style={{ padding: 8, borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#222' }}>
                                <span style={{ color: '#c5a059', fontWeight: 'bold' }}>{sideMode === 'trader' ? 'Traders' : 'Loot Bags'}</span>
                                <button style={{ fontSize: '0.75em', background: '#333', border: '1px solid #555', padding: '3px 8px', cursor: 'pointer' }} onClick={sideMode === 'trader' ? handleCreateTrader : handleCreateLoot}>+ New</button>
                            </div>
                            <div className="items-view-scroll" style={{ flex: 1, overflow: 'auto' }}>
                                {sideLists.sliced.map(entry => (
                                    <div
                                        key={entry.id}
                                        onClick={() => { sideMode === 'trader' ? setSelectedTraderId(entry.id) : setSelectedLootId(entry.id); setSelectedSideItems([]); }}
                                        onDrop={e => handleDrop(e, sideMode, entry.id)}
                                        onDragOver={e => e.preventDefault()}
                                        style={{
                                            padding: '6px 10px', cursor: 'pointer', borderBottom: '1px solid #333',
                                            background: (sideMode === 'trader' ? selectedTraderId : selectedLootId) === entry.id ? '#333' : 'transparent',
                                            display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                                        }}
                                    >
                                        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                            {sideMode === 'loot' && (
                                                <span style={{ fontSize: '0.85em', opacity: entry.isLocked ? 0.4 : 1 }} title={entry.isLocked ? 'Hidden from players' : 'Visible to players'}>
                                                    {entry.isLocked ? '🚫' : '👁️'}
                                                </span>
                                            )}
                                            {sideMode === 'trader' && (
                                                <span style={{ fontSize: '0.65em', color: '#888', fontStyle: 'italic' }}>[{entry.category || 'General'}]</span>
                                            )}
                                            {entry.name}
                                        </span>
                                        <span style={{ color: '#888' }}>({sideMode === 'trader' ? entry.inventory.length : entry.items.length})</span>
                                    </div>
                                ))}
                            </div>
                            {sideLists.total > 1 && (
                                <div style={{ padding: 4, borderTop: '1px solid #333', display: 'flex', justifyContent: 'center', gap: 5 }}>
                                    <button disabled={sidePage === 1} onClick={() => setSidePage(p => p - 1)}>◀</button>
                                    <span style={{ fontSize: '0.75em' }}>{sideLists.current} / {sideLists.total}</span>
                                    <button disabled={sidePage === sideLists.total} onClick={() => setSidePage(p => p + 1)}>▶</button>
                                </div>
                            )}
                        </Card>

                        {/* INVENTORY TABLE */}
                        <Card style={{ flex: 1, minHeight: 0 }}>
                            <div style={{ padding: 8, borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#222' }}>
                                <span style={{ color: '#c5a059', fontWeight: 'bold' }}>
                                    {sideMode === 'trader' && (activeTrader ? activeTrader.name : 'Select Trader')}
                                    {sideMode === 'loot' && (activeLoot ? activeLoot.name : 'Select Loot')}
                                </span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    {sideMode === 'loot' && activeLoot && (
                                        <button
                                            style={{ fontSize: '0.75em', background: activeLoot.isLocked ? '#443322' : '#334433', border: '1px solid #555', padding: '3px 8px', cursor: 'pointer', borderRadius: 4, color: activeLoot.isLocked ? '#c88' : '#8c8' }}
                                            onClick={() => {
                                                setDb(prev => {
                                                    const next = deepClone(prev);
                                                    if (activeCampaign) {
                                                        const bag = next.campaigns[activeCampaign.id]?.lootBags?.find(x => x.id === activeLoot.id);
                                                        if (bag) bag.isLocked = !bag.isLocked;
                                                    }
                                                    return next;
                                                });
                                            }}
                                        >
                                            {activeLoot.isLocked ? '🚫 Hidden' : '👁️ Visible'}
                                        </button>
                                    )}
                                    {sideMode === 'trader' && activeTrader && (
                                        <select
                                            value={activeTrader.category || 'General'}
                                            onChange={e => {
                                                setDb(prev => {
                                                    const next = deepClone(prev);
                                                    const t = next.shop?.traders?.find(x => x.id === activeTrader.id);
                                                    if (t) t.category = e.target.value;
                                                    return next;
                                                });
                                            }}
                                            style={{ fontSize: '0.75em', background: '#333', border: '1px solid #555', color: '#ddd', padding: '2px 6px', borderRadius: 4 }}
                                        >
                                            <option value="General">General</option>
                                            {SHOP_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                    )}
                                    <label style={{ display: 'flex', gap: 5, fontSize: '0.8em', cursor: 'pointer' }}>
                                        <input type="checkbox" checked={applySideFilters} onChange={() => setApplySideFilters(p => !p)} /> Filter
                                    </label>
                                </div>
                            </div>
                            {sideMode === 'loot' && activeLoot && (
                                <div style={{ padding: 5, borderBottom: '1px solid #333', display: 'flex', alignItems: 'center', gap: 5 }}>
                                    <span style={{ color: '#ffd700', fontSize: '0.8em' }}>Gold:</span>
                                    <input type="number" className="modal-input" style={{ width: 80, padding: 2 }} value={activeLoot.goldValue || 0}
                                        onChange={e => { const val = parseFloat(e.target.value) || 0; setDb(p => { const n = deepClone(p); if (activeCampaign) { const camp = n.campaigns[activeCampaign.id]; camp.lootBags.find(x => x.id === activeLoot.id).goldValue = val; } return n; }); }} />
                                </div>
                            )}
                            <div className="items-view-scroll" style={{ flex: 1, overflow: 'auto' }}>
                                <table style={{ width: '100%', fontSize: '0.85em', borderCollapse: 'collapse' }}>
                                    <thead style={{ position: 'sticky', top: 0, background: '#222' }}>
                                        <tr>
                                            {sideMode === 'trader' && <th style={{ padding: 4 }}>Av</th>}
                                            {sideMode === 'trader' && <th style={{ padding: 4 }}>Fm</th>}
                                            <th style={{ padding: 4, textAlign: 'left', cursor: 'pointer' }} onClick={() => handleSideSort('name')}>Name{sideSortConfig.key === 'name' && (sideSortConfig.direction === 'asc' ? ' ▲' : ' ▼')}</th>
                                            <th style={{ padding: 4, cursor: 'pointer' }} onClick={() => handleSideSort('level')}>Lvl{sideSortConfig.key === 'level' && (sideSortConfig.direction === 'asc' ? ' ▲' : ' ▼')}</th>
                                            <th style={{ padding: 4, cursor: 'pointer' }} onClick={() => handleSideSort('type')}>Type{sideSortConfig.key === 'type' && (sideSortConfig.direction === 'asc' ? ' ▲' : ' ▼')}</th>
                                            {sideMode === 'loot' && <th style={{ padding: 4 }}>Qty</th>}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredSideItems.map((item, idx) => (
                                            <tr
                                                key={item.instanceId || idx}
                                                draggable
                                                onDragStart={e => handleDragStart(e, item, sideMode)}
                                                onContextMenu={e => handleContextMenu(e, item, sideMode)}
                                                onClick={e => handleSideSelect(e, item, idx)}
                                                onDoubleClick={() => handleDoubleClick(item)}
                                                style={{
                                                    borderBottom: '1px solid #333',
                                                    background: isSideSelected(item) ? 'rgba(197, 160, 89, 0.25)' : (idx % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent'),
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                {sideMode === 'trader' && <td style={{ padding: 4 }}><input type="checkbox" checked={(db.shop?.availableItems || []).includes(item.name)} onChange={e => { e.stopPropagation(); performAction((db.shop?.availableItems || []).includes(item.name) ? 'makeUnavailable' : 'makeAvailable'); }} onClick={e => e.stopPropagation()} /></td>}
                                                {sideMode === 'trader' && <td style={{ padding: 4 }}><input type="checkbox" checked={(db.shop?.availableFormulas || []).includes(item.name)} onChange={e => { e.stopPropagation(); performAction((db.shop?.availableFormulas || []).includes(item.name) ? 'removeFormula' : 'addFormula'); }} onClick={e => e.stopPropagation()} /></td>}
                                                <td style={{ padding: 4 }}>{item.name}</td>
                                                <td style={{ padding: 4 }}>{item.level || 0}</td>
                                                <td style={{ padding: 4 }}>{item.type}</td>
                                                {sideMode === 'loot' && <td style={{ padding: 4 }}>{item.qty || 1}</td>}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </Card>
                    </div>
                )}

                {/* FILTER DIALOG */}
                <FilterDialog
                    isOpen={showFilterDialog} onClose={() => setShowFilterDialog(false)}
                    columns={Object.keys(COLUMNS_CONFIG)} activeFilters={activeFilters} onApply={setActiveFilters}
                    optionsMap={{ type: uniqueTypes, category: uniqueCategories, group: uniqueGroups, rarity: uniqueRarities, Available: true, Formula: true }}
                />

                {/* ITEM EDITOR MODAL */}
                {editingItem && (
                    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000, padding: 20 }}>
                        <div className="items-view-scroll" style={{ maxHeight: 'calc(100vh - 40px)', overflow: 'auto', borderRadius: 8 }}>
                            <ItemEditor
                                initialItem={Object.keys(editingItem).length > 0 ? editingItem : null}
                                onSave={() => window.location.reload()}
                                onCancel={() => setEditingItem(null)}
                                onSaveToDb={() => { }}
                            />
                        </div>
                    </div>
                )}

                {/* CONTEXT MENU */}
                {contextMenu && (
                    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 2000 }} onClick={closeContextMenu} onContextMenu={e => { e.preventDefault(); closeContextMenu(); }}>
                        <div style={{ position: 'absolute', top: contextMenu.y, left: contextMenu.x, background: '#1a1a1a', border: '1px solid #444', borderRadius: 6, minWidth: 180, boxShadow: '0 8px 24px rgba(0,0,0,0.6)', overflow: 'visible' }} onClick={e => e.stopPropagation()}>
                            {/* Side panel context menu */}
                            {(contextMenu.source === 'trader' || contextMenu.source === 'loot') ? (
                                <>
                                    <CtxItem icon="🔍" label="View Details" onClick={() => { if (onInspectItem) onInspectItem(contextMenu.item); closeContextMenu(); }} />
                                    <CtxDivider />
                                    <CtxItem icon="🗑️" label="Remove Item" onClick={() => performAction('removeFromSide')} danger />
                                    {contextMenu.source === 'loot' && (
                                        <CtxItem icon="🔢" label="Set Amount" onClick={() => performAction('setAmount')} />
                                    )}
                                </>
                            ) : (
                                /* Main table context menu */
                                <>
                                    {(db.shop?.availableItems || []).includes(contextMenu.item.name)
                                        ? <CtxItem icon="✓" label="Make Unavailable" onClick={() => performAction('makeUnavailable')} />
                                        : <CtxItem icon="+" label="Make Available" onClick={() => performAction('makeAvailable')} />
                                    }
                                    {(db.shop?.availableFormulas || []).includes(contextMenu.item.name)
                                        ? <CtxItem icon="📖" label="Remove Formula" onClick={() => performAction('removeFormula')} />
                                        : <CtxItem icon="📜" label="Add Formula" onClick={() => performAction('addFormula')} />
                                    }
                                    <CtxDivider />
                                    <CtxItem icon="✏️" label="Edit Item" onClick={() => performAction('edit')} />
                                    <CtxItem icon="📋" label="Clone Item" onClick={() => performAction('clone')} />
                                    <CtxItem icon="🗑️" label="Delete Item" onClick={() => performAction('delete')} danger />
                                    <CtxDivider />
                                    <div style={{ position: 'relative' }} onMouseEnter={() => setContextSubMenu('trader')} onMouseLeave={() => contextSubMenu === 'trader' && setContextSubMenu(null)}>
                                        <CtxItem icon="🏪" label="Assign to Trader" hasSubmenu />
                                        {contextSubMenu === 'trader' && (
                                            <div style={{ position: 'absolute', left: '100%', top: 0, background: '#1a1a1a', border: '1px solid #444', borderRadius: 6, minWidth: 140, boxShadow: '0 8px 24px rgba(0,0,0,0.6)' }}>
                                                {(db.shop?.traders || []).map(t => <CtxItem key={t.id} label={t.name} onClick={() => performAction('addToTrader', t.id)} />)}
                                            </div>
                                        )}
                                    </div>
                                    <div style={{ position: 'relative' }} onMouseEnter={() => setContextSubMenu('loot')} onMouseLeave={() => contextSubMenu === 'loot' && setContextSubMenu(null)}>
                                        <CtxItem icon="💰" label="Add to Loot Bag" hasSubmenu />
                                        {contextSubMenu === 'loot' && (
                                            <div style={{ position: 'absolute', left: '100%', top: 0, background: '#1a1a1a', border: '1px solid #444', borderRadius: 6, minWidth: 140, boxShadow: '0 8px 24px rgba(0,0,0,0.6)' }}>
                                                {campaignLootBags.map(b => <CtxItem key={b.id} label={b.name} onClick={() => performAction('addToLoot', b.id)} />)}
                                            </div>
                                        )}
                                    </div>
                                    <div style={{ position: 'relative' }} onMouseEnter={() => setContextSubMenu('player')} onMouseLeave={() => contextSubMenu === 'player' && setContextSubMenu(null)}>
                                        <CtxItem icon="🎁" label="Give to Player" hasSubmenu />
                                        {contextSubMenu === 'player' && (
                                            <div style={{ position: 'absolute', left: '100%', top: 0, background: '#1a1a1a', border: '1px solid #444', borderRadius: 6, minWidth: 140, boxShadow: '0 8px 24px rgba(0,0,0,0.6)' }}>
                                                {(activeCampaign?.characters || []).map(p => <CtxItem key={p.id} label={p.name} onClick={() => performAction('giveToPlayer', p.id)} />)}
                                            </div>
                                        )}
                                    </div>
                                    <div style={{ position: 'relative' }} onMouseEnter={() => setContextSubMenu('formula')} onMouseLeave={() => contextSubMenu === 'formula' && setContextSubMenu(null)}>
                                        <CtxItem icon="📜" label="Give Formula to Player" hasSubmenu />
                                        {contextSubMenu === 'formula' && (
                                            <div style={{ position: 'absolute', left: '100%', top: 0, background: '#1a1a1a', border: '1px solid #444', borderRadius: 6, minWidth: 140, boxShadow: '0 8px 24px rgba(0,0,0,0.6)' }}>
                                                {(activeCampaign?.characters || []).map(p => <CtxItem key={p.id} label={p.name} onClick={() => performAction('giveFormulaToPlayer', p.id)} />)}
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Spell Scroll/Wand Selector for GM actions */}
            {pendingSpellAction && (
                <SpellScrollSelectorModal
                    rank={pendingSpellAction.rank}
                    type={pendingSpellAction.type}
                    ignoreAvailability={true}
                    onCancel={() => setPendingSpellAction(null)}
                    onSelect={(spell) => {
                        const { action, arg, baseItem, type, rank } = pendingSpellAction;
                        const newItem = { ...baseItem };
                        newItem.system = baseItem.system ? JSON.parse(JSON.stringify(baseItem.system)) : {};
                        newItem.system.originalName = baseItem.name;
                        newItem.name = `${type === 'scroll' ? 'Scroll' : 'Wand'} of ${spell.name} (Rank ${rank})`;
                        newItem.system.spell = spell;
                        if (type === 'wand') {
                            newItem.system.wand = { charges: 1, max: 1 };
                        }
                        executeItemAction(action, arg, [newItem]);
                        setPendingSpellAction(null);
                    }}
                />
            )}
        </>
    );
}
