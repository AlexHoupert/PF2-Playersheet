import React, { useEffect, useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import AppDialogShell from '../../shared/components/dialogs/AppDialogShell';
import { getConditionImgSrc, getConditionCatalogEntry, isConditionValued } from '../../shared/constants/conditionsCatalog';
import { getConditionIcon, NEG_CONDS, POS_CONDS, VIS_CONDS } from '../../shared/constants/conditions';
import { parseFoundry } from '../../shared/utils/foundryParser';
import { useCampaign } from '../../shared/context/CampaignContext';
import { useAppFeedback } from '../../shared/feedback/AppFeedback';
import {
    createStandardConditionEffectInput,
    normalizeConditionValue,
} from '../../shared/rules/conditionEffectRules';
import './ConditionsModal.css';

const TABS = ['ACTIVE', 'NEGATIVE', 'POSITIVE', 'VISIBILITY'];
const NEGATIVE_GROUPS = [
    { title: 'Control & Positioning', items: ['off-guard', 'prone', 'grabbed', 'restrained', 'immobilized', 'stunned', 'paralyzed', 'petrified'] },
    { title: 'Lowered Abilities', items: ['frightened', 'clumsy', 'drained', 'enfeebled', 'stupefied', 'sickened', 'fatigued', 'encumbered', 'slowed'] },
    { title: 'Senses', items: ['blinded', 'dazzled', 'deafened'] },
    { title: 'Mental', items: ['confused', 'controlled', 'fascinated', 'fleeing'] },
    { title: 'Death and Injury', items: ['doomed', 'dying', 'unconscious', 'wounded'] },
];

export function ConditionsModal({
    character,
    effects = [],
    onClose,
    initialCondition = null,
    initialEffectId = null,
    onBack,
    onContentLinkClick,
    readOnly = false,
}) {
    const { activeCampaignId, dataActions } = useCampaign();
    const { notifyError } = useAppFeedback();
    const safeEffects = Array.isArray(effects) ? effects : [];
    const [activeTab, setActiveTab] = useState(safeEffects.length ? 'ACTIVE' : 'NEGATIVE');
    const [selectedEffectId, setSelectedEffectId] = useState(initialEffectId || null);
    const [selectedConditionName, setSelectedConditionName] = useState(null);
    const [query, setQuery] = useState('');

    useEffect(() => {
        if (initialEffectId) {
            setActiveTab('ACTIVE');
            setSelectedEffectId(initialEffectId);
            setSelectedConditionName(null);
            return;
        }
        if (initialCondition) {
            const effect = safeEffects.find((item) => String(item.name || '').toLowerCase() === String(initialCondition).toLowerCase());
            if (effect) {
                setActiveTab('ACTIVE');
                setSelectedEffectId(effect.id);
                setSelectedConditionName(null);
            } else {
                setSelectedEffectId(null);
                setSelectedConditionName(getConditionCatalogEntry(initialCondition)?.name || initialCondition);
            }
        }
    }, [initialCondition, initialEffectId, safeEffects]);

    const selectedEffect = safeEffects.find((effect) => effect.id === selectedEffectId)
        || buildConditionPreview(selectedConditionName);
    const visibleTabs = safeEffects.length ? TABS : TABS.filter((tab) => tab !== 'ACTIVE');
    const normalizedQuery = query.trim().toLowerCase();
    const activeEffects = useMemo(() => filterByQuery(safeEffects, normalizedQuery), [safeEffects, normalizedQuery]);
    const standardRows = useMemo(() => buildStandardRows(activeTab, normalizedQuery), [activeTab, normalizedQuery]);

    const findStandardEffect = (conditionName) => safeEffects.find((effect) => (
        effect.category === 'condition'
        && String(effect.name || '').toLowerCase() === String(conditionName).toLowerCase()
    ));

    const runEffectAction = (action) => {
        Promise.resolve(action).catch((error) => {
            console.error(error);
            notifyError(error);
        });
    };

    const adjustStandardCondition = (conditionName, delta) => {
        if (readOnly || !activeCampaignId || !character?.id || !dataActions?.effect) return;
        const canonicalName = getConditionCatalogEntry(conditionName)?.name || conditionName;
        const currentEffect = findStandardEffect(canonicalName);
        const valued = isConditionValued(canonicalName);
        const currentValue = Number(currentEffect?.value) || 0;
        const nextValue = valued ? currentValue + delta : (delta > 0 ? 1 : 0);

        if (nextValue <= 0) {
            if (currentEffect?.id) runEffectAction(dataActions.effect.deleteEffect(activeCampaignId, currentEffect.id));
            return;
        }

        const nextInput = createStandardConditionEffectInput(canonicalName, normalizeConditionValue(canonicalName, nextValue), {
            sourceType: currentEffect?.source?.type || 'manual',
            sourceId: currentEffect?.source?.id || null,
            sourceName: currentEffect?.source?.name || canonicalName,
            actorId: character.id,
        });
        const action = currentEffect?.id
            ? dataActions.effect.updateEffect(activeCampaignId, currentEffect.id, (effect) => ({ ...effect, ...nextInput, source: effect.source || nextInput.source }))
            : dataActions.effect.createStandardCondition(activeCampaignId, character.id, canonicalName, nextInput.value, {
                sourceType: nextInput.source.type,
                sourceId: nextInput.source.id,
                sourceName: nextInput.source.name,
                actorId: character.id,
            });
        runEffectAction(action);

        if (String(canonicalName).toLowerCase() === 'drained' && delta > 0 && dataActions.character?.adjustHp) {
            runEffectAction(dataActions.character.adjustHp(activeCampaignId, character.id, -((character.level || 1) * delta)));
        }
    };

    const removeEffect = (effect) => {
        if (readOnly || !effect?.id || !activeCampaignId || !dataActions?.effect) return;
        runEffectAction(dataActions.effect.deleteEffect(activeCampaignId, effect.id));
        setSelectedEffectId(null);
        setSelectedConditionName(null);
        setActiveTab('ACTIVE');
    };

    const returnToList = () => {
        if ((initialEffectId || initialCondition) && onBack) onBack();
        else {
            setSelectedEffectId(null);
            setSelectedConditionName(null);
        }
    };

    const renderDetail = () => {
        const isStandardCondition = selectedEffect.category === 'condition';
        const image = isStandardCondition ? getConditionImgSrc(selectedEffect.name) : null;
        return (
            <>
                <div className="conditions-modal__detail-controls">
                    {image ? <img src={image} alt="" /> : <span className="conditions-modal__effect-icon">{getEffectIcon(selectedEffect)}</span>}
                    {isStandardCondition && selectedEffect.canModifyValue && !readOnly && (
                        <div className="conditions-modal__value-controls">
                            <button type="button" data-testid={`condition-detail-decrease-${toConditionSlug(selectedEffect.name)}`} onClick={() => adjustStandardCondition(selectedEffect.name, -1)}>-</button>
                            <strong>{selectedEffect.value}</strong>
                            <button type="button" data-testid={`condition-detail-increase-${toConditionSlug(selectedEffect.name)}`} onClick={() => adjustStandardCondition(selectedEffect.name, 1)}>+</button>
                        </div>
                    )}
                    {!readOnly && selectedEffect.id && (
                        <button type="button" className="conditions-modal__remove" onClick={() => removeEffect(selectedEffect)}>Remove</button>
                    )}
                </div>
                <div
                    className="conditions-modal__description formatted-content"
                    onClick={onContentLinkClick}
                    dangerouslySetInnerHTML={{ __html: parseFoundry(selectedEffect.description, { actor: character }) }}
                />
            </>
        );
    };

    const renderStandardRow = (conditionName) => {
        const entry = getConditionCatalogEntry(conditionName);
        const active = findStandardEffect(conditionName);
        const valued = isConditionValued(conditionName);
        const value = Number(active?.value) || 0;
        const image = getConditionImgSrc(conditionName);
        return (
            <div className="conditions-modal__row" key={conditionName}>
                <button type="button" className="conditions-modal__row-main" onClick={() => {
                    if (active?.id) setSelectedEffectId(active.id);
                    else setSelectedConditionName(entry?.name || conditionName);
                }}>
                    {image ? <img src={image} alt="" /> : <span>{getConditionIcon(conditionName) || 'O'}</span>}
                    <span className={active ? 'conditions-modal__row-name--active' : ''}>{entry?.name || conditionName}</span>
                </button>
                {!readOnly && (
                    <div className="conditions-modal__row-actions">
                        <button type="button" aria-label={`Decrease ${conditionName}`} onClick={() => adjustStandardCondition(conditionName, -1)}>-</button>
                        <span>{valued ? value : (active ? 1 : 0)}</span>
                        <button type="button" aria-label={`Increase ${conditionName}`} onClick={() => adjustStandardCondition(conditionName, 1)}>+</button>
                    </div>
                )}
            </div>
        );
    };

    const renderList = () => {
        const active = activeTab === 'ACTIVE';
        return (
            <>
                <div className="conditions-modal__tabs" role="tablist" aria-label="Condition categories">
                    {visibleTabs.map((tab) => (
                        <button key={tab} type="button" role="tab" aria-selected={activeTab === tab} className={activeTab === tab ? 'is-active' : ''} onClick={() => setActiveTab(tab)}>{tab}</button>
                    ))}
                </div>
                <Input className="conditions-modal__search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search conditions..." aria-label="Search conditions" />
                <div className="conditions-modal__list">
                    {active ? (
                        activeEffects.length
                            ? activeEffects.map((effect) => (
                                <button type="button" key={effect.id} className={`conditions-modal__active-effect conditions-modal__active-effect--${effect.variant}`} onClick={() => setSelectedEffectId(effect.id)}>
                                    <span>{getEffectIcon(effect)}</span><span>{effect.label}</span>
                                </button>
                            ))
                            : <p className="conditions-modal__empty">No active conditions found.</p>
                    ) : standardRows.map((row) => (
                        row.type === 'group'
                            ? <div className="conditions-modal__group" key={row.title}>{row.title}</div>
                            : renderStandardRow(row.name)
                    ))}
                </div>
            </>
        );
    };

    return (
        <AppDialogShell
            open
            onOpenChange={(open) => { if (!open) onClose?.(); }}
            layerId="conditions-dialog"
            title={selectedEffect?.label || 'Conditions'}
            description={selectedEffect ? 'Condition and effect details' : 'Manage active conditions and effects'}
            backAction={selectedEffect ? { label: 'Back to conditions', onClick: returnToList } : null}
            size="md"
            bodyClassName="overflow-hidden p-0"
        >
            <div className="conditions-modal__content">{selectedEffect ? renderDetail() : renderList()}</div>
        </AppDialogShell>
    );
}

function buildStandardRows(tab, query) {
    const matches = (name) => !query || String(getConditionCatalogEntry(name)?.name || name).toLowerCase().includes(query);
    if (tab === 'NEGATIVE') {
        return NEGATIVE_GROUPS.flatMap((group) => {
            const items = group.items.filter(matches);
            return items.length ? [{ type: 'group', title: group.title }, ...items.map((name) => ({ type: 'condition', name }))] : [];
        });
    }
    const names = tab === 'POSITIVE' ? POS_CONDS : VIS_CONDS;
    return names.filter(matches).sort((left, right) => String(left).localeCompare(String(right))).map((name) => ({ type: 'condition', name }));
}

function buildConditionPreview(conditionName) {
    if (!conditionName) return null;
    const entry = getConditionCatalogEntry(conditionName);
    const name = entry?.name || conditionName;
    return {
        id: null,
        name,
        label: name,
        category: 'condition',
        value: 0,
        canModifyValue: isConditionValued(name),
        description: entry?.description || 'No condition description is available.',
    };
}

function filterByQuery(effects, query) {
    if (!query) return effects;
    return effects.filter((effect) => `${effect.label} ${effect.name}`.toLowerCase().includes(query));
}

function getEffectIcon(effect) {
    if (effect.category === 'damage_effect') return 'FIRE';
    if (effect.category === 'affliction') return 'AFF';
    if (effect.category === 'custom') return 'NOTE';
    return getConditionIcon(effect.name) || 'O';
}

function toConditionSlug(value) {
    return String(value || 'condition').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
