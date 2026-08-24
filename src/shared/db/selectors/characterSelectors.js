import { actorToCharacterRuntimeView } from "../../actors/actorRuntimeFields.js";

export function selectMyCharacter(activeCampaign, userInfo) {
    const characterId = userInfo?.characterId || userInfo?.assignedActorId || userInfo?.actorId;
    if (!characterId) return null;
    return selectActiveCharacters(activeCampaign).find((character) => character.id === characterId || character.name === characterId) || null;
}

export function selectActiveCharacters(campaign) {
    const pcActors = selectPcActorDocs(campaign).filter(actor => !actor.deletedAt);
    return pcActors.map(actorToCharacterView);
}

export function selectArchivedCharacters(campaign) {
    const pcActors = selectPcActorDocs(campaign).filter(actor => actor.deletedAt);
    return pcActors.map(actorToCharacterView);
}

export function actorToCharacterView(actor) {
    return actorToCharacterRuntimeView(actor);
}

function selectPcActorDocs(campaign) {
    return Array.isArray(campaign?.actors) ? campaign.actors.filter(actor => actor?.kind === 'pc') : [];
}
