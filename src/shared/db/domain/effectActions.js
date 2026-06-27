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

export function createEffectActions(context) {
  const {
    createDomainId,
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
    createEffect(campaignId, targetActorId, createStandardConditionEffectInput(conditionName, value, {
      ...options,
      actorId: options.actorId || targetActorId,
    }));

  const createPersistentDamage = (campaignId, targetActorId, payload = {}, options = {}) =>
    createEffect(campaignId, targetActorId, createPersistentDamageEffectInput(payload, {
      ...options,
      actorId: options.actorId || targetActorId,
    }));

  const createCustomBadge = (campaignId, targetActorId, label, options = {}) =>
    createEffect(campaignId, targetActorId, createCustomBadgeEffectInput(label, {
      ...options,
      actorId: options.actorId || targetActorId,
    }));

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

  return {
    createEffect,
    createStandardCondition,
    createPersistentDamage,
    createCustomBadge,
    updateEffect,
    deleteEffect,
    saveEffectTemplate,
    deleteEffectTemplate,
  };
}
