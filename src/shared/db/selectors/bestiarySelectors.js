export function selectBestiaryRevealState(db, creatureId) {
    if (!creatureId) return {};
    return db?.bestiary?.creatures?.[creatureId]?.revealState || {};
}

export function selectCustomCreatures(db) {
    return db?.bestiary?.customCreatures || {};
}

export function selectCustomCreatureList(db) {
    return Object.values(selectCustomCreatures(db));
}

export function selectBestiaryCreatureMetadata(db) {
    return db?.bestiary?.creatures || {};
}

export function selectBestiaryCreatureMetadataEntry(db, creatureId) {
    return creatureId ? selectBestiaryCreatureMetadata(db)[creatureId] || null : null;
}

export function selectCustomCreature(db, creatureId) {
    return creatureId ? selectCustomCreatures(db)[creatureId] || null : null;
}

export function selectCustomCreatureData(db, creatureId) {
    return selectCustomCreature(db, creatureId)?.data || null;
}
