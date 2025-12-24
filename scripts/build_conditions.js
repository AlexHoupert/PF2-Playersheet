import fs from 'fs';
import path from 'path';

const SOURCE_DIR = './ressources/conditions';
const OUTPUT_FILE = './src/data/conditions_catalog.json';

const catalog = {};

if (fs.existsSync(SOURCE_DIR)) {
    const files = fs.readdirSync(SOURCE_DIR);

    files.forEach(file => {
        if (!file.endsWith('.json')) return;

        try {
            const raw = fs.readFileSync(path.join(SOURCE_DIR, file), 'utf8');
            const data = JSON.parse(raw);
            const sys = data.system || {};

            const name = data.name;
            if (!name) return;

            catalog[name] = {
                name,
                img: data.img ? data.img.replace('systems/pf2e/', '') : null,
                description: sys.description?.value || '',
                group: sys.group || null,
                isValued: Boolean(sys.value?.isValued)
            };
        } catch (err) {
            console.error(`Error parsing ${file}:`, err);
        }
    });
}

// Ensure directory exists
const dir = path.dirname(OUTPUT_FILE);
if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
}

fs.writeFileSync(OUTPUT_FILE, JSON.stringify(catalog, null, 2));
console.log(`Generated conditions catalog with ${Object.keys(catalog).length} entries.`);
