import React from 'react';
import { formatText } from '../../utils/rules';
import { isEquipableInventoryItem, getWeaponCapacity } from '../../shared/utils/combatUtils';
import { calculateWeaponDamage } from '../../utils/rules/damage';
import bloodMagicEffects from '../../../ressources/classfeatures/bloodmagic-effects.json';

export function ItemDetailModal({
    character,
    modalData,
    toggleInventoryEquipped,
    onBack,
    onClose,
    hasHistory,
    isLoadingShopDetail,
    shopDetailError,
    onContentLinkClick
}) {
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
    if (isShopItem && modalData.name) {
        if (modalData._index !== undefined && character.inventory[modalData._index]) {
            const match = character.inventory[modalData._index];
            if (match.name === modalData.name) {
                inventoryMatch = match;
            }
        }
        if (!inventoryMatch) {
            inventoryMatch = character.inventory.find(i => i.name === modalData.name && !!i.equipped === !!modalData.equipped);
        }
        // Fallback
        if (!inventoryMatch) {
            inventoryMatch = character.inventory.find(i => i.name === modalData.name);
        }
    }

    const canToggleEquip = Boolean(inventoryMatch && isEquipableInventoryItem(inventoryMatch));
    const isEquipped = Boolean(inventoryMatch?.equipped);

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
