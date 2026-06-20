export function selectActorEffects(campaign, actorId) {
    if (!actorId) return [];
    return (campaign?.actorEffects || []).filter(effect => effect.targetActorId === actorId && !effect.disabled);
}

export function selectConditionEffects(campaign, actorId) {
    return selectActorEffects(campaign, actorId).filter(effect => effect.category === "condition");
}

export function selectConditionViewModels(campaign, actorId) {
    return selectConditionEffects(campaign, actorId).map(effect => ({
        id: effect.id,
        sourceEffectId: effect.id,
        name: effect.label || effect.name,
        level: Number.isFinite(Number(effect.value)) ? Number(effect.value) : 1,
        hidden: effect.hidden || undefined,
        disabled: effect.disabled || undefined,
    }));
}

export function selectEffectTemplates(campaign) {
    return Array.isArray(campaign?.effectTemplates) ? campaign.effectTemplates : [];
}

export function selectVisibleEffectTemplates(campaign) {
    return selectEffectTemplates(campaign).filter(template => !template.hiddenFromPicker);
}
