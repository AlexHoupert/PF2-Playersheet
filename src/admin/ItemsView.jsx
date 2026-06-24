import React, { useEffect, useMemo, useState } from 'react';
import { useCampaign } from '../shared/context/CampaignContext';
import { useWindowSize } from '../shared/hooks/useWindowSize';
import { SHOP_INDEX_FILTER_OPTIONS, SHOP_INDEX_ITEMS, fetchShopItemDetailBySourceFile } from '../shared/catalog/shopIndex';
import ItemsViewLayout from './items/ItemsViewLayout';
import { selectShop } from '../shared/db/selectors/shopSelectors';
import { selectLootBagLists } from '../shared/db/selectors/campaignSelectors';

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

const FILTER_OPTIONS = {
    type: uniqueTypes,
    category: uniqueCategories,
    group: uniqueGroups,
    rarity: uniqueRarities,
    traits: SHOP_INDEX_FILTER_OPTIONS.traits,
    bulk: ['L', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'],
    Available: true,
    Formula: true,
};

// Scrollbar styling
const scrollbarStyles = `
    .items-view-scroll::-webkit-scrollbar { width: 8px; height: 8px; }
    .items-view-scroll::-webkit-scrollbar-track { background: #1a1a1a; }
    .items-view-scroll::-webkit-scrollbar-thumb { background: #444; border-radius: 4px; }
    .items-view-scroll::-webkit-scrollbar-thumb:hover { background: #555; }
`;

const sameId = (a, b) => a != null && b != null && String(a) === String(b);

export default function ItemsView({ db, onInspectItem }) {
    const { activeCampaign, dataActions } = useCampaign();
    const { isMobile } = useWindowSize();
    const runDataAction = (action) => {
        Promise.resolve(action).catch(err => {
            console.error(err);
            alert(err?.message || String(err));
        });
    };
    const shopState = useMemo(() => selectShop(db), [db]);

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
    const [applySideFilters, setApplySideFilters] = useState(false);

    // Mobile: show side panel in bottom sheet
    const [mobileSideOpen, setMobileSideOpen] = useState(false);

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
        const customItemsRaw = Object.values(shopState.customItems);
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
    }, [shopState.customItems]);

    const filterItem = (item, filters, searchTerm) => {
        if (searchTerm && !item.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;

        if (filters.Available === true && !shopState.availableItems.includes(item.name)) return false;
        if (filters.Available === false && shopState.availableItems.includes(item.name)) return false;

        if (filters.Formula === true && !shopState.availableFormulas.includes(item.name)) return false;
        if (filters.Formula === false && shopState.availableFormulas.includes(item.name)) return false;

        for (const [key, val] of Object.entries(filters)) {
            if (key === 'Available' || key === 'Formula') continue;
            if (!val || (Array.isArray(val) && val.length === 0)) continue;

            // traits is stored as { rarity, value: [...] } — needs special handling
            if (key === 'traits') {
                const itemTraits = Array.isArray(item.traits?.value) ? item.traits.value
                    : Array.isArray(item.traits) ? item.traits : [];
                if (Array.isArray(val)) {
                    if (!val.every(t => itemTraits.includes(t))) return false;
                } else if (typeof val === 'string' && val) {
                    if (!itemTraits.some(t => t.toLowerCase().includes(val.toLowerCase()))) return false;
                }
                continue;
            }

            // bulk can be a number or 'L' string — compare as string
            if (key === 'bulk') {
                const itemBulk = String(item.bulk ?? '');
                if (Array.isArray(val)) {
                    if (!val.includes(itemBulk)) return false;
                } else if (typeof val === 'string' && val) {
                    if (itemBulk !== val) return false;
                }
                continue;
            }

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
    }, [globalItems, activeFilters, search, shopState]);

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
    const activeTrader = shopState.traders.find(t => sameId(t.id, selectedTraderId));
    const { lootBags: campaignLootBags } = selectLootBagLists(db, activeCampaign, activeCampaign?.id);
    const activeLoot = campaignLootBags.find(b => sameId(b.id, selectedLootId));

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
    }, [sideMode, activeTrader, activeLoot, globalItems, sideSortConfig]);

    const filteredSideItems = useMemo(() => {
        return applySideFilters ? sideItems.filter(i => filterItem(i, activeFilters, search)) : sideItems;
    }, [sideItems, applySideFilters, activeFilters, search]);

    // Side List Pagination (10 max)
    const sideLists = useMemo(() => {
        let list = [];
        if (sideMode === 'trader') list = shopState.traders;
        if (sideMode === 'loot') list = campaignLootBags;
        const max = 10;
        const total = Math.ceil(list.length / max) || 1;
        const current = Math.min(sidePage, total);
        return { sliced: list.slice((current - 1) * max, current * max), total, current };
    }, [shopState.traders, campaignLootBags, sideMode, sidePage]);

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
        if (targetType === 'loot' && targetId && activeCampaign) {
            runDataAction(dataActions.loot.addItems(activeCampaign.id, targetId, items));
            return;
        }
        if (targetType === 'global' && source === 'loot' && selectedLootId && activeCampaign) {
            runDataAction(dataActions.loot.removeItems(activeCampaign.id, selectedLootId, items));
            setSelectedSideItems([]);
            return;
        }
        if (targetType === 'trader' && targetId) {
            runDataAction(dataActions.shop.addItemsToTrader(targetId, items));
            return;
        }
        if (targetType === 'global' && source === 'trader' && selectedTraderId) {
            runDataAction(dataActions.shop.removeItemsFromTrader(selectedTraderId, items));
            setSelectedSideItems([]);
        }
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
        if (action === 'addToLoot' && arg && activeCampaign) {
            runDataAction(dataActions.loot.addItems(activeCampaign.id, arg, items.map(item => ({ ...item, qty: item.qty || 1 }))));
            return;
        }
        if (action === 'giveToPlayer' && arg && activeCampaign) {
            items.forEach(item => {
                runDataAction(dataActions.inventory.addItem(activeCampaign.id, arg, item, { qty: item.qty || 1 }));
            });
            return;
        }
        if (action === 'giveFormulaToPlayer' && arg && activeCampaign) {
            items.forEach(item => {
                runDataAction(dataActions.character.updateCharacter(activeCampaign.id, arg, character => {
                    const next = { ...character, formulaBook: [...(character.formulaBook || [])] };
                    if (!next.formulaBook.includes(item.name)) next.formulaBook.push(item.name);
                    return next;
                }));
            });
            return;
        }

        items.forEach(t => {
            if (action === 'makeAvailable') runDataAction(dataActions.shop.setItemAvailable(t.name, true));
            if (action === 'makeUnavailable') runDataAction(dataActions.shop.setItemAvailable(t.name, false));
            if (action === 'addFormula') runDataAction(dataActions.shop.setFormulaAvailable(t.name, true));
            if (action === 'removeFormula') runDataAction(dataActions.shop.setFormulaAvailable(t.name, false));
            if (action === 'addToTrader' && arg) runDataAction(dataActions.shop.addItemsToTrader(arg, [t]));
            if (action === 'delete' && t.isCustom) runDataAction(dataActions.globalContent.deleteCustomItem(t));
        });
    };

    const performAction = (action, arg) => {
        closeContextMenu();
        const source = contextMenu?.source || 'global';
        const targets = source === 'global'
            ? (selectedItems.length > 0 ? selectedItems : [contextMenu?.item].filter(Boolean))
            : (selectedSideItems.length > 0 ? selectedSideItems : [contextMenu?.item].filter(Boolean));

        if (action === 'edit') { setEditingItem(targets[0]); return; }
        if (action === 'clone') {
            const base = targets[0];
            const openClone = (extra = {}) => setEditingItem({ ...base, ...extra, sourceFile: null, name: `${base.name} (Copy)`, isCustom: true });
            if (base.sourceFile) {
                fetchShopItemDetailBySourceFile(base.sourceFile)
                    .then(details => openClone(details || {}))
                    .catch(() => openClone());
            } else {
                openClone();
            }
            return;
        }
        if (action === 'newItem') { setEditingItem({ name: '', isCustom: true }); return; }
        if (action === 'inspect' && onInspectItem) { onInspectItem(targets[0]); return; }

        // Side panel specific actions
        if (action === 'removeFromSide') {
            if (source === 'loot' && selectedLootId && activeCampaign) {
                runDataAction(dataActions.loot.removeItems(activeCampaign.id, selectedLootId, targets));
                setSelectedSideItems([]);
                return;
            }
            if (source === 'trader' && selectedTraderId) {
                runDataAction(dataActions.shop.removeItemsFromTrader(selectedTraderId, targets));
            }
            setSelectedSideItems([]);
            return;
        }

        if (action === 'setAmount' && source === 'loot') {
            const newQty = prompt('Enter quantity:', targets[0].qty || 1);
            if (newQty === null) return;
            const qty = parseInt(newQty, 10) || 1;
            if (activeCampaign && selectedLootId) {
                runDataAction(dataActions.loot.setItemQuantity(activeCampaign.id, selectedLootId, targets, qty));
            }
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
        runDataAction(dataActions.shop.createTrader({
            id: Date.now(),
            name: name.trim(),
            inventory: [],
            category: category.trim() || 'General',
        }));
    };

    const handleCreateLoot = () => {
        const name = prompt("Loot Bag Name:");
        if (!name || !activeCampaign) return;
        const id = Date.now();
        runDataAction(dataActions.loot.createLootBag(activeCampaign.id, { id, name, items: [], goldValue: 0 }));
        setSideMode('loot');
        setSelectedLootId(id);
        setSelectedSideItems([]);
        if (isMobile) setMobileSideOpen(true);
    };

    // Double-click handler for info modal
    const handleDoubleClick = (item) => {
        if (onInspectItem) {
            onInspectItem(item);
        }
    };

    return (
        <ItemsViewLayout
            activeCampaign={activeCampaign}
            activeFilters={activeFilters}
            activeLoot={activeLoot}
            activeTrader={activeTrader}
            applySideFilters={applySideFilters}
            campaignLootBags={campaignLootBags}
            closeContextMenu={closeContextMenu}
            contextMenu={contextMenu}
            contextSubMenu={contextSubMenu}
            COLUMNS_CONFIG={COLUMNS_CONFIG}
            dataActions={dataActions}
            db={db}
            editingItem={editingItem}
            executeItemAction={executeItemAction}
            filterOptions={FILTER_OPTIONS}
            filteredSideItems={filteredSideItems}
            handleContextMenu={handleContextMenu}
            handleCreateLoot={handleCreateLoot}
            handleCreateTrader={handleCreateTrader}
            handleDoubleClick={handleDoubleClick}
            handleDragStart={handleDragStart}
            handleDrop={handleDrop}
            handleSelect={handleSelect}
            handleSideSelect={handleSideSelect}
            handleSideSort={handleSideSort}
            handleSort={handleSort}
            isMobile={isMobile}
            itemsPerPage={itemsPerPage}
            mobileSideOpen={mobileSideOpen}
            page={page}
            paginatedItems={paginatedItems}
            pendingSpellAction={pendingSpellAction}
            performAction={performAction}
            runDataAction={runDataAction}
            scrollbarStyles={scrollbarStyles}
            search={search}
            selectedItems={selectedItems}
            selectedLootId={selectedLootId}
            selectedSideItems={selectedSideItems}
            selectedTraderId={selectedTraderId}
            setActiveFilters={setActiveFilters}
            setApplySideFilters={setApplySideFilters}
            setContextSubMenu={setContextSubMenu}
            setEditingItem={setEditingItem}
            setItemsPerPage={setItemsPerPage}
            setMobileSideOpen={setMobileSideOpen}
            setPage={setPage}
            setPendingSpellAction={setPendingSpellAction}
            setSearch={setSearch}
            setSelectedLootId={setSelectedLootId}
            setSelectedSideItems={setSelectedSideItems}
            setSelectedTraderId={setSelectedTraderId}
            setShowColSelector={setShowColSelector}
            setSideMode={setSideMode}
            setSidePage={setSidePage}
            setVisibleColumns={setVisibleColumns}
            showColSelector={showColSelector}
            shopState={shopState}
            sideLists={sideLists}
            sideMode={sideMode}
            sidePage={sidePage}
            sideSortConfig={sideSortConfig}
            sortConfig={sortConfig}
            sortedGlobalItems={sortedGlobalItems}
            totalPages={totalPages}
            visibleColumns={visibleColumns}
        />
    );
}
