import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const RESSOURCES_DIR = path.join(__dirname, '../ressources');
const OUTPUT_FILE = path.join(__dirname, '../src/data/icon_catalog.json');

// Ensure output dir exists
const outputDir = path.dirname(OUTPUT_FILE);
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

function scanDirectory(dir, fileList = []) {
    const files = fs.readdirSync(dir);

    files.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);

        if (stat.isDirectory()) {
            scanDirectory(filePath, fileList);
        } else {
            // Only include image files
            if (/\.(webp|png|jpg|jpeg|gif|svg)$/i.test(file)) {
                // Store path relative to project root (or just relative to ressources?)
                // ImagePicker expects paths starting with 'ressources/' or relative to it.
                // Let's store relative to 'ressources/' to keep it clean, 
                // but ImagePicker default logic uses 'ressources' as currentPath.
                // Let's store "ressources/path/to/file" to match currentPath logic.
                const relativePath = path.relative(path.join(__dirname, '..'), filePath).replace(/\\/g, '/');
                fileList.push(relativePath);
            }
        }
    });

    return fileList;
}

console.log('Scanning for icons in ressources/...');
try {
    const allIcons = scanDirectory(RESSOURCES_DIR);
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(allIcons, null, 2));
    console.log(`Successfully indexed ${allIcons.length} icons to ${OUTPUT_FILE}`);
} catch (err) {
    console.error('Error scanning icons:', err);
    process.exit(1);
}
