import fs from 'fs';
import path from 'path';

// Updated path to your resources folder
const SOURCE_DIR = './ressources/equipment';
const OUTPUT_FILE = './src/data/shop_catalog.json';
const OUTPUT_INDEX_FILE = './src/data/shop_index.json';

const catalog = [];
const indexEntries = [];

const buildDictionary = (values) => {
    const unique = new Set(values.map(v => (v == null ? '' : String(v))));
    unique.delete('');
    const list = [''].concat(Array.from(unique).sort((a, b) => a.localeCompare(b)));
    const map = new Map(list.map((value, i) => [value, i]));
    return { list, map };
};


function getFilesRecursively(dir) {
    let files = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            files = files.concat(getFilesRecursively(fullPath));
        } else {
            files.push(fullPath);
        }
    }
    return files;
}

if (fs.existsSync(SOURCE_DIR)) {
    const files = getFilesRecursively(SOURCE_DIR);
    files.sort((a, b) => a.localeCompare(b));

    files.forEach(file => {
        if (!file.endsWith('.json')) return;

        try {
            const raw = fs.readFileSync(file, 'utf8');
            const data = JSON.parse(raw);
            const sys = data.system || {};

            // Calculate Price (convert all to GP)
            let price = 0;
            if (sys.price && sys.price.value) {
                const p = sys.price.value;
                if (typeof p === 'object') {
                    if (p.gp) price += p.gp;
                    if (p.sp) price += p.sp / 10;
                    if (p.cp) price += p.cp / 100;
                    if (p.pp) price += p.pp * 10;
                }
            }
            price = parseFloat(price.toFixed(2));

            // Parse Hands from usage
            let hands = null;
            if (sys.usage && sys.usage.value) {
                if (sys.usage.value === 'held-in-one-hand') hands = "1";
                else if (sys.usage.value === 'held-in-two-hands') hands = "2";
                else hands = sys.usage.value;
            }

            // Rune Detection Logic
            let itemType = data.type ? (data.type.charAt(0).toUpperCase() + data.type.slice(1)) : "Equipment";
            let itemCategory = sys.category || null;

            const isRuneFolder = file.includes('runes');
            if (isRuneFolder) {
                itemType = "Rune";

                const usage = sys.usage?.value;
                if (usage === 'etched-onto-armor') {
                    itemCategory = 'rune_armor';
                } else if (usage === 'etched-onto-weapon' || usage === 'etched-onto-melee-weapon') {
                    itemCategory = 'rune_weapon';
                } else if (usage === 'etched-onto-shield') {
                    itemCategory = 'rune_shield';
                } else {
                    // Fallback to folder name
                    if (file.includes('armor_runes')) itemCategory = 'rune_armor';
                    else if (file.includes('weapon_runes')) itemCategory = 'rune_weapon';
                    else if (file.includes('shield_runes')) itemCategory = 'rune_shield';
                }
            }

            const item = {
                sourceFile: path.relative(SOURCE_DIR, file).replace(/\\/g, '/'),
                // Remove 'systems/pf2e/' from the image path to match local folder structure
                img: data.img ? data.img.replace('systems/pf2e/', '') : null,
                name: data.name,
                type: itemType,
                group: sys.group || null,
                category: itemCategory,
                ammo: sys.ammo || null,
                hands: hands,
                bulk: sys.bulk || null,
                damage: sys.damage || null,
                splashDamage: sys.splashDamage || null,
                range: sys.range || null,
                reload: sys.reload || null,
                traits: sys.traits || null,
                bonus: sys.bonus || null,
                bonusDamage: sys.bonusDamage || null,
                runes: sys.runes || null,
                // Armor/Shield stats (used for AC calculations and shield UI)
                acBonus: sys.acBonus ?? null,
                dexCap: sys.dexCap ?? null,
                checkPenalty: sys.checkPenalty ?? null,
                speedPenalty: sys.speedPenalty ?? null,
                strength: sys.strength ?? null,
                hardness: sys.hardness ?? null,
                hp: sys.hp ?? null,
                price: price,
                level: sys.level ? sys.level.value : 0,
                description: sys.description ? sys.description.value : "",
                rarity: sys.traits ? sys.traits.rarity : "common"
            };

            catalog.push(item);

            indexEntries.push({
                name: data.name || "",
                img: data.img ? data.img.replace('systems/pf2e/', '') : "",
                sourceFile: path.relative(SOURCE_DIR, file).replace(/\\/g, '/'),
                type: item.type || "",
                group: sys.group || "",
                category: sys.category || "",
                rarity: sys.traits ? sys.traits.rarity : "common",
                traits: Array.isArray(sys?.traits?.value) ? sys.traits.value : [],
                price,
                level: sys.level ? sys.level.value : 0,
                damage: sys.damage || null,
                splashDamage: sys.splashDamage || null,
                range: typeof sys.range === 'number' ? sys.range : null,
                armor: {
                    acBonus: sys.acBonus ?? null,
                    dexCap: sys.dexCap ?? null,
                    checkPenalty: sys.checkPenalty ?? null,
                    speedPenalty: sys.speedPenalty ?? null,
                    strength: sys.strength ?? null,
                    hardness: typeof sys.hardness === 'number' && sys.hardness > 0 ? sys.hardness : null,
                    hpMax: typeof sys.hp?.max === 'number' && sys.hp.max > 0 ? sys.hp.max : null
                }
            });
        } catch (err) {
            console.error(`Error parsing ${file}:`, err);
        }
    });
}

// --- INJECT GENERIC SCROLLS AND WANDS ---
const scrollPrices = [4, 12, 30, 70, 150, 300, 600, 1300, 3000, 8000];
const wandPrices = [60, 160, 360, 700, 1500, 3000, 6500, 15000, 40000];

// Scrolls
scrollPrices.forEach((price, i) => {
    const rank = i + 1;
    const name = `Scroll of Rank ${rank}`;
    const item = {
        sourceFile: `virtual/scroll_rank_${rank}`,
        img: 'icons/sundries/scrolls/scroll-runed-blue.webp', // Generic icon
        name: name,
        type: 'Consumable',
        category: 'Scroll',
        group: 'Scroll',
        price: price,
        level: rank, // Item level is usually typically Rank * 2 - 1 for scrolls? Or just Rank? PF2e Items usually have level. Let's use Rank for simplicity or lookup. Rank 1 scroll is Item Level 1. Rank 2 is 3. Rank 3 is 5. Formula: Rank*2 - 1.
        // Wait, PF2e Item Level for scrolls: Level 1 spell = Item 1. Level 2 spell = Item 3. Level 3 = 5.
        // Let's use implicit level: Rank * 2 - 1. But for Rank 1 it's 1. Rank 2 (3rd level chars) access level 3 items. Yes.
        level: Math.max(1, rank * 2 - 1),
        rarity: 'common',
        traits: ['magical', 'scroll', 'consumable'],
        description: `A scroll containing a level ${rank} spell.`
    };
    catalog.push(item);
    indexEntries.push({
        name: item.name,
        img: item.img,
        sourceFile: item.sourceFile,
        type: item.type,
        group: item.group,
        category: item.category,
        rarity: item.rarity,
        traits: item.traits,
        price: item.price,
        level: item.level,
        damage: null, splashDamage: null, range: null, armor: {}
    });
});

// Wands
wandPrices.forEach((price, i) => {
    const rank = i + 1;
    const name = `Wand of Rank ${rank}`;
    // Item Level for Wands: Rank 1 = Level 3. Rank 2 = Level 5. Rank 3 = 7. Formula: Rank * 2 + 1.
    const itemLevel = rank * 2 + 1;

    const item = {
        sourceFile: `virtual/wand_rank_${rank}`,
        img: 'icons/weapons/staves/staff-simple.webp', // Generic icon, verify existence or use fallback
        name: name,
        type: 'Equipment', // Wands are held items
        category: 'Wand',
        group: 'Wand',
        price: price,
        level: itemLevel,
        rarity: 'common',
        traits: ['magical', 'wand', 'necromancy'], // Traits?
        description: `A wand containing a level ${rank} spell.`
    };
    catalog.push(item);
    indexEntries.push({
        name: item.name,
        img: item.img,
        sourceFile: item.sourceFile,
        type: item.type,
        group: item.group,
        category: item.category,
        rarity: item.rarity,
        traits: item.traits,
        price: item.price,
        level: item.level,
        damage: null, splashDamage: null, range: null, armor: {}
    });
});


// Ensure directory exists
const dir = path.dirname(OUTPUT_FILE);
if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
}

fs.writeFileSync(OUTPUT_FILE, JSON.stringify(catalog, null, 2));

const typeDict = buildDictionary(indexEntries.map(e => e.type));
const categoryDict = buildDictionary(indexEntries.map(e => e.category));
const groupDict = buildDictionary(indexEntries.map(e => e.group));
const rarityDict = buildDictionary(indexEntries.map(e => e.rarity));
const traitDict = buildDictionary(indexEntries.flatMap(e => e.traits || []));

// Collect all damage types (primary and persistent)
const allDamageTypes = new Set();
indexEntries.forEach(e => {
    if (e.damage?.damageType) allDamageTypes.add(e.damage.damageType);
    if (e.damage?.persistent?.type) allDamageTypes.add(e.damage.persistent.type);
});
const damageTypeDict = buildDictionary(Array.from(allDamageTypes));


const items = [];
const weapons = {};
const armors = {};

indexEntries.forEach((entry, index) => {
    const traitsIdx = (entry.traits || []).map(t => traitDict.map.get(t) ?? 0);

    items.push([
        entry.name,
        entry.img,
        entry.sourceFile,
        typeDict.map.get(entry.type) ?? 0,
        categoryDict.map.get(entry.category) ?? 0,
        groupDict.map.get(entry.group) ?? 0,
        rarityDict.map.get(entry.rarity) ?? 0,
        traitsIdx,
        entry.price,
        entry.level
    ]);

    if (entry.damage && typeof entry.damage === 'object') {
        const dice = entry.damage.dice ?? null;
        const die = entry.damage.die ?? null;
        const damageType = entry.damage.damageType ?? "";

        // Splash
        const splash = entry.splashDamage?.value ?? 0;

        // Persistent
        const persist = entry.damage.persistent || {};
        const pDice = persist.number ?? 0;
        const pDie = persist.faces ? `d${persist.faces}` : null;
        const pType = persist.type ?? "";

        weapons[index] = [
            dice,
            die,
            damageTypeDict.map.get(damageType) ?? 0,
            entry.range ?? 0,
            splash,
            pDice,
            pDie,
            damageTypeDict.map.get(pType) ?? 0
        ];
    }

    const armor = entry.armor || {};
    if (
        armor.acBonus !== null ||
        armor.dexCap !== null ||
        armor.checkPenalty !== null ||
        armor.speedPenalty !== null ||
        armor.strength !== null ||
        armor.hardness !== null ||
        armor.hpMax !== null
    ) {
        armors[index] = [
            armor.acBonus,
            armor.dexCap,
            armor.checkPenalty,
            armor.speedPenalty,
            armor.strength,
            armor.hardness,
            armor.hpMax
        ];
    }
});

const compactIndex = {
    v: 1,
    dict: {
        t: typeDict.list,
        c: categoryDict.list,
        g: groupDict.list,
        r: rarityDict.list,
        tr: traitDict.list,
        dt: damageTypeDict.list
    },
    items,
    w: weapons,
    a: armors
};

fs.writeFileSync(OUTPUT_INDEX_FILE, JSON.stringify(compactIndex));
console.log(`Generated catalog with ${catalog.length} items and index with ${items.length} entries.`);
