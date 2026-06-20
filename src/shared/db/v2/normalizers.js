import { V2_COLLECTIONS, V2_GLOBAL_CONFIG_PATH, V2_SCHEMA_VERSION, campaignPath, campaignSubPath } from './schema.js';
import { normalizeCharacterRuntimeShape } from '../domain/characterShape.js';

const MASTER_SOURCE = 'data/master';

export function normalizeMasterToV2(masterDb, options = {}) {
    const sourceDb = cloneJson(masterDb || {});
    const nowMs = options.now ?? Date.now();
    const nowIso = new Date(nowMs).toISOString();
    const migrationId = options.migrationId || `migration_${nowIso.replace(/[:.]/g, '-')}`;
    const report = createReport(migrationId, nowIso);
    const documents = [];

    const addDocument = (path, type, data) => {
        documents.push({
            path,
            type,
            data: cleanForFirestore(stampDocument(data, nowIso, migrationId)),
        });
        report.counts[type] = (report.counts[type] || 0) + 1;
    };

    const campaignEntries = normalizeCampaignEntries(sourceDb, report, nowMs);
    const rootQuests = Array.isArray(sourceDb.quests) ? sourceDb.quests : [];
    const rootLootBags = Array.isArray(sourceDb.lootBags) ? sourceDb.lootBags : [];

    if (rootQuests.length > 0) {
        const target = selectLegacyCampaignTarget(campaignEntries, report, 'quests');
        target.campaign.quests = mergeById(target.campaign.quests || [], rootQuests);
        report.movedFields.push({ from: 'quests', to: `campaigns.${target.id}.quests`, count: rootQuests.length });
    }

    if (rootLootBags.length > 0) {
        const target = selectLegacyCampaignTarget(campaignEntries, report, 'lootBags');
        target.campaign.lootBags = mergeById(target.campaign.lootBags || [], rootLootBags);
        report.movedFields.push({ from: 'lootBags', to: `campaigns.${target.id}.lootBags`, count: rootLootBags.length });
    }

    for (const [campaignId, campaign] of campaignEntries) {
        const normalizedCampaign = normalizeCampaign(campaign, campaignId, report);
        addDocument(campaignPath(campaignId), 'campaigns', normalizedCampaign.meta);

        normalizedCampaign.characters.forEach((character, index) => {
            const characterId = safeDocId(character.id || character.name || `character_${index}`, `character_${index}`);
            const normalizedCharacter = { ...character, id: characterId, campaignId };
            addDocument(
                campaignSubPath(campaignId, V2_COLLECTIONS.characters, characterId),
                'characters',
                normalizedCharacter
            );

            const actor = characterToActor(normalizedCharacter, campaignId);
            addDocument(
                campaignSubPath(campaignId, V2_COLLECTIONS.actors, actor.id),
                'actors',
                actor
            );

            buildConditionEffects({
                campaignId,
                targetActorId: actor.id,
                conditions: character.conditions,
                path: `campaigns.${campaignId}.characters.${index}.conditions`,
                report,
            }).forEach(effect => {
                addDocument(
                    campaignSubPath(campaignId, V2_COLLECTIONS.actorEffects, effect.id),
                    'actorEffects',
                    effect
                );
            });

            const companionActor = companionToActor(character.companion, normalizedCharacter, campaignId);
            if (companionActor) {
                addDocument(
                    campaignSubPath(campaignId, V2_COLLECTIONS.actors, companionActor.id),
                    'actors',
                    companionActor
                );
                buildConditionEffects({
                    campaignId,
                    targetActorId: companionActor.id,
                    conditions: character.companion?.conditions,
                    path: `campaigns.${campaignId}.characters.${index}.companion.conditions`,
                    report,
                }).forEach(effect => {
                    addDocument(
                        campaignSubPath(campaignId, V2_COLLECTIONS.actorEffects, effect.id),
                        'actorEffects',
                        effect
                    );
                });
            }
        });

        normalizedCampaign.quests.forEach((quest, index) => {
            const questId = safeDocId(quest.id || quest.title || `quest_${index}`, `quest_${index}`);
            addDocument(
                campaignSubPath(campaignId, V2_COLLECTIONS.quests, questId),
                'quests',
                { ...quest, id: questId, campaignId }
            );
        });

        normalizedCampaign.lootBags.forEach((lootBag, index) => {
            const lootBagId = safeDocId(lootBag.id || lootBag.name || `loot_${index}`, `loot_${index}`);
            addDocument(
                campaignSubPath(campaignId, V2_COLLECTIONS.lootBags, lootBagId),
                'lootBags',
                { ...normalizeLootBag(lootBag, report), id: lootBagId, campaignId }
            );
        });

        normalizedCampaign.encounters.forEach((encounter, index) => {
            const encounterId = safeDocId(encounter.id || encounter.name || `encounter_${index}`, `encounter_${index}`);
            addDocument(
                campaignSubPath(campaignId, V2_COLLECTIONS.encounters, encounterId),
                'encounters',
                { ...encounter, id: encounterId, campaignId }
            );
        });

        normalizedCampaign.maps.forEach((map, index) => {
            const mapId = safeDocId(map.id || map.name || `map_${index}`, `map_${index}`);
            addDocument(
                campaignSubPath(campaignId, V2_COLLECTIONS.maps, mapId),
                'maps',
                { ...map, id: mapId, campaignId }
            );
        });
    }

    addMembers(sourceDb.users || {}, campaignEntries, addDocument, report);
    addGlobalDocuments(sourceDb, addDocument, report);

    report.totalDocuments = documents.length;
    return { schemaVersion: V2_SCHEMA_VERSION, migrationId, generatedAt: nowIso, documents, report };
}

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
        if ((!campaign.characters || campaign.characters.length === 0) && Array.isArray(campaign.actors)) {
            campaign.characters = campaign.actors
                .filter(actor => actor.kind === 'pc')
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

export function safeDocId(value, fallback = 'doc') {
    const raw = String(value ?? '').trim();
    if (!raw) return fallback;
    return raw.replace(/\//g, '_').replace(/^\.+$/, fallback).slice(0, 1400) || fallback;
}

export function cleanForFirestore(value) {
    if (Array.isArray(value)) {
        return value.map(cleanForFirestore).filter(v => v !== undefined);
    }
    if (value && typeof value === 'object') {
        const out = {};
        for (const [key, child] of Object.entries(value)) {
            if (child === undefined) continue;
            const cleaned = cleanForFirestore(child);
            if (cleaned !== undefined) out[key] = cleaned;
        }
        return out;
    }
    return value === undefined ? null : value;
}

function normalizeCampaignEntries(db, report, nowMs) {
    const entries = Object.entries(db.campaigns && typeof db.campaigns === 'object' ? db.campaigns : {});
    if (entries.length > 0) {
        return entries.map(([id, campaign]) => [safeDocId(campaign?.id || id, id), { ...cloneJson(campaign), id: safeDocId(campaign?.id || id, id) }]);
    }

    const rootCharacters = Array.isArray(db.characters) ? db.characters : [];
    const rootQuests = Array.isArray(db.quests) ? db.quests : [];
    const rootLootBags = Array.isArray(db.lootBags) ? db.lootBags : [];
    const defaultId = 'campaign_default';
    report.fallbackAssumptions.push({
        field: 'campaigns',
        assumption: 'No campaigns object existed; created campaign_default from root legacy data.',
    });
    return [[defaultId, {
        id: defaultId,
        name: 'Default Campaign',
        createdAt: nowMs,
        characters: rootCharacters,
        quests: rootQuests,
        lootBags: rootLootBags,
        maps: [],
        encounters: [],
    }]];
}

function normalizeCampaign(campaign, campaignId, report) {
    const meta = { ...campaign, id: campaignId };
    const characters = Array.isArray(meta.characters) ? meta.characters : [];
    const quests = Array.isArray(meta.quests) ? meta.quests : [];
    const lootBags = Array.isArray(meta.lootBags) ? meta.lootBags : [];
    const encounters = Array.isArray(meta.encounters) ? meta.encounters : [];
    const maps = Array.isArray(meta.maps) ? meta.maps : [];

    delete meta.characters;
    delete meta.quests;
    delete meta.lootBags;
    delete meta.encounters;
    delete meta.maps;

    return {
        meta,
        characters: characters.map((character, index) => normalizeCharacter(character, report, `campaigns.${campaignId}.characters.${index}`)),
        quests: quests.map((quest, index) => normalizeQuest(quest, report, `campaigns.${campaignId}.quests.${index}`)),
        lootBags,
        encounters,
        maps,
    };
}

function normalizeCharacter(character, report, path) {
    const source = character || {};
    const hasLegacyRootHp = source.hp && !(source.stats && typeof source.stats === 'object' && source.stats.hp);
    const next = normalizeCharacterRuntimeShape(source);
    next.id = safeDocId(next.id || next.name || path.split('.').pop(), `character_${path.split('.').pop()}`);
    next.name = next.name || 'Unnamed Character';
    next.level = numberOr(next.level, 1);
    next.stats = next.stats && typeof next.stats === 'object' ? next.stats : {};

    if (hasLegacyRootHp) {
        next.stats.hp = normalizeHp(source.hp);
        delete next.hp;
        report.renamedFields.push({ from: `${path}.hp`, to: `${path}.stats.hp` });
    } else if (next.stats.hp) {
        next.stats.hp = normalizeHp(next.stats.hp);
    }

    next.conditions = normalizeConditions(next.conditions || [], report, `${path}.conditions`);
    next.inventory = normalizeInventory(next.inventory || [], report, `${path}.inventory`);
    next.weapons = normalizeInventory(next.weapons || [], report, `${path}.weapons`);
    next.armor = normalizeInventory(next.armor || [], report, `${path}.armor`);

    if (Array.isArray(next.proficiencies)) {
        const profs = {};
        next.proficiencies.forEach(entry => {
            const name = entry?.name;
            if (name) profs[name] = numberOr(entry.prof, 0);
        });
        next.proficiencies = profs;
        report.renamedFields.push({ from: `${path}.proficiencies[]`, to: `${path}.proficiencies{}` });
    }

    return next;
}

function normalizeQuest(quest, report, path) {
    const next = cloneJson(quest || {});
    next.id = safeDocId(next.id || next.title || path.split('.').pop(), `quest_${path.split('.').pop()}`);
    next.title = next.title || 'Untitled Quest';
    next.status = next.status || 'Active';
    next.objectives = Array.isArray(next.objectives) ? next.objectives : [];
    next.rewards = next.rewards && typeof next.rewards === 'object' ? next.rewards : { xp: 0, gold: 0, items: '', reputation: [] };
    next.subquests = Array.isArray(next.subquests) ? next.subquests : [];
    return next;
}

function normalizeLootBag(lootBag, report) {
    const next = cloneJson(lootBag || {});
    next.items = normalizeInventory(next.items || [], report, `lootBags.${next.id || next.name || 'unknown'}.items`);
    next.goldValue = numberOr(next.goldValue, 0);
    return next;
}

function normalizeInventory(items, report, path) {
    if (!Array.isArray(items)) {
        report.invalidValues.push({ path, issue: 'Expected array; replaced with empty array.' });
        return [];
    }
    return items.map((item, index) => {
        if (typeof item === 'string') {
            report.fallbackAssumptions.push({ field: `${path}.${index}`, assumption: 'String item converted to reference object.' });
            return {
                name: item,
                qty: 1,
                catalogRef: { type: 'item', name: item },
                instanceId: `${safeDocId(item, 'item')}_${index}`,
            };
        }

        const next = cloneJson(item || {});
        next.name = next.name || next.id || `Item ${index + 1}`;
        next.qty = numberOr(next.qty ?? next.quantity, 1);
        if (next.quantity != null && next.qty !== next.quantity) {
            report.renamedFields.push({ from: `${path}.${index}.quantity`, to: `${path}.${index}.qty` });
            delete next.quantity;
        }
        next.instanceId = next.instanceId || `${safeDocId(next.name, 'item')}_${index}`;
        next.traits = normalizeTraits(next.traits ?? next.system?.traits, report, `${path}.${index}.traits`);
        next.catalogRef = next.catalogRef || buildCatalogRef(next);
        return next;
    });
}

function normalizeConditions(conditions, report, path) {
    if (!Array.isArray(conditions)) {
        report.invalidValues.push({ path, issue: 'Expected array; replaced with empty array.' });
        return [];
    }
    return conditions.map((condition, index) => {
        if (typeof condition === 'string') {
            report.fallbackAssumptions.push({ field: `${path}.${index}`, assumption: 'String condition converted to object.' });
            return { name: condition, level: 1 };
        }
        return {
            ...condition,
            name: condition?.name || 'unknown',
            level: numberOr(condition?.level ?? condition?.value, condition?.value ? Number(condition.value) : 1),
        };
    });
}

function normalizeHp(hp) {
    if (typeof hp === 'number') return { current: hp, max: hp, temp: 0 };
    const next = hp && typeof hp === 'object' ? { ...hp } : {};
    return {
        current: numberOr(next.current ?? next.value, numberOr(next.max, 0)),
        max: numberOr(next.max, numberOr(next.current ?? next.value, 0)),
        temp: numberOr(next.temp, 0),
    };
}

function normalizeTraits(traits, report, path) {
    if (!traits) return { value: [] };
    if (Array.isArray(traits)) return { value: traits.map(String) };
    if (Array.isArray(traits.value)) return { ...traits, value: traits.value.map(String) };
    if (typeof traits === 'string') {
        report.renamedFields.push({ from: path, to: `${path}.value` });
        return { value: traits.split(',').map(t => t.trim()).filter(Boolean) };
    }
    return { ...traits, value: [] };
}

function buildCatalogRef(item) {
    if (item.sourceFile) return { type: 'item', sourceFile: item.sourceFile, name: item.name };
    if (item.catalogId) return { type: 'item', id: item.catalogId, name: item.name };
    return { type: 'item', name: item.name };
}

function addMembers(users, campaignEntries, addDocument, report) {
    const campaignIds = new Set(campaignEntries.map(([id]) => id));
    for (const [rawEmail, info] of Object.entries(users || {})) {
        const email = String(rawEmail || '').trim().toLowerCase();
        if (!email || !info?.campaignId) {
            report.invalidValues.push({ path: `users.${rawEmail}`, issue: 'User has no campaign assignment; skipped campaign member document.' });
            continue;
        }

        const campaignId = safeDocId(info.campaignId, info.campaignId);
        if (!campaignIds.has(campaignId)) {
            report.invalidValues.push({ path: `users.${rawEmail}.campaignId`, issue: `Campaign ${campaignId} not found; skipped member.` });
            continue;
        }

        addDocument(
            campaignSubPath(campaignId, V2_COLLECTIONS.members, email),
            'members',
            {
                email,
                campaignId,
                role: info.role || 'player',
                characterId: info.characterId || null,
                assignedActorId: info.actorId || info.assignedActorId || info.characterId || null,
            }
        );
    }
}

function addGlobalDocuments(db, addDocument, report) {
    addDocument(V2_GLOBAL_CONFIG_PATH, 'globalConfig', {
        shop: {
            availableItems: Array.isArray(db.shop?.availableItems) ? db.shop.availableItems : [],
            availableFormulas: Array.isArray(db.shop?.availableFormulas) ? db.shop.availableFormulas : [],
            traders: Array.isArray(db.shop?.traders) ? db.shop.traders : [],
        },
        bestiary: {
            creatures: db.bestiary?.creatures || {},
        },
        notificationQueue: Array.isArray(db.notificationQueue) ? db.notificationQueue : [],
        rules: db.rules || {},
        library: db.library || {},
        runes: db.runes || {},
        feats: db.feats || {},
        pacts: db.pacts || {},
        abilities: {
            custom: db.abilities?.custom || {},
            deviant: db.abilities?.deviant || {},
        },
    });

    for (const [key, item] of Object.entries(db.shop?.customItems || {})) {
        const id = safeDocId(item?.id || item?.name || key, key);
        addDocument(`${V2_COLLECTIONS.customItems}/${id}`, 'customItems', {
            id,
            name: item?.name || key,
            data: item,
        });
        addCatalogOverride(addDocument, 'item', id, 'custom', item, item?.name || key);
    }

    for (const [key, creature] of Object.entries(db.bestiary?.customCreatures || {})) {
        const id = safeDocId(creature?.id || key, key);
        addDocument(`${V2_COLLECTIONS.customCreatures}/${id}`, 'customCreatures', { ...creature, id });
        addCatalogOverride(addDocument, 'creature', id, 'custom', { ...creature, id }, creature?.name || key);
    }

    for (const [key, action] of Object.entries(db.actions || {})) {
        const id = safeDocId(action?.id || action?.name || key, key);
        addDocument(`${V2_COLLECTIONS.customActions}/${id}`, 'customActions', { ...action, id });
        addCatalogOverride(addDocument, 'action', id, 'custom', { ...action, id }, action?.name || key);
    }

    for (const [key, ability] of Object.entries(db.abilities?.custom || {})) {
        const id = safeDocId(ability?.id || ability?.name || key, key);
        addCatalogOverride(addDocument, 'ability', id, 'custom', { ...ability, id }, ability?.name || key);
    }

    for (const [key, ability] of Object.entries(db.abilities?.deviant || {})) {
        const id = safeDocId(ability?.id || ability?.name || key, key);
        addCatalogOverride(addDocument, 'ability', id, 'custom', { ...ability, id, abilityFamily: 'deviant' }, ability?.name || key);
    }

    for (const [key, spell] of Object.entries(db.spells?.custom || {})) {
        const id = safeDocId(spell?.id || spell?.name || key, key);
        addCatalogOverride(addDocument, 'spell', id, 'custom', { ...spell, id }, spell?.name || key);
    }

    for (const article of db.lore?.articles || []) {
        const id = safeDocId(article?.id || article?.title, 'article');
        addDocument(`${V2_COLLECTIONS.loreArticles}/${id}`, 'loreArticles', { ...article, id });
    }
}

function addCatalogOverride(addDocument, catalogType, id, mode, payload, label) {
    const overrideId = safeDocId(`${catalogType}_${id}`, `${catalogType}_override`);
    addDocument(`${V2_COLLECTIONS.catalogOverrides}/${overrideId}`, 'catalogOverrides', {
        id: overrideId,
        catalogType,
        baseId: mode === 'custom' ? null : id,
        mode,
        label: label || payload?.name || id,
        payload: payload || {},
        sourceFile: null,
    });
}

function characterToActor(character, campaignId) {
    const actorId = safeDocId(character?.id || character?.name, 'actor');
    return cleanForFirestore({
        id: actorId,
        kind: 'pc',
        campaignId,
        name: character?.name || 'Unnamed Character',
        level: numberOr(character?.level, 1),
        ownerActorId: null,
        controllerUserEmail: character?.controllerUserEmail || null,
        controllerActorId: null,
        commandMode: 'self',
        ruleset: character?.ruleset || 'pf2e_remaster',
        sheet: {
            ...cloneJson(character || {}),
            legacyCharacterId: character?.id || actorId,
        },
        stats: cloneJson(character?.stats || {}),
        inventory: cloneJson(character?.inventory || []),
        magic: cloneJson(character?.magic || { slots: {}, list: [] }),
        deletedAt: character?.deletedAt || null,
        deletedBy: character?.deletedBy || null,
    });
}

function companionToActor(companion, ownerCharacter, campaignId) {
    if (!companion || typeof companion !== 'object') return null;
    const ownerId = safeDocId(ownerCharacter?.id || ownerCharacter?.name, 'actor');
    const rawId = companion.id || companion.name || `${ownerId}_companion`;
    const actorId = safeDocId(rawId, `${ownerId}_companion`);
    const kind = inferCompanionKind(companion);
    return cleanForFirestore({
        id: actorId,
        kind,
        campaignId,
        name: companion.name || 'Unnamed Companion',
        level: numberOr(companion.level, numberOr(ownerCharacter?.level, 1)),
        ownerActorId: ownerId,
        controllerUserEmail: ownerCharacter?.controllerUserEmail || null,
        controllerActorId: ownerId,
        commandMode: kind === 'familiar' ? 'command_animal' : 'command_animal',
        ruleset: companion.ruleset || ownerCharacter?.ruleset || 'pf2e_remaster',
        baseTemplateId: companion.species || companion.type || null,
        progression: {
            type: companion.type || null,
            specialization: companion.specialization || null,
        },
        selectionSlots: {
            familiarAbilities: cloneJson(companion.familiarAbilities || []),
            masterAbilities: cloneJson(companion.masterAbilities || []),
        },
        sourceStatus: companion.sourceStatus || 'legacy_current',
        sheet: cloneJson(companion),
        stats: {
            hp: normalizeHp(companion.hp || { current: 0, max: 1, temp: 0 }),
            ac: companion.ac ?? null,
            perception: companion.perception ?? null,
            saves: cloneJson(companion.saves || {}),
            speed: cloneJson(companion.speeds || { land: 25 }),
        },
        inventory: cloneJson(companion.inventory || []),
        magic: cloneJson(companion.magic || { slots: {}, list: [] }),
        deletedAt: companion.deletedAt || null,
        deletedBy: companion.deletedBy || null,
    });
}

function inferCompanionKind(companion) {
    const type = String(companion?.type || companion?.family || '').toLowerCase();
    if (type.includes('familiar')) return 'familiar';
    if (type.includes('pet')) return 'pet';
    if (type.includes('eidolon')) return 'eidolon';
    if (type.includes('follower')) return 'follower';
    if (type.includes('summon')) return 'summoned';
    return 'animal_companion';
}

function buildConditionEffects({ campaignId, targetActorId, conditions, path, report }) {
    return normalizeConditions(conditions || [], report, path).map((condition, index) => {
        const label = condition.name || 'unknown';
        const value = numberOr(condition.level ?? condition.value, 1);
        return cleanForFirestore({
            id: safeDocId(`${targetActorId}_${label}_${index}`, `effect_${index}`),
            campaignId,
            targetActorId,
            templateId: safeDocId(`condition_${label}`, 'condition_unknown'),
            label,
            category: condition.category || 'condition',
            value,
            source: {
                type: condition.type || 'legacy_condition',
                id: condition.id || null,
                name: label,
                actorId: targetActorId,
            },
            modifiers: Array.isArray(condition.modifiers) ? cloneJson(condition.modifiers) : [],
            duration: condition.duration || null,
            stage: condition.stage || null,
            hidden: Boolean(condition.hidden),
            disabled: Boolean(condition.disabled),
        });
    });
}

function groupByTargetActorId(effects) {
    return (effects || []).reduce((acc, effect) => {
        const key = effect?.targetActorId;
        if (!key) return acc;
        if (!acc[key]) acc[key] = [];
        acc[key].push(effect);
        return acc;
    }, {});
}

function actorToLegacyCharacter(actor, effects = []) {
    const sheet = cloneJson(actor.sheet || {});
    return normalizeCharacterRuntimeShape({
        ...sheet,
        id: sheet.id || sheet.legacyCharacterId || actor.id,
        name: sheet.name || actor.name,
        level: sheet.level ?? actor.level,
        stats: sheet.stats || actor.stats || {},
        inventory: sheet.inventory || actor.inventory || [],
        magic: sheet.magic || actor.magic || { slots: {}, list: [] },
        conditions: effects
            .filter(effect => effect.category === 'condition')
            .map(effect => ({
                id: effect.id,
                name: effect.label,
                level: numberOr(effect.value, 1),
                hidden: effect.hidden || undefined,
                disabled: effect.disabled || undefined,
            })),
        deletedAt: sheet.deletedAt || actor.deletedAt || undefined,
        deletedBy: sheet.deletedBy || actor.deletedBy || undefined,
    });
}

function selectLegacyCampaignTarget(campaignEntries, report, field) {
    const target = campaignEntries[0];
    if (campaignEntries.length > 1) {
        report.fallbackAssumptions.push({
            field,
            assumption: `Root legacy ${field} assigned to first campaign (${target[0]}).`,
        });
    }
    return { id: target[0], campaign: target[1] };
}

function mergeById(existing, incoming) {
    const out = Array.isArray(existing) ? [...existing] : [];
    const seen = new Set(out.map(item => item?.id).filter(Boolean));
    for (const item of incoming || []) {
        if (item?.id && seen.has(item.id)) continue;
        out.push(item);
        if (item?.id) seen.add(item.id);
    }
    return out;
}

function stampDocument(data, nowIso, migrationId) {
    return {
        ...data,
        schemaVersion: V2_SCHEMA_VERSION,
        updatedAt: data?.updatedAt || nowIso,
        createdAt: data?.createdAt || nowIso,
        migration: {
            id: migrationId,
            source: MASTER_SOURCE,
            migratedAt: nowIso,
        },
    };
}

function stripV2Metadata(data) {
    const next = { ...data };
    delete next.schemaVersion;
    delete next.migration;
    return next;
}

function createReport(migrationId, generatedAt) {
    return {
        migrationId,
        generatedAt,
        source: MASTER_SOURCE,
        totalDocuments: 0,
        counts: {},
        renamedFields: [],
        movedFields: [],
        droppedFields: [],
        invalidValues: [],
        fallbackAssumptions: [],
    };
}

function cloneJson(value) {
    if (value == null) return value;
    return JSON.parse(JSON.stringify(value));
}

function numberOr(value, fallback) {
    const number = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(number) ? number : fallback;
}

function sortByNameThenId(a, b) {
    return String(a.name || '').localeCompare(String(b.name || '')) || String(a.id || '').localeCompare(String(b.id || ''));
}

function sortByOrderNameId(a, b) {
    const orderA = Number.isFinite(Number(a?.order)) ? Number(a.order) : Number.MAX_SAFE_INTEGER;
    const orderB = Number.isFinite(Number(b?.order)) ? Number(b.order) : Number.MAX_SAFE_INTEGER;
    return orderA - orderB || sortByNameThenId(a, b);
}

function sortByTitleThenId(a, b) {
    return String(a.title || '').localeCompare(String(b.title || '')) || String(a.id || '').localeCompare(String(b.id || ''));
}
