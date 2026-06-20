export function selectMyCharacter(activeCampaign, userInfo) {
    const characterId = userInfo?.characterId || userInfo?.assignedActorId || userInfo?.actorId;
    if (!characterId) return null;
    return selectActiveCharacters(activeCampaign).find((character) => character.id === characterId || character.name === characterId) || null;
}

export function selectActiveCharacters(campaign) {
    const pcActors = selectPcActorDocs(campaign).filter(actor => !actor.deletedAt);
    if (pcActors.length > 0) return pcActors.map(actorToCharacterView);
    return campaign?.characters || [];
}

export function selectArchivedCharacters(campaign) {
    const pcActors = selectPcActorDocs(campaign).filter(actor => actor.deletedAt);
    if (pcActors.length > 0) return pcActors.map(actorToCharacterView);
    return campaign?.archivedCharacters || [];
}

export function actorToCharacterView(actor) {
    const sheet = actor?.sheet || {};
    return {
        ...sheet,
        id: sheet.id || sheet.legacyCharacterId || actor?.id,
        name: sheet.name || actor?.name,
        level: sheet.level ?? actor?.level,
        stats: sheet.stats || actor?.stats || {},
        inventory: sheet.inventory || actor?.inventory || [],
        magic: sheet.magic || actor?.magic || { slots: {}, list: [] },
        deletedAt: sheet.deletedAt || actor?.deletedAt,
        deletedBy: sheet.deletedBy || actor?.deletedBy,
    };
}

function selectPcActorDocs(campaign) {
    return Array.isArray(campaign?.actors) ? campaign.actors.filter(actor => actor?.kind === 'pc') : [];
}
