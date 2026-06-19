import { buildCampaignViewModel, isSoftDeleted, splitActiveArchived } from '../domain/campaignReducers.js';

export function selectCampaignBuckets(db) {
    const activeEntries = [];
    const archivedEntries = [];
    Object.entries(db?.campaigns || {}).forEach(([id, campaign]) => {
        const viewModel = buildCampaignViewModel(campaign);
        if (isSoftDeleted(campaign)) archivedEntries.push([id, viewModel]);
        else activeEntries.push([id, viewModel]);
    });
    return {
        campaigns: Object.fromEntries(activeEntries),
        archivedCampaigns: Object.fromEntries(archivedEntries),
    };
}

export function selectTargetCampaignId({ campaigns, isGM, selectedCampaignId, userInfo }) {
    if (isGM) {
        return campaigns?.[selectedCampaignId] ? selectedCampaignId : Object.keys(campaigns || {})[0];
    }
    if (campaigns?.[userInfo?.campaignId]) return userInfo.campaignId;
    return campaigns?.[selectedCampaignId] ? selectedCampaignId : null;
}

export function selectActiveCampaign(campaigns, campaignId) {
    return campaigns?.[campaignId] || null;
}

export function selectRootFallbackList(db, field, campaignId = null) {
    const campaign = campaignId ? db?.campaigns?.[campaignId] : Object.values(db?.campaigns || {})[0];
    const campaignValues = Array.isArray(campaign?.[field]) ? campaign[field] : [];
    if (campaignValues.length > 0) return campaignValues;
    return Array.isArray(db?.[field]) ? db[field] : [];
}

function selectCampaignScopedList(db, activeCampaign, field, archivedField, campaignId = null) {
    const rawCampaign = activeCampaign || (campaignId ? db?.campaigns?.[campaignId] : null);
    const campaignValues = Array.isArray(rawCampaign?.[field]) ? rawCampaign[field] : [];
    const explicitArchived = Array.isArray(rawCampaign?.[archivedField]) ? rawCampaign[archivedField] : [];
    const campaignSplit = splitActiveArchived(campaignValues);
    const active = campaignSplit.active;
    const archived = explicitArchived.length > 0 ? explicitArchived : campaignSplit.archived;
    if (campaignValues.length > 0 || explicitArchived.length > 0) {
        return { active, archived };
    }

    const rootSplit = splitActiveArchived(Array.isArray(db?.[field]) ? db[field] : []);
    return { active: rootSplit.active, archived: rootSplit.archived };
}

export function selectQuestLists(db, activeCampaign, campaignId = null) {
    const { active, archived } = selectCampaignScopedList(db, activeCampaign, 'quests', 'archivedQuests', campaignId);
    return {
        quests: active,
        archivedQuests: archived,
        allQuests: [...active, ...archived],
    };
}

export function selectLootBagLists(db, activeCampaign, campaignId = null) {
    const { active, archived } = selectCampaignScopedList(db, activeCampaign, 'lootBags', 'archivedLootBags', campaignId);
    return {
        lootBags: active,
        archivedLootBags: archived,
        allLootBags: [...active, ...archived],
    };
}

export function selectCampaignChildLists(campaign) {
    return {
        characters: campaign?.characters || [],
        archivedCharacters: campaign?.archivedCharacters || [],
        quests: campaign?.quests || [],
        archivedQuests: campaign?.archivedQuests || [],
        lootBags: campaign?.lootBags || [],
        archivedLootBags: campaign?.archivedLootBags || [],
        encounters: campaign?.encounters || [],
        archivedEncounters: campaign?.archivedEncounters || [],
        maps: campaign?.maps || [],
        archivedMaps: campaign?.archivedMaps || [],
    };
}
