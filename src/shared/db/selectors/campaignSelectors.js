import { buildCampaignViewModel, isSoftDeleted } from '../domain/campaignReducers.js';

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

export function selectCampaignChildLists(campaign) {
    return {
        characters: campaign?.characters || [],
        archivedCharacters: campaign?.archivedCharacters || [],
        quests: campaign?.quests || [],
        archivedQuests: campaign?.archivedQuests || [],
        lootBags: campaign?.lootBags || [],
        encounters: campaign?.encounters || [],
        archivedEncounters: campaign?.archivedEncounters || [],
        maps: campaign?.maps || [],
        archivedMaps: campaign?.archivedMaps || [],
    };
}
