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
    const sheet = actor?.sheet || {};
    return {
        ...sheet,
        id: sheet.id || sheet.legacyCharacterId || actor?.id,
        name: sheet.name || actor?.name,
        level: sheet.level ?? actor?.level,
        stats: sheet.stats || actor?.stats || {},
        skills: sheet.skills || actor?.skills || {},
        inventory: sheet.inventory || actor?.inventory || [],
        magic: sheet.magic || actor?.magic || { slots: {}, list: [] },
        formulaBook: sheet.formulaBook || actor?.formulaBook || [],
        languages: sheet.languages || actor?.languages || [],
        senses: sheet.senses || actor?.senses || [],
        proficiencies: sheet.proficiencies || actor?.proficiencies || {},
        gold: sheet.gold ?? actor?.gold ?? 0,
        xp: sheet.xp || actor?.xp || { current: 0, max: 1000 },
        deletedAt: sheet.deletedAt || actor?.deletedAt,
        deletedBy: sheet.deletedBy || actor?.deletedBy,
    };
}

function selectPcActorDocs(campaign) {
    return Array.isArray(campaign?.actors) ? campaign.actors.filter(actor => actor?.kind === 'pc') : [];
}
