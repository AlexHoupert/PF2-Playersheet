import fs from 'fs';
import path from 'path';

const SOURCE_DIR = './ressources';
const DEST_DIR = './dist/ressources';

if (!fs.existsSync('./dist')) {
    console.error('dist/ not found. Run `vite build` first.');
    process.exit(1);
}

if (!fs.existsSync(SOURCE_DIR)) {
    console.error('ressources/ not found.');
    process.exit(1);
}

// Ensure destination parent exists
const parentDir = path.dirname(DEST_DIR);
if (!fs.existsSync(parentDir)) fs.mkdirSync(parentDir, { recursive: true });

fs.rmSync(DEST_DIR, { recursive: true, force: true });
fs.cpSync(SOURCE_DIR, DEST_DIR, { recursive: true });

console.log('Copied ressources/ into dist/ressources/');
