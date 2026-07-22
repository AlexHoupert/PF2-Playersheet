export function getWeaponAmmunitionKind(weapon) {
    const item = weapon;
    const ammoBaseType = normalizeText(
        item?.system?.ammo?.baseType
        || item?.ammo?.baseType
        || item?.ammo
    );
    const name = normalizeText(item?.name);
    const group = normalizeText(item?.group);
    const traits = normalizeTraits(item?.traits);
    const tags = normalizeTraits(item?.tags);
    const searchable = [ammoBaseType, name, group, ...traits, ...tags].join(' ');

    if (/\b(crossbow|bolt)s?\b/.test(searchable)) return 'bolt';
    if (/\b(shortbow|longbow|bow|arrow)s?\b/.test(searchable)) return 'arrow';
    if (/\b(firearm|gun|pistol|musket|jezail|arquebus|rifle|round)s?\b/.test(searchable)) return 'round';
    return null;
}

export function isAmmunitionItem(item) {
    if (!item) return false;
    const type = normalizeText(item?.type);
    const category = normalizeText(item?.category);
    const group = normalizeText(item?.group);
    const traits = normalizeTraits(item?.traits);
    const name = normalizeText(item?.name);

    return type === 'ammo'
        || type === 'ammunition'
        || category === 'ammo'
        || category === 'ammunition'
        || group === 'ammo'
        || group === 'ammunition'
        || traits.includes('ammunition')
        || /^(arrows?|bolts?|rounds?)(?:\s|\(|$)/.test(name);
}

export function isBasicAmmunitionItem(item) {
    return isAmmunitionItem(item)
        && /^(arrows?|bolts?|rounds?)(?:\s|\(|$)/i.test(String(item?.name || ''));
}

export function isCompatibleAmmunition(weapon, ammunition) {
    if (!isAmmunitionItem(ammunition) || Number(ammunition?.qty ?? 1) <= 0) return false;

    const requiredKind = getWeaponAmmunitionKind(weapon);
    if (!requiredKind) return true;

    const name = normalizeText(ammunition?.name);
    if (requiredKind === 'round') return /\brounds?\b/.test(name);
    if (requiredKind === 'bolt') return /\bbolts?\b/.test(name);
    if (requiredKind === 'arrow') return /\barrows?\b/.test(name);
    return false;
}

function normalizeTraits(value) {
    const raw = Array.isArray(value?.value)
        ? value.value
        : Array.isArray(value)
            ? value
            : typeof value === 'string'
                ? value.split(',')
                : [];
    return raw.map(normalizeText).filter(Boolean);
}

function normalizeText(value) {
    return String(value || '').trim().toLowerCase();
}
