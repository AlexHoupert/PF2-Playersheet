import { normalizeCatalogType } from './catalogDetailCore.js';
import {
    getCatalogEntryBaseId,
    getCatalogEntryKey,
    normalizeCatalogKey,
} from './catalogEntryModel.js';
import { createCatalogReference } from '../clipboard/refClipboard.js';
import { selectCatalogEntryStates } from '../db/selectors/catalogOverrideSelectors.js';

export function resolveCatalogReferenceCore(refLike, source = null, options = {}) {
    const ref = createCatalogReference(
        options.catalogType || refLike?.catalogType || refLike?.type,
        refLike?.data?.catalogRef || refLike?.catalogRef || refLike
    );
    const catalogType = normalizeCatalogType(ref.catalogType);
    const states = options.entryStates || selectCatalogEntryStates(options.staticItems || [], source, catalogType);
    const state = states.find((candidate) => catalogStateMatchesReference(candidate, ref)) || null;
    const entry = state?.effective || state?.entry || null;
    return {
        ref,
        catalogType,
        state,
        entry,
        status: state?.status || entry?.catalogEntryStatus || ref.status || null,
        isDeleted: Boolean(state?.isDeleted || entry?.isDeleted),
    };
}

export function resolveCatalogReferenceEntryCore(refLike, source = null, options = {}) {
    return resolveCatalogReferenceCore(refLike, source, options).entry;
}

export function resolveCatalogLinkCore(type, name, source = null, options = {}) {
    return resolveCatalogReferenceCore(createCatalogReference(type, { name }), source, options);
}

function catalogStateMatchesReference(state, ref) {
    if (!state || !ref) return false;
    const entry = state.effective || state.entry || {};
    const refKeys = buildReferenceKeys(ref);
    const entryKeys = buildEntryKeys(state, entry);
    if (ref.catalogOverrideId && state.overrideId && ref.catalogOverrideId === state.overrideId) return true;
    return refKeys.some((key) => entryKeys.has(key));
}

function buildReferenceKeys(ref) {
    return normalizeKeys([
        ref.id,
        ref.baseId,
        ref.sourceFile,
        ref.catalogOverrideId,
        ref.label,
    ]);
}

function buildEntryKeys(state, entry) {
    return new Set(normalizeKeys([
        state.key,
        state.baseId,
        state.overrideId,
        entry.catalogOverrideId,
        entry.catalogEntryKey,
        entry.id,
        entry._id,
        entry.sourceFile,
        entry.overrideSourceFile,
        getCatalogEntryBaseId(entry),
        getCatalogEntryKey(entry, state.catalogType || entry.catalogType),
        entry.name,
    ]));
}

function normalizeKeys(values) {
    const keys = new Set();
    for (const value of values) {
        const raw = String(value || '').trim();
        if (!raw) continue;
        const normalized = normalizeCatalogKey(raw);
        keys.add(raw);
        keys.add(raw.toLowerCase());
        keys.add(normalized);
        keys.add(normalized.replace(/[^a-z0-9_-]+/gi, '_').replace(/^_+|_+$/g, '').toLowerCase());
    }
    return [...keys].filter(Boolean);
}
