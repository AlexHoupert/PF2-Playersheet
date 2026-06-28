// LEGACY IMPORT/BACKUP/TEST ONLY.
// Normal runtime consumes V2 viewmodels. This projection exists only for
// migration verification and explicit compatibility checks.
import { V2_COLLECTIONS, V2_GLOBAL_CONFIG_PATH } from './schema.js';
import { normalizeCharacterRuntimeShape } from '../domain/characterShape.js';

export function composeLegacyDbFromV2Documents(documents, baseDb = {}) {
    const db = {
        ...cloneJson(baseDb || {}),
        campaigns: {},
        users: {},
        actors: [],
        actorEffects: [],
        effectTemplates: [],
        catalogOverrides: {},
        characters: [],
        quests: [],
        lootBags: [],
        shop: {
            availableItems: [],
            availableFormulas: [],
            traders: [],
            customItems: {},
            ...(baseDb?.shop || {}),
        },
        bestiary: {
            creatures: {},
            customCreatures: {},
            ...(baseDb?.bestiary || {}),
        },
        lore: {
            articles: [],
            ...(baseDb?.lore || {}),
        },
        actions: {},
        pacts: {},
        abilities: {
            custom: {},
            deviant: {},
            ...(baseDb?.abilities || {}),
        },
    };

    const ensureCampaign = (campaignId) => {
        if (!db.campaigns[campaignId]) {
            db.campaigns[campaignId] = {
                id: campaignId,
                name: campaignId,
                characters: [],
                actors: [],
                actorEffects: [],
                effectTemplates: [],
                quests: [],
                lootBags: [],
                encounters: [],
                maps: [],
            };
        }
        return db.campaigns[campaignId];
    };

    for (const entry of documents || []) {
        const path = entry.path || '';
        const data = stripV2Metadata(entry.data || {});
        const parts = path.split('/');

        if (path === V2_GLOBAL_CONFIG_PATH) {
            db.shop = { ...db.shop, ...(data.shop || {}) };
            db.bestiary = { ...db.bestiary, ...(data.bestiary || {}) };
            db.notificationQueue = Array.isArray(data.notificationQueue) ? data.notificationQueue : [];
            db.rules = data.rules || {};
            db.library = data.library || {};
            db.runes = data.runes || {};
            db.feats = data.feats || {};
            db.pacts = data.pacts || {};
            db.abilities = {
                ...(db.abilities || {}),
                ...(data.abilities || {}),
                custom: data.abilities?.custom || db.abilities?.custom || {},
                deviant: data.abilities?.deviant || db.abilities?.deviant || {},
            };
            continue;
        }

        if (parts[0] === V2_COLLECTIONS.campaigns && parts.length === 2) {
            const campaign = ensureCampaign(parts[1]);
            db.campaigns[parts[1]] = {
                ...campaign,
                ...data,
                id: parts[1],
                characters: campaign.characters || [],
                actors: campaign.actors || [],
                actorEffects: campaign.actorEffects || [],
                effectTemplates: campaign.effectTemplates || [],
                quests: campaign.quests || [],
                lootBags: campaign.lootBags || [],
                encounters: campaign.encounters || [],
                maps: campaign.maps || [],
            };
            continue;
        }

        if (parts[0] === V2_COLLECTIONS.campaigns && parts.length === 4) {
            const campaignId = parts[1];
            const collectionName = parts[2];
            const campaign = ensureCampaign(campaignId);
            if (collectionName === V2_COLLECTIONS.actors) {
                campaign.actors.push(data);
                db.actors.push(data);
            }
            if (collectionName === V2_COLLECTIONS.actorEffects) {
                campaign.actorEffects.push(data);
                db.actorEffects.push(data);
            }
            if (collectionName === V2_COLLECTIONS.effectTemplates) {
                campaign.effectTemplates.push(data);
                db.effectTemplates.push(data);
            }
            if (collectionName === V2_COLLECTIONS.characters) campaign.characters.push(data);
            if (collectionName === V2_COLLECTIONS.quests) campaign.quests.push(data);
            if (collectionName === V2_COLLECTIONS.lootBags) campaign.lootBags.push(data);
            if (collectionName === V2_COLLECTIONS.encounters) campaign.encounters.push(data);
            if (collectionName === V2_COLLECTIONS.maps) campaign.maps.push(data);
            if (collectionName === V2_COLLECTIONS.members && data.email) {
                db.users[data.email] = {
                    role: data.role || 'player',
                    campaignId,
                    characterId: data.characterId || null,
                    actorId: data.assignedActorId || data.actorId || data.characterId || null,
                };
            }
            continue;
        }

        if (parts[0] === V2_COLLECTIONS.catalogOverrides) {
            db.catalogOverrides[parts[1]] = data;
            continue;
        }

        if (parts[0] === V2_COLLECTIONS.customItems) {
            db.shop.customItems[data.name || parts[1]] = data.data || data;
            continue;
        }

        if (parts[0] === V2_COLLECTIONS.customCreatures) {
            db.bestiary.customCreatures[data.id || parts[1]] = data;
            continue;
        }

        if (parts[0] === V2_COLLECTIONS.customActions) {
            db.actions[data.name || parts[1]] = data;
            continue;
        }

        if (parts[0] === V2_COLLECTIONS.loreArticles) {
            db.lore.articles.push(data);
        }
    }

    for (const campaign of Object.values(db.campaigns)) {
        const effectsByActorId = groupByTargetActorId(campaign.actorEffects || []);
        const pcActors = Array.isArray(campaign.actors) ? campaign.actors.filter(actor => actor.kind === 'pc') : [];
        if (pcActors.length > 0) {
            campaign.characters = pcActors
                .map(actor => actorToLegacyCharacter(actor, effectsByActorId[actor.id] || []));
        } else {
            campaign.characters = (campaign.characters || []).map(character => {
                const effects = effectsByActorId[character.id] || [];
                if (effects.length === 0) return character;
                return {
                    ...character,
                    conditions: effects
                        .filter(effect => effect.category === 'condition' && !effect.disabled)
                        .map(effect => ({
                            id: effect.id,
                            name: effect.label,
                            level: numberOr(effect.value, 1),
                            hidden: effect.hidden || undefined,
                            disabled: effect.disabled || undefined,
                        })),
                };
            });
        }
        campaign.characters.sort(sortByNameThenId);
        campaign.actors.sort(sortByNameThenId);
        campaign.actorEffects.sort(sortByNameThenId);
        campaign.effectTemplates.sort(sortByNameThenId);
        campaign.quests.sort(sortByTitleThenId);
        campaign.lootBags.sort(sortByNameThenId);
        campaign.encounters.sort(sortByNameThenId);
        campaign.maps.sort(sortByOrderNameId);
    }

    const firstCampaign = Object.values(db.campaigns)[0];
    db.quests = firstCampaign?.quests || [];
    db.lootBags = firstCampaign?.lootBags || [];
    return db;
}

function groupByTargetActorId(effects) {
    return effects.reduce((acc, effect) => {
        const key = effect.targetActorId;
        if (!key) return acc;
        if (!acc[key]) acc[key] = [];
        acc[key].push(effect);
        return acc;
    }, {});
}

function actorToLegacyCharacter(actor, effects = []) {
    const sheet = actor.sheet || {};
    const stats = actor.stats || sheet.stats || {};
    const magic = actor.magic || sheet.magic || {};
    return normalizeCharacterRuntimeShape({
        ...sheet,
        id: actor.id,
        name: actor.name,
        level: actor.level,
        campaignId: actor.campaignId,
        stats,
        inventory: actor.inventory || sheet.inventory || [],
        magic,
        deletedAt: actor.deletedAt,
        deletedBy: actor.deletedBy,
        restoredAt: actor.restoredAt,
        restoredBy: actor.restoredBy,
        conditions: effects
            .filter(effect => effect.category === 'condition' && !effect.disabled)
            .map(effect => ({
                id: effect.id,
                name: effect.label,
                level: numberOr(effect.value, 1),
                hidden: effect.hidden || undefined,
                disabled: effect.disabled || undefined,
            })),
    });
}

function stripV2Metadata(data) {
    const clone = cloneJson(data || {});
    delete clone._v2;
    delete clone.updatedAt;
    return clone;
}

function cloneJson(value) {
    if (value === undefined) return value;
    return JSON.parse(JSON.stringify(value));
}

function numberOr(value, fallback) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}

function sortByNameThenId(a, b) {
    return String(a.name || '').localeCompare(String(b.name || '')) || String(a.id || '').localeCompare(String(b.id || ''));
}

function sortByOrderNameId(a, b) {
    return (Number(a.order) || 0) - (Number(b.order) || 0) || sortByNameThenId(a, b);
}

function sortByTitleThenId(a, b) {
    return String(a.title || '').localeCompare(String(b.title || '')) || String(a.id || '').localeCompare(String(b.id || ''));
}
