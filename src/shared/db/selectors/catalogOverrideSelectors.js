import {
    buildCatalogEntryStates,
    overrideToCatalogItem,
    selectDeletedCatalogEntriesFromStates,
    selectVisibleCatalogEntriesFromStates,
} from '../../catalog/catalogEntryModel.js';

export { overrideToCatalogItem } from '../../catalog/catalogEntryModel.js';

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

export function selectCatalogEntryStates(staticItems = [], source, catalogType) {
    return buildCatalogEntryStates({
        staticItems,
        overrides: selectCatalogOverrides(source, catalogType),
        catalogType,
    });
}

export function selectVisibleCatalogEntries(staticItems = [], source, catalogType) {
    return selectVisibleCatalogEntriesFromStates(selectCatalogEntryStates(staticItems, source, catalogType));
}

export function selectDeletedCatalogEntries(staticItems = [], source, catalogType) {
    return selectDeletedCatalogEntriesFromStates(selectCatalogEntryStates(staticItems, source, catalogType));
}

export function mergeCatalogIndexWithOverrides(staticItems = [], source, catalogType) {
    return selectVisibleCatalogEntries(staticItems, source, catalogType);
}
