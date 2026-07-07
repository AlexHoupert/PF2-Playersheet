import {
    buildCatalogOverrideId,
    buildCloneOverride,
    buildEditOverride,
    getCatalogEntryBaseId,
} from './catalogEntryModel.js';

export const CATALOG_EDITOR_MODES = Object.freeze({
    CREATE: 'create',
    EDIT: 'edit',
    CLONE: 'clone',
});

export function resolveCatalogEditorMode({ editorMode, initialItem, sourceFile } = {}) {
    if (Object.values(CATALOG_EDITOR_MODES).includes(editorMode)) return editorMode;
    if (initialItem) return CATALOG_EDITOR_MODES.EDIT;
    if (sourceFile) return CATALOG_EDITOR_MODES.EDIT;
    return CATALOG_EDITOR_MODES.CREATE;
}

export function getCatalogEditorSourceFile({ formData = {}, initialItem = {}, baseEntry = {} } = {}) {
    formData = formData || {};
    initialItem = initialItem || {};
    baseEntry = baseEntry || {};
    return firstString([
        formData.sourceFile,
        initialItem.sourceFile,
        initialItem.overrideSourceFile,
        baseEntry.sourceFile,
        baseEntry.overrideSourceFile,
    ]);
}

export function buildCatalogEditorOverride(catalogType, payload = {}, {
    formData = {},
    initialItem = null,
    baseEntry = null,
    editorMode = null,
    id = null,
    label = null,
} = {}) {
    const sourceFile = getCatalogEditorSourceFile({ formData, initialItem, baseEntry });
    const mode = resolveCatalogEditorMode({ editorMode, initialItem, sourceFile });
    const base = baseEntry || initialItem || {};
    const baseId = getCatalogEntryBaseId(base);
    const recordLabel = label || payload?.name || formData?.name || base?.name || catalogType;

    if (mode === CATALOG_EDITOR_MODES.EDIT && sourceFile) {
        return buildEditOverride(catalogType, { ...base, sourceFile }, payload, {
            id: initialItem?.catalogOverrideId || id || buildCatalogOverrideId(catalogType, sourceFile),
            baseId: sourceFile,
        });
    }

    if (mode === CATALOG_EDITOR_MODES.EDIT && baseId && !base?.isCustom) {
        return buildEditOverride(catalogType, base, payload, {
            id: initialItem?.catalogOverrideId || id || buildCatalogOverrideId(catalogType, baseId),
            baseId,
        });
    }

    const customId = mode === CATALOG_EDITOR_MODES.CLONE
        ? id || buildCatalogOverrideId(catalogType, `${recordLabel}_${Date.now()}`)
        : initialItem?.catalogOverrideId || id || buildCatalogOverrideId(catalogType, payload?.id || payload?._id || recordLabel);

    return buildCloneOverride(catalogType, base, payload, { id: customId });
}

export function buildLegacyDbCatalogPayload(payload = {}, {
    id = null,
    sourceFile = null,
    isCustom = true,
} = {}) {
    const safeId = id || payload?._id || payload?.id || buildCatalogSafeId(payload?.name || 'catalog_entry');
    return {
        ...payload,
        id: payload?.id || safeId,
        _id: payload?._id || safeId,
        sourceFile,
        isCustom,
    };
}

export function getCatalogEditorInitialItem({ initialItem, initialPayload, baseEntry } = {}) {
    return initialPayload || initialItem || baseEntry || null;
}

export function isStaticCatalogEdit({ editorMode, initialItem, formData, baseEntry } = {}) {
    const sourceFile = getCatalogEditorSourceFile({ formData, initialItem, baseEntry });
    return resolveCatalogEditorMode({ editorMode, initialItem, sourceFile }) === CATALOG_EDITOR_MODES.EDIT && Boolean(sourceFile);
}

export function buildCatalogSafeId(value) {
    return String(value || 'catalog_entry')
        .trim()
        .replace(/[^a-z0-9_-]+/gi, '_')
        .replace(/^_+|_+$/g, '')
        .toLowerCase() || 'catalog_entry';
}

export function getCatalogEditorBaseId(entry) {
    return getCatalogEntryBaseId(entry);
}

function firstString(values) {
    return values.map((value) => String(value || '').trim()).find(Boolean) || '';
}
