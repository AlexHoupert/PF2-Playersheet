import React, { useState, useRef, useEffect } from 'react';
import { getShopIndexItemByName } from '../../shared/catalog/shopIndex';
import { getShopItemRowMeta } from '../../shared/catalog/shopRowMeta';
import { shouldStack } from '../../shared/utils/inventoryUtils';
import { useInventoryLogic } from '../../shared/hooks/useInventoryLogic';
import { useCombatLogic } from '../../shared/hooks/useCombatLogic';
import { deepClone } from '../../shared/utils/deepClone';

export function InventoryView({
    character,
    updateCharacter,
    db,
    setDb,
    onOpenModal,
    onOpenShop,
    onOpenFormulas,
    pressEvents
}) {
    const [itemSubTab, setItemSubTab] = useState('Equipment');
    const { isEquipable, consumeItem, toggleEquip, unstackItem } = useInventoryLogic({ character, updateCharacter });
    const { getWeaponCapacity, getWeaponAttackBonus, loadWeapon, fireWeapon } = useCombatLogic({ character, updateCharacter });

    const equipTapRef = useRef({ key: null, time: 0 });
    const equipTapTimeoutRef = useRef(null);

    // Cleanup timeout on unmount or tab change
    useEffect(() => {
        return () => {
            if (equipTapTimeoutRef.current) clearTimeout(equipTapTimeoutRef.current);
        };
    }, [itemSubTab]);

    const getInventoryBucket = (item) => {
        const fromIndex = item?.name ? getShopIndexItemByName(item.name) : null;
        const type = String(item?.type || fromIndex?.type || '').toLowerCase();
        const category = String(item?.category || fromIndex?.category || '').toLowerCase();

        if (['armor', 'shield', 'weapon'].includes(type)) return 'equipment';
        if (type === 'ammo') return 'consumables';
        if (['potion', 'poison', 'mutagen', 'ammo', 'gadget'].includes(category)) return 'consumables';
        return 'misc';
    };

    const items = Array.isArray(character.inventory) ? character.inventory : [];
    // Wrap to preserve index for updates
    const wrappedItems = items.map((item, index) => ({ item, index }));

    const equipmentItems = wrappedItems.filter(({ item }) => getInventoryBucket(item) === 'equipment');
    const consumableItems = wrappedItems.filter(({ item }) => getInventoryBucket(item) === 'consumables');
    const miscItems = wrappedItems.filter(({ item }) => getInventoryBucket(item) === 'misc');

    // Loot Logic
    const hasLoot = db?.lootBags?.some(b => !b.isLocked && b.items.some(i => !i.claimedBy));

    const inspectInventoryItem = (item) => {
        const fromIndex = item?.name ? getShopIndexItemByName(item.name) : null;
        const merged = fromIndex ? { ...fromIndex, ...item, qty: item.qty || 1 } : item;
        onOpenModal('item', merged);
    };

    const handleItemClickGeneric = (item) => {
        // Simple inspect for non-equipables
        inspectInventoryItem(item);
    };

    const renderRow = (item, index, { enableEquipTap = false } = {}) => {
        const key = `${item?.name}-${index}`;
        const qty = item?.qty || 1;
        const fromIndex = item?.name ? getShopIndexItemByName(item.name) : null;
        const merged = fromIndex ? { ...fromIndex, ...item } : item;
        const { row1, row2 } = getShopItemRowMeta(merged);

        let clickHandler;
        if (enableEquipTap && isEquipable(item)) {
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
                    toggleEquip(item);
                    return;
                }

                equipTapRef.current = { key: tapKey, time: now };
                equipTapTimeoutRef.current = setTimeout(() => {
                    inspectInventoryItem(item);
                    equipTapTimeoutRef.current = null;
                }, 260);
            };
        } else {
            // Check if consumable?
            if (getInventoryBucket(item) === 'consumables') {
                // Consumable Logic: Double Tap = Use
                // PlayerApp had generic logic for this.
                // Reimplementing double tap for consumables if needed, 
                // but PlayerApp code showed "else { tapRef... }" in handleItemClick (Line 146).
                // Yes, Consumables support double tap use.
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
                        consumeItem(item);
                        alert(`Used ${item.name}`); // Should trigger Toast ideally
                        return;
                    }

                    equipTapRef.current = { key: tapKey, time: now };
                    equipTapTimeoutRef.current = setTimeout(() => {
                        inspectInventoryItem(item);
                        equipTapTimeoutRef.current = null;
                    }, 260);
                };
            } else {
                clickHandler = () => inspectInventoryItem(item);
            }
        }

        return (
            <div className="item-row inventory-item-row" key={key}
                onClick={clickHandler}
                {...pressEvents?.(merged, 'inventory_item')}
            >
                {merged?.img && (
                    <img className="item-icon" src={`ressources/${merged.img}`} alt="" />
                )}
                <div className="item-row-main">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div className="item-name">
                            {merged?.name || 'Unknown Item'}
                            {item.prepared && (
                                <span style={{
                                    marginLeft: 8,
                                    fontSize: '0.7em',
                                    background: '#30204a',
                                    color: '#b39ddb',
                                    border: '1px solid #5e35b1',
                                    padding: '1px 4px',
                                    borderRadius: 4,
                                    verticalAlign: 'middle',
                                    fontStyle: 'italic',
                                    display: 'inline-block'
                                }}>
                                    ⚡ Temp
                                </span>
                            )}
                        </div>

                        {/* Ammo Slots & Counter */}
                        {isEquipable(item) && (['crossbow', 'firearm'].includes((merged.group || '').toLowerCase()) || (merged.traits?.value || []).includes('repeating') || /bow|crossbow|firearm|pistol|musket|rifle|gun/i.test(merged.name)) && (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', marginLeft: 10 }}>
                                <div style={{ display: 'flex', gap: 4 }}>
                                    {Array.from({ length: getWeaponCapacity(merged) }).map((_, idx) => {
                                        const loadedAmmo = item.loaded && item.loaded[idx];
                                        const isFilled = !!loadedAmmo;
                                        const isSpecial = loadedAmmo?.isSpecial;

                                        return (
                                            <div
                                                key={idx}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (isFilled) fireWeapon(index, idx);
                                                    else loadWeapon(index, idx);
                                                }}
                                                style={{
                                                    width: 18, height: 18, borderRadius: '50%',
                                                    border: '1px solid #c5a059',
                                                    background: isFilled ? (isSpecial ? '#42a5f5' : '#c5a059') : 'transparent',
                                                    cursor: 'pointer'
                                                }}
                                                title={isFilled ? `Unload ${loadedAmmo.name}` : "Load Standard Ammo"}
                                            />
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Weapon Proficiency Bonus */}
                        {isEquipable(item) && String(merged.type || '').toLowerCase() !== 'armor' && (
                            <div
                                style={{
                                    marginLeft: 10,
                                    fontWeight: 'bold',
                                    color: 'var(--text-gold)',
                                    fontSize: '1.1em',
                                    whiteSpace: 'nowrap',
                                    cursor: 'help'
                                }}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    const bonusInfo = getWeaponAttackBonus(merged);
                                    const bonusData = (typeof bonusInfo === 'object') ? bonusInfo : {
                                        total: bonusInfo,
                                        breakdown: { proficiency: 0, level: 0, attribute: 0, item: 0 },
                                        source: {}
                                    };

                                    onOpenModal('detail', {
                                        title: `Attack Bonus: ${merged.name}`,
                                        total: bonusData.total,
                                        base: 0,
                                        breakdown: bonusData.breakdown,
                                        source: bonusData.source
                                    });
                                }}
                            >
                                {(() => {
                                    const bonusInfo = getWeaponAttackBonus(merged);
                                    const bonus = (typeof bonusInfo === 'object') ? bonusInfo.total : bonusInfo;
                                    return bonus >= 0 ? `+${bonus}` : bonus;
                                })()}
                            </div>
                        )}
                    </div>
                    {row1 && <div className="item-row-meta item-row-meta-1">{row1}</div>}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: row2 ? 0 : 4 }}>
                        <div className="item-row-meta item-row-meta-2" style={{ flex: 1, marginRight: 10 }}>
                            {row2}
                        </div>

                        {/* Remaining Standard Ammo Counter */}
                        {isEquipable(item) && (['crossbow', 'firearm'].includes((merged.group || '').toLowerCase()) || (merged.traits?.value || []).includes('repeating') || /bow|crossbow|firearm|pistol|musket|rifle|gun/i.test(merged.name)) && (() => {
                            const grp = (merged.group || '').toLowerCase();
                            const name = (merged.name || '').toLowerCase();
                            let ammoName = null;
                            let count = 0;

                            if (grp === 'firearm' || /firearm|pistol|musket|rifle|gun|pepperbox/i.test(name)) {
                                const matches = character.inventory.filter(i => i.name === 'Rounds (universal)' || i.name.toLowerCase().includes('round'));
                                count = matches.reduce((acc, i) => acc + (i.qty || 0), 0);
                                ammoName = "Rounds";
                            } else if (grp === 'crossbow' || name.includes('crossbow')) {
                                const matches = character.inventory.filter(i => /bolts?/i.test(i.name));
                                count = matches.reduce((acc, i) => acc + (i.qty || 0), 0);
                                ammoName = "Bolts";
                            } else if (grp === 'bow' || name.includes('bow')) {
                                const matches = character.inventory.filter(i => /arrows?/i.test(i.name));
                                count = matches.reduce((acc, i) => acc + (i.qty || 0), 0);
                                ammoName = "Arrows";
                            }

                            if (ammoName) {
                                return (
                                    <div style={{ fontSize: '0.75em', color: '#888', fontStyle: 'italic', whiteSpace: 'nowrap', paddingTop: 2, marginRight: 10 }}>
                                        {count} {ammoName} left
                                    </div>
                                );
                            }
                            return null;
                        })()}

                        {isEquipable(item) && shouldStack(item) && (
                            <div style={{ fontSize: '0.75em', color: '#888', fontStyle: 'italic', whiteSpace: 'nowrap', paddingTop: 2, marginLeft: 'auto' }}>
                                {qty} left
                            </div>
                        )}
                    </div>
                </div>

                {(!isEquipable(item)) && <div className="inventory-qty" style={{ marginLeft: 10, alignSelf: 'center' }}>x{qty}</div>}
            </div>
        );
    };

    const tabButtons = (
        <div className="sub-tabs">
            {['Equipment', 'Consumables', 'Misc', hasLoot ? 'Loot' : null].filter(Boolean).map(t => (
                <button
                    key={t}
                    className={`sub-tab-btn ${itemSubTab === t ? 'active' : ''}`}
                    onClick={() => setItemSubTab(t)}
                >
                    {t}
                    {t === 'Loot' && hasLoot && <span style={{ color: '#d32f2f', marginLeft: 5 }}>!</span>}
                </button>
            ))}
        </div>
    );

    const openShopButton = (
        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
            <button className="btn-add-condition" style={{ flex: 1, margin: 0 }} onClick={onOpenShop}>
                + Open Shop
            </button>
            <button className="btn-add-condition" style={{ flex: 1, margin: 0 }} onClick={onOpenFormulas}>
                📖 Formulas
            </button>
        </div>
    );

    if (itemSubTab === 'Loot') {
        const visibleBags = (db.lootBags || []).filter(b => !b.isLocked);
        const bagsWithLoot = visibleBags.filter(b => b.items.some(i => !i.claimedBy));

        return (
            <div>
                {tabButtons}
                {bagsWithLoot.length === 0 && <div style={{ color: '#666', fontStyle: 'italic', marginTop: 20 }}>No loot available.</div>}
                {bagsWithLoot.map(bag => {
                    const unclaimedItems = bag.items.filter(i => !i.claimedBy);
                    if (unclaimedItems.length === 0) return null;

                    return (
                        <div key={bag.id} style={{ background: '#222', border: '1px solid #c5a059', borderRadius: 8, padding: 10, marginBottom: 15, marginTop: 10 }}>
                            <h3 style={{ marginTop: 0, color: '#ffecb3', borderBottom: '1px solid #444', paddingBottom: 5, fontSize: '1em' }}>💰 {bag.name}</h3>
                            {unclaimedItems.map((item) => {
                                const fromIndex = item?.name ? getShopIndexItemByName(item.name) : null;
                                const merged = fromIndex ? { ...fromIndex, ...item } : item;
                                const { row1, row2 } = getShopItemRowMeta(merged);

                                return (
                                    <div key={item.instanceId} className="item-row inventory-item-row" style={{ marginTop: 5 }} onClick={() => inspectInventoryItem(item)}>
                                        {merged?.img && (
                                            <img className="item-icon" src={`ressources/${merged.img}`} alt="" />
                                        )}
                                        <div className="item-row-main">
                                            <div className="item-name">{merged?.name || 'Unknown Item'}</div>
                                            {row1 && <div className="item-row-meta item-row-meta-1">{row1}</div>}
                                            {row2 && <div className="item-row-meta item-row-meta-2">{row2}</div>}
                                        </div>
                                        <button className="set-btn" style={{ margin: '0 0 0 10px', padding: '6px 14px', fontSize: '0.9em', width: 'auto', flexShrink: 0, height: 'auto' }}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                // Claim Item Logic
                                                updateCharacter(c => {
                                                    const stackable = shouldStack(item);
                                                    const existing = stackable ? c.inventory.find(i => i.name === item.name) : null;
                                                    if (existing) {
                                                        existing.qty = (existing.qty || 1) + 1;
                                                    } else {
                                                        c.inventory.push({ ...item, qty: 1, instanceId: undefined, addedAt: undefined, claimedBy: undefined });
                                                    }
                                                });
                                                setDb(prev => {
                                                    const bags = deepClone(prev.lootBags || []);
                                                    const b = bags.find(xb => xb.id === bag.id);
                                                    if (b) {
                                                        const it = b.items.find(x => x.instanceId === item.instanceId);
                                                        if (it) it.claimedBy = character.name;
                                                    }
                                                    return { ...prev, lootBags: bags };
                                                });
                                            }}
                                        >
                                            Claim
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    );
                })}
            </div>
        );
    }

    if (itemSubTab === 'Equipment') {
        const equipped = equipmentItems.filter(({ item }) => item?.equipped);
        const unequipped = equipmentItems.filter(({ item }) => !item?.equipped);

        return (
            <div>
                {tabButtons}
                <div className="action-subtype-header">Equipped</div>
                {equipped.length === 0 && <div style={{ color: '#666', fontStyle: 'italic' }}>No equipped items.</div>}
                {equipped.map(({ item, index }) => renderRow(item, index, { enableEquipTap: true }))}

                <div className="action-subtype-header">Unequipped</div>
                {unequipped.length === 0 && <div style={{ color: '#666', fontStyle: 'italic' }}>No unequipped items.</div>}
                {unequipped.map(({ item, index }) => renderRow(item, index, { enableEquipTap: true }))}
                {openShopButton}
            </div>
        );
    }

    const list = itemSubTab === 'Consumables' ? consumableItems : miscItems;
    const emptyText = itemSubTab === 'Consumables' ? 'No consumables.' : 'No misc items.';

    return (
        <div>
            {tabButtons}
            {list.length === 0 && <div style={{ color: '#666', fontStyle: 'italic' }}>{emptyText}</div>}
            {list.map(({ item, index }) => renderRow(item, index))}
            {openShopButton}
        </div>
    );
}
