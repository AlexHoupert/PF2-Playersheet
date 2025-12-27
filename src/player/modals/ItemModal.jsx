import React from 'react';
import { getShopIndexItemByName } from '../../shared/catalog/shopIndex';
import { formatText, ACTION_ICONS } from '../../shared/utils/rules';
import { useInventoryLogic } from '../../shared/hooks/useInventoryLogic';

export function ItemModal({ character, updateCharacter, modalData, onClose, onOpenContext }) {
    const { isEquipable, toggleEquip } = useInventoryLogic({ character, updateCharacter });

    if (!modalData) return null;

    const isSpell = modalData._entityType === 'spell' || (typeof modalData.casttime === 'string' && typeof modalData.tradition === 'string');
    const isAction = modalData._entityType === 'action' || (typeof modalData.subtype === 'string' && typeof modalData.type === 'string');
    const isImpulse = modalData._entityType === 'impulse';

    // Explicit check first
    const isFeatFromCatalog = modalData._entityType === 'feat';

    const matchesShopItemProps = (
        modalData.price != null ||
        modalData.bulk != null ||
        modalData.rarity != null ||
        modalData.traits?.rarity != null ||
        Array.isArray(modalData?.traits?.value)
    );

    // If it identifies as a feat explicitly, it's not a shop item
    const isShopItem = !isSpell && !isAction && !isImpulse && !isFeatFromCatalog && matchesShopItemProps;

    // Final feat check (explicit or fallback)
    const isFeat = isFeatFromCatalog || (!isShopItem && !isSpell && !isAction && !isImpulse && typeof modalData.type === 'string');

    const titleText = modalData.name || modalData.title || 'Details';

    const itemTraits = Array.isArray(modalData?.traits?.value) ? modalData.traits.value : (Array.isArray(modalData.traits) ? modalData.traits : []);
    const rarity = modalData.rarity || modalData?.traits?.rarity || null;

    const bulk = modalData.bulk?.value ?? modalData.bulk;
    const damage = modalData.damage
        ? (typeof modalData.damage === 'string'
            ? modalData.damage
            : `${modalData.damage.dice}${modalData.damage.die} ${modalData.damage.damageType}`)
        : null;

    // Action specific data
    const actionCost = modalData.actionCost ? (modalData.actionType === 'reaction' ? 'Reaction' : modalData.actionType === 'free' ? 'Free Action' : modalData.actionType === 'passive' ? 'Passive' : `${modalData.actionCost} Action${modalData.actionCost > 1 ? 's' : ''}`) : null;

    const meta = [];
    if (isShopItem) {
        if (modalData.price != null) meta.push(['Price', `${modalData.price} gp`]);
        if (modalData.level != null) meta.push(['Level', modalData.level]);
        if (bulk != null) meta.push(['Bulk', bulk]);
        if (damage) meta.push(['Damage', damage]);
        if (modalData.range != null) meta.push(['Range', modalData.range]);
    } else if (isSpell) {
        if (modalData.level != null) meta.push(['Level', modalData.level]);
        if (modalData.tradition) meta.push(['Tradition', modalData.tradition]);
        if (modalData.casttime) meta.push(['Cast', modalData.casttime]);
        if (modalData.range) meta.push(['Range', modalData.range]);
        if (modalData.target) meta.push(['Target', modalData.target]);
        if (modalData.tags) meta.push(['Tags', modalData.tags]);
    } else if (isImpulse) {
        if (modalData.level != null) meta.push(['Level', modalData.level]);
        if (modalData.time) meta.push(['Time', modalData.time]);
        if (modalData.range) meta.push(['Range', modalData.range]);
        if (modalData.target) meta.push(['Target', modalData.target]);
        if (modalData.area) meta.push(['Area', modalData.area]);
    } else if (isAction) {
        if (modalData.type) meta.push(['Type', modalData.type]);
        if (modalData.subtype) meta.push(['Subtype', modalData.subtype]);
        if (actionCost) meta.push(['Cost', actionCost]);
        if (modalData.category) meta.push(['Category', modalData.category]);
        if (modalData.skill) meta.push(['Skill', modalData.skill]);
        if (modalData.feat) meta.push(['Feat', modalData.feat]);
    } else if (isFeat) {
        if (modalData.type) meta.push(['Type', modalData.type]);
        if (modalData.level) meta.push(['Level', modalData.level]);
        if (modalData.category) meta.push(['Category', modalData.category]);
    }

    const tagBadges = typeof modalData.tags === 'string'
        ? modalData.tags.split(',').map(t => t.trim()).filter(Boolean)
        : [];

    // Inventory Match Logic
    let inventoryMatch = isShopItem && modalData?.name
        ? character.inventory.find(i => i.name === modalData.name && !!i.equipped === !!modalData.equipped)
        : null;

    if (!inventoryMatch && isShopItem && modalData?.name) {
        inventoryMatch = character.inventory.find(i => i.name === modalData.name);
    }

    const canToggleEquip = Boolean(inventoryMatch && isEquipable(inventoryMatch));
    const isEquipped = Boolean(inventoryMatch?.equipped);

    // Type for Context Menu
    const contextType = isSpell ? 'spell' : isFeat ? 'feat' : isImpulse ? 'impulse' : 'item';

    return (
        <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 15 }}>
                <h2 style={{ margin: 0, fontSize: '1.4em', color: 'var(--text-gold)', flex: 1, paddingRight: 10 }}>
                    {titleText}
                    {inventoryMatch && inventoryMatch.qty > 1 && <span style={{ fontSize: '0.6em', color: '#fff', marginLeft: 8 }}>(x{inventoryMatch.qty})</span>}
                </h2>
                <button
                    className="btn-add-condition"
                    style={{ width: 'auto', margin: 0, padding: '4px 10px', fontSize: '0.9em' }}
                    onClick={() => onOpenContext(contextType, modalData)}
                >
                    Options
                </button>
            </div>

            {/* Rarity & Traits */}
            {((itemTraits && itemTraits.length > 0) || rarity || (tagBadges && tagBadges.length > 0)) && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 15 }}>
                    {rarity && (
                        <span style={{
                            background: rarity.toLowerCase() === 'common' ? '#444' : rarity.toLowerCase() === 'uncommon' ? '#d84e09' : rarity.toLowerCase() === 'rare' ? '#0d47a1' : rarity.toLowerCase() === 'unique' ? '#b71c1c' : '#444',
                            color: '#fff', padding: '2px 8px', borderRadius: 4, fontSize: '0.7em', textTransform: 'uppercase', fontWeight: 'bold'
                        }}>
                            {rarity}
                        </span>
                    )}
                    {(itemTraits || []).map(t => (
                        <span key={t} style={{ background: '#333', color: '#ccc', padding: '2px 8px', borderRadius: 4, fontSize: '0.7em', border: '1px solid #555' }}>
                            {t}
                        </span>
                    ))}
                    {(tagBadges).map(t => (
                        <span key={t} style={{ background: '#203a43', color: '#4dd0e1', padding: '2px 8px', borderRadius: 4, fontSize: '0.7em', border: '1px solid #2c5364' }}>
                            {t}
                        </span>
                    ))}
                </div>
            )}

            {/* Meta Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 15, background: '#222', padding: 10, borderRadius: 6 }}>
                {meta.map(([label, val]) => (
                    <div key={label} style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '0.7em', color: '#888', textTransform: 'uppercase' }}>{label}</span>
                        <span style={{ fontSize: '0.9em', color: '#fff' }}>{val}</span>
                    </div>
                ))}
            </div>

            {/* Description */}
            <div
                className="formatted-content"
                dangerouslySetInnerHTML={{ __html: formatText(modalData.description || modalData.desc || (modalData.system && modalData.system.description && modalData.system.description.value) || "No description available.") }}
                style={{ maxHeight: '40vh', overflowY: 'auto', marginBottom: 20 }}
            />

            {/* Actions */}
            <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                {canToggleEquip ? (
                    <button
                        type="button"
                        onClick={() => toggleEquip(inventoryMatch)}
                        className="set-btn"
                        style={{
                            flex: 1,
                            background: isEquipped ? 'var(--bg-dark)' : 'var(--text-gold)',
                            color: isEquipped ? 'var(--text-gold)' : '#000',
                            border: '1px solid var(--text-gold)'
                        }}
                    >
                        {isEquipped ? 'Unequip' : 'Equip'}
                    </button>
                ) : null}
            </div>
        </>
    );
}
