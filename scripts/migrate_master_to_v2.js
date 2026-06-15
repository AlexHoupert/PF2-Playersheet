import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { initializeApp } from 'firebase/app';
import { doc, getDoc, initializeFirestore, terminate } from 'firebase/firestore';
import { normalizeMasterToV2 } from '../src/shared/db/v2/normalizers.js';
import { writeMasterMigrationToV2 } from '../src/shared/db/v2/firestoreMigration.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
let activeFirestore = null;

function parseArgs(argv) {
    const args = {
        input: 'src/data/new_db.json',
        reportOut: null,
        docsOut: null,
        write: false,
        backupFile: false,
        fromFirestore: false,
        allowLocalInput: false,
    };

    for (let i = 2; i < argv.length; i += 1) {
        const arg = argv[i];
        if (arg === '--write') args.write = true;
        else if (arg === '--backup-file') args.backupFile = true;
        else if (arg === '--from-firestore') args.fromFirestore = true;
        else if (arg === '--allow-local-input') args.allowLocalInput = true;
        else if (arg === '--input') args.input = argv[++i];
        else if (arg === '--report-out') args.reportOut = argv[++i];
        else if (arg === '--docs-out') args.docsOut = argv[++i];
        else if (arg === '--help') {
            printHelp();
            process.exit(0);
        } else {
            throw new Error(`Unknown argument: ${arg}`);
        }
    }
    return args;
}

function printHelp() {
    console.log(`
Usage:
  node scripts/migrate_master_to_v2.js --from-firestore [--report-out recovery/report.json] [--docs-out recovery/docs.json]
  node scripts/migrate_master_to_v2.js --from-firestore --write --backup-file
  node scripts/migrate_master_to_v2.js --allow-local-input --input src/data/new_db.json

Options:
  --from-firestore Read the current Firestore data/master document as the source.
  --input       Legacy master JSON file to normalize.
  --allow-local-input Permit reading from --input instead of Firestore.
  --report-out  Write the migration report JSON to disk.
  --docs-out    Write normalized Firestore document payloads to disk.
  --write       Write normalized documents to Firestore using VITE_FIREBASE_* env vars.
  --backup-file Save a local backup of the input JSON under recovery/.
`);
}

function loadDotEnvLocal() {
    const envPath = path.join(repoRoot, '.env.local');
    if (!fs.existsSync(envPath)) return;
    const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const index = trimmed.indexOf('=');
        if (index === -1) continue;
        const key = trimmed.slice(0, index).trim();
        const value = trimmed.slice(index + 1).trim().replace(/^["']|["']$/g, '');
        if (process.env[key] == null) process.env[key] = value;
    }
}

function firebaseConfigFromEnv() {
    return {
        apiKey: process.env.VITE_FIREBASE_API_KEY,
        authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
        projectId: process.env.VITE_FIREBASE_PROJECT_ID,
        storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
        appId: process.env.VITE_FIREBASE_APP_ID,
        measurementId: process.env.VITE_FIREBASE_MEASUREMENT_ID,
    };
}

function createFirestore(config) {
    const app = initializeApp(config);
    activeFirestore = initializeFirestore(app, { experimentalForceLongPolling: true });
    return activeFirestore;
}

function resolveRepoPath(filePath) {
    return path.resolve(repoRoot, filePath);
}

function writeJson(filePath, data) {
    const absolutePath = resolveRepoPath(filePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, JSON.stringify(data, null, 2), 'utf8');
    return absolutePath;
}

async function main() {
    const args = parseArgs(process.argv);

    if (!args.fromFirestore && !args.allowLocalInput) {
        throw new Error('Refusing to migrate from local JSON by default. Use --from-firestore for live data, or --allow-local-input for an intentional local-file migration.');
    }

    loadDotEnvLocal();
    let firestore = null;
    let masterDb;

    if (args.fromFirestore) {
        const config = firebaseConfigFromEnv();
        if (!config.apiKey || !config.projectId) {
            throw new Error('Missing VITE_FIREBASE_API_KEY or VITE_FIREBASE_PROJECT_ID.');
        }
        firestore = createFirestore(config);
        const masterSnap = await getDoc(doc(firestore, 'data', 'master'));
        if (!masterSnap.exists()) throw new Error('Firestore data/master does not exist.');
        masterDb = masterSnap.data();
    } else {
        const inputPath = resolveRepoPath(args.input);
        masterDb = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
    }

    const normalized = normalizeMasterToV2(masterDb);

    if (args.backupFile) {
        const backupName = `recovery/master-v1-backup-${normalized.migrationId}.json`;
        const backupPath = writeJson(backupName, masterDb);
        console.log(`Backup written: ${backupPath}`);
    }

    if (args.reportOut) {
        const reportPath = writeJson(args.reportOut, normalized.report);
        console.log(`Report written: ${reportPath}`);
    }

    if (args.docsOut) {
        const docsPath = writeJson(args.docsOut, normalized.documents);
        console.log(`Documents written: ${docsPath}`);
    }

    console.log(JSON.stringify({
        migrationId: normalized.migrationId,
        documents: normalized.documents.length,
        counts: normalized.report.counts,
        renamedFields: normalized.report.renamedFields.length,
        invalidValues: normalized.report.invalidValues.length,
        fallbackAssumptions: normalized.report.fallbackAssumptions.length,
    }, null, 2));

    if (args.write) {
        if (!firestore) {
            const config = firebaseConfigFromEnv();
            if (!config.apiKey || !config.projectId) {
                throw new Error('Missing VITE_FIREBASE_API_KEY or VITE_FIREBASE_PROJECT_ID.');
            }
            firestore = createFirestore(config);
        }
        await writeMasterMigrationToV2(firestore, masterDb, {
            migrationId: normalized.migrationId,
            backup: true,
        });
        console.log('Firestore v2 write complete.');
    }
}

main()
    .catch(err => {
    console.error(err);
    process.exit(1);
})
    .finally(async () => {
        if (activeFirestore) await terminate(activeFirestore).catch(() => {});
    });
