/**
 * FilterBar — unified search + filter trigger + active-filter chips.
 *
 * Replaces the scatter of inline MultiSelectDropdowns in every view.
 * On desktop the filter button opens FilterDialog as a modal.
 * On mobile it opens FilterDialog as a BottomSheet (FilterDialog handles this itself).
 *
 * Props:
 *   search          string
 *   onSearch        (val) => void
 *   searchPlaceholder string
 *   activeFilters   object
 *   onFiltersChange (filters) => void
 *   columns         string[]          — filterable column keys
 *   optionsMap      object            — passed through to FilterDialog
 *   columnLabels    object            — { key: 'Display Label' } optional
 *   extraLeft       ReactNode         — slot for type-tabs or other toolbar content
 *   extraRight      ReactNode         — slot for action buttons (New, etc.)
 */
import React, { useState } from 'react';
import FilterDialog from './FilterDialog';

// Human-readable label for a filter value
function valueLabel(val) {
    if (val === true) return 'Yes';
    if (val === false) return 'No';
    if (Array.isArray(val)) return val.join(', ');
    return String(val);
}

export default function FilterBar({
    search = '',
    onSearch,
    searchPlaceholder = 'Search...',
    activeFilters = {},
    onFiltersChange,
    columns = [],
    optionsMap = {},
    columnLabels = {},
    extraLeft,
    extraRight,
}) {
    const [dialogOpen, setDialogOpen] = useState(false);

    const activeCount = Object.keys(activeFilters).filter(k => {
        const v = activeFilters[k];
        return v !== undefined && !(Array.isArray(v) && v.length === 0);
    }).length;

    const removeFilter = (key) => {
        const next = { ...activeFilters };
        delete next[key];
        onFiltersChange(next);
    };

    const activeChips = Object.entries(activeFilters).filter(([, v]) =>
        v !== undefined && !(Array.isArray(v) && v.length === 0)
    );

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0 }}>
            {/* ── Row 1: search + extras + filter button ── */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <input
                    className="modal-input"
                    placeholder={searchPlaceholder}
                    value={search}
                    onChange={e => onSearch(e.target.value)}
                    style={{ flex: 1, minWidth: 120 }}
                />

                {extraLeft}

                {columns.length > 0 && (
                    <button
                        className={`filter-trigger-btn${activeCount > 0 ? ' has-filters' : ''}`}
                        onClick={() => setDialogOpen(true)}
                    >
                        ⚙ Filters
                        {activeCount > 0 && <span className="filter-badge">{activeCount}</span>}
                    </button>
                )}

                {extraRight}
            </div>

            {/* ── Row 2: active filter chips ── */}
            {activeChips.length > 0 && (
                <div className="filter-chips-strip">
                    {activeChips.map(([key, val]) => (
                        <span key={key} className="filter-chip">
                            <span style={{ color: '#888', marginRight: 2 }}>
                                {columnLabels[key] || key}:
                            </span>
                            {valueLabel(val)}
                            <button className="filter-chip-remove" onClick={() => removeFilter(key)}>×</button>
                        </span>
                    ))}
                    {activeChips.length > 1 && (
                        <button
                            onClick={() => onFiltersChange({})}
                            style={{ background: 'none', border: 'none', color: '#888', fontSize: '0.78em', cursor: 'pointer', padding: '3px 6px' }}
                        >
                            clear all
                        </button>
                    )}
                </div>
            )}

            <FilterDialog
                isOpen={dialogOpen}
                onClose={() => setDialogOpen(false)}
                columns={columns}
                activeFilters={activeFilters}
                onApply={onFiltersChange}
                optionsMap={optionsMap}
            />
        </div>
    );
}
