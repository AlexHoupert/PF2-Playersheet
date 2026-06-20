export function selectCatalogOverrides(source, catalogType = null) {
    const overrides = source?.catalogOverrides || {};
    return Object.values(overrides)
        .filter(Boolean)
        .filter((override) => !catalogType || override.catalogType === catalogType);
}

export function selectCatalogOverrideEntries(source, catalogType) {
    return selectCatalogOverrides(source, catalogType)
        .filter((override) => override.mode !== "hide")
        .map(overrideToCatalogItem)
        .filter((item) => item?.name);
}

export function mergeCatalogIndexWithOverrides(staticItems = [], source, catalogType) {
    const overrides = selectCatalogOverrides(source, catalogType);
    if (!overrides.length) return [...staticItems];

    const hiddenKeys = new Set();
    const overridesByKey = new Map();
    const customEntries = [];
    const matchedOverrides = new Set();

    for (const override of overrides) {
        const keys = catalogOverrideKeys(override);
        if (override.mode === "hide") {
            keys.forEach((key) => hiddenKeys.add(key));
            continue;
        }
        if (override.mode === "override") {
            keys.forEach((key) => overridesByKey.set(key, override));
            continue;
        }
        customEntries.push(overrideToCatalogItem(override));
    }

    const merged = [];
    for (const item of staticItems) {
        const keys = catalogItemKeys(item);
        if (keys.some((key) => hiddenKeys.has(key))) continue;
        const override = keys.map((key) => overridesByKey.get(key)).find(Boolean);
        if (override) {
            matchedOverrides.add(override.id);
            merged.push({
                ...item,
                ...overrideToCatalogItem(override),
                isOverride: true,
            });
        } else {
            merged.push(item);
        }
    }

    for (const override of overrides) {
        if (override.mode !== "override" || matchedOverrides.has(override.id)) continue;
        merged.push(overrideToCatalogItem(override));
    }

    for (const entry of customEntries) {
        if (entry?.name) merged.push(entry);
    }

    return merged;
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
        isCustom: override?.mode === "custom" || Boolean(base.isCustom),
        isOverride: override?.mode === "override",
    };
}

function catalogOverrideKeys(override) {
    const payload = override?.payload || {};
    return normalizeKeys([
        override?.id,
        override?.baseId,
        override?.label,
        payload.id,
        payload._id,
        payload.name,
        payload.sourceFile,
        payload.overrideSourceFile,
    ]);
}

function catalogItemKeys(item) {
    return normalizeKeys([
        item?.id,
        item?._id,
        item?.name,
        item?.sourceFile,
        item?.overrideSourceFile,
    ]);
}

function normalizeKeys(values) {
    const keys = new Set();
    for (const value of values) {
        const raw = String(value || "").trim();
        if (!raw) continue;
        keys.add(raw);
        keys.add(raw.toLowerCase());
        keys.add(raw.replace(/^ressources\//, ""));
        keys.add(raw.replace(/^ressources\//, "").toLowerCase());
        keys.add(raw.replace(/[^a-z0-9_-]+/gi, "_").replace(/^_+|_+$/g, "").toLowerCase());
    }
    return [...keys].filter(Boolean);
}
