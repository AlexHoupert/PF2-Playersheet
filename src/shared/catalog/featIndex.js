
import featIndexData from '../../data/feat_index.json';

const dict = featIndexData?.dict || {};
const typeDict = Array.isArray(dict.t) ? dict.t : [''];
const rarityDict = Array.isArray(dict.r) ? dict.r : ['common'];
const traitDict = Array.isArray(dict.tr) ? dict.tr : [''];
const categoryDict = Array.isArray(dict.c) ? dict.c : [''];

const rows = Array.isArray(featIndexData?.items) ? featIndexData.items : [];

function decodeTraits(traitIdx) {
    if (!Array.isArray(traitIdx) || traitIdx.length === 0) return [];
    return traitIdx.map(i => traitDict[i]).filter(Boolean);
}

function decodeRow(row) {
    const name = row?.[0] || '';
    const img = row?.[1] || null;
    const sourceFile = row?.[2] || null;

    const type = typeDict[row?.[3]] || '';
    const rarity = rarityDict[row?.[4]] || 'common';
    const traits = decodeTraits(row?.[5]);
    const level = typeof row?.[6] === 'number' ? row[6] : 0;
    const category = categoryDict[row?.[7]] || null;

    return {
        name,
        img,
        sourceFile,
        type,
        rarity,
        traits,
        level,
        category,
    };
}

export const FEAT_INDEX_ITEMS = rows.map((row) => decodeRow(row));
export const FEAT_INDEX_BY_NAME = new Map(FEAT_INDEX_ITEMS.map(item => [item.name, item]));

const FEAT_INDEX_BY_LOWER_NAME = new Map(FEAT_INDEX_ITEMS.map(item => [item.name.toLowerCase(), item]));

export const FEAT_INDEX_FILTER_OPTIONS = {
    types: typeDict.filter(Boolean),
    rarities: rarityDict.filter(Boolean),
    traits: traitDict.filter(Boolean),
    categories: categoryDict.filter(Boolean),
};

export function getFeatIndexItemByName(name) {
    if (!name) return null;
    return FEAT_INDEX_BY_NAME.get(name) || FEAT_INDEX_BY_LOWER_NAME.get(String(name).toLowerCase()) || null;
}

export async function fetchFeatDetailBySourceFile(sourceFile) {
    if (!sourceFile) return null;
    const baseUrl = import.meta.env.PROD ? '/ressources' : '/api/static';
    const res = await fetch(`${baseUrl}/classfeatures/${sourceFile}`);
    if (!res.ok) {
        throw new Error(`Failed to load feat: ${sourceFile}`);
    }
    const data = await res.json();
    const sys = data.system || {};

    return {
        sourceFile,
        img: data.img ? data.img.replace('systems/pf2e/', '') : null,
        name: data.name,
        type: data.type ? (data.type.charAt(0).toUpperCase() + data.type.slice(1)) : "Feat",
        level: sys.level ? sys.level.value : 0,
        description: sys.description ? sys.description.value : "",
        rarity: sys.traits ? sys.traits.rarity : "common",
        traits: sys.traits ? sys.traits.value : [],
        category: sys.category || null,
        prerequisites: sys.prerequisites ? sys.prerequisites.value : [],
        actionType: sys.actionType ? sys.actionType.value : null,
        actions: sys.actions ? sys.actions.value : null,
    };
}
