import { deleteDoc, doc, runTransaction, setDoc, updateDoc } from 'firebase/firestore';
import { cleanForFirestore } from './normalizers.js';
import { V2_COLLECTIONS } from './schema.js';

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

    async updateCampaignAndCharacters(firestore, campaignId, characterIds, updater) {
        const campaignRef = campaignDocRef(firestore, campaignId);
        const uniqueIds = [...new Set(characterIds.filter(Boolean))];
        const refsById = Object.fromEntries(
            uniqueIds.map(characterId => [
                characterId,
                campaignChildDocRef(firestore, campaignId, V2_COLLECTIONS.characters, characterId),
            ])
        );

        await runTransaction(firestore, async transaction => {
            const campaignSnapshot = await transaction.get(campaignRef);
            if (!campaignSnapshot.exists()) throw new Error(`Campaign not found: ${campaignId}`);

            const characterEntries = await Promise.all(
                uniqueIds.map(async characterId => {
                    const snapshot = await transaction.get(refsById[characterId]);
                    if (!snapshot.exists()) throw new Error(`Character not found: ${characterId}`);
                    return [characterId, snapshot.data()];
                })
            );

            const result = updater(campaignSnapshot.data(), Object.fromEntries(characterEntries));
            transaction.set(campaignRef, cleanForFirestore(stampRuntime(result.campaign)));
            Object.entries(result.charactersById || {}).forEach(([characterId, character]) => {
                if (!refsById[characterId]) return;
                transaction.set(refsById[characterId], cleanForFirestore(stampRuntime(character)));
            });
        });
    },

    async updateSettings(firestore, campaignId, patch) {
        await updateDoc(campaignDocRef(firestore, campaignId), stampRuntime(patch));
    },
};

export const characterRepo = {
    async createCharacter(firestore, campaignId, character) {
        const ref = campaignChildDocRef(firestore, campaignId, V2_COLLECTIONS.characters, character.id);
        await setDoc(ref, cleanForFirestore(stampRuntime(character)));
    },

    async updateCharacter(firestore, campaignId, characterId, updater) {
        const ref = campaignChildDocRef(firestore, campaignId, V2_COLLECTIONS.characters, characterId);
        await runTransaction(firestore, async transaction => {
            const snapshot = await transaction.get(ref);
            if (!snapshot.exists()) throw new Error(`Character not found: ${characterId}`);
            const current = snapshot.data();
            const next = typeof updater === 'function' ? updater(current) : { ...current, ...updater };
            transaction.set(ref, cleanForFirestore(stampRuntime(next)));
        });
    },

    async updateCharacterAndMembers(firestore, campaignId, characterId, memberEmails, characterUpdater, memberUpdater) {
        const characterRef = campaignChildDocRef(firestore, campaignId, V2_COLLECTIONS.characters, characterId);
        const normalizedEmails = [...new Set(memberEmails.filter(Boolean))];
        const memberRefsByEmail = Object.fromEntries(
            normalizedEmails.map(email => [
                email,
                campaignChildDocRef(firestore, campaignId, V2_COLLECTIONS.members, email),
            ])
        );

        await runTransaction(firestore, async transaction => {
            const characterSnapshot = await transaction.get(characterRef);
            if (!characterSnapshot.exists()) throw new Error(`Character not found: ${characterId}`);

            const memberEntries = await Promise.all(
                normalizedEmails.map(async email => {
                    const snapshot = await transaction.get(memberRefsByEmail[email]);
                    return [email, snapshot.exists() ? snapshot.data() : null];
                })
            );

            const nextCharacter = characterUpdater(characterSnapshot.data());
            transaction.set(characterRef, cleanForFirestore(stampRuntime(nextCharacter)));

            Object.entries(Object.fromEntries(memberEntries)).forEach(([email, member]) => {
                if (!member) return;
                const nextMember = memberUpdater(member);
                transaction.set(memberRefsByEmail[email], cleanForFirestore(stampRuntime(nextMember)));
            });
        });
    },

    async updateCharacters(firestore, campaignId, characterIds, updater) {
        const uniqueIds = [...new Set(characterIds.filter(Boolean))];
        const refsById = Object.fromEntries(
            uniqueIds.map(characterId => [
                characterId,
                campaignChildDocRef(firestore, campaignId, V2_COLLECTIONS.characters, characterId),
            ])
        );

        await runTransaction(firestore, async transaction => {
            const entries = await Promise.all(
                uniqueIds.map(async characterId => {
                    const snapshot = await transaction.get(refsById[characterId]);
                    if (!snapshot.exists()) throw new Error(`Character not found: ${characterId}`);
                    return [characterId, snapshot.data()];
                })
            );
            const currentById = Object.fromEntries(entries);
            const nextById = typeof updater === 'function' ? updater(currentById) : updater;

            Object.entries(nextById || currentById).forEach(([characterId, character]) => {
                if (!refsById[characterId]) return;
                transaction.set(refsById[characterId], cleanForFirestore(stampRuntime(character)));
            });
        });
    },

    async updateInventoryItem(firestore, campaignId, characterId, instanceId, updater) {
        await characterRepo.updateCharacter(firestore, campaignId, characterId, character => {
            const inventory = Array.isArray(character.inventory) ? [...character.inventory] : [];
            const index = inventory.findIndex(item => item.instanceId === instanceId || item.id === instanceId);
            if (index === -1) throw new Error(`Inventory item not found: ${instanceId}`);
            inventory[index] = typeof updater === 'function'
                ? updater(inventory[index])
                : { ...inventory[index], ...updater };
            return { ...character, inventory };
        });
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
        })));
    },

    async revokeUser(firestore, campaignId, email) {
        const ref = campaignChildDocRef(firestore, campaignId, V2_COLLECTIONS.members, email);
        await deleteDoc(ref);
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

    async updateQuestAndCampaignAndCharacters(firestore, campaignId, questId, characterIds, updater) {
        const questRef = campaignChildDocRef(firestore, campaignId, V2_COLLECTIONS.quests, questId);
        const campaignRef = campaignDocRef(firestore, campaignId);
        const uniqueCharacterIds = [...new Set(characterIds.filter(Boolean))];
        const characterRefsById = Object.fromEntries(
            uniqueCharacterIds.map(characterId => [
                characterId,
                campaignChildDocRef(firestore, campaignId, V2_COLLECTIONS.characters, characterId),
            ])
        );

        await runTransaction(firestore, async transaction => {
            const [questSnapshot, campaignSnapshot] = await Promise.all([
                transaction.get(questRef),
                transaction.get(campaignRef),
            ]);
            if (!questSnapshot.exists()) throw new Error(`Quest not found: ${questId}`);
            if (!campaignSnapshot.exists()) throw new Error(`Campaign not found: ${campaignId}`);

            const characterEntries = await Promise.all(
                uniqueCharacterIds.map(async characterId => {
                    const snapshot = await transaction.get(characterRefsById[characterId]);
                    if (!snapshot.exists()) throw new Error(`Character not found: ${characterId}`);
                    return [characterId, snapshot.data()];
                })
            );

            const result = updater(questSnapshot.data(), campaignSnapshot.data(), Object.fromEntries(characterEntries));
            transaction.set(questRef, cleanForFirestore(stampRuntime(result.quest)));
            transaction.set(campaignRef, cleanForFirestore(stampRuntime(result.campaign)));
            Object.entries(result.charactersById || {}).forEach(([characterId, character]) => {
                if (!characterRefsById[characterId]) return;
                transaction.set(characterRefsById[characterId], cleanForFirestore(stampRuntime(character)));
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

    async updateLootBagAndCharacter(firestore, campaignId, lootBagId, characterId, updater) {
        const lootRef = campaignChildDocRef(firestore, campaignId, V2_COLLECTIONS.lootBags, lootBagId);
        const characterRef = campaignChildDocRef(firestore, campaignId, V2_COLLECTIONS.characters, characterId);

        await runTransaction(firestore, async transaction => {
            const [lootSnapshot, characterSnapshot] = await Promise.all([
                transaction.get(lootRef),
                transaction.get(characterRef),
            ]);
            if (!lootSnapshot.exists()) throw new Error(`Loot bag not found: ${lootBagId}`);
            if (!characterSnapshot.exists()) throw new Error(`Character not found: ${characterId}`);

            const result = updater(lootSnapshot.data(), characterSnapshot.data());
            transaction.set(lootRef, cleanForFirestore(stampRuntime(result.lootBag)));
            transaction.set(characterRef, cleanForFirestore(stampRuntime(result.character)));
        });
    },

    async updateLootBagAndCharacters(firestore, campaignId, lootBagId, characterIds, updater) {
        const uniqueCharacterIds = [...new Set(characterIds.filter(Boolean))];
        const lootRef = campaignChildDocRef(firestore, campaignId, V2_COLLECTIONS.lootBags, lootBagId);
        const characterRefsById = Object.fromEntries(
            uniqueCharacterIds.map(characterId => [
                characterId,
                campaignChildDocRef(firestore, campaignId, V2_COLLECTIONS.characters, characterId),
            ])
        );

        await runTransaction(firestore, async transaction => {
            const lootSnapshot = await transaction.get(lootRef);
            if (!lootSnapshot.exists()) throw new Error(`Loot bag not found: ${lootBagId}`);

            const characterEntries = await Promise.all(
                uniqueCharacterIds.map(async characterId => {
                    const snapshot = await transaction.get(characterRefsById[characterId]);
                    if (!snapshot.exists()) throw new Error(`Character not found: ${characterId}`);
                    return [characterId, snapshot.data()];
                })
            );
            const charactersById = Object.fromEntries(characterEntries);
            const result = updater(lootSnapshot.data(), charactersById);

            transaction.set(lootRef, cleanForFirestore(stampRuntime(result.lootBag)));
            Object.entries(result.charactersById || charactersById).forEach(([characterId, character]) => {
                if (!characterRefsById[characterId]) return;
                transaction.set(characterRefsById[characterId], cleanForFirestore(stampRuntime(character)));
            });
        });
    },

    async claimItem(firestore, campaignId, lootBagId, itemInstanceId, characterId) {
        const lootRef = campaignChildDocRef(firestore, campaignId, V2_COLLECTIONS.lootBags, lootBagId);
        const characterRef = campaignChildDocRef(firestore, campaignId, V2_COLLECTIONS.characters, characterId);

        await runTransaction(firestore, async transaction => {
            const [lootSnapshot, characterSnapshot] = await Promise.all([
                transaction.get(lootRef),
                transaction.get(characterRef),
            ]);
            if (!lootSnapshot.exists()) throw new Error(`Loot bag not found: ${lootBagId}`);
            if (!characterSnapshot.exists()) throw new Error(`Character not found: ${characterId}`);

            const lootBag = lootSnapshot.data();
            const character = characterSnapshot.data();
            const items = Array.isArray(lootBag.items) ? [...lootBag.items] : [];
            const index = items.findIndex(item => item.instanceId === itemInstanceId || item.id === itemInstanceId);
            if (index === -1) throw new Error(`Loot item not found: ${itemInstanceId}`);
            if (items[index].claimedBy) throw new Error('Loot item is already claimed.');

            const claimedItem = { ...items[index], claimedBy: characterId };
            items[index] = claimedItem;

            const inventory = Array.isArray(character.inventory) ? [...character.inventory] : [];
            inventory.push({ ...claimedItem, claimedAt: new Date().toISOString() });

            transaction.set(lootRef, cleanForFirestore(stampRuntime({ ...lootBag, items })));
            transaction.set(characterRef, cleanForFirestore(stampRuntime({ ...character, inventory })));
        });
    },
};

function stampRuntime(data) {
    return {
        ...data,
        schemaVersion: 2,
        updatedAt: new Date().toISOString(),
    };
}
