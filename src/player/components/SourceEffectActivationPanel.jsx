import { useMemo, useState } from 'react';

import { useCampaign } from '../../shared/context/CampaignContext';
import { useAppFeedback } from '../../shared/feedback/AppFeedback';
import { selectSourceEffectDefinitions } from '../../shared/rules/derivedSourceEffects';

export default function SourceEffectActivationPanel({ source }) {
    const { activeCampaign, actors, capabilities, dataActions, myActor } = useCampaign();
    const { notifyError, notifySuccess } = useAppFeedback();
    const sourceType = inferSourceType(source);
    const definitions = useMemo(
        () => selectSourceEffectDefinitions(sourceType, source).filter(definition => definition.enabled && definition.activation.mode === 'usable'),
        [source, sourceType]
    );
    const [selectedDefinitionId, setSelectedDefinitionId] = useState(definitions[0]?.id || '');
    const [selectedTargetIds, setSelectedTargetIds] = useState([]);
    const [busy, setBusy] = useState(false);

    const definition = definitions.find(item => item.id === selectedDefinitionId) || definitions[0];
    const actorTargets = useMemo(() => (actors || []).filter(actor =>
        !actor.deletedAt && definition?.targeting?.allowedActorKinds?.includes(actor.kind || 'pc')
    ), [actors, definition]);
    const creatureTargets = useMemo(() => {
        const encounter = (activeCampaign?.encounters || []).find(item => item.isActive && !item.deletedAt);
        return (encounter?.combatants || []).filter(combatant => combatant.type === 'creature' && !combatant.defeatedAt).map(combatant => ({
            id: combatant.effectTargetId,
            name: `${combatant.name}${combatant.instanceLabel > 1 ? ` ${combatant.instanceLabel}` : ''}`,
            targetActorId: combatant.effectTargetId,
            targetType: 'combatant',
            actorKind: 'npc',
            encounterId: encounter.id,
            combatantId: combatant.id,
        }));
    }, [activeCampaign]);

    if (!definitions.length || !myActor || !capabilities.canApplyEffects) return null;

    const isSelfOnly = definition?.targeting?.mode === 'self';
    const effectiveTargetIds = isSelfOnly ? [myActor.id] : selectedTargetIds;
    const selectedActors = actorTargets.filter(target => effectiveTargetIds.includes(target.id));
    const selectedCreatures = creatureTargets.filter(target => effectiveTargetIds.includes(target.id));

    const apply = async () => {
        if (!definition || !effectiveTargetIds.length) return notifyError('Choose at least one target.');
        if (selectedActors.length && selectedCreatures.length) {
            return notifyError('Apply an activation either to Actors or to Encounter creatures, not both at once.');
        }
        setBusy(true);
        try {
            if (selectedCreatures.length) {
                await dataActions.effect.createEffectRequest(activeCampaign.id, myActor.id, selectedCreatures, source, definition, { sourceType });
                notifySuccess('Effect request sent to the GM. The activation cost will be paid after approval.');
            } else {
                await dataActions.effect.applySourceEffect(activeCampaign.id, myActor.id, selectedActors.map(target => target.id), source, definition, { sourceType });
                notifySuccess(`${definition.label} applied.`);
            }
        } catch (error) {
            notifyError(error);
        } finally {
            setBusy(false);
        }
    };

    return (
        <section className="mt-4 border-t border-border pt-3" aria-label="Source effects">
            <div className="mb-2 flex items-center justify-between gap-3">
                <strong className="text-primary">Apply Actor Effect</strong>
                {definitions.length > 1 && (
                    <select className="modal-input max-w-[15rem]" value={definition.id} onChange={event => {
                        setSelectedDefinitionId(event.target.value);
                        setSelectedTargetIds([]);
                    }}>
                        {definitions.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
                    </select>
                )}
            </div>
            <p className="mb-3 text-sm text-muted-foreground">{summarizeDefinition(definition)}</p>
            {!isSelfOnly && (
                <div className="mb-3 grid max-h-44 grid-cols-1 gap-1 overflow-auto rounded border border-border p-2 sm:grid-cols-2">
                    {[...actorTargets.map(target => ({ id: target.id, name: target.name, group: 'Party' })), ...creatureTargets.map(target => ({ ...target, group: 'Encounter - GM approval' }))].map(target => (
                        <label key={target.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 hover:bg-white/5">
                            <input
                                type="checkbox"
                                checked={selectedTargetIds.includes(target.id)}
                                onChange={() => setSelectedTargetIds(current => toggleTarget(current, target.id, definition.targeting.mode))}
                            />
                            <span><strong>{target.name}</strong><small className="ml-2 text-muted-foreground">{target.group}</small></span>
                        </label>
                    ))}
                </div>
            )}
            <button type="button" className="set-btn w-full" disabled={busy || !effectiveTargetIds.length} onClick={apply}>
                {busy ? 'Applying...' : selectedCreatures.length ? 'Request GM Approval' : `Apply ${definition.label}`}
            </button>
        </section>
    );
}

function inferSourceType(source) {
    const raw = String(source?._entityType || source?.catalogType || source?.type || '').toLowerCase();
    if (raw.includes('spell')) return 'spell';
    if (raw.includes('feat')) return 'feat';
    if (raw.includes('impulse')) return 'impulse';
    return 'item';
}

function toggleTarget(current, targetId, mode) {
    if (current.includes(targetId)) return current.filter(id => id !== targetId);
    return mode === 'single' ? [targetId] : [...current, targetId];
}

function summarizeDefinition(definition) {
    if (!definition) return '';
    const duration = definition.duration.unit === 'daily_preparation' ? 'until Daily Preparation'
        : definition.duration.value ? `${definition.duration.value} ${definition.duration.unit}` : definition.duration.unit;
    return `${definition.activation.trigger}; ${duration}; ${definition.modifiers.length} modifier${definition.modifiers.length === 1 ? '' : 's'}.`;
}
