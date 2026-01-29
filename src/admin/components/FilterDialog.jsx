import React, { useState, useEffect } from 'react';

// A generic Filter Dialog that shows filters for each available column
// Props:
// - isOpen: boolean
// - onClose: function
// - columns: array of strings (all possible filterable keys)
// - activeFilters: object { key: value } or { key: [values] }
// - onApply: function(newFilters)
// - optionsMap: object { key: [options] } for select-based filters. If missing, assume text input.

export default function FilterDialog({ isOpen, onClose, columns, activeFilters, onApply, optionsMap = {} }) {
    const [tempFilters, setTempFilters] = useState({});

    useEffect(() => {
        if (isOpen) {
            setTempFilters({ ...activeFilters });
        }
    }, [isOpen, activeFilters]);

    if (!isOpen) return null;

    const handleApply = () => {
        onApply(tempFilters);
        onClose();
    };

    const handleClear = () => {
        setTempFilters({});
    };

    const renderFilterInput = (col) => {
        const options = optionsMap[col];
        const currentVal = tempFilters[col];

        if (options && Array.isArray(options)) {
            // Multi-select or Single Select logic?
            // Let's assume multi-select for options.
            const selected = Array.isArray(currentVal) ? currentVal : [];

            return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 150, overflowY: 'auto', border: '1px solid #444', padding: 5, borderRadius: 4 }}>
                    {options.map(opt => (
                        <label key={opt} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: '0.9em' }}>
                            <input
                                type="checkbox"
                                checked={selected.includes(opt)}
                                onChange={(e) => {
                                    const newSelected = e.target.checked
                                        ? [...selected, opt]
                                        : selected.filter(x => x !== opt);

                                    setTempFilters(prev => ({
                                        ...prev,
                                        [col]: newSelected.length > 0 ? newSelected : undefined
                                    }));
                                }}
                            />
                            <span style={{ color: '#ccc' }}>{opt}</span>
                        </label>
                    ))}
                </div>
            );
        } else if (typeof options === 'boolean') {
            // Boolean toggle (e.g. Available)
            return (
                <div style={{ display: 'flex', gap: 10 }}>
                    <label><input type="radio" name={`filter-${col}`} checked={currentVal === true} onChange={() => setTempFilters(p => ({ ...p, [col]: true }))} /> Yes</label>
                    <label><input type="radio" name={`filter-${col}`} checked={currentVal === false} onChange={() => setTempFilters(p => ({ ...p, [col]: false }))} /> No</label>
                    <label><input type="radio" name={`filter-${col}`} checked={currentVal === undefined} onChange={() => setTempFilters(p => { const n = { ...p }; delete n[col]; return n; })} /> Any</label>
                </div>
            )
        } else {
            // Text Input
            return (
                <input
                    className="modal-input"
                    placeholder={`Filter ${col}...`}
                    value={currentVal || ''}
                    onChange={(e) => {
                        const val = e.target.value;
                        setTempFilters(prev => ({
                            ...prev,
                            [col]: val ? val : undefined
                        }));
                    }}
                    style={{ width: '100%' }}
                />
            );
        }
    };

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.7)', zIndex: 1000,
            display: 'flex', alignItems: 'center', justifyContent: 'center'
        }} onClick={onClose}>
            <div style={{
                background: '#1a1a1a', border: '1px solid #5c4033',
                width: 500, maxWidth: '90vw', maxHeight: '80vh',
                display: 'flex', flexDirection: 'column',
                borderRadius: 8, boxShadow: '0 10px 30px rgba(0,0,0,0.8)'
            }} onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div style={{ padding: 15, borderBottom: '1px solid #444', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0, color: '#c5a059', fontFamily: 'Cinzel, serif' }}>Filter Columns</h3>
                    <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#888', fontSize: '1.2rem', cursor: 'pointer' }}>×</button>
                </div>

                {/* Body */}
                <div style={{ padding: 15, overflowY: 'auto', flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                    {columns.map(col => {
                        if (col === 'name') return null; // usually search bar handles name, but maybe advanced name filter? Skip for now if redundant.
                        return (
                            <div key={col} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                                <label style={{ textTransform: 'capitalize', color: '#c5a059', fontSize: '0.9em', fontWeight: 'bold' }}>{col}</label>
                                {renderFilterInput(col)}
                            </div>
                        )
                    })}
                </div>

                {/* Footer */}
                <div style={{ padding: 15, borderTop: '1px solid #444', display: 'flex', justifyContent: 'space-between' }}>
                    <button onClick={handleClear} style={{ background: '#333', color: '#aaa', border: '1px solid #555', padding: '6px 12px', borderRadius: 4, cursor: 'pointer' }}>Clear All</button>
                    <div style={{ display: 'flex', gap: 10 }}>
                        <button onClick={onClose} style={{ background: 'transparent', color: '#888', border: 'none', cursor: 'pointer' }}>Cancel</button>
                        <button onClick={handleApply} style={{ background: '#c5a059', color: '#000', border: 'none', padding: '6px 16px', borderRadius: 4, fontWeight: 'bold', cursor: 'pointer' }}>Apply Filters</button>
                    </div>
                </div>
            </div>
        </div>
    );
}
