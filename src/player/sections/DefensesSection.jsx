import React from 'react';
import { useCharacterStats } from '../../shared/hooks/useCharacterStats';
import { calculateStat } from '../../utils/rules';
import { getShopIndexItemByName } from '../../shared/catalog/shopIndex';
import { LongPressable } from '../../shared/components/LongPressable';

export function DefensesSection({ character, updateCharacter, onOpenModal, onLongPress }) {
    const { getArmorClassData } = useCharacterStats(character);
    const acData = getArmorClassData(character);
    const totalAC = acData.totalAC;
    const acPenalty = acData.acPenalty;

    // Shield Logic (merged from PlayerApp logic)
    const equippedShield = acData.shieldName ? character.inventory.find(i => i.name === acData.shieldName) : null;
    let shieldHp = 0, shieldMax = 20, isBroken = false, hardness = 0, shieldPct = 0;

    if (equippedShield) {
        shieldHp = character.stats.ac?.shield_hp || 0;
        const fromIndex = equippedShield.name ? getShopIndexItemByName(equippedShield.name) : null;
        const merged = fromIndex ? { ...fromIndex, ...equippedShield } : equippedShield;

        // Fix from recent commit: check top level first, then system
        shieldMax = (merged.hpMax) || (merged.system?.hp?.max) || 20;
        hardness = (merged.hardness) || (merged.system?.hardness) || 0;

        isBroken = shieldHp < (shieldMax / 2);
        shieldPct = Math.min(100, Math.max(0, (shieldHp / shieldMax) * 100));
    }

    const saves = ["Fortitude", "Reflex", "Will"];

    return (
        <div>
            <h3 style={{ borderBottom: '1px solid #5c4033', paddingBottom: 5, marginBottom: 10 }}>Defenses</h3>
            <div className="defenses-row">
                {/* AC Shield */}
                {/* AC Shield Area */}
                <div style={{ position: 'relative', display: 'inline-block' }}>
                    <LongPressable
                        className="shield-container"
                        onClick={() => onOpenModal('ac', null)}
                        onLongPress={() => onLongPress && onLongPress(null, 'ac_button')}
                    >
                        <div className="shield-shape">
                            <div className={`shield-val ${acData.totalConditionPenalty > 0 ? 'stat-penalty' : ''}`}>
                                {totalAC}
                                {acData.totalConditionPenalty > 0 && <span className="stat-penalty-inline">(-{acData.totalConditionPenalty})</span>}
                            </div>
                            <div className="shield-label">AC</div>
                        </div>
                    </LongPressable>

                    {/* Raise Shield Badge (Outside LongPressable to avoid conflict) */}
                    {equippedShield && (
                        <div
                            style={{
                                position: 'absolute',
                                bottom: -5,
                                right: -8,
                                width: 28,
                                height: 28,
                                borderRadius: '50%',
                                background: acData.shieldRaised ? '#222' : 'rgba(0,0,0,0.5)',
                                border: `2px solid ${acData.shieldRaised ? '#ffecb3' : '#666'}`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '0.8em',
                                fontWeight: 'bold',
                                cursor: 'pointer',
                                zIndex: 10,
                                boxShadow: '0 2px 4px rgba(0,0,0,0.5)',
                                textDecorationLine: (isBroken) ? 'line-through' : 'none',
                                textDecorationColor: '#ff5252',
                                textDecorationThickness: '2px',
                                borderColor: isBroken ? '#ff5252' : (acData.shieldRaised ? '#ffecb3' : '#666'),
                                color: isBroken ? '#ff5252' : (acData.shieldRaised ? '#ffecb3' : '#aaa')
                            }}
                            onClick={(e) => {
                                e.stopPropagation();
                                console.log("Shield Toggle Clicked. isBroken:", isBroken, "Raised:", acData.shieldRaised);
                                if (isBroken && !acData.shieldRaised) return;
                                updateCharacter(c => {
                                    if (!c.stats.ac) c.stats.ac = {};
                                    c.stats.ac.shield_raised = !c.stats.ac.shield_raised;
                                });
                            }}
                            title={isBroken ? "Shield Broken (Cannot Raise)" : (acData.shieldRaised ? "Lower Shield" : "Raise Shield")}
                        >
                            <span style={{ pointerEvents: 'none' }}>+{acData.activeShieldBonus || (equippedShield.acBonus ?? 2)}</span>
                        </div>
                    )}
                </div>

                {/* Saves */}
                {saves.map(save => {
                    const raw = (character.stats.saves || {})[save.toLowerCase()] || 0;
                    const calc = calculateStat(character, save, raw);
                    return (
                        <LongPressable
                            className="save-box"
                            key={save}
                            onClick={() => onOpenModal('detail', { title: save, ...calc })}
                            onLongPress={() => onLongPress && onLongPress(save, 'save')}
                        >
                            <div className={`save-val ${calc.penalty < 0 ? 'stat-penalty' : ''}`}>
                                {calc.total >= 0 ? '+' : ''}{calc.total}
                                {calc.penalty < 0 && <span className="stat-penalty-inline">({calc.penalty})</span>}
                            </div>
                            <div className="save-label">{save}</div>
                        </LongPressable>
                    );
                })}
            </div>

            {equippedShield && (
                <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 10 }} onClick={() => onOpenModal('shield', null)}>
                    <div style={{ fontSize: '0.85em', color: isBroken ? '#ff5252' : '#ccc', width: 80, flexShrink: 0, textDecorationLine: isBroken ? 'line-through' : 'none', textDecorationColor: '#ff5252', textDecorationThickness: '2px' }}>
                        Hardness: <span style={{ color: isBroken ? '#ff5252' : '#fff' }}>{hardness}</span>
                    </div>
                    <div className="shield-hp-bar" style={{ flex: 1, height: 20, background: '#222', borderRadius: 4, overflow: 'hidden', position: 'relative', border: '1px solid #555', cursor: 'pointer' }}>
                        <div style={{ width: `${shieldPct}%`, background: '#9e9e9e', height: '100%', transition: 'width 0.3s' }}></div>
                        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75em', color: '#fff', textShadow: '0 0 3px black', fontWeight: 'bold' }}>
                            {shieldHp} / {shieldMax} {isBroken && <span style={{ color: '#ff5252', marginLeft: 5 }}>(BROKEN)</span>}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
