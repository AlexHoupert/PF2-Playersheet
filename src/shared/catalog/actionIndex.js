import actionIndexData from '../../data/action_index.json';

const ACTION_ITEM_MAP = {};

// Helper to decode a row from the concise array format
function decodeRow(row) {
    if (!row) return null;
    // Schema: [name, img, sourceFile, typeCode, userType, userSubtype, skill, traitIndices, feat]
    const [name, img, sourceFile, typeCode, userType, userSubtype, skill, traitIndices, feat] = row;

    return {
        name,
        img: img ? `systems/pf2e/${img}` : null,
        sourceFile,
        typeCode,
        category: (userType === 'Other' || !userType) ? 'Other' : userType,
        userType,
        userSubtype,
        skill,
        feat, // Add feat
        traits: (traitIndices || []).map(i => actionIndexData.dict.t[i]),
    };
}

// Initialize the map for O(1) lookups by name
actionIndexData.items.forEach(row => {
    const item = decodeRow(row);
    if (item) {
        ACTION_ITEM_MAP[item.name] = item;
    }
});

export function getActionIndexItemByName(name) {
    return ACTION_ITEM_MAP[name] || null;
}

export function getAllActionIndexItems() {
    return Object.values(ACTION_ITEM_MAP);
}

export async function fetchActionDetailBySourceFile(sourceFile) {
    if (!sourceFile) return null;
    const res = await fetch(`/api/static/${sourceFile}`);
    if (!res.ok) {
        throw new Error(`Failed to load action: ${sourceFile}`);
    }
    const data = await res.json();
    const sys = data.system || {};

    const cls = sys.classification || {};

    return {
        sourceFile,
        img: data.img ? data.img.replace('systems/pf2e/', '') : null,
        name: data.name,
        actionType: sys.actionType?.value || 'passive',
        actionCost: sys.actions?.value || null,
        // Use user defined classification if available, else fallback
        type: cls.type || 'Other',
        subtype: cls.subtype || 'General',
        skill: cls.skill || null,
        category: sys.category || 'interaction',
        description: sys.description ? sys.description.value : "",
        rarity: sys.traits ? sys.traits.rarity : "common",
        traits: sys.traits ? sys.traits.value : [],
        rules: sys.rules || []
    };
}

export const ACTION_INDEX_FILTER_OPTIONS = {
    types: ['Combat', 'Movement', 'Skills', 'Other'],
    subtypes: ['Attack', 'Defense', 'Social', 'Assist', 'Ground', 'Jumping & Falling', 'Maneuver', 'Cloak & Dagger', 'Other', 'Downtime'],
    traits: actionIndexData.dict.t
};
