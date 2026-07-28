/**
 * Creature Index - Provides access to creature/hazard data
 * 
 * Architecture:
 * - INDEX (creature_index.json, ~840KB) - lightweight, used for listing/filtering
 * - CATALOG (creature_catalog.json, ~176MB) - full data, loaded on-demand via fetch
 * 
 * Run build_creatures.js to generate these files
 */

// Import only the lightweight INDEX (not the full catalog)
import CREATURE_INDEX from '../../data/creature_index.json';

// Decode index item to lightweight object for listing
function decodeIndexItem(item) {
    const [
        id, name, img, sourceFile, typeIdx, level, rarityIdx, sizeIdx, traitsIdx,
        ac = 10, hp = 0, fortitude = 0, reflex = 0, will = 0, perception = 0, speed = 0,
        resistanceValues = [], weaknessValues = [], immunityValues = [], skillValues = [], flags = 0,
        spellModeValues = [],
    ] = item;
    const decodeTypedValues = values => (values || []).map(([valueIdx, value]) => ({
        type: CREATURE_INDEX.dict.dt?.[valueIdx] || '',
        value,
    })).filter(entry => entry.type);
    const skills = (skillValues || []).map(([skillIdx, bonus]) => {
        const key = CREATURE_INDEX.dict.sk?.[skillIdx] || '';
        return {
            key,
            label: key.replace(/[-_]+/g, ' ').replace(/\b\w/g, character => character.toUpperCase()),
            bonus,
        };
    }).filter(skill => skill.key);
    return {
        id,
        name,
        img,
        sourceFile,
        type: CREATURE_INDEX.dict.t?.[typeIdx] || 'npc',
        level,
        rarity: CREATURE_INDEX.dict.r?.[rarityIdx] || 'common',
        size: CREATURE_INDEX.dict.s?.[sizeIdx] || 'med',
        traits: (traitsIdx || []).map(i => CREATURE_INDEX.dict.tr?.[i] || '').filter(Boolean),
        ac,
        hp,
        fortitude,
        reflex,
        will,
        perception,
        speed,
        resistances: decodeTypedValues(resistanceValues),
        weaknesses: decodeTypedValues(weaknessValues),
        immunities: (immunityValues || []).map(valueIdx => ({ type: CREATURE_INDEX.dict.dt?.[valueIdx] || '' })).filter(entry => entry.type),
        skills,
        highestSkillBonus: skills.length ? Math.max(...skills.map(skill => skill.bonus)) : null,
        hasMelee: Boolean(flags & 1),
        hasRanged: Boolean(flags & 2),
        hasMagic: Boolean(flags & 4),
        hasShield: Boolean(flags & 8),
        spellcastingModes: (spellModeValues || []).map(modeIdx => CREATURE_INDEX.dict.sm?.[modeIdx] || '').filter(Boolean),
    };
}

// Export decoded items (lightweight, for listing)
export const CREATURE_INDEX_ITEMS = CREATURE_INDEX.items.map(decodeIndexItem);

// Export filter options
export const CREATURE_INDEX_FILTER_OPTIONS = {
    types: CREATURE_INDEX.dict.t?.filter(Boolean) || ['npc', 'hazard'],
    rarities: CREATURE_INDEX.dict.r?.filter(Boolean) || ['common', 'uncommon', 'rare', 'unique'],
    sizes: CREATURE_INDEX.dict.s?.filter(Boolean) || [],
    traits: CREATURE_INDEX.dict.tr?.filter(Boolean) || [],
};

// Cache for fetched creature data
const creatureCache = new Map();

// Get all creatures (lightweight index data only - use for listing)
export function getAllCreatures() {
    return CREATURE_INDEX_ITEMS;
}

// Get creature from index by ID (lightweight, no full data)
export function getCreatureFromIndex(id) {
    return CREATURE_INDEX_ITEMS.find(c => c.id === id);
}

// Fetch full creature data on demand
export async function fetchCreatureData(id) {
    // Check cache first
    if (creatureCache.has(id)) {
        return creatureCache.get(id);
    }

    // Find the creature in index to get source file
    const indexItem = getCreatureFromIndex(id);
    if (!indexItem?.sourceFile) {
        console.warn('Creature not found in index:', id);
        return null;
    }

    try {
        // Fetch from resources - sourceFile already includes 'bestiary/' prefix
        const baseUrl = import.meta.env.PROD ? '/ressources' : '/api/static';
        const response = await fetch(`${baseUrl}/${indexItem.sourceFile}`);
        if (response.ok) {
            const data = await response.json();
            creatureCache.set(id, data);
            return data;
        }
    } catch (e) {
        console.error('Failed to fetch creature:', id, e);
    }
    return null;
}

// Get creature by ID - returns index info plus fetches full data lazily
export function getCreatureById(id) {
    const indexItem = getCreatureFromIndex(id);
    if (!indexItem) return null;

    // Return a merged object with index data
    // Full creature data must be fetched separately with fetchCreatureData()
    return {
        ...indexItem,
        data: null // Full data not included - use fetchCreatureData(id) 
    };
}
