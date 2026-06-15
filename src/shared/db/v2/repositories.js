import { doc, runTransaction, updateDoc } from 'firebase/firestore';
import { cleanForFirestore } from './normalizers.js';
import { V2_COLLECTIONS } from './schema.js';

export function campaignDocRef(firestore, campaignId) {
    return doc(firestore, V2_COLLECTIONS.campaigns, campaignId);
}

export function campaignChildDocRef(firestore, campaignId, collectionName, docId) {
    return doc(firestore, V2_COLLECTIONS.campaigns, campaignId, collectionName, docId);
}

export const campaignRepo = {
    async updateSettings(firestore, campaignId, patch) {
        await updateDoc(campaignDocRef(firestore, campaignId), stampRuntime(patch));
    },
};

export const characterRepo = {
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

export const questRepo = {
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

    async completeObjective(firestore, campaignId, questId, objectiveIndex) {
        await questRepo.updateQuest(firestore, campaignId, questId, quest => {
            const objectives = Array.isArray(quest.objectives) ? [...quest.objectives] : [];
            if (!objectives[objectiveIndex]) throw new Error(`Objective not found: ${objectiveIndex}`);
            objectives[objectiveIndex] = { ...objectives[objectiveIndex], completed: true };
            const visibleObjectives = objectives.filter(objective => !objective.failed);
            const isComplete = visibleObjectives.length > 0 && visibleObjectives.every(objective => objective.completed);
            return {
                ...quest,
                objectives,
                status: isComplete ? 'Completed' : quest.status,
            };
        });
    },
};

export const lootRepo = {
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
