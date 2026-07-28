import { canMutateCampaignCatalogEntry } from '../../shared/auth/campaignCapabilities.js';

export function findLinkedCampaignCatalogEntry(entry, catalogEntries = {}) {
    const id = entry?.catalogEntryId || entry?.catalogOverrideId || null;
    if (!id) return null;
    if (Array.isArray(catalogEntries)) return catalogEntries.find(candidate => candidate?.id === id) || null;
    return catalogEntries?.[id] || null;
}

export function resolvePlayerCatalogEditorMode({ entry, catalogEntries, capabilities, userEmail }) {
    const campaignEntry = findLinkedCampaignCatalogEntry(entry, catalogEntries);
    const canEditLinkedEntry = campaignEntry
        ? canMutateCampaignCatalogEntry(capabilities, campaignEntry, userEmail)
        : false;
    return {
        campaignEntry,
        editorMode: canEditLinkedEntry ? 'edit' : 'clone',
    };
}

export function isPlayerCatalogEntryEditable({
    catalogType,
    entry,
    canAuthorCatalog,
    actorOwnedCustomOnly = false,
}) {
    if (!canAuthorCatalog || !entry || entry._wandOnly) return false;
    if (!actorOwnedCustomOnly) return ['item', 'spell', 'impulse'].includes(catalogType);
    return Boolean(entry._actorCatalogEditable || entry.isCustom);
}
