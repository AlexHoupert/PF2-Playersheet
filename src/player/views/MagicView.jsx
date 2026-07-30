import { useState } from 'react';
import { calculateSpellAttackAndDC } from '../../utils/rules';
import { parseFoundry, ACTION_ICONS } from '../../shared/utils/foundryParser';
import { getSpellIndexItemByName } from '../../shared/catalog/spellIndex';
import { LongPressable } from '../../shared/components/LongPressable';
import { getWandSpellCasts, getWandSpellKey } from '../../shared/utils/wandUtils';
import PlayerCatalogActionBar from '../components/PlayerCatalogActionBar';
import PlayerCatalogEditMarker from '../components/PlayerCatalogEditMarker';

export const MagicView = ({
    character,
    characterActions,
    setModalData,
    setModalMode,
    setCatalogMode,
    onLongPress,
    readOnly = false,
    canAuthorCatalog = false,
    onAuthorCatalogEntry,
    canEditCatalogEntry,
    onEditCatalogEntry,
}) => {
    const [editMode, setEditMode] = useState(false);
    // Guard for missing magic data
    const magic = character.magic || { slots: {}, list: [] };

    // --- 1. SLOTS & STATS COLUMN (LEFT) ---
    const { attack: spellAttack, dc: spellDC } = calculateSpellAttackAndDC(character);
    const spellAttackHasPenalty = (spellAttack?.penalty || 0) < 0;
    const spellDCHasPenalty = (spellDC?.penalty || 0) < 0;
    const atkStr = (spellAttack.total >= 0 ? "+" : "") + spellAttack.total;

    const slotKeys = ['f', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];
    const slots = magic.slots || {};

    const toggleSpellSlot = (lvlKey, indexClicked, currentVal) => {
        if (readOnly) return;
        let newVal = currentVal;
        // Ensure strictly numeric comparison
        if (Number(indexClicked) === Number(currentVal)) newVal = Number(currentVal) - 1; // Toggle off top
        else newVal = Number(indexClicked); // Set to this level

        characterActions?.setMagicSlot(lvlKey + "_curr", newVal);
    };

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
                        onClick={(e) => { e.stopPropagation(); toggleSpellSlot(k, i, curr); }}
                    />
                );
            }
            return (
                <LongPressable
                    className="slot-box"
                    key={k}
                        onLongPress={() => { if (!readOnly) onLongPress({ level: k, max }, 'spell_slots'); }}
                    shouldPreventDefault={false}
                >
                    <div className="slot-title">{title}</div>
                    <div className="slot-checks">{checks}</div>
                </LongPressable>
            );
        }
        return null;
    });

    // --- 2. SPELLS LIST COLUMN (RIGHT) ---
    const spellsByLevel = {};
    const spellList = Array.isArray(magic.list) ? magic.list : [];
    const wandSpellCasts = getWandSpellCasts(character?.inventory);
    const wandCastsByKey = new Map(wandSpellCasts.map(group => [group.key, group]));
    const attachedWandKeys = new Set();

    spellList.forEach((s, actorRecordIndex) => {
        const spellFromIndex = getSpellIndexItemByName(s.name);
        const spellData = {
            ...(spellFromIndex || {}),
            ...s,
            _entityType: 'spell',
            _actorRecordIndex: actorRecordIndex,
        };
        const lvl = String(s.level ?? spellData.level ?? '1');
        const wandKey = getWandSpellKey({ ...spellData, level: lvl });
        const wandCasts = wandCastsByKey.get(wandKey);
        if (wandCasts) {
            spellData.wandCasts = wandCasts;
            attachedWandKeys.add(wandKey);
        }
        if (!spellsByLevel[lvl]) spellsByLevel[lvl] = [];
        spellsByLevel[lvl].push(spellData);
    });

    wandSpellCasts.forEach(group => {
        if (attachedWandKeys.has(group.key)) return;
        const spellFromIndex = getSpellIndexItemByName(group.spell.name);
        const spellData = {
            ...(spellFromIndex || {}),
            ...group.spell,
            level: group.level,
            _entityType: 'spell',
            _wandOnly: true,
            wandCasts: group
        };
        if (!spellsByLevel[group.level]) spellsByLevel[group.level] = [];
        spellsByLevel[group.level].push(spellData);
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
                    const wandCasts = spell.wandCasts || null;
                    const editable = canEditCatalogEntry?.('spell', spell) === true;
                    const openWandItem = (event) => {
                        if (event) event.stopPropagation();
                        if (!wandCasts?.openItem) return;
                        setModalData({ ...wandCasts.openItem, _entityType: 'item' });
                        setModalMode('catalog_detail');
                    };
                    const openSpell = () => {
                        if (editMode) {
                            if (editable) onEditCatalogEntry?.('spell', spell);
                            return;
                        }
                        if (spell._wandOnly && wandCasts?.openItem) {
                            openWandItem();
                            return;
                        }
                        setModalData(spell);
                        setModalMode('catalog_detail');
                    };

                    // Meta info
                    const rawTarget = spell.target || spell.area || "";
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
                        const t = String(rawTime).toLowerCase();
                        if (t === "1") timeIcon = ACTION_ICONS["[one-action]"];
                        else if (t === "2") timeIcon = ACTION_ICONS["[two-actions]"];
                        else if (t === "3") timeIcon = ACTION_ICONS["[three-actions]"];
                        else if (t.includes("reaction")) timeIcon = ACTION_ICONS["[reaction]"];
                        else if (t.includes("free")) timeIcon = ACTION_ICONS["[free-action]"];
                        else timeIcon = parseFoundry(rawTime);
                    }

                    const metaParts = [];
                    if (range) metaParts.push(<span key="range">{range}</span>);
                    if (defense) metaParts.push(<span key="def" style={{ color: '#aaa' }}>{defense}</span>);
                    if (timeIcon) metaParts.push(<span key="cast" dangerouslySetInnerHTML={{ __html: timeIcon }} style={{ display: 'flex', alignItems: 'center' }} />);

                    return (
                        <LongPressable
                            className="spell-row"
                            key={`${lvl}-${spell.name}-${spell._wandOnly ? 'wand' : 'spell'}`}
                            onLongPress={() => { if (!readOnly && !editMode) onLongPress(spell, 'spell'); }}
                            onClick={openSpell}
                        >
                            <div style={{ fontWeight: 'bold', color: '#ccc', display: 'flex', alignItems: 'center' }}>
                                {spell.name}
                                {editMode && editable ? <PlayerCatalogEditMarker label={spell.name} /> : null}
                                {isBloodline && <span className="bloodline-drop">🩸</span>}
                                {wandCasts && (
                                    <button
                                        type="button"
                                        onClick={openWandItem}
                                        title="Open wand"
                                        style={{
                                            marginLeft: 8,
                                            border: '1px solid #6e56a8',
                                            background: wandCasts.available > 0 ? '#2d2148' : '#333',
                                            color: wandCasts.available > 0 ? '#d4c4ff' : '#999',
                                            borderRadius: 4,
                                            padding: '1px 5px',
                                            fontSize: '0.7em',
                                            lineHeight: 1.4,
                                            cursor: 'pointer'
                                        }}
                                    >
                                        Wand {wandCasts.available}/{wandCasts.total}
                                    </button>
                                )}
                            </div>
                            <div className="spell-meta">
                                {metaParts.reduce((acc, curr, idx) => {
                                    if (idx > 0) acc.push(<span key={`sep-${idx}`} style={{ color: '#444' }}>•</span>);
                                    acc.push(curr);
                                    return acc;
                                }, [])}
                            </div>
                        </LongPressable>
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
                    <LongPressable
                        className="hex-box"
                        onClick={() => { setModalData({ type: 'dc' }); setModalMode('spell_stat_info'); }}
                        onLongPress={() => { if (!readOnly) onLongPress(null, 'spell_proficiency'); }}
                    >
                        <div className="hex-content">
                            <div className={`stat-val ${spellDCHasPenalty ? 'stat-penalty' : ''}`} style={{ fontSize: '1.4em', fontWeight: 'bold', color: '#c5a059', lineHeight: 1.1 }}>
                                {spellDC.total}
                                {spellDCHasPenalty && <span className="stat-penalty-inline">({spellDC.penalty})</span>}
                            </div>
                            <div className="stat-label" style={{ fontSize: '0.6em', textTransform: 'uppercase', color: '#888', marginTop: 2 }}>SPELL DC</div>
                        </div>
                    </LongPressable>
                    {/* Attack */}
                    <LongPressable
                        className="spell-attack-box"
                        onClick={() => { setModalData({ type: 'attack' }); setModalMode('spell_stat_info'); }}
                        onLongPress={() => { if (!readOnly) onLongPress(null, 'spell_proficiency'); }}
                    >
                        <div className={`stat-val ${spellAttackHasPenalty ? 'stat-penalty' : ''}`} style={{ fontSize: '1.4em', fontWeight: 'bold', color: '#c5a059', lineHeight: 1.1 }}>
                            {atkStr}
                            {spellAttackHasPenalty && <span className="stat-penalty-inline">({spellAttack.penalty})</span>}
                        </div>
                        <div className="stat-label" style={{ fontSize: '0.6em', textTransform: 'uppercase', color: '#888', marginTop: 2 }}>ATTACK</div>
                    </LongPressable>
                </div>
                <div style={{ borderBottom: '2px solid #5c4033', margin: '5px 0 15px 0', width: '100%' }}></div>
                {renderSlots()}
            </div>
            <div id="spellListColumn">
                {renderSpellList()}
                {!readOnly ? (
                    <PlayerCatalogActionBar
                        addLabel="Add Spell"
                        addTestId="magic-add-spell"
                        onAdd={() => setCatalogMode('spell')}
                        createLabel="Create Spell"
                        onCreate={canAuthorCatalog ? () => onAuthorCatalogEntry?.('spell') : undefined}
                        editLabel="Edit Spells"
                        editMode={editMode}
                        onEditModeChange={canAuthorCatalog ? setEditMode : undefined}
                    />
                ) : null}
            </div>
        </div>
    );
};
