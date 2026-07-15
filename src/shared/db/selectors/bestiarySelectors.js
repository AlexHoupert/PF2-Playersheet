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

export function selectPlayerVisibleCreatureIds(db) {
    const metadata = selectBestiaryCreatureMetadata(db);
    const visibleIds = new Set(
        Object.entries(metadata)
            .filter(([, entry]) => Boolean(entry?.bestiary))
            .map(([id]) => String(id))
    );
    for (const [key, record] of Object.entries(selectCustomCreatures(db))) {
        const creature = record?.data || record || {};
        const id = String(record?.id || creature?.id || creature?._id || key);
        const isPublished = metadata[id]?.bestiary ?? record?.bestiary ?? creature?.bestiary;
        if (isPublished) visibleIds.add(id);
    }
    return visibleIds;
}
