import React, { useEffect, useState, useRef } from 'react';
import { useCampaign } from '../../shared/context/CampaignContext';
import { getShopIndexItemByName } from '../../shared/catalog/shopIndex';
import { getShopItemRowMeta } from '../../shared/catalog/shopRowMeta';
import ItemRow from '../../shared/components/ItemRow';
import { shouldStack } from '../../shared/utils/inventoryUtils';
import { getWeaponCapacity, getWeaponAttackBonus, isEquipableInventoryItem, getInventoryBucket } from '../../shared/utils/combatUtils';
import { calculateWeaponDamage } from '../../utils/rules/damage';
import { selectCustomShopItem } from '../../shared/db/selectors/shopSelectors';
import { selectLootBagLists } from '../../shared/db/selectors/campaignSelectors';
import { consumeWandCharge, getWandCharges, getWandMaxCharges, getWandSpell, isWandItem } from '../../shared/utils/wandUtils';
import { findInventoryItemIndex } from '../../shared/utils/itemIdentity';
import { useAppFeedback } from '../../shared/feedback/AppFeedback';

// Swallows the click that the browser fires after touchend once a
// long-press has opened the context modal; without this the click lands
// on the modal overlay and closes it again immediately.
const suppressGhostClick = (e) => {
    if (e.cancelable) e.preventDefault();
};

export function InventoryView({
    character,
    db,
    onUpdateCharacter,
    onAuthorCatalogEntry,
    onOpenModal,
    onToggleEquip,
    onInspectItem,
    onFireWeapon,
    onLoadWeapon,
    onLongPress,
    onOpenShop,
    onClaimLoot,
    onConsumeItem,
    onClaimGold,
    onSplitGold,
    initialSubTab = 'Equipment',
    readOnly = false,
    allowLoot = true,
    showUtilityActions = true,
    canAuthorCatalog = false,
    hideTabs = false
}) {
    const [itemSubTab, setItemSubTab] = useState(initialSubTab);
    const equipTapRef = useRef({ key: null, time: 0 });
    const equipTapTimeoutRef = useRef(null);
    // Firefox Android does not dispatch contextmenu for long-presses on
    // plain elements, so the rows need a touch-timer fallback next to the
    // onContextMenu path that Chrome and desktop right-click use.
    const rowLongPressRef = useRef({ timer: null, x: 0, y: 0, startedAt: 0, firedAt: 0, firedKey: null });

    const clearRowLongPressTimer = () => {
        if (rowLongPressRef.current.timer) {
            clearTimeout(rowLongPressRef.current.timer);
            rowLongPressRef.current.timer = null;
        }
    };

    const fireRowLongPress = (merged) => {
        const state = rowLongPressRef.current;
        const rowKey = merged?._index ?? merged?.name ?? null;
        // Timer and contextmenu can both trigger for the same press.
        if (state.firedAt && state.firedKey === rowKey && Date.now() - state.firedAt < 600) return;
        state.firedAt = Date.now();
        state.firedKey = rowKey;
        if (onLongPress) onLongPress(merged, 'item');
    };

    const rowLongPressTouchHandlers = (merged) => ({
        onTouchStart: (e) => {
            const touch = e.touches && e.touches[0];
            if (!touch || e.touches.length > 1) return;
            clearRowLongPressTimer();
            const pressTarget = e.target;
            rowLongPressRef.current = {
                ...rowLongPressRef.current,
                x: touch.clientX,
                y: touch.clientY,
                startedAt: Date.now(),
                timer: setTimeout(() => {
                    rowLongPressRef.current.timer = null;
                    if (document.body.classList.contains('swiping-active')) return;
                    pressTarget.addEventListener('touchend', suppressGhostClick, { passive: false, once: true });
                    fireRowLongPress(merged);
                }, 500),
            };
        },
        onTouchMove: (e) => {
            const state = rowLongPressRef.current;
            if (!state.timer) return;
            const touch = e.touches && e.touches[0];
            if (!touch) return;
            if (Math.abs(touch.clientX - state.x) > 10 || Math.abs(touch.clientY - state.y) > 10) {
                clearRowLongPressTimer();
            }
        },
        onTouchEnd: () => clearRowLongPressTimer(),
        onTouchCancel: () => {
            // Firefox Android can abort the press with touchcancel right at
            // its own long-press threshold; a near-complete motionless hold
            // counts as the long-press.
            const state = rowLongPressRef.current;
            const heldLongEnough = state.timer && state.startedAt && Date.now() - state.startedAt >= 400;
            clearRowLongPressTimer();
            if (heldLongEnough && !document.body.classList.contains('swiping-active')) {
                fireRowLongPress(merged);
            }
        },
    });
    const { confirm, prompt } = useAppFeedback();
    const { activeCampaign } = useCampaign();
    const { lootBags } = selectLootBagLists(db, activeCampaign, activeCampaign?.id);

    useEffect(() => {
        setItemSubTab(initialSubTab);
    }, [initialSubTab]);

    // Helper functions from PlayerApp logic (Assuming they are not exported elsewhere yet)
    // We'll need to duplicate them or extract them to a util file if they are large.
    // For now, I'll inline the simple ones if they are missing.

    const items = Array.isArray(character.inventory) ? character.inventory : [];
    // Fix: We must access items by their original index in character.inventory for updates to work
    // Fix: We must access items by their original index in character.inventory for updates to work
    // Resolve items with DB data early so filters work
    const wrappedItems = items.map((rawItem, index) => {
        let merged = { ...rawItem, _index: index };

        // 1. Try Static Index
        let fromIndex = getShopIndexItemByName(rawItem.name);
        if (!fromIndex && rawItem.system?.originalName) {
            fromIndex = getShopIndexItemByName(rawItem.system.originalName);
        }

        // 2. Try Custom DB
        if (!fromIndex && rawItem.name) {
            const customItem = selectCustomShopItem(db, rawItem.name);
            if (customItem) {
                // Flatten/Map custom item to expected display structure
                fromIndex = {
                    ...customItem,
                    // Ensure crucial display props are hoisted
                    level: customItem.system?.level?.value ?? 0,
                    price: customItem.system?.price?.value?.gp ?? 0,
                    type: customItem.type ? (customItem.type.charAt(0).toUpperCase() + customItem.type.slice(1)) : 'Item',
                    traits: { value: customItem.system?.traits?.value || [] },
                    rarity: customItem.system?.traits?.rarity,
                    description: customItem.system?.description?.value,
                    range: customItem.system?.range,
                    damage: customItem.system?.damage,
                    group: customItem.system?.group,
                    category: customItem.system?.category,
                    bulk: customItem.system?.bulk?.value,
                    weaponType: customItem.system?.weaponType?.value,
                };
            }
        }

        if (fromIndex) {
            merged = { ...fromIndex, ...merged };
        }
        return { item: merged, index };
    });

    const equipmentItems = wrappedItems
        .filter(({ item }) => getInventoryBucket(item) === 'equipment' && !item.isLoot)
        .sort((a, b) => {
            // 1. Equipped state (Equipped first)
            if (a.item.equipped && !b.item.equipped) return -1;
            if (!a.item.equipped && b.item.equipped) return 1;

            // 2. Type Priority (Weapon < Armor < Shield < Other)
            const getType = (i) => (i.type || '').toLowerCase();
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

    const consumeWandFromInventory = (wandItem) => {
        if (readOnly || !onUpdateCharacter) {
            onInspectItem(wandItem);
            return;
        }
        onUpdateCharacter(c => {
            const idx = findInventoryItemIndex(c.inventory, wandItem);
            if (idx < 0) return;
            consumeWandCharge(c.inventory[idx]);
        });
    };

    const renderRow = (item, index, { enableEquipTap = false } = {}) => {
        // Item is already resolved/merged in wrappedItems
        const merged = item;
        const key = `${merged.name}-${index}`;
        const qty = merged.qty || 1;
        const { row1, row2 } = getShopItemRowMeta(merged);

        const isWeapon = isEquipableInventoryItem(item) && String(merged.type || '').toLowerCase() === 'weapon';
        const weaponAttackBonus = isWeapon ? getWeaponAttackBonus(merged, character) : null;
        const weaponHasPenalty = (weaponAttackBonus?.penalty || 0) < 0;
        const weaponHasBonus = (weaponAttackBonus?.penalty || 0) > 0;
        const isWand = isWandItem(merged);
        const wandCharges = isWand ? getWandCharges(merged) : 0;
        const wandMax = isWand ? getWandMaxCharges(merged) : 1;
        const linkedSpell = getWandSpell(merged) || merged.system?.spell;

        let clickHandler;
        if (enableEquipTap && isEquipableInventoryItem(item)) {
            clickHandler = () => {
                if (readOnly) {
                    onInspectItem(merged);
                    return;
                }
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
                    if (item.name === 'Versatile Vial') {
                        onOpenModal('formula_book', { mode: 'versatile_vial', title: 'Versatile Vial - Select Formula' });
                    } else {
                        onToggleEquip(merged);
                    }
                    return;
                }

                equipTapRef.current = { key: tapKey, time: now };
                equipTapTimeoutRef.current = setTimeout(() => {
                    onInspectItem(merged);
                    equipTapTimeoutRef.current = null;
                    equipTapRef.current = { key: null, time: 0 }; // Reset for fresh double-tap detection
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
                if (readOnly) {
                    onInspectItem(merged);
                    return;
                }
                // Reuse local tap ref?
                const tapKey = String(item?.name || '');
                const now = Date.now();
                const last = equipTapRef.current;
                const isDoubleTap = last.key === tapKey && now - last.time < 300;

                if (equipTapTimeoutRef.current) {
                    clearTimeout(equipTapTimeoutRef.current);
                    equipTapTimeoutRef.current = null;
                }

                if (isDoubleTap && item.name === 'Versatile Vial') {
                    equipTapRef.current = { key: null, time: 0 };
                    onOpenModal('formula_book', { mode: 'versatile_vial', title: 'Versatile Vial - Select Formula' });
                    return;
                } else if (isDoubleTap && isWand) {
                    equipTapRef.current = { key: null, time: 0 };
                    if (wandCharges <= 0) {
                        onInspectItem(merged);
                    } else {
                        consumeWandFromInventory(merged);
                    }
                    return;
                } else if (isDoubleTap && (item.type === 'Consumable' || item.consumable || item.type === 'consumable')) {
                    // Consumption Confirmation
                    confirm({
                        title: 'Consume item',
                        message: `Consume 1 ${item.name}?`,
                        confirmLabel: 'Consume',
                    }).then((confirmed) => {
                        if (!confirmed) return;
                        if (onConsumeItem) {
                            onConsumeItem(merged);
                        } else {
                            onUpdateCharacter(c => {
                                const invItem = c.inventory[index];
                                if (invItem && invItem.qty > 0) {
                                    invItem.qty--;
                                    if (invItem.qty === 0) c.inventory.splice(index, 1);
                                }
                            });
                        }
                    });
                    equipTapRef.current = { key: null, time: 0 };
                } else {
                    equipTapRef.current = { key: tapKey, time: now };
                    equipTapTimeoutRef.current = setTimeout(() => {
                        onInspectItem(merged);
                        equipTapTimeoutRef.current = null;
                        equipTapRef.current = { key: null, time: 0 }; // Reset for fresh double-tap detection
                    }, 260);
                }
            };
        }

        // Ammo Logic Helpers
        // These are likely complex. I should look up getWeaponCapacity implementation in PlayerApp or Utils.
        // Assuming they are imported from `combatUtils` which I need to check existence of.

        // Logic for Item Row
        const damageData = (merged.type?.toLowerCase() === 'weapon' || isEquipableInventoryItem(item)) && (merged.damage || merged.system?.damage)
            ? calculateWeaponDamage(merged, character)
            : null;

        return (
            <div className="item-row inventory-item-row" key={key}
                data-testid={`inventory-item-${item.instanceId || key}`}
                onClick={(e) => {
                    if (document.body.classList.contains('swiping-active')) {
                        e.stopPropagation();
                        return;
                    }
                    clickHandler(); // clickHandler expects no args usually, or ignores them? 
                    // defined as () => {...} in previous view. Yes.
                }}
                onContextMenu={(e) => {
                    if (document.body.classList.contains('swiping-active')) {
                        e.preventDefault();
                        e.stopPropagation();
                        return;
                    }
                    e.preventDefault();
                    clearRowLongPressTimer();
                    fireRowLongPress(merged);
                }}
                {...rowLongPressTouchHandlers(merged)}
            >
                {merged?.img && (
                    <img className="item-icon" src={`ressources/${merged.img}`} alt="" />
                )}
                <div className="item-row-main">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div className="item-name">
                            {merged?.name || 'Unknown Item'}
                            {item.system?.staff?.max > 0 && (
                                <span style={{ color: '#aaa', marginLeft: 6, fontSize: '0.85em', fontWeight: 'normal' }}>
                                    ({item.system.staff.charges || 0}/{item.system.staff.max})
                                </span>
                            )}
                            {isWand && (
                                <span style={{ color: '#b39ddb', marginLeft: 6, fontSize: '0.85em', fontWeight: 'normal' }}>
                                    ({wandCharges}/{wandMax})
                                </span>
                            )}
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
                                                    data-testid={`weapon-ammo-slot-${item.instanceId || key}-${idx}`}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (isFilled) {
                                                            onFireWeapon(index, idx);
                                                        } else {
                                                            onLoadWeapon(index, idx);
                                                        }
                                                    }}
                                                    style={{
                                                        width: 18, height: 18,
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
                        {isWeapon && weaponAttackBonus && (
                            <div
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onOpenModal('weapon_detail', { item: merged, type: 'weapon_prof', ...weaponAttackBonus });
                                }}
                                className={weaponHasPenalty ? 'stat-penalty' : (weaponHasBonus ? 'stat-bonus' : '')}
                                style={{
                                    marginLeft: 6,
                                    fontSize: '1.2em',
                                    fontWeight: 'bold',
                                    color: 'var(--text-gold)',
                                    cursor: 'pointer',
                                    minWidth: 24,
                                    textAlign: 'right'
                                }}
                            >
                                {weaponAttackBonus.total >= 0 ? '+' : ''}{weaponAttackBonus.total}
                                {weaponHasPenalty && <span className="stat-penalty-inline">({weaponAttackBonus.penalty})</span>}
                                {weaponHasBonus && <span className="stat-bonus-inline">(+{weaponAttackBonus.penalty})</span>}
                            </div>
                        )}
                    </div>

                    {/* Linked Spell (Scrolls/Wands) */}
                    {linkedSpell && (
                        <div
                            onClick={(e) => {
                                e.stopPropagation();
                                onOpenModal('item', { ...linkedSpell, _entityType: 'spell' });
                            }}
                            style={{ fontSize: '0.85em', color: '#b39ddb', cursor: 'pointer', marginTop: 2, display: 'inline-block' }}
                        >
                            <span style={{ marginRight: 4 }}>✨</span>
                            <span style={{ textDecoration: 'underline' }}>{linkedSpell.name}</span>
                        </div>
                    )}

                    {row1 && <div className="item-row-meta item-row-meta-1">{row1}</div>}

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: row2 ? 0 : 4 }}>
                        <div className="item-row-meta item-row-meta-2" style={{ flex: 1, marginRight: 10 }}>
                            {/* Override Damage Display if available */}
                            {/* Override Damage Display if available */}
                            {damageData ? (
                                <span>
                                    <span style={{ color: '#ddd', fontWeight: 'bold' }}>
                                        {damageData.normal.parts ? (
                                            damageData.normal.parts.map((p, i) => (
                                                <span key={i} style={p.style === 'purple' ? { color: '#b39ddb' } : {}}>
                                                    {p.text}{i < damageData.normal.parts.length - 1 ? ' ' : ''}
                                                </span>
                                            ))
                                        ) : (
                                            damageData.normal.text
                                        )}
                                    </span>
                                    <span style={{ fontSize: '0.85em', color: '#666', marginLeft: 8 }}>
                                        {/* Show Bulk if present */}
                                        {merged.bulk ? `Bulk ${merged.bulk}` : ''}
                                    </span>
                                </span>
                            ) : (
                                row2
                            )}
                        </div>

                        {/* Stack/Ammo Counters */}
                        {isEquipableInventoryItem(item) && (
                            (() => {
                                if (shouldStack(item)) {
                                    return (
                                        <div style={{ fontSize: '0.75em', color: '#888', fontStyle: 'italic', whiteSpace: 'nowrap', paddingTop: 2, marginLeft: 'auto' }}>
                                            {qty} left
                                        </div>
                                    );
                                }
                                const isGun = /firearm|crossbow|pistol|musket|rifle|gun|pepperbox|rotary/i.test(merged.name) ||
                                    ['crossbow', 'firearm'].includes((merged.group || '').toLowerCase()) ||
                                    (merged.traits?.value || []).includes('repeating');
                                const isBow = /bow/i.test(merged.name) && !/crossbow/i.test(merged.name);

                                if (isGun || isBow) {
                                    const totalAmmo = items.reduce((acc, i) => {
                                        const n = (i.name || '').toLowerCase();
                                        if (isGun) {
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
                if (isLoot && !allowLoot) return null;
                const visibleBags = lootBags.filter(b => !b.isLocked);
                // Check items AND gold for visibility
                const bagsWithLoot = visibleBags.filter(b => (b.items && b.items.some(i => !i.claimedBy)) || (b.goldValue || 0) > 0);
                const hasLoot = lootItems.length > 0 || bagsWithLoot.length > 0;
                if (isLoot && !hasLoot) return null; // Hide Loot tab if empty
                return (
                    <button
                        key={t}
                        className={`sub-tab-btn ${itemSubTab === t ? 'active' : ''}`}
                        data-testid={isLoot ? 'inventory-tab-loot' : `inventory-tab-${t.toLowerCase()}`}
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
            {!hideTabs && tabButtons}
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
            {allowLoot && itemSubTab === 'Loot' && lootItems.map(({ item, index }) => (
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
                            if (readOnly) return;
                            // Claim Loot Logic for items ALREADY in inventory but marked as loot
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

            {allowLoot && itemSubTab === 'Loot' && (
                (() => {
                    const visibleBags = lootBags.filter(b => !b.isLocked);
                    const bagsWithLoot = visibleBags.filter(b => (b.items && b.items.some(i => !i.claimedBy)) || b.goldValue > 0);

                    if (bagsWithLoot.length === 0 && lootItems.length === 0) {
                        return <div style={{ padding: 20, textAlign: 'center', color: '#888' }}>No unclaimed loot.</div>;
                    }

                    return bagsWithLoot.map(bag => {
                        const unclaimedItems = bag.items ? bag.items.filter(i => !i.claimedBy) : [];

                        return (
                            <div
                                key={bag.id}
                                data-testid={`loot-bag-${bag.id}`}
                                style={{ background: '#222', border: '1px solid #c5a059', borderRadius: 8, padding: 10, marginBottom: 15, marginTop: 10 }}
                            >
                                <div style={{ borderBottom: '1px solid #444', paddingBottom: 5, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <h3 style={{ margin: 0, color: '#ffecb3', fontSize: '1em' }}>💰 {bag.name}</h3>
                                </div>

                                {/* Gold Section */}
                                {(bag.goldValue > 0) && (
                                    <div style={{ background: 'rgba(255, 215, 0, 0.1)', padding: 10, margin: '10px 0', borderRadius: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span data-testid={`loot-gold-${bag.id}`} style={{ color: '#ffd700', fontWeight: 'bold' }}>{bag.goldValue} GP</span>
                                        <div style={{ display: 'flex', gap: 5 }}>
                                            <button
                                                className="set-btn"
                                                data-testid={`loot-take-gold-${bag.id}`}
                                                style={{ fontSize: '0.8em', padding: '4px 8px' }}
                                                onClick={async () => {
                                                    const amount = await prompt({
                                                        title: 'Take loot gold',
                                                        message: `Take how much gold? Max: ${bag.goldValue} GP`,
                                                        defaultValue: String(bag.goldValue),
                                                        inputType: 'number',
                                                        confirmLabel: 'Take',
                                                    });
                                                    if (!amount) return;
                                                    const val = parseFloat(amount);
                                                    if (isNaN(val) || val <= 0 || val > bag.goldValue) return;

                                                    if (!readOnly && onClaimGold) onClaimGold(bag.id, val);
                                                }}
                                            >
                                                Take
                                            </button>
                                            <button
                                                className="set-btn"
                                                data-testid={`loot-split-gold-${bag.id}`}
                                                style={{ fontSize: '0.8em', padding: '4px 8px', background: '#e65100' }}
                                                onClick={async () => {
                                                    const confirmed = await confirm({
                                                        title: 'Split party gold',
                                                        message: `Split ${bag.goldValue} GP evenly among all party members?`,
                                                        confirmLabel: 'Split',
                                                    });
                                                    if (!confirmed) return;
                                                    if (!readOnly && onSplitGold) onSplitGold(bag.id);
                                                }}
                                            >
                                                Split Party
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {unclaimedItems.map((item) => {
                                    const fromIndex = item?.name ? getShopIndexItemByName(item.name) : null;
                                    const merged = fromIndex ? { ...fromIndex, ...item } : item;

                                    return (
                                        <ItemRow
                                            key={item.instanceId}
                                            item={merged}
                                            data-testid={`loot-item-${item.instanceId || item.name}`}
                                            className="inventory-item-row"
                                            style={{ marginTop: 5 }}
                                            onClick={() => onInspectItem(merged)}
                                            nameAddon={(merged.qty > 1) && <span style={{ color: '#888', fontSize: '0.8em', marginLeft: 8 }}>x{merged.qty}</span>}
                                            right={<button
                                                className="set-btn"
                                                data-testid={`loot-claim-item-${item.instanceId || item.name}`}
                                                style={{ margin: '0 0 0 10px', padding: '6px 14px', fontSize: '0.9em', width: 'auto', flexShrink: 0, height: 'auto' }}
                                                onClick={async (e) => {
                                                    e.stopPropagation();
                                                    if (!readOnly && onClaimLoot) {
                                                        // QTY Prompt only if stack > 1
                                                        if ((item.qty || 1) > 1) {
                                                            const res = await prompt({
                                                                title: 'Claim loot item',
                                                                message: `Claim how many ${item.name}? Max: ${item.qty}`,
                                                                defaultValue: String(item.qty),
                                                                inputType: 'number',
                                                                confirmLabel: 'Claim',
                                                            });
                                                            if (res === null) return;
                                                            const val = parseInt(res);
                                                            if (isNaN(val) || val <= 0 || val > item.qty) return;
                                                            // Clone item with new qty for claim logic
                                                            onClaimLoot(bag, { ...item, qty: val });
                                                        } else {
                                                            onClaimLoot(bag, item);
                                                        }
                                                    }
                                                }}
                                            >
                                                Claim
                                            </button>}
                                        />
                                    );
                                })}
                            </div>
                        );
                    });
                })()
            )}
            {showUtilityActions && !readOnly && (
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                <button className="btn-add-condition" style={{ flex: 1, margin: 0 }} onClick={onOpenShop}>
                    + Open Shop
                </button>
                <button className="btn-add-condition" style={{ flex: 1, margin: 0 }} onClick={() => onOpenModal('formula_book', { title: "Formula Book" })}>
                    📖 Formulas
                </button>
                {canAuthorCatalog && (
                    <button className="btn-add-condition" style={{ flex: 1, margin: 0 }} onClick={() => onAuthorCatalogEntry?.('item')}>
                        Create Item
                    </button>
                )}
            </div>
            )}
        </div>
    );
}
