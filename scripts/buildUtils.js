import fs from 'fs';
import path from 'path';

export function getFilesRecursively(dir) {
    if (!fs.existsSync(dir)) return [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    return entries.flatMap(e =>
        e.isDirectory()
            ? getFilesRecursively(path.join(dir, e.name))
            : [path.join(dir, e.name)]
    );
}

export function buildDictionary(values) {
    const unique = new Set(values.map(v => (v == null ? '' : String(v))));
    unique.delete('');
    const list = [''].concat(Array.from(unique).sort((a, b) => a.localeCompare(b)));
    const map = new Map(list.map((value, i) => [value, i]));
    return { list, map };
}

export function writeJsonOutput(filePath, data, pretty = false) {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath, pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data));
}
