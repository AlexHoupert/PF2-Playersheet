import React, { useMemo, useState } from 'react';
import { StatsView } from '../../player/views/StatsView';
import { InventoryView } from '../../player/views/InventoryView';
import { MagicView } from '../../player/views/MagicView';
import { FeatsView } from '../../player/views/FeatsView';
import { ImpulsesView } from '../../player/views/ImpulsesView';
import { ModalManager } from '../../player/ModalManager';
import { ELEMENTS, BACKLASH_TIERS, BACKLASH_LABELS, BACKLASH_COLORS, buildBacklashEffectInputs } from '../../pacts/pactsData';
import { useCampaign } from '../context/CampaignContext';
import { selectDeviantAbility } from '../db/selectors/abilitySelectors';
import { selectPact, selectPactList } from '../db/selectors/pactSelectors';
import { selectActorRulesViewModel } from '../rules/actorRulesViewModel';

const DEFAULT_CAPABILITIES = {
    editable: true,
    showInventory: true,
    showMagic: true,
    showPacts: true,
    allowShop: false,
    allowLoot: true,
    localModals: false,
};

export function ActorSheetCard({
    character,
    db,
    updateCharacter = () => {},
    characterActions,
    mode = 'gm',
    capabilities = {},
    setModalMode,
    setModalData,
    onOpenModalLong,
    onOpenModal,
}) {
    const { activeCampaign, activeCampaignId, dataActions } = useCampaign();
    const [activeTab, setActiveTab] = useState('stats');
    const [backlashOpen, setBacklashOpen] = useState(false);
    const [localModalMode, setLocalModalMode] = useState(null);
    const [localModalData, setLocalModalData] = useState(null);
    const resolvedCapabilities = { ...DEFAULT_CAPABILITIES, ...capabilities };

    const actorRules = useMemo(() => selectActorRulesViewModel(activeCampaign, character?.id), [activeCampaign, character?.id]);
    const rulesCharacter = actorRules.character || character;
    const conditions = actorRules.conditions || [];
    const assignedPact = useMemo(() => selectPact(db, character?.pact?.pactId), [character?.pact?.pactId, db]);
    const allPacts = useMemo(() => selectPactList(db), [db]);
    const hasPact = !!assignedPact;
    const el = assignedPact ? (ELEMENTS[assignedPact.element] || ELEMENTS.Fire) : null;
    const hasPactsInDb = allPacts.length > 0;
    const isCaster = character?.isCaster || (character?.magic?.list?.length > 0);
    const isKineticist = character?.isKineticist || (character?.impulses?.length > 0);

    const modalMode = setModalMode ? null : localModalMode;
    const modalData = setModalData ? null : localModalData;

    const handleOpenModal = (nextMode, data) => {
        if (onOpenModal) {
            onOpenModal(nextMode, data);
            return;
        }
        if (setModalMode && setModalData) {
            if (data !== undefined) setModalData(data);
            setModalMode(nextMode);
            return;
        }
        if (resolvedCapabilities.localModals) {
            setLocalModalData(data ?? null);
            setLocalModalMode(nextMode);
        }
    };

    const handleToggleEquip = (item) => {
        if (!resolvedCapabilities.editable) return;
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
        if (!resolvedCapabilities.editable) return;
        updateCharacter(c => {
            const idx = c.inventory.findIndex(i => i.name === item.name && i.qty > 0);
            if (idx > -1) {
                c.inventory[idx].qty--;
                if (c.inventory[idx].qty <= 0) c.inventory.splice(idx, 1);
            }
        });
    };

    const handleApplyBacklash = (tier) => {
        if (!assignedPact) return;
        const tierData = assignedPact.backlash?.[tier];
        if (!tierData?.effects?.length) {
            alert(`${BACKLASH_LABELS[tier]}: No condition effects defined for this tier.`);
            return;
        }
        if (!activeCampaignId || !character?.id || !dataActions?.effect) {
            alert('No active actor is available for backlash effects.');
            return;
        }
        const existingEffects = activeCampaign?.actorEffects || [];
        buildBacklashEffectInputs({
            effects: tierData.effects,
            tier,
            pactId: assignedPact.id,
            actorId: character.id,
        }).forEach(effectInput => {
            const existing = existingEffects.find(effect =>
                effect.targetActorId === character.id &&
                effect.source?.type === 'backlash' &&
                effect.source?.id === effectInput.source.id
            );
            const action = existing
                ? dataActions.effect.updateEffect(activeCampaignId, existing.id, effect => ({ ...effect, ...effectInput }))
                : dataActions.effect.createEffect(activeCampaignId, character.id, effectInput);
            Promise.resolve(action).catch(err => {
                console.error(err);
                alert(err?.message || String(err));
            });
        });
        setBacklashOpen(false);
    };

    if (!character) return null;

    return (
        <div className={`char-card actor-sheet-card actor-sheet-card--${mode}`} style={{ position: 'relative' }}>
            <div className="char-header">
                <div>{character.name}</div>
                <div style={{ fontSize: '0.8em', color: '#888' }}>Level {character.level}</div>
            </div>

            <div className="card-tabs">
                <button className={activeTab === 'stats' ? 'active' : ''} onClick={() => setActiveTab('stats')}>Stats</button>
                {resolvedCapabilities.showInventory && <button className={activeTab === 'inv' ? 'active' : ''} onClick={() => setActiveTab('inv')}>Inv</button>}
                {resolvedCapabilities.showMagic && (isCaster || activeTab === 'spells') && <button className={activeTab === 'spells' ? 'active' : ''} onClick={() => setActiveTab('spells')}>Spells</button>}
                {resolvedCapabilities.showMagic && (isKineticist || activeTab === 'impulses') && <button className={activeTab === 'impulses' ? 'active' : ''} onClick={() => setActiveTab('impulses')}>Impulses</button>}
                <button className={activeTab === 'feats' ? 'active' : ''} onClick={() => setActiveTab('feats')}>Feats</button>
                {resolvedCapabilities.showPacts && hasPactsInDb && <button className={activeTab === 'pact' ? 'active' : ''} onClick={() => setActiveTab('pact')} style={{ color: hasPact ? (el?.color || '#aaa') : undefined }}>Pact</button>}
            </div>

            <div className="char-card-body">
                {activeTab === 'stats' && (
                    <>
                        {hasPact && resolvedCapabilities.editable && (
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
                            character={rulesCharacter}
                            rulesViewModel={actorRules}
                            conditions={conditions}
                            characterActions={characterActions}
                            onOpenModal={handleOpenModal}
                            onLongPress={onOpenModalLong}
                        />
                    </>
                )}
                {activeTab === 'inv' && resolvedCapabilities.showInventory && (
                    <InventoryView
                        character={rulesCharacter}
                        db={db}
                        onUpdateCharacter={resolvedCapabilities.editable ? updateCharacter : undefined}
                        onOpenModal={handleOpenModal}
                        onToggleEquip={handleToggleEquip}
                        onInspectItem={(item) => handleOpenModal('item', item)}
                        onConsumeItem={handleConsume}
                        onFireWeapon={() => {}}
                        onLoadWeapon={() => {}}
                        onLongPress={onOpenModalLong}
                        onOpenShop={resolvedCapabilities.allowShop ? () => handleOpenModal('shop') : () => {}}
                        readOnly={!resolvedCapabilities.editable}
                        allowLoot={resolvedCapabilities.allowLoot}
                        showUtilityActions={mode === 'gm'}
                    />
                )}
                {activeTab === 'spells' && resolvedCapabilities.showMagic && (
                    <MagicView
                        character={rulesCharacter}
                        characterActions={characterActions}
                        updateCharacter={updateCharacter}
                        setModalData={setModalData || setLocalModalData}
                        setModalMode={setModalMode || setLocalModalMode}
                        setCatalogMode={(catalogMode) => console.log('Catalog not implemented in actor sheet', catalogMode)}
                        onLongPress={onOpenModalLong}
                    />
                )}
                {activeTab === 'impulses' && resolvedCapabilities.showMagic && (
                    <ImpulsesView
                        character={rulesCharacter}
                        setModalData={setModalData || setLocalModalData}
                        setModalMode={setModalMode || setLocalModalMode}
                        onLongPress={onOpenModalLong}
                    />
                )}
                {activeTab === 'feats' && (
                    <FeatsView
                        character={rulesCharacter}
                        setModalData={setModalData || setLocalModalData}
                        setModalMode={setModalMode || setLocalModalMode}
                        setCatalogMode={() => {}}
                        onLongPress={onOpenModalLong}
                    />
                )}
                {activeTab === 'pact' && resolvedCapabilities.showPacts && (
                    <PactTab
                        character={rulesCharacter}
                        updateCharacter={updateCharacter}
                        db={db}
                        allPacts={allPacts}
                        assignedPact={assignedPact}
                        editable={resolvedCapabilities.editable}
                    />
                )}
            </div>

            {backlashOpen && hasPact && (
                <BacklashOverlay
                    assignedPact={assignedPact}
                    el={el}
                    character={rulesCharacter}
                    onApply={handleApplyBacklash}
                    onClose={() => setBacklashOpen(false)}
                />
            )}

            {resolvedCapabilities.localModals && modalMode && (
                <ModalManager
                    modalMode={modalMode}
                    setModalMode={setLocalModalMode}
                    modalData={modalData}
                    setModalData={setLocalModalData}
                    character={rulesCharacter}
                    conditions={conditions}
                    updateCharacter={updateCharacter}
                    characterActions={characterActions}
                    onClose={() => { setLocalModalMode(null); setLocalModalData(null); }}
                    onBack={() => { setLocalModalMode(null); setLocalModalData(null); }}
                    hasHistory={false}
                    onContentLinkClick={() => {}}
                    dailyPrepQueue={[]}
                    setDailyPrepQueue={() => {}}
                    toggleInventoryEquipped={handleToggleEquip}
                    isLoadingShopDetail={false}
                    shopDetailError={null}
                    toggleBloodmagic={() => {}}
                    removeFromCharacter={() => {}}
                    saveNewAction={() => {}}
                    onDailyPrep={() => {}}
                />
            )}
        </div>
    );
}

function BacklashOverlay({ assignedPact, el, character, onApply, onClose }) {
    return (
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
                            onClick={() => onApply(tier)}
                            style={{
                                padding: '10px 14px', background: '#1a1a1d',
                                border: `1px solid ${tierColor}`, borderRadius: 6,
                                color: tierColor, cursor: 'pointer', textAlign: 'left'
                            }}
                        >
                            <div style={{ fontWeight: 'bold', marginBottom: 2 }}>{BACKLASH_LABELS[tier]}</div>
                            {effects.length > 0 ? (
                                <div style={{ fontSize: '0.75em', opacity: 0.8 }}>
                                    {effects.map((effect, index) => (
                                        <span key={index}>{index > 0 ? ', ' : ''}{effect.conditionName}{effect.value ? ` ${effect.value}` : ''}</span>
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
                onClick={onClose}
                style={{ marginTop: 14, background: 'none', border: '1px solid #555', color: '#888', padding: '6px 20px', borderRadius: 4, cursor: 'pointer' }}
            >
                Cancel
            </button>
        </div>
    );
}

function PactTab({ character, updateCharacter, db, allPacts, assignedPact, editable }) {
    const pactData = character.pact || {};
    const el = assignedPact ? (ELEMENTS[assignedPact.element] || ELEMENTS.Fire) : null;

    const setPactId = (pactId) => {
        if (!editable) return;
        updateCharacter(c => {
            c.pact = pactId ? { pactId, choices: {}, unlockedAwakenings: {} } : null;
        });
    };

    const setChoice = (groupIdx, abilityId) => {
        if (!editable) return;
        updateCharacter(c => {
            if (!c.pact) return;
            c.pact.choices = { ...(c.pact.choices || {}), [groupIdx]: abilityId };
        });
    };

    const toggleAwakening = (abilityId, level) => {
        if (!editable) return;
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
            <div>
                <div style={{ fontSize: '0.7em', color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Assigned Pact</div>
                <select
                    value={pactData.pactId || ''}
                    onChange={e => setPactId(e.target.value || null)}
                    disabled={!editable}
                    style={inputStyle}
                >
                    <option value="">None</option>
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

                    {(assignedPact.abilityGroups || []).length > 0 && (
                        <div>
                            <div style={{ fontSize: '0.7em', color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Ability Choices</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {assignedPact.abilityGroups.map((group, groupIdx) => {
                                    const chosenId = pactData.choices?.[groupIdx];
                                    const abilities = (group.abilityIds || [])
                                        .map(id => selectDeviantAbility(db, id))
                                        .filter(Boolean);
                                    if (abilities.length === 0) return null;
                                    return (
                                        <div key={groupIdx} style={{ background: '#1a1a1d', border: '1px solid #2a2a2a', borderRadius: 4, padding: 8 }}>
                                            <div style={{ fontSize: '0.7em', color: el.color, marginBottom: 6 }}>{group.label || `Group ${groupIdx + 1}`}</div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                                {abilities.map(ability => {
                                                    const isChosen = chosenId === ability.id;
                                                    const unlockedLevel = pactData.unlockedAwakenings?.[ability.id] || 0;
                                                    return (
                                                        <div key={ability.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                            <button
                                                                onClick={() => setChoice(groupIdx, isChosen ? null : ability.id)}
                                                                disabled={!editable}
                                                                style={{
                                                                    flex: 1, padding: '5px 8px', textAlign: 'left',
                                                                    background: isChosen ? el.bg : '#111',
                                                                    border: `1px solid ${isChosen ? el.color : '#333'}`,
                                                                    color: isChosen ? el.color : '#aaa',
                                                                    borderRadius: 4, cursor: editable ? 'pointer' : 'default', fontSize: '0.8em'
                                                                }}
                                                            >
                                                                {isChosen ? '✓ ' : ''}{ability.name} <span style={{ opacity: 0.5 }}>Lv{ability.level}</span>
                                                            </button>
                                                            {isChosen && [1, 2].map(awLevel => {
                                                                const awKey = `awakening${awLevel}`;
                                                                const hasAw = ability[awKey]?.name;
                                                                if (!hasAw) return null;
                                                                const unlocked = unlockedLevel >= awLevel;
                                                                return (
                                                                    <button
                                                                        key={awLevel}
                                                                        onClick={() => toggleAwakening(ability.id, awLevel)}
                                                                        disabled={!editable}
                                                                        title={`${unlocked ? 'Revoke' : 'Unlock'} Awakening ${awLevel}: ${ability[awKey].name}`}
                                                                        style={{
                                                                            padding: '4px 7px', fontSize: '0.7em', borderRadius: 3, cursor: editable ? 'pointer' : 'default',
                                                                            background: unlocked ? '#1a3a1a' : '#1a1a1d',
                                                                            border: `1px solid ${unlocked ? '#4caf50' : '#444'}`,
                                                                            color: unlocked ? '#81c784' : '#555'
                                                                        }}
                                                                    >
                                                                        Aw{awLevel}
                                                                    </button>
                                                                );
                                                            })}
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
