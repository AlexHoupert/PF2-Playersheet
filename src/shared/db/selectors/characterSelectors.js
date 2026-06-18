export function selectMyCharacter(activeCampaign, userInfo) {
    const characterId = userInfo?.characterId;
    if (!characterId) return null;
    return (activeCampaign?.characters || []).find((character) => character.id === characterId || character.name === characterId) || null;
}

export function selectActiveCharacters(campaign) {
    return campaign?.characters || [];
}

export function selectArchivedCharacters(campaign) {
    return campaign?.archivedCharacters || [];
}
