import conditionsCatalog from '../../data/conditions_catalog.json';

const CONDITIONS_CATALOG_BY_LOWER = new Map(
    Object.entries(conditionsCatalog).map(([name, entry]) => [name.toLowerCase(), entry])
);

export function getConditionCatalogEntry(conditionName) {
    if (!conditionName) return null;
    const key = String(conditionName);
    return conditionsCatalog[key] || CONDITIONS_CATALOG_BY_LOWER.get(key.toLowerCase()) || null;
}

export function getConditionImgSrc(conditionName) {
    const entry = getConditionCatalogEntry(conditionName);
    if (!entry?.img) return null;
    return `ressources/${entry.img}`;
}

export function isConditionValued(conditionName) {
    const entry = getConditionCatalogEntry(conditionName);
    if (entry && typeof entry.isValued === 'boolean') return entry.isValued;
    return true;
}

export { conditionsCatalog };
