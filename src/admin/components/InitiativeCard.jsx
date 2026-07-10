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
import { resolveEffectModifiersForSelectors } from '../../shared/rules/effectResolver';
import { isDefeatedCombatant } from '../../shared/encounter/turnOrder';
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
    onEffectRemove,
    creatureData,        // full creature stats from catalog (for creatures)
    characterData,       // character object from campaign (for players)
    combatantEffects = [],
    effectBadges = [],
    revealState,         // { hp: 'precise'|'estimate'|'hidden' } — only relevant for creatures on player screen
    falseData = {},
}, ref) {
    const [editingInit, setEditingInit] = useState(false);
    const [editingHp, setEditingHp] = useState(false);
    const [tempInit, setTempInit] = useState('');
    const [tempHp, setTempHp] = useState('');

    const instanceSuffix = combatant.instanceLabel > 1 ? ` #${combatant.instanceLabel}` : '';
    const isHidden = !combatant.visible;
    const isPlayer = combatant.type === 'player';
    const isDefeated = isDefeatedCombatant(combatant);
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

    const applyEffectTotal = (baseValue, selectors) => {
        const numericBase = Number(baseValue);
        if (!Number.isFinite(numericBase)) return baseValue;
        return numericBase + resolveEffectModifiersForSelectors(combatantEffects, selectors).total;
    };

    // Gather stat values
    let ac;
    if (isPlayer && characterData) {
        try { ac = getArmorClassData(characterData).totalAC; } catch { ac = '?'; }
    } else {
        ac = applyEffectTotal(creatureData?.system?.attributes?.ac?.value ?? creatureData?.ac ?? '?', ['ac', 'all.dcs']);
    }

    const computePlayerSave = (saveKey) => {
        if (!characterData?.stats?.saves) return '?';
        const profRank = characterData.stats.saves[saveKey] ?? 0;
        try { return calculateStat(characterData, saveKey.charAt(0).toUpperCase() + saveKey.slice(1), profRank).total; }
        catch { return profRank || '?'; }
    };

    const fort = isPlayer
        ? computePlayerSave('fortitude')
        : applyEffectTotal(creatureData?.system?.saves?.fortitude?.value ?? creatureData?.saves?.fortitude ?? '?', ['save.fortitude', 'all.checks']);
    const ref_ = isPlayer
        ? computePlayerSave('reflex')
        : applyEffectTotal(creatureData?.system?.saves?.reflex?.value ?? creatureData?.saves?.reflex ?? '?', ['save.reflex', 'all.checks']);
    const will = isPlayer
        ? computePlayerSave('will')
        : applyEffectTotal(creatureData?.system?.saves?.will?.value ?? creatureData?.saves?.will ?? '?', ['save.will', 'all.checks']);
    const saveReveal = (isGM || isPlayer) ? 'precise' : (revealState?.saves || 'hidden');
    const saveEntries = [
        { key: 'fortitude', label: 'Fort', value: fort },
        { key: 'reflex', label: 'Ref', value: ref_ },
        { key: 'will', label: 'Will', value: will },
    ].map((entry) => ({ ...entry, display: getSaveDisplay(entry.key, entry.value, saveReveal, falseData) }))
        .filter((entry) => entry.display !== null);

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

    const conditionBadges = [
        ...(Array.isArray(combatant.conditions) ? combatant.conditions.map((label, index) => ({
            id: `legacy-${index}`,
            label,
            category: 'legacy',
        })) : []),
        ...effectBadges,
    ];

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
                isDefeated && 'init-card--defeated',
                isPlayer ? 'init-card--player' : 'init-card--creature',
            ].filter(Boolean).join(' ')}
            data-testid={`initiative-card-${combatant.id}`}
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
            <div className="init-card__badge" data-testid={`initiative-badge-${combatant.id}`} onClick={handleInitiativeClick}>
                {editingInit ? (
                    <input
                        autoFocus
                        className="init-card__badge-input"
                        data-testid={`initiative-input-${combatant.id}`}
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
                    {isDefeated && <span className="init-card__defeated-label">Defeated</span>}
                    {isHidden && isGM && <span className="init-card__hidden-icon" title="Hidden from players">👁️‍🗨️</span>}
                </div>

                {/* Row 2: HP bar */}
                <div className="init-card__hp-row" data-testid={`initiative-hp-${combatant.id}`} onClick={isGM ? handleHpClick : undefined}>
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
                            data-testid={`initiative-hp-input-${combatant.id}`}
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
                    {saveEntries.map((entry) => (
                        <span className="init-card__stat" title={entry.key} key={entry.key}>
                            <span className="init-card__stat-label">{entry.label}</span> {entry.display}
                        </span>
                    ))}
                </div>

                {/* Row 4: Conditions */}
                {conditionBadges.length > 0 && (
                    <div className="init-card__conditions">
                        {conditionBadges.map((badge) => {
                            const badgeSlug = toBadgeSlug(badge.label || badge.id);
                            const canRemove = isGM && badge.category !== 'legacy' && badge.id && onEffectRemove;
                            return (
                                <span
                                    key={badge.id || badge.label}
                                    data-testid={`initiative-condition-${combatant.id}-${badgeSlug}`}
                                    className={[
                                        'init-card__condition-pill',
                                        canRemove && 'init-card__condition-pill--closable',
                                        badge.category === 'damage_effect' && 'init-card__condition-pill--damage',
                                        badge.category === 'custom' && 'init-card__condition-pill--custom',
                                    ].filter(Boolean).join(' ')}
                                >
                                    <span className="init-card__condition-label">{badge.label}</span>
                                    {canRemove && (
                                        <button
                                            type="button"
                                            className="init-card__condition-remove"
                                            data-testid={`initiative-remove-condition-${combatant.id}-${badgeSlug}`}
                                            aria-label={`Remove ${badge.label}`}
                                            title={`Remove ${badge.label}`}
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                onEffectRemove(badge.id);
                                            }}
                                        >
                                            x
                                        </button>
                                    )}
                                </span>
                            );
                        })}
                    </div>
                )}
            </div>
        </motion.div>
    );
});

export default InitiativeCard;

function toBadgeSlug(value) {
    return String(value || 'effect')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'effect';
}

function getSaveDisplay(saveKey, value, reveal, falseData) {
    if (reveal === 'precise') return formatBonusValue(value);
    if (reveal === 'false') {
        const configuredValue = falseData?.saves?.[saveKey];
        return configuredValue ? `(${configuredValue})` : '?';
    }
    return null;
}

function formatBonusValue(value) {
    const numericValue = Number.parseInt(value, 10);
    if (Number.isNaN(numericValue)) return '?';
    return numericValue >= 0 ? `+${numericValue}` : `${numericValue}`;
}
