import React, { useEffect, useMemo, useState } from 'react';
import MultiSelectDropdown from '../shared/components/MultiSelectDropdown';
import { SHOP_ALL_AVAILABLE_KEY, SHOP_CATEGORIES } from '../shared/constants/shop';
import { SHOP_INDEX_BY_NAME } from '../shared/catalog/shopIndex';
import { getShopItemRowMeta } from '../shared/catalog/shopRowMeta';
import { getFormulaPrice } from '../shared/constants/crafting';

export default function ShopView({ db, onInspectItem, onBuyItem, onBuyFormula, knownFormulas = [] }) {
    const [shopSearch, setShopSearch] = useState('');
    const [shopFilterTypes, setShopFilterTypes] = useState([]);
    const [shopFilterCategories, setShopFilterCategories] = useState([]);
    const [shopFilterGroups, setShopFilterGroups] = useState([]);
    const [shopFilterRarities, setShopFilterRarities] = useState([]);
    const [shopFilterTraits, setShopFilterTraits] = useState([]);
    const [shopPage, setShopPage] = useState(1);
    const [shopCategory, setShopCategory] = useState('');
    const [shopTrader, setShopTrader] = useState('');
    const [shopItemsPerPage, setShopItemsPerPage] = useState(50);
    const [showShopFilters, setShowShopFilters] = useState(false);

    const allTraders = useMemo(
        () => (Array.isArray(db.shop?.traders) ? db.shop.traders : []),
        [db.shop?.traders]
    );

    const shopInventory = useMemo(() => {
        if (!shopCategory) {
            return { traders: [], items: [], availableCount: 0 };
        }

        const traders = shopCategory === SHOP_ALL_AVAILABLE_KEY
            ? []
            : allTraders.filter(t => t.category === shopCategory);

        const availableItems = Array.isArray(db.shop?.availableItems) ? db.shop.availableItems : [];
        const availableSet = new Set(availableItems);
        const enforceAvailability = shopCategory === SHOP_ALL_AVAILABLE_KEY || availableItems.length > 0;

        const getItemNames = (trader) => {
            const names = new Set();
            (trader?.inventory || []).forEach(item => {
                if (typeof item === 'string') names.add(item);
                else if (item?.name) names.add(item.name);
            });
            return names;
        };

        const itemNames = new Set();
        if (shopCategory === SHOP_ALL_AVAILABLE_KEY) {
            if (enforceAvailability) availableItems.forEach(n => itemNames.add(n));
        } else {
            const selectedTrader = shopTrader ? traders.find(t => t.id === shopTrader) : null;
            const relevantTraders = selectedTrader ? [selectedTrader] : traders;
            relevantTraders.forEach(trader => {
                getItemNames(trader).forEach(n => itemNames.add(n));
            });
        }

        let items = Array.from(itemNames).map(name => SHOP_INDEX_BY_NAME.get(name)).filter(Boolean);
        if (enforceAvailability && shopCategory !== SHOP_ALL_AVAILABLE_KEY) {
            items = items.filter(item => availableSet.has(item.name));
        }

        return { traders, items, availableCount: availableItems.length };
    }, [allTraders, db.shop?.availableItems, shopCategory, shopTrader]);

    const shopFilterData = useMemo(() => {
        if (!shopCategory) {
            return {
                filteredItems: [],
                options: { types: [], categories: [], groups: [], rarities: [], traits: [] }
            };
        }

        const searchLower = shopSearch.trim().toLowerCase();
        const typeSet = new Set(shopFilterTypes);
        const categorySet = new Set(shopFilterCategories);
        const groupSet = new Set(shopFilterGroups);
        const raritySet = new Set(shopFilterRarities);
        const selectedTraits = shopFilterTraits;

        const optionTypes = new Set();
        const optionCategories = new Set();
        const optionGroups = new Set();
        const optionRarities = new Set();
        const optionTraits = new Set();

        const filteredItems = [];

        for (const item of shopInventory.items) {
            const name = item?.name || '';
            const type = item?.type || '';
            const category = item?.category || '';
            const group = item?.group || '';
            const rarity = item?.rarity || item?.traits?.rarity || '';
            const traits = Array.isArray(item?.traits?.value) ? item.traits.value : [];

            const matchesSearch = !searchLower || name.toLowerCase().includes(searchLower);
            const matchesType = typeSet.size === 0 || (type && typeSet.has(type));
            const matchesCategory = categorySet.size === 0 || (category && categorySet.has(category));
            const matchesGroup = groupSet.size === 0 || (group && groupSet.has(group));
            const matchesRarity = raritySet.size === 0 || (rarity && raritySet.has(rarity));
            const matchesTraits =
                selectedTraits.length === 0 ||
                selectedTraits.every(t => traits.includes(t));

            if (matchesSearch && matchesCategory && matchesGroup && matchesRarity && matchesTraits && type) {
                optionTypes.add(type);
            }
            if (matchesSearch && matchesType && matchesGroup && matchesRarity && matchesTraits && category) {
                optionCategories.add(category);
            }
            if (matchesSearch && matchesType && matchesCategory && matchesRarity && matchesTraits && group) {
                optionGroups.add(group);
            }
            if (matchesSearch && matchesType && matchesCategory && matchesGroup && matchesTraits && rarity) {
                optionRarities.add(rarity);
            }

            if (matchesSearch && matchesType && matchesCategory && matchesGroup && matchesRarity && matchesTraits) {
                filteredItems.push(item);
                traits.forEach(t => optionTraits.add(t));
            }
        }

        const sortAlpha = (a, b) => a.localeCompare(b);
        return {
            filteredItems,
            options: {
                types: Array.from(optionTypes).sort(sortAlpha),
                categories: Array.from(optionCategories).sort(sortAlpha),
                groups: Array.from(optionGroups).sort(sortAlpha),
                rarities: Array.from(optionRarities).sort(sortAlpha),
                traits: Array.from(optionTraits).sort(sortAlpha)
            }
        };
    }, [
        shopCategory,
        shopInventory.items,
        shopSearch,
        shopFilterTypes,
        shopFilterCategories,
        shopFilterGroups,
        shopFilterRarities,
        shopFilterTraits
    ]);

    const shopPagination = useMemo(() => {
        const totalPages = Math.max(1, Math.ceil(shopFilterData.filteredItems.length / shopItemsPerPage));
        const currentPage = Math.min(shopPage, totalPages);
        const startIndex = (currentPage - 1) * shopItemsPerPage;
        const paginatedItems = shopFilterData.filteredItems.slice(startIndex, startIndex + shopItemsPerPage);
        return { totalPages, currentPage, paginatedItems };
    }, [shopFilterData.filteredItems, shopItemsPerPage, shopPage]);

    useEffect(() => {
        if (shopPage !== shopPagination.currentPage) setShopPage(shopPagination.currentPage);
    }, [shopPage, shopPagination.currentPage]);

    useEffect(() => {
        const prune = (prev, allowed) => {
            const next = prev.filter(v => allowed.has(v));
            if (next.length === prev.length && next.every((v, i) => v === prev[i])) return prev;
            return next;
        };

        setShopFilterTypes(prev => prune(prev, new Set(shopFilterData.options.types)));
        setShopFilterCategories(prev => prune(prev, new Set(shopFilterData.options.categories)));
        setShopFilterGroups(prev => prune(prev, new Set(shopFilterData.options.groups)));
        setShopFilterRarities(prev => prune(prev, new Set(shopFilterData.options.rarities)));
        setShopFilterTraits(prev => prune(prev, new Set(shopFilterData.options.traits)));
    }, [
        shopFilterData.options.types,
        shopFilterData.options.categories,
        shopFilterData.options.groups,
        shopFilterData.options.rarities,
        shopFilterData.options.traits
    ]);

    if (!shopCategory) {
        return (
            <div>
                <div className="shop-card-grid">
                    {SHOP_CATEGORIES.map(category => (
                        <div
                            className="shop-card"
                            key={category}
                            onClick={() => {
                                setShopCategory(category);
                                setShopTrader('');
                                setShopPage(1);
                            }}
                        >
                            <img
                                src={`ressources/icons/cards/${category.toLowerCase()}.webp`}
                                alt={category}
                                style={{
                                    width: '100%',
                                    height: 'auto',
                                    maxWidth: '140px',
                                    maxHeight: '140px',
                                    margin: '0 auto',
                                    objectFit: 'fill'
                                }}
                            />
                            <div style={{ color: '#fff', marginTop: 0 }}>{category}</div>
                        </div>
                    ))}
                </div>
                <button
                    className="btn-add-condition"
                    onClick={() => {
                        setShopCategory(SHOP_ALL_AVAILABLE_KEY);
                        setShopTrader('');
                        setShopPage(1);
                    }}
                >
                    Show all available Items
                </button>
            </div>
        );
    }

    return (
        <div>
            <div className="sub-tabs" style={{ display: 'flex' }}>
                <button
                    className="sub-tab-btn"
                    onClick={() => {
                        setShopCategory('');
                        setShopTrader('');
                        setShopPage(1);
                    }}
                >
                    Return
                </button>
                {shopCategory !== SHOP_ALL_AVAILABLE_KEY && (
                    <>
                        <button
                            className={`sub-tab-btn ${shopTrader === '' ? 'active' : ''}`}
                            onClick={() => {
                                setShopTrader('');
                                setShopPage(1);
                            }}
                        >
                            All
                        </button>
                        {shopInventory.traders.map(trader => (
                            <button
                                key={trader.id}
                                className={`sub-tab-btn ${shopTrader === trader.id ? 'active' : ''}`}
                                onClick={() => {
                                    setShopTrader(trader.id);
                                    setShopPage(1);
                                }}
                            >
                                {trader.name}
                            </button>
                        ))}
                    </>
                )}
            </div>

            <div style={{ marginBottom: 15, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <input
                    className="modal-input"
                    placeholder="Search Shop..."
                    value={shopSearch}
                    onChange={e => {
                        setShopSearch(e.target.value);
                        setShopPage(1);
                    }}
                    style={{ flex: 1, minWidth: '150px' }}
                />
                <button
                    className="btn-add-condition"
                    style={{ width: 'auto', margin: 0 }}
                    onClick={() => setShowShopFilters(!showShopFilters)}
                >
                    {showShopFilters ? 'Hide Filters' : 'Filters'}
                </button>
            </div>

            {showShopFilters && (
                <div style={{
                    marginBottom: 15,
                    display: 'flex',
                    gap: 10,
                    flexWrap: 'wrap',
                    padding: 10,
                    background: 'rgba(0,0,0,0.2)',
                    borderRadius: 4
                }}>
                    <MultiSelectDropdown
                        label="Type"
                        options={shopFilterData.options.types}
                        selected={shopFilterTypes}
                        onChange={(next) => {
                            setShopFilterTypes(next);
                            setShopPage(1);
                        }}
                        disabled={shopFilterData.options.types.length === 0}
                    />
                    <MultiSelectDropdown
                        label="Category"
                        options={shopFilterData.options.categories}
                        selected={shopFilterCategories}
                        onChange={(next) => {
                            setShopFilterCategories(next);
                            setShopPage(1);
                        }}
                        disabled={shopFilterData.options.categories.length === 0}
                    />
                    <MultiSelectDropdown
                        label="Group"
                        options={shopFilterData.options.groups}
                        selected={shopFilterGroups}
                        onChange={(next) => {
                            setShopFilterGroups(next);
                            setShopPage(1);
                        }}
                        disabled={shopFilterData.options.groups.length === 0}
                    />
                    <MultiSelectDropdown
                        label="Rarity"
                        options={shopFilterData.options.rarities}
                        selected={shopFilterRarities}
                        onChange={(next) => {
                            setShopFilterRarities(next);
                            setShopPage(1);
                        }}
                        disabled={shopFilterData.options.rarities.length === 0}
                    />
                    <MultiSelectDropdown
                        label="Traits"
                        options={shopFilterData.options.traits}
                        selected={shopFilterTraits}
                        onChange={(next) => {
                            setShopFilterTraits(next);
                            setShopPage(1);
                        }}
                        disabled={shopFilterData.options.traits.length === 0}
                    />

                    <select
                        className="modal-input"
                        style={{ width: 'auto' }}
                        value={shopItemsPerPage}
                        onChange={e => {
                            setShopItemsPerPage(Number(e.target.value));
                            setShopPage(1);
                        }}
                    >
                        <option value={25}>25 per page</option>
                        <option value={50}>50 per page</option>
                        <option value={100}>100 per page</option>
                    </select>
                </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <button
                    disabled={shopPagination.currentPage === 1}
                    onClick={() => setShopPage(p => Math.max(1, p - 1))}
                    className="btn-add-condition"
                    style={{ width: 'auto', margin: 0, opacity: shopPagination.currentPage === 1 ? 0.5 : 1 }}
                >
                    Prev
                </button>
                <span style={{ color: '#888', fontSize: '0.9em' }}>
                    Page {shopPagination.currentPage} of {shopPagination.totalPages} ({shopFilterData.filteredItems.length} items)
                </span>
                <button
                    disabled={shopPagination.currentPage >= shopPagination.totalPages}
                    onClick={() => setShopPage(p => Math.min(shopPagination.totalPages, p + 1))}
                    className="btn-add-condition"
                    style={{ width: 'auto', margin: 0, opacity: shopPagination.currentPage >= shopPagination.totalPages ? 0.5 : 1 }}
                >
                    Next
                </button>
            </div>

            {shopPagination.paginatedItems.map((item, idx) => {
                const { row1, row2 } = getShopItemRowMeta(item);
                return (
                    <div className="item-row shop-item-row" key={idx} onClick={() => onInspectItem(item)}>
                        {item.img && (
                            <img
                                className="item-icon"
                                src={`ressources/${item.img}`}
                                alt=""
                            />
                        )}
                        <div className="item-row-main">
                            <div className="item-name">{item.name}</div>
                            {row1 && <div className="item-row-meta item-row-meta-1">{row1}</div>}
                            {row2 && <div className="item-row-meta item-row-meta-2">{row2}</div>}
                        </div>
                        <div className="shop-row-actions" style={{ display: 'flex', alignItems: 'flex-start' }}>
                            {/* Formula Icon */}
                            {(db.shop?.availableFormulas || []).includes(item.name) && (
                                <div
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (!(knownFormulas || []).includes(item.name)) {
                                            onBuyFormula(item, getFormulaPrice(item.level));
                                        }
                                    }}
                                    title={
                                        (knownFormulas || []).includes(item.name)
                                            ? "Formula Learned"
                                            : `Buy Formula for ${getFormulaPrice(item.level)} gp`
                                    }
                                    style={{
                                        cursor: (knownFormulas || []).includes(item.name) ? 'default' : 'pointer',
                                        marginRight: 0,
                                        marginTop: -4, // Moved higher as requested
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}
                                >
                                    <span style={{
                                        fontSize: '1.4em',
                                        // Emojis ignore 'color', so we use filter for greyscale
                                        filter: (knownFormulas || []).includes(item.name)
                                            ? 'drop-shadow(0 0 2px rgba(103, 58, 183, 0.5))'
                                            : 'grayscale(100%) opacity(0.2)'
                                    }}>
                                        📜
                                    </span>
                                </div>
                            )}

                            {/* Buy Button & Price */}
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                                <button
                                    className="btn-buy"
                                    style={{ marginBottom: 4, height: 'auto', padding: '2px 8px', fontSize: '0.9em' }}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onBuyItem(item);
                                    }}
                                >
                                    Buy
                                </button>
                                <span className="shop-price" style={{ fontSize: '0.95em' }}>
                                    {item.price} gp
                                </span>
                            </div>
                        </div>
                    </div>
                );
            })}

            {shopPagination.paginatedItems.length === 0 && (
                <div style={{ color: '#666', fontStyle: 'italic' }}>No items found.</div>
            )}

            {shopPagination.paginatedItems.length > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
                    <button
                        disabled={shopPagination.currentPage === 1}
                        onClick={() => setShopPage(p => Math.max(1, p - 1))}
                        className="btn-add-condition"
                        style={{ width: 'auto', margin: 0, opacity: shopPagination.currentPage === 1 ? 0.5 : 1 }}
                    >
                        Prev
                    </button>
                    <span style={{ color: '#888', fontSize: '0.9em' }}>
                        Page {shopPagination.currentPage} of {shopPagination.totalPages}
                    </span>
                    <button
                        disabled={shopPagination.currentPage >= shopPagination.totalPages}
                        onClick={() => setShopPage(p => Math.min(shopPagination.totalPages, p + 1))}
                        className="btn-add-condition"
                        style={{ width: 'auto', margin: 0, opacity: shopPagination.currentPage >= shopPagination.totalPages ? 0.5 : 1 }}
                    >
                        Next
                    </button>
                </div>
            )}
        </div>
    );
}
