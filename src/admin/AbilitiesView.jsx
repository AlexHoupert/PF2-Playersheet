import React, { useMemo, useState } from 'react';
import { getAllAbilities, ABILITY_INDEX_FILTER_OPTIONS } from '../shared/catalog/abilityIndex';
import { parseFoundry } from '../shared/utils/foundryParser';
import MultiSelectDropdown from '../shared/components/MultiSelectDropdown';

const TYPE_TABS = [
    { code: null,  label: 'All' },
    { code: 'P',   label: 'Passive' },
    { code: 'R',   label: 'Reaction' },
    { code: 'F',   label: 'Free' },
    { code: '1',   label: '1 Action' },
    { code: '2',   label: '2 Actions' },
    { code: '3',   label: '3 Actions' },
];

function typeLabel(typeCode) {
    if (typeCode === 'P') return '—';
    if (typeCode === 'R') return 'R';
    if (typeCode === 'F') return 'F';
    return `${typeCode}A`;
}

const PAGE_SIZE = 100;

export default function AbilitiesView() {
    const allAbilities = getAllAbilities();
    const [search, setSearch]         = useState('');
    const [typeFilter, setTypeFilter]   = useState(null);
    const [traitFilter, setTraitFilter] = useState([]);
    const [selected, setSelected]       = useState(null);
    const [page, setPage]               = useState(1);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return allAbilities.filter(a => {
            if (typeFilter && a.typeCode !== typeFilter) return false;
            if (traitFilter.length && !traitFilter.every(t => a.traits.includes(t))) return false;
            if (q && !a.name.toLowerCase().includes(q)) return false;
            return true;
        });
    }, [allAbilities, typeFilter, traitFilter, search]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const safePage   = Math.min(page, totalPages);
    const pageItems  = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

    const resetPage = (fn) => (...args) => { fn(...args); setPage(1); };

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Toolbar */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10, flexShrink: 0 }}>
                <input
                    className="modal-input"
                    placeholder="Search abilities..."
                    value={search}
                    onChange={e => { setSearch(e.target.value); setPage(1); }}
                    style={{ flex: 1, minWidth: 150 }}
                />
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {TYPE_TABS.map(tab => (
                        <button
                            key={tab.code ?? 'all'}
                            onClick={() => { setTypeFilter(tab.code); setPage(1); }}
                            style={{
                                padding: '4px 10px', border: '1px solid #444', borderRadius: 4,
                                cursor: 'pointer', fontSize: '0.8em',
                                background: typeFilter === tab.code ? '#c9a86c' : '#2a2a2a',
                                color: typeFilter === tab.code ? '#111' : '#ccc',
                            }}
                        >{tab.label}</button>
                    ))}
                </div>
                <MultiSelectDropdown
                    label="Traits"
                    options={ABILITY_INDEX_FILTER_OPTIONS.traits}
                    selected={traitFilter}
                    onChange={v => { setTraitFilter(v); setPage(1); }}
                />
                <span style={{ color: '#555', fontSize: '0.8em', whiteSpace: 'nowrap' }}>{filtered.length} abilities</span>
            </div>

            {/* Content: list + preview */}
            <div style={{ flex: 1, display: 'flex', gap: 12, overflow: 'hidden' }}>
                {/* List */}
                <div style={{ flex: 1, overflowY: 'auto', background: '#1a1a1a', borderRadius: 6 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85em' }}>
                        <thead>
                            <tr style={{ position: 'sticky', top: 0, background: '#1e1e21', borderBottom: '1px solid #333' }}>
                                <th style={{ padding: '6px 12px', textAlign: 'center', color: '#888', width: 50 }}>Type</th>
                                <th style={{ padding: '6px 12px', textAlign: 'left', color: '#888' }}>Name</th>
                                <th style={{ padding: '6px 12px', textAlign: 'left', color: '#888' }}>Traits</th>
                            </tr>
                        </thead>
                        <tbody>
                            {pageItems.map(a => (
                                <tr
                                    key={a.name}
                                    onClick={() => setSelected(a)}
                                    style={{
                                        cursor: 'pointer', borderBottom: '1px solid #222',
                                        background: selected?.name === a.name ? '#2c2c1e' : 'transparent',
                                    }}
                                >
                                    <td style={{ padding: '5px 12px', color: '#888', textAlign: 'center' }}>{typeLabel(a.typeCode)}</td>
                                    <td style={{ padding: '5px 12px', color: '#ddd' }}>{a.name}</td>
                                    <td style={{ padding: '5px 12px', color: '#666', fontSize: '0.8em' }}>
                                        {a.traits.slice(0, 4).join(', ')}{a.traits.length > 4 ? '…' : ''}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {allAbilities.length === 0 && (
                        <div style={{ color: '#555', textAlign: 'center', padding: 40 }}>
                            No abilities indexed yet.<br />
                            Run <code>npm run build:abilities</code> to build the index.
                        </div>
                    )}
                    {totalPages > 1 && (
                        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, padding: '8px 0', borderTop: '1px solid #222' }}>
                            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={safePage === 1}
                                style={{ padding: '3px 10px', background: '#2a2a2a', border: '1px solid #444', color: '#ccc', cursor: 'pointer', borderRadius: 3 }}>‹</button>
                            <span style={{ color: '#888', fontSize: '0.85em' }}>Page {safePage} / {totalPages}</span>
                            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={safePage === totalPages}
                                style={{ padding: '3px 10px', background: '#2a2a2a', border: '1px solid #444', color: '#ccc', cursor: 'pointer', borderRadius: 3 }}>›</button>
                        </div>
                    )}
                </div>

                {/* Preview panel */}
                <div style={{ width: 360, overflowY: 'auto', background: '#1a1a1a', borderRadius: 6, padding: 16, flexShrink: 0 }}>
                    {selected ? (
                        <>
                            <h4 style={{ color: '#f5deb3', margin: '0 0 6px' }}>{selected.name}</h4>
                            <div style={{ color: '#888', fontSize: '0.8em', marginBottom: 8 }}>
                                {selected.typeCode === 'P' ? 'Passive'
                                    : selected.typeCode === 'R' ? 'Reaction'
                                    : selected.typeCode === 'F' ? 'Free Action'
                                    : `${selected.typeCode} Action(s)`}
                                {selected.category ? ` · ${selected.category}` : ''}
                            </div>
                            {selected.traits.length > 0 && (
                                <div style={{ marginBottom: 10 }}>
                                    {selected.traits.map(t => (
                                        <span key={t} style={{
                                            display: 'inline-block', padding: '2px 6px', marginRight: 4, marginBottom: 4,
                                            borderRadius: 3, background: '#555', color: '#fff', fontSize: '0.75em'
                                        }}>{t}</span>
                                    ))}
                                </div>
                            )}
                            <div
                                style={{ color: '#ccc', fontSize: '0.85em', lineHeight: 1.6 }}
                                dangerouslySetInnerHTML={{ __html: parseFoundry(selected.description) }}
                            />
                        </>
                    ) : (
                        <div style={{ color: '#444', textAlign: 'center', marginTop: 40 }}>
                            Select an ability to preview
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
