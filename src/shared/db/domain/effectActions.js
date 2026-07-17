import {
  applyActorEffectUpdate,
  createActorEffectRecord,
} from "./actorReducers.js";
import { cloneValue } from "./inventoryReducers.js";
import {
  createCustomBadgeEffectInput,
  createPersistentDamageEffectInput,
  createStandardConditionEffectInput,
} from "../../rules/conditionEffectRules.js";
import {
  advanceEffectDuration,
  applyEffectOnApplyActions,
  isDailyPreparationEffect,
  materializeEffectDefinition,
  validateEffectDefinition,
} from "../../rules/effectDefinitions.js";
import { findInventoryItemIndex } from "./inventoryReducers.js";

export function createEffectActions(context) {
  const {
    actor,
    capabilities,
    createDomainId,
    db,
    firestore,
    repos,
    updateCampaignLegacy,
    useFirestoreV2,
  } = context;

  const createEffect = (campaignId, targetActorId, effectInput) => {
    const effectRecord = createActorEffectRecord(effectInput, {
      createId: () => createDomainId("effect"),
      campaignId,
      targetActorId,
    });
    if (useFirestoreV2) {
      return repos.effectRepo.createEffect(firestore, campaignId, effectRecord).then(() => effectRecord.id);
    }
    return updateCampaignLegacy(campaignId, (campaign) => {
      const next = cloneValue(campaign);
      next.actorEffects = Array.isArray(next.actorEffects) ? [...next.actorEffects, effectRecord] : [effectRecord];
      return next;
    }).then(() => effectRecord.id);
  };

  const updateEffect = (campaignId, effectId, updater) => {
    if (useFirestoreV2) {
      return repos.effectRepo.updateEffect(firestore, campaignId, effectId, (effectDoc) =>
        applyActorEffectUpdate({ ...effectDoc, id: effectDoc.id || effectId, campaignId }, updater, {
          createId: () => createDomainId("effect"),
          campaignId,
          targetActorId: effectDoc.targetActorId,
        })
      );
    }
    return updateCampaignLegacy(campaignId, (campaign) => {
      const next = cloneValue(campaign);
      next.actorEffects = Array.isArray(next.actorEffects) ? next.actorEffects.map((item) => cloneValue(item)) : [];
      const index = next.actorEffects.findIndex((item) => item.id === effectId);
      if (index < 0) return next;
      next.actorEffects[index] = applyActorEffectUpdate(next.actorEffects[index], updater, {
        createId: () => createDomainId("effect"),
        campaignId,
        targetActorId: next.actorEffects[index].targetActorId,
      });
      return next;
    });
  };

  const deleteEffect = (campaignId, effectId) => {
    if (useFirestoreV2) {
      return repos.effectRepo.deleteEffect(firestore, campaignId, effectId);
    }
    return updateCampaignLegacy(campaignId, (campaign) => {
      const next = cloneValue(campaign);
      next.actorEffects = (next.actorEffects || []).filter((effectDoc) => effectDoc.id !== effectId);
      return next;
    });
  };

  const createStandardCondition = (campaignId, targetActorId, conditionName, value = 1, options = {}) =>
    createEffect(campaignId, targetActorId, {
      ...createStandardConditionEffectInput(conditionName, value, {
      ...options,
      actorId: options.actorId || targetActorId,
      }),
      hidden: Boolean(options.hidden),
    });

  const createPersistentDamage = (campaignId, targetActorId, payload = {}, options = {}) =>
    createEffect(campaignId, targetActorId, {
      ...createPersistentDamageEffectInput(payload, {
      ...options,
      actorId: options.actorId || targetActorId,
      }),
      hidden: Boolean(options.hidden),
    });

  const createCustomBadge = (campaignId, targetActorId, label, options = {}) =>
    createEffect(campaignId, targetActorId, {
      ...createCustomBadgeEffectInput(label, {
      ...options,
      actorId: options.actorId || targetActorId,
      }),
      hidden: Boolean(options.hidden),
    });

  const saveEffectTemplate = (campaignId, templateInput) => {
    const template = {
      ...cloneValue(templateInput || {}),
      id: templateInput?.id || createDomainId("effect_template"),
    };
    if (useFirestoreV2) {
      return repos.effectRepo.setEffectTemplate(firestore, campaignId, template).then(() => template.id);
    }
    return updateCampaignLegacy(campaignId, (campaign) => {
      const next = cloneValue(campaign);
      next.effectTemplates = Array.isArray(next.effectTemplates) ? [...next.effectTemplates] : [];
      const index = next.effectTemplates.findIndex((item) => item.id === template.id);
      if (index >= 0) next.effectTemplates[index] = template;
      else next.effectTemplates.push(template);
      return next;
    }).then(() => template.id);
  };

  const deleteEffectTemplate = (campaignId, templateId) => {
    if (useFirestoreV2) {
      return repos.effectRepo.deleteEffectTemplate(firestore, campaignId, templateId);
    }
    return updateCampaignLegacy(campaignId, (campaign) => {
      const next = cloneValue(campaign);
      next.effectTemplates = (next.effectTemplates || []).filter((template) => template.id !== templateId);
      return next;
    });
  };

  const applySourceEffect = async (campaignId, sourceActorId, targetActorIds, source, definitionInput, options = {}) => {
    if (!capabilities.canApplyEffects) throw new Error("Your campaign role cannot apply effects");
    const validation = validateEffectDefinition(definitionInput);
    if (!validation.valid) throw new Error(validation.errors.join("; "));
    const definition = validation.definition;
    if (definition.activation.mode !== "usable") throw new Error("Passive effects are derived and cannot be activated");
    const uniqueTargetIds = [...new Set((Array.isArray(targetActorIds) ? targetActorIds : [targetActorIds]).filter(Boolean))];
    if (!uniqueTargetIds.length) throw new Error("Choose at least one actor target");
    const actorIds = [...new Set([sourceActorId, ...uniqueTargetIds].filter(Boolean))];
    const timestamp = new Date().toISOString();
    const existingEffects = selectCampaignEffects(db, campaignId);

    const resolveActivation = actorsById => buildSourceActivation({
      actorsById,
      campaignId,
      createDomainId,
      definition,
      options: { ...options, actorEmail: options.actorEmail || actor, effects: existingEffects, timestamp },
      source,
      sourceActorId,
      targetActorIds: uniqueTargetIds,
    });

    if (useFirestoreV2) {
      await repos.effectRepo.applySourceActivation(firestore, campaignId, actorIds, resolveActivation);
      return;
    }
    return updateCampaignLegacy(campaignId, campaign => {
      const next = cloneValue(campaign);
      const actors = Array.isArray(next.actors) ? next.actors : [];
      const actorsById = Object.fromEntries(actors.map(actor => [actor.id, actor]));
      const result = resolveActivation(actorsById);
      next.actors = actors.map(actor => result.actorsById[actor.id] || actor);
      next.actorEffects = (next.actorEffects || [])
        .filter(effect => !(result.deleteEffectIds || []).includes(effect.id));
      for (const effect of result.effects || []) {
        const index = next.actorEffects.findIndex(item => item.id === effect.id);
        if (index >= 0) next.actorEffects[index] = effect;
        else next.actorEffects.push(effect);
      }
      return next;
    });
  };

  const removeSourceEffect = async (campaignId, targetActorId, sourceId, definitionId = null) => {
    const effects = selectCampaignEffects(db, campaignId).filter(effect =>
      effect.targetActorId === targetActorId
      && String(effect.source?.id || "") === String(sourceId || "")
      && (!definitionId || effect.definitionSnapshot?.id === definitionId)
    );
    await Promise.all(effects.map(effect => deleteEffect(campaignId, effect.id)));
  };

  const advanceDuration = async (campaignId, targetActorId, options = {}) => {
    const effects = selectCampaignEffects(db, campaignId).filter(effect => effect.targetActorId === targetActorId);
    if (!effects.length) return;
    const effectIds = effects.map(effect => effect.id);
    const resolve = (actorDoc, currentEffectsById = {}) => {
      const nextEffects = [];
      const deleteEffectIds = [];
      effects.forEach(selectedEffect => {
        const effect = currentEffectsById[selectedEffect.id] || selectedEffect;
        if (!effect) return;
        const result = advanceEffectDuration(effect, options);
        if (result.expired) deleteEffectIds.push(effect.id);
        else if (result.changed) nextEffects.push(result.effect);
      });
      return { actor: actorDoc, effects: nextEffects, deleteEffectIds };
    };
    if (useFirestoreV2) {
      return repos.effectRepo.updateActorAndEffects(firestore, campaignId, targetActorId, effectIds, resolve);
    }
    return updateCampaignLegacy(campaignId, campaign => {
      const next = cloneValue(campaign);
      next.actorEffects = (next.actorEffects || []).flatMap(effect => {
        if (effect.targetActorId !== targetActorId) return [effect];
        const result = advanceEffectDuration(effect, options);
        return result.expired ? [] : [result.effect];
      });
      return next;
    });
  };

  const performDailyPreparation = async (campaignId, actorId, actorUpdater = actor => actor) => {
    const effects = selectCampaignEffects(db, campaignId).filter(effect =>
      effect.targetActorId === actorId && isDailyPreparationEffect(effect)
    );
    const effectIds = effects.map(effect => effect.id);
    if (useFirestoreV2) {
      return repos.effectRepo.updateActorAndEffects(firestore, campaignId, actorId, effectIds, actorDoc => ({
        actor: actorUpdater(cloneValue(actorDoc)),
        effects: [],
        deleteEffectIds: effectIds,
      }));
    }
    return updateCampaignLegacy(campaignId, campaign => {
      const next = cloneValue(campaign);
      next.actors = (next.actors || []).map(actor => actor.id === actorId ? actorUpdater(actor) : actor);
      next.actorEffects = (next.actorEffects || []).filter(effect => !effectIds.includes(effect.id));
      return next;
    });
  };

  const createEffectRequest = async (campaignId, sourceActorId, targets, source, definitionInput, options = {}) => {
    if (!capabilities.canApplyEffects) throw new Error("Your campaign role cannot apply effects");
    const validation = validateEffectDefinition(definitionInput);
    if (!validation.valid) throw new Error(validation.errors.join("; "));
    if (validation.definition.activation.mode !== "usable") throw new Error("Passive effects cannot be requested");
    const normalizedTargets = normalizeEffectRequestTargets(targets);
    if (!normalizedTargets.length) throw new Error("Choose at least one creature target");
    const activationKey = options.activationKey || createEffectRequestActivationKey(sourceActorId, source, validation.definition, normalizedTargets);
    const timestamp = new Date().toISOString();
    const request = {
      id: `effect_request_${activationKey}`,
      campaignId,
      status: "pending",
      activationKey,
      sourceActorId,
      source: cloneValue(source),
      definitionSnapshot: validation.definition,
      targets: normalizedTargets,
      hidden: Boolean(options.hidden),
      createdAt: timestamp,
      createdBy: actor,
      requestedBy: actor,
      createdByRole: capabilities.role,
    };
    if (useFirestoreV2) {
      await repos.effectRequestRepo.createRequest(firestore, campaignId, request);
      return request.id;
    }
    return updateCampaignLegacy(campaignId, campaign => {
      const next = cloneValue(campaign);
      const requests = Array.isArray(next.effectRequests) ? next.effectRequests : [];
      if (requests.some(item => item.id === request.id && item.status === "pending")) {
        throw new Error("This effect request is already pending");
      }
      next.effectRequests = [...requests.filter(item => item.id !== request.id), request];
      return next;
    }).then(() => request.id);
  };

  const rejectEffectRequest = async (campaignId, requestId) => {
    if (!capabilities.canDecideEffectRequests) throw new Error("Only a campaign GM can reject effect requests");
    const decision = { decidedAt: new Date().toISOString(), decidedBy: actor };
    if (useFirestoreV2) return repos.effectRequestRepo.rejectRequest(firestore, campaignId, requestId, decision);
    return updateCampaignLegacy(campaignId, campaign => updateLegacyEffectRequest(campaign, requestId, request => ({
      ...request,
      ...decision,
      status: "rejected",
    })));
  };

  const approveEffectRequest = async (campaignId, requestId) => {
    if (!capabilities.canDecideEffectRequests) throw new Error("Only a campaign GM can approve effect requests");
    const decide = (request, sourceActor) => buildApprovedEffectRequest({
      actorEmail: actor,
      campaignId,
      createDomainId,
      request,
      sourceActor,
    });
    if (useFirestoreV2) return repos.effectRequestRepo.approveRequest(firestore, campaignId, requestId, decide);
    return updateCampaignLegacy(campaignId, campaign => {
      const next = cloneValue(campaign);
      const request = (next.effectRequests || []).find(item => item.id === requestId);
      if (!request || request.status !== "pending") throw new Error("Effect request is no longer pending");
      const sourceActorIndex = (next.actors || []).findIndex(item => item.id === request.sourceActorId);
      if (sourceActorIndex < 0) throw new Error(`Source actor not found: ${request.sourceActorId}`);
      const result = decide(request, next.actors[sourceActorIndex]);
      next.actors[sourceActorIndex] = result.sourceActor;
      next.actorEffects = [...(next.actorEffects || []), ...(result.effects || [])];
      next.effectRequests = next.effectRequests.map(item => item.id === requestId ? {
        ...item,
        status: "approved",
        decidedAt: result.decidedAt,
        decidedBy: result.decidedBy,
        createdEffectIds: result.effects.map(effect => effect.id),
      } : item);
      return next;
    });
  };

  return {
    createEffect,
    createStandardCondition,
    createPersistentDamage,
    createCustomBadge,
    updateEffect,
    deleteEffect,
    saveEffectTemplate,
    deleteEffectTemplate,
    applySourceEffect,
    removeSourceEffect,
    advanceDuration,
    performDailyPreparation,
    createEffectRequest,
    approveEffectRequest,
    rejectEffectRequest,
  };
}

function buildSourceActivation({
  actorsById,
  campaignId,
  createDomainId,
  definition,
  options,
  source,
  sourceActorId,
  targetActorIds,
}) {
  const nextActors = Object.fromEntries(Object.entries(actorsById).map(([id, actor]) => [id, cloneValue(actor)]));
  if (!nextActors[sourceActorId]) throw new Error(`Source actor not found: ${sourceActorId}`);
  if (definition.activation.cost?.consumeSource) {
    nextActors[sourceActorId] = consumeInventorySource(
      nextActors[sourceActorId],
      source,
      definition.activation.cost.quantity
    );
  }

  const effects = [];
  const deleteEffectIds = [];
  for (const targetActorId of targetActorIds) {
    const targetActor = nextActors[targetActorId];
    if (!targetActor) throw new Error(`Target actor not found: ${targetActorId}`);
    if (!definition.targeting.allowedActorKinds.includes(targetActor.kind || "pc")) {
      throw new Error(`${targetActor.name || targetActorId} is not a valid target for this effect`);
    }
    const replaceableId = `source:${targetActorId}:${source?.instanceId || source?.id || source?._id || source?.name}:${definition.id}`;
    if (definition.activation.instancePolicy !== "stack" && definition.activation.stackingGroup) {
      (options.effects || []).filter(existing =>
        existing.targetActorId === targetActorId
        && existing.definitionSnapshot?.activation?.stackingGroup === definition.activation.stackingGroup
      ).forEach(existing => deleteEffectIds.push(existing.id));
    }
    const effect = materializeEffectDefinition(definition, {
      actor: targetActor,
      appliedBy: options.actorEmail,
      campaignId,
      effectId: definition.activation.instancePolicy === "stack" ? createDomainId("effect") : replaceableId,
      effects: options.effects || [],
      hidden: options.hidden,
      now: options.timestamp,
      source,
      sourceActorId,
      sourceType: options.sourceType || inferSourceType(source),
      targetActorId,
      activationKey: options.activationKey || null,
    });
    if (!effect) continue;
    const application = applyEffectOnApplyActions(targetActor, effect, { source });
    nextActors[targetActorId] = application.actor;
    application.removedTemplateIds.forEach(templateId => {
      (options.effects || []).filter(existing =>
        existing.targetActorId === targetActorId && existing.templateId === templateId
      ).forEach(existing => deleteEffectIds.push(existing.id));
    });
    effects.push(createActorEffectRecord({
      ...effect,
      createdAt: options.timestamp,
      createdBy: options.actorEmail || null,
    }, { campaignId, targetActorId, createId: () => createDomainId("effect") }));
    for (const additionalInput of application.additionalEffects) {
      effects.push(createActorEffectRecord({
        ...additionalInput,
        createdAt: options.timestamp,
        createdBy: options.actorEmail || null,
      }, { campaignId, targetActorId, createId: () => createDomainId("effect") }));
    }
  }
  return { actorsById: nextActors, effects, deleteEffectIds: [...new Set(deleteEffectIds)] };
}

function consumeInventorySource(actor, source, quantity) {
  const next = cloneValue(actor);
  const inventory = cloneValue(next.inventory || next.sheet?.inventory || []);
  const index = findInventoryItemIndex(inventory, source);
  if (index < 0) throw new Error(`Source item is no longer in ${next.name || "the actor"}'s inventory`);
  const current = inventory[index];
  const currentQuantity = readItemQuantity(current);
  if (currentQuantity < quantity) throw new Error(`Not enough ${current.name || "items"} remaining`);
  if (currentQuantity === quantity) inventory.splice(index, 1);
  else inventory[index] = writeItemQuantity(current, currentQuantity - quantity);
  next.inventory = inventory;
  next.sheet = { ...(next.sheet || {}), inventory };
  return next;
}

function readItemQuantity(item) {
  return Math.max(1, Number(item?.qty ?? item?.quantity ?? item?.system?.quantity ?? 1) || 1);
}

function writeItemQuantity(item, quantity) {
  const next = { ...item };
  if (Object.hasOwn(next, "qty")) next.qty = quantity;
  else if (Object.hasOwn(next, "quantity")) next.quantity = quantity;
  else if (next.system && Object.hasOwn(next.system, "quantity")) next.system = { ...next.system, quantity };
  else next.qty = quantity;
  return next;
}

function inferSourceType(source) {
  const type = String(source?.catalogType || source?.type || "item").toLowerCase();
  return ["item", "spell", "feat", "impulse"].includes(type) ? type : "item";
}

function normalizeEffectRequestTargets(targets) {
  const values = Array.isArray(targets) ? targets : [targets];
  const byId = new Map();
  for (const target of values) {
    const targetActorId = typeof target === "string" ? target : target?.targetActorId || target?.effectTargetId || target?.id;
    if (!targetActorId) continue;
    byId.set(String(targetActorId), {
      targetActorId: String(targetActorId),
      targetType: target?.targetType || "combatant",
      actorKind: target?.actorKind || "npc",
      name: target?.name || String(targetActorId),
      encounterId: target?.encounterId || null,
      combatantId: target?.combatantId || null,
    });
  }
  return [...byId.values()];
}

function createEffectRequestActivationKey(sourceActorId, source, definition, targets) {
  return [
    sourceActorId,
    source?.instanceId || source?.id || source?._id || source?.name,
    definition.id,
    ...targets.map(target => target.targetActorId).sort(),
  ].map(normalizeRequestKey).join("_");
}

function normalizeRequestKey(value) {
  return String(value || "unknown").toLowerCase().replace(/[^a-z0-9_-]+/g, "_").replace(/^_+|_+$/g, "");
}

function buildApprovedEffectRequest({ actorEmail, campaignId, createDomainId, request, sourceActor }) {
  if (request.status !== "pending") throw new Error("Effect request is no longer pending");
  const validation = validateEffectDefinition(request.definitionSnapshot);
  if (!validation.valid) throw new Error(validation.errors.join("; "));
  const definition = validation.definition;
  const timestamp = new Date().toISOString();
  let nextSourceActor = cloneValue(sourceActor);
  if (definition.activation.cost?.consumeSource) {
    nextSourceActor = consumeInventorySource(nextSourceActor, request.source, definition.activation.cost.quantity);
  }
  const effects = request.targets.map(target => {
    const effect = materializeEffectDefinition(definition, {
      actor: { id: target.targetActorId, kind: target.actorKind || "npc", name: target.name },
      appliedBy: actorEmail,
      campaignId,
      effectId: definition.activation.instancePolicy === "stack"
        ? createDomainId("effect")
        : `source:${target.targetActorId}:${request.source?.instanceId || request.source?.id || request.source?.name}:${definition.id}`,
      hidden: request.hidden,
      now: timestamp,
      source: request.source,
      sourceActorId: request.sourceActorId,
      sourceType: inferSourceType(request.source),
      targetActorId: target.targetActorId,
      activationKey: request.activationKey,
    });
    return createActorEffectRecord({
      ...effect,
      createdAt: timestamp,
      createdBy: request.createdBy,
      approvedAt: timestamp,
      approvedBy: actorEmail,
    }, { campaignId, targetActorId: target.targetActorId, createId: () => createDomainId("effect") });
  }).filter(Boolean);
  return { sourceActor: nextSourceActor, effects, decidedAt: timestamp, decidedBy: actorEmail };
}

function updateLegacyEffectRequest(campaign, requestId, updater) {
  const next = cloneValue(campaign);
  next.effectRequests = (next.effectRequests || []).map(request => request.id === requestId ? updater(request) : request);
  return next;
}

function selectCampaignEffects(db, campaignId) {
  if (Array.isArray(db?.campaigns)) {
    const campaign = db.campaigns.find(item => item.id === campaignId);
    if (Array.isArray(campaign?.actorEffects)) return campaign.actorEffects;
  }
  if (Array.isArray(db?.campaigns?.[campaignId]?.actorEffects)) return db.campaigns[campaignId].actorEffects;
  if (db?.activeCampaign?.id === campaignId && Array.isArray(db.activeCampaign.actorEffects)) {
    return db.activeCampaign.actorEffects;
  }
  return Array.isArray(db?.actorEffects) ? db.actorEffects : [];
}
