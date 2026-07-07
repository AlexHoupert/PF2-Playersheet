import React, { useEffect, useMemo, useState } from 'react';
import { FEAT_INDEX_ITEMS } from '../shared/catalog/featIndex';
import { selectDeviantAbilityList } from '../shared/db/selectors/abilitySelectors';
import {
    resolvePactDedication,
    selectPactAbilityOptions,
    selectPendingPactOffer,
} from '../shared/db/selectors/pactSelectors';
import { useAppFeedback } from '../shared/feedback/AppFeedback';
import { BACKLASH_COLORS, BACKLASH_LABELS, BACKLASH_TIERS, ELEMENTS } from './pactsData';

export default function PactOfferModal({ character, db, activeCampaignId, dataActions, runDataAction }) {
    const { notifyError } = useAppFeedback();
    const offer = useMemo(() => selectPendingPactOffer(character, db), [character, db]);
    const pact = offer?.pact || null;
    const el = pact ? (ELEMENTS[pact.element] || ELEMENTS.Fire) : ELEMENTS.Fire;
    const dedication = useMemo(() => resolvePactDedication(pact, FEAT_INDEX_ITEMS), [pact]);
    const abilities = useMemo(() => selectDeviantAbilityList(db), [db]);
    const abilityOptions = useMemo(() => selectPactAbilityOptions({
        pact,
        abilities,
        characterLevel: character?.level,
        currentChoices: character?.pact?.choices || {},
        slotIndex: 0,
    }), [abilities, character?.level, character?.pact?.choices, pact]);

    const [step, setStep] = useState('offer');
    const [selectedAbilityId, setSelectedAbilityId] = useState('');
    const [detailAbility, setDetailAbility] = useState(null);
    const [confirmAbility, setConfirmAbility] = useState(null);

    useEffect(() => {
        setStep('offer');
        setSelectedAbilityId('');
        setDetailAbility(null);
        setConfirmAbility(null);
    }, [offer?.id]);

    if (!offer || !pact) return null;

    const rejectOffer = () => {
        if (!activeCampaignId || !character?.id) return;
        runDataAction(dataActions.pact.rejectPactOffer(activeCampaignId, character.id, offer.id));
    };

    const requestAcceptOffer = () => {
        const selected = abilityOptions.find(option => option.ability.id === selectedAbilityId);
        if (!selected?.selectable) {
            notifyError(selected?.disabledReason || 'Select an available ability first.');
            return;
        }
        setConfirmAbility(selected.ability);
    };

    const acceptOffer = () => {
        if (!activeCampaignId || !character?.id || !confirmAbility?.id) return;
        runDataAction(dataActions.pact.acceptPactOffer(activeCampaignId, character.id, offer.id, confirmAbility.id));
        setConfirmAbility(null);
    };

    return (
        <div style={overlayStyle}>
            <div role="dialog" aria-modal="true" style={{ ...modalStyle, borderColor: el.color }}>
                {step === 'offer' ? (
                    <>
                        <h2 style={{ margin: 0, color: el.color, fontFamily: 'Cinzel, serif' }}>
                            You have been offered a pact: {pact.name}
                        </h2>
                        <p style={{ color: '#ddd', margin: '10px 0 14px' }}>Are you willing to accept?</p>
                        <details open style={detailsStyle}>
                            <summary style={{ cursor: 'pointer', color: '#ffecb3', fontWeight: 700 }}>
                                What accepting a pact means
                            </summary>
                            <ul style={{ margin: '10px 0 0', paddingLeft: 20, color: '#ccc', lineHeight: 1.45 }}>
                                <li>You gain access to Deviant Abilities tied to this pact.</li>
                                <li>Using these powers can trigger Backlash with escalating severity.</li>
                                <li>You start with one Deviant Ability.</li>
                                <li>You may choose another at levels 6 and 11.</li>
                                <li>Awakenings are free at levels 7 and 11, or can be bought with a class/general feat.</li>
                                <li>You get a free dedication relevant to the pact.</li>
                            </ul>
                            <div style={{ marginTop: 10, padding: 8, background: '#111', border: '1px solid #333', borderRadius: 4 }}>
                                <strong style={{ color: el.color }}>Free Dedication:</strong>{' '}
                                <span style={{ color: '#eee' }}>{dedication?.name || 'Not selected by GM'}</span>
                            </div>
                        </details>
                        <BacklashSummary pact={pact} />
                        <div style={actionsStyle}>
                            <button type="button" onClick={rejectOffer} style={secondaryButtonStyle}>No</button>
                            <button type="button" onClick={() => setStep('ability')} style={{ ...primaryButtonStyle, background: el.color }}>
                                Yes, choose an ability
                            </button>
                        </div>
                    </>
                ) : (
                    <>
                        <h2 style={{ margin: 0, color: el.color, fontFamily: 'Cinzel, serif' }}>
                            Choose your first Deviant Ability
                        </h2>
                        <p style={{ color: '#aaa', margin: '8px 0 12px' }}>
                            All abilities tied to this pact are visible. Only currently available abilities can be learned.
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: '48vh', overflowY: 'auto', paddingRight: 4 }}>
                            {abilityOptions.map(option => {
                                const selected = selectedAbilityId === option.ability.id;
                                return (
                                    <button
                                        key={`${option.groupIndex}:${option.ability.id}`}
                                        type="button"
                                        onClick={() => option.selectable && setSelectedAbilityId(option.ability.id)}
                                        onDoubleClick={() => setDetailAbility(option.ability)}
                                        aria-disabled={!option.selectable}
                                        style={{
                                            ...abilityButtonStyle,
                                            borderColor: selected ? el.color : '#333',
                                            background: selected ? el.bg : '#181818',
                                            opacity: option.selectable ? 1 : 0.58,
                                            cursor: option.selectable ? 'pointer' : 'not-allowed',
                                        }}
                                    >
                                        <span>
                                            <strong style={{ color: selected ? el.color : '#eee' }}>{option.ability.name}</strong>
                                            <span style={{ color: '#777', marginLeft: 8 }}>Lv {option.ability.level}</span>
                                        </span>
                                        <span style={{ color: option.selectable ? '#81c784' : '#b0b0b0', fontSize: '0.8em' }}>
                                            {option.selectable ? 'Available' : option.disabledReason}
                                        </span>
                                        <span
                                            onClick={(event) => {
                                                event.preventDefault();
                                                event.stopPropagation();
                                                setDetailAbility(option.ability);
                                            }}
                                            style={{ color: '#c5a059', fontSize: '0.78em', marginTop: 4 }}
                                        >
                                            Double click/tap for details
                                        </span>
                                    </button>
                                );
                            })}
                            {abilityOptions.length === 0 && (
                                <div style={{ color: '#777', padding: 12, border: '1px solid #333', borderRadius: 6 }}>
                                    This pact has no Deviant Abilities assigned yet.
                                </div>
                            )}
                        </div>
                        <div style={actionsStyle}>
                            <button type="button" onClick={() => setStep('offer')} style={secondaryButtonStyle}>Back</button>
                            <button
                                type="button"
                                onClick={requestAcceptOffer}
                                disabled={!selectedAbilityId}
                                style={{ ...primaryButtonStyle, background: selectedAbilityId ? el.color : '#555', cursor: selectedAbilityId ? 'pointer' : 'not-allowed' }}
                            >
                                Learn Ability
                            </button>
                        </div>
                    </>
                )}
            </div>
            {detailAbility && (
                <DeviantAbilityDetailModal ability={detailAbility} pact={pact} onClose={() => setDetailAbility(null)} />
            )}
            {confirmAbility && (
                <div role="dialog" aria-modal="true" style={{ ...modalStyle, maxWidth: 460, borderColor: el.color, zIndex: 12060 }}>
                    <h2 style={{ margin: 0, color: el.color, fontFamily: 'Cinzel, serif' }}>
                        Learn {confirmAbility.name}?
                    </h2>
                    <p style={{ color: '#ddd', lineHeight: 1.45 }}>
                        Are you sure you want to learn this ability? Abilities can be retrained given enough downtime.
                    </p>
                    <div style={actionsStyle}>
                        <button type="button" onClick={() => setConfirmAbility(null)} style={secondaryButtonStyle}>Cancel</button>
                        <button type="button" onClick={acceptOffer} style={{ ...primaryButtonStyle, background: el.color }}>
                            Confirm Choice
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

function BacklashSummary({ pact }) {
    return (
        <div style={{ marginTop: 12, display: 'grid', gap: 6 }}>
            {BACKLASH_TIERS.map(tier => {
                const tierData = pact.backlash?.[tier] || {};
                return (
                    <div key={tier} style={{ borderLeft: `2px solid ${BACKLASH_COLORS[tier]}`, paddingLeft: 8 }}>
                        <div style={{ color: BACKLASH_COLORS[tier], fontSize: '0.78em', fontWeight: 700 }}>
                            {BACKLASH_LABELS[tier]}
                        </div>
                        <div style={{ color: '#aaa', fontSize: '0.78em' }}>
                            {(tierData.effects || []).map(effect => `${effect.conditionName}${effect.value ? ` ${effect.value}` : ''}`).join(', ') || 'Narrative backlash'}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

function DeviantAbilityDetailModal({ ability, pact, onClose }) {
    const el = ELEMENTS[pact.element] || ELEMENTS.Fire;
    return (
        <div role="dialog" aria-modal="true" style={{ ...modalStyle, maxWidth: 620, borderColor: el.color, zIndex: 12050 }}>
            <h2 style={{ margin: 0, color: el.color, fontFamily: 'Cinzel, serif' }}>{ability.name}</h2>
            <div style={{ color: '#888', fontSize: '0.85em', marginBottom: 12 }}>
                Deviant Ability - Level {ability.level} - {pact.name}
            </div>
            {ability.description && (
                <div style={richTextStyle} dangerouslySetInnerHTML={{ __html: ability.description }} />
            )}
            {[1, 2].map(index => {
                const awakening = ability[`awakening${index}`];
                if (!awakening?.name && !awakening?.description) return null;
                return (
                    <section key={index} style={awakeningStyle}>
                        <h3 style={{ margin: '0 0 6px', color: '#81c784', fontSize: '0.98em' }}>
                            Awakening {index}: {awakening.name || 'Unnamed'}
                        </h3>
                        {awakening.levelNote && <div style={{ color: '#777', fontSize: '0.8em', marginBottom: 6 }}>{awakening.levelNote}</div>}
                        {awakening.description && <div style={richTextStyle} dangerouslySetInnerHTML={{ __html: awakening.description }} />}
                    </section>
                );
            })}
            <div style={{ marginTop: 12, color: '#ef9a9a', fontSize: '0.82em' }}>
                Backlash risk is governed by {pact.name}.
            </div>
            <div style={actionsStyle}>
                <button type="button" onClick={onClose} style={secondaryButtonStyle}>Close</button>
            </div>
        </div>
    );
}

const overlayStyle = {
    position: 'fixed',
    inset: 0,
    zIndex: 12000,
    background: 'rgba(0,0,0,0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
};

const modalStyle = {
    width: 'min(560px, 100%)',
    maxHeight: '90vh',
    overflowY: 'auto',
    background: '#202020',
    border: '1px solid #c5a059',
    borderRadius: 8,
    boxShadow: '0 20px 54px rgba(0,0,0,0.6)',
    color: '#eee',
    padding: 18,
};

const detailsStyle = {
    background: '#171717',
    border: '1px solid #333',
    borderRadius: 6,
    padding: 12,
};

const actionsStyle = {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 16,
};

const primaryButtonStyle = {
    border: 0,
    borderRadius: 5,
    color: '#111',
    fontWeight: 700,
    padding: '9px 13px',
};

const secondaryButtonStyle = {
    border: '1px solid #555',
    borderRadius: 5,
    color: '#ddd',
    background: '#333',
    padding: '9px 13px',
    cursor: 'pointer',
};

const abilityButtonStyle = {
    border: '1px solid #333',
    borderRadius: 6,
    color: '#ddd',
    padding: '10px 12px',
    textAlign: 'left',
    display: 'flex',
    flexDirection: 'column',
    gap: 3,
};

const richTextStyle = {
    color: '#ccc',
    lineHeight: 1.5,
    fontSize: '0.88em',
};

const awakeningStyle = {
    marginTop: 12,
    background: '#151b15',
    border: '1px solid #2f4a2f',
    borderRadius: 6,
    padding: 10,
};
