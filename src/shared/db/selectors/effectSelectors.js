import {
    buildEffectPresentationItems,
    getEffectPresentationById,
} from '../../effects/effectPresentation.js';

export function selectActorEffects(campaign, actorId) {
    if (!actorId) return [];
    return (campaign?.actorEffects || []).filter(effect => effect.targetActorId === actorId && !effect.disabled);
}

export function selectConditionEffects(campaign, actorId) {
    return selectActorEffects(campaign, actorId).filter(effect => effect.category === "condition");
}

export function selectConditionViewModels(campaign, actorId) {
    return selectConditionEffects(campaign, actorId).map(effect => {
        const viewModel = {
            id: effect.id,
            sourceEffectId: effect.id,
            name: effect.label || effect.name,
            level: Number.isFinite(Number(effect.value)) ? Number(effect.value) : 1,
            hidden: effect.hidden || undefined,
            disabled: effect.disabled || undefined,
        };
        if (Array.isArray(effect.modifiers) && effect.modifiers.length > 0) viewModel.modifiers = effect.modifiers;
        return viewModel;
    });
}

export function getCombatantEffectTargetId(encounterId, combatant) {
    if (!combatant) return null;
    if (combatant.type === "player") return combatant.playerId || combatant.id || null;
    if (combatant.effectTargetId) return combatant.effectTargetId;
    if (!encounterId || !combatant.id) return null;
    return `encounter:${encounterId}:combatant:${combatant.id}`;
}

export function selectCombatantEffects(campaign, encounterId, combatant) {
    return selectActorEffects(campaign, getCombatantEffectTargetId(encounterId, combatant));
}

export function selectCombatantEffectBadges(campaign, encounterId, combatant) {
    return selectCombatantEffectPresentationItems(campaign, encounterId, combatant);
}

export function selectActorEffectPresentationItems(campaign, actorId, options = {}) {
    return buildEffectPresentationItems(selectActorEffects(campaign, actorId), options);
}

export function selectActorEffectPresentationById(campaign, actorId, effectId, options = {}) {
    return getEffectPresentationById(selectActorEffects(campaign, actorId), effectId, options);
}

export function selectCombatantEffectPresentationItems(campaign, encounterId, combatant, options = {}) {
    return buildEffectPresentationItems(selectCombatantEffects(campaign, encounterId, combatant), options);
}

export function selectEffectTemplates(campaign) {
    return Array.isArray(campaign?.effectTemplates) ? campaign.effectTemplates : [];
}

export function selectVisibleEffectTemplates(campaign) {
    return selectEffectTemplates(campaign).filter(template => !template.hiddenFromPicker);
}
