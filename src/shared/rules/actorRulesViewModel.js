import { selectActorEffects, selectConditionViewModels } from "../db/selectors/effectSelectors.js";
import { normalizeCharacterRuntimeShape } from "../db/domain/characterShape.js";
import { buildDerivedSourceEffects } from "./derivedSourceEffects.js";
import { resolveEffectModifiers } from "./effectResolver.js";

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
    const persistedEffects = Array.isArray(effects)
        ? effects.map(normalizeEffectInput).filter(Boolean)
        : selectActorEffects(campaign, actorId);
    const derivedEffects = buildDerivedSourceEffects({
        actor,
        campaign,
        catalog,
        persistedEffects,
    });
    const resolvedEffects = [...persistedEffects, ...derivedEffects];
    const conditions = Array.isArray(effects)
        ? effectsToConditionViewModels(resolvedEffects)
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
        feats: sheet.feats || actor?.feats || [],
        actions: sheet.actions || actor?.actions || [],
        impulses: sheet.impulses || actor?.impulses || [],
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
