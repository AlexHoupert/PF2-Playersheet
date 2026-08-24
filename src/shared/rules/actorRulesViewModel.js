import { selectActorEffects } from "../db/selectors/effectSelectors.js";
import { normalizeCharacterRuntimeShape } from "../db/domain/characterShape.js";
import { buildDerivedSourceEffects } from "./derivedSourceEffects.js";
import {
    buildStandardConditionModifiers,
    buildStandardConditionRuleTree,
} from "./conditionEffectRules.js";
import { resolveEffectModifiers } from "./effectResolver.js";
import { actorToCharacterRuntimeView } from "../actors/actorRuntimeFields.js";

export function buildActorRulesContext({ actor, campaign = null, effects = null, catalog = null } = {}) {
    if (!actor) {
        return {
            actor: null,
            campaign,
            effects: [],
            conditions: [],
        };
    }

    const actorId = actor.id;
    const persistedEffects = (Array.isArray(effects)
        ? effects
        : selectActorEffects(campaign, actorId))
        .map(normalizeEffectInput)
        .filter(Boolean);
    const derivedEffects = buildDerivedSourceEffects({
        actor,
        campaign,
        catalog,
        persistedEffects,
    });
    const resolvedEffects = [...persistedEffects, ...derivedEffects];
    const conditions = effectsToConditionViewModels(resolvedEffects);

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
    const baseCharacter = toRulesCharacter(actor);
    const hpMaxEffects = effects.filter(effect => !isDrainedCondition(effect));
    const hpMaxResolution = resolveEffectModifiers(hpMaxEffects, "hp.max");
    const baseMaxHp = Math.max(1, Number(baseCharacter.stats?.hp?.max) || 1);
    const resolvedMaxHp = hpMaxResolution.set == null
        ? baseMaxHp + hpMaxResolution.total
        : hpMaxResolution.set;
    const character = {
        ...baseCharacter,
        stats: {
            ...(baseCharacter.stats || {}),
            hp: {
                ...(baseCharacter.stats?.hp || {}),
                max: Math.max(1, resolvedMaxHp),
            },
        },
        actorEffects: effects,
    };

    return {
        actor,
        character,
        effects,
        conditions,
        breakdown: {
            hpMax: {
                base: baseMaxHp,
                modifier: hpMaxResolution.total,
                set: hpMaxResolution.set,
                effective: character.stats.hp.max,
                applied: hpMaxResolution.applied,
            },
        },
    };
}

function isDrainedCondition(effect) {
    return effect?.category === "condition"
        && String(effect?.label || effect?.name || "").trim().toLowerCase() === "drained";
}

function toRulesCharacter(actor) {
    return normalizeCharacterRuntimeShape(actorToCharacterRuntimeView(actor));
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
    const category = effect.category || "condition";
    const rawValue = effect.value ?? effect.level;
    const value = rawValue && typeof rawValue === "object"
        ? rawValue
        : Number.isFinite(Number(rawValue)) ? Number(rawValue) : 1;
    const canonicalConditionModifiers = category === "condition"
        ? buildStandardConditionModifiers(label, value)
        : [];
    const modifiers = canonicalConditionModifiers.length > 0
        ? canonicalConditionModifiers
        : Array.isArray(effect.modifiers) && effect.modifiers.length > 0
            ? effect.modifiers
            : [];
    return {
        ...effect,
        label,
        category,
        value,
        modifiers,
        ruleTree: category === "condition"
            ? buildStandardConditionRuleTree(label, value)
            : effect.ruleTree || null,
    };
}
