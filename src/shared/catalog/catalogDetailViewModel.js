import { inferCatalogEntityType, normalizeCatalogType } from './catalogDetailCore.js';
import { isArmorOrShieldItem, readItemArmorStats } from './itemArmorStats.js';

const ACTION_COST_LABELS = Object.freeze({
    1: '1 Action',
    2: '2 Actions',
    3: '3 Actions',
    F: 'Free Action',
    P: 'Passive',
    R: 'Reaction',
});

export function buildCatalogDetailViewModel({ catalogType, entry } = {}) {
    const entity = entry || {};
    const type = normalizeCatalogType(catalogType || inferCatalogEntityType(entity));
    const traits = normalizeTraits(entity.traits);
    const rarity = String(entity.rarity || entity.traits?.rarity || 'common').toLowerCase();
    const level = firstDefined(entity.level, entity.rank, entity.system?.level?.value);

    return {
        catalogType: type,
        id: entity.id || entity._id || entity.baseId || entity.sourceFile || entity.name || 'catalog-entry',
        name: entity.name || 'Unnamed entry',
        subtitle: buildSubtitle(type, entity),
        levelLabel: buildLevelLabel(type, level, entity),
        image: resolveCatalogImageUrl(entity.img || entity.image),
        rarity,
        traits,
        metadata: buildMetadata(type, entity, { level, rarity }),
        description: entity.description || entity.system?.description?.value || '',
        raw: entity,
    };
}

export function normalizeTraits(traits) {
    const values = Array.isArray(traits)
        ? traits
        : Array.isArray(traits?.value)
            ? traits.value
            : typeof traits === 'string'
                ? traits.split(',')
                : [];
    return [...new Set(values.map((trait) => String(trait || '').trim()).filter(Boolean))];
}

export function resolveCatalogImageUrl(path, { isProd = Boolean(import.meta.env?.PROD) } = {}) {
    if (!path) return null;
    const value = String(path).trim();
    if (!value) return null;
    if (/^(?:data:|blob:|https?:\/\/)/i.test(value)) return value;
    const cleanPath = value
        .replace(/^\/+/, '')
        .replace(/^systems\/pf2e\//, '')
        .replace(/^ressources\//, '');
    const baseUrl = isProd ? '/ressources' : '/api/static';
    return `${baseUrl}/${cleanPath}`;
}

function buildSubtitle(type, entry) {
    if (type === 'item') return [entry.type, entry.category, entry.group].filter(Boolean).join(' / ');
    if (type === 'action') return [entry.type || entry.userType, entry.subtype || entry.userSubtype].filter(Boolean).join(' / ');
    if (type === 'ability') return entry.type || entry.category || 'Ability';
    return type.charAt(0).toUpperCase() + type.slice(1);
}

function buildLevelLabel(type, level, entry) {
    if (type === 'spell' || type === 'impulse') return level != null ? `Rank ${level}` : '';
    if (type === 'feat' || type === 'item' || type === 'ability') return level != null ? `Level ${level}` : '';
    if (type === 'action') {
        const code = firstDefined(entry.typeCode, entry.actionCost, entry.actionType);
        return ACTION_COST_LABELS[code] || formatActionType(code);
    }
    return '';
}

function buildMetadata(type, entry, { level, rarity }) {
    const metadata = [];
    if (type === 'item') {
        pushMeta(metadata, 'Level', level);
        pushMeta(metadata, 'Rarity', rarity, { capitalize: true });
        pushMeta(metadata, 'Price', formatPrice(entry.price));
        pushMeta(metadata, 'Bulk', entry.bulk);
        pushMeta(metadata, 'Range', formatRange(entry.range));
        if (isArmorOrShieldItem(entry)) {
            const armor = readItemArmorStats(entry);
            pushMeta(metadata, 'AC Bonus', armor.acBonus == null ? null : formatSigned(armor.acBonus));
            pushMeta(metadata, 'Dex Cap', armor.dexCap);
        }
        pushMeta(metadata, 'Damage', formatItemDamage(entry));
        return metadata;
    }

    if (type === 'spell' || type === 'impulse') {
        pushMeta(metadata, 'Rank', level);
        pushMeta(metadata, 'Traditions', joinValues(entry.traditions || entry.tradition));
        pushMeta(metadata, 'Cast', entry.time || entry.cast || entry.actionType);
        pushMeta(metadata, 'Range', entry.range);
        pushMeta(metadata, 'Area', entry.area);
        pushMeta(metadata, 'Target', entry.target);
        pushMeta(metadata, 'Duration', entry.duration);
        pushMeta(metadata, 'Defense', entry.defense || entry.save);
        return metadata;
    }

    if (type === 'feat') {
        pushMeta(metadata, 'Level', level);
        pushMeta(metadata, 'Category', entry.category, { capitalize: true });
        pushMeta(metadata, 'Action', entry.actionType || ACTION_COST_LABELS[entry.typeCode]);
        pushMeta(metadata, 'Prerequisites', joinValues(entry.prerequisites));
        return metadata;
    }

    if (type === 'action') {
        pushMeta(metadata, 'Cost', ACTION_COST_LABELS[entry.typeCode || entry.actionCost] || formatActionType(entry.actionType));
        pushMeta(metadata, 'Type', entry.type || entry.userType);
        pushMeta(metadata, 'Subtype', entry.subtype || entry.userSubtype);
        pushMeta(metadata, 'Skill', entry.skill);
        pushMeta(metadata, 'Prerequisite Feat', entry.feat);
        pushMeta(metadata, 'Prerequisites', joinValues(entry.prerequisites));
        return metadata;
    }

    pushMeta(metadata, 'Level', level);
    pushMeta(metadata, 'Rarity', rarity === 'common' ? null : rarity, { capitalize: true });
    pushMeta(metadata, 'Category', entry.category || entry.type);
    pushMeta(metadata, 'Action', entry.actionType || ACTION_COST_LABELS[entry.typeCode]);
    pushMeta(metadata, 'Frequency', entry.frequency);
    pushMeta(metadata, 'Trigger', entry.trigger);
    pushMeta(metadata, 'Requirements', entry.requirements);
    return metadata;
}

function formatItemDamage(entry) {
    const extras = entry.extraDamage || entry.system?.extraDamage;
    const damageEntries = [entry.damage, ...(Array.isArray(extras) ? extras : [])];
    const parts = damageEntries.map(formatDamage).filter(Boolean);
    return parts.length ? parts.join(' + ') : null;
}

function formatDamage(damage) {
    if (!damage) return null;
    if (typeof damage === 'string') return damage;
    const die = damage.die || (damage.faces ? `d${damage.faces}` : null);
    if (!die) return null;
    const base = `${damage.dice || damage.number || 1}${die} ${damage.damageType || damage.type || ''}`.trim();
    if (!damage.persistent) return base;
    const persistent = damage.persistent;
    const formula = persistent.formula || `${persistent.number || 1}${persistent.faces ? `d${persistent.faces}` : ''}`;
    return `${base} plus ${formula} persistent ${persistent.damageType || persistent.type || ''}`.trim();
}

function formatPrice(price) {
    if (price == null || price === '') return null;
    if (typeof price === 'number') return `${price} gp`;
    if (typeof price === 'string') return price.match(/[a-z]/i) ? price : `${price} gp`;
    if (typeof price === 'object') {
        return Object.entries(price)
            .filter(([, value]) => Number(value) > 0)
            .map(([coin, value]) => `${value} ${coin}`)
            .join(' ') || null;
    }
    return String(price);
}

function formatRange(range) {
    if (range == null || range === '') return null;
    return typeof range === 'number' ? `${range} ft` : range;
}

function joinValues(value) {
    if (Array.isArray(value)) {
        return value.map((entry) => typeof entry === 'object' ? entry.value || entry.name : entry).filter(Boolean).join(', ');
    }
    return value;
}

function formatActionType(value) {
    if (!value) return '';
    const normalized = String(value).toLowerCase();
    if (normalized === 'reaction') return 'Reaction';
    if (normalized === 'free') return 'Free Action';
    if (normalized === 'passive') return 'Passive';
    return String(value);
}

function pushMeta(target, label, value, options = {}) {
    if (value === undefined || value === null || value === '') return;
    target.push({ label, value: String(value), ...options });
}

function firstDefined(...values) {
    return values.find((value) => value !== undefined && value !== null && value !== '');
}

function formatSigned(value) {
    return Number(value) >= 0 ? `+${value}` : String(value);
}
