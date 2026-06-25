import fs from 'fs';
import path from 'path';
import { buildDictionary, getFilesRecursively, writeJsonOutput } from './buildUtils.js';

const SOURCE_DIR = './ressources/feats';
const OUTPUT_FILE = './src/data/feat_catalog.json';
const OUTPUT_INDEX_FILE = './src/data/feat_index.json';

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
            
            const feat = {
                sourceFile: path.relative('./ressources', file).replace(/\\/g, '/'),
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
            
            catalog.push(feat);

            indexEntries.push({
                name: data.name || "",
                img: data.img ? data.img.replace('systems/pf2e/', '') : "",
                sourceFile: path.relative('./ressources', file).replace(/\\/g, '/'),
                type: feat.type || "",
                rarity: feat.rarity,
                traits: feat.traits,
                level: feat.level,
                category: feat.category,
            });
        } catch (err) {
            console.error(`Error parsing ${file}:`, err);
        }
    });
}

writeJsonOutput(OUTPUT_FILE, catalog, true);

const typeDict = buildDictionary(indexEntries.map(e => e.type));
const rarityDict = buildDictionary(indexEntries.map(e => e.rarity));
const traitDict = buildDictionary(indexEntries.flatMap(e => e.traits || []));
const categoryDict = buildDictionary(indexEntries.map(e => e.category));

const items = [];

indexEntries.forEach((entry) => {
    const traitsIdx = (entry.traits || []).map(t => traitDict.map.get(t) ?? 0);

    items.push([
        entry.name,
        entry.img,
        entry.sourceFile,
        typeDict.map.get(entry.type) ?? 0,
        rarityDict.map.get(entry.rarity) ?? 0,
        traitsIdx,
        entry.level,
        categoryDict.map.get(entry.category) ?? 0,
    ]);
});

const compactIndex = {
    v: 1,
    dict: {
        t: typeDict.list,
        r: rarityDict.list,
        tr: traitDict.list,
        c: categoryDict.list,
    },
    items,
};

writeJsonOutput(OUTPUT_INDEX_FILE, compactIndex);
console.log(`Generated feat catalog with ${catalog.length} items and index with ${items.length} entries.`);
