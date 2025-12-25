import shopIndexData from '../../data/shop_index.json';

const dict = shopIndexData?.dict || {};
const typeDict = Array.isArray(dict.t) ? dict.t : [''];
const categoryDict = Array.isArray(dict.c) ? dict.c : [''];
const groupDict = Array.isArray(dict.g) ? dict.g : [''];
const rarityDict = Array.isArray(dict.r) ? dict.r : ['common'];
const traitDict = Array.isArray(dict.tr) ? dict.tr : [''];
const damageTypeDict = Array.isArray(dict.dt) ? dict.dt : [''];

const rows = Array.isArray(shopIndexData?.items) ? shopIndexData.items : [];
const weaponsByIndex = shopIndexData?.w && typeof shopIndexData.w === 'object' ? shopIndexData.w : {};
const armorsByIndex = shopIndexData?.a && typeof shopIndexData.a === 'object' ? shopIndexData.a : {};

function decodeTraits(traitIdx) {
    if (!Array.isArray(traitIdx) || traitIdx.length === 0) return [];
    return traitIdx.map(i => traitDict[i]).filter(Boolean);
}

function decodeRow(row, index) {
    const name = row?.[0] || '';
    const img = row?.[1] || null;
    const sourceFile = row?.[2] || null;

    const type = typeDict[row?.[3]] || '';
    const category = categoryDict[row?.[4]] || null;
    const group = groupDict[row?.[5]] || null;
    const rarity = rarityDict[row?.[6]] || 'common';
    const traits = decodeTraits(row?.[7]);
    const price = typeof row?.[8] === 'number' ? row[8] : 0;
    const level = typeof row?.[9] === 'number' ? row[9] : 0;

    const item = {
        name,
        img,
        sourceFile,
        type,
        category,
        group,
        price,
        level,
        rarity,
        traits: { rarity, value: traits }
    };

    const weapon = weaponsByIndex[index];
    if (Array.isArray(weapon)) {
        const [dice, die, damageTypeIdx, range] = weapon;
        item.damage = { dice, die, damageType: damageTypeDict[damageTypeIdx] || '' };
        item.range = typeof range === 'number' && range > 0 ? range : null;
    }

    const armor = armorsByIndex[index];
    if (Array.isArray(armor)) {
        const [acBonus, dexCap, checkPenalty, speedPenalty, strength, hardness, hpMax] = armor;
        item.acBonus = acBonus ?? null;
        item.dexCap = dexCap ?? null;
        item.checkPenalty = checkPenalty ?? null;
        item.speedPenalty = speedPenalty ?? null;
        item.strength = strength ?? null;
        item.hardness = hardness ?? null;
        item.hpMax = hpMax ?? null;
    }

    return item;
}

export const SHOP_INDEX_ITEMS = rows.map((row, index) => decodeRow(row, index));
export const SHOP_INDEX_BY_NAME = new Map(SHOP_INDEX_ITEMS.map(item => [item.name, item]));

const SHOP_INDEX_BY_LOWER_NAME = new Map(SHOP_INDEX_ITEMS.map(item => [item.name.toLowerCase(), item]));

export const SHOP_INDEX_FILTER_OPTIONS = {
    types: typeDict.filter(Boolean),
    categories: categoryDict.filter(Boolean),
    groups: groupDict.filter(Boolean),
    rarities: rarityDict.filter(Boolean),
    traits: traitDict.filter(Boolean)
};

export function getShopIndexItemByName(name) {
    if (!name) return null;
    return SHOP_INDEX_BY_NAME.get(name) || SHOP_INDEX_BY_LOWER_NAME.get(String(name).toLowerCase()) || null;
}

function toGp(priceValue) {
    if (!priceValue) return 0;
    if (typeof priceValue === 'number') return priceValue;
    if (typeof priceValue !== 'object') return 0;
    let price = 0;
    if (priceValue.gp) price += priceValue.gp;
    if (priceValue.sp) price += priceValue.sp / 10;
    if (priceValue.cp) price += priceValue.cp / 100;
    if (priceValue.pp) price += priceValue.pp * 10;
    return parseFloat(price.toFixed(2));
}

function parseHands(usageValue) {
    if (!usageValue) return null;
    if (usageValue === 'held-in-one-hand') return '1';
    if (usageValue === 'held-in-two-hands') return '2';
    return usageValue;
}

export async function fetchShopItemDetailBySourceFile(sourceFile) {
    if (!sourceFile) return null;
    const baseUrl = import.meta.env.PROD ? '/ressources' : '/api/static';
    const res = await fetch(`${baseUrl}/equipment/${sourceFile}`);
    if (!res.ok) {
        throw new Error(`Failed to load item: ${sourceFile}`);
    }
    const data = await res.json();
    const sys = data.system || {};

    return {
        sourceFile,
        img: data.img ? data.img.replace('systems/pf2e/', '') : null,
        name: data.name,
        type: data.type ? (data.type.charAt(0).toUpperCase() + data.type.slice(1)) : 'Equipment',
        group: sys.group || null,
        category: sys.category || null,
        ammo: sys.ammo || null,
        hands: parseHands(sys.usage?.value),
        bulk: sys.bulk ? (sys.bulk.value ?? sys.bulk) : null,
        damage: sys.damage || null,
        splashDamage: sys.splashDamage || null,
        range: sys.range ? (sys.range.value ?? sys.range) : null,
        reload: sys.reload ? (sys.reload.value ?? sys.reload) : null,
        traits: sys.traits || null,
        bonus: sys.bonus ? (sys.bonus.value ?? sys.bonus) : null,
        bonusDamage: sys.bonusDamage || null,
        runes: sys.runes || null,
        price: toGp(sys.price?.value),
        level: sys.level ? sys.level.value : 0,
        description: sys.description ? sys.description.value : '',
        rarity: sys.traits ? sys.traits.rarity : 'common',

        acBonus: sys.acBonus ?? null,
        dexCap: sys.dexCap ?? null,
        checkPenalty: sys.checkPenalty ?? null,
        speedPenalty: sys.speedPenalty ?? null,
        strength: sys.strength ?? null,
        hardness: sys.hardness ?? null,
        hp: sys.hp ? (sys.hp.value ?? sys.hp) : null
    };
}
