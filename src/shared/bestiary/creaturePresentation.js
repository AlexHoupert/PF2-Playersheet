export const DEFAULT_CREATURE_REVEAL_STATE = {
    name: 'hidden',
    level: 'hidden',
    traits: 'hidden',
    ac: 'hidden',
    hp: 'hidden',
    saves: 'hidden',
    immunities: 'hidden',
    resistances: 'hidden',
    weaknesses: 'hidden',
    speed: 'hidden',
    attacks: 'hidden',
    abilities: 'hidden',
    perception: 'hidden',
    senses: 'hidden',
    skills: 'hidden',
    attributes: 'hidden',
    size: 'precise',
};

export function normalizeCreatureRevealState(revealState = {}) {
    return { ...DEFAULT_CREATURE_REVEAL_STATE, ...(revealState || {}) };
}

export function buildCreatureViewModel(creature, metadata = {}, options = {}) {
    const data = creature?.data || creature || {};
    const system = data.system || {};
    const traits = system.traits || data.traits || {};
    const details = system.details || data.details || {};
    const isCustom = Boolean(options.isCustom ?? creature?.isCustom);
    const id = options.id || creature?.id || creature?._id || data._id || data.name;

    return {
        id,
        sourceFile: creature?.sourceFile || null,
        type: options.type || creature?.type || data.type || 'npc',
        name: creature?.name || data.name || 'Unknown',
        unknownName: creature?.unknownName || data.unknownName || metadata.unknownName || '???',
        level: creature?.level ?? details.level?.value ?? 0,
        rarity: creature?.rarity || traits.rarity || 'common',
        traits: creature?.traits || traits.value || [],
        group: metadata.group || creature?.group || 'Uncategorized',
        bestiary: Boolean(metadata.bestiary ?? creature?.bestiary),
        revealState: normalizeCreatureRevealState(metadata.revealState || creature?.revealState),
        falseData: metadata.falseData || creature?.falseData,
        isCustom,
        data: creature?.data || options.data || null,
    };
}

export function selectVisibleCreatureFields(viewModel, viewerMode = 'player') {
    const isGM = viewerMode === 'gm';
    const reveal = normalizeCreatureRevealState(viewModel?.revealState);
    const nameVisible = isGM || reveal.name === 'precise';
    const levelVisible = isGM || reveal.level === 'precise';
    return {
        name: nameVisible ? viewModel?.name : (viewModel?.unknownName || '???'),
        level: levelVisible ? viewModel?.level : null,
        nameVisible,
        levelVisible,
        revealState: reveal,
    };
}

export function buildCreatureSkillViewModel(name, skillData = {}, context = {}) {
    const label = String(name || '')
        .split(/[-_\s]+/)
        .filter(Boolean)
        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
    const bonus = Number(skillData.base ?? skillData.value ?? skillData.mod ?? 0);
    const specials = Array.isArray(skillData.special) ? skillData.special : [];
    return {
        id: name,
        name,
        label: label || 'Skill',
        bonus,
        specials: specials.map((special, index) => ({
            id: `${name}-special-${index}`,
            label: special.label || special.name || 'Special',
            bonus: Number(special.base ?? special.value ?? special.mod ?? bonus),
            raw: special,
        })),
        notes: skillData.notes || skillData.details || skillData.description || '',
        raw: skillData,
        creatureName: context.creatureName || '',
        creatureLevel: context.creatureLevel ?? null,
    };
}

export function buildBestiaryCreatureEntries({ indexItems = [], customCreatures = {}, metadata = {}, includeUnpublished = true } = {}) {
    const customEntries = Object.values(customCreatures || {}).map(record => {
        const viewModel = buildCreatureViewModel(record, metadata?.[record.id] || {}, {
            id: record.id,
            type: record.type || 'npc',
            isCustom: true,
            data: record.data,
        });
        return viewModel;
    });

    const catalogEntries = (indexItems || []).map(item => buildCreatureViewModel(item, metadata?.[item.id] || {}, {
        id: item.id,
        type: item.type || 'npc',
        isCustom: false,
    }));

    const seenIds = new Set();
    return [...customEntries, ...catalogEntries]
        .filter(entry => {
            if (!entry?.id || seenIds.has(entry.id)) return false;
            seenIds.add(entry.id);
            return includeUnpublished || entry.bestiary;
        })
        .sort((a, b) => a.name.localeCompare(b.name));
}
