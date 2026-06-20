import { deleteDoc, doc, runTransaction, setDoc, updateDoc } from 'firebase/firestore';
import { cleanForFirestore, safeDocId } from './normalizers.js';
import { V2_COLLECTIONS, V2_GLOBAL_CONFIG_PATH } from './schema.js';

export function campaignDocRef(firestore, campaignId) {
    return doc(firestore, V2_COLLECTIONS.campaigns, campaignId);
}

export function campaignChildDocRef(firestore, campaignId, collectionName, docId) {
    return doc(firestore, V2_COLLECTIONS.campaigns, campaignId, collectionName, String(docId));
}

export const campaignRepo = {
    async createCampaign(firestore, campaign) {
        await setDoc(campaignDocRef(firestore, campaign.id), cleanForFirestore(stampRuntime(campaign)));
    },

    async updateCampaign(firestore, campaignId, updater) {
        const ref = campaignDocRef(firestore, campaignId);
        await runTransaction(firestore, async transaction => {
            const snapshot = await transaction.get(ref);
            if (!snapshot.exists()) throw new Error(`Campaign not found: ${campaignId}`);
            const current = snapshot.data();
            const next = typeof updater === 'function' ? updater(current) : { ...current, ...updater };
            transaction.set(ref, cleanForFirestore(stampRuntime(next)));
        });
    },

    async updateCampaignAndActors(firestore, campaignId, actorIds, updater) {
        const campaignRef = campaignDocRef(firestore, campaignId);
        const uniqueIds = [...new Set(actorIds.filter(Boolean))];
        const refsById = Object.fromEntries(
            uniqueIds.map(actorId => [
                actorId,
                campaignChildDocRef(firestore, campaignId, V2_COLLECTIONS.actors, actorId),
            ])
        );

        await runTransaction(firestore, async transaction => {
            const campaignSnapshot = await transaction.get(campaignRef);
            if (!campaignSnapshot.exists()) throw new Error(`Campaign not found: ${campaignId}`);

            const actorEntries = await Promise.all(
                uniqueIds.map(async actorId => {
                    const snapshot = await transaction.get(refsById[actorId]);
                    if (!snapshot.exists()) throw new Error(`Actor not found: ${actorId}`);
                    return [actorId, snapshot.data()];
                })
            );

            const result = updater(campaignSnapshot.data(), Object.fromEntries(actorEntries));
            transaction.set(campaignRef, cleanForFirestore(stampRuntime(result.campaign)));
            Object.entries(result.actorsById || {}).forEach(([actorId, actor]) => {
                if (!refsById[actorId]) return;
                transaction.set(refsById[actorId], cleanForFirestore(stampRuntime(actor)));
            });
        });
    },

    async updateSettings(firestore, campaignId, patch) {
        await updateDoc(campaignDocRef(firestore, campaignId), cleanForFirestore(stampRuntime(patch)));
    },
};

export const actorRepo = {
    async createActor(firestore, campaignId, actor) {
        const ref = campaignChildDocRef(firestore, campaignId, V2_COLLECTIONS.actors, actor.id);
        await setDoc(ref, cleanForFirestore(stampRuntime(actor)));
    },

    async updateActor(firestore, campaignId, actorId, updater) {
        const ref = campaignChildDocRef(firestore, campaignId, V2_COLLECTIONS.actors, actorId);
        await runTransaction(firestore, async transaction => {
            const snapshot = await transaction.get(ref);
            if (!snapshot.exists()) throw new Error(`Actor not found: ${actorId}`);
            const current = snapshot.data();
            const next = typeof updater === 'function' ? updater(current) : { ...current, ...updater };
            transaction.set(ref, cleanForFirestore(stampRuntime(next)));
        });
    },

    async updateActors(firestore, campaignId, actorIds, updater) {
        const uniqueIds = [...new Set(actorIds.filter(Boolean))];
        const refsById = Object.fromEntries(
            uniqueIds.map(actorId => [
                actorId,
                campaignChildDocRef(firestore, campaignId, V2_COLLECTIONS.actors, actorId),
            ])
        );

        await runTransaction(firestore, async transaction => {
            const entries = await Promise.all(
                uniqueIds.map(async actorId => {
                    const snapshot = await transaction.get(refsById[actorId]);
                    if (!snapshot.exists()) throw new Error(`Actor not found: ${actorId}`);
                    return [actorId, snapshot.data()];
                })
            );
            const currentById = Object.fromEntries(entries);
            const nextById = typeof updater === 'function' ? updater(currentById) : updater;
            Object.entries(nextById || currentById).forEach(([actorId, actor]) => {
                if (!refsById[actorId]) return;
                transaction.set(refsById[actorId], cleanForFirestore(stampRuntime(actor)));
            });
        });
    },
};

export const effectRepo = {
    async createEffect(firestore, campaignId, effect) {
        const ref = campaignChildDocRef(firestore, campaignId, V2_COLLECTIONS.actorEffects, effect.id);
        await setDoc(ref, cleanForFirestore(stampRuntime(effect)));
    },

    async updateEffect(firestore, campaignId, effectId, updater) {
        const ref = campaignChildDocRef(firestore, campaignId, V2_COLLECTIONS.actorEffects, effectId);
        await runTransaction(firestore, async transaction => {
            const snapshot = await transaction.get(ref);
            if (!snapshot.exists()) throw new Error(`Actor effect not found: ${effectId}`);
            const current = snapshot.data();
            const next = typeof updater === 'function' ? updater(current) : { ...current, ...updater };
            transaction.set(ref, cleanForFirestore(stampRuntime(next)));
        });
    },

    async deleteEffect(firestore, campaignId, effectId) {
        await deleteDoc(campaignChildDocRef(firestore, campaignId, V2_COLLECTIONS.actorEffects, effectId));
    },

    async setEffectTemplate(firestore, campaignId, template) {
        const id = safeDocId(template?.id || template?.label || template?.name, 'effect_template');
        const ref = campaignChildDocRef(firestore, campaignId, V2_COLLECTIONS.effectTemplates, id);
        await setDoc(ref, cleanForFirestore(stampRuntime({ ...template, id })));
    },

    async deleteEffectTemplate(firestore, campaignId, templateId) {
        const id = safeDocId(templateId?.id || templateId?.label || templateId?.name || templateId, 'effect_template');
        await deleteDoc(campaignChildDocRef(firestore, campaignId, V2_COLLECTIONS.effectTemplates, id));
    },
};

export const memberRepo = {
    async assignUser(firestore, campaignId, email, member) {
        const ref = campaignChildDocRef(firestore, campaignId, V2_COLLECTIONS.members, email);
        await setDoc(ref, cleanForFirestore(stampRuntime({
            email,
            campaignId,
            role: member.role || 'player',
            characterId: member.characterId || null,
            assignedActorId: member.assignedActorId || member.actorId || member.characterId || null,
        })));
    },

    async revokeUser(firestore, campaignId, email) {
        const ref = campaignChildDocRef(firestore, campaignId, V2_COLLECTIONS.members, email);
        await deleteDoc(ref);
    },
};

export const globalRepo = {
    async updateGlobalConfig(firestore, updater) {
        const ref = docFromPath(firestore, V2_GLOBAL_CONFIG_PATH);
        await runTransaction(firestore, async transaction => {
            const snapshot = await transaction.get(ref);
            const current = snapshot.exists() ? snapshot.data() : {};
            const next = typeof updater === 'function' ? updater(current) : { ...current, ...updater };
            transaction.set(ref, cleanForFirestore(stampRuntime(next)));
        });
    },

    async setCustomItem(firestore, item) {
        const id = safeDocId(item?.id || item?.name, 'custom_item');
        const ref = doc(firestore, V2_COLLECTIONS.customItems, id);
        await setDoc(ref, cleanForFirestore(stampRuntime({
            id,
            name: item?.name || id,
            data: item,
        })));
    },

    async deleteCustomItem(firestore, itemOrName) {
        const id = safeDocId(itemOrName?.id || itemOrName?.name || itemOrName, 'custom_item');
        await deleteDoc(doc(firestore, V2_COLLECTIONS.customItems, id));
    },

    async setCustomAction(firestore, action) {
        const id = safeDocId(action?.id || action?.name, 'custom_action');
        const ref = doc(firestore, V2_COLLECTIONS.customActions, id);
        await setDoc(ref, cleanForFirestore(stampRuntime({ ...action, id })));
    },

    async deleteCustomAction(firestore, actionOrName) {
        const id = safeDocId(actionOrName?.id || actionOrName?.name || actionOrName, 'custom_action');
        await deleteDoc(doc(firestore, V2_COLLECTIONS.customActions, id));
    },

    async setCustomCreature(firestore, creature) {
        const entry = normalizeCustomCreatureDocument(creature);
        const id = safeDocId(entry?.id, 'custom_creature');
        const ref = doc(firestore, V2_COLLECTIONS.customCreatures, id);
        await setDoc(ref, cleanForFirestore(stampRuntime({ ...entry, id })));
    },

    async updateCustomCreature(firestore, creatureId, updater) {
        const id = safeDocId(creatureId, 'custom_creature');
        const ref = doc(firestore, V2_COLLECTIONS.customCreatures, id);
        await runTransaction(firestore, async transaction => {
            const snapshot = await transaction.get(ref);
            if (!snapshot.exists()) throw new Error(`Custom creature not found: ${creatureId}`);
            const current = snapshot.data();
            const next = typeof updater === 'function' ? updater(current) : { ...current, ...updater };
            const entry = normalizeCustomCreatureDocument({ ...current, ...next, id: next?.id || creatureId });
            transaction.set(ref, cleanForFirestore(stampRuntime({ ...entry, id })));
        });
    },

    async deleteCustomCreature(firestore, creatureOrId) {
        const id = safeDocId(creatureOrId?.id || creatureOrId?.name || creatureOrId, 'custom_creature');
        await deleteDoc(doc(firestore, V2_COLLECTIONS.customCreatures, id));
    },

    async setLoreArticle(firestore, article) {
        const id = safeDocId(article?.id || article?.title, 'article');
        const ref = doc(firestore, V2_COLLECTIONS.loreArticles, id);
        await setDoc(ref, cleanForFirestore(stampRuntime({ ...article, id })));
    },

    async deleteLoreArticle(firestore, articleOrId) {
        const id = safeDocId(articleOrId?.id || articleOrId?.title || articleOrId, 'article');
        await deleteDoc(doc(firestore, V2_COLLECTIONS.loreArticles, id));
    },

    async updateLoreArticles(firestore, articleIds, updater) {
        const uniqueIds = [...new Set(articleIds.filter(Boolean).map(id => safeDocId(id, 'article')))];
        const refsById = Object.fromEntries(
            uniqueIds.map(articleId => [articleId, doc(firestore, V2_COLLECTIONS.loreArticles, articleId)])
        );

        await runTransaction(firestore, async transaction => {
            const entries = await Promise.all(
                uniqueIds.map(async articleId => {
                    const snapshot = await transaction.get(refsById[articleId]);
                    if (!snapshot.exists()) throw new Error(`Lore article not found: ${articleId}`);
                    return [articleId, snapshot.data()];
                })
            );
            const currentById = Object.fromEntries(entries);
            const nextById = typeof updater === 'function' ? updater(currentById) : updater;
            Object.entries(nextById || currentById).forEach(([articleId, article]) => {
                if (!refsById[articleId]) return;
                transaction.set(refsById[articleId], cleanForFirestore(stampRuntime({ ...article, id: article.id || articleId })));
            });
        });
    },
};

export const catalogOverrideRepo = {
    async setCatalogOverride(firestore, override) {
        const id = safeDocId(override?.id || `${override?.catalogType || 'catalog'}_${override?.baseId || override?.label}`, 'catalog_override');
        const ref = doc(firestore, V2_COLLECTIONS.catalogOverrides, id);
        await setDoc(ref, cleanForFirestore(stampRuntime({ ...override, id, sourceFile: null })));
    },

    async deleteCatalogOverride(firestore, overrideOrId) {
        const id = safeDocId(overrideOrId?.id || overrideOrId, 'catalog_override');
        await deleteDoc(doc(firestore, V2_COLLECTIONS.catalogOverrides, id));
    },
};

export const questRepo = {
    async createQuest(firestore, campaignId, quest) {
        const ref = campaignChildDocRef(firestore, campaignId, V2_COLLECTIONS.quests, String(quest.id));
        await setDoc(ref, cleanForFirestore(stampRuntime(quest)));
    },

    async updateQuest(firestore, campaignId, questId, updater) {
        const ref = campaignChildDocRef(firestore, campaignId, V2_COLLECTIONS.quests, questId);
        await runTransaction(firestore, async transaction => {
            const snapshot = await transaction.get(ref);
            if (!snapshot.exists()) throw new Error(`Quest not found: ${questId}`);
            const current = snapshot.data();
            const next = typeof updater === 'function' ? updater(current) : { ...current, ...updater };
            transaction.set(ref, cleanForFirestore(stampRuntime(next)));
        });
    },

    async updateQuests(firestore, campaignId, questIds, updater) {
        const uniqueIds = [...new Set(questIds.filter(Boolean))];
        const refsById = Object.fromEntries(
            uniqueIds.map(questId => [
                questId,
                campaignChildDocRef(firestore, campaignId, V2_COLLECTIONS.quests, questId),
            ])
        );

        await runTransaction(firestore, async transaction => {
            const entries = await Promise.all(
                uniqueIds.map(async questId => {
                    const snapshot = await transaction.get(refsById[questId]);
                    if (!snapshot.exists()) throw new Error(`Quest not found: ${questId}`);
                    return [questId, snapshot.data()];
                })
            );
            const currentById = Object.fromEntries(entries);
            const nextById = typeof updater === 'function' ? updater(currentById) : updater;
            Object.entries(nextById || currentById).forEach(([questId, quest]) => {
                if (!refsById[questId]) return;
                transaction.set(refsById[questId], cleanForFirestore(stampRuntime(quest)));
            });
        });
    },

    async updateQuestAndCampaignAndActors(firestore, campaignId, questId, actorIds, updater) {
        const questRef = campaignChildDocRef(firestore, campaignId, V2_COLLECTIONS.quests, questId);
        const campaignRef = campaignDocRef(firestore, campaignId);
        const uniqueActorIds = [...new Set(actorIds.filter(Boolean))];
        const actorRefsById = Object.fromEntries(
            uniqueActorIds.map(actorId => [
                actorId,
                campaignChildDocRef(firestore, campaignId, V2_COLLECTIONS.actors, actorId),
            ])
        );

        await runTransaction(firestore, async transaction => {
            const [questSnapshot, campaignSnapshot] = await Promise.all([
                transaction.get(questRef),
                transaction.get(campaignRef),
            ]);
            if (!questSnapshot.exists()) throw new Error(`Quest not found: ${questId}`);
            if (!campaignSnapshot.exists()) throw new Error(`Campaign not found: ${campaignId}`);

            const actorEntries = await Promise.all(
                uniqueActorIds.map(async actorId => {
                    const snapshot = await transaction.get(actorRefsById[actorId]);
                    if (!snapshot.exists()) throw new Error(`Actor not found: ${actorId}`);
                    return [actorId, snapshot.data()];
                })
            );

            const result = updater(questSnapshot.data(), campaignSnapshot.data(), Object.fromEntries(actorEntries));
            transaction.set(questRef, cleanForFirestore(stampRuntime(result.quest)));
            transaction.set(campaignRef, cleanForFirestore(stampRuntime(result.campaign)));
            Object.entries(result.actorsById || {}).forEach(([actorId, actor]) => {
                if (!actorRefsById[actorId]) return;
                transaction.set(actorRefsById[actorId], cleanForFirestore(stampRuntime(actor)));
            });
        });
    },
};

export const encounterRepo = {
    async createEncounter(firestore, campaignId, encounter) {
        const ref = campaignChildDocRef(firestore, campaignId, V2_COLLECTIONS.encounters, String(encounter.id));
        await setDoc(ref, cleanForFirestore(stampRuntime(encounter)));
    },

    async updateEncounter(firestore, campaignId, encounterId, updater) {
        const ref = campaignChildDocRef(firestore, campaignId, V2_COLLECTIONS.encounters, encounterId);
        await runTransaction(firestore, async transaction => {
            const snapshot = await transaction.get(ref);
            if (!snapshot.exists()) throw new Error(`Encounter not found: ${encounterId}`);
            const current = snapshot.data();
            const next = typeof updater === 'function' ? updater(current) : { ...current, ...updater };
            transaction.set(ref, cleanForFirestore(stampRuntime(next)));
        });
    },

    async updateEncounters(firestore, campaignId, encounterIds, updater) {
        const uniqueIds = [...new Set(encounterIds.filter(Boolean))];
        const refsById = Object.fromEntries(
            uniqueIds.map(encounterId => [
                encounterId,
                campaignChildDocRef(firestore, campaignId, V2_COLLECTIONS.encounters, encounterId),
            ])
        );

        await runTransaction(firestore, async transaction => {
            const entries = await Promise.all(
                uniqueIds.map(async encounterId => {
                    const snapshot = await transaction.get(refsById[encounterId]);
                    if (!snapshot.exists()) throw new Error(`Encounter not found: ${encounterId}`);
                    return [encounterId, snapshot.data()];
                })
            );
            const currentById = Object.fromEntries(entries);
            const nextById = typeof updater === 'function' ? updater(currentById) : updater;
            Object.entries(nextById || currentById).forEach(([encounterId, encounter]) => {
                if (!refsById[encounterId]) return;
                transaction.set(refsById[encounterId], cleanForFirestore(stampRuntime(encounter)));
            });
        });
    },
};

export const mapRepo = {
    async createMap(firestore, campaignId, map) {
        const ref = campaignChildDocRef(firestore, campaignId, V2_COLLECTIONS.maps, String(map.id));
        await setDoc(ref, cleanForFirestore(stampRuntime(map)));
    },

    async updateMap(firestore, campaignId, mapId, updater) {
        const ref = campaignChildDocRef(firestore, campaignId, V2_COLLECTIONS.maps, mapId);
        await runTransaction(firestore, async transaction => {
            const snapshot = await transaction.get(ref);
            if (!snapshot.exists()) throw new Error(`Map not found: ${mapId}`);
            const current = snapshot.data();
            const next = typeof updater === 'function' ? updater(current) : { ...current, ...updater };
            transaction.set(ref, cleanForFirestore(stampRuntime(next)));
        });
    },

    async updateMaps(firestore, campaignId, mapIds, updater) {
        const uniqueIds = [...new Set(mapIds.filter(Boolean))];
        const refsById = Object.fromEntries(
            uniqueIds.map(mapId => [
                mapId,
                campaignChildDocRef(firestore, campaignId, V2_COLLECTIONS.maps, mapId),
            ])
        );

        await runTransaction(firestore, async transaction => {
            const entries = await Promise.all(
                uniqueIds.map(async mapId => {
                    const snapshot = await transaction.get(refsById[mapId]);
                    if (!snapshot.exists()) throw new Error(`Map not found: ${mapId}`);
                    return [mapId, snapshot.data()];
                })
            );
            const currentById = Object.fromEntries(entries);
            const nextById = typeof updater === 'function' ? updater(currentById) : updater;
            Object.entries(nextById || currentById).forEach(([mapId, map]) => {
                if (!refsById[mapId]) return;
                transaction.set(refsById[mapId], cleanForFirestore(stampRuntime(map)));
            });
        });
    },
};

export const lootRepo = {
    async createLootBag(firestore, campaignId, lootBag) {
        const lootRef = campaignChildDocRef(firestore, campaignId, V2_COLLECTIONS.lootBags, String(lootBag.id));
        await setDoc(lootRef, cleanForFirestore(stampRuntime(lootBag)));
    },

    async updateLootBag(firestore, campaignId, lootBagId, updater) {
        const lootRef = campaignChildDocRef(firestore, campaignId, V2_COLLECTIONS.lootBags, lootBagId);
        await runTransaction(firestore, async transaction => {
            const snapshot = await transaction.get(lootRef);
            if (!snapshot.exists()) throw new Error(`Loot bag not found: ${lootBagId}`);
            const current = snapshot.data();
            const next = typeof updater === 'function' ? updater(current) : { ...current, ...updater };
            transaction.set(lootRef, cleanForFirestore(stampRuntime(next)));
        });
    },

    async updateLootBagAndActor(firestore, campaignId, lootBagId, actorId, updater) {
        const lootRef = campaignChildDocRef(firestore, campaignId, V2_COLLECTIONS.lootBags, lootBagId);
        const actorRef = campaignChildDocRef(firestore, campaignId, V2_COLLECTIONS.actors, actorId);

        await runTransaction(firestore, async transaction => {
            const [lootSnapshot, actorSnapshot] = await Promise.all([
                transaction.get(lootRef),
                transaction.get(actorRef),
            ]);
            if (!lootSnapshot.exists()) throw new Error(`Loot bag not found: ${lootBagId}`);
            if (!actorSnapshot.exists()) throw new Error(`Actor not found: ${actorId}`);

            const result = updater(lootSnapshot.data(), actorSnapshot.data());
            transaction.set(lootRef, cleanForFirestore(stampRuntime(result.lootBag)));
            transaction.set(actorRef, cleanForFirestore(stampRuntime(result.actor)));
        });
    },

    async updateLootBagAndActors(firestore, campaignId, lootBagId, actorIds, updater) {
        const uniqueActorIds = [...new Set(actorIds.filter(Boolean))];
        const lootRef = campaignChildDocRef(firestore, campaignId, V2_COLLECTIONS.lootBags, lootBagId);
        const actorRefsById = Object.fromEntries(
            uniqueActorIds.map(actorId => [
                actorId,
                campaignChildDocRef(firestore, campaignId, V2_COLLECTIONS.actors, actorId),
            ])
        );

        await runTransaction(firestore, async transaction => {
            const lootSnapshot = await transaction.get(lootRef);
            if (!lootSnapshot.exists()) throw new Error(`Loot bag not found: ${lootBagId}`);

            const actorEntries = await Promise.all(
                uniqueActorIds.map(async actorId => {
                    const snapshot = await transaction.get(actorRefsById[actorId]);
                    if (!snapshot.exists()) throw new Error(`Actor not found: ${actorId}`);
                    return [actorId, snapshot.data()];
                })
            );
            const actorsById = Object.fromEntries(actorEntries);
            const result = updater(lootSnapshot.data(), actorsById);

            transaction.set(lootRef, cleanForFirestore(stampRuntime(result.lootBag)));
            Object.entries(result.actorsById || actorsById).forEach(([actorId, actor]) => {
                if (!actorRefsById[actorId]) return;
                transaction.set(actorRefsById[actorId], cleanForFirestore(stampRuntime(actor)));
            });
        });
    },

};

function normalizeCustomCreatureDocument(creature) {
    if (!creature) return { id: 'custom_creature', name: 'custom_creature', type: 'npc', data: {} };
    if (creature.data) {
        const data = creature.data;
        const id = creature.id || data._id || data.id || creature.name;
        return {
            ...creature,
            id,
            type: creature.type || data.type || 'npc',
            name: creature.name || data.name || id,
            data: {
                ...data,
                _id: data._id || id,
            },
        };
    }
    const id = creature._id || creature.id || creature.name;
    return {
        id,
        type: creature.type || 'npc',
        name: creature.name || id,
        data: {
            ...creature,
            _id: creature._id || id,
        },
    };
}

function docFromPath(firestore, path) {
    const segments = String(path || '').split('/').filter(Boolean);
    if (segments.length === 0 || segments.length % 2 !== 0) {
        throw new Error(`Invalid Firestore document path: ${path}`);
    }
    return doc(firestore, ...segments);
}

function stampRuntime(data) {
    return {
        ...data,
        schemaVersion: 2,
        updatedAt: new Date().toISOString(),
    };
}
