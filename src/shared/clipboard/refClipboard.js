import {
    getCatalogEntryBaseId,
    getCatalogEntryKey,
} from '../catalog/catalogEntryModel.js';

/**
 * Cross-context Copy Reference system.
 *
 * Canonical catalog reference:
 * { refType: 'catalog', catalogType, id, baseId, sourceFile, label }
 *
 * Stored references also keep the legacy shape:
 * { type, name, data }
 * so older consumers like Bestiary ability paste continue to work.
 */

export const CATALOG_REF_TYPE = 'catalog';
const MARKER = '_pf2ref';

let _inMemory = null;
const _listeners = new Set();

function notify() {
    _listeners.forEach(fn => fn(_inMemory));
}

export function copyRef(type, data = {}) {
    _inMemory = buildStoredCatalogReference(type, data);
    notify();
    const json = JSON.stringify({ [MARKER]: 1, ..._inMemory });
    globalThis.navigator?.clipboard?.writeText?.(json)?.catch?.(() => {
        // Clipboard API unavailable - in-memory copy still works in this tab.
    });
    return _inMemory;
}

export function getInMemoryRef() {
    return _inMemory;
}

export async function readRef() {
    try {
        const text = await globalThis.navigator?.clipboard?.readText?.();
        if (text && text.includes(`"${MARKER}"`)) {
            return normalizeStoredReference(JSON.parse(text));
        }
    } catch {
        // readText requires user gesture permission or HTTPS; fall through.
    }
    return _inMemory;
}

export function onRefChange(fn) {
    _listeners.add(fn);
    return () => _listeners.delete(fn);
}

export function clearRef() {
    _inMemory = null;
    notify();
    globalThis.navigator?.clipboard?.writeText?.('')?.catch?.(() => {});
}

export function createCatalogReference(catalogType, data = {}) {
    const existing = data?.catalogRef && data.catalogRef.refType === CATALOG_REF_TYPE ? data.catalogRef : {};
    const type = normalizeRefCatalogType(catalogType || existing.catalogType || data.catalogType || data.type);
    const label = firstString([existing.label, data.name, data.label, data.id, data._id, type]);
    const sourceFile = firstString([
        existing.sourceFile,
        data.sourceFile,
        data.overrideSourceFile,
    ]);
    const baseId = firstString([
        existing.baseId,
        data.baseId,
        getCatalogEntryBaseId(data),
        sourceFile,
        label,
    ]);
    return {
        refType: CATALOG_REF_TYPE,
        catalogType: type,
        id: firstString([
            existing.id,
            data.catalogOverrideId,
            data.id,
            data._id,
            data.catalogEntryKey,
            getCatalogEntryKey(data, type),
        ]),
        baseId,
        sourceFile: sourceFile || null,
        label,
        catalogOverrideId: existing.catalogOverrideId || data.catalogOverrideId || null,
        status: existing.status || data.catalogEntryStatus || null,
    };
}

export function isCatalogReference(ref) {
    return ref?.refType === CATALOG_REF_TYPE || ref?.catalogRef?.refType === CATALOG_REF_TYPE;
}

export function normalizeStoredReference(raw) {
    if (!raw) return null;
    const data = raw.data || {};
    const catalogRef = raw.refType === CATALOG_REF_TYPE
        ? createCatalogReference(raw.catalogType, raw)
        : createCatalogReference(raw.type || raw.catalogType, data.catalogRef || data);
    return buildStoredCatalogReference(catalogRef.catalogType, {
        ...data,
        catalogRef,
        name: raw.name || data.name || catalogRef.label,
    });
}

function buildStoredCatalogReference(type, data = {}) {
    const catalogRef = createCatalogReference(type, data);
    const storedData = {
        ...(data || {}),
        catalogRef,
    };
    return {
        ...catalogRef,
        type: catalogRef.catalogType,
        name: catalogRef.label || storedData.name || '',
        data: storedData,
    };
}

function normalizeRefCatalogType(type) {
    const normalized = String(type || 'item').trim().toLowerCase();
    if (normalized === 'shop' || normalized === 'equipment') return 'item';
    if (normalized === 'actions') return 'action';
    if (normalized === 'spells') return 'spell';
    if (normalized === 'feats') return 'feat';
    if (normalized === 'impulses') return 'impulse';
    if (normalized === 'abilities') return 'ability';
    if (normalized === 'creatures' || normalized === 'bestiary') return 'creature';
    return normalized || 'item';
}

function firstString(values) {
    return values
        .map((value) => String(value || '').trim())
        .find(Boolean) || '';
}
