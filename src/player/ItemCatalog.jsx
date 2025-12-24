import React, { useMemo, useState, useEffect } from 'react';
import MultiSelectDropdown from '../shared/components/MultiSelectDropdown';

// Generic Catalog Component
// Props:
// - title: string
// - items: Array of objects { name, type, ... } (Full dataset)
// - filterOptions: { types, ... } (Options for dropdowns)
// - onSelect: (item) => void
// - onClose: () => void
// - renderRow: (item, onClick) => ReactNode (Optional custom row)

export default function ItemCatalog({ title, items, filterOptions, onSelect, onClose }) {
    const [search, setSearch] = useState('');
    const [filterTypes, setFilterTypes] = useState([]);
    const [filterTraits, setFilterTraits] = useState([]);
    const [filterRarities, setFilterRarities] = useState([]);
    const [filterCategories, setFilterCategories] = useState([]);

    // Pagination
    const [page, setPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(50);
    const [showFilters, setShowFilters] = useState(false);

    // Filter Logic
    const filteredData = useMemo(() => {
        const searchLower = search.trim().toLowerCase();
        const typeSet = new Set(filterTypes);
        const traitSet = new Set(filterTraits);
        const raritySet = new Set(filterRarities);
        const catSet = new Set(filterCategories);

        const result = items.filter(item => {
            const name = item.name || '';
            const type = item.type || '';
            const traits = item.traits || [];
            const rarity = item.rarity || 'common';
            const category = item.category || ''; // For feats

            // Search
            if (searchLower && !name.toLowerCase().includes(searchLower)) return false;

            // Filters
            if (typeSet.size > 0 && !typeSet.has(type)) return false;
            if (raritySet.size > 0 && !raritySet.has(rarity)) return false;
            if (catSet.size > 0 && !catSet.has(category)) return false;

            // Traits (All selected must be present? Or Any? usually All for strict filtering, but let's do Any for ease or reuse Shop logic which was Every)
            // Shop logic was: selectedTraits.every(t => traits.includes(t))
            if (traitSet.size > 0 && !filterTraits.every(t => traits.includes(t))) return false;

            return true;
        });

        // Simple Alpha Sort
        result.sort((a, b) => a.name.localeCompare(b.name));

        return result;
    }, [items, search, filterTypes, filterTraits, filterRarities, filterCategories]);

    // Pagination Logic
    const totalPages = Math.max(1, Math.ceil(filteredData.length / itemsPerPage));
    const paginatedItems = filteredData.slice((page - 1) * itemsPerPage, page * itemsPerPage);

    // Reset page on filter change
    useEffect(() => {
        setPage(1);
    }, [search, filterTypes, filterTraits, filterRarities, filterCategories, itemsPerPage]);

    return (
        <div className="item-catalog-overlay" style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.9)', zIndex: 9999, display: 'flex', flexDirection: 'column',
            padding: 20
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h2 style={{ margin: 0, color: '#c5a059' }}>{title}</h2>
                <button className="btn-close" onClick={onClose} style={{ fontSize: '1.5em', background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}>×</button>
            </div>

            {/* Controls */}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 15 }}>
                <input
                    className="modal-input"
                    placeholder="Search..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    style={{ flex: 1, minWidth: 200 }}
                />
                <button className="btn-add-condition" onClick={() => setShowFilters(!showFilters)} style={{ width: 'auto', margin: 0 }}>
                    {showFilters ? 'Hide Filters' : 'Filters'}
                </button>
            </div>

            {/* Filters Area */}
            {showFilters && (
                <div style={{ background: '#222', padding: 10, borderRadius: 5, marginBottom: 15, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    {filterOptions.types && (
                        <MultiSelectDropdown
                            label="Type"
                            options={filterOptions.types}
                            selected={filterTypes}
                            onChange={setFilterTypes}
                        />
                    )}
                    {filterOptions.categories && (
                        <MultiSelectDropdown
                            label="Category"
                            options={filterOptions.categories}
                            selected={filterCategories}
                            onChange={setFilterCategories}
                        />
                    )}
                    {filterOptions.rarities && (
                        <MultiSelectDropdown
                            label="Rarity"
                            options={filterOptions.rarities}
                            selected={filterRarities}
                            onChange={setFilterRarities}
                        />
                    )}
                    {filterOptions.traits && (
                        <MultiSelectDropdown
                            label="Traits"
                            options={filterOptions.traits}
                            selected={filterTraits}
                            onChange={setFilterTraits}
                        />
                    )}
                </div>
            )}

            {/* List */}
            <div style={{ flex: 1, overflowY: 'auto', background: 'rgba(0,0,0,0.3)', borderRadius: 5, padding: 5 }}>
                {paginatedItems.map((item, idx) => (
                    <div key={idx} className="item-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ flex: 1 }}>
                            <div className="item-name">{item.name}</div>
                            <div style={{ fontSize: '0.8em', color: '#888' }}>
                                {item.type} {item.level ? `Lv${item.level}` : ''} {item.traits?.slice(0, 3).join(', ')}
                            </div>
                        </div>
                        <button className="btn-add-condition" style={{ width: 'auto', margin: 0, padding: '5px 15px' }} onClick={() => onSelect(item)}>
                            Add
                        </button>
                    </div>
                ))}
                {paginatedItems.length === 0 && <div style={{ padding: 20, textAlign: 'center', color: '#666' }}>No items found.</div>}
            </div>

            {/* Footer / Pagination */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
                <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="btn-add-condition" style={{ width: 'auto', opacity: page === 1 ? 0.5 : 1 }}>Prev</button>
                <div style={{ color: '#888' }}>Page {page} of {totalPages} ({filteredData.length} items)</div>
                <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)} className="btn-add-condition" style={{ width: 'auto', opacity: page === totalPages ? 0.5 : 1 }}>Next</button>
            </div>
        </div>
    );
}
