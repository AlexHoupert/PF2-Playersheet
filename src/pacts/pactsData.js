/**
 * Elemental Pacts — shared constants and helpers.
 * Pact and deviant ability helpers read through the selector layer.
 */

import { selectDeviantAbility, selectDeviantAbilityList } from '../shared/db/selectors/abilitySelectors.js';
import { selectPact, selectPactList } from '../shared/db/selectors/pactSelectors.js';

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

export function formatBacklashEffectSummary(effects) {
    return (effects || [])
        .filter(Boolean)
        .map(effect => `${effect.conditionName || 'condition'}${effect.value ? ` ${effect.value}` : ''}`)
        .join(', ');
}

export function summarizeBacklashTier(tierData, fallback = 'Narrative backlash') {
    const effectSummary = formatBacklashEffectSummary(tierData?.effects);
    const descriptionSummary = stripHtml(tierData?.description);
    if (effectSummary && descriptionSummary) return `${effectSummary} - ${descriptionSummary}`;
    return effectSummary || descriptionSummary || fallback;
}

function stripHtml(value) {
    if (typeof value !== 'string') return '';
    return value
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/\s+/g, ' ')
        .trim();
}

/** Get all deviant abilities from DB as a sorted array. */
export function getDeviantAbilities(db) {
    return selectDeviantAbilityList(db);
}

/** Get deviant abilities filtered by element. */
export function getDeviantAbilitiesByElement(db, element) {
    return getDeviantAbilities(db).filter(a => a.element === element);
}

/** Get all pacts from DB as a sorted array. */
export function getPacts(db) {
    return selectPactList(db);
}

/** Resolve a pact by id. */
export function getPact(db, pactId) {
    return selectPact(db, pactId);
}

/** Resolve a deviant ability by id. */
export function getDeviantAbility(db, abilityId) {
    return selectDeviantAbility(db, abilityId);
}

/** Generate a simple id from a name string. */
export function generateId(name, suffix = '') {
    const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    return base + (suffix ? '_' + suffix : '') + '_' + Date.now();
}

export function buildDeviantAbilityClone(ability = {}, options = {}) {
    const createId = options.createId || ((name) => generateId(name));
    const baseName = ability.name || 'Deviant Ability';
    const cloneName = options.name || `${baseName} (Copy)`;
    return {
        ...ability,
        id: options.id || createId(`${baseName}-copy`),
        name: cloneName,
        awakening1: { ...(ability.awakening1 || {}) },
        awakening2: { ...(ability.awakening2 || {}) },
    };
}

/** Build actorEffect records for pact backlash conditions. */
export function buildBacklashEffectInputs({ effects, tier, pactId, actorId }) {
    return (effects || []).map(eff => {
        const conditionName = eff.conditionName || 'drained';
        return {
            label: conditionName,
            category: 'condition',
            value: eff.value ?? 1,
            source: {
                type: 'backlash',
                id: `${pactId || 'pact'}:${tier}:${conditionName}`,
                name: `${BACKLASH_LABELS[tier] || 'Backlash'}: ${conditionName}`,
                actorId,
            },
            metadata: {
                backlashTier: tier,
                pactId: pactId || null,
            },
        };
    });
}
