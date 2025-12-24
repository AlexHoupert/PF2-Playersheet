import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ACTIONS_DIR = path.join(__dirname, '../ressources/actions');
const OUTPUT_FILE = path.join(__dirname, '../src/data/action_index.json');

const files = fs.readdirSync(ACTIONS_DIR).filter(f => f.endsWith('.json'));

const dict = {
    t: [], // traits
    c: [], // category
};

function getIndex(arr, val) {
    if (!val) return null;
    let idx = arr.indexOf(val);
    if (idx === -1) {
        idx = arr.length;
        arr.push(val);
    }
    return idx;
}

const items = files.map(file => {
    const content = fs.readFileSync(path.join(ACTIONS_DIR, file), 'utf8');
    const json = JSON.parse(content);
    const sys = json.system || {};
    const cls = sys.classification || {};

    const name = json.name;
    const img = json.img ? json.img.replace('systems/pf2e/', '') : null;
    const sourceFile = `actions/${file}`;

    const actionType = sys.actionType?.value || null; // action, passive, reaction, free
    const actionCost = sys.actions?.value || null; // 1, 2, 3

    // Normalize action type/cost for UI
    // If 'action' and cost 1 -> '1'
    // If 'action' and cost 2 -> '2'
    // If 'action' and cost 3 -> '3'
    // If 'reaction' -> 'R'
    // If 'free' -> 'F'
    // If 'passive' -> 'P' (or null)

    let typeCode = null;
    if (actionType === 'action') {
        typeCode = String(actionCost || 1);
    } else if (actionType === 'reaction') {
        typeCode = 'R';
    } else if (actionType === 'free') {
        typeCode = 'F';
    } else if (actionType === 'passive') {
        typeCode = 'P';
    }

    const traits = sys.traits?.value || [];
    const traitIndices = traits.map(t => getIndex(dict.t, t));

    const category = sys.category || null;
    const categoryIndex = getIndex(dict.c, category);

    // Start with default values to ensure consistent array length
    // Schema: [name, img, sourceFile, typeCode, userType, userSubtype, skill, traitIndices]
    // If we want to index categories, we can map them too, but raw strings might be fine for now if cardinality is low.
    // Given the user provided list, the cardinality is known and small.

    const userType = cls.type || "Other";
    const userSubtype = cls.subtype || "Other";
    const skill = cls.skill || null;
    const feat = cls.feat || null; // New field for Feat Prerequisite

    // Schema Updated: [name, img, sourceFile, typeCode, userType, userSubtype, skill, traitIndices, feat]
    return [name, img, sourceFile, typeCode, userType, userSubtype, skill, traitIndices, feat];
});

const output = {
    dict,
    items
};

fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output), 'utf8'); // No pretty print for compactness
console.log(`Generated index for ${items.length} actions.`);
