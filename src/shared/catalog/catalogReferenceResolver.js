import { getAllActionIndexItems } from './actionIndex.js';
import { getAllAbilities } from './abilityIndex.js';
import { getAllCreatures } from './creatureIndex.js';
import { FEAT_INDEX_ITEMS } from './featIndex.js';
import { IMPULSE_INDEX_ITEMS } from './impulseIndex.js';
import { SHOP_INDEX_ITEMS } from './shopIndex.js';
import { SPELL_INDEX_ITEMS } from './spellIndex.js';
import { normalizeCatalogType } from './catalogDetailCore.js';
import { createCatalogReference } from '../clipboard/refClipboard.js';
import {
    resolveCatalogLinkCore,
    resolveCatalogReferenceCore,
    resolveCatalogReferenceEntryCore,
} from './catalogReferenceResolverCore.js';

export function getStaticCatalogItems(catalogType) {
    switch (normalizeCatalogType(catalogType)) {
        case 'action':
            return getAllActionIndexItems();
        case 'ability':
            return getAllAbilities();
        case 'creature':
            return getAllCreatures();
        case 'feat':
            return FEAT_INDEX_ITEMS;
        case 'impulse':
            return IMPULSE_INDEX_ITEMS;
        case 'spell':
            return SPELL_INDEX_ITEMS;
        case 'item':
        default:
            return SHOP_INDEX_ITEMS;
    }
}

export function resolveCatalogReference(refLike, source = null, options = {}) {
    const ref = createCatalogReference(
        options.catalogType || refLike?.catalogType || refLike?.type,
        refLike?.data?.catalogRef || refLike?.catalogRef || refLike
    );
    const catalogType = normalizeCatalogType(ref.catalogType);
    const staticItems = options.staticItems || getStaticCatalogItems(catalogType);
    return resolveCatalogReferenceCore(ref, source, { ...options, catalogType, staticItems });
}

export function resolveCatalogReferenceEntry(refLike, source = null, options = {}) {
    return resolveCatalogReferenceEntryCore(refLike, source, {
        ...options,
        staticItems: options.staticItems || getStaticCatalogItems(options.catalogType || refLike?.catalogType || refLike?.type),
    });
}

export function resolveCatalogLink(type, name, source = null, options = {}) {
    return resolveCatalogLinkCore(type, name, source, {
        ...options,
        staticItems: options.staticItems || getStaticCatalogItems(type),
    });
}
