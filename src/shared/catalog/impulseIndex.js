
import impulseIndexData from '../../data/impulse_index.json';

const dict = impulseIndexData?.dict || {};
const typeDict = Array.isArray(dict.t) ? dict.t : [''];
const rarityDict = Array.isArray(dict.r) ? dict.r : ['common'];
const traditionDict = Array.isArray(dict.trd) ? dict.trd : [''];
const traitDict = Array.isArray(dict.tr) ? dict.tr : [''];
const schoolDict = Array.isArray(dict.s) ? dict.s : [''];
const timeDict = Array.isArray(dict.tm) ? dict.tm : [''];
const rangeDict = Array.isArray(dict.rn) ? dict.rn : [''];
const defenseDict = Array.isArray(dict.df) ? dict.df : [''];

const rows = Array.isArray(impulseIndexData?.items) ? impulseIndexData.items : [];

function decodeTraits(traitIdx) {
    if (!Array.isArray(traitIdx) || traitIdx.length === 0) return [];
    return traitIdx.map(i => traitDict[i]).filter(Boolean);
}

function decodeTraditions(traditionIdx) {
    if (!Array.isArray(traditionIdx) || traditionIdx.length === 0) return [];
    return traditionIdx.map(i => traditionDict[i]).filter(Boolean);
}

function decodeRow(row) {
    const name = row?.[0] || '';
    const img = row?.[1] || null;
    const sourceFile = row?.[2] || null;

    const type = typeDict[row?.[3]] || 'Impulse';
    const rarity = rarityDict[row?.[4]] || 'common';
    const traditions = decodeTraditions(row?.[5]);
    const traits = decodeTraits(row?.[6]);
    const level = typeof row?.[7] === 'number' ? row[7] : 0;
    const school = schoolDict[row?.[8]] || null;
    const time = timeDict[row?.[9]] || null;
    const range = rangeDict[row?.[10]] || null;
    const defense = defenseDict[row?.[11]] || null;

    return {
        name,
        img,
        sourceFile,
        type,
        rarity,
        traditions,
        traits,
        level,
        school,
        time,
        range,
        defense,
    };
}

export const IMPULSE_INDEX_ITEMS = rows.map((row) => decodeRow(row));
export const IMPULSE_INDEX_BY_NAME = new Map(IMPULSE_INDEX_ITEMS.map(item => [item.name, item]));

const IMPULSE_INDEX_BY_LOWER_NAME = new Map(IMPULSE_INDEX_ITEMS.map(item => [item.name.toLowerCase(), item]));

export const IMPULSE_INDEX_FILTER_OPTIONS = {
    types: typeDict.filter(Boolean),
    rarities: rarityDict.filter(Boolean),
    traditions: traditionDict.filter(Boolean),
    traits: traitDict.filter(Boolean),
    schools: schoolDict.filter(Boolean),
};

export function getImpulseIndexItemByName(name) {
    if (!name) return null;
    return IMPULSE_INDEX_BY_NAME.get(name) || IMPULSE_INDEX_BY_LOWER_NAME.get(String(name).toLowerCase()) || null;
}

export async function fetchImpulseDetailBySourceFile(sourceFile) {
    if (!sourceFile) return null;
    const baseUrl = import.meta.env.PROD ? '/ressources' : '/api/static';
    // sourceFile is like "spells/impulses/foo.json", and base url is /ressources.
    // The build script stored "spells/impulses/foo.json" relative to ./ressources.
    const response = await fetch(`${baseUrl}/${sourceFile}`);
    if (!response.ok) {
        throw new Error(`Failed to load impulse: ${sourceFile}`);
    }
    const data = await response.json();
    const sys = data.system || {};
    const isAttack = (sys.traits?.value || []).includes('attack');

    return {
        sourceFile,
        img: data.img ? data.img.replace('systems/pf2e/', '') : null,
        name: data.name,
        type: data.type ? (data.type.charAt(0).toUpperCase() + data.type.slice(1)) : "Impulse",
        level: sys.level ? sys.level.value : 0,
        description: sys.description ? sys.description.value : "",
        rarity: sys.traits ? sys.traits.rarity : "common",
        traditions: sys.traits ? sys.traits.traditions : [],
        traits: sys.traits ? sys.traits.value : [],
        school: sys.school ? sys.school.value : null,
        range: sys.range ? sys.range.value : null,
        time: sys.time ? sys.time.value : null,
        area: sys.area || null,
        defense: sys.defense?.save?.statistic || (isAttack ? 'ac' : null),
    };
}
