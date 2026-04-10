/**
 * AbilityPicker - Modal for browsing and selecting abilities from the library.
 * Used inside CreatureEditor. Double-click or "Add" button to select an ability.
 * Returns a Foundry-format action item via onSelect(item).
 */
import React, { useMemo, useState } from 'react';
import { getAllAbilities, ABILITY_INDEX_FILTER_OPTIONS } from '../catalog/abilityIndex';
import { parseFoundry } from '../utils/foundryParser';
import MultiSelectDropdown from './MultiSelectDropdown';

const TYPE_TABS = [
    { code: null, label: 'All' },
    { code: 'P',  label: 'Passive' },
    { code: 'R',  label: 'Reaction' },
    { code: 'F',  label: 'Free' },
    { code: '1',  label: '1 Action' },
    { code: '2',  label: '2 Actions' },
    { code: '3',  label: '3 Actions' },
];

function typeLabel(typeCode) {
    if (typeCode === 'P') return '—';
    if (typeCode === 'R') return 'R';
    if (typeCode === 'F') return 'F';
    return `${typeCode}A`;
}

function buildFoundryItem(ability) {
    let actionType, actionCost;
    if (ability.typeCode === 'P') { actionType = 'passive'; actionCost = null; }
    else if (ability.typeCode === 'R') { actionType = 'reaction'; actionCost = null; }
    else if (ability.typeCode === 'F') { actionType = 'free'; actionCost = null; }
    else { actionType = 'action'; actionCost = parseInt(ability.typeCode) || 1; }

    return {
        _id: `ability-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        name: ability.name,
        type: 'action',
        img: '',
        system: {
            actionType: { value: actionType },
            actions: { value: actionCost },
            description: { value: ability.description },
            traits: { value: ability.traits },
            category: ability.category,
        },
    };
}

export default function AbilityPicker({ onSelect, onClose, defaultTypeFilter = null }) {
    const allAbilities = getAllAbilities();
    const [search, setSearch]         = useState('');
    const [typeFilter, setTypeFilter]   = useState(defaultTypeFilter);
    const [traitFilter, setTraitFilter] = useState([]);
    const [preview, setPreview]         = useState(null);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return allAbilities.filter(a => {
            if (typeFilter && a.typeCode !== typeFilter) return false;
            if (traitFilter.length && !traitFilter.every(t => a.traits.includes(t))) return false;
            if (q && !a.name.toLowerCase().includes(q)) return false;
            return true;
        });
    }, [allAbilities, typeFilter, traitFilter, search]);

    const handleSelect = (ability) => {
        onSelect(buildFoundryItem(ability));
        onClose();
    };

    return (
        <div
            style={{
                position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000,
            }}
            onClick={onClose}
        >
            <div
                style={{
                    background: '#1e1e21', border: '2px solid #c9a86c', borderRadius: 8,
                    width: '90vw', maxWidth: 900, height: '80vh',
                    display: 'flex', flexDirection: 'column', overflow: 'hidden',
                }}
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div style={{ padding: '12px 16px', borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                    <h3 style={{ margin: 0, color: '#f5deb3' }}>Ability Library</h3>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#888', fontSize: '1.5em', cursor: 'pointer', lineHeight: 1 }}>×</button>
                </div>

                {/* Filters */}
                <div style={{ padding: '8px 16px', borderBottom: '1px solid #333', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', flexShrink: 0 }}>
                    <input
                        className="modal-input"
                        placeholder="Search abilities..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        style={{ flex: 1, minWidth: 150 }}
                        autoFocus
                    />
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {TYPE_TABS.map(tab => (
                            <button
                                key={tab.code ?? 'all'}
                                onClick={() => setTypeFilter(tab.code)}
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
                        onChange={setTraitFilter}
                    />
                </div>

                {/* Content: list + preview */}
                <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                    {/* List */}
                    <div style={{ flex: 1, overflowY: 'auto', borderRight: '1px solid #333' }}>
                        <div style={{ fontSize: '0.75em', color: '#555', padding: '4px 16px' }}>
                            {filtered.length} abilities · double-click to add
                        </div>
                        {filtered.map(a => (
                            <div
                                key={a.name}
                                onClick={() => setPreview(a)}
                                onDoubleClick={() => handleSelect(a)}
                                style={{
                                    padding: '6px 16px', cursor: 'pointer', borderBottom: '1px solid #222',
                                    background: preview?.name === a.name ? '#2c2c1e' : 'transparent',
                                    display: 'flex', gap: 10, alignItems: 'center',
                                }}
                            >
                                <span style={{ width: 28, textAlign: 'center', fontSize: '0.8em', color: '#888', flexShrink: 0 }}>
                                    {typeLabel(a.typeCode)}
                                </span>
                                <span style={{ color: '#ddd', flex: 1 }}>{a.name}</span>
                                {a.traits.length > 0 && (
                                    <span style={{ color: '#555', fontSize: '0.75em' }}>
                                        {a.traits.slice(0, 3).join(', ')}{a.traits.length > 3 ? '…' : ''}
                                    </span>
                                )}
                            </div>
                        ))}
                        {allAbilities.length === 0 && (
                            <div style={{ color: '#555', textAlign: 'center', padding: 40, fontSize: '0.9em' }}>
                                No abilities indexed yet.<br />
                                Run <code>npm run build:abilities</code> to build the index.
                            </div>
                        )}
                    </div>

                    {/* Preview */}
                    <div style={{ width: 320, overflowY: 'auto', padding: 16, flexShrink: 0 }}>
                        {preview ? (
                            <>
                                <h4 style={{ color: '#f5deb3', margin: '0 0 6px' }}>{preview.name}</h4>
                                <div style={{ color: '#888', fontSize: '0.8em', marginBottom: 8 }}>
                                    {preview.typeCode === 'P' ? 'Passive'
                                        : preview.typeCode === 'R' ? 'Reaction'
                                        : preview.typeCode === 'F' ? 'Free Action'
                                        : `${preview.typeCode} Action(s)`}
                                </div>
                                {preview.traits.length > 0 && (
                                    <div style={{ marginBottom: 10 }}>
                                        {preview.traits.map(t => (
                                            <span key={t} style={{
                                                display: 'inline-block', padding: '2px 6px', marginRight: 4, marginBottom: 4,
                                                borderRadius: 3, background: '#555', color: '#fff', fontSize: '0.75em',
                                            }}>{t}</span>
                                        ))}
                                    </div>
                                )}
                                <div
                                    style={{ color: '#ccc', fontSize: '0.85em', lineHeight: 1.6 }}
                                    dangerouslySetInnerHTML={{ __html: parseFoundry(preview.description) }}
                                />
                                <button
                                    className="set-btn"
                                    style={{ marginTop: 16, width: '100%', padding: '8px 0' }}
                                    onClick={() => handleSelect(preview)}
                                >
                                    + Add to Creature
                                </button>
                            </>
                        ) : (
                            <div style={{ color: '#555', textAlign: 'center', marginTop: 40, fontSize: '0.9em' }}>
                                Click an ability to preview.<br />Double-click to add directly.
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
