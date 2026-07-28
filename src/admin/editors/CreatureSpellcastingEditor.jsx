import React, { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    CREATURE_SPELLCASTING_MODES,
    createCreatureSpellFromCatalog,
    createCreatureSpellcastingEntry,
} from '../../shared/bestiary/creatureSpellcasting';

const TRADITIONS = ['arcane', 'divine', 'occult', 'primal'];

export default function CreatureSpellcastingEditor({ model = [], onChange, spellCatalog = [] }) {
    const [searchByEntry, setSearchByEntry] = useState({});

    const updateEntry = (entryId, updater) => {
        onChange(model.map(entry => entry.id === entryId
            ? (typeof updater === 'function' ? updater(entry) : { ...entry, ...updater })
            : entry));
    };

    const addEntry = () => onChange([...model, createCreatureSpellcastingEntry('prepared', model.length)]);
    const removeEntry = entryId => onChange(model.filter(entry => entry.id !== entryId));

    return (
        <section data-testid="creature-spellcasting-editor" className="space-y-3 rounded-md border border-border/70 bg-muted/20 p-3">
            <div className="flex items-center justify-between gap-3">
                <div>
                    <h4 className="m-0 text-sm font-semibold text-primary">Spellcasting</h4>
                    <p className="m-0 text-xs text-muted-foreground">Prepared, spontaneous, innate, and focus spellcasting entries.</p>
                </div>
                <Button data-testid="creature-spellcasting-add-entry" type="button" size="sm" onClick={addEntry}>+ Add entry</Button>
            </div>

            {model.length === 0 ? (
                <p className="m-0 rounded-md border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                    No spellcasting entries.
                </p>
            ) : null}

            {model.map((entry, index) => (
                <SpellcastingEntryEditor
                    key={entry.id}
                    testId={`creature-spellcasting-entry-${index}`}
                    entry={entry}
                    spellCatalog={spellCatalog}
                    search={searchByEntry[entry.id] || ''}
                    onSearchChange={value => setSearchByEntry(current => ({ ...current, [entry.id]: value }))}
                    onChange={updater => updateEntry(entry.id, updater)}
                    onRemove={() => removeEntry(entry.id)}
                />
            ))}
        </section>
    );
}

function SpellcastingEntryEditor({ entry, spellCatalog, search, testId, onSearchChange, onChange, onRemove }) {
    const results = useMemo(() => {
        const query = search.trim().toLowerCase();
        if (query.length < 2) return [];
        return spellCatalog
            .filter(spell => spell?.name?.toLowerCase().includes(query))
            .sort((left, right) => (Number(left.rank ?? left.level) || 0) - (Number(right.rank ?? right.level) || 0) || left.name.localeCompare(right.name))
            .slice(0, 8);
    }, [search, spellCatalog]);

    const updateSpell = (spellId, patch) => onChange(current => ({
        ...current,
        spells: current.spells.map(spell => spell.id === spellId ? { ...spell, ...patch } : spell),
    }));
    const removeSpell = spellId => onChange(current => ({
        ...current,
        spells: current.spells.filter(spell => spell.id !== spellId),
    }));
    const addSpell = spell => {
        onChange(current => ({
            ...current,
            spells: [...current.spells, createCreatureSpellFromCatalog(current, spell)],
        }));
        onSearchChange('');
    };
    const addSlot = () => {
        const usedRanks = new Set((entry.slots || []).map(slot => Number(slot.rank)));
        const rank = Array.from({ length: 11 }, (_, index) => index).find(value => !usedRanks.has(value)) ?? 0;
        onChange(current => ({
            ...current,
            slots: [...(current.slots || []), { rank, max: 1, value: 1 }].sort((left, right) => left.rank - right.rank),
        }));
    };
    const updateSlot = (rank, patch) => onChange(current => ({
        ...current,
        slots: current.slots.map(slot => slot.rank === rank ? { ...slot, ...patch } : slot),
    }));
    const removeSlot = rank => onChange(current => ({
        ...current,
        slots: current.slots.filter(slot => slot.rank !== rank),
    }));

    return (
        <article data-testid={testId} className="space-y-3 rounded-md border border-border bg-background/70 p-3">
            <div className="grid gap-2 md:grid-cols-[minmax(12rem,2fr)_repeat(5,minmax(6rem,1fr))_auto]">
                <LabeledInput label="Name" value={entry.name} onChange={value => onChange({ ...entry, name: value })} />
                <LabeledSelect label="Tradition" value={entry.tradition} options={TRADITIONS} onChange={value => onChange({ ...entry, tradition: value })} />
                <LabeledSelect label="Mode" value={entry.mode} options={CREATURE_SPELLCASTING_MODES} onChange={value => onChange({ ...entry, mode: value })} />
                <LabeledInput label="Spell DC" type="number" value={entry.dc} onChange={value => onChange({ ...entry, dc: Number(value) })} />
                <LabeledInput label="Spell attack" type="number" value={entry.attack} onChange={value => onChange({ ...entry, attack: Number(value) })} />
                <LabeledInput label="Auto-heighten" type="number" value={entry.autoHeightenLevel ?? ''} onChange={value => onChange({ ...entry, autoHeightenLevel: value })} />
                <Button type="button" variant="destructive" size="sm" className="self-end" onClick={onRemove}>Remove</Button>
            </div>

            {entry.mode === 'focus' ? (
                <div className="max-w-48">
                    <LabeledInput label="Focus point capacity" type="number" value={entry.focusPoints} onChange={value => onChange({ ...entry, focusPoints: Math.max(0, Number(value)) })} />
                </div>
            ) : null}

            {entry.mode === 'prepared' || entry.mode === 'spontaneous' ? (
                <div className="space-y-2 rounded-md border border-border/70 p-2">
                    <div className="flex items-center justify-between gap-2">
                        <strong className="text-xs uppercase text-muted-foreground">Slots by rank</strong>
                        <Button type="button" variant="outline" size="sm" onClick={addSlot}>+ Rank</Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {(entry.slots || []).map(slot => (
                            <div key={slot.rank} className="flex items-end gap-1 rounded border border-border bg-muted/30 p-2">
                                <LabeledInput label="Rank" type="number" value={slot.rank} onChange={value => updateSlot(slot.rank, { rank: Math.max(0, Number(value)) })} className="w-16" />
                                <LabeledInput label="Slots" type="number" value={slot.max} onChange={value => updateSlot(slot.rank, { max: Math.max(0, Number(value)), value: Math.max(0, Number(value)) })} className="w-16" />
                                <Button type="button" variant="ghost" size="icon-sm" onClick={() => removeSlot(slot.rank)} aria-label={`Remove rank ${slot.rank}`}>×</Button>
                            </div>
                        ))}
                    </div>
                </div>
            ) : null}

            <div className="space-y-2">
                <strong className="text-xs uppercase text-muted-foreground">Spells</strong>
                <div className="relative">
                    <input
                        className="modal-input w-full"
                        value={search}
                        onChange={event => onSearchChange(event.target.value)}
                        placeholder="Search effective spell catalog..."
                    />
                    {results.length > 0 ? (
                        <div className="absolute z-30 mt-1 max-h-56 w-full overflow-auto rounded-md border border-border bg-popover p-1 shadow-xl">
                            {results.map(spell => (
                                <button
                                    key={spell.id || spell.name}
                                    type="button"
                                    className="flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-sm hover:bg-accent"
                                    onClick={() => addSpell(spell)}
                                >
                                    <span>{spell.name}</span>
                                    <span className="text-muted-foreground">Rank {Number(spell.rank ?? spell.level) || 0}</span>
                                </button>
                            ))}
                        </div>
                    ) : null}
                </div>

                {(entry.spells || []).map(spell => (
                    <div key={spell.id} className="grid items-end gap-2 rounded-md border border-border/70 bg-muted/20 p-2 md:grid-cols-[minmax(12rem,1fr)_5rem_auto_auto_auto]">
                        <div className="min-w-0">
                            <div className="truncate text-sm font-medium">{spell.name}</div>
                            <div className="truncate text-xs text-muted-foreground">{spell.catalogRef?.id || 'embedded spell'}</div>
                        </div>
                        <LabeledInput label="Rank" type="number" value={spell.rank} onChange={value => updateSpell(spell.id, { rank: Math.max(0, Number(value)) })} />
                        {entry.mode === 'prepared' ? (
                            <LabeledInput label="Prepared" type="number" value={spell.preparedCount} onChange={value => updateSpell(spell.id, { preparedCount: Math.max(1, Number(value)) })} className="w-24" />
                        ) : null}
                        {entry.mode === 'innate' ? (
                            <label className="flex h-9 items-center gap-2 text-xs">
                                <input type="checkbox" checked={spell.atWill} onChange={event => updateSpell(spell.id, { atWill: event.target.checked })} />
                                At will
                            </label>
                        ) : null}
                        {entry.mode === 'innate' && !spell.atWill ? (
                            <LabeledInput label="Uses/day" type="number" value={spell.usesPerDay} onChange={value => updateSpell(spell.id, { usesPerDay: Math.max(1, Number(value)) })} className="w-24" />
                        ) : null}
                        <Button type="button" variant="ghost" size="sm" onClick={() => removeSpell(spell.id)}>Remove</Button>
                    </div>
                ))}
            </div>
        </article>
    );
}

function LabeledInput({ label, value, onChange, type = 'text', className = '' }) {
    return (
        <label className={`block min-w-0 text-xs text-muted-foreground ${className}`}>
            <span className="mb-1 block">{label}</span>
            <input className="modal-input w-full" type={type} value={value} onChange={event => onChange(event.target.value)} />
        </label>
    );
}

function LabeledSelect({ label, value, options, onChange }) {
    return (
        <label className="block min-w-0 text-xs text-muted-foreground">
            <span className="mb-1 block">{label}</span>
            <select className="modal-input w-full" value={value} onChange={event => onChange(event.target.value)}>
                {options.map(option => <option key={option} value={option}>{option}</option>)}
            </select>
        </label>
    );
}
