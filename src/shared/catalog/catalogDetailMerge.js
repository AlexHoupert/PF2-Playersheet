export function mergeCatalogDetailIntoEntry(detail = {}, entry = {}) {
    return mergePreferNonEmpty(detail || {}, entry || {});
}

export function mergeCreatureDetailIntoEntry(detail = null, creature = {}) {
    if (!detail) return { ...(creature || {}) };
    const currentData = creature?.data || {};
    const mergedData = mergeCatalogDetailIntoEntry(detail, currentData);
    return mergeCatalogDetailIntoEntry({ data: mergedData }, creature);
}

export function isEmptyCatalogDetailValue(value) {
    if (value === undefined || value === null) return true;
    if (typeof value === 'string') return value.trim() === '';
    if (Array.isArray(value)) return value.length === 0;
    if (isPlainObject(value)) return Object.keys(value).length === 0;
    return false;
}

function mergePreferNonEmpty(base, override) {
    if (isEmptyCatalogDetailValue(override)) return cloneValue(base);
    if (isEmptyCatalogDetailValue(base)) return cloneValue(override);

    if (Array.isArray(base) || Array.isArray(override)) {
        return Array.isArray(override) && override.length > 0 ? cloneValue(override) : cloneValue(base);
    }

    if (isPlainObject(base) && isPlainObject(override)) {
        const next = {};
        const keys = new Set([...Object.keys(base), ...Object.keys(override)]);
        for (const key of keys) {
            next[key] = mergePreferNonEmpty(base[key], override[key]);
        }
        return next;
    }

    return cloneValue(override);
}

function cloneValue(value) {
    if (value === undefined || value === null) return value;
    if (Array.isArray(value)) return value.map(cloneValue);
    if (isPlainObject(value)) {
        return Object.fromEntries(Object.entries(value).map(([key, nested]) => [key, cloneValue(nested)]));
    }
    return value;
}

function isPlainObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
