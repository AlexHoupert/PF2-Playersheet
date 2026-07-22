export function normalizeAbilityCatalogEntry(entry) {
    if (!entry || typeof entry !== 'object') return null;

    const payload = isRecord(entry.payload) ? entry.payload : null;
    const data = isRecord(entry.data) ? entry.data : null;
    const source = payload || data || entry;
    const system = isRecord(source.system)
        ? source.system
        : isRecord(entry.system)
            ? entry.system
            : {};
    const name = String(source.name || entry.name || '').trim();
    if (!name) return null;

    const id = source.id || source._id || entry.id || entry._id || name;
    return {
        ...entry,
        ...source,
        id,
        _id: source._id || entry._id || id,
        name,
        typeCode: normalizeAbilityTypeCode(
            source.typeCode || entry.typeCode,
            system.actionType?.value,
            system.actions?.value
        ),
        traits: normalizeAbilityTraits(
            source.traits ?? entry.traits ?? system.traits?.value
        ),
        category: normalizeTextValue(source.category ?? entry.category ?? system.category),
        description: normalizeTextValue(
            source.description ?? entry.description ?? system.description?.value
        ),
    };
}

export function normalizeAbilityCatalogList(entries) {
    const values = Array.isArray(entries)
        ? entries
        : isRecord(entries)
            ? Object.values(entries)
            : [];
    return values.map(normalizeAbilityCatalogEntry).filter(Boolean);
}

export function normalizeAbilityTraits(value) {
    const raw = Array.isArray(value)
        ? value
        : Array.isArray(value?.value)
            ? value.value
            : typeof value === 'string'
                ? value.split(',')
                : [];
    return raw
        .map((trait) => String(trait || '').trim())
        .filter(Boolean);
}

export function normalizeAbilityTypeCode(typeCode, actionType, actionCount) {
    const explicit = String(typeCode || '').trim().toUpperCase();
    if (['P', 'R', 'F', '1', '2', '3'].includes(explicit)) return explicit;

    const normalizedActionType = String(actionType || '').trim().toLowerCase();
    if (normalizedActionType === 'passive') return 'P';
    if (normalizedActionType === 'reaction') return 'R';
    if (normalizedActionType === 'free') return 'F';
    if (normalizedActionType === 'action') {
        const count = Math.max(1, Math.min(3, Math.trunc(Number(actionCount) || 1)));
        return String(count);
    }
    return 'P';
}

function normalizeTextValue(value) {
    if (typeof value === 'string') return value;
    if (typeof value?.value === 'string') return value.value;
    return '';
}

function isRecord(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
