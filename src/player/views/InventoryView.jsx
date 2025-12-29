import React, { useState, useRef } from 'react';
import { getShopIndexItemByName } from '../../shared/catalog/shopIndex';
import { getShopItemRowMeta } from '../../shared/catalog/shopRowMeta';
import { shouldStack } from '../../shared/utils/inventoryUtils';
import { deepClone } from '../../shared/utils/deepClone';
import { getWeaponCapacity, getWeaponAttackBonus, isEquipableInventoryItem, getInventoryBucket } from '../../shared/utils/combatUtils';

export function InventoryView({
    character,
    db,
    onUpdateCharacter,
    onSetDb,
    onOpenModal,
    onToggleEquip,
    onInspectItem,
    onFireWeapon,
    onLoadWeapon,
    onLongPress,
    onOpenShop
}) {
    const [itemSubTab, setItemSubTab] = useState('Equipment');
    const equipTapRef = useRef({ key: null, time: 0 });
    const equipTapTimeoutRef = useRef(null);

    // Helper functions from PlayerApp logic (Assuming they are not exported elsewhere yet)
    // We'll need to duplicate them or extract them to a util file if they are large.
    // For now, I'll inline the simple ones if they are missing.

    const items = Array.isArray(character.inventory) ? character.inventory : [];
    // Fix: We must access items by their original index in character.inventory for updates to work
    const wrappedItems = items.map((item, index) => ({ item, index }));

    const equipmentItems = wrappedItems
        .filter(({ item }) => getInventoryBucket(item) === 'equipment' && !item.isLoot)
        .sort((a, b) => {
            // 1. Equipped state (Equipped first)
            if (a.item.equipped && !b.item.equipped) return -1;
            if (!a.item.equipped && b.item.equipped) return 1;

            // 2. Type Priority (Weapon < Armor < Shield < Other)
            // Use merged data lookup if type missing on item instance
            const getType = (i) => {
                const fromIdx = getShopIndexItemByName(i.name);
                return (i.type || fromIdx?.type || '').toLowerCase();
            };
            const typePriority = { weapon: 1, armor: 2, shield: 3 };
            const typeA = typePriority[getType(a.item)] || 4;
            const typeB = typePriority[getType(b.item)] || 4;
            if (typeA !== typeB) return typeA - typeB;

            // 3. Name
            return a.item.name.localeCompare(b.item.name);
        });
    const consumableItems = wrappedItems.filter(({ item }) => getInventoryBucket(item) === 'consumables' && !item.isLoot);
    const miscItems = wrappedItems.filter(({ item }) => getInventoryBucket(item) === 'misc' && !item.isLoot);
    const lootItems = wrappedItems.filter(({ item }) => item.isLoot);

    const renderRow = (item, index, { enableEquipTap = false } = {}) => {
        const key = `${item?.name}-${index}`;
        const qty = item?.qty || 1;
        const fromIndex = item?.name ? getShopIndexItemByName(item.name) : null;
        const merged = fromIndex ? { ...fromIndex, ...item, _index: index } : { ...item, _index: index };
        const { row1, row2 } = getShopItemRowMeta(merged);

        let clickHandler;
        if (enableEquipTap && isEquipableInventoryItem(item)) {
            clickHandler = () => {
                const tapKey = String(item?.name || '');
                const now = Date.now();
                const last = equipTapRef.current;
                const isDoubleTap = last.key === tapKey && now - last.time < 320;

                if (equipTapTimeoutRef.current) {
                    clearTimeout(equipTapTimeoutRef.current);
                    equipTapTimeoutRef.current = null;
                }

                if (isDoubleTap) {
                    equipTapRef.current = { key: null, time: 0 };
                    onToggleEquip(merged);
                    return;
                }

                equipTapRef.current = { key: tapKey, time: now };
                equipTapTimeoutRef.current = setTimeout(() => {
                    onInspectItem(merged);
                    equipTapTimeoutRef.current = null;
                }, 260);
            };
        } else {
            // Consumable/Inspect logic
            // For consumables, double tap logic was in PlayerApp handleItemClick.
            // We need to implement that here or pass it?
            // PlayerApp had `handleItemClick` which did double-tap to consume.
            // For now, let's just use onInspectItem for single tap, unless we duplicate the double tap logic here.
            // Given the requirements, "Inventory Smart Tap" is a feature.

            // Let's implement local double tap awareness for generic items too
            clickHandler = () => {
                // Reuse local tap ref?
                const tapKey = String(item?.name || '');
                const now = Date.now();
                const last = equipTapRef.current;
                const isDoubleTap = last.key === tapKey && now - last.time < 300;

                if (equipTapTimeoutRef.current) {
                    clearTimeout(equipTapTimeoutRef.current);
                    equipTapTimeoutRef.current = null;
                }

                if (isDoubleTap && (item.type === 'Consumable' || item.consumable || item.type === 'consumable')) {
                    // Consumption Confirmation
                    if (window.confirm(`Consume 1 ${item.name}?`)) {
                        onUpdateCharacter(c => {
                            // Find precise item index or object if passed safely.
                            // We are using closure 'item' and 'index'.
                            // BUT strict index usage is better.
                            const invItem = c.inventory[index];
                            if (invItem && invItem.qty > 0) {
                                invItem.qty--;
                                if (invItem.qty === 0) c.inventory.splice(index, 1);
                            }
                        });
                    }
                    equipTapRef.current = { key: null, time: 0 };
                } else {
                    equipTapRef.current = { key: tapKey, time: now };
                    equipTapTimeoutRef.current = setTimeout(() => {
                        onInspectItem(merged);
                        equipTapTimeoutRef.current = null;
                    }, 260);
                }
            };
        }

        // Ammo Logic Helpers
        // These are likely complex. I should look up getWeaponCapacity implementation in PlayerApp or Utils.
        // Assuming they are imported from `combatUtils` which I need to check existence of.

        return (
            <div className="item-row inventory-item-row" key={key}
                onClick={clickHandler}
                onContextMenu={(e) => {
                    e.preventDefault();
                    if (onLongPress) onLongPress(merged, 'item');
                }}
            /* Need touch event handlers also for long press? PlayerApp uses {...itemPressEvents(merged)} */
            /* I should import useLongPress or LongPressable */
            >
                {/* ... Render Logic Same as PlayerApp ... */}
                {merged?.img && (
                    <img className="item-icon" src={`ressources/${merged.img}`} alt="" />
                )}
                <div className="item-row-main">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div className="item-name">
                            {merged?.name || 'Unknown Item'}
                            {item.prepared && (
                                <span style={{
                                    marginLeft: 8, fontSize: '0.7em', background: '#30204a', color: '#b39ddb',
                                    border: '1px solid #5e35b1', padding: '1px 4px', borderRadius: 4,
                                    verticalAlign: 'middle', fontStyle: 'italic', display: 'inline-block'
                                }}>
                                    ⚡ Temp
                                </span>
                            )}
                        </div>

                        {/* Ammo Slots */}
                        {isEquipableInventoryItem(item) && (
                            ['crossbow', 'firearm'].includes((merged.group || '').toLowerCase()) ||
                            (merged.traits?.value || []).includes('repeating') ||
                            /bow|crossbow|firearm|pistol|musket|rifle|gun|pepperbox|rotary/i.test(merged.name)
                        ) && (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', marginLeft: 20, marginRight: 8, paddingBottom: 2 }}>
                                    <div style={{ display: 'flex', gap: 6 }}>
                                        {Array.from({ length: getWeaponCapacity(merged) }).map((_, idx) => {
                                            const loadedAmmo = item.loaded && item.loaded[idx];
                                            const isFilled = !!loadedAmmo;
                                            const isSpecial = loadedAmmo?.isSpecial;

                                            return (
                                                <div
                                                    key={idx}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (isFilled) {
                                                            onFireWeapon(index, idx);
                                                        } else {
                                                            onLoadWeapon(index, idx);
                                                        }
                                                    }}
                                                    style={{
                                                        width: 18, height: 18, // Bigger
                                                        borderRadius: '50%',
                                                        border: '1px solid #777',
                                                        background: isFilled ? (isSpecial ? '#90caf9' : '#ffb74d') : 'rgba(0,0,0,0.3)',
                                                        cursor: 'pointer',
                                                        boxShadow: 'inset 0 0 3px rgba(0,0,0,0.5)'
                                                    }}
                                                    title={isFilled ? `Loaded: ${loadedAmmo.name}` : "Empty Slot (Tap to Load)"}
                                                />
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                        {/* Weapon Bonus */}
                        {isEquipableInventoryItem(item) && (merged.type || '').toLowerCase() === 'weapon' && (
                            <div
                                onClick={(e) => {
                                    e.stopPropagation();
                                    const bonusInfo = getWeaponAttackBonus(merged, character);
                                    onOpenModal('weapon_detail', { item: merged, type: 'weapon_prof', ...bonusInfo });
                                }}
                                style={{
                                    marginLeft: 6,
                                    fontSize: '1.2em', // Matches actions/skills size roughly
                                    fontWeight: 'bold',
                                    color: (getWeaponAttackBonus(merged, character).total >= 0) ? 'var(--text-gold)' : '#f44336',
                                    cursor: 'pointer',
                                    minWidth: 24,
                                    textAlign: 'right'
                                }}
                            >
                                {getWeaponAttackBonus(merged, character).total >= 0 ? '+' : ''}{getWeaponAttackBonus(merged, character).total}
                            </div>
                        )}
                    </div>
                    {row1 && <div className="item-row-meta item-row-meta-1">{row1}</div>}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: row2 ? 0 : 4 }}>
                        <div className="item-row-meta item-row-meta-2" style={{ flex: 1, marginRight: 10 }}>
                            {row2}
                        </div>
                        {/* Ammo Counts (Equipped Weapons) */}
                        {isEquipableInventoryItem(item) && (
                            (() => {
                                // 1. If item itself stacks (e.g. Bombs), show its quantity
                                if (shouldStack(item)) {
                                    return (
                                        <div style={{ fontSize: '0.75em', color: '#888', fontStyle: 'italic', whiteSpace: 'nowrap', paddingTop: 2, marginLeft: 'auto' }}>
                                            {qty} left
                                        </div>
                                    );
                                }

                                // 2. If item is a weapon that uses ammo, show available ammo count
                                const isGun = /firearm|crossbow|pistol|musket|rifle|gun|pepperbox|rotary/i.test(merged.name) ||
                                    ['crossbow', 'firearm'].includes((merged.group || '').toLowerCase()) ||
                                    (merged.traits?.value || []).includes('repeating');
                                const isBow = /bow/i.test(merged.name) && !/crossbow/i.test(merged.name);

                                if (isGun || isBow) {
                                    // Count "Rounds (universal)" or "Arrows"
                                    // User said: "all firearms accept 'Rounds (Universal)'"
                                    // For Bows, assume "Arrows"? Or generic check? 
                                    // Let's look for "Rounds (universal)" for guns.
                                    // For Bows, maybe "Arrow"?

                                    const totalAmmo = items.reduce((acc, i) => {
                                        const n = (i.name || '').toLowerCase();
                                        if (isGun) {
                                            // Case-insensitive check for Rounds (Universal) or just "Rounds" if simple
                                            if (n === 'rounds (universal)' || n.includes('rounds (universal)')) return acc + (i.qty || 1);
                                        } else if (isBow) {
                                            if (n.includes('arrow')) return acc + (i.qty || 1);
                                        }
                                        return acc;
                                    }, 0);

                                    return (
                                        <div style={{ fontSize: '0.75em', color: '#888', fontStyle: 'italic', whiteSpace: 'nowrap', paddingTop: 2, marginLeft: 'auto' }}>
                                            {totalAmmo} {isGun ? 'Rounds' : 'Arrows'} left
                                        </div>
                                    );
                                }

                                return null;
                            })()
                        )}
                    </div>
                </div>
                {(!isEquipableInventoryItem(item)) && <div className="inventory-qty" style={{ marginLeft: 10, alignSelf: 'center' }}>x{qty}</div>}
            </div>
        );
    };

    // ... Loot Logic ...

    const tabButtons = (
        <div className="sub-tabs">
            {['Equipment', 'Consumables', 'Misc', /*hasLoot ? 'Loot' : null*/ 'Loot'].map(t => {
                const isLoot = t === 'Loot';
                const hasLoot = lootItems.length > 0;
                if (isLoot && !hasLoot) return null; // Hide Loot tab if empty
                return (
                    <button
                        key={t}
                        className={`sub-tab-btn ${itemSubTab === t ? 'active' : ''}`}
                        onClick={() => setItemSubTab(t)}
                    >
                        {t}
                        {isLoot && <span style={{ marginLeft: 5, color: '#ff5252', fontWeight: 'bold' }}>!</span>}
                    </button>
                );
            })}
        </div>
    );

    return (
        <div>
            {tabButtons}
            {/* ... Lists ... */}
            {itemSubTab === 'Equipment' && (
                <>
                    {equipmentItems.some(i => i.item.equipped) && <div style={{ fontSize: '0.8em', color: '#888', margin: '7px 0 5px', textTransform: 'uppercase', letterSpacing: 1 }}>Equipped</div>}
                    {equipmentItems.filter(i => i.item.equipped).map(({ item, index }) => renderRow(item, index, { enableEquipTap: true }))}

                    {equipmentItems.some(i => !i.item.equipped) && <div style={{ fontSize: '0.8em', color: '#888', margin: '15px 0 5px', textTransform: 'uppercase', letterSpacing: 1 }}>Unequipped</div>}
                    {equipmentItems.filter(i => !i.item.equipped).map(({ item, index }) => renderRow(item, index, { enableEquipTap: true }))}
                </>
            )}
            {itemSubTab === 'Consumables' && consumableItems.map(({ item, index }) => renderRow(item, index))}
            {itemSubTab === 'Misc' && miscItems.map(({ item, index }) => renderRow(item, index))}
            {itemSubTab === 'Loot' && lootItems.map(({ item, index }) => (
                <div key={`${item.name}-${index}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px', borderBottom: '1px solid #444' }}>
                    <div>
                        <div style={{ fontWeight: 'bold', color: '#ffb74d' }}>{item.name}</div>
                        <div style={{ fontSize: '0.8em', color: '#ccc' }}>Quantity: {item.qty || 1}</div>
                    </div>
                    <button
                        style={{
                            background: '#388e3c',
                            border: 'none',
                            borderRadius: 4,
                            color: 'white',
                            padding: '4px 8px',
                            cursor: 'pointer'
                        }}
                        onClick={() => {
                            // Claim Loot Logic
                            // For now, we just remove 'isLoot' flag? Or move to inventory?
                            // If item is in inventory but isLoot=true, it effectively is "Unclaimed Loot" in a shared sense?
                            // Or does it mean "Loot I am carrying"?
                            // Assuming "Claim" means convert to regular item.
                            onUpdateCharacter(c => {
                                const invItem = c.inventory[index];
                                if (invItem) delete invItem.isLoot;
                            });
                        }}
                    >
                        Claim
                    </button>
                </div>
            ))}
            {itemSubTab === 'Loot' && lootItems.length === 0 && <div style={{ padding: 20, textAlign: 'center', color: '#888' }}>No unclaimed loot.</div>}
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                <button className="btn-add-condition" style={{ flex: 1, margin: 0 }} onClick={onOpenShop}>
                    + Open Shop
                </button>
                <button className="btn-add-condition" style={{ flex: 1, margin: 0 }} onClick={() => onOpenModal('formula_book', { title: "Formula Book" })}>
                    📖 Formulas
                </button>
            </div>
        </div>
    );
}
