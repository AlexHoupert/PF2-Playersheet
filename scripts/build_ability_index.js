/**
 * Build Ability Index
 * Scans all bestiary + bestiary-ability-glossary-srd JSON files and collects
 * every `items[]` entry of type 'action'. Deduplicates by name (glossary-srd
 * entries take priority as canonical definitions; among duplicates the one with
 * the longest description wins).
 *
 * Output: src/data/ability_index.json
 * Run: node scripts/build_ability_index.js
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BESTIARY_DIR   = path.join(__dirname, '../ressources/bestiary');
const GLOSSARY_DIR   = path.join(__dirname, '../ressources/bestiary-ability-glossary-srd');
const OUTPUT_FILE    = path.join(__dirname, '../src/data/ability_index.json');

// ── helpers ──────────────────────────────────────────────────────────────────

function getFilesRecursively(dir) {
    if (!fs.existsSync(dir)) return [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    return entries.flatMap(e =>
        e.isDirectory()
            ? getFilesRecursively(path.join(dir, e.name))
            : [path.join(dir, e.name)]
    );
}

function toTypeCode(actionType, actionCost) {
    if (actionType === 'passive')  return 'P';
    if (actionType === 'reaction') return 'R';
    if (actionType === 'free')     return 'F';
    if (actionType === 'action')   return String(actionCost ?? 1);
    return 'P';
}

function dictIndex(arr, val) {
    if (!val) return 0;          // 0 → '' (empty/unknown slot)
    let i = arr.indexOf(val);
    if (i === -1) { i = arr.length; arr.push(val); }
    return i;
}

// ── collect abilities ─────────────────────────────────────────────────────────

// name → { typeCode, categoryIdx, traitIdxs, description }
const byName = new Map();

const traitDict    = [''];   // index 0 = '' (unknown)
const categoryDict = [''];

function ingest(item, priority = false) {
    if (!item || item.type !== 'action') return;
    const name = item.name?.trim();
    if (!name) return;

    const sys        = item.system || {};
    const actionType = sys.actionType?.value || 'passive';
    const actionCost = sys.actions?.value ?? null;
    const typeCode   = toTypeCode(actionType, actionCost);
    const category   = sys.category || '';
    const traits     = (sys.traits?.value || []).filter(Boolean);
    const desc       = (sys.description?.value || '').trim();

    const existing = byName.get(name);
    // Replace if: priority (glossary), OR no existing entry, OR longer description
    if (!existing || priority || desc.length > (existing.rawDesc?.length ?? 0)) {
        byName.set(name, {
            typeCode,
            categoryIdx: dictIndex(categoryDict, category),
            traitNames: traits,
            rawDesc: desc,
        });
    }
}

// 1. Glossary files first (priority = true → canonical definitions)
if (fs.existsSync(GLOSSARY_DIR)) {
    fs.readdirSync(GLOSSARY_DIR)
        .filter(f => f.endsWith('.json'))
        .forEach(f => {
            try {
                const data = JSON.parse(fs.readFileSync(path.join(GLOSSARY_DIR, f), 'utf8'));
                ingest(data, true);
            } catch { /* skip bad files */ }
        });
}

// 2. All creature items
if (fs.existsSync(BESTIARY_DIR)) {
    const files = getFilesRecursively(BESTIARY_DIR).filter(f => f.endsWith('.json'));
    files.forEach(file => {
        try {
            const data = JSON.parse(fs.readFileSync(file, 'utf8'));
            (data.items || []).forEach(item => ingest(item, false));
        } catch { /* skip bad files */ }
    });
}

// ── build trait dictionary & compact rows ─────────────────────────────────────

const rows = [];
byName.forEach((entry, name) => {
    const traitIdxs = entry.traitNames.map(t => dictIndex(traitDict, t));
    rows.push([
        name,               // 0 name
        entry.typeCode,     // 1 typeCode: P/R/F/1/2/3
        entry.categoryIdx,  // 2 category index
        traitIdxs,          // 3 trait indices
        entry.rawDesc,      // 4 description HTML
    ]);
});

// Sort alphabetically for stable output
rows.sort((a, b) => a[0].localeCompare(b[0]));

const output = {
    v: 1,
    dict: { t: traitDict, c: categoryDict },
    items: rows,
};

const dir = path.dirname(OUTPUT_FILE);
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output));
console.log(`Built ability index: ${rows.length} unique abilities.`);
