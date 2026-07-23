import React, { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { SPELL_INDEX_ITEMS } from '../../shared/catalog/spellIndex';
import { mergeCatalogIndexWithOverrides } from '../../shared/db/selectors/catalogOverrideSelectors';
import PickerDialog from '../../shared/components/dialogs/PickerDialog';

export default function SpellScrollSelectorModal({ rank, type, db, onSelect, onCancel, ignoreAvailability = false }) {
    const [search, setSearch] = useState('');
    const spellItems = useMemo(
        () => mergeCatalogIndexWithOverrides(SPELL_INDEX_ITEMS, db, 'spell'),
        [db]
    );

    const availableSpells = useMemo(() => {
        const lowerSearch = search.toLowerCase();
        return spellItems.filter(spell => {
            if (spell.level !== rank) return false;

            // Availability Check
            if (!ignoreAvailability) {
                if (type === 'scroll' && !spell.scroll_available) return false;
                if (type === 'wand' && !spell.wand_available) return false;
            }

            return spell.name.toLowerCase().includes(lowerSearch);
        });
    }, [rank, type, search, ignoreAvailability, spellItems]);

    return (
        <PickerDialog
            open
            onOpenChange={(open) => { if (!open) onCancel?.(); }}
            layerId={`spell-scroll-selector-${type}-${rank}`}
            title={`Select Spell for ${type === 'scroll' ? 'Scroll' : 'Wand'}`}
            description={`Rank ${rank}`}
            size="md"
            showConfirm={false}
            cancelLabel="Cancel"
            bodyClassName="flex min-h-0 flex-col gap-3"
        >
                <Input
                    autoFocus
                    placeholder="Search Spells..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                />

                <div className="min-h-48 flex-1 overflow-y-auto overscroll-contain rounded-md border border-border/60">
                    {availableSpells.length === 0 ? (
                        <div style={{ color: '#777', fontStyle: 'italic', textAlign: 'center', marginTop: 20 }}>
                            No {type === 'scroll' ? 'scrolls' : 'wands'} available for Rank {rank}.
                            <br />
                            <small>(Ask GM to mark spells as available)</small>
                        </div>
                    ) : (
                        availableSpells.map(spell => (
                            <button
                                key={spell.name}
                                type="button"
                                onClick={() => onSelect(spell)}
                                className="flex w-full items-center gap-3 border-b border-border/50 px-3 py-2 text-left transition-colors last:border-b-0 hover:bg-muted"
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
                            </button>
                        ))
                    )}
                </div>

        </PickerDialog>
    );
}
