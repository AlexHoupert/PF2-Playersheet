import React, { useState, useMemo } from 'react';
import RichTextEditor from '../shared/components/RichTextEditor';
import { useCampaign } from '../shared/context/CampaignContext';
import { useAppFeedback } from '../shared/feedback/AppFeedback';
import { FEAT_INDEX_ITEMS } from '../shared/catalog/featIndex';
import { selectPactList } from '../shared/db/selectors/pactSelectors';
import {
    ELEMENTS, ELEMENT_NAMES, BACKLASH_TIERS, BACKLASH_LABELS, BACKLASH_COLORS,
    BACKLASH_CONDITIONS, getDeviantAbilities, generateId
} from './pactsData';

const EMPTY_PACT = {
    id: '', name: '', element: 'Fire', description: '',
    dedication: null,
    abilityGroups: [],
    backlash: {
        mild:     { description: '', effects: [] },
        moderate: { description: '', effects: [] },
        severe:   { description: '', effects: [] },
    }
};

export default function PactAdminView({ db }) {
    const { activeCampaignId, dataActions, pcActors } = useCampaign();
    const { confirm, notifyError, notifySuccess } = useAppFeedback();
    const pacts = useMemo(() => selectPactList(db), [db]);

    const deviantAbilities = useMemo(() => getDeviantAbilities(db), [db]);
    const dedicationFeats = useMemo(
        () => FEAT_INDEX_ITEMS
            .filter(feat => String(feat.name || '').toLowerCase().includes('dedication'))
            .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''))),
        []
    );

    const [editing, setEditing] = useState(null);
    const [isNew, setIsNew] = useState(false);
    const [offerMenuId, setOfferMenuId] = useState(null);
    const runDataAction = (action) => {
        Promise.resolve(action).catch(err => {
            console.error(err);
            notifyError(err);
        });
    };

    // Save pact to db
    const save = () => {
        if (!editing?.name?.trim()) return;
        const id = editing.id || generateId(editing.name);
        const record = { ...editing, id };
        runDataAction(dataActions.pact.savePact(record));
        setEditing(prev => ({ ...prev, id }));
        setIsNew(false);
    };

    const startNewPact = () => {
        setEditing(createEmptyPact());
        setIsNew(true);
        setOfferMenuId(null);
    };

    const del = async (id) => {
        const confirmed = await confirm({
            title: 'Delete pact',
            message: 'Delete this pact?',
            confirmLabel: 'Delete',
            danger: true,
        });
        if (!confirmed) return;
        runDataAction(dataActions.pact.deletePact(id));
        setEditing(null);
    };

    // Ability group helpers
    const addGroup = () => {
        setEditing(prev => ({
            ...prev,
            abilityGroups: [...prev.abilityGroups, { label: '', abilityIds: [] }]
        }));
    };

    const removeGroup = (idx) => {
        setEditing(prev => ({
            ...prev,
            abilityGroups: prev.abilityGroups.filter((_, i) => i !== idx)
        }));
    };

    const updateGroup = (idx, field, val) => {
        setEditing(prev => {
            const groups = prev.abilityGroups.map((g, i) => i === idx ? { ...g, [field]: val } : g);
            return { ...prev, abilityGroups: groups };
        });
    };

    const toggleAbilityInGroup = (groupIdx, abilityId) => {
        setEditing(prev => {
            const groups = prev.abilityGroups.map((g, i) => {
                if (i !== groupIdx) return g;
                const ids = g.abilityIds.includes(abilityId)
                    ? g.abilityIds.filter(id => id !== abilityId)
                    : [...g.abilityIds, abilityId];
                return { ...g, abilityIds: ids };
            });
            return { ...prev, abilityGroups: groups };
        });
    };

    const setDedication = (dedicationId) => {
        const feat = dedicationFeats.find(item => (item.sourceFile || item.name) === dedicationId);
        setEditing(prev => ({
            ...prev,
            dedication: feat
                ? { type: 'feat', id: feat.sourceFile || feat.name, name: feat.name }
                : null
        }));
    };

    const activePcActors = useMemo(
        () => (pcActors || []).filter(actor => actor?.kind === 'pc' && !actor.deletedAt),
        [pcActors]
    );

    const actorHasPact = (actor) => Boolean(actor?.sheet?.pact?.pactId || actor?.pact?.pactId);
    const actorLabel = (actor) => actor?.sheet?.name || actor?.name || actor?.id || 'Unnamed';

    const offerPact = (pact, targetActors) => {
        if (!activeCampaignId) {
            notifyError('No active campaign selected.');
            return;
        }
        const eligible = (targetActors || []).filter(actor => actor?.id && !actorHasPact(actor));
        if (!eligible.length) {
            notifyError('No eligible characters for this pact offer.');
            return;
        }
        const skipped = (targetActors || []).length - eligible.length;
        runDataAction(
            dataActions.pact.offerPactToActors(activeCampaignId, eligible.map(actor => actor.id), pact.id)
                .then(() => notifySuccess(
                    skipped > 0
                        ? `Offered ${pact.name} to ${eligible.length} character(s); skipped ${skipped}.`
                        : `Offered ${pact.name} to ${eligible.length} character(s).`
                ))
        );
        setOfferMenuId(null);
    };

    // Backlash helpers
    const setBacklashField = (tier, field, val) => {
        setEditing(prev => ({
            ...prev,
            backlash: {
                ...prev.backlash,
                [tier]: { ...prev.backlash[tier], [field]: val }
            }
        }));
    };

    const addEffect = (tier) => {
        setEditing(prev => ({
            ...prev,
            backlash: {
                ...prev.backlash,
                [tier]: {
                    ...prev.backlash[tier],
                    effects: [...(prev.backlash[tier]?.effects || []), { conditionName: 'drained', value: 1 }]
                }
            }
        }));
    };

    const updateEffect = (tier, idx, field, val) => {
        setEditing(prev => {
            const effects = (prev.backlash[tier]?.effects || []).map((e, i) =>
                i === idx ? { ...e, [field]: val } : e
            );
            return {
                ...prev,
                backlash: { ...prev.backlash, [tier]: { ...prev.backlash[tier], effects } }
            };
        });
    };

    const removeEffect = (tier, idx) => {
        setEditing(prev => {
            const effects = (prev.backlash[tier]?.effects || []).filter((_, i) => i !== idx);
            return {
                ...prev,
                backlash: { ...prev.backlash, [tier]: { ...prev.backlash[tier], effects } }
            };
        });
    };

    const el = editing ? (ELEMENTS[editing.element] || ELEMENTS.Fire) : null;
    const filteredAbilities = editing
        ? deviantAbilities.filter(a => a.element === editing.element)
        : [];

    return (
        <div style={{ display: 'flex', height: '100%', gap: 0, overflow: 'hidden' }}>
            {/* Left Panel — Pact List */}
            <div style={{
                width: editing ? 280 : '100%', flexShrink: 0,
                overflowY: 'auto', padding: 16,
                borderRight: editing ? '1px solid #333' : 'none'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                    <h2 style={{ margin: 0, fontFamily: 'Cinzel, serif', color: '#c5a059' }}>Elemental Pacts</h2>
                    <button
                        onClick={startNewPact}
                        style={{ padding: '6px 14px', background: '#1a2a1a', border: '1px solid #4caf50', color: '#81c784', borderRadius: 4, cursor: 'pointer', fontWeight: 'bold' }}
                    >
                        + New Pact
                    </button>
                </div>

                {pacts.length === 0 && (
                    <div style={{ color: '#555', textAlign: 'center', padding: 20 }}>No pacts yet.</div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {pacts.map(p => {
                        const pel = ELEMENTS[p.element] || ELEMENTS.Fire;
                        const isActive = editing?.id === p.id;
                        return (
                            <div
                                key={p.id}
                                onClick={() => { setEditing(normalizeEditablePact(p)); setIsNew(false); setOfferMenuId(null); }}
                                onContextMenu={(event) => {
                                    event.preventDefault();
                                    setOfferMenuId(current => current === p.id ? null : p.id);
                                }}
                                style={{
                                    padding: '10px 12px', borderRadius: 6, cursor: 'pointer',
                                    background: isActive ? pel.bg : '#1a1a1d',
                                    border: `1px solid ${isActive ? pel.color : '#2a2a2a'}`,
                                    display: 'flex', alignItems: 'center', gap: 10,
                                    position: 'relative'
                                }}
                            >
                                <span style={{ fontSize: '1.2em' }}>{pel.icon}</span>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 'bold', color: isActive ? pel.color : '#e0e0e0', fontSize: '0.9em' }}>{p.name}</div>
                                    <div style={{ fontSize: '0.75em', color: '#666' }}>{p.element} • {p.abilityGroups?.length || 0} groups</div>
                                </div>
                                <button
                                    type="button"
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        setOfferMenuId(current => current === p.id ? null : p.id);
                                    }}
                                    style={{ padding: '4px 7px', background: '#252525', border: '1px solid #555', color: '#ddd', borderRadius: 4, cursor: 'pointer', fontSize: '0.75em' }}
                                >
                                    Offer
                                </button>
                                {offerMenuId === p.id && (
                                    <div
                                        onClick={(event) => event.stopPropagation()}
                                        style={{
                                            position: 'absolute',
                                            right: 8,
                                            top: 38,
                                            zIndex: 20,
                                            minWidth: 220,
                                            background: '#202020',
                                            border: '1px solid #c5a059',
                                            borderRadius: 6,
                                            boxShadow: '0 10px 30px rgba(0,0,0,0.45)',
                                            padding: 8,
                                        }}
                                    >
                                        <div style={{ fontSize: '0.72em', color: '#c5a059', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 }}>Offer Pact</div>
                                        <button
                                            type="button"
                                            onClick={() => offerPact(p, activePcActors)}
                                            disabled={!activePcActors.some(actor => !actorHasPact(actor))}
                                            style={offerButtonStyle(!activePcActors.some(actor => !actorHasPact(actor)))}
                                        >
                                            Whole Party
                                        </button>
                                        <div style={{ height: 1, background: '#333', margin: '6px 0' }} />
                                        {activePcActors.length === 0 && (
                                            <div style={{ color: '#777', fontSize: '0.8em', padding: 6 }}>No active player characters.</div>
                                        )}
                                        {activePcActors.map(actor => {
                                            const disabled = actorHasPact(actor);
                                            return (
                                                <button
                                                    key={actor.id}
                                                    type="button"
                                                    onClick={() => offerPact(p, [actor])}
                                                    disabled={disabled}
                                                    style={offerButtonStyle(disabled)}
                                                >
                                                    {actorLabel(actor)}{disabled ? ' (already bound)' : ''}
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Right Panel — Editor */}
            {editing && (
                <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
                        <h3 style={{ margin: 0, fontFamily: 'Cinzel, serif', color: el.color }}>
                            {isNew ? 'New Pact' : `Edit: ${editing.name}`}
                        </h3>
                        <button onClick={() => setEditing(null)} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '1.2em' }}>✕</button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        {/* Element Selector */}
                        <Field label="Element">
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                {ELEMENT_NAMES.map(ename => {
                                    const edef = ELEMENTS[ename];
                                    const active = editing.element === ename;
                                    return (
                                        <button key={ename} onClick={() => setEditing(p => ({ ...p, element: ename }))}
                                            style={{
                                                padding: '6px 14px', borderRadius: 4, cursor: 'pointer',
                                                background: active ? edef.bg : '#1a1a1d',
                                                border: `1px solid ${active ? edef.color : '#444'}`,
                                                color: active ? edef.color : '#888',
                                                fontWeight: active ? 'bold' : 'normal',
                                                fontSize: '0.85em'
                                            }}
                                        >
                                            {edef.icon} {ename}
                                        </button>
                                    );
                                })}
                            </div>
                        </Field>

                        {/* Name */}
                        <Field label="Pact Name">
                            <input
                                value={editing.name}
                                onChange={e => setEditing(p => ({ ...p, name: e.target.value }))}
                                placeholder="e.g. The Verdant Core"
                                style={inputStyle}
                            />
                        </Field>

                        {/* Description */}
                        <Field label="Description">
                            <RichTextEditor
                                value={editing.description}
                                onChange={v => setEditing(p => ({ ...p, description: v }))}
                                placeholder="Describe this pact's nature, origin, and lore..."
                                style={{ minHeight: 100, background: '#111' }}
                            />
                        </Field>

                        <Field label="Free Dedication">
                            <select
                                value={editing.dedication?.id || ''}
                                onChange={e => setDedication(e.target.value)}
                                style={inputStyle}
                            >
                                <option value="">No dedication selected</option>
                                {dedicationFeats.map(feat => (
                                    <option key={feat.sourceFile || feat.name} value={feat.sourceFile || feat.name}>
                                        {feat.name} {typeof feat.level === 'number' ? `(Lv ${feat.level})` : ''}
                                    </option>
                                ))}
                            </select>
                        </Field>

                        {/* Ability Groups */}
                        <div style={{ background: '#1a1a1d', border: `1px solid ${el.dim}`, borderRadius: 6, padding: 14 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                <div style={{ fontSize: '0.75em', color: el.color, textTransform: 'uppercase', letterSpacing: 1 }}>
                                    Ability Groups
                                </div>
                                <button onClick={addGroup} style={{ padding: '4px 10px', background: el.bg, border: `1px solid ${el.dim}`, color: el.color, borderRadius: 4, cursor: 'pointer', fontSize: '0.8em' }}>
                                    + Add Group
                                </button>
                            </div>

                            {filteredAbilities.length === 0 && (
                                <div style={{ fontSize: '0.8em', color: '#555', marginBottom: 8 }}>
                                    No {editing.element} deviant abilities found. Create them in Deviant Abilities first.
                                </div>
                            )}

                            {editing.abilityGroups.length === 0 && (
                                <div style={{ fontSize: '0.8em', color: '#555' }}>
                                    No groups yet. Add a group to define level tiers with ability choices.
                                </div>
                            )}

                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                {editing.abilityGroups.map((group, gIdx) => (
                                    <div key={gIdx} style={{ background: '#111', border: '1px solid #333', borderRadius: 4, padding: 10 }}>
                                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                                            <input
                                                value={group.label}
                                                onChange={e => updateGroup(gIdx, 'label', e.target.value)}
                                                placeholder="Group label, e.g. Level 2"
                                                style={{ ...inputStyle, flex: 1 }}
                                            />
                                            <button onClick={() => removeGroup(gIdx)} style={{ padding: '4px 8px', background: '#3a1a1a', border: '1px solid #e53935', color: '#ef9a9a', borderRadius: 3, cursor: 'pointer', fontSize: '0.8em' }}>✕</button>
                                        </div>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                            {filteredAbilities.map(ab => {
                                                const selected = group.abilityIds.includes(ab.id);
                                                return (
                                                    <button
                                                        key={ab.id}
                                                        onClick={() => toggleAbilityInGroup(gIdx, ab.id)}
                                                        style={{
                                                            padding: '4px 10px', borderRadius: 4, cursor: 'pointer', fontSize: '0.8em',
                                                            background: selected ? el.bg : '#1a1a1d',
                                                            border: `1px solid ${selected ? el.color : '#444'}`,
                                                            color: selected ? el.color : '#888'
                                                        }}
                                                    >
                                                        {ab.name} <span style={{ opacity: 0.6 }}>Lv{ab.level}</span>
                                                    </button>
                                                );
                                            })}
                                            {filteredAbilities.length === 0 && (
                                                <span style={{ fontSize: '0.75em', color: '#555' }}>No abilities available for this element.</span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Backlash */}
                        <div style={{ background: '#1a1a1d', border: '1px solid #3a1a1a', borderRadius: 6, padding: 14 }}>
                            <div style={{ fontSize: '0.75em', color: '#ef9a9a', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
                                Backlash
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                                {BACKLASH_TIERS.map(tier => {
                                    const tierData = editing.backlash?.[tier] || { description: '', effects: [] };
                                    const tierColor = BACKLASH_COLORS[tier];
                                    return (
                                        <div key={tier} style={{ background: '#111', border: `1px solid ${tierColor}33`, borderRadius: 4, padding: 10 }}>
                                            <div style={{ fontSize: '0.75em', color: tierColor, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
                                                {BACKLASH_LABELS[tier]}
                                            </div>
                                            <Field label="Description">
                                                <RichTextEditor
                                                    value={tierData.description}
                                                    onChange={v => setBacklashField(tier, 'description', v)}
                                                    placeholder={`${BACKLASH_LABELS[tier]} effect description...`}
                                                    style={{ minHeight: 70, background: '#0a0a0a', border: `1px solid ${tierColor}44` }}
                                                />
                                            </Field>

                                            {/* Condition Effects */}
                                            <div style={{ marginTop: 8 }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                                    <div style={{ fontSize: '0.7em', color: '#666', textTransform: 'uppercase', letterSpacing: 0.5 }}>Condition Effects</div>
                                                    <button onClick={() => addEffect(tier)} style={{ padding: '2px 8px', background: '#1a1a2a', border: `1px solid ${tierColor}66`, color: tierColor, borderRadius: 3, cursor: 'pointer', fontSize: '0.75em' }}>
                                                        + Add Condition
                                                    </button>
                                                </div>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                                    {(tierData.effects || []).map((eff, effIdx) => {
                                                        const condDef = BACKLASH_CONDITIONS.find(c => c.name === eff.conditionName);
                                                        return (
                                                            <div key={effIdx} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                                                <select
                                                                    value={eff.conditionName}
                                                                    onChange={e => updateEffect(tier, effIdx, 'conditionName', e.target.value)}
                                                                    style={{ ...inputStyle, flex: 1 }}
                                                                >
                                                                    {BACKLASH_CONDITIONS.map(c => (
                                                                        <option key={c.name} value={c.name}>{c.name}</option>
                                                                    ))}
                                                                </select>
                                                                {condDef?.valued && (
                                                                    <input
                                                                        type="number" min={1} max={4}
                                                                        value={eff.value ?? 1}
                                                                        onChange={e => updateEffect(tier, effIdx, 'value', parseInt(e.target.value) || 1)}
                                                                        style={{ ...inputStyle, width: 60 }}
                                                                    />
                                                                )}
                                                                <button onClick={() => removeEffect(tier, effIdx)} style={{ padding: '4px 7px', background: 'none', border: '1px solid #e53935', color: '#ef9a9a', borderRadius: 3, cursor: 'pointer', fontSize: '0.8em' }}>✕</button>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Actions */}
                        <div style={{ display: 'flex', gap: 8 }}>
                            <button
                                onClick={save}
                                disabled={!editing.name?.trim()}
                                style={{ flex: 1, padding: 10, background: el.color, border: 'none', color: '#111', borderRadius: 4, cursor: 'pointer', fontWeight: 'bold', opacity: editing.name?.trim() ? 1 : 0.5 }}
                            >
                                Save
                            </button>
                            <button onClick={() => setEditing(null)} style={{ padding: '10px 20px', background: '#333', border: '1px solid #555', color: '#ccc', borderRadius: 4, cursor: 'pointer' }}>
                                Cancel
                            </button>
                            {editing.id && (
                                <button onClick={() => del(editing.id)} style={{ padding: '10px 12px', background: '#3a1a1a', border: '1px solid #e53935', color: '#ef9a9a', borderRadius: 4, cursor: 'pointer' }}>
                                    Delete
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function Field({ label, children }) {
    return (
        <div>
            <div style={{ fontSize: '0.75em', color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>{label}</div>
            {children}
        </div>
    );
}

function createEmptyPact() {
    return {
        ...EMPTY_PACT,
        dedication: null,
        abilityGroups: [
            { label: 'Initial', abilityIds: [] },
            { label: 'Level 6', abilityIds: [] },
            { label: 'Level 11', abilityIds: [] },
        ],
        backlash: {
            mild: { description: '', effects: [] },
            moderate: { description: '', effects: [] },
            severe: { description: '', effects: [] },
        },
    };
}

function normalizeEditablePact(pact) {
    return {
        ...pact,
        dedication: pact.dedication || null,
        abilityGroups: Array.isArray(pact.abilityGroups) ? pact.abilityGroups : [],
        backlash: {
            mild: { description: '', effects: [] },
            moderate: { description: '', effects: [] },
            severe: { description: '', effects: [] },
            ...pact.backlash,
        },
    };
}

function offerButtonStyle(disabled) {
    return {
        width: '100%',
        display: 'block',
        padding: '6px 8px',
        marginBottom: 4,
        textAlign: 'left',
        background: disabled ? '#171717' : '#2a2a2a',
        border: '1px solid #444',
        color: disabled ? '#666' : '#eee',
        borderRadius: 4,
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontSize: '0.82em',
    };
}

const inputStyle = {
    width: '100%', padding: '7px 10px', background: '#111', border: '1px solid #444',
    color: '#fff', borderRadius: 4, fontSize: '0.9em', boxSizing: 'border-box'
};
