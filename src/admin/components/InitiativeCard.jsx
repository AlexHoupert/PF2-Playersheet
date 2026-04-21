/**
 * InitiativeCard – compact combat card for encounter tracker.
 * Shows name, HP bar, AC/saves, initiative badge, condition pills.
 * Accepts `isActive` for the enlarged active-turn styling.
 * Wrapped in forwardRef for framer-motion AnimatePresence compatibility.
 */
import React, { useState, forwardRef } from 'react';
import { motion } from 'framer-motion';
import { calculateStat } from '../../utils/rules';
import { getArmorClassData } from '../../shared/hooks/useCharacterStats';
import './InitiativeCard.css';

const InitiativeCard = forwardRef(function InitiativeCard({
    combatant,
    isActive = false,
    isSelected = false,
    isGM = true,
    onClick,
    onContextMenu,
    onInitiativeChange,
    onHpChange,
    creatureData,        // full creature stats from catalog (for creatures)
    characterData,       // character object from campaign (for players)
    revealState,         // { hp: 'precise'|'estimate'|'hidden' } — only relevant for creatures on player screen
}, ref) {
    const [editingInit, setEditingInit] = useState(false);
    const [editingHp, setEditingHp] = useState(false);
    const [tempInit, setTempInit] = useState('');
    const [tempHp, setTempHp] = useState('');

    const instanceSuffix = combatant.instanceLabel > 1 ? ` #${combatant.instanceLabel}` : '';
    const isHidden = !combatant.visible;
    const isPlayer = combatant.type === 'player';
    const nameRevealed = isGM || isPlayer || revealState?.name === 'precise';
    const displayName = (nameRevealed ? combatant.name : (combatant.unknownName || '???')) + instanceSuffix;

    // For player combatants, use live characterData HP when available
    const liveMaxHp = isPlayer && characterData ? (characterData.stats?.hp?.max ?? characterData.hp?.max ?? combatant.maxHp) : combatant.maxHp;
    const liveCurrentHp = isPlayer && characterData ? (characterData.stats?.hp?.current ?? characterData.hp?.current ?? combatant.currentHp) : combatant.currentHp;

    // HP display: GM and players always see their own HP precisely.
    // Creatures on the player screen respect revealState.hp.
    const hpReveal = (isGM || isPlayer) ? 'precise' : (revealState?.hp || 'hidden');
    const rawHpPct = liveMaxHp > 0 ? Math.max(0, Math.min(100, (liveCurrentHp / liveMaxHp) * 100)) : 100;
    const hpBarPct = hpReveal === 'precise' ? rawHpPct : 100; // estimate and hidden both show a full bar
    const hpColor = hpReveal === 'hidden' ? '#555' : (rawHpPct > 60 ? '#4caf50' : rawHpPct > 30 ? '#ff9800' : '#f44336');
    const hpText = hpReveal === 'precise' ? `${liveCurrentHp}/${liveMaxHp}` : '?/?';

    // Gather stat values
    let ac;
    if (isPlayer && characterData) {
        try { ac = getArmorClassData(characterData).totalAC; } catch { ac = '?'; }
    } else {
        ac = creatureData?.system?.attributes?.ac?.value ?? creatureData?.ac ?? '?';
    }

    const computePlayerSave = (saveKey) => {
        if (!characterData?.stats?.saves) return '?';
        const profRank = characterData.stats.saves[saveKey] ?? 0;
        try { return calculateStat(characterData, saveKey.charAt(0).toUpperCase() + saveKey.slice(1), profRank).total; }
        catch { return profRank || '?'; }
    };

    const fort = isPlayer
        ? computePlayerSave('fortitude')
        : (creatureData?.system?.saves?.fortitude?.value ?? creatureData?.saves?.fortitude ?? '?');
    const ref_ = isPlayer
        ? computePlayerSave('reflex')
        : (creatureData?.system?.saves?.reflex?.value ?? creatureData?.saves?.reflex ?? '?');
    const will = isPlayer
        ? computePlayerSave('will')
        : (creatureData?.system?.saves?.will?.value ?? creatureData?.saves?.will ?? '?');

    const handleInitiativeClick = (e) => {
        if (!isGM) return;
        e.stopPropagation();
        setTempInit(String(combatant.initiative ?? ''));
        setEditingInit(true);
    };

    const commitInit = () => {
        const val = parseFloat(tempInit);
        if (!isNaN(val)) onInitiativeChange?.(combatant.id, val);
        setEditingInit(false);
    };

    const handleHpClick = (e) => {
        if (!isGM) return;
        e.stopPropagation();
        setTempHp(String(combatant.currentHp ?? 0));
        setEditingHp(true);
    };

    const commitHp = () => {
        const val = parseInt(tempHp);
        if (!isNaN(val)) onHpChange?.(combatant.id, val);
        setEditingHp(false);
    };

    const formatBonus = (val) => {
        const n = parseInt(val);
        if (isNaN(n)) return '?';
        return n >= 0 ? `+${n}` : `${n}`;
    };

    return (
        <motion.div
            ref={ref}
            layout
            layoutId={combatant.id}
            className={[
                'init-card',
                isActive && 'init-card--active',
                isSelected && 'init-card--selected',
                isHidden && 'init-card--hidden',
                isPlayer ? 'init-card--player' : 'init-card--creature',
            ].filter(Boolean).join(' ')}
            onClick={() => onClick?.(combatant.id)}
            onContextMenu={(e) => {
                e.preventDefault();
                onContextMenu?.(e, combatant);
            }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, x: -60 }}
            transition={{
                type: 'spring', stiffness: 180, damping: 24,
                layout: { type: 'spring', stiffness: 150, damping: 22, delay: 0.15 },
            }}
        >
            {/* Initiative Badge */}
            <div className="init-card__badge" onClick={handleInitiativeClick}>
                {editingInit ? (
                    <input
                        autoFocus
                        className="init-card__badge-input"
                        value={tempInit}
                        onChange={(e) => setTempInit(e.target.value)}
                        onBlur={commitInit}
                        onKeyDown={(e) => { if (e.key === 'Enter') commitInit(); if (e.key === 'Escape') setEditingInit(false); }}
                        onClick={(e) => e.stopPropagation()}
                    />
                ) : (
                    <span>{combatant.initiative ?? '—'}</span>
                )}
            </div>

            {/* Main content area */}
            <div className="init-card__body">
                {/* Row 1: name + icon */}
                <div className="init-card__name-row">
                    <span className="init-card__type-icon">{isPlayer ? '🧑' : '👹'}</span>
                    <span className="init-card__name">{displayName}</span>
                    {isHidden && isGM && <span className="init-card__hidden-icon" title="Hidden from players">👁️‍🗨️</span>}
                </div>

                {/* Row 2: HP bar */}
                <div className="init-card__hp-row" onClick={isGM ? handleHpClick : undefined}>
                    <div className="init-card__hp-bar-bg">
                        <div
                            className="init-card__hp-bar-fill"
                            style={{ width: `${hpBarPct}%`, background: hpColor }}
                        />
                    </div>
                    {isGM && editingHp ? (
                        <input
                            autoFocus
                            className="init-card__hp-input"
                            value={tempHp}
                            onChange={(e) => setTempHp(e.target.value)}
                            onBlur={commitHp}
                            onKeyDown={(e) => { if (e.key === 'Enter') commitHp(); if (e.key === 'Escape') setEditingHp(false); }}
                            onClick={(e) => e.stopPropagation()}
                        />
                    ) : (
                        <span className="init-card__hp-text">{hpText}</span>
                    )}
                </div>

                {/* Row 3: Stats */}
                <div className="init-card__stats-row">
                    <span className="init-card__stat" title="Armor Class">
                        <span className="init-card__stat-label">AC</span> {ac}
                    </span>
                    <span className="init-card__stat" title="Fortitude">
                        <span className="init-card__stat-label">Fort</span> {formatBonus(fort)}
                    </span>
                    <span className="init-card__stat" title="Reflex">
                        <span className="init-card__stat-label">Ref</span> {formatBonus(ref_)}
                    </span>
                    <span className="init-card__stat" title="Will">
                        <span className="init-card__stat-label">Will</span> {formatBonus(will)}
                    </span>
                </div>

                {/* Row 4: Conditions */}
                {combatant.conditions?.length > 0 && (
                    <div className="init-card__conditions">
                        {combatant.conditions.map((c, i) => (
                            <span key={i} className="init-card__condition-pill">{c}</span>
                        ))}
                    </div>
                )}
            </div>
        </motion.div>
    );
});

export default InitiativeCard;
