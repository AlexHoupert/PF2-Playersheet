import React, { useEffect, useState } from 'react';
import BottomSheet from '../../shared/components/BottomSheet';
import { useWindowSize } from '../../shared/hooks/useWindowSize';

/**
 * FilterDialog — shows filter controls in a modal (desktop) or BottomSheet (mobile).
 *
 * Props:
 *   isOpen        boolean
 *   onClose       () => void
 *   columns       string[]          filterable column keys
 *   activeFilters object            current filter state  { key: value | value[] }
 *   onApply       (filters) => void
 *   optionsMap    object            { key: string[] }  → renders as checkbox list
 *                                   { key: true }      → renders as Yes/No/Any toggle
 *                                   (absent key)       → renders as text input
 */
export default function FilterDialog({ isOpen, onClose, columns, activeFilters, onApply, optionsMap = {} }) {
    const { isMobile } = useWindowSize();
    const [tempFilters, setTempFilters] = useState({});

    useEffect(() => {
        if (isOpen) setTempFilters({ ...activeFilters });
    }, [isOpen, activeFilters]);

    if (!isOpen) return null;

    const handleApply = () => { onApply(tempFilters); onClose(); };
    const handleClear = () => setTempFilters({});

    const setFilter = (key, val) =>
        setTempFilters(prev => ({ ...prev, [key]: val }));

    const clearFilter = (key) =>
        setTempFilters(prev => { const n = { ...prev }; delete n[key]; return n; });

    // ── Per-column filter input ──────────────────────────────────────────────
    const renderInput = (col) => {
        const options = optionsMap[col];
        const currentVal = tempFilters[col];

        if (options === true) {
            // Boolean toggle (Available, Formula)
            return (
                <div style={{ display: 'flex', gap: 8 }}>
                    {[['Yes', true], ['No', false], ['Any', undefined]].map(([label, v]) => (
                        <label key={label} style={{ display: 'flex', alignItems: 'center', gap: 4, minHeight: 36, cursor: 'pointer', color: '#ccc', fontSize: '0.9em' }}>
                            <input type="radio" name={`filter-${col}`}
                                checked={currentVal === v}
                                onChange={() => v === undefined ? clearFilter(col) : setFilter(col, v)} />
                            {label}
                        </label>
                    ))}
                </div>
            );
        }

        if (Array.isArray(options)) {
            const selected = Array.isArray(currentVal) ? currentVal : [];
            return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: isMobile ? 180 : 150, overflowY: 'auto', border: '1px solid #444', borderRadius: 4, padding: 4 }}>
                    {options.map(opt => {
                        const checked = selected.includes(opt);
                        return (
                            <label key={opt} style={{
                                display: 'flex', alignItems: 'center', gap: 10,
                                minHeight: isMobile ? 40 : 30, padding: isMobile ? '4px 8px' : '2px 4px',
                                cursor: 'pointer', borderRadius: 4,
                                background: checked ? 'rgba(201,168,108,0.12)' : 'transparent',
                            }}>
                                <input type="checkbox" checked={checked}
                                    onChange={e => {
                                        const next = e.target.checked ? [...selected, opt] : selected.filter(x => x !== opt);
                                        next.length ? setFilter(col, next) : clearFilter(col);
                                    }} />
                                <span style={{ color: checked ? '#f5deb3' : '#ccc', fontSize: '0.9em', flex: 1 }}>{opt}</span>
                                {checked && <span style={{ color: '#c9a86c', fontSize: '0.8em' }}>✓</span>}
                            </label>
                        );
                    })}
                </div>
            );
        }

        // Text input fallback
        return (
            <input className="modal-input"
                placeholder={`Filter ${col}...`}
                value={currentVal || ''}
                onChange={e => e.target.value ? setFilter(col, e.target.value) : clearFilter(col)}
                style={{ width: '100%', minHeight: isMobile ? 40 : 32 }}
            />
        );
    };

    // ── Inner body (same on mobile and desktop) ──────────────────────────────
    const filterableCols = columns.filter(c => c !== 'name');
    const activeCount = Object.keys(tempFilters).filter(k => {
        const v = tempFilters[k];
        return v !== undefined && !(Array.isArray(v) && v.length === 0);
    }).length;

    const body = (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Scrollable filter list */}
            <div style={{
                flex: 1,
                overflowY: 'auto',
                padding: isMobile ? '8px 16px' : 15,
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
                gap: isMobile ? 16 : 20,
                alignContent: 'start',
            }}>
                {filterableCols.map(col => (
                    <div key={col}>
                        <label style={{
                            textTransform: 'capitalize', color: '#c5a059',
                            fontSize: '0.85em', fontWeight: 'bold',
                            display: 'flex', justifyContent: 'space-between', marginBottom: 6,
                        }}>
                            {col}
                            {tempFilters[col] !== undefined && (
                                <button onClick={() => clearFilter(col)}
                                    style={{ background: 'none', border: 'none', color: '#888', fontSize: '0.8em', cursor: 'pointer' }}>
                                    clear
                                </button>
                            )}
                        </label>
                        {renderInput(col)}
                    </div>
                ))}
            </div>

            {/* Footer */}
            <div style={{
                padding: isMobile ? '10px 16px' : 15,
                borderTop: '1px solid #444',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 10,
                flexShrink: 0,
            }}>
                <button onClick={handleClear}
                    style={{ background: '#333', color: '#aaa', border: '1px solid #555', padding: '8px 14px', borderRadius: 4, cursor: 'pointer' }}>
                    Clear all
                </button>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={onClose}
                        style={{ background: 'transparent', color: '#888', border: 'none', cursor: 'pointer', padding: '8px 12px' }}>
                        Cancel
                    </button>
                    <button onClick={handleApply}
                        style={{ background: '#c5a059', color: '#000', border: 'none', padding: '8px 20px', borderRadius: 4, fontWeight: 'bold', cursor: 'pointer' }}>
                        Apply{activeCount > 0 ? ` (${activeCount})` : ''}
                    </button>
                </div>
            </div>
        </div>
    );

    // ── Mobile: render in BottomSheet ────────────────────────────────────────
    if (isMobile) {
        return (
            <BottomSheet isOpen={isOpen} onClose={onClose} title="Filters" height="80vh">
                {body}
            </BottomSheet>
        );
    }

    // ── Desktop: render as centred modal ─────────────────────────────────────
    return (
        <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
            zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }} onClick={onClose}>
            <div style={{
                background: '#1a1a1a', border: '1px solid #5c4033',
                width: 'min(500px, 95vw)', maxHeight: '80vh',
                display: 'flex', flexDirection: 'column',
                borderRadius: 8, boxShadow: '0 10px 30px rgba(0,0,0,0.8)',
            }} onClick={e => e.stopPropagation()}>
                <div style={{ padding: 15, borderBottom: '1px solid #444', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0, color: '#c5a059', fontFamily: 'Cinzel, serif' }}>Filter Columns</h3>
                    <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#888', fontSize: '1.2rem', cursor: 'pointer' }}>×</button>
                </div>
                {body}
            </div>
        </div>
    );
}
