/**
 * CreatureCard - Displays a monster/hazard stat block
 * Supports reveal mechanics for progressive information disclosure
 */
import React, { useState, useMemo } from 'react';
import './CreatureCard.css';
import {
    getRecallKnowledgeDC,
    getHPRating,
    getSkillRating,
    getAbilityModRating,
    getPerceptionRating,
    getACRating,
    getSaveRanking,
    calculateMAP,
    getActionIcon,
    getAbilitySortPriority,
    formatSize,
    getRatingColor,
    getRarityColor,
} from '../../utils/bestiaryUtils';
import { parseFoundry, ACTION_ICONS } from '../utils/foundryParser';
import { buildCreatureSkillViewModel, normalizeCreatureRevealState } from '../bestiary/creaturePresentation';
import { buildCreatureSpellcastingModel } from '../bestiary/creatureSpellcasting';

export default function CreatureCard({
    creature,
    isGM = false,
    revealState = {},
    falseData = {},
    onRevealChange,
    onAbilityClick,
    onSkillClick,
    onSpellClick,
    viewerMode
}) {
    const [contextMenu, setContextMenu] = useState(null);
    const gmView = viewerMode ? viewerMode === 'gm' : isGM;

    // Merge default reveal state with provided
    const reveal = normalizeCreatureRevealState(revealState);

    const data = creature?.data || creature;
    const isHazard = creature?.type === 'hazard' || data?.type === 'hazard';

    // Extract creature data
    const name = data?.name || 'Unknown Creature';
    const level = data?.system?.details?.level?.value ?? data?.details?.level?.value ?? 0;
    const rarity = data?.system?.traits?.rarity || data?.traits?.rarity || 'common';
    const size = data?.system?.traits?.size?.value || data?.traits?.size?.value || 'med';
    const traits = data?.system?.traits?.value || data?.traits?.value || [];

    // Combat stats
    const ac = data?.system?.attributes?.ac?.value ?? data?.attributes?.ac?.value ?? 10;
    const hp = data?.system?.attributes?.hp?.max ?? data?.attributes?.hp?.max ?? 0;
    const hpDetails = data?.system?.attributes?.hp?.details ?? data?.attributes?.hp?.details ?? '';
    const speed = data?.system?.attributes?.speed ?? data?.attributes?.speed ?? { value: 25 };

    // Saves
    const saves = {
        fortitude: data?.system?.saves?.fortitude?.value ?? 0,
        reflex: data?.system?.saves?.reflex?.value ?? 0,
        will: data?.system?.saves?.will?.value ?? 0
    };
    const saveRankings = getSaveRanking(saves);

    // Defenses
    const immunities = data?.system?.attributes?.immunities ?? data?.attributes?.immunities ?? [];
    const resistances = data?.system?.attributes?.resistances ?? data?.attributes?.resistances ?? [];
    const weaknesses = data?.system?.attributes?.weaknesses ?? data?.attributes?.weaknesses ?? [];

    // Perception & senses
    const perception = data?.system?.perception?.mod ?? data?.perception?.mod ?? 0;
    const senses = data?.system?.perception?.senses ?? data?.perception?.senses ?? [];

    // Skills
    const skills = data?.system?.skills ?? data?.skills ?? {};

    // Attributes
    const abilities = data?.system?.abilities ?? data?.abilities ?? {};

    // Items (attacks, actions, abilities)
    const items = useMemo(() => {
        const rawItems = data?.items || [];
        return [...rawItems].sort((a, b) => getAbilitySortPriority(a) - getAbilitySortPriority(b));
    }, [data?.items]);
    const spellcastingEntries = useMemo(() => buildCreatureSpellcastingModel(data?.items || []), [data?.items]);

    // Hazard-specific
    const stealth = data?.system?.attributes?.stealth ?? data?.attributes?.stealth;
    const description = data?.system?.details?.description ?? '';
    const disable = data?.system?.details?.disable ?? '';
    const routine = data?.system?.details?.routine ?? '';
    const reset = data?.system?.details?.reset ?? '';
    const isComplex = data?.system?.details?.isComplex ?? false;

    // DC calculations (GM only)
    const dcs = getRecallKnowledgeDC(level, rarity);

    // Helpers
    const formatBonus = (val) => val >= 0 ? `+${val}` : `${val}`;

    // Context menu handlers
    const handleContextMenu = (e, field) => {
        if (!gmView || !onRevealChange) return;
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY, field });
    };

    const handleReveal = (mode) => {
        if (contextMenu && onRevealChange) {
            onRevealChange(contextMenu.field, mode);
        }
        setContextMenu(null);
    };

    // Render helpers
    const renderRedacted = (className = '') => (
        <span className={`redacted-block ${className}`}>████████</span>
    );

    const renderField = (field, preciseContent, estimateContent, falseContent) => {
        const state = reveal[field];
        if (gmView || state === 'precise') return preciseContent;
        if (state === 'estimate') return estimateContent || preciseContent;
        if (state === 'false') return falseContent || estimateContent || preciseContent;
        return renderRedacted();
    };

    // Render trait pills
    const renderTraits = () => {
        const allTraits = [
            { label: rarity.charAt(0).toUpperCase() + rarity.slice(1), color: getRarityColor(rarity), isRarity: true },
            { label: formatSize(size), color: '#666' },
            ...traits.map(t => ({ label: t.charAt(0).toUpperCase() + t.slice(1).replace(/-/g, ' '), color: '#555' }))
        ];

        return (
            <div className="creature-traits">
                {allTraits.map((trait, i) => (
                    <span
                        key={i}
                        className="trait-pill"
                        style={{ backgroundColor: trait.color }}
                    >
                        {trait.label}
                    </span>
                ))}
            </div>
        );
    };

    // Render saves with ranking
    const renderSaves = () => {
        if (!gmView && reveal.saves === 'hidden') return renderRedacted();

        // Use false rankings when reveal.saves === 'false'
        const displayRankings = reveal.saves === 'false' && falseData?.saves
            ? falseData.saves
            : saveRankings;

        return (
            <span>
                Fort {gmView || reveal.saves === 'precise' ? formatBonus(saves.fortitude) : ''}
                {(gmView || reveal.saves !== 'hidden') && <span className="save-ranking">({displayRankings.fortitude})</span>},
                Ref {gmView || reveal.saves === 'precise' ? formatBonus(saves.reflex) : ''}
                {(gmView || reveal.saves !== 'hidden') && <span className="save-ranking">({displayRankings.reflex})</span>},
                Will {gmView || reveal.saves === 'precise' ? formatBonus(saves.will) : ''}
                {(gmView || reveal.saves !== 'hidden') && <span className="save-ranking">({displayRankings.will})</span>}
            </span>
        );
    };

    // Render attacks
    const renderAttack = (item) => {
        const bonus = item.system?.bonus?.value ?? 0;
        const damageRolls = item.system?.damageRolls || {};
        const attackEffects = item.system?.attackEffects?.value || [];
        const attackTraits = item.system?.traits?.value || [];

        // Check for range - if it has range.increment, it's a ranged attack regardless of type
        const rangeIncrement = item.system?.range?.increment;
        const isRanged = rangeIncrement != null && rangeIncrement > 0;

        const damageStr = Object.values(damageRolls)
            .map(d => {
                const isPersistent = d.category === 'persistent';
                return `${d.damage} ${isPersistent ? 'persistent ' : ''}${d.damageType}`;
            })
            .join(' plus ');

        const mapStr = calculateMAP(bonus, attackTraits);
        const icon = getActionIcon(item);

        if (!gmView && reveal.attacks === 'hidden') return null;

        const showPrecise = gmView || reveal.attacks === 'precise';

        return (
            <div key={item._id} className="creature-attack">
                <span className="action-icon">{icon}</span>
                <strong>{isRanged ? 'Ranged' : 'Melee'}</strong>
                {' '}
                <span className="attack-name">{item.name}</span>
                {showPrecise && (
                    <>
                        {' '}{formatBonus(bonus)}
                        {isRanged && <span className="range"> ({rangeIncrement} ft.)</span>}
                        {' '}<span className="map">{mapStr}</span>
                        {attackTraits.length > 0 && (
                            <span className="attack-traits"> ({attackTraits.join(', ')})</span>
                        )}
                        <span className="damage">, Damage {damageStr}</span>
                    </>
                )}
                {attackEffects.length > 0 && (
                    <span className="attack-effects"> plus {attackEffects.join(', ')}</span>
                )}
            </div>
        );
    };

    // Render abilities
    const renderAbility = (item) => {
        if (['melee', 'ranged', 'spell', 'spellcastingEntry'].includes(item.type)) return null;
        if (!gmView && reveal.abilities === 'hidden') return null;

        const icon = getActionIcon(item);
        const actionType = item.system?.actionType?.value;

        return (
            <div
                key={item._id}
                className="creature-ability"
                onClick={() => onAbilityClick?.(item)}
                style={{ cursor: onAbilityClick ? 'pointer' : 'default' }}
            >
                <span className="action-icon">{icon}</span>
                <strong>{item.name}</strong>
                {item.system?.traits?.value?.length > 0 && (
                    <span className="ability-traits"> ({item.system.traits.value.join(', ')})</span>
                )}
            </div>
        );
    };

    const renderSpellcasting = () => {
        if (!spellcastingEntries.length || (!gmView && reveal.abilities === 'hidden')) return null;
        return spellcastingEntries.map(entry => {
            const spellsByRank = entry.spells.reduce((groups, spell) => {
                const rank = spell.rank ?? 0;
                groups[rank] = [...(groups[rank] || []), spell];
                return groups;
            }, {});
            return (
                <div key={entry.id} className="creature-spellcasting">
                    <div>
                        <strong>{entry.name}</strong>
                        {' '}DC {entry.dc}, attack {formatBonus(entry.attack)}
                        <span className="ability-traits"> ({entry.mode}, {entry.tradition})</span>
                    </div>
                    {Object.entries(spellsByRank)
                        .sort(([left], [right]) => Number(right) - Number(left))
                        .map(([rank, spells]) => (
                            <div key={rank} className="creature-spell-rank">
                                <strong>{Number(rank) === 0 ? 'Cantrips' : `Rank ${rank}`}</strong>{' '}
                                {spells.map((spell, index) => (
                                    <React.Fragment key={spell.id}>
                                        {index > 0 ? ', ' : ''}
                                        <button
                                            type="button"
                                            className="creature-spell-link"
                                            onClick={() => onSpellClick?.(spell.snapshot || spell)}
                                            disabled={!onSpellClick}
                                        >
                                            {spell.name}
                                            {entry.mode === 'prepared' && spell.preparedCount > 1 ? ` ×${spell.preparedCount}` : ''}
                                            {entry.mode === 'innate' && spell.atWill ? ' (at will)' : ''}
                                            {entry.mode === 'innate' && !spell.atWill && spell.usesPerDay ? ` (${spell.usesPerDay}/day)` : ''}
                                        </button>
                                    </React.Fragment>
                                ))}
                            </div>
                        ))}
                </div>
            );
        });
    };

    // Render speed
    const renderSpeed = () => {
        if (!gmView && reveal.speed === 'hidden') return renderRedacted();

        const baseSpeed = speed.value || 25;
        const otherSpeeds = speed.otherSpeeds || [];
        const details = speed.details || '';

        const speedParts = [`${baseSpeed} feet`];
        otherSpeeds.forEach(s => {
            speedParts.push(`${s.type} ${s.value} feet`);
        });
        if (details) speedParts.push(details);

        return speedParts.join(', ');
    };

    // Render skills
    const renderSkills = () => {
        if (!gmView && reveal.skills === 'hidden') return renderRedacted();

        const skillEntries = Object.entries(skills);
        if (skillEntries.length === 0) return <span className="muted">—</span>;

        const showPrecise = gmView || reveal.skills === 'precise';

        return skillEntries.map(([skillName, skillData], i) => {
            const bonus = skillData.base || skillData.value || 0;
            const rating = getSkillRating(bonus, level);
            const specials = skillData.special || [];

            const skillViewModel = buildCreatureSkillViewModel(skillName, skillData, { creatureName: name, creatureLevel: level });
            const label = skillViewModel.label;
            const clickable = typeof onSkillClick === 'function';
            const handleSkillClick = (e) => {
                if (!clickable) return;
                e.stopPropagation();
                onSkillClick(skillViewModel);
            };
            const handleSkillKeyDown = (e) => {
                if (e.key === 'Enter' || e.key === ' ') handleSkillClick(e);
            };

            return (
                <span key={skillName}>
                    {i > 0 && ', '}
                    {showPrecise ? (
                        <>
                            <span
                                className="skill-name"
                                onClick={handleSkillClick}
                                onKeyDown={handleSkillKeyDown}
                                role={clickable ? 'button' : undefined}
                                tabIndex={clickable ? 0 : undefined}
                                style={{ cursor: clickable ? 'pointer' : 'default', textDecoration: clickable ? 'underline' : 'none' }}
                            >{label}</span>
                            {' '}{formatBonus(bonus)}
                            {specials.map((s, j) => (
                                <span key={j} className="skill-special"> ({formatBonus(s.base)} {s.label})</span>
                            ))}
                        </>
                    ) : (
                        <>
                            <span
                                className="skill-name"
                                onClick={handleSkillClick}
                                onKeyDown={handleSkillKeyDown}
                                role={clickable ? 'button' : undefined}
                                tabIndex={clickable ? 0 : undefined}
                                style={{ cursor: clickable ? 'pointer' : 'default', textDecoration: clickable ? 'underline' : 'none' }}
                            >{label}</span>
                            {' '}<span style={{ color: getRatingColor(rating) }}>({rating})</span>
                        </>
                    )}
                </span>
            );
        });
    };

    // Render attributes
    const renderAttributes = () => {
        if (!gmView && reveal.attributes === 'hidden') return renderRedacted();

        const attrs = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
        const showPrecise = gmView || reveal.attributes === 'precise';

        return attrs.map((attr, i) => {
            const mod = abilities[attr]?.mod ?? 0;
            const rating = getAbilityModRating(mod, level);

            return (
                <span key={attr}>
                    {i > 0 && ', '}
                    <strong>{attr.charAt(0).toUpperCase() + attr.slice(1)}</strong>
                    {' '}
                    {showPrecise ? formatBonus(mod) : <span style={{ color: getRatingColor(rating) }}>({rating})</span>}
                </span>
            );
        });
    };

    return (
        <div className={`creature-card ${isHazard ? 'hazard' : 'creature'}`}>
            {/* Header */}
            <div
                className="creature-header"
                onContextMenu={(e) => handleContextMenu(e, 'name')}
            >
                <h3 className="creature-name">
                    {gmView || reveal.name !== 'hidden' ? name : renderRedacted('name-redacted')}
                </h3>
                <span
                    className="creature-level"
                    onContextMenu={(e) => { e.stopPropagation(); handleContextMenu(e, 'level'); }}
                >
                    {isHazard ? 'Hazard' : 'Creature'} {gmView || reveal.level !== 'hidden' ? level : '?'}
                </span>
            </div>

            {/* Traits */}
            <div onContextMenu={(e) => handleContextMenu(e, 'traits')}>
                {gmView || reveal.traits !== 'hidden' ? renderTraits() : renderRedacted()}
            </div>

            {/* Hazard-specific: Stealth & Description */}
            {isHazard && stealth && (
                <div className="creature-section">
                    <strong>Stealth</strong> {formatBonus(stealth.value)} {stealth.details && `(${stealth.details})`}
                </div>
            )}
            {isHazard && description && (
                <div className="creature-section hazard-description">
                    <strong>Description</strong> {description}
                </div>
            )}
            {isHazard && disable && (
                <div className="creature-section">
                    <strong>Disable</strong> <span dangerouslySetInnerHTML={{ __html: parseFoundry(disable) }} />
                </div>
            )}

            <div className="creature-divider" />

            {/* Combat Stats */}
            <div className="creature-section combat-stats">
                <div onContextMenu={(e) => handleContextMenu(e, 'ac')}>
                    <strong>AC</strong>{' '}
                    {gmView || reveal.ac === 'precise' ? (
                        ac
                    ) : reveal.ac === 'estimate' || reveal.ac === 'false' ? (
                        <span style={{ color: getRatingColor(reveal.ac === 'false' ? falseData.ac : getACRating(ac, level)) }}>
                            ({reveal.ac === 'false' ? falseData.ac : getACRating(ac, level)})
                        </span>
                    ) : reveal.ac !== 'hidden' ? (
                        ac
                    ) : renderRedacted()}
                    {'; '}
                    <span onContextMenu={(e) => { e.stopPropagation(); handleContextMenu(e, 'saves'); }}>
                        {renderSaves()}
                    </span>
                </div>
                <div onContextMenu={(e) => handleContextMenu(e, 'hp')}>
                    <strong>HP</strong> {' '}
                    {gmView || reveal.hp === 'precise' ? (
                        <>{hp} {hpDetails && `(${hpDetails})`}</>
                    ) : reveal.hp === 'estimate' || reveal.hp === 'false' ? (
                        <span style={{ color: getRatingColor(reveal.hp === 'false' ? falseData.hp : getHPRating(hp, level)) }}>
                            ({reveal.hp === 'false' ? falseData.hp : getHPRating(hp, level)})
                        </span>
                    ) : renderRedacted()}
                </div>
            </div>

            {/* Immunities/Resistances/Weaknesses */}
            {(immunities.length > 0 || resistances.length > 0 || weaknesses.length > 0) && (
                <div className="creature-section defenses">
                    {immunities.length > 0 && (
                        <div onContextMenu={(e) => handleContextMenu(e, 'immunities')}>
                            <strong>Immunities</strong> {' '}
                            {gmView || reveal.immunities !== 'hidden'
                                ? immunities.map(i => i.type).join(', ')
                                : renderRedacted()}
                        </div>
                    )}
                    {resistances.length > 0 && (
                        <div onContextMenu={(e) => handleContextMenu(e, 'resistances')}>
                            <strong>Resistances</strong> {' '}
                            {gmView || reveal.resistances !== 'hidden'
                                ? resistances.map(r => `${r.type}${reveal.resistances === 'precise' || gmView ? ` ${r.value}` : ''}`).join(', ')
                                : renderRedacted()}
                        </div>
                    )}
                    {(weaknesses.length > 0 || (reveal.weaknesses === 'false' && falseData?.weaknesses?.length > 0)) && (
                        <div onContextMenu={(e) => handleContextMenu(e, 'weaknesses')}>
                            <strong>Weaknesses</strong> {' '}
                            {gmView ? (
                                weaknesses.map(w => `${w.type} ${w.value}`).join(', ')
                            ) : reveal.weaknesses === 'hidden' ? (
                                renderRedacted()
                            ) : reveal.weaknesses === 'false' && falseData?.weaknesses ? (
                                falseData.weaknesses.map(w => `${w.type}${reveal.weaknesses === 'precise' ? ` ${w.value}` : ''}`).join(', ')
                            ) : (
                                weaknesses.map(w => `${w.type}${reveal.weaknesses === 'precise' ? ` ${w.value}` : ''}`).join(', ')
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Speed */}
            <div className="creature-section" onContextMenu={(e) => handleContextMenu(e, 'speed')}>
                <strong>Speed</strong> {renderSpeed()}
            </div>

            <div className="creature-divider" />

            {/* Attacks */}
            <div className="creature-section attacks" onContextMenu={(e) => handleContextMenu(e, 'attacks')}>
                {items.filter(i => i.type === 'melee' || i.type === 'ranged').map(renderAttack)}
            </div>

            {/* Abilities */}
            <div className="creature-section abilities" onContextMenu={(e) => handleContextMenu(e, 'abilities')}>
                {items.filter(i => i.type !== 'melee' && i.type !== 'ranged').map(renderAbility)}
                {renderSpellcasting()}
            </div>

            {/* Hazard routine/reset */}
            {isHazard && routine && (
                <>
                    <div className="creature-divider" />
                    <div className="creature-section">
                        <strong>Routine</strong> <span dangerouslySetInnerHTML={{ __html: parseFoundry(routine) }} />
                    </div>
                </>
            )}
            {isHazard && reset && (
                <div className="creature-section">
                    <strong>Reset</strong> {reset}
                </div>
            )}

            <div className="creature-divider" />

            {/* Perception, Skills, Attributes */}
            <div className="creature-section info">
                <div onContextMenu={(e) => handleContextMenu(e, 'perception')}>
                    <strong>Perception</strong>{' '}
                    {gmView || reveal.perception === 'precise' ? (
                        <>
                            {formatBonus(perception)}
                            {senses.length > 0 && (
                                <>; {senses.map(s => {
                                    if (typeof s === 'string') return s;
                                    let label = s.type.replace(/-/g, ' ');
                                    if (s.acuity) label = `${s.acuity} ${label}`;
                                    if (s.range) label += ` ${s.range} feet`;
                                    return label;
                                }).join(', ')}</>
                            )}
                        </>
                    ) : reveal.perception === 'estimate' || reveal.perception === 'false' ? (
                        <>
                            <span style={{ color: getRatingColor(reveal.perception === 'false' ? falseData.perception : getPerceptionRating(perception, level)) }}>
                                ({reveal.perception === 'false' ? falseData.perception : getPerceptionRating(perception, level)})
                            </span>
                            {senses.length > 0 && (gmView || reveal.senses !== 'hidden') && (
                                <>; {senses.map(s => {
                                    if (typeof s === 'string') return s;
                                    let label = s.type.replace(/-/g, ' ');
                                    if (s.acuity) label = `${s.acuity} ${label}`;
                                    if (s.range) label += ` ${s.range} feet`;
                                    return label;
                                }).join(', ')}</>
                            )}
                        </>
                    ) : renderRedacted()}
                </div>
                <div onContextMenu={(e) => handleContextMenu(e, 'skills')}>
                    <strong>Skills</strong> {renderSkills()}
                </div>
                <div onContextMenu={(e) => handleContextMenu(e, 'attributes')}>
                    {renderAttributes()}
                </div>
            </div>

            {/* GM Only section */}
            {gmView && (
                <>
                    <div className="creature-divider gm-divider" />
                    <div className="creature-section gm-only">
                        <div className="gm-label">GM Only</div>
                        <div>
                            <strong>Recall Knowledge</strong> DC {dcs.base}
                        </div>
                        <div className="dc-variants">
                            Unspecific Lore DC {dcs.unspecific} · Specific Lore DC {dcs.specific}
                        </div>
                    </div>
                </>
            )}

            {/* Context Menu */}
            {contextMenu && (
                <>
                    <div
                        className="context-menu-overlay"
                        onClick={() => setContextMenu(null)}
                    />
                    <div
                        className="creature-context-menu"
                        style={{ left: contextMenu.x, top: contextMenu.y }}
                    >
                        <div className="context-menu-title">Reveal: {contextMenu.field}</div>
                        <button onClick={() => handleReveal('precise')}>Reveal Precise</button>
                        <button onClick={() => handleReveal('estimate')}>Reveal Estimate</button>
                        <button onClick={() => handleReveal('false')}>Reveal False</button>
                        <button onClick={() => handleReveal('hidden')}>Hide</button>
                    </div>
                </>
            )}
        </div>
    );
}
