export function selectPacts(db) {
    return db?.pacts || {};
}

export function selectPactList(db) {
    return Object.values(selectPacts(db)).sort((a, b) =>
        String(a.name || '').localeCompare(String(b.name || ''))
    );
}

export function selectPact(db, pactId) {
    return pactId ? selectPacts(db)[pactId] || null : null;
}
