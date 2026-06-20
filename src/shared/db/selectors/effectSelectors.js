export function selectActorEffects(campaign, actorId) {
    if (!actorId) return [];
    return (campaign?.actorEffects || []).filter(effect => effect.targetActorId === actorId && !effect.disabled);
}

export function selectConditionEffects(campaign, actorId) {
    return selectActorEffects(campaign, actorId).filter(effect => effect.category === "condition");
}

export function selectEffectTemplates(campaign) {
    return Array.isArray(campaign?.effectTemplates) ? campaign.effectTemplates : [];
}

export function selectVisibleEffectTemplates(campaign) {
    return selectEffectTemplates(campaign).filter(template => !template.hiddenFromPicker);
}
