import { deepClone } from '../utils/deepClone.js';

export const CREATURE_SPELLCASTING_MODES = ['prepared', 'spontaneous', 'innate', 'focus'];

function numberOr(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function stableId(prefix, parts) {
    const text = `${prefix}:${parts.filter(Boolean).join(':')}`;
    let hash = 2166136261;
    for (let index = 0; index < text.length; index += 1) {
        hash ^= text.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return `${prefix}-${(hash >>> 0).toString(36)}`;
}

function readMode(entry) {
    const mode = String(entry?.system?.prepared?.value || '').toLowerCase();
    return CREATURE_SPELLCASTING_MODES.includes(mode) ? mode : 'prepared';
}

function readSlots(entry) {
    return Object.entries(entry?.system?.slots || {})
        .map(([slotKey, value]) => ({
            rank: numberOr(slotKey.replace(/^slot/, ''), 0),
            max: Math.max(0, numberOr(value?.max, 0)),
            value: Math.max(0, numberOr(value?.value, value?.max ?? 0)),
            prepared: Array.isArray(value?.prepared) ? value.prepared.map(slot => ({ ...slot })) : [],
        }))
        .sort((left, right) => left.rank - right.rank);
}

function readSpellRank(spell) {
    return Math.max(0, numberOr(
        spell?.system?.location?.heightenedLevel
        ?? spell?.system?.level?.value
        ?? spell?.rank
        ?? spell?.level,
        0
    ));
}

function buildSpellCatalogRef(spell) {
    const compendiumId = String(spell?._stats?.compendiumSource || '').split('.').pop();
    return {
        type: 'spell',
        id: spell?.catalogId || spell?.id || compendiumId || spell?._id || null,
        name: spell?.name || 'Spell',
        sourceFile: spell?.sourceFile || null,
    };
}

export function buildCreatureSpellcastingModel(items = []) {
    const sourceItems = Array.isArray(items) ? items : [];
    const entries = sourceItems.filter(item => item?.type === 'spellcastingEntry');
    const spells = sourceItems.filter(item => item?.type === 'spell');

    return entries.map((entry) => {
        const entryId = entry._id || entry.id || stableId('spellcasting', [entry.name]);
        const mode = readMode(entry);
        const slots = readSlots(entry);
        const preparedCounts = new Map();
        slots.forEach(slot => slot.prepared.forEach(prepared => {
            const spellId = prepared?.id;
            if (spellId) preparedCounts.set(spellId, (preparedCounts.get(spellId) || 0) + 1);
        }));

        return {
            id: entryId,
            name: entry.name || 'Spellcasting',
            tradition: entry.system?.tradition?.value || 'arcane',
            mode,
            dc: numberOr(entry.system?.spelldc?.dc, 10),
            attack: numberOr(entry.system?.spelldc?.value ?? entry.system?.spelldc?.mod, 0),
            autoHeightenLevel: entry.system?.autoHeightenLevel?.value ?? null,
            focusPoints: Math.max(0, numberOr(entry.system?.focusPoints?.max ?? entry.system?.focusPoints?.value, mode === 'focus' ? 1 : 0)),
            slots,
            spells: spells
                .filter(spell => spell?.system?.location?.value === entryId)
                .map(spell => ({
                    id: spell._id || spell.id || stableId('spell', [entryId, spell.name, readSpellRank(spell)]),
                    name: spell.name || 'Spell',
                    rank: readSpellRank(spell),
                    preparedCount: Math.max(1, preparedCounts.get(spell._id || spell.id) || 1),
                    atWill: Boolean(spell.system?.location?.atWill),
                    usesPerDay: Math.max(0, numberOr(spell.system?.location?.uses?.max ?? spell.system?.location?.uses, 0)),
                    catalogRef: buildSpellCatalogRef(spell),
                    snapshot: deepClone(spell),
                }))
                .sort((left, right) => left.rank - right.rank || left.name.localeCompare(right.name)),
            preservedEntry: deepClone(entry),
        };
    });
}

function normalizeSlotMap(entry) {
    const slots = {};
    (entry.slots || []).forEach(slot => {
        const rank = Math.max(0, numberOr(slot.rank, 0));
        slots[`slot${rank}`] = {
            ...(slot.preserved || {}),
            max: Math.max(0, numberOr(slot.max, 0)),
            value: Math.max(0, numberOr(slot.value, slot.max ?? 0)),
        };
    });
    return slots;
}

function serializeSpell(entry, spell, index) {
    const id = spell.id || stableId('spell', [entry.id, spell.catalogRef?.id, spell.name, spell.rank, index]);
    const base = deepClone(spell.snapshot || {});
    const location = {
        ...(base.system?.location || {}),
        value: entry.id,
        heightenedLevel: Math.max(0, numberOr(spell.rank, 0)),
    };
    if (entry.mode === 'innate') {
        location.atWill = Boolean(spell.atWill);
        if (!spell.atWill && numberOr(spell.usesPerDay, 0) > 0) {
            location.uses = { value: numberOr(spell.usesPerDay, 0), max: numberOr(spell.usesPerDay, 0) };
        } else {
            delete location.uses;
        }
    } else {
        delete location.atWill;
        delete location.uses;
    }
    return {
        ...base,
        _id: id,
        id,
        name: spell.name || base.name || spell.catalogRef?.name || 'Spell',
        img: base.img || spell.catalogRef?.img || 'systems/pf2e/icons/default-icons/spell.svg',
        type: 'spell',
        catalogId: spell.catalogRef?.id || base.catalogId || null,
        sourceFile: spell.catalogRef?.sourceFile || base.sourceFile || null,
        system: {
            ...(base.system || {}),
            level: { ...(base.system?.level || {}), value: Math.max(0, numberOr(spell.rank, 0)) },
            location,
        },
    };
}

export function serializeCreatureSpellcastingModel(model = [], preservedItems = []) {
    const originalItems = Array.isArray(preservedItems) ? preservedItems : [];
    const originalEntryIds = new Set(
        originalItems
            .filter(item => item?.type === 'spellcastingEntry')
            .map(item => item._id || item.id)
            .filter(Boolean)
    );
    const retainedItems = originalItems.filter(item => {
        if (item?.type === 'spellcastingEntry') return false;
        if (item?.type === 'spell' && originalEntryIds.has(item.system?.location?.value)) return false;
        return true;
    }).map(deepClone);

    const serialized = [];
    (model || []).forEach((entryInput, entryIndex) => {
        const entry = {
            ...entryInput,
            id: entryInput.id || stableId('spellcasting', [entryInput.name, entryIndex]),
        };
        const spells = (entry.spells || []).map((spell, spellIndex) => serializeSpell(entry, spell, spellIndex));
        const slots = normalizeSlotMap(entry);
        if (entry.mode === 'prepared') {
            Object.values(slots).forEach(slot => { slot.prepared = []; });
            spells.forEach((spell, spellIndex) => {
                const source = entry.spells[spellIndex];
                const rank = Math.max(0, numberOr(source.rank, 0));
                const slot = slots[`slot${rank}`] || { max: 0, value: 0, prepared: [] };
                slot.prepared = Array.isArray(slot.prepared) ? slot.prepared : [];
                for (let count = 0; count < Math.max(1, numberOr(source.preparedCount, 1)); count += 1) {
                    slot.prepared.push({ id: spell._id });
                }
                slot.max = Math.max(slot.max, slot.prepared.length);
                slot.value = Math.max(slot.value, slot.max);
                slots[`slot${rank}`] = slot;
            });
        } else {
            Object.values(slots).forEach(slot => { delete slot.prepared; });
        }

        const base = deepClone(entry.preservedEntry || {});
        const spellcastingEntry = {
            ...base,
            _id: entry.id,
            id: entry.id,
            name: entry.name || base.name || 'Spellcasting',
            img: base.img || 'systems/pf2e/icons/default-icons/spellcastingEntry.svg',
            type: 'spellcastingEntry',
            system: {
                ...(base.system || {}),
                prepared: { ...(base.system?.prepared || {}), value: entry.mode },
                tradition: { ...(base.system?.tradition || {}), value: entry.tradition || 'arcane' },
                spelldc: {
                    ...(base.system?.spelldc || {}),
                    dc: numberOr(entry.dc, 10),
                    value: numberOr(entry.attack, 0),
                },
                autoHeightenLevel: {
                    ...(base.system?.autoHeightenLevel || {}),
                    value: entry.autoHeightenLevel === '' || entry.autoHeightenLevel == null
                        ? null
                        : numberOr(entry.autoHeightenLevel, null),
                },
                slots,
                focusPoints: entry.mode === 'focus'
                    ? { ...(base.system?.focusPoints || {}), value: numberOr(entry.focusPoints, 1), max: numberOr(entry.focusPoints, 1) }
                    : base.system?.focusPoints,
            },
        };
        if (entry.mode !== 'focus' && spellcastingEntry.system.focusPoints == null) {
            delete spellcastingEntry.system.focusPoints;
        }
        serialized.push(spellcastingEntry, ...spells);
    });

    return [...retainedItems, ...serialized];
}

export function createCreatureSpellcastingEntry(mode = 'prepared', index = 0) {
    const normalizedMode = CREATURE_SPELLCASTING_MODES.includes(mode) ? mode : 'prepared';
    return {
        id: stableId('spellcasting', [normalizedMode, Date.now(), index]),
        name: `${normalizedMode.charAt(0).toUpperCase()}${normalizedMode.slice(1)} Spells`,
        tradition: 'arcane',
        mode: normalizedMode,
        dc: 10,
        attack: 0,
        autoHeightenLevel: null,
        focusPoints: normalizedMode === 'focus' ? 1 : 0,
        slots: [],
        spells: [],
        preservedEntry: null,
    };
}

export function createCreatureSpellFromCatalog(entry, catalogSpell, rank = null) {
    const spellRank = Math.max(0, numberOr(rank ?? catalogSpell?.rank ?? catalogSpell?.level, 0));
    return {
        id: stableId('spell', [entry?.id, catalogSpell?.id, catalogSpell?.name, Date.now()]),
        name: catalogSpell?.name || 'Spell',
        rank: spellRank,
        preparedCount: 1,
        atWill: false,
        usesPerDay: 1,
        catalogRef: {
            type: 'spell',
            id: catalogSpell?.id || catalogSpell?._id || null,
            name: catalogSpell?.name || 'Spell',
            sourceFile: catalogSpell?.sourceFile || null,
            img: catalogSpell?.img || null,
        },
        snapshot: deepClone(catalogSpell || {}),
    };
}
