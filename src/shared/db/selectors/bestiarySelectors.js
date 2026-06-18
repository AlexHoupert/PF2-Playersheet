export function selectBestiaryRevealState(db, creatureId) {
    if (!creatureId) return {};
    return db?.bestiary?.creatures?.[creatureId]?.revealState || {};
}

export function selectCustomCreatures(db) {
    return db?.bestiary?.customCreatures || {};
}

export function selectBestiaryCreatureMetadata(db) {
    return db?.bestiary?.creatures || {};
}

export function selectCustomCreature(db, creatureId) {
    return creatureId ? selectCustomCreatures(db)[creatureId] || null : null;
}
