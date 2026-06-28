// LEGACY IMPORT/MIGRATION ONLY.
// Normal runtime writes use targeted repositories and domain actions. Do not
// call writeLegacyDbDiffToV2 from UI or runtime hooks.
import { deleteDoc, doc, writeBatch } from 'firebase/firestore';
import { normalizeMasterToV2 } from './normalizers.js';
import { V2_COLLECTIONS } from './schema.js';

const BATCH_LIMIT = 450;
const BACKUP_CHUNK_SIZE = 700000;

export async function backupMasterToFirestore(firestore, masterDb, migrationId) {
    const rawJson = JSON.stringify(masterDb);
    const chunks = chunkString(rawJson, BACKUP_CHUNK_SIZE);
    const backupRef = doc(firestore, V2_COLLECTIONS.migrationBackups, migrationId);
    const ops = [{
        type: 'set',
        ref: backupRef,
        data: {
            schemaVersion: 1,
            migrationId,
            createdAt: new Date().toISOString(),
            source: 'data/master',
            chunkCount: chunks.length,
            sizeBytes: new TextEncoder().encode(rawJson).length,
        },
    }];

    chunks.forEach((chunk, index) => {
        ops.push({
            type: 'set',
            ref: doc(firestore, V2_COLLECTIONS.migrationBackups, migrationId, 'chunks', String(index).padStart(4, '0')),
            data: {
                index,
                data: chunk,
            },
        });
    });

    await writeBatchDocuments(firestore, ops);
}

export async function writeMasterMigrationToV2(firestore, masterDb, options = {}) {
    const normalized = normalizeMasterToV2(masterDb, options);
    if (options.backup !== false) {
        await backupMasterToFirestore(firestore, masterDb, normalized.migrationId);
    }

    await writeV2Documents(firestore, normalized.documents);
    return normalized;
}

export async function writeLegacyDbDiffToV2(firestore, previousDb, nextDb, options = {}) {
    const previous = normalizeMasterToV2(previousDb || {}, {
        now: options.now,
        migrationId: options.migrationId || 'runtime_previous',
    });
    const next = normalizeMasterToV2(nextDb || {}, {
        now: options.now,
        migrationId: options.migrationId || `runtime_${Date.now()}`,
    });

    const previousByPath = new Map(previous.documents.map(entry => [entry.path, entry]));
    const nextByPath = new Map(next.documents.map(entry => [entry.path, entry]));
    const writes = [];
    const deletes = [];

    for (const [path, entry] of nextByPath.entries()) {
        const previousEntry = previousByPath.get(path);
        if (!previousEntry || stableStringify(previousEntry.data) !== stableStringify(entry.data)) {
            writes.push(entry);
        }
    }

    for (const path of previousByPath.keys()) {
        if (!nextByPath.has(path)) deletes.push(path);
    }

    await writeV2Documents(firestore, writes, deletes);
    return {
        migrationId: next.migrationId,
        writes: writes.length,
        deletes: deletes.length,
        report: next.report,
    };
}

export async function writeV2Documents(firestore, documents, deletePaths = []) {
    const ops = [];

    for (const entry of documents || []) {
        ops.push({
            type: 'set',
            ref: docFromPath(firestore, entry.path),
            data: entry.data,
        });
    }

    for (const path of deletePaths || []) {
        ops.push({
            type: 'delete',
            ref: docFromPath(firestore, path),
        });
    }

    await writeBatchDocuments(firestore, ops);
}

export async function deleteV2Document(firestore, path) {
    await deleteDoc(docFromPath(firestore, path));
}

function docFromPath(firestore, path) {
    const segments = String(path || '').split('/').filter(Boolean);
    if (segments.length === 0 || segments.length % 2 !== 0) {
        throw new Error(`Invalid Firestore document path: ${path}`);
    }
    return doc(firestore, ...segments);
}

async function writeBatchDocuments(firestore, ops) {
    for (let i = 0; i < ops.length; i += BATCH_LIMIT) {
        const batch = writeBatch(firestore);
        for (const op of ops.slice(i, i + BATCH_LIMIT)) {
            if (op.type === 'delete') batch.delete(op.ref);
            else batch.set(op.ref, op.data);
        }
        await batch.commit();
    }
}

function stableStringify(value) {
    return JSON.stringify(sortKeys(value));
}

function sortKeys(value) {
    if (Array.isArray(value)) return value.map(sortKeys);
    if (!value || typeof value !== 'object') return value;
    return Object.keys(value).sort().reduce((out, key) => {
        out[key] = sortKeys(value[key]);
        return out;
    }, {});
}

function chunkString(value, size) {
    const chunks = [];
    for (let index = 0; index < value.length; index += size) {
        chunks.push(value.slice(index, index + size));
    }
    return chunks.length ? chunks : [''];
}
