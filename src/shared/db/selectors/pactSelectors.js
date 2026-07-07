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

export function selectPendingPactOffer(actorOrCharacter, db = null) {
    const offer = actorOrCharacter?.pactOffer || actorOrCharacter?.sheet?.pactOffer || null;
    if (!offer || offer.status !== 'pending' || !offer.pactId) return null;
    return {
        ...offer,
        pact: db ? selectPact(db, offer.pactId) : null,
    };
}

export function selectPactUsageByAbility(db) {
    const usage = {};
    for (const pact of selectPactList(db)) {
        for (const group of pact.abilityGroups || []) {
            for (const abilityId of group.abilityIds || []) {
                if (!abilityId) continue;
                if (!usage[abilityId]) usage[abilityId] = [];
                usage[abilityId].push(pact.name || pact.id);
            }
        }
    }
    return usage;
}

export function selectPactAbilityOptions({
    pact,
    abilities,
    characterLevel = 0,
    currentChoices = {},
    slotIndex = 0,
} = {}) {
    if (!pact) return [];
    const abilityMap = buildAbilityMap(abilities);
    const chosenIds = new Set(Object.values(currentChoices || {}).filter(Boolean));
    const level = Number(characterLevel) || 0;
    const options = [];

    (pact.abilityGroups || []).forEach((group, groupIndex) => {
        (group.abilityIds || []).forEach((abilityId) => {
            const ability = abilityMap.get(String(abilityId));
            if (!ability) return;
            const abilityLevel = Number(ability.level) || 0;
            const wrongSlot = groupIndex !== slotIndex;
            const tooHighLevel = abilityLevel > level;
            const alreadyChosen = chosenIds.has(ability.id);
            let disabledReason = '';
            if (alreadyChosen) disabledReason = 'Already learned';
            else if (tooHighLevel) disabledReason = `Requires level ${abilityLevel}`;
            else if (wrongSlot) disabledReason = group.label ? `Unlocked in ${group.label}` : `Unlocked in group ${groupIndex + 1}`;

            options.push({
                ability,
                group,
                groupIndex,
                selectable: !disabledReason,
                disabledReason,
            });
        });
    });

    return options;
}

export function resolvePactDedication(pact, feats = []) {
    const dedication = pact?.dedication || null;
    if (!dedication) return null;
    const rawId = dedication.id || dedication.name || dedication;
    const rawName = dedication.name || dedication.id || dedication;
    const normalizedId = String(rawId || '').toLowerCase();
    const normalizedName = String(rawName || '').toLowerCase();
    const match = (Array.isArray(feats) ? feats : []).find((feat) => {
        const id = String(feat.id || feat.sourceFile || feat.name || '').toLowerCase();
        const name = String(feat.name || '').toLowerCase();
        return id === normalizedId || name === normalizedName;
    });
    return match
        ? { type: 'feat', id: match.id || match.sourceFile || match.name, name: match.name }
        : {
            type: dedication.type || 'feat',
            id: dedication.id || dedication.name || null,
            name: dedication.name || dedication.id || String(dedication),
        };
}

function buildAbilityMap(abilities) {
    if (abilities instanceof Map) return abilities;
    if (Array.isArray(abilities)) {
        return new Map(abilities.map((ability) => [String(ability.id || ability.name), ability]));
    }
    return new Map(Object.values(abilities || {}).map((ability) => [String(ability.id || ability.name), ability]));
}
