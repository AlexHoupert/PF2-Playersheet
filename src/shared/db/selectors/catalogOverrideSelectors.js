import {
    buildCatalogEntryStates,
    overrideToCatalogItem,
    selectDeletedCatalogEntriesFromStates,
    selectVisibleCatalogEntriesFromStates,
} from '../../catalog/catalogEntryModel.js';

export { overrideToCatalogItem } from '../../catalog/catalogEntryModel.js';

export function selectCatalogOverrides(source, catalogType = null) {
    const overrides = source?.catalogOverrides || {};
    const byId = new Map();
    for (const override of [
        ...Object.values(overrides),
        ...selectLegacyCatalogOverrides(source, catalogType),
    ]) {
        if (!override?.id) continue;
        byId.set(override.id, override);
    }
    return [...byId.values()]
        .filter(Boolean)
        .filter((override) => !catalogType || override.catalogType === catalogType);
}

export function selectCatalogOverrideEntries(source, catalogType) {
    return selectCatalogOverrides(source, catalogType)
        .filter((override) => override.mode !== "hide")
        .map(overrideToCatalogItem)
        .filter((item) => item?.name);
}

export function selectCatalogEntryStates(staticItems = [], source, catalogType) {
    return buildCatalogEntryStates({
        staticItems,
        overrides: selectCatalogOverrides(source, catalogType),
        catalogType,
    });
}

export function selectVisibleCatalogEntries(staticItems = [], source, catalogType) {
    return selectVisibleCatalogEntriesFromStates(selectCatalogEntryStates(staticItems, source, catalogType));
}

export function selectDeletedCatalogEntries(staticItems = [], source, catalogType) {
    return selectDeletedCatalogEntriesFromStates(selectCatalogEntryStates(staticItems, source, catalogType));
}

export function mergeCatalogIndexWithOverrides(staticItems = [], source, catalogType) {
    return selectVisibleCatalogEntries(staticItems, source, catalogType);
}

function selectLegacyCatalogOverrides(source, catalogType) {
    const overrides = [];
    if (!catalogType || catalogType === 'item') {
        overrides.push(...Object.values(source?.shop?.customItems || {}).map(itemToCatalogOverride).filter(Boolean));
    }
    if (!catalogType || catalogType === 'action') {
        overrides.push(...Object.values(source?.actions || {}).map(actionToCatalogOverride).filter(Boolean));
    }
    if (!catalogType || catalogType === 'ability') {
        overrides.push(...Object.values(source?.abilities?.custom || {}).map(abilityToCatalogOverride).filter(Boolean));
    }
    if (!catalogType || catalogType === 'creature') {
        overrides.push(...Object.values(source?.bestiary?.customCreatures || {}).map(creatureToCatalogOverride).filter(Boolean));
    }
    return overrides;
}

function itemToCatalogOverride(item) {
    if (!item?.name) return null;
    const safeId = safeCatalogId(item.id || item._id || item.name);
    return {
        id: item.catalogOverrideId || `item_${safeId}`,
        catalogType: 'item',
        baseId: null,
        mode: 'custom',
        label: item.name,
        payload: {
            ...item,
            id: item.id || safeId,
            _id: item._id || item.id || safeId,
            isCustom: true,
            sourceFile: null,
        },
        sourceFile: null,
        legacySource: 'shop.customItems',
    };
}

function actionToCatalogOverride(action) {
    if (!action?.name) return null;
    const sys = action.system || {};
    const cls = sys.classification || {};
    const actionType = sys.actionType?.value;
    const actionCount = sys.actions?.value;
    const safeId = safeCatalogId(action.id || action.name);
    const payload = {
        ...action,
        id: action.id || safeId,
        _id: action._id || action.id || safeId,
        isCustom: true,
        sourceFile: null,
        typeCode: action.typeCode || actionTypeToCode(actionType, actionCount),
        userType: cls.type || action.userType || (action.type !== 'action' ? action.type : '') || 'Other',
        userSubtype: cls.subtype || action.userSubtype || action.subtype || 'General',
        skill: cls.skill || action.skill || '',
        feat: cls.feat || action.feat || '',
        traits: sys.traits?.value || action.traits || [],
        description: sys.description?.value || action.description || '',
    };
    return {
        id: `action_${payload.id}`,
        catalogType: 'action',
        baseId: null,
        mode: 'custom',
        label: payload.name,
        payload,
        sourceFile: null,
        legacySource: 'db.actions',
    };
}

function abilityToCatalogOverride(ability) {
    if (!ability?.name) return null;
    const safeId = safeCatalogId(ability.id || ability._id || ability.name);
    return {
        id: ability.catalogOverrideId || `ability_${safeId}`,
        catalogType: 'ability',
        baseId: null,
        mode: 'custom',
        label: ability.name,
        payload: {
            ...ability,
            id: ability.id || safeId,
            _id: ability._id || ability.id || safeId,
            isCustom: true,
            sourceFile: null,
        },
        sourceFile: null,
        legacySource: 'abilities.custom',
    };
}

function creatureToCatalogOverride(creature) {
    if (!creature?.name) return null;
    const safeId = safeCatalogId(creature.id || creature._id || creature.name);
    return {
        id: creature.catalogOverrideId || `creature_${safeId}`,
        catalogType: 'creature',
        baseId: null,
        mode: 'custom',
        label: creature.name,
        payload: {
            ...creature,
            id: creature.id || safeId,
            _id: creature._id || creature.id || safeId,
            isCustom: true,
            sourceFile: null,
        },
        sourceFile: null,
        legacySource: 'bestiary.customCreatures',
    };
}

function actionTypeToCode(actionType, actionCount) {
    if (actionType === 'reaction') return 'R';
    if (actionType === 'free') return 'F';
    if (actionType === 'passive') return 'P';
    return String(actionCount || 1);
}

function safeCatalogId(value) {
    return String(value || 'catalog_entry')
        .replace(/[^a-z0-9_-]+/gi, '_')
        .replace(/^_+|_+$/g, '')
        .toLowerCase() || 'catalog_entry';
}
