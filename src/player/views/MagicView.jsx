import React from 'react';
import { getSpellIndexItemByName } from '../../shared/catalog/spellIndex';
import { ACTION_ICONS, formatText } from '../../shared/utils/rules';

export function MagicView({ character, updateCharacter, onOpenModal, onOpenCatalog, pressEvents }) {
    // Guard for missing magic data
    const magic = character.magic || { slots: {}, list: [] };

    // --- 1. SLOTS & STATS COLUMN (LEFT) ---
    // Calc Attack & DC: 10 + Attr + Prof + Level
    const attrName = magic.attribute || "Intelligence";
    const attrMod = parseInt(character.stats.attributes[(attrName || "").toLowerCase()]) || 0;
    const prof = parseFloat(magic.proficiency) || 0;
    const level = parseInt(character.level) || 0;

    // Stats Fix: Only add level if proficiency > 0
    const atkBonus = Math.floor(attrMod + prof + (prof > 0 ? level : 0));
    const dcVal = 10 + atkBonus;
    const atkStr = (atkBonus >= 0 ? "+" : "") + atkBonus;

    const toggleSpellSlot = (lvlKey, indexClicked, currentVal) => {
        let newVal = currentVal;
        if (indexClicked === currentVal) newVal = currentVal - 1; // Toggle off top
        else newVal = indexClicked; // Set to this level

        updateCharacter(c => {
            if (!c.magic) c.magic = { slots: {} };
            if (!c.magic.slots) c.magic.slots = {};
            c.magic.slots[lvlKey + "_curr"] = newVal;
        });
    };

    const slotKeys = ['f', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];
    const slots = magic.slots || {};

    const renderSlots = () => slotKeys.map(k => {
        const max = slots[k + "_max"];
        const curr = slots[k + "_curr"] || 0;
        if (max > 0) {
            const title = (k === 'f') ? "Focus Points" : "Level " + k;
            const checks = [];
            for (let i = 1; i <= max; i++) {
                const isActive = i <= curr;
                checks.push(
                    <div
                        key={i}
                        className={`slot-check ${isActive ? 'active' : ''}`}
                        onClick={() => toggleSpellSlot(k, i, curr)}
                    />
                );
            }
            return (
                <div className="slot-box" key={k} {...pressEvents?.({ level: k, max }, 'spell_slots')}>
                    <div className="slot-title">{title}</div>
                    <div className="slot-checks">{checks}</div>
                </div>
            );
        }
        return null;
    });


    // --- 2. SPELLS LIST COLUMN (RIGHT) ---
    const spellsByLevel = {};
    const spellList = Array.isArray(magic.list) ? magic.list : [];

    spellList.forEach(s => {
        const spellFromIndex = getSpellIndexItemByName(s.name);
        // Merge index data with character data (e.g. Bloodmagic prop)
        const spellData = { ...(spellFromIndex || {}), ...s, _entityType: 'spell' };
        const lvl = s.level;
        if (!spellsByLevel[lvl]) spellsByLevel[lvl] = [];
        spellsByLevel[lvl].push(spellData);
    });

    const sortedLevels = Object.keys(spellsByLevel).sort((a, b) => {
        if (a === 'Focus') return 1;
        if (b === 'Focus') return -1;
        return parseInt(a) - parseInt(b);
    });

    const renderSpellList = () => sortedLevels.map(lvl => {
        const label = lvl === '0' ? 'Cantrips' : lvl === 'Focus' ? 'Focus Spells' : `Rank ${lvl}`;
        return (
            <div key={lvl}>
                <div className="spell-list-header">{label}</div>
                {spellsByLevel[lvl].map(spell => {
                    const isBloodline = spell.Bloodmagic === true;

                    // Meta info
                    const rawTarget = spell.target || spell.area || "";
                    // Enhance with Index Data
                    const idxItem = getSpellIndexItemByName(spell.name);

                    // Defense
                    let defense = idxItem?.defense || "";
                    if (defense) {
                        const defMap = { fortitude: "Fort", reflex: "Ref", will: "Will", ac: "AC" };
                        defense = defMap[defense.toLowerCase()] || (defense.charAt(0).toUpperCase() + defense.slice(1));
                    }

                    // Range
                    let range = idxItem?.range || spell.range || "";
                    if (range) {
                        range = range.replace(/feet/gi, "ft");
                    }

                    // Time / Actions
                    const rawTime = idxItem?.time || spell.time || spell.cast || "";
                    let timeIcon = "";
                    if (rawTime) {
                        // Map simple values to icon keys
                        const t = String(rawTime).toLowerCase();
                        if (t === "1") timeIcon = ACTION_ICONS["[one-action]"];
                        else if (t === "2") timeIcon = ACTION_ICONS["[two-actions]"];
                        else if (t === "3") timeIcon = ACTION_ICONS["[three-actions]"];
                        else if (t.includes("reaction")) timeIcon = ACTION_ICONS["[reaction]"];
                        else if (t.includes("free")) timeIcon = ACTION_ICONS["[free-action]"];
                        else timeIcon = formatText(rawTime); // Fallback
                    }

                    const metaParts = [];
                    if (range) metaParts.push(<span key="range">{range}</span>);
                    if (defense) metaParts.push(<span key="def" style={{ color: '#aaa' }}>{defense}</span>);
                    if (timeIcon) metaParts.push(<span key="cast" dangerouslySetInnerHTML={{ __html: timeIcon }} style={{ display: 'flex', alignItems: 'center' }} />);

                    return (
                        <div className="spell-row" key={spell.name}
                            onClick={() => onOpenModal('item', spell)}
                            {...pressEvents?.(spell, 'spell')}
                        >
                            <div style={{ fontWeight: 'bold', color: '#ccc', display: 'flex', alignItems: 'center' }}>
                                {spell.name}
                                {isBloodline && <span className="bloodline-drop">🩸</span>}
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
            </div>
        );
    });

    return (
        <div className="magic-split">
            <div id="slotColumn">
                <div className="magic-stat-block">
                    {/* Spell DC Hex */}
                    <div className="hex-box"
                        onClick={() => onOpenModal('spell_stat_info', null)}
                        {...pressEvents?.(null, 'spell_proficiency')}
                    >
                        <div className="hex-content">
                            <div className="stat-val" style={{ fontSize: '1.4em', fontWeight: 'bold', color: '#c5a059', lineHeight: 1.1 }}>{dcVal}</div>
                            <div className="stat-label" style={{ fontSize: '0.6em', textTransform: 'uppercase', color: '#888', marginTop: 2 }}>SPELL DC</div>
                        </div>
                    </div>
                    {/* Attack */}
                    <div className="spell-attack-box"
                        onClick={() => onOpenModal('spell_stat_info', null)}
                        {...pressEvents?.(null, 'spell_proficiency')}
                    >
                        <div className="stat-val" style={{ fontSize: '1.4em', fontWeight: 'bold', color: '#c5a059', lineHeight: 1.1 }}>{atkStr}</div>
                        <div className="stat-label" style={{ fontSize: '0.6em', textTransform: 'uppercase', color: '#888', marginTop: 2 }}>ATTACK</div>
                    </div>
                </div>
                <div style={{ borderBottom: '2px solid #5c4033', margin: '5px 0 15px 0', width: '100%' }}></div>
                {renderSlots()}
            </div>
            <div id="spellListColumn">
                {renderSpellList()}
                <button
                    className="btn-add-condition"
                    style={{ marginTop: 20, width: '100%' }}
                    onClick={onOpenCatalog}
                >
                    + Add Spell
                </button>
            </div>
        </div>
    );
}
