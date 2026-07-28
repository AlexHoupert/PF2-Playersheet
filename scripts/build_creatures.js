import fs from 'fs';
import path from 'path';
import { buildDictionary, getFilesRecursively, writeJsonOutput } from './buildUtils.js';
import { buildCreatureTableSummary } from '../src/shared/bestiary/creatureTableSummary.js';

const SOURCE_DIR = './ressources/bestiary';
const OUTPUT_FILE = './src/data/creature_catalog.json';
const OUTPUT_INDEX_FILE = './src/data/creature_index.json';

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

            // Determine type (npc or hazard)
            const isHazard = data.type === 'hazard';

            const summary = buildCreatureTableSummary(data);
            const creature = {
                id: data._id || path.basename(file, '.json'),
                sourceFile: path.relative('./ressources', file).replace(/\\/g, '/'),
                img: data.img ? data.img.replace('systems/pf2e/', '') : null,
                name: data.name,
                type: isHazard ? 'hazard' : 'npc',
                level: sys.details?.level?.value ?? 0,
                rarity: sys.traits?.rarity || 'common',
                size: summary.size,
                traits: sys.traits?.value || [],
                ...summary,
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
                ...summary,
            });
        } catch (err) {
            console.error(`Error parsing ${file}:`, err);
        }
    });
}

writeJsonOutput(OUTPUT_FILE, catalog, true);

// Build compact index
const typeDict = buildDictionary(indexEntries.map(e => e.type));
const rarityDict = buildDictionary(indexEntries.map(e => e.rarity));
const sizeDict = buildDictionary(indexEntries.map(e => e.size));
const traitDict = buildDictionary(indexEntries.flatMap(e => e.traits || []));
const defenseTypeDict = buildDictionary(indexEntries.flatMap(entry => [
    ...(entry.resistances || []).map(value => value.type),
    ...(entry.weaknesses || []).map(value => value.type),
    ...(entry.immunities || []).map(value => value.type),
]));
const skillDict = buildDictionary(indexEntries.flatMap(entry => (entry.skills || []).map(skill => skill.key)));
const spellModeDict = buildDictionary(indexEntries.flatMap(entry => entry.spellcastingModes || []));

const items = [];

indexEntries.forEach((entry) => {
    const traitsIdx = (entry.traits || []).map(t => traitDict.map.get(t) ?? 0);
    const typedValues = values => (values || []).map(value => [
        defenseTypeDict.map.get(value.type) ?? 0,
        value.value ?? 0,
    ]);
    const immunities = (entry.immunities || []).map(value => defenseTypeDict.map.get(value.type) ?? 0);
    const skills = (entry.skills || []).map(skill => [skillDict.map.get(skill.key) ?? 0, skill.bonus]);
    const flags = (entry.hasMelee ? 1 : 0)
        | (entry.hasRanged ? 2 : 0)
        | (entry.hasMagic ? 4 : 0)
        | (entry.hasShield ? 8 : 0);
    const spellModes = (entry.spellcastingModes || []).map(mode => spellModeDict.map.get(mode) ?? 0);

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
        entry.ac,
        entry.hp,
        entry.fortitude,
        entry.reflex,
        entry.will,
        entry.perception,
        entry.speed,
        typedValues(entry.resistances),
        typedValues(entry.weaknesses),
        immunities,
        skills,
        flags,
        spellModes,
    ]);
});

const compactIndex = {
    v: 2,
    dict: {
        t: typeDict.list,      // type
        r: rarityDict.list,    // rarity
        s: sizeDict.list,      // size
        tr: traitDict.list,    // traits
        dt: defenseTypeDict.list, // resistance / weakness / immunity types
        sk: skillDict.list,    // skill keys
        sm: spellModeDict.list, // spellcasting modes
    },
    items,
};

writeJsonOutput(OUTPUT_INDEX_FILE, compactIndex);
console.log(`Generated creature catalog with ${catalog.length} items and index with ${items.length} entries.`);
