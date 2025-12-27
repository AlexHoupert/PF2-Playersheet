import React from 'react';
import { ACTION_ICONS, formatText } from '../../shared/utils/rules';

export function ImpulsesView({ character, onOpenModal, onOpenCatalog, pressEvents }) {
    const impulses = character.impulses || [];

    // Stats Calculation
    const profRank = character.stats.impulse_proficiency || 0;
    const level = parseInt(character.level) || 1;
    const conMod = character.stats.attributes?.constitution ?? 0;

    const profBonus = profRank > 0 ? (level + profRank) : 0;
    const classDC = 10 + profBonus + conMod;
    const impulseAttack = profBonus + conMod;

    return (
        <div className="magic-container" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* 1. Header Stats (Centered) */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 30, paddingBottom: 10, borderBottom: '1px solid #333' }}>
                <div className="hex-box">
                    <div className="hex-content">
                        <div className="stat-val" style={{ fontSize: '1.4em', fontWeight: 'bold', color: '#c5a059', lineHeight: 1.1 }}>{classDC}</div>
                        <div className="stat-label" style={{ fontSize: '0.6em', textTransform: 'uppercase', color: '#888', marginTop: 2 }}>CLASS DC</div>
                    </div>
                </div>
                <div className="spell-attack-box" style={{
                    display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
                    padding: '8px 16px', border: '2px solid var(--text-gold)', borderRadius: '4px',
                    background: 'var(--bg-panel)', alignSelf: 'center'
                }}>
                    <div className="stat-val" style={{ fontSize: '1.4em', fontWeight: 'bold', color: '#c5a059', lineHeight: 1.1 }}>+{impulseAttack}</div>
                    <div className="stat-label" style={{ fontSize: '0.6em', textTransform: 'uppercase', color: '#888', marginTop: 2 }}>ATTACK</div>
                </div>
            </div>

            <div className="spells-list" style={{ width: '100%' }}>
                <div className="spell-level-header" style={{ textAlign: 'left', borderBottom: '2px solid #5c4033', paddingBottom: 5, marginBottom: 10, color: 'var(--text-gold)', fontFamily: 'Cinzel, serif', fontSize: '1.2em' }}>
                    Impulses
                </div>

                {impulses.length === 0 && <div style={{ textAlign: 'center', color: '#666', marginTop: 20 }}>No Impulses learned.</div>}

                {impulses.sort((a, b) => a.name.localeCompare(b.name)).map(imp => {
                    // Extract Meta Info (Time, Range, Target, Defense)
                    const rawTime = imp.time || imp.actions || imp.system?.actions?.value || "";
                    let timeIcon = "";
                    if (rawTime) {
                        const t = String(rawTime).toLowerCase();
                        if (t === "1" || t.includes("one")) timeIcon = ACTION_ICONS["[one-action]"];
                        else if (t === "2" || t.includes("two")) timeIcon = ACTION_ICONS["[two-actions]"];
                        else if (t === "3" || t.includes("three")) timeIcon = ACTION_ICONS["[three-actions]"];
                        else if (t.includes("reaction")) timeIcon = ACTION_ICONS["[reaction]"];
                        else if (t.includes("free")) timeIcon = ACTION_ICONS["[free-action]"];
                        else timeIcon = formatText(rawTime);
                    }

                    // Range / Target / Defense
                    let range = imp.range || imp.system?.range?.value || "";
                    if (range) range = range.replace(/feet/gi, "ft");

                    const target = imp.target || imp.area || imp.system?.target?.value || imp.system?.area?.value || "";

                    let defense = imp.defense || imp.system?.defense?.save?.statistic || "";
                    if (!defense && (imp.traits?.includes('attack') || imp.system?.traits?.value?.includes('attack'))) {
                        defense = "AC";
                    }

                    if (defense) {
                        const defMap = { fortitude: "Fort", reflex: "Ref", will: "Will", ac: "AC" };
                        defense = defMap[defense.toLowerCase()] || (defense.charAt(0).toUpperCase() + defense.slice(1));
                    }

                    const metaParts = [];
                    if (range) metaParts.push(<span key="range">{range}</span>);
                    if (target) metaParts.push(<span key="target">{target}</span>);
                    if (defense) metaParts.push(<span key="def" style={{ color: '#aaa' }}>{defense}</span>);
                    if (timeIcon) metaParts.push(<span key="cast" dangerouslySetInnerHTML={{ __html: timeIcon }} style={{ display: 'flex', alignItems: 'center' }} />);


                    return (
                        <div key={imp.name} className="spell-row"
                            onClick={() => onOpenModal('item', { ...imp, _entityType: 'impulse' })}
                            {...pressEvents?.(imp, 'impulse')}
                        >
                            <div style={{ fontWeight: 'bold', color: '#ccc', display: 'flex', alignItems: 'center' }}>
                                {imp.name}
                            </div>
                            <div className="spell-meta">
                                {metaParts.reduce((acc, curr, idx) => {
                                    if (idx > 0) acc.push(<span key={`sep-${idx}`} style={{ color: '#444' }}>•</span>);
                                    acc.push(curr);
                                    return acc;
                                }, [])}
                            </div>
                        </div>
                    );
                })}

                <div style={{ marginTop: 20, textAlign: 'center' }}>
                    <button className="add-item-btn" onClick={onOpenCatalog}>+ Add Impulse</button>
                </div>
            </div>
        </div>
    );
}
