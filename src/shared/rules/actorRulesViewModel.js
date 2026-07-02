import { selectActorEffects, selectConditionViewModels } from "../db/selectors/effectSelectors.js";
import { normalizeCharacterRuntimeShape } from "../db/domain/characterShape.js";

export function buildActorRulesContext({ actor, campaign = null, effects = null } = {}) {
    if (!actor) {
        return {
            actor: null,
            campaign,
            effects: [],
            conditions: [],
        };
    }

    const actorId = actor.id;
    const resolvedEffects = Array.isArray(effects)
        ? effects.map(normalizeEffectInput).filter(Boolean)
        : selectActorEffects(campaign, actorId);
    const conditions = Array.isArray(effects)
        ? effectsToConditionViewModels(effects)
        : selectConditionViewModels(campaign, actorId);

    return {
        actor,
        campaign,
        effects: resolvedEffects,
        conditions,
    };
}

export function buildActorStatsViewModel(context = {}) {
    const actor = context.actor || null;
    if (!actor) {
        return {
            actor: null,
            character: null,
            effects: [],
            conditions: [],
        };
    }

    const effects = Array.isArray(context.effects) ? context.effects : [];
    const conditions = Array.isArray(context.conditions) ? context.conditions : [];
    const character = {
        ...toRulesCharacter(actor),
        actorEffects: effects,
    };

    return {
        actor,
        character,
        effects,
        conditions,
    };
}

function toRulesCharacter(actor) {
    const sheet = actor?.sheet || {};
    return normalizeCharacterRuntimeShape({
        ...actor,
        ...sheet,
        id: sheet.id || sheet.legacyCharacterId || actor?.id,
        name: sheet.name || actor?.name,
        level: sheet.level ?? actor?.level,
        stats: sheet.stats || actor?.stats || {},
        skills: sheet.skills || actor?.skills || {},
        inventory: sheet.inventory || actor?.inventory || [],
        magic: sheet.magic || actor?.magic || { slots: {}, list: [] },
        formulaBook: sheet.formulaBook || actor?.formulaBook || [],
        languages: sheet.languages || actor?.languages || [],
        senses: sheet.senses || actor?.senses || [],
        proficiencies: sheet.proficiencies || actor?.proficiencies || {},
        gold: sheet.gold ?? actor?.gold ?? 0,
        xp: sheet.xp || actor?.xp || { current: 0, max: 1000 },
    });
}

export function selectActorRulesViewModel(campaign, actorId) {
    if (!campaign || !actorId) return buildActorStatsViewModel();
    const actor = (campaign.actors || []).find(candidate => candidate.id === actorId) || null;
    return buildActorStatsViewModel(buildActorRulesContext({ actor, campaign }));
}

function effectsToConditionViewModels(effects = []) {
    return effects
        .filter(effect => effect?.category === "condition" || (!effect?.category && (effect?.name || effect?.label)))
        .map(effect => ({
            id: effect.id,
            sourceEffectId: effect.id,
            name: effect.label || effect.name,
            level: Number.isFinite(Number(effect.value)) ? Number(effect.value) : 1,
            hidden: effect.hidden || undefined,
            disabled: effect.disabled || undefined,
            modifiers: Array.isArray(effect.modifiers) ? effect.modifiers : undefined,
        }));
}

function normalizeEffectInput(effect) {
    if (!effect) return null;
    const label = effect.label || effect.name;
    return {
        ...effect,
        label,
        category: effect.category || "condition",
        value: Number.isFinite(Number(effect.value ?? effect.level)) ? Number(effect.value ?? effect.level) : 1,
    };
}
