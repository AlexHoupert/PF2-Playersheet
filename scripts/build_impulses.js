import fs from 'fs';
import path from 'path';
import { buildDictionary, getFilesRecursively, writeJsonOutput } from './buildUtils.js';

const SOURCE_DIR = './ressources/spells/impulses';
const OUTPUT_FILE = './src/data/impulse_catalog.json';
const OUTPUT_INDEX_FILE = './src/data/impulse_index.json';

const catalog = [];
const indexEntries = [];

if (fs.existsSync(SOURCE_DIR)) {
    const files = getFilesRecursively(SOURCE_DIR);
    files.sort((a, b) => a.localeCompare(b));

    files.forEach(file => {
        if (!file.endsWith('.json')) return;

        try {
            const raw = fs.readFileSync(file, 'utf8');
            const data = JSON.parse(raw);
            const sys = data.system || {};

            const isAttack = (sys.traits?.value || []).includes('attack');

            const impulse = {
                sourceFile: path.relative('./ressources', file).replace(/\\/g, '/'),
                img: data.img ? data.img.replace('systems/pf2e/', '') : null,
                name: data.name,
                type: "Impulse", // Force type to Impulse usually, or use data.type if reliable
                level: sys.level ? sys.level.value : 0,
                description: sys.description ? sys.description.value : "",
                rarity: sys.traits ? sys.traits.rarity : "common",
                traditions: sys.traits ? sys.traits.traditions : [],
                traits: sys.traits ? sys.traits.value : [],
                school: sys.school ? sys.school.value : null,
                range: sys.range ? sys.range.value : null,
                time: (sys.time && sys.time.value) ? sys.time.value : (sys.actions && sys.actions.value != null ? String(sys.actions.value) : null),
                actions: sys.actions?.value, // Explicitly save actions count
                defense: sys.defense?.save?.statistic || (isAttack ? 'ac' : null),
                area: sys.area || null,
            };

            catalog.push(impulse);

            indexEntries.push({
                name: data.name || "",
                img: data.img ? data.img.replace('systems/pf2e/', '') : "",
                sourceFile: impulse.sourceFile, // Use the relative path calculated above
                type: "Impulse",
                rarity: impulse.rarity,
                traditions: impulse.traditions,
                traits: impulse.traits,
                level: impulse.level,
                school: impulse.school,
                time: impulse.time,
                range: impulse.range,
                defense: impulse.defense,
            });
        } catch (err) {
            console.error(`Error parsing ${file}:`, err);
        }
    });
}

writeJsonOutput(OUTPUT_FILE, catalog, true);

const typeDict = buildDictionary(indexEntries.map(e => e.type));
const rarityDict = buildDictionary(indexEntries.map(e => e.rarity));
const traditionDict = buildDictionary(indexEntries.flatMap(e => e.traditions || []));
const traitDict = buildDictionary(indexEntries.flatMap(e => e.traits || []));
const schoolDict = buildDictionary(indexEntries.map(e => e.school));
const timeDict = buildDictionary(indexEntries.map(e => e.time));
const rangeDict = buildDictionary(indexEntries.map(e => e.range));
const defenseDict = buildDictionary(indexEntries.map(e => e.defense));

const items = [];

indexEntries.forEach((entry) => {
    const traditionsIdx = (entry.traditions || []).map(t => traditionDict.map.get(t) ?? 0);
    const traitsIdx = (entry.traits || []).map(t => traitDict.map.get(t) ?? 0);

    items.push([
        entry.name,
        entry.img,
        entry.sourceFile,
        typeDict.map.get(entry.type) ?? 0, // Type index
        rarityDict.map.get(entry.rarity) ?? 0,
        traditionsIdx,
        traitsIdx,
        entry.level,
        schoolDict.map.get(entry.school) ?? 0,
        timeDict.map.get(entry.time) ?? 0,
        rangeDict.map.get(entry.range) ?? 0,
        defenseDict.map.get(entry.defense) ?? 0,
    ]);
});

const compactIndex = {
    v: 1,
    dict: {
        t: typeDict.list,
        r: rarityDict.list,
        trd: traditionDict.list,
        tr: traitDict.list,
        s: schoolDict.list,
        tm: timeDict.list,
        rn: rangeDict.list,
        df: defenseDict.list,
    },
    items,
};

writeJsonOutput(OUTPUT_INDEX_FILE, compactIndex);
console.log(`Generated impulse catalog with ${catalog.length} items and index with ${items.length} entries.`);
