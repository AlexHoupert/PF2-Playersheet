import React, { useState, useMemo } from 'react';
import { StatsView } from '../../player/views/StatsView';
import { InventoryView } from '../../player/views/InventoryView';
import { MagicView } from '../../player/views/MagicView';
import { FeatsView } from '../../player/views/FeatsView';
import { ImpulsesView } from '../../player/views/ImpulsesView';
import { ELEMENTS, BACKLASH_TIERS, BACKLASH_LABELS, BACKLASH_COLORS, applyBacklashEffects } from '../../pacts/pactsData';
import { selectDeviantAbility } from '../../shared/db/selectors/abilitySelectors';
import { selectPact, selectPactList } from '../../shared/db/selectors/pactSelectors';

export function CharacterCard({
    character,
    db,
    setDb,
    updateCharacter,
    setModalMode,
    setModalData,
    onOpenModalLong,
    onOpenModal
}) {
    const [activeTab, setActiveTab] = useState('stats');
    const [backlashOpen, setBacklashOpen] = useState(false);

    // Resolve the character's assigned pact from db
    const assignedPact = useMemo(() => {
        return selectPact(db, character.pact?.pactId);
    }, [character.pact?.pactId, db]);

    const hasPact = !!assignedPact;
    const el = assignedPact ? (ELEMENTS[assignedPact.element] || ELEMENTS.Fire) : null;

    // --- Handlers for InventoryView ---
    const handleToggleEquip = (item) => {
        updateCharacter(c => {
            const idx = c.inventory.findIndex(i =>
                (item.instanceId && i.instanceId === item.instanceId) ||
                (!item.instanceId && i.name === item.name && !!i.equipped === !!item.equipped)
            );
            if (idx > -1) {
                const isArmor = item.type?.toLowerCase() === 'armor' || (item.category === 'Armor');
                if (isArmor && !c.inventory[idx].equipped) {
                    c.inventory.forEach(i => {
                        if ((i.type?.toLowerCase() === 'armor' || i.category === 'Armor') && i.equipped) {
                            i.equipped = false;
                        }
                    });
                }
                c.inventory[idx].equipped = !c.inventory[idx].equipped;
            }
        });
    };

    const handleConsume = (item) => {
        updateCharacter(c => {
            const idx = c.inventory.findIndex(i => i.name === item.name && i.qty > 0);
            if (idx > -1) {
                c.inventory[idx].qty--;
                if (c.inventory[idx].qty <= 0) c.inventory.splice(idx, 1);
            }
        });
    };

    const handleOpenModal = (mode, data) => {
        if (onOpenModal) {
            onOpenModal(mode, data);
        } else {
            if (data !== undefined) setModalData(data);
            setModalMode(mode);
        }
    };

    const handleApplyBacklash = (tier) => {
        if (!assignedPact) return;
        const tierData = assignedPact.backlash?.[tier];
        if (!tierData?.effects?.length) {
            alert(`${BACKLASH_LABELS[tier]}: No condition effects defined for this tier.`);
            return;
        }
        updateCharacter(c => {
            applyBacklashEffects(c, tierData.effects, tier);
        });
        setBacklashOpen(false);
    };

    const isCaster = character.isCaster || (character.magic?.list?.length > 0);
    const isKineticist = character.isKineticist || (character.impulses?.length > 0);
    const allPacts = useMemo(() => selectPactList(db), [db]);
    const hasPactsInDb = allPacts.length > 0;

    return (
        <div className="char-card" style={{ position: 'relative' }}>
            <div className="char-header">
                <div>{character.name}</div>
                <div style={{ fontSize: '0.8em', color: '#888' }}>Level {character.level}</div>
            </div>

            <div className="card-tabs">
                <button className={activeTab === 'stats' ? 'active' : ''} onClick={() => setActiveTab('stats')}>Stats</button>
                <button className={activeTab === 'inv' ? 'active' : ''} onClick={() => setActiveTab('inv')}>Inv</button>
                {(isCaster || activeTab === 'spells') && <button className={activeTab === 'spells' ? 'active' : ''} onClick={() => setActiveTab('spells')}>Spells</button>}
                {(isKineticist || activeTab === 'impulses') && <button className={activeTab === 'impulses' ? 'active' : ''} onClick={() => setActiveTab('impulses')}>Impulses</button>}
                <button className={activeTab === 'feats' ? 'active' : ''} onClick={() => setActiveTab('feats')}>Feats</button>
                {hasPactsInDb && <button className={activeTab === 'pact' ? 'active' : ''} onClick={() => setActiveTab('pact')} style={{ color: hasPact ? (el?.color || '#aaa') : undefined }}>Pact</button>}
            </div>

            <div className="char-card-body">
                {activeTab === 'stats' && (
                    <>
                        {hasPact && (
                            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 6 }}>
                                <button
                                    onClick={() => setBacklashOpen(true)}
                                    style={{
                                        padding: '3px 10px', background: '#3a1a1a', border: '1px solid #e53935',
                                        color: '#ef9a9a', borderRadius: 4, cursor: 'pointer', fontSize: '0.78em',
                                        fontWeight: 'bold'
                                    }}
                                >
                                    + Add Backlash
                                </button>
                            </div>
                        )}
                        <StatsView
                            character={character}
                            updateCharacter={updateCharacter}
                            onOpenModal={handleOpenModal}
                            onLongPress={onOpenModalLong}
                        />
                    </>
                )}
                {activeTab === 'inv' && (
                    <InventoryView
                        character={character}
                        db={db}
                        onUpdateCharacter={updateCharacter}
                        onSetDb={setDb}
                        onOpenModal={handleOpenModal}
                        onToggleEquip={handleToggleEquip}
                        onInspectItem={(item) => handleOpenModal('item', item)}
                        onConsumeItem={handleConsume}
                        onFireWeapon={() => { }}
                        onLoadWeapon={() => { }}
                        onLongPress={onOpenModalLong}
                        onOpenShop={() => { }}
                    />
                )}
                {activeTab === 'spells' && (
                    <MagicView
                        character={character}
                        updateCharacter={updateCharacter}
                        setModalData={setModalData}
                        setModalMode={setModalMode}
                        setCatalogMode={(mode) => console.log("Catalog not impl in card yet", mode)}
                        onLongPress={onOpenModalLong}
                    />
                )}
                {activeTab === 'impulses' && (
                    <ImpulsesView
                        character={character}
                        setModalData={setModalData}
                        setModalMode={setModalMode}
                        onLongPress={onOpenModalLong}
                    />
                )}
                {activeTab === 'feats' && (
                    <FeatsView
                        character={character}
                        setModalData={setModalData}
                        setModalMode={setModalMode}
                        setCatalogMode={() => { }}
                        onLongPress={onOpenModalLong}
                    />
                )}
                {activeTab === 'pact' && (
                    <PactTab
                        character={character}
                        updateCharacter={updateCharacter}
                        db={db}
                        allPacts={allPacts}
                        assignedPact={assignedPact}
                    />
                )}
            </div>

            {/* Backlash Overlay */}
            {backlashOpen && hasPact && (
                <div style={{
                    position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.85)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    zIndex: 100, borderRadius: 6, padding: 20
                }}>
                    <div style={{ textAlign: 'center', marginBottom: 16 }}>
                        <div style={{ fontSize: '1.1em', fontWeight: 'bold', color: el.color, marginBottom: 4 }}>
                            {el.icon} {assignedPact.name}
                        </div>
                        <div style={{ fontSize: '0.8em', color: '#888' }}>Apply Backlash to {character.name}</div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%' }}>
                        {BACKLASH_TIERS.map(tier => {
                            const tierData = assignedPact.backlash?.[tier] || {};
                            const tierColor = BACKLASH_COLORS[tier];
                            const effects = tierData.effects || [];
                            return (
                                <button
                                    key={tier}
                                    onClick={() => handleApplyBacklash(tier)}
                                    style={{
                                        padding: '10px 14px', background: '#1a1a1d',
                                        border: `1px solid ${tierColor}`, borderRadius: 6,
                                        color: tierColor, cursor: 'pointer', textAlign: 'left'
                                    }}
                                >
                                    <div style={{ fontWeight: 'bold', marginBottom: 2 }}>{BACKLASH_LABELS[tier]}</div>
                                    {effects.length > 0 ? (
                                        <div style={{ fontSize: '0.75em', opacity: 0.8 }}>
                                            {effects.map((e, i) => (
                                                <span key={i}>{i > 0 ? ', ' : ''}{e.conditionName}{e.value ? ` ${e.value}` : ''}</span>
                                            ))}
                                        </div>
                                    ) : (
                                        <div style={{ fontSize: '0.75em', opacity: 0.5 }}>No conditions defined</div>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                    <button
                        onClick={() => setBacklashOpen(false)}
                        style={{ marginTop: 14, background: 'none', border: '1px solid #555', color: '#888', padding: '6px 20px', borderRadius: 4, cursor: 'pointer' }}
                    >
                        Cancel
                    </button>
                </div>
            )}
        </div>
    );
}

// --- Pact Tab ---
function PactTab({ character, updateCharacter, db, allPacts, assignedPact }) {
    const pactData = character.pact || {};
    const el = assignedPact ? (ELEMENTS[assignedPact.element] || ELEMENTS.Fire) : null;

    const setPactId = (pactId) => {
        updateCharacter(c => {
            c.pact = pactId ? { pactId, choices: {}, unlockedAwakenings: {} } : null;
        });
    };

    const setChoice = (groupIdx, abilityId) => {
        updateCharacter(c => {
            if (!c.pact) return;
            c.pact.choices = { ...(c.pact.choices || {}), [groupIdx]: abilityId };
        });
    };

    const toggleAwakening = (abilityId, level) => {
        updateCharacter(c => {
            if (!c.pact) return;
            const current = (c.pact.unlockedAwakenings || {})[abilityId];
            const next = current === level ? (level === 2 ? 1 : 0) : level;
            c.pact.unlockedAwakenings = { ...(c.pact.unlockedAwakenings || {}), [abilityId]: next || undefined };
            if (!next) delete c.pact.unlockedAwakenings[abilityId];
        });
    };

    const inputStyle = {
        width: '100%', padding: '6px 8px', background: '#111', border: '1px solid #444',
        color: '#fff', borderRadius: 4, fontSize: '0.85em', boxSizing: 'border-box'
    };

    return (
        <div style={{ padding: '4px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* Pact Selector */}
            <div>
                <div style={{ fontSize: '0.7em', color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Assigned Pact</div>
                <select
                    value={pactData.pactId || ''}
                    onChange={e => setPactId(e.target.value || null)}
                    style={inputStyle}
                >
                    <option value="">— None —</option>
                    {allPacts.map(p => {
                        const pel = ELEMENTS[p.element] || ELEMENTS.Fire;
                        return <option key={p.id} value={p.id}>{pel.icon} {p.name} ({p.element})</option>;
                    })}
                </select>
            </div>

            {assignedPact && (
                <>
                    <div style={{ background: el.bg, border: `1px solid ${el.dim}`, borderRadius: 6, padding: 10 }}>
                        <div style={{ color: el.color, fontWeight: 'bold', fontSize: '0.9em', marginBottom: 2 }}>
                            {el.icon} {assignedPact.name}
                        </div>
                        <div style={{ fontSize: '0.75em', color: '#888' }}>{assignedPact.element} Element</div>
                    </div>

                    {/* Ability Group Choices */}
                    {(assignedPact.abilityGroups || []).length > 0 && (
                        <div>
                            <div style={{ fontSize: '0.7em', color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Ability Choices</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {assignedPact.abilityGroups.map((group, gIdx) => {
                                    const chosenId = pactData.choices?.[gIdx];
                                    const abilities = (group.abilityIds || [])
                                        .map(id => selectDeviantAbility(db, id))
                                        .filter(Boolean);
                                    if (abilities.length === 0) return null;
                                    return (
                                        <div key={gIdx} style={{ background: '#1a1a1d', border: '1px solid #2a2a2a', borderRadius: 4, padding: 8 }}>
                                            <div style={{ fontSize: '0.7em', color: el.color, marginBottom: 6 }}>{group.label || `Group ${gIdx + 1}`}</div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                                {abilities.map(ab => {
                                                    const isChosen = chosenId === ab.id;
                                                    const unlockedLevel = pactData.unlockedAwakenings?.[ab.id] || 0;
                                                    return (
                                                        <div key={ab.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                            <button
                                                                onClick={() => setChoice(gIdx, isChosen ? null : ab.id)}
                                                                style={{
                                                                    flex: 1, padding: '5px 8px', textAlign: 'left',
                                                                    background: isChosen ? el.bg : '#111',
                                                                    border: `1px solid ${isChosen ? el.color : '#333'}`,
                                                                    color: isChosen ? el.color : '#aaa',
                                                                    borderRadius: 4, cursor: 'pointer', fontSize: '0.8em'
                                                                }}
                                                            >
                                                                {isChosen ? '✓ ' : ''}{ab.name} <span style={{ opacity: 0.5 }}>Lv{ab.level}</span>
                                                            </button>
                                                            {/* Awakening unlock buttons (only if chosen) */}
                                                            {isChosen && (
                                                                <>
                                                                    {[1, 2].map(awLevel => {
                                                                        const awKey = `awakening${awLevel}`;
                                                                        const hasAw = ab[awKey]?.name;
                                                                        if (!hasAw) return null;
                                                                        const unlocked = unlockedLevel >= awLevel;
                                                                        return (
                                                                            <button
                                                                                key={awLevel}
                                                                                onClick={() => toggleAwakening(ab.id, awLevel)}
                                                                                title={`${unlocked ? 'Revoke' : 'Unlock'} Awakening ${awLevel}: ${ab[awKey].name}`}
                                                                                style={{
                                                                                    padding: '4px 7px', fontSize: '0.7em', borderRadius: 3, cursor: 'pointer',
                                                                                    background: unlocked ? '#1a3a1a' : '#1a1a1d',
                                                                                    border: `1px solid ${unlocked ? '#4caf50' : '#444'}`,
                                                                                    color: unlocked ? '#81c784' : '#555'
                                                                                }}
                                                                            >
                                                                                Aw{awLevel}
                                                                            </button>
                                                                        );
                                                                    })}
                                                                </>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
