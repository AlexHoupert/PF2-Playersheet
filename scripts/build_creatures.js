/**
 * Build Creatures - Generates creature catalog and index from JSON files
 * Run with: node scripts/build_creatures.js
 */
import fs from 'fs';
import path from 'path';

const SOURCE_DIR = './ressources/bestiary';
const OUTPUT_FILE = './src/data/creature_catalog.json';
const OUTPUT_INDEX_FILE = './src/data/creature_index.json';

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
    if (!fs.existsSync(dir)) return [];
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

            // Determine type (npc or hazard)
            const isHazard = data.type === 'hazard';

            const creature = {
                id: data._id || path.basename(file, '.json'),
                sourceFile: path.relative('./ressources', file).replace(/\\/g, '/'),
                img: data.img ? data.img.replace('systems/pf2e/', '') : null,
                name: data.name,
                type: isHazard ? 'hazard' : 'npc',
                level: sys.details?.level?.value ?? 0,
                rarity: sys.traits?.rarity || 'common',
                size: sys.traits?.size?.value || 'med',
                traits: sys.traits?.value || [],
                ac: sys.attributes?.ac?.value ?? 10,
                hp: sys.attributes?.hp?.max ?? 0,
                fortitude: sys.saves?.fortitude?.value ?? 0,
                reflex: sys.saves?.reflex?.value ?? 0,
                will: sys.saves?.will?.value ?? 0,
                perception: sys.perception?.mod ?? 0,
            };

            catalog.push({
                ...creature,
                data: data // Store full data for detail view
            });

            indexEntries.push({
                id: creature.id,
                name: creature.name,
                img: creature.img,
                sourceFile: creature.sourceFile,
                type: creature.type,
                level: creature.level,
                rarity: creature.rarity,
                size: creature.size,
                traits: creature.traits,
            });
        } catch (err) {
            console.error(`Error parsing ${file}:`, err);
        }
    });
}

const dir = path.dirname(OUTPUT_FILE);
if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
}

fs.writeFileSync(OUTPUT_FILE, JSON.stringify(catalog, null, 2));

// Build compact index
const typeDict = buildDictionary(indexEntries.map(e => e.type));
const rarityDict = buildDictionary(indexEntries.map(e => e.rarity));
const sizeDict = buildDictionary(indexEntries.map(e => e.size));
const traitDict = buildDictionary(indexEntries.flatMap(e => e.traits || []));

const items = [];

indexEntries.forEach((entry) => {
    const traitsIdx = (entry.traits || []).map(t => traitDict.map.get(t) ?? 0);

    items.push([
        entry.id,
        entry.name,
        entry.img || '',
        entry.sourceFile,
        typeDict.map.get(entry.type) ?? 0,
        entry.level,
        rarityDict.map.get(entry.rarity) ?? 0,
        sizeDict.map.get(entry.size) ?? 0,
        traitsIdx,
    ]);
});

const compactIndex = {
    v: 1,
    dict: {
        t: typeDict.list,      // type
        r: rarityDict.list,    // rarity
        s: sizeDict.list,      // size
        tr: traitDict.list,    // traits
    },
    items,
};

fs.writeFileSync(OUTPUT_INDEX_FILE, JSON.stringify(compactIndex));
console.log(`Generated creature catalog with ${catalog.length} items and index with ${items.length} entries.`);
