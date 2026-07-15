export const V2_SCHEMA_VERSION = 4;

export const V2_COLLECTIONS = {
    campaigns: 'campaigns',
    actors: 'actors',
    actorEffects: 'actorEffects',
    characters: 'characters',
    quests: 'quests',
    lootBags: 'lootBags',
    encounters: 'encounters',
    maps: 'maps',
    members: 'members',
    loreArticles: 'loreArticles',
    loreGroups: 'loreGroups',
    loreDeliveries: 'loreDeliveries',
    knowledgeNotes: 'knowledgeNotes',
    customItems: 'customItems',
    customCreatures: 'customCreatures',
    customActions: 'customActions',
    effectTemplates: 'effectTemplates',
    catalogOverrides: 'catalogOverrides',
    global: 'global',
    migrationBackups: 'migrationBackups',
};

export const V2_GLOBAL_CONFIG_PATH = `${V2_COLLECTIONS.global}/config`;

export function campaignPath(campaignId) {
    return `${V2_COLLECTIONS.campaigns}/${campaignId}`;
}

export function campaignSubPath(campaignId, collectionName, docId) {
    return `${campaignPath(campaignId)}/${collectionName}/${docId}`;
}
