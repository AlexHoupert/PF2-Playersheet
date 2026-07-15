import { buildCampaignViewModel, splitActiveArchived } from "../domain/campaignReducers.js";
import { actorToCharacterView } from "../selectors/characterSelectors.js";
import { selectCatalogOverrideEntries } from "../selectors/catalogOverrideSelectors.js";
import { V2_COLLECTIONS } from "./schema.js";

export function composeRuntimeDbFromV2Store(v2Store = {}) {
    const db = {
        campaigns: {},
        users: {},
        actors: [],
        actorEffects: [],
        effectTemplates: [],
        catalogOverrides: { ...(v2Store.catalogOverrides || {}) },
        characters: [],
        quests: [],
        lootBags: [],
        shop: {
            availableItems: [],
            availableFormulas: [],
            traders: [],
            customItems: {},
            ...(v2Store.global?.shop || {}),
        },
        bestiary: {
            creatures: {},
            customCreatures: {},
            ...(v2Store.global?.bestiary || {}),
        },
        lore: {
            ...(v2Store.global?.lore || {}),
            // Lore articles live in their own V2 collection. A stale legacy
            // global/config.lore.articles array must never hide those records.
            articles: Object.values(v2Store.loreArticles || {}),
        },
        actions: { ...(v2Store.global?.actions || {}) },
        pacts: { ...(v2Store.global?.pacts || {}) },
        abilities: {
            custom: {},
            deviant: {},
            ...(v2Store.global?.abilities || {}),
        },
        notificationQueue: Array.isArray(v2Store.global?.notificationQueue)
            ? v2Store.global.notificationQueue
            : [],
        rules: v2Store.global?.rules || {},
        library: v2Store.global?.library || {},
        runes: v2Store.global?.runes || {},
        feats: v2Store.global?.feats || {},
    };

    for (const [campaignId, rawCampaign] of Object.entries(v2Store.campaigns || {})) {
        const campaign = campaignFromV2StoreCampaign(rawCampaign, campaignId);
        db.campaigns[campaignId] = campaign;
        db.actors.push(...(campaign.actors || []));
        db.actorEffects.push(...(campaign.actorEffects || []));
        db.effectTemplates.push(...(campaign.effectTemplates || []));

        for (const member of Object.values(rawCampaign[V2_COLLECTIONS.members] || {})) {
            const email = normalizeEmail(member.email || member.id);
            if (!email) continue;
            db.users[email] = {
                ...member,
                role: member.role || "player",
                campaignId,
                characterId: member.characterId || member.assignedCharacterId || member.assignedActorId || member.actorId || null,
                actorId: member.assignedActorId || member.actorId || member.characterId || null,
                assignedActorId: member.assignedActorId || member.actorId || member.characterId || null,
            };
        }
    }

    for (const [key, item] of Object.entries(v2Store.customItems || {})) {
        db.shop.customItems[item.name || key] = item.data || item;
    }
    for (const [key, creature] of Object.entries(v2Store.customCreatures || {})) {
        db.bestiary.customCreatures[creature.id || key] = creature;
    }
    for (const [key, action] of Object.entries(v2Store.customActions || {})) {
        db.actions[action.name || key] = action;
    }
    projectCatalogOverridesIntoCompatibilityDb(db);
    return db;
}

export function campaignFromV2StoreCampaign(rawCampaign = {}, campaignId = rawCampaign.id) {
    const actors = valuesOrList(rawCampaign, V2_COLLECTIONS.actors, "actorsList");
    const actorEffects = valuesOrList(rawCampaign, V2_COLLECTIONS.actorEffects, "actorEffectsList");
    const effectTemplates = valuesOrList(rawCampaign, V2_COLLECTIONS.effectTemplates, "effectTemplatesList");
    const pcActors = actors.filter(actor => actor?.kind === "pc");
    const characterRows = pcActors.map(actorToCharacterView);

    const campaign = {
        ...rawCampaign,
        id: rawCampaign.id || campaignId,
        actors,
        actorEffects,
        effectTemplates,
        characters: characterRows,
        quests: valuesOrList(rawCampaign, V2_COLLECTIONS.quests, "questsList"),
        lootBags: valuesOrList(rawCampaign, V2_COLLECTIONS.lootBags, "lootBagsList"),
        encounters: valuesOrList(rawCampaign, V2_COLLECTIONS.encounters, "encountersList"),
        maps: valuesOrList(rawCampaign, V2_COLLECTIONS.maps, "mapsList"),
        loreArticles: valuesOrList(rawCampaign, V2_COLLECTIONS.loreArticles, "loreArticlesList"),
        loreGroups: valuesOrList(rawCampaign, V2_COLLECTIONS.loreGroups, "loreGroupsList"),
        loreDeliveries: valuesOrList(rawCampaign, V2_COLLECTIONS.loreDeliveries, "loreDeliveriesList"),
        knowledgeNotes: valuesOrList(rawCampaign, V2_COLLECTIONS.knowledgeNotes, "knowledgeNotesList"),
        members: rawCampaign[V2_COLLECTIONS.members] || {},
        membersList: valuesOrList(rawCampaign, V2_COLLECTIONS.members, "membersList"),
    };

    const viewModel = buildCampaignViewModel(campaign);
    const actorSplit = splitActiveArchived(actors);
    const effectTemplateSplit = splitActiveArchived(effectTemplates);
    viewModel.actors = actorSplit.active;
    viewModel.archivedActors = actorSplit.archived;
    viewModel.actorEffects = actorEffects;
    viewModel.effectTemplates = effectTemplateSplit.active;
    viewModel.archivedEffectTemplates = effectTemplateSplit.archived;
    return viewModel;
}

function valuesOrList(record, collectionName, listName) {
    if (Array.isArray(record?.[listName])) return record[listName];
    return Object.values(record?.[collectionName] || {});
}

function normalizeEmail(email) {
    return String(email || "").trim().toLowerCase();
}

function projectCatalogOverridesIntoCompatibilityDb(db) {
    for (const item of selectCatalogOverrideEntries(db, "item")) {
        db.shop.customItems[item.name || item.id] = item;
    }
    for (const action of selectCatalogOverrideEntries(db, "action")) {
        db.actions[action.name || action.id] = action;
    }
    for (const ability of selectCatalogOverrideEntries(db, "ability")) {
        db.abilities.custom[ability.id || ability.name] = ability;
    }
    for (const creature of selectCatalogOverrideEntries(db, "creature")) {
        db.bestiary.customCreatures[creature.id || creature.name] = creature;
    }
}
