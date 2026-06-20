import { V2_COLLECTIONS, V2_GLOBAL_CONFIG_PATH } from "./schema.js";

export function composeV2ViewModelFromDocuments(documents = []) {
    const view = {
        campaigns: {},
        global: {},
        catalogOverrides: {},
        customItems: {},
        customCreatures: {},
        customActions: {},
        loreArticles: {},
        documentCount: 0,
    };

    for (const entry of documents || []) {
        const path = entry.path || "";
        const data = stripRuntimeMetadata(entry.data || {});
        const parts = path.split("/").filter(Boolean);
        view.documentCount += 1;

        if (path === V2_GLOBAL_CONFIG_PATH) {
            view.global = data;
            continue;
        }

        if (parts[0] === V2_COLLECTIONS.campaigns && parts.length === 2) {
            view.campaigns[parts[1]] = {
                ...ensureCampaign(view, parts[1]),
                ...data,
                id: parts[1],
            };
            continue;
        }

        if (parts[0] === V2_COLLECTIONS.campaigns && parts.length === 4) {
            const campaign = ensureCampaign(view, parts[1]);
            const collectionName = parts[2];
            const docId = parts[3];
            if (!campaign[collectionName]) campaign[collectionName] = {};
            campaign[collectionName][docId] = { ...data, id: data.id || docId };
            continue;
        }

        if (parts[0] === V2_COLLECTIONS.catalogOverrides) {
            view.catalogOverrides[parts[1]] = { ...data, id: data.id || parts[1] };
            continue;
        }

        if (parts[0] === V2_COLLECTIONS.customItems) {
            view.customItems[parts[1]] = { ...data, id: data.id || parts[1] };
            continue;
        }

        if (parts[0] === V2_COLLECTIONS.customCreatures) {
            view.customCreatures[parts[1]] = { ...data, id: data.id || parts[1] };
            continue;
        }

        if (parts[0] === V2_COLLECTIONS.customActions) {
            view.customActions[parts[1]] = { ...data, id: data.id || parts[1] };
            continue;
        }

        if (parts[0] === V2_COLLECTIONS.loreArticles) {
            view.loreArticles[parts[1]] = { ...data, id: data.id || parts[1] };
        }
    }

    for (const campaign of Object.values(view.campaigns)) {
        campaign.actorsList = sortByName(Object.values(campaign[V2_COLLECTIONS.actors] || {}));
        campaign.actorEffectsList = sortByName(Object.values(campaign[V2_COLLECTIONS.actorEffects] || {}));
        campaign.effectTemplatesList = sortByName(Object.values(campaign[V2_COLLECTIONS.effectTemplates] || {}));
        campaign.questsList = sortByTitle(Object.values(campaign[V2_COLLECTIONS.quests] || {}));
        campaign.lootBagsList = sortByName(Object.values(campaign[V2_COLLECTIONS.lootBags] || {}));
        campaign.encountersList = sortByName(Object.values(campaign[V2_COLLECTIONS.encounters] || {}));
        campaign.mapsList = Object.values(campaign[V2_COLLECTIONS.maps] || {}).sort(sortByOrderNameId);
        campaign.membersList = Object.values(campaign[V2_COLLECTIONS.members] || {}).sort((a, b) =>
            String(a.email || a.id || "").localeCompare(String(b.email || b.id || ""))
        );
    }

    return view;
}

function ensureCampaign(view, campaignId) {
    if (!view.campaigns[campaignId]) {
        view.campaigns[campaignId] = {
            id: campaignId,
            [V2_COLLECTIONS.actors]: {},
            [V2_COLLECTIONS.actorEffects]: {},
            [V2_COLLECTIONS.effectTemplates]: {},
            [V2_COLLECTIONS.quests]: {},
            [V2_COLLECTIONS.lootBags]: {},
            [V2_COLLECTIONS.encounters]: {},
            [V2_COLLECTIONS.maps]: {},
            [V2_COLLECTIONS.members]: {},
        };
    }
    return view.campaigns[campaignId];
}

function stripRuntimeMetadata(data) {
    const next = { ...data };
    delete next.schemaVersion;
    delete next.migration;
    return next;
}

function sortByName(records) {
    return records.sort((a, b) =>
        String(a.name || a.label || "").localeCompare(String(b.name || b.label || "")) ||
        String(a.id || "").localeCompare(String(b.id || ""))
    );
}

function sortByTitle(records) {
    return records.sort((a, b) =>
        String(a.title || "").localeCompare(String(b.title || "")) ||
        String(a.id || "").localeCompare(String(b.id || ""))
    );
}

function sortByOrderNameId(a, b) {
    const orderA = Number.isFinite(Number(a?.order)) ? Number(a.order) : Number.MAX_SAFE_INTEGER;
    const orderB = Number.isFinite(Number(b?.order)) ? Number(b.order) : Number.MAX_SAFE_INTEGER;
    return orderA - orderB || String(a.name || "").localeCompare(String(b.name || "")) ||
        String(a.id || "").localeCompare(String(b.id || ""));
}
