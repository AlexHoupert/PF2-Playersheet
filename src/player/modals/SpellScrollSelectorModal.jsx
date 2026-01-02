import React, { useState, useMemo } from 'react';
import { SPELL_INDEX_ITEMS } from '../../shared/catalog/spellIndex';

export default function SpellScrollSelectorModal({ rank, type, onSelect, onCancel }) {
    const [search, setSearch] = useState('');

    const availableSpells = useMemo(() => {
        const lowerSearch = search.toLowerCase();
        return SPELL_INDEX_ITEMS.filter(spell => {
            if (spell.level !== rank) return false;

            // Availability Check
            if (type === 'scroll' && !spell.scroll_available) return false;
            if (type === 'wand' && !spell.wand_available) return false;

            return spell.name.toLowerCase().includes(lowerSearch);
        });
    }, [rank, type, search]);

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 1100,
            display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 20
        }} onClick={onCancel}>
            <div style={{
                backgroundColor: '#2b2b2e', border: '1px solid #c5a059',
                padding: '20px', borderRadius: '8px', maxWidth: '500px', width: '100%',
                maxHeight: '80vh', display: 'flex', flexDirection: 'column'
            }} onClick={e => e.stopPropagation()}>
                <h3 style={{ marginTop: 0, color: '#e0e0e0', borderBottom: '1px solid #444', paddingBottom: 10 }}>
                    Select Spell for {type === 'scroll' ? 'Scroll' : 'Wand'} (Rank {rank})
                </h3>

                <input
                    autoFocus
                    placeholder="Search Spells..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    style={{
                        background: '#111', border: '1px solid #444', color: '#e0e0e0',
                        padding: 8, borderRadius: 4, marginBottom: 10, width: '100%'
                    }}
                />

                <div style={{ flex: 1, overflowY: 'auto', minHeight: 200 }}>
                    {availableSpells.length === 0 ? (
                        <div style={{ color: '#777', fontStyle: 'italic', textAlign: 'center', marginTop: 20 }}>
                            No {type === 'scroll' ? 'scrolls' : 'wands'} available for Rank {rank}.
                            <br />
                            <small>(Ask GM to mark spells as available)</small>
                        </div>
                    ) : (
                        availableSpells.map(spell => (
                            <div
                                key={spell.name}
                                onClick={() => onSelect(spell)}
                                style={{
                                    padding: '8px 10px', borderBottom: '1px solid #333',
                                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10,
                                    transition: 'background 0.2s'
                                }}
                                onMouseEnter={e => e.currentTarget.style.background = '#333'}
                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                            >
                                {spell.img && (
                                    <img src={`ressources/${spell.img}`} alt="" style={{ width: 24, height: 24 }} />
                                )}
                                <div>
                                    <div style={{ color: '#e0e0e0', fontWeight: 'bold' }}>{spell.name}</div>
                                    <div style={{ fontSize: '0.8em', color: '#888' }}>
                                        {spell.traditions.join(', ')}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 15 }}>
                    <button onClick={onCancel} style={{
                        background: 'transparent', color: '#aaa', border: '1px solid #555',
                        padding: '6px 12px', borderRadius: 4, cursor: 'pointer'
                    }}>
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
}
