export function migrateDb(db) {
    const next = db && typeof db === 'object' ? db : {};

    // --- 1. Schema Initialization ---
    if (!next.campaigns || typeof next.campaigns !== 'object') next.campaigns = {};
    if (!next.users || typeof next.users !== 'object') next.users = {};
    if (!next.library || typeof next.library !== 'object') next.library = {};

    // --- 2. Legacy Migration (Root -> Default Campaign) ---
    // Detect if we have legacy data sitting at the root
    const rootChars = Array.isArray(next.characters) ? next.characters : [];
    const rootQuests = Array.isArray(next.quests) ? next.quests : [];
    const rootLoot = Array.isArray(next.lootBags) ? next.lootBags : [];

    // If we have data at root but NO campaigns, migrate it.
    if ((rootChars.length > 0 || rootQuests.length > 0 || rootLoot.length > 0) && Object.keys(next.campaigns).length === 0) {
        console.log("Migrating Legacy Data to Default Campaign...");
        const defaultId = 'campaign_' + Date.now(); // Simple ID
        next.campaigns[defaultId] = {
            id: defaultId,
            name: 'Default Campaign',
            characters: rootChars,
            quests: rootQuests,
            lootBags: rootLoot,
            createdAt: Date.now()
        };

        // Clear root arrays to complete move
        next.characters = [];
        next.quests = [];
        next.lootBags = [];
    }

    // Ensure root arrays exist but are empty (or keep them for backwards compat if needed, but we prefer strict)
    // We will keep them as empty arrays so old code doesn't crash immediately if it reads root
    if (!Array.isArray(next.characters)) next.characters = [];
    if (!Array.isArray(next.quests)) next.quests = [];
    if (!Array.isArray(next.lootBags)) next.lootBags = [];


    // --- 3. Data Normalization Helper ---
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

    const normalizeCharacter = (c) => {
        return {
            ...c,
            initiative: c.initiative ?? 0,
            proficiencies: normalizeProficiencies(c.proficiencies)
        };
    };

    // --- 4. Deep Normalization (Across all campaigns) ---
    Object.values(next.campaigns).forEach(campaign => {
        if (!Array.isArray(campaign.characters)) campaign.characters = [];
        if (!Array.isArray(campaign.quests)) campaign.quests = [];
        if (!Array.isArray(campaign.lootBags)) campaign.lootBags = [];

        campaign.characters = campaign.characters.map(normalizeCharacter);
    });

    // Also normalize root characters if any remain (though we moved them)
    next.characters = next.characters.map(normalizeCharacter);


    // --- 5. Shop Normalization (Global) ---
    if (!next.shop || typeof next.shop !== 'object') next.shop = { availableItems: [], traders: [] };
    if (!Array.isArray(next.shop.availableItems)) next.shop.availableItems = [];
    if (!Array.isArray(next.shop.traders)) next.shop.traders = [];

    return next;
}
