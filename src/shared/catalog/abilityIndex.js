import abilityIndexData from '../../data/ability_index.json';

const traitDict    = abilityIndexData.dict?.t || [''];
const categoryDict = abilityIndexData.dict?.c || [''];
const rows = Array.isArray(abilityIndexData.items) ? abilityIndexData.items : [];

function decodeRow(row) {
    const [name, typeCode, categoryIdx, traitIdxs, description] = row;
    return {
        name,
        typeCode,
        category: categoryDict[categoryIdx] || '',
        traits: (traitIdxs || []).map(i => traitDict[i]).filter(Boolean),
        description: description || '',
    };
}

const ABILITY_ITEMS = rows.map(decodeRow);
const ABILITY_BY_NAME = new Map(ABILITY_ITEMS.map(a => [a.name, a]));

export function getAllAbilities() {
    return ABILITY_ITEMS;
}

export function getAbilityByName(name) {
    return ABILITY_BY_NAME.get(name) || null;
}

export const ABILITY_INDEX_FILTER_OPTIONS = {
    traits: traitDict.filter(Boolean).sort(),
    categories: categoryDict.filter(Boolean).sort(),
};
