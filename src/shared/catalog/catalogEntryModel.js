export const CATALOG_ENTRY_STATUS = Object.freeze({
    ORIGINAL: 'original',
    EDITED: 'edited',
    CUSTOM: 'custom',
    DELETED: 'deleted',
});

export function getCatalogEntryKey(entry, catalogType = 'catalog') {
    return normalizeCatalogKey(getCatalogEntryBaseId(entry) || entry?.name || catalogType);
}

export function getCatalogEntryBaseId(entry) {
    return firstString([
        entry?.sourceFile,
        entry?.overrideSourceFile,
        entry?.baseId,
        entry?.id,
        entry?._id,
        entry?.name,
    ]);
}

export function getCatalogEntryMatchKeys(entry) {
    const strongKeys = normalizeKeys([
        entry?.sourceFile,
        entry?.overrideSourceFile,
        entry?.baseId,
        entry?.id,
        entry?._id,
    ]);
    if (strongKeys.length) return strongKeys;
    return normalizeKeys([entry?.name]);
}

export function getCatalogOverrideTargetKeys(override) {
    const payload = override?.payload || {};
    const strongKeys = normalizeKeys([
        override?.baseId,
        payload.overrideSourceFile,
        payload.sourceFile,
        payload.id,
        payload._id,
    ]);
    if (strongKeys.length) return strongKeys;
    return normalizeKeys([override?.label, payload.name, override?.id]);
}

export function buildCatalogEntryStates({ staticItems = [], overrides = [], catalogType = null } = {}) {
    const relevantOverrides = (overrides || [])
        .filter(Boolean)
        .filter((override) => !catalogType || override.catalogType === catalogType);

    const hiddenByKey = new Map();
    const overridesByKey = new Map();
    const customOverrides = [];
    const matchedOverrideIds = new Set();

    for (const override of relevantOverrides) {
        const keys = getCatalogOverrideTargetKeys(override);
        if (override.mode === 'hide') {
            keys.forEach((key) => hiddenByKey.set(key, override));
            continue;
        }
        if (override.mode === 'override') {
            keys.forEach((key) => overridesByKey.set(key, override));
            continue;
        }
        customOverrides.push(override);
    }

    const states = [];
    for (const item of staticItems || []) {
        const keys = getCatalogEntryMatchKeys(item);
        const key = keys[0] || getCatalogEntryKey(item, catalogType || 'catalog');
        const hideOverride = keys.map((candidate) => hiddenByKey.get(candidate)).find(Boolean);
        if (hideOverride) {
            matchedOverrideIds.add(hideOverride.id);
            const entry = decorateCatalogEntry(item, {
                status: CATALOG_ENTRY_STATUS.DELETED,
                catalogType,
                key,
                override: hideOverride,
            });
            states.push({
                status: CATALOG_ENTRY_STATUS.DELETED,
                catalogType,
                key,
                entry,
                original: item,
                effective: null,
                override: hideOverride,
                overrideId: hideOverride.id,
                baseId: hideOverride.baseId || getCatalogEntryBaseId(item),
                isDeleted: true,
            });
            continue;
        }

        const editOverride = keys.map((candidate) => overridesByKey.get(candidate)).find(Boolean);
        if (editOverride) {
            matchedOverrideIds.add(editOverride.id);
            const effective = {
                ...item,
                ...overrideToCatalogItem(editOverride),
                isOverride: true,
            };
            const entry = decorateCatalogEntry(effective, {
                status: CATALOG_ENTRY_STATUS.EDITED,
                catalogType,
                key,
                override: editOverride,
            });
            states.push({
                status: CATALOG_ENTRY_STATUS.EDITED,
                catalogType,
                key,
                entry,
                original: item,
                effective: entry,
                override: editOverride,
                overrideId: editOverride.id,
                baseId: editOverride.baseId || getCatalogEntryBaseId(item),
                isDeleted: false,
            });
            continue;
        }

        const entry = decorateCatalogEntry(item, {
            status: CATALOG_ENTRY_STATUS.ORIGINAL,
            catalogType,
            key,
        });
        states.push({
            status: CATALOG_ENTRY_STATUS.ORIGINAL,
            catalogType,
            key,
            entry,
            original: item,
            effective: entry,
            override: null,
            overrideId: null,
            baseId: getCatalogEntryBaseId(item),
            isDeleted: false,
        });
    }

    for (const override of relevantOverrides) {
        if (override.mode !== 'override' || matchedOverrideIds.has(override.id)) continue;
        const entry = decorateCatalogEntry(overrideToCatalogItem(override), {
            status: CATALOG_ENTRY_STATUS.EDITED,
            catalogType,
            key: getCatalogEntryKey(overrideToCatalogItem(override), catalogType || override.catalogType),
            override,
        });
        states.push({
            status: CATALOG_ENTRY_STATUS.EDITED,
            catalogType,
            key: entry.catalogEntryKey,
            entry,
            original: null,
            effective: entry,
            override,
            overrideId: override.id,
            baseId: override.baseId || getCatalogEntryBaseId(entry),
            isDeleted: false,
            isOrphanOverride: true,
        });
    }

    for (const override of customOverrides) {
        const entry = decorateCatalogEntry(overrideToCatalogItem(override), {
            status: CATALOG_ENTRY_STATUS.CUSTOM,
            catalogType,
            key: getCatalogEntryKey(overrideToCatalogItem(override), catalogType || override.catalogType),
            override,
        });
        if (!entry?.name) continue;
        states.push({
            status: CATALOG_ENTRY_STATUS.CUSTOM,
            catalogType,
            key: entry.catalogEntryKey,
            entry,
            original: null,
            effective: entry,
            override,
            overrideId: override.id,
            baseId: override.baseId || null,
            isDeleted: false,
        });
    }

    return states;
}

export function selectVisibleCatalogEntriesFromStates(states = []) {
    return states
        .filter((state) => state.status !== CATALOG_ENTRY_STATUS.DELETED)
        .map((state) => state.effective || state.entry)
        .filter((entry) => entry?.name);
}

export function selectDeletedCatalogEntriesFromStates(states = []) {
    return states
        .filter((state) => state.status === CATALOG_ENTRY_STATUS.DELETED)
        .map((state) => state.entry)
        .filter((entry) => entry?.name);
}

export function buildEditOverride(catalogType, baseEntry, payload = {}, options = {}) {
    const baseId = options.baseId || getCatalogEntryBaseId(baseEntry);
    const label = payload?.name || baseEntry?.name || baseId || catalogType;
    const id = options.id || baseEntry?.catalogOverrideId || buildCatalogOverrideId(catalogType, baseId || label);
    return {
        id,
        catalogType,
        baseId: baseId || null,
        mode: 'override',
        label,
        payload: normalizeOverridePayload(payload, {
            sourceFile: null,
            isCustom: false,
            overrideSourceFile: baseId || payload?.overrideSourceFile || null,
        }),
        sourceFile: null,
    };
}

export function buildCloneOverride(catalogType, sourceEntry, payload = {}, options = {}) {
    const label = payload?.name || sourceEntry?.name || catalogType;
    const id = options.id || buildCatalogOverrideId(catalogType, options.key || `${label}_${Date.now()}`);
    return {
        id,
        catalogType,
        baseId: null,
        mode: 'custom',
        label,
        payload: normalizeOverridePayload(payload, {
            sourceFile: null,
            isCustom: true,
            overrideSourceFile: null,
        }),
        sourceFile: null,
    };
}

export function buildHideOverride(catalogType, baseEntry, options = {}) {
    const baseId = options.baseId || getCatalogEntryBaseId(baseEntry);
    const label = options.label || baseEntry?.name || baseId || catalogType;
    const id = options.id || baseEntry?.catalogOverrideId || buildCatalogOverrideId(catalogType, baseId || label);
    return {
        id,
        catalogType,
        baseId: baseId || null,
        mode: 'hide',
        label,
        payload: {
            name: label,
            overrideSourceFile: baseId || null,
        },
        sourceFile: null,
    };
}

export function overrideToCatalogItem(override) {
    const payload = override?.payload || {};
    const embedded = payload.data || {};
    const base = {
        ...embedded,
        ...payload,
    };
    return {
        ...base,
        id: base.id || base._id || override?.baseId || override?.id,
        name: base.name || override?.label || override?.id,
        sourceFile: base.sourceFile ?? null,
        overrideSourceFile: base.overrideSourceFile || override?.baseId || null,
        catalogOverrideId: override?.id,
        catalogType: override?.catalogType,
        isCustom: override?.mode === 'custom' || Boolean(base.isCustom),
        isOverride: override?.mode === 'override',
    };
}

export function normalizeCatalogKey(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    return raw
        .replace(/\\/g, '/')
        .replace(/^ressources\//i, '')
        .replace(/^resources\//i, '')
        .toLowerCase();
}

export function buildCatalogOverrideId(catalogType, value) {
    const key = normalizeCatalogKey(value || catalogType)
        .replace(/[^a-z0-9_-]+/gi, '_')
        .replace(/^_+|_+$/g, '')
        .toLowerCase();
    return `${catalogType}_${key || 'override'}`;
}

function decorateCatalogEntry(entry, { status, catalogType, key, override = null }) {
    return {
        ...entry,
        catalogType: entry?.catalogType || catalogType,
        catalogEntryStatus: status,
        catalogEntryKey: key,
        catalogOverrideId: override?.id || entry?.catalogOverrideId || null,
        isCustom: status === CATALOG_ENTRY_STATUS.CUSTOM || Boolean(entry?.isCustom),
        isOverride: status === CATALOG_ENTRY_STATUS.EDITED || Boolean(entry?.isOverride),
        isDeleted: status === CATALOG_ENTRY_STATUS.DELETED,
    };
}

function normalizeOverridePayload(payload, forcedFields) {
    const safePayload = { ...(payload || {}) };
    return {
        ...safePayload,
        ...forcedFields,
    };
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

function firstString(values) {
    return values.map((value) => String(value || '').trim()).find(Boolean) || '';
}
