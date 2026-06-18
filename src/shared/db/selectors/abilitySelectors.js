export function selectCustomAbilities(db) {
    return db?.abilities?.custom || {};
}

export function selectCustomAbility(db, abilityId) {
    return abilityId ? selectCustomAbilities(db)[abilityId] || null : null;
}

export function selectCustomAbilityList(db) {
    return Object.values(selectCustomAbilities(db));
}

export function selectDeviantAbilities(db) {
    return db?.abilities?.deviant || {};
}

export function selectDeviantAbility(db, abilityId) {
    return abilityId ? selectDeviantAbilities(db)[abilityId] || null : null;
}

export function selectDeviantAbilityList(db) {
    return Object.values(selectDeviantAbilities(db)).sort(
        (a, b) => (a.level ?? 0) - (b.level ?? 0) || String(a.name || '').localeCompare(String(b.name || ''))
    );
}
