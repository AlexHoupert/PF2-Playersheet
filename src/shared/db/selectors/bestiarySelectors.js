export function selectBestiaryRevealState(db, creatureId) {
    if (!creatureId) return {};
    return db?.bestiary?.creatures?.[creatureId]?.revealState || {};
}

export function selectCustomCreatures(db) {
    return db?.bestiary?.customCreatures || {};
}
