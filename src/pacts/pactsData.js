/**
 * Elemental Pacts — shared constants and helpers.
 * All pact and deviant ability data lives in the DB (db.pacts, db.abilities.deviant).
 */

export const ELEMENTS = {
    Fire:  { color: '#f44336', dim: '#c62828', bg: '#2a0a0a', icon: '🔥', label: 'Fire'  },
    Water: { color: '#42a5f5', dim: '#1565c0', bg: '#0a1a2a', icon: '💧', label: 'Water' },
    Earth: { color: '#a1887f', dim: '#6d4c41', bg: '#1a120e', icon: '🪨', label: 'Earth' },
    Air:   { color: '#b0bec5', dim: '#78909c', bg: '#141a1f', icon: '🌬️', label: 'Air'   },
    Wood:  { color: '#66bb6a', dim: '#388e3c', bg: '#0a1a0a', icon: '🌿', label: 'Wood'  },
    Metal: { color: '#bdbdbd', dim: '#757575', bg: '#1a1a1a', icon: '⚙️', label: 'Metal' },
};

export const ELEMENT_NAMES = Object.keys(ELEMENTS);

export const BACKLASH_TIERS = ['mild', 'moderate', 'severe'];
export const BACKLASH_LABELS = { mild: 'Mild Backlash', moderate: 'Moderate Backlash', severe: 'Severe Backlash' };
export const BACKLASH_COLORS = { mild: '#ff8f00', moderate: '#f4511e', severe: '#b71c1c' };

// Conditions that can be applied as backlash effects
export const BACKLASH_CONDITIONS = [
    { name: 'drained',    valued: true  },
    { name: 'fatigued',   valued: false },
    { name: 'enfeebled',  valued: true  },
    { name: 'clumsy',     valued: true  },
    { name: 'stupefied',  valued: true  },
    { name: 'frightened', valued: true  },
    { name: 'sickened',   valued: true  },
    { name: 'unconscious',valued: false },
    { name: 'stunned',    valued: true  },
    { name: 'slowed',     valued: true  },
];

/** Get all deviant abilities from DB as a sorted array. */
export function getDeviantAbilities(db) {
    return Object.values(db?.abilities?.deviant || {})
        .sort((a, b) => (a.level ?? 0) - (b.level ?? 0) || a.name.localeCompare(b.name));
}

/** Get deviant abilities filtered by element. */
export function getDeviantAbilitiesByElement(db, element) {
    return getDeviantAbilities(db).filter(a => a.element === element);
}

/** Get all pacts from DB as a sorted array. */
export function getPacts(db) {
    return Object.values(db?.pacts || {}).sort((a, b) => a.name.localeCompare(b.name));
}

/** Resolve a pact by id. */
export function getPact(db, pactId) {
    return db?.pacts?.[pactId] || null;
}

/** Resolve a deviant ability by id. */
export function getDeviantAbility(db, abilityId) {
    return db?.abilities?.deviant?.[abilityId] || null;
}

/** Generate a simple id from a name string. */
export function generateId(name, suffix = '') {
    const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    return base + (suffix ? '_' + suffix : '') + '_' + Date.now();
}

/** Apply backlash effects to character.conditions (mutates immer draft). */
export function applyBacklashEffects(characterDraft, effects, tier) {
    if (!characterDraft.conditions) characterDraft.conditions = [];
    (effects || []).forEach(eff => {
        // Remove existing instance of the same backlash condition first (upsert by name+tier)
        characterDraft.conditions = characterDraft.conditions.filter(
            c => !(c.type === 'backlash' && c.name === eff.conditionName && c.backlashTier === tier)
        );
        characterDraft.conditions.push({
            name: eff.conditionName,
            level: eff.value ?? 1,
            type: 'backlash',
            backlashTier: tier
        });
    });
}
