const SPELLCASTING_MODES = new Set(['prepared', 'spontaneous', 'innate', 'focus']);

function numberOrFallback(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function unwrapValue(value) {
    if (value && typeof value === 'object' && 'value' in value) return value.value;
    return value;
}

function normalizeTypedValues(values = [], { includeValue = true } = {}) {
    const source = Array.isArray(values) ? values : Object.values(values || {});
    return source
        .map((entry) => {
            if (typeof entry === 'string') {
                return includeValue ? { type: entry, value: 0 } : { type: entry };
            }
            const type = String(entry?.type || entry?.label || entry?.name || '').trim();
            if (!type) return null;
            return includeValue
                ? { type, value: numberOrFallback(entry?.value, 0) }
                : { type };
        })
        .filter(Boolean)
        .sort((left, right) => left.type.localeCompare(right.type));
}

function normalizeSkills(skills = {}) {
    if (Array.isArray(skills)) {
        return skills
            .map((skill) => {
                const key = String(skill?.key || skill?.name || '').trim();
                const bonus = numberOrFallback(skill?.bonus ?? skill?.value, Number.NaN);
                if (!key || !Number.isFinite(bonus)) return null;
                return {
                    key,
                    label: String(skill?.label || key)
                        .replace(/[-_]+/g, ' ')
                        .replace(/\b\w/g, character => character.toUpperCase()),
                    bonus,
                };
            })
            .filter(Boolean)
            .sort((left, right) => right.bonus - left.bonus || left.label.localeCompare(right.label));
    }
    return Object.entries(skills || {})
        .map(([key, raw]) => {
            const bonus = numberOrFallback(raw?.base ?? raw?.value ?? raw?.mod ?? raw, Number.NaN);
            if (!Number.isFinite(bonus)) return null;
            const label = String(raw?.label || key)
                .replace(/[-_]+/g, ' ')
                .replace(/\b\w/g, character => character.toUpperCase());
            return { key, label, bonus };
        })
        .filter(Boolean)
        .sort((left, right) => right.bonus - left.bonus || left.label.localeCompare(right.label));
}

function getAttackGeometry(item) {
    if (item?.type !== 'melee') return null;
    const range = item.system?.range;
    const increment = numberOrFallback(range?.increment, 0);
    const maximum = numberOrFallback(range?.max, 0);
    return range && (increment > 0 || maximum > 0) ? 'ranged' : 'melee';
}

function isShieldItem(item) {
    const category = String(unwrapValue(item?.system?.category) || '').toLowerCase();
    const armorCategory = String(unwrapValue(item?.system?.category) || unwrapValue(item?.system?.armorType) || '').toLowerCase();
    const traits = item?.system?.traits?.value || [];
    const name = String(item?.name || '').toLowerCase();
    if (category === 'shield' || armorCategory === 'shield') return true;
    if (Array.isArray(traits) && traits.some(trait => String(trait).toLowerCase() === 'shield')) return true;
    return /\b(raise a shield|shield block)\b/.test(name);
}

function getSpellcastingMode(item) {
    if (item?.type !== 'spellcastingEntry') return null;
    const raw = String(unwrapValue(item.system?.prepared) || item.system?.prepared?.value || '').toLowerCase();
    return SPELLCASTING_MODES.has(raw) ? raw : null;
}

export function getCreatureData(creatureData = {}) {
    return creatureData?.data && typeof creatureData.data === 'object'
        ? creatureData.data
        : creatureData || {};
}

export function buildCreatureTableSummary(creatureData = {}) {
    const data = getCreatureData(creatureData);
    const system = data.system || {};
    const attributes = system.attributes || {};
    const items = Array.isArray(data.items) ? data.items : [];
    const attackGeometries = new Set(items.map(getAttackGeometry).filter(Boolean));
    const spellcastingModes = [...new Set(items.map(getSpellcastingMode).filter(Boolean))].sort();
    const fallbackSpellcastingModes = [...new Set(creatureData?.spellcastingModes || [])]
        .filter(mode => SPELLCASTING_MODES.has(mode));
    const hasSpellItems = items.some(item => item?.type === 'spell');

    const fallback = creatureData || {};
    const size = String(unwrapValue(system.traits?.size) || fallback.size || 'med');
    const speed = numberOrFallback(attributes.speed?.value ?? system.speed?.value ?? fallback.speed, 0);
    const skills = normalizeSkills(system.skills || fallback.skills || {});
    const resistances = normalizeTypedValues(attributes.resistances || fallback.resistances);
    const weaknesses = normalizeTypedValues(attributes.weaknesses || fallback.weaknesses);
    const immunities = normalizeTypedValues(attributes.immunities || fallback.immunities, { includeValue: false });

    return {
        ac: numberOrFallback(attributes.ac?.value ?? fallback.ac, 10),
        hp: numberOrFallback(attributes.hp?.max ?? attributes.hp?.value ?? fallback.hp, 0),
        fortitude: numberOrFallback(system.saves?.fortitude?.value ?? fallback.fortitude, 0),
        reflex: numberOrFallback(system.saves?.reflex?.value ?? fallback.reflex, 0),
        will: numberOrFallback(system.saves?.will?.value ?? fallback.will, 0),
        perception: numberOrFallback(system.perception?.mod ?? system.perception?.value ?? fallback.perception, 0),
        speed,
        size,
        resistances,
        weaknesses,
        immunities,
        skills,
        highestSkillBonus: skills[0]?.bonus ?? null,
        hasMelee: attackGeometries.has('melee') || Boolean(fallback.hasMelee),
        hasRanged: attackGeometries.has('ranged') || Boolean(fallback.hasRanged),
        hasMagic: spellcastingModes.length > 0 || fallbackSpellcastingModes.length > 0 || hasSpellItems || Boolean(fallback.hasMagic),
        hasShield: items.some(isShieldItem) || Boolean(fallback.hasShield),
        spellcastingModes: spellcastingModes.length > 0
            ? spellcastingModes
            : fallbackSpellcastingModes,
    };
}

export function formatTypedCreatureValues(values = []) {
    return (values || [])
        .map(entry => entry?.value ? `${entry.type} ${entry.value}` : entry?.type)
        .filter(Boolean)
        .join(', ');
}

export function getCreatureSkillBonus(summary, skillKey) {
    return summary?.skills?.find(skill => skill.key === skillKey)?.bonus ?? null;
}
