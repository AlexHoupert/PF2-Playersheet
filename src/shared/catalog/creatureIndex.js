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
    const [id, name, img, sourceFile, typeIdx, level, rarityIdx, sizeIdx, traitsIdx] = item;
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
        const response = await fetch(`/api/static/${indexItem.sourceFile}`);
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
