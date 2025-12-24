export function migrateDb(db) {
    const next = db && typeof db === 'object' ? db : {};

    if (!Array.isArray(next.characters)) next.characters = [];
    next.characters = next.characters.map(c => ({
        ...c,
        initiative: c.initiative ?? 0
    }));

    const ARMOR_PROF_DEFAULTS = { Unarmored: 2, Light: 0, Medium: 0, Heavy: 0 };
    const ARMOR_PROF_CANON = {
        unarmored: 'Unarmored',
        light: 'Light',
        medium: 'Medium',
        heavy: 'Heavy'
    };

    const normalizeProfKey = (key) => {
        const raw = String(key ?? '').trim();
        if (!raw) return '';
        const canon = ARMOR_PROF_CANON[raw.toLowerCase()];
        return canon || raw;
    };

    const normalizeProficiencies = (proficiencies) => {
        const out = {};

        if (Array.isArray(proficiencies)) {
            for (const entry of proficiencies) {
                const name = normalizeProfKey(entry?.name);
                if (!name) continue;
                const prof = typeof entry?.prof === 'number' ? entry.prof : Number(entry?.prof);
                out[name] = Number.isFinite(prof) ? prof : 0;
            }
        } else if (proficiencies && typeof proficiencies === 'object') {
            for (const [key, value] of Object.entries(proficiencies)) {
                const name = normalizeProfKey(key);
                if (!name) continue;
                const prof = typeof value === 'number' ? value : Number(value);
                out[name] = Number.isFinite(prof) ? prof : 0;
            }
        }

        for (const [key, value] of Object.entries(ARMOR_PROF_DEFAULTS)) {
            if (out[key] == null) out[key] = value;
        }

        return out;
    };

    next.characters = next.characters.map(c => ({
        ...c,
        proficiencies: normalizeProficiencies(c.proficiencies)
    }));

    if (!next.shop || typeof next.shop !== 'object') next.shop = { availableItems: [], traders: [] };
    if (!Array.isArray(next.shop.availableItems)) next.shop.availableItems = [];
    if (!Array.isArray(next.shop.traders)) next.shop.traders = [];

    return next;
}
