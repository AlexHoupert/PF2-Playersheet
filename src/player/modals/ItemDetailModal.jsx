import React from 'react';
import { formatText } from '../../utils/rules';
import { isEquipableInventoryItem, getWeaponCapacity } from '../../shared/utils/combatUtils';
import { calculateWeaponDamage } from '../../utils/rules/damage';
import { applyRune, removeRune, getRunes } from '../../utils/rules/runes';
import bloodMagicEffects from '../../../ressources/classfeatures/bloodmagic-effects.json';
import { useState } from 'react';

export function ItemDetailModal({
    character,
    updateCharacter,
    modalData,
    toggleInventoryEquipped,
    onBack,
    onClose,
    hasHistory,
    isLoadingShopDetail,
    shopDetailError,
    onContentLinkClick
}) {
    // Local state for Rune Picker
    const [showRunePicker, setShowRunePicker] = useState(false);

    if (!modalData) return null;

    // --- LOGIC EXTRACTED FROM PlayerApp ---

    // Enhanced Detection
    const isSpell = modalData._entityType === 'spell' || !!modalData.tradition || (modalData.traits?.value || []).includes('Concentrate');
    const isFeat = modalData._entityType === 'feat' || modalData.type === 'Feat' || !!modalData.featType || (modalData.traits?.value || []).includes('Feat');

    // Shop Item (exclude specific types first to avoid 'level' overlap)
    const isShopItem = !isSpell && !isFeat && (!!modalData.price || modalData.level !== undefined);

    const isAction = !isShopItem && !isSpell && !isFeat && (modalData.actions || modalData.actionType);

    let titleText = modalData.name;
    if (modalData.actionType) titleText += ` ${modalData.actionType}`;

    const rarity = (modalData.rarity || 'common').toLowerCase();
    const itemTraits = modalData.traits?.value || modalData.traits || [];
    const tagBadges = isSpell ? (modalData.traits?.value || []) : [];

    // --- INVENTORY MATCHING & EQUIP LOGIC ---
    let inventoryMatch = null;
    let inventoryIndex = -1;
    if (isShopItem && modalData.name) {
        if (modalData._index !== undefined && character.inventory[modalData._index]) {
            const match = character.inventory[modalData._index];
            if (match.name === modalData.name) {
                inventoryMatch = match;
                inventoryIndex = modalData._index;
            }
        }
        if (!inventoryMatch) {
            inventoryIndex = character.inventory.findIndex(i => i.name === modalData.name && !!i.equipped === !!modalData.equipped);
            if (inventoryIndex > -1) inventoryMatch = character.inventory[inventoryIndex];
        }
        // Fallback
        if (!inventoryMatch) {
            inventoryIndex = character.inventory.findIndex(i => i.name === modalData.name);
            if (inventoryIndex > -1) inventoryMatch = character.inventory[inventoryIndex];
        }
    }

    const canToggleEquip = Boolean(inventoryMatch && isEquipableInventoryItem(inventoryMatch));
    const isEquipped = Boolean(inventoryMatch?.equipped);

    // --- RUNE LOGIC ---
    const isWeapon = modalData.type === 'Weapon' || modalData.group;
    const isArmor = modalData.type === 'Armor' || modalData.type === 'Shield';

    // Only allow modification if we have the item in inventory (inventoryMatch)
    const canModifyRunes = (isWeapon || isArmor) && inventoryMatch && updateCharacter;

    const availableRunes = canModifyRunes ? character.inventory.filter(i => {
        const type = i.type || "Equipment";
        const category = i.category || "";
        const name = i.name.toLowerCase();
        const usage = i.system?.usage?.value || "";

        // 1. Check if it looks like a rune
        const isRuneLike = type === 'Rune'
            || category.includes('rune')
            || usage.includes('etched')
            || name.includes('potency')
            || name.includes('striking')
            || name.includes('resilient')
            || name.includes('rune');

        if (!isRuneLike) return false;

        // 2. Compatibility Check
        // Explicit Category
        if (isWeapon && category === 'rune_weapon') return true;
        if (isArmor && category === 'rune_armor') return true;

        // Usage Fallback
        if (usage) {
            if (isWeapon && (usage.includes('weapon') || usage.includes('melee'))) return true;
            if (isArmor && (usage.includes('armor') || usage.includes('shield'))) return true;
        }

        // Name Fallback
        if (isWeapon && (name.includes('weapon') || name.includes('fanged'))) return true;
        if (isArmor && name.includes('armor')) return true;

        // General Property Runes (harder to distinguish without data, assume weapon if unknown?)
        // Let's be safe: if type is explicitly Rune and we haven't filtered it out yet, maybe show it?
        // But if we show Armor rune for Weapon it will error on apply.
        // Let's rely on the loose checks above. If it's "Flaming", it usually doesn't say "Weapon" in name.
        // "Flaming" usually has usage "etched-onto-melee-weapon".

        // Final catch-all for explicit Rune type if we haven't rejected it
        if (type === 'Rune') {
            // If we are here, we didn't match specific category/usage. 
            // Maybe it's a property rune without "weapon" in name?
            // Allow it, applyRune will validate final compatibility.
            return true;
        }

        return false;
    }) : [];

    // --- STAFF LOGIC ---
    const traits = (modalData.traits?.value || modalData.traits || []); // Normalized array or string? Usually array of strings if parsed.
    // Ensure traits is array
    const traitsList = Array.isArray(traits) ? traits.map(t => String(t).toLowerCase()) : [];
    const isStaff = traitsList.includes('staff') || (modalData.name || "").toLowerCase().includes("staff");

    let staffMaxCharges = 0;
    if (isStaff && character.magic?.slots) {
        for (let i = 10; i >= 1; i--) {
            if ((character.magic.slots[`${i}_max`] || 0) > 0) {
                staffMaxCharges = i;
                break;
            }
        }
    }

    const currentStaffCharges = inventoryMatch?.system?.staff?.charges || 0;

    const handlePrepareStaff = () => {
        if (!inventoryMatch) return;
        updateCharacter(c => {
            const item = c.inventory[inventoryIndex];
            if (!item.system) item.system = {};
            if (!item.system.staff) item.system.staff = {};
            item.system.staff.charges = staffMaxCharges;
            item.system.staff.max = staffMaxCharges;
        });
    };

    const toggleStaffCharge = (idx) => {
        if (!inventoryMatch) return;
        // Logic: specific box click or strictly consume? 
        // Standard slot toggle: click 1 sets to 1. Click 1 again sets to 0?
        // Let's match Spell Slot UX: clicking N sets current to N. If current is N, set to N-1.

        let newVal = idx;
        if (currentStaffCharges === idx) newVal = idx - 1;

        updateCharacter(c => {
            const item = c.inventory[inventoryIndex];
            if (!item.system) item.system = {};
            if (!item.system.staff) item.system.staff = {};
            item.system.staff.charges = newVal;
        });
    };

    // --- WAND & SCROLL LOGIC ---
    const isWand = !!inventoryMatch?.system?.wand || traitsList.includes('wand') || (modalData.name || "").toLowerCase().includes("wand");
    const wandCharges = inventoryMatch?.system?.wand?.charges ?? 0;
    const wandMax = inventoryMatch?.system?.wand?.max ?? 1;

    // Spell Data from System (if imbued)
    const imbuedSpell = inventoryMatch?.system?.spell || modalData.system?.spell;

    const toggleWandCharge = (idx) => {
        if (!inventoryMatch) return;
        let newVal = idx;
        if (wandCharges === idx) newVal = idx - 1;

        updateCharacter(c => {
            const item = c.inventory[inventoryIndex];
            if (!item.system) item.system = {};
            if (!item.system.wand) item.system.wand = {};
            item.system.wand.charges = newVal;
        });
    };

    const handleCastSpell = () => {
        if (!inventoryMatch) return;

        if (isWand) {
            // Consume Charge
            if (wandCharges > 0) {
                updateCharacter(c => {
                    const item = c.inventory[inventoryIndex];
                    if (item.system?.wand?.charges > 0) {
                        item.system.wand.charges--;
                    }
                });
            }
        } else {
            // Scroll: Consume Item
            updateCharacter(c => {
                const item = c.inventory[inventoryIndex];
                if (item.qty > 1) {
                    item.qty--;
                } else {
                    c.inventory.splice(inventoryIndex, 1);
                }
            });
            // If completely consumed, close modal
            if (inventoryMatch.qty <= 1) {
                onClose();
            }
        }
    };

    const handleApplyRune = (runeItem) => {
        if (!inventoryMatch) return;

        const { newItem, consumed, error } = applyRune(inventoryMatch, runeItem, { isWeapon, isArmor });

        if (error) {
            alert(error);
            return;
        }

        updateCharacter(c => {
            // 1. Update the item
            c.inventory[inventoryIndex] = newItem;

            // 2. Consume rune
            if (consumed) {
                const rIdx = c.inventory.findIndex(i => i === runeItem || (i.name === runeItem.name && i.qty > 0));
                // Note: passing runeItem directly might be risky if ref changed, use index or name match
                // Better: find by exact ref if possible or name.
                if (rIdx > -1) {
                    if (c.inventory[rIdx].qty > 1) c.inventory[rIdx].qty--;
                    else c.inventory.splice(rIdx, 1);
                }
            }
        });
        setShowRunePicker(false);
        // ModalData will need to refresh? 
        // Since modalData is often a copy, we might need to rely on the parent updating or re-finding the item.
        // ModalManager passes 'modalData' which is state.
        // When we updateCharacter, PlayerApp re-renders. 
        // But ItemDetailModal 'modalData' prop might stay stale until closed/reopened?
        // Actually, PlayerApp doesn't auto-refresh 'modalData' unless we specifically logic it.
        // For now, let's trust we need to close or manually update modalData.
        // Or simpler: We know the new item state, we can't easily force-update the prop from here.
        // We will notify user "Rune Applied" and close? Or just close.
        onClose();
    };

    const handleRemoveRune = (type, propName = null) => {
        if (!inventoryMatch) return;
        const { newItem, runeRecovered } = removeRune(inventoryMatch, type, propName);

        updateCharacter(c => {
            c.inventory[inventoryIndex] = newItem;
            if (runeRecovered) {
                c.inventory.push({ ...runeRecovered, qty: 1 });
            }
        });
        onClose();
    };

    // --- META DATA PREP ---
    const metaParts = [];

    // Rarity Color
    const rarityColors = {
        common: '#e0e0e0', // White/Grey
        uncommon: '#66bb6a', // Green
        rare: '#42a5f5', // Blue
        unique: '#ffca28' // Orange-Gold
    };
    const rarityColor = rarityColors[rarity] || '#e0e0e0';


    if (isShopItem) {
        // Level
        if (modalData.level !== undefined) {
            metaParts.push({ label: 'Level', value: modalData.level });
        }
        // Rarity
        if (rarity) {
            metaParts.push({ label: 'Rarity', value: rarity, color: rarityColor, capitalize: true });
        }
        // Price
        if (modalData.price) {
            metaParts.push({ label: 'Price', value: `${modalData.price} gp` });
        }
        // Bulk
        if (modalData.bulk !== undefined && modalData.bulk !== null) {
            metaParts.push({ label: 'Bulk', value: modalData.bulk });
        }
    } else if (isFeat) {
        // Category
        if (modalData.category) {
            metaParts.push({ label: 'Category', value: modalData.category, capitalize: true });
        }
        // Level
        if (modalData.level !== undefined) {
            metaParts.push({ label: 'Level', value: modalData.level });
        }
    } else if (isAction) {
        // Cost (Actions/Reaction/Free)
        const actionCost = modalData.actionCost
            ? (modalData.actionType === 'reaction' ? 'Reaction' :
                modalData.actionType === 'free' ? 'Free Action' :
                    modalData.actionType === 'passive' ? 'Passive' :
                        `${modalData.actionCost} Action${modalData.actionCost > 1 ? 's' : ''}`)
            : null;

        if (actionCost) {
            metaParts.push({ label: 'Cost', value: actionCost });
        }

        // Feat Prerequisites (often just 'Feat' in raw data, or prerequisites array)
        if (modalData.feat) {
            metaParts.push({ label: 'Prerequisite Feat', value: modalData.feat });
        }
        if (modalData.prerequisites && modalData.prerequisites.length > 0) {
            metaParts.push({ label: 'Prerequisites', value: modalData.prerequisites.join(', ') });
        }
    }


    // --- RENDER ---

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 1000,
            display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 20
        }} onClick={onClose}>
            <div style={{
                backgroundColor: '#2b2b2e', border: '2px solid #c5a059',
                padding: '20px', borderRadius: '8px', maxWidth: '500px', width: '100%',
                color: '#e0e0e0',
                maxHeight: '85vh',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column'
            }} onClick={e => {
                e.stopPropagation();
                if (onContentLinkClick) onContentLinkClick(e);
            }}>
                <style>{`
                    .formatted-content p { margin: 0.5em 0; }
                    .formatted-content ul, .formatted-content ol { margin: 0.5em 0; padding-left: 20px; }
                    .formatted-content { line-height: 1.6; }
                    .content-link { transition: opacity 0.2s; }
                    .gold-link { color: var(--text-gold); cursor: pointer; text-decoration: none; }
                    .gold-link:hover { text-decoration: underline; opacity: 1; }
                    .trait-badge {
                        display: inline-block;
                        background: #000; /* User requested BLACK background */
                        border: 1px solid #444;
                        padding: 1px 6px;
                        font-size: 0.75em;
                        text-transform: uppercase;
                        margin-right: 5px;
                        border-radius: 3px;
                        color: #ccc;
                    }
                    .meta-grid {
                         display: grid;
                         grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
                         gap: 10px;
                         margin-bottom: 15px;
                         padding: 10px 0;
                         border-bottom: 1px solid #444;
                    }
                    .meta-item {
                        display: flex;
                        flex-direction: column;
                    }
                     .meta-label {
                        font-size: 0.75em;
                        color: #888;
                        text-transform: uppercase;
                        margin-bottom: 2px;
                    }
                    .meta-val {
                         font-size: 1em;
                         color: #e0e0e0;
                         font-weight: bold;
                    }
                    .rune-tag {
                        background: #3e2723;
                        border: 1px solid #8d6e63;
                        color: #ffccbc;
                        padding: 2px 6px;
                        border-radius: 4px;
                        font-size: 0.8em;
                        display: inline-flex;
                        align-items: center;
                        gap: 5px;
                        margin-right: 5px;
                        margin-bottom: 5px;
                    }
                    .rune-remove {
                        cursor: pointer;
                        color: #ef9a9a;
                        font-weight: bold;
                    }
                    .rune-remove:hover { color: #ff5252; }
                `}</style>

                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                    <h2 style={{ margin: 0, flex: 1 }}>
                        {modalData.name || "Unknown Item"}
                        {modalData.actionType ? <span style={{ fontSize: '0.6em', color: '#888', marginLeft: 8 }}>{modalData.actionType}</span> : null}
                    </h2>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                        {hasHistory && (
                            <button
                                onClick={(e) => { e.stopPropagation(); onBack(); }}
                                style={{
                                    background: '#c5a059', border: 'none', borderRadius: 4,
                                    padding: '6px 12px', cursor: 'pointer', fontWeight: 'bold', color: '#1a1a1d',
                                    fontSize: '0.8em', whiteSpace: 'nowrap', textTransform: 'uppercase'
                                }}
                            >
                                Back
                            </button>
                        )}
                        {canToggleEquip && (
                            <button
                                type="button"
                                onClick={() => toggleInventoryEquipped(inventoryMatch)}
                                style={{
                                    background: 'var(--bg-dark)',
                                    color: 'var(--text-gold)',
                                    border: '1px solid var(--text-gold)',
                                    borderRadius: 6,
                                    padding: '6px 10px',
                                    cursor: 'pointer',
                                    fontFamily: 'inherit',
                                    fontWeight: 'bold',
                                    textTransform: 'uppercase',
                                    fontSize: '0.75em',
                                    whiteSpace: 'nowrap'
                                }}
                                title={isEquipped ? 'Unequip item' : 'Equip item'}
                            >
                                {isEquipped ? 'Unequip' : 'Equip'}
                            </button>
                        )}
                    </div>
                </div>

                {/* Traits Row */}
                {(isShopItem || isSpell || isAction || isFeat) && (
                    <div style={{ marginBottom: 10, marginTop: 5 }}>
                        {/* Rarity badge removed from here as per request to move to meta, OR keep as badge? 
                            User said: "for items we want: Level, Rarity... Price, Bulk". 
                            Usually rarity IS a trait, but visually distinct.
                            If I move it to meta grid, I should probably remove it from here if it's redundant.
                            Let's keep traits strictly for traits. */}
                        {itemTraits.map(t => <span key={t} className="trait-badge">{t}</span>)}
                        {isSpell && modalData.tradition && <span className="trait-badge">{modalData.tradition}</span>}
                    </div>
                )}

                {/* Ammo Slots Visualization */}
                {(() => {
                    const isCrossbowOrFirearm = isShopItem && (
                        ['crossbow', 'firearm'].includes((modalData.group || '').toLowerCase()) ||
                        (modalData.traits?.value || []).includes('repeating') ||
                        /bow|crossbow|firearm|pistol|musket|rifle|gun|pepperbox|rotary/i.test(modalData.name || '')
                    );

                    if (isCrossbowOrFirearm && inventoryMatch) {
                        const capacity = getWeaponCapacity(inventoryMatch);
                        if (capacity > 0) {
                            return (
                                <div style={{ marginBottom: 15, padding: 10, background: '#1a1a1d', borderRadius: 8, border: '1px solid #444' }}>
                                    <div style={{ fontSize: '0.9em', color: '#888', marginBottom: 8, textTransform: 'uppercase', textAlign: 'center', borderBottom: '1px solid #333', paddingBottom: 5 }}>
                                        Ammunition ({capacity} Slot{capacity > 1 ? 's' : ''})
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                        {Array.from({ length: capacity }).map((_, idx) => {
                                            const loadedAmmo = inventoryMatch.loaded && inventoryMatch.loaded[idx];
                                            const isFilled = !!loadedAmmo;
                                            const isSpecial = loadedAmmo?.isSpecial;

                                            return (
                                                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#252528', padding: '5px 10px', borderRadius: 4 }}>
                                                    <div
                                                        style={{
                                                            width: 20, height: 20,
                                                            borderRadius: '50%',
                                                            border: '2px solid #777',
                                                            background: isFilled ? (isSpecial ? '#90caf9' : '#ffb74d') : 'rgba(0,0,0,0.3)',
                                                            boxShadow: 'inset 0 0 5px rgba(0,0,0,0.5)',
                                                            flexShrink: 0
                                                        }}
                                                    />
                                                    {isFilled ? (
                                                        <div style={{ fontSize: '0.9em', color: isSpecial ? '#90caf9' : '#ffb74d', wordBreak: 'break-word', lineHeight: 1.3 }}>
                                                            {loadedAmmo.name}
                                                        </div>
                                                    ) : (
                                                        <div style={{ fontSize: '0.9em', color: '#555', fontStyle: 'italic' }}>
                                                            Empty Slot
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        }
                    }
                    return null;
                })()}

                {/* Sub-meta (Level, Price, etc) - NEW GRID LAYOUT */}
                {metaParts.length > 0 && (
                    <div className="meta-grid">
                        {metaParts.map((item, i) => (
                            <div key={i} className="meta-item">
                                <span className="meta-label">{item.label}</span>
                                <span className="meta-val" style={item.color ? { color: item.color } : {}}>
                                    {item.capitalize ? String(item.value).charAt(0).toUpperCase() + String(item.value).slice(1) : item.value}
                                </span>
                            </div>
                        ))}
                    </div>
                )}


                {/* Weapon Damage Box (Dynamic) */}
                {(() => {
                    const damageData = (isShopItem && (modalData.type === 'Weapon' || modalData.group) && character)
                        ? calculateWeaponDamage(modalData, character)
                        : null;

                    if (damageData) {
                        return (
                            <div className="weapon-damage-container" style={{ marginBottom: 15, background: '#1e1e20', border: '1px solid #c5a059', borderRadius: 6, padding: 10 }}>

                                {/* Normal Damage */}
                                <div style={{ marginBottom: 10 }}>
                                    <div style={{ color: '#e0e0e0', fontWeight: 'bold', fontSize: '0.7em', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Normal Damage</div>
                                    <div style={{ color: '#ffb74d', fontSize: '0.9em', fontWeight: 'bold' }}>
                                        {damageData.normal.parts ? (
                                            damageData.normal.parts.map((p, i) => (
                                                <span key={i} style={p.style === 'purple' ? { color: '#b39ddb' } : {}}>
                                                    {p.text}{i < damageData.normal.parts.length - 1 ? ' ' : ''}
                                                </span>
                                            ))
                                        ) : (
                                            damageData.normal.text
                                        )}
                                    </div>
                                </div>

                                {/* Critical Damage */}
                                <div style={{ borderTop: '1px solid #444', paddingTop: 10 }}>
                                    <div style={{ color: '#e0e0e0', fontWeight: 'bold', fontSize: '0.7em', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Critical Damage</div>
                                    <div style={{ color: '#ff5252', fontSize: '0.9em', fontWeight: 'bold' }}>
                                        {damageData.crit.parts ? (
                                            damageData.crit.parts.map((p, i) => (
                                                <span key={i} style={p.style === 'purple' ? { color: '#b39ddb' } : {}}>
                                                    {p.text}{i < damageData.crit.parts.length - 1 ? ' ' : ''}
                                                </span>
                                            ))
                                        ) : (
                                            damageData.crit.text
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    }
                    return null;
                })()}

                {/* RUNES SECTION */}
                {canModifyRunes && (
                    <div style={{ marginBottom: 15, borderTop: '1px solid #444', paddingTop: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                            <h3 style={{ margin: 0, fontSize: '1em', color: '#bcaaa4' }}>Runes</h3>
                            <button
                                onClick={() => setShowRunePicker(!showRunePicker)}
                                style={{
                                    background: '#3e2723', color: '#ffccbc', border: '1px solid #8d6e63',
                                    borderRadius: 4, padding: '4px 8px', fontSize: '0.8em', cursor: 'pointer'
                                }}
                            >
                                {showRunePicker ? "Cancel" : "Add Rune"}
                            </button>
                        </div>

                        {/* Current Runes List */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                            {inventoryMatch.system?.runes?.potency ? (
                                <span className="rune-tag">
                                    Potency +{inventoryMatch.system.runes.potency}
                                    <span className="rune-remove" onClick={() => handleRemoveRune('potency')}>×</span>
                                </span>
                            ) : null}

                            {inventoryMatch.system?.runes?.striking ? (
                                <span className="rune-tag">
                                    {inventoryMatch.system.runes.striking.replace(/([A-Z])/g, ' $1').trim().replace(/^./, str => str.toUpperCase())}
                                    <span className="rune-remove" onClick={() => handleRemoveRune('striking')}>×</span>
                                </span>
                            ) : null}

                            {/* Resilient for Armor */}
                            {inventoryMatch.system?.runes?.resilient ? (
                                <span className="rune-tag">
                                    Resilient +{inventoryMatch.system.runes.resilient}
                                    <span className="rune-remove" onClick={() => handleRemoveRune('resilient')}>×</span>
                                </span>
                            ) : null}

                            {(inventoryMatch.system?.runes?.property || []).map((prop, idx) => (
                                <span key={idx} className="rune-tag">
                                    {prop}
                                    <span className="rune-remove" onClick={() => handleRemoveRune('property', prop)}>×</span>
                                </span>
                            ))}

                            {/* Empty state */}
                            {!inventoryMatch.system?.runes?.potency && !inventoryMatch.system?.runes?.striking && (!inventoryMatch.system?.runes?.property?.length) && !inventoryMatch.system?.runes?.resilient && (
                                <div style={{ fontSize: '0.9em', color: '#777', fontStyle: 'italic' }}>No runes applied.</div>
                            )}
                        </div>

                        {/* RUNE PICKER */}
                        {showRunePicker && (
                            <div style={{ marginTop: 10, background: '#1a1a1d', padding: 10, borderRadius: 6, border: '1px solid #555' }}>
                                <div style={{ fontSize: '0.8em', color: '#aaa', marginBottom: 5, textTransform: 'uppercase' }}>Available Runes in Inventory</div>
                                {availableRunes.length === 0 ? (
                                    <div style={{ color: '#777', fontStyle: 'italic' }}>No compatible runes found in inventory.</div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                                        {availableRunes.map(r => (
                                            <div key={r.instanceId || r.name}
                                                onClick={() => handleApplyRune(r)}
                                                style={{
                                                    padding: '5px 8px', background: '#333', borderRadius: 4, cursor: 'pointer',
                                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                                                }}
                                            >
                                                <span>{r.name}</span>
                                                <span style={{ fontSize: '0.8em', color: '#888' }}>Apply</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}



                {/* STAFF CHARGES UI */}
                {isStaff && (
                    <div style={{ marginBottom: 15, padding: 10, background: '#1a1a1d', borderRadius: 8, border: '1px solid #444' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, borderBottom: '1px solid #333', paddingBottom: 5 }}>
                            <span style={{ fontSize: '0.9em', color: '#888', textTransform: 'uppercase' }}>
                                Staff Charges ({currentStaffCharges}/{staffMaxCharges})
                            </span>
                            <button
                                onClick={handlePrepareStaff}
                                style={{
                                    background: 'var(--text-gold)', color: '#000', border: 'none', borderRadius: 4,
                                    padding: '2px 8px', fontSize: '0.7em', fontWeight: 'bold', cursor: 'pointer'
                                }}
                            >
                                Prepare
                            </button>
                        </div>

                        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 5 }}>
                            {staffMaxCharges > 0 ? Array.from({ length: staffMaxCharges }).map((_, i) => {
                                const idx = i + 1;
                                const isActive = idx <= currentStaffCharges;
                                return (
                                    <div
                                        key={idx}
                                        onClick={() => toggleStaffCharge(idx)}
                                        style={{
                                            width: 24, height: 24,
                                            background: isActive ? 'var(--text-gold)' : '#111',
                                            border: '1px solid var(--text-gold)',
                                            transform: 'rotate(45deg)',
                                            margin: 6,
                                            cursor: 'pointer',
                                            boxShadow: isActive ? '0 0 5px var(--text-gold)' : 'none',
                                            transition: 'all 0.2s'
                                        }}
                                        title={`Charge ${idx}`}
                                    />
                                );
                            }) : (
                                <div style={{ fontSize: '0.8em', color: '#666', fontStyle: 'italic' }}>
                                    No spell slots available to charge staff.
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* WAND CHARGES UI */}
                {isWand && (
                    <div style={{ marginBottom: 15, padding: 10, background: '#1a1a1d', borderRadius: 8, border: '1px solid #444' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, borderBottom: '1px solid #333', paddingBottom: 5 }}>
                            <span style={{ fontSize: '0.9em', color: '#888', textTransform: 'uppercase' }}>
                                Wand Charges ({wandCharges}/{wandMax})
                            </span>
                        </div>

                        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 5 }}>
                            {Array.from({ length: wandMax }).map((_, i) => {
                                const idx = i + 1;
                                const isActive = idx <= wandCharges;
                                return (
                                    <div
                                        key={idx}
                                        onClick={() => toggleWandCharge(idx)}
                                        style={{
                                            width: 24, height: 24,
                                            background: isActive ? 'var(--text-gold)' : '#111',
                                            border: '1px solid var(--text-gold)',
                                            transform: 'rotate(45deg)',
                                            margin: 6,
                                            cursor: 'pointer',
                                            boxShadow: isActive ? '0 0 5px var(--text-gold)' : 'none',
                                            transition: 'all 0.2s'
                                        }}
                                        title={`Charge ${idx}`}
                                    />
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* IMBUED SPELL UI */}
                {imbuedSpell && (
                    <div style={{ marginBottom: 15, padding: 10, background: '#251b38', borderRadius: 8, border: '1px solid #673ab7' }}>
                        <h3 style={{ marginTop: 0, color: '#b39ddb', fontSize: '1.1em', display: 'flex', alignItems: 'center', gap: 10 }}>
                            <img src={imbuedSpell.img ? `ressources/${imbuedSpell.img}` : 'icons/svg/mystery-man.svg'} style={{ width: 24, height: 24 }} alt="" />
                            {imbuedSpell.name}
                            <span style={{ fontSize: '0.8em', color: '#888', fontWeight: 'normal' }}>(Rank {imbuedSpell.level})</span>
                        </h3>

                        <div style={{ fontSize: '0.9em', color: '#ddd', marginBottom: 10 }}>
                            {imbuedSpell.traditions && <div><strong>Traditions:</strong> {imbuedSpell.traditions.join(', ')}</div>}
                        </div>

                        {inventoryMatch && (
                            <button
                                onClick={handleCastSpell}
                                disabled={isWand && wandCharges <= 0}
                                style={{
                                    width: '100%',
                                    padding: '8px',
                                    background: (isWand && wandCharges <= 0) ? '#444' : '#673ab7',
                                    color: (isWand && wandCharges <= 0) ? '#888' : '#fff',
                                    border: 'none', borderRadius: 4, cursor: (isWand && wandCharges <= 0) ? 'not-allowed' : 'pointer',
                                    fontWeight: 'bold', textTransform: 'uppercase'
                                }}
                            >
                                Cast Spell {isWand ? (wandCharges <= 0 ? '(Empty)' : '(Consume Charge)') : '(Consume Item)'}
                            </button>
                        )}
                    </div>
                )}

                <div
                    className="formatted-content"
                    dangerouslySetInnerHTML={{
                        __html: formatText(
                            modalData.description ||
                            (isLoadingShopDetail ? 'Loading item details…' : shopDetailError ? `Failed to load item details: ${shopDetailError}` : 'No description.'),
                            { actor: character }
                        )
                    }}
                />

                {/* Blood Magic Display */}
                {isSpell && modalData.Bloodmagic && (
                    <div style={{ marginTop: 20, borderTop: '1px solid #444', paddingTop: 10 }}>
                        <h3 style={{ color: '#8B0000', margin: '0 0 5px 0', fontFamily: 'Cinzel, serif' }}>Blood Magic</h3>

                        {!character.magic?.bloodmagic ? (
                            <div style={{ color: '#aaa', fontStyle: 'italic' }}>
                                (Character has no active Blood Magic)
                            </div>
                        ) : !bloodMagicEffects.Effects[character.magic.bloodmagic] ? (
                            <div style={{ color: 'orange' }}>
                                Effect "{character.magic.bloodmagic}" not found in library.
                                (Available: {Object.keys(bloodMagicEffects.Effects || {}).join(', ')})
                            </div>
                        ) : (
                            <>
                                <strong style={{ color: '#D22B2B', display: 'block', marginBottom: 5 }}>
                                    {character.magic.bloodmagic}
                                </strong>
                                <div
                                    className="formatted-content"
                                    dangerouslySetInnerHTML={{ __html: formatText(bloodMagicEffects.Effects[character.magic.bloodmagic].description || "") }}
                                />
                            </>
                        )}
                    </div>
                )}

                <button onClick={onClose} style={{
                    marginTop: 20, width: '100%', padding: '10px', background: '#c5a059',
                    border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 'bold', color: '#1a1a1d',
                    flexShrink: 0
                }}>Close</button>
            </div>
        </div>
    );
}
