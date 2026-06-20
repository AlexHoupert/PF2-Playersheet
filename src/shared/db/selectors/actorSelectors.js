import { isSoftDeleted } from "../domain/campaignReducers.js";

export function selectActorBuckets(campaign) {
    const actors = Array.isArray(campaign?.actors) ? campaign.actors : [];
    return {
        actors: actors.filter(actor => !isSoftDeleted(actor)),
        archivedActors: actors.filter(actor => isSoftDeleted(actor)),
    };
}

export function selectMyActor(campaign, userInfo) {
    const actorId = userInfo?.actorId || userInfo?.assignedActorId || userInfo?.characterId;
    if (!actorId) return null;
    const { actors } = selectActorBuckets(campaign);
    return actors.find(actor => actor.id === actorId) || null;
}

export function selectOwnedActors(campaign, ownerActorId) {
    if (!ownerActorId) return [];
    const { actors } = selectActorBuckets(campaign);
    return actors.filter(actor => actor.ownerActorId === ownerActorId);
}

export function selectPcActors(campaign) {
    const { actors } = selectActorBuckets(campaign);
    return actors.filter(actor => actor.kind === "pc");
}
