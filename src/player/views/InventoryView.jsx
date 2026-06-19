import React, { useState, useRef } from 'react';
import { useCampaign } from '../../shared/context/CampaignContext';
import { getShopIndexItemByName } from '../../shared/catalog/shopIndex';
import ItemEditor from '../../admin/editors/ItemEditor';
import BottomSheet from '../../shared/components/BottomSheet';
import { getShopItemRowMeta } from '../../shared/catalog/shopRowMeta';
import { shouldStack } from '../../shared/utils/inventoryUtils';
import { getWeaponCapacity, getWeaponAttackBonus, isEquipableInventoryItem, getInventoryBucket } from '../../shared/utils/combatUtils';
import { calculateWeaponDamage } from '../../utils/rules/damage';
import { selectCustomShopItem } from '../../shared/db/selectors/shopSelectors';
import { selectLootBagLists } from '../../shared/db/selectors/campaignSelectors';

export function InventoryView({
    character,
    db,
    onUpdateCharacter,
    onSaveCustomItem,
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
    onSplitGold
}) {
    const [itemSubTab, setItemSubTab] = useState('Equipment');
    const [vialActivation, setVialActivation] = useState(null); // item being converted via Versatile Vial
    const [showItemCreator, setShowItemCreator] = useState(false);
    const equipTapRef = useRef({ key: null, time: 0 });
    const equipTapTimeoutRef = useRef(null);
    const { activeCampaign } = useCampaign();
    const { lootBags } = selectLootBagLists(db, activeCampaign, activeCampaign?.id);

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
                    if (item.name === 'Versatile Vial') {
                        setVialActivation(merged);
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
                    setVialActivation(merged);
                    return;
                } else if (isDoubleTap && (item.type === 'Consumable' || item.consumable || item.type === 'consumable')) {
                    // Consumption Confirmation
                    if (window.confirm(`Consume 1 ${item.name}?`)) {
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
                    }
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
                    if (onLongPress) onLongPress(merged, 'item');
                }}
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
                    {merged.system?.spell && (
                        <div
                            onClick={(e) => {
                                e.stopPropagation();
                                onOpenModal('item', { ...merged.system.spell, _entityType: 'spell' });
                            }}
                            style={{ fontSize: '0.85em', color: '#b39ddb', cursor: 'pointer', marginTop: 2, display: 'inline-block' }}
                        >
                            <span style={{ marginRight: 4 }}>✨</span>
                            <span style={{ textDecoration: 'underline' }}>{merged.system.spell.name}</span>
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
                const visibleBags = lootBags.filter(b => !b.isLocked);
                // Check items AND gold for visibility
                const bagsWithLoot = visibleBags.filter(b => (b.items && b.items.some(i => !i.claimedBy)) || (b.goldValue || 0) > 0);
                const hasLoot = lootItems.length > 0 || bagsWithLoot.length > 0;
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

            {/* ── Versatile Vial Formula Selector ── */}
            <VersatileVialSheet
                activation={vialActivation}
                formulas={character.formulaBook || []}
                onClose={() => setVialActivation(null)}
                onUpdateCharacter={onUpdateCharacter}
            />

            {itemSubTab === 'Loot' && (
                (() => {
                    const visibleBags = lootBags.filter(b => !b.isLocked);
                    const bagsWithLoot = visibleBags.filter(b => (b.items && b.items.some(i => !i.claimedBy)) || b.goldValue > 0);

                    if (bagsWithLoot.length === 0 && lootItems.length === 0) {
                        return <div style={{ padding: 20, textAlign: 'center', color: '#888' }}>No unclaimed loot.</div>;
                    }

                    return bagsWithLoot.map(bag => {
                        const unclaimedItems = bag.items ? bag.items.filter(i => !i.claimedBy) : [];

                        return (
                            <div key={bag.id} style={{ background: '#222', border: '1px solid #c5a059', borderRadius: 8, padding: 10, marginBottom: 15, marginTop: 10 }}>
                                <div style={{ borderBottom: '1px solid #444', paddingBottom: 5, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <h3 style={{ margin: 0, color: '#ffecb3', fontSize: '1em' }}>💰 {bag.name}</h3>
                                </div>

                                {/* Gold Section */}
                                {(bag.goldValue > 0) && (
                                    <div style={{ background: 'rgba(255, 215, 0, 0.1)', padding: 10, margin: '10px 0', borderRadius: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ color: '#ffd700', fontWeight: 'bold' }}>{bag.goldValue} GP</span>
                                        <div style={{ display: 'flex', gap: 5 }}>
                                            <button
                                                className="set-btn"
                                                style={{ fontSize: '0.8em', padding: '4px 8px' }}
                                                onClick={() => {
                                                    const amount = prompt(`Take how much gold? (Max: ${bag.goldValue})`, bag.goldValue);
                                                    if (!amount) return;
                                                    const val = parseFloat(amount);
                                                    if (isNaN(val) || val <= 0 || val > bag.goldValue) return;

                                                    if (onClaimGold) onClaimGold(bag.id, val);
                                                }}
                                            >
                                                Take
                                            </button>
                                            <button
                                                className="set-btn"
                                                style={{ fontSize: '0.8em', padding: '4px 8px', background: '#e65100' }}
                                                onClick={() => {
                                                    if (!confirm(`Split ${bag.goldValue} GP evenly among all party members?`)) return;
                                                    if (onSplitGold) onSplitGold(bag.id);
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
                                    const { row1, row2 } = getShopItemRowMeta(merged);

                                    return (
                                        <div key={item.instanceId} className="item-row inventory-item-row" style={{ marginTop: 5 }} onClick={() => onInspectItem(merged)}>
                                            {merged?.img && (
                                                <img className="item-icon" src={`ressources/${merged.img}`} alt="" />
                                            )}
                                            <div className="item-row-main">
                                                <div className="item-name">
                                                    {merged?.name || 'Unknown Item'}
                                                    {(merged.qty > 1) && <span style={{ color: '#888', fontSize: '0.8em', marginLeft: 8 }}>x{merged.qty}</span>}
                                                </div>
                                                {row1 && <div className="item-row-meta item-row-meta-1">{row1}</div>}
                                                {row2 && <div className="item-row-meta item-row-meta-2">{row2}</div>}
                                            </div>

                                            <button
                                                className="set-btn"
                                                style={{ margin: '0 0 0 10px', padding: '6px 14px', fontSize: '0.9em', width: 'auto', flexShrink: 0, height: 'auto' }}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (onClaimLoot) {
                                                        // QTY Prompt only if stack > 1
                                                        if ((item.qty || 1) > 1) {
                                                            const res = prompt(`Claim how many ${item.name}? (Max: ${item.qty})`, item.qty);
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
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        );
                    });
                })()
            )}
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                <button className="btn-add-condition" style={{ flex: 1, margin: 0 }} onClick={onOpenShop}>
                    + Open Shop
                </button>
                <button className="btn-add-condition" style={{ flex: 1, margin: 0 }} onClick={() => onOpenModal('formula_book', { title: "Formula Book" })}>
                    📖 Formulas
                </button>
                <button className="btn-add-condition" style={{ flex: 1, margin: 0 }} onClick={() => setShowItemCreator(true)}>
                    ✏️ Create Item
                </button>
            </div>

            {/* Custom item creator overlay */}
            {showItemCreator && (
                <div style={{
                    position: 'fixed', inset: 0, background: '#111', zIndex: 500,
                    display: 'flex', flexDirection: 'column', overflow: 'hidden'
                }}>
                    <ItemEditor
                        initialItem={null}
                        dbOnly={true}
                        onCancel={() => setShowItemCreator(false)}
                        onSaveToDb={(dbItem) => {
                            // 1. Store in shared campaign custom items (visible to all players and shop)
                            onSaveCustomItem?.({ ...dbItem, playerCreated: true });
                            // 2. Add immediately to this character's inventory (qty 1)
                            onUpdateCharacter(c => {
                                const flat = {
                                    name: dbItem.name,
                                    type: dbItem.type,
                                    level: dbItem.system?.level?.value || 0,
                                    price: dbItem.system?.price?.value?.gp || 0,
                                    bulk: dbItem.system?.bulk?.value || '',
                                    traits: dbItem.system?.traits?.value || [],
                                    rarity: dbItem.system?.traits?.rarity || 'common',
                                    description: dbItem.system?.description?.value || '',
                                    img: dbItem.img || '',
                                    isCustom: true,
                                    playerCreated: true,
                                    qty: 1,
                                };
                                c.inventory.push(flat);
                            });
                        }}
                        onSave={() => setShowItemCreator(false)}
                    />
                </div>
            )}
        </div>
    );
}

// ── Versatile Vial Formula Selector ─────────────────────────────────────────

function isAmmoFormula(item) {
    return (item?.type || '').toLowerCase() === 'ammunition' ||
        (item?.category || '').toLowerCase().includes('ammo') ||
        (item?.group || '').toLowerCase() === 'ammunition' ||
        /arrow|bolt|round|cartridge|shot/i.test(item?.name || '');
}

function VersatileVialSheet({ activation, formulas, onClose, onUpdateCharacter }) {
    if (!activation) return null;

    const handleSelect = (formulaName) => {
        const formulaItem = getShopIndexItemByName(formulaName) || { name: formulaName };
        const qty = isAmmoFormula(formulaItem) ? 4 : 1;

        onUpdateCharacter(c => {
            // Remove 1 Versatile Vial
            const vialIdx = c.inventory.findIndex(i => i.name === 'Versatile Vial');
            if (vialIdx >= 0) {
                const q = c.inventory[vialIdx].qty || 1;
                if (q <= 1) c.inventory.splice(vialIdx, 1);
                else c.inventory[vialIdx] = { ...c.inventory[vialIdx], qty: q - 1 };
            }
            // Add temporary crafted item
            c.inventory.push({
                ...formulaItem,
                qty,
                prepared: true,
                addedAt: Date.now(),
            });
        });
        onClose();
    };

    return (
        <BottomSheet
            isOpen={true}
            onClose={onClose}
            title="🧪 Versatile Vial — Select Formula"
            height="70vh"
        >
            <div style={{ padding: '0 4px 24px' }}>
                {formulas.length === 0 && (
                    <div style={{ color: '#666', textAlign: 'center', padding: '32px 0', fontSize: '0.9em' }}>
                        No known formulas.<br />Buy formulas from the shop first.
                    </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {formulas.map(fName => {
                        const item = getShopIndexItemByName(fName) || { name: fName };
                        const ammo = isAmmoFormula(item);
                        return (
                            <button
                                key={fName}
                                onClick={() => handleSelect(fName)}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 12,
                                    background: '#1a1a1a', border: '1px solid #2a2a2a',
                                    borderRadius: 8, padding: '10px 12px',
                                    cursor: 'pointer', textAlign: 'left', width: '100%',
                                }}
                            >
                                {item.img
                                    ? <img src={`ressources/${item.img}`} style={{ width: 32, height: 32, objectFit: 'contain', flexShrink: 0 }} alt="" />
                                    : <div style={{ width: 32, height: 32, background: '#2a2a2a', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>⚗️</div>
                                }
                                <div style={{ flex: 1 }}>
                                    <div style={{ color: '#e8e8e8', fontWeight: 'bold', fontSize: '0.95em' }}>{item.name}</div>
                                    <div style={{ color: '#888', fontSize: '0.78em', marginTop: 2 }}>
                                        {item.level ? `Level ${item.level}` : ''}{item.level && item.price ? ' · ' : ''}{item.price ? `${item.price} gp` : ''}
                                    </div>
                                </div>
                                <div style={{ color: '#c5a059', fontSize: '0.8em', fontWeight: 'bold', flexShrink: 0 }}>
                                    +{ammo ? 4 : 1} {ammo ? 'rounds' : 'temp'}
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>
        </BottomSheet>
    );
}
