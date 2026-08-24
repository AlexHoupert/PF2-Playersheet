import {
  ACTOR_RUNTIME_FIELD_NAMES,
  canonicalizeActorRuntimeFields,
  findActorRuntimeMirrorConflicts,
  runtimeValuesEqual,
} from "../actors/actorRuntimeFields.js";

function cloneValue(value) {
  if (value === undefined || value === null) return value;
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

export function buildActorRuntimeBackfillPlan(actorRecords = [], options = {}) {
  const recoveryByActorId = options.recoveryByActorId || {};
  const writes = [];
  const skipped = [];

  actorRecords.forEach((record) => {
    const actor = cloneValue(record.actor || record);
    const campaignId = record.campaignId || actor.campaignId || null;
    const actorId = record.actorId || actor.id || null;
    if (!campaignId || !actorId) {
      skipped.push({ campaignId, actorId, reason: "missing_identity" });
      return;
    }

    const conflicts = findActorRuntimeMirrorConflicts(actor);
    const requestedRecovery = recoveryByActorId[actorId] || null;
    const recovery = requestedRecovery && (
      !requestedRecovery.campaignId || requestedRecovery.campaignId === campaignId
    ) ? requestedRecovery : null;
    const source = recovery ? applySpellRecovery(actor, recovery) : actor;
    const after = canonicalizeActorRuntimeFields(source);
    after.id = actorId;
    after.campaignId = campaignId;

    if (runtimeValuesEqual(actor, after)) {
      skipped.push({ campaignId, actorId, reason: "already_canonical" });
      return;
    }

    writes.push({
      campaignId,
      actorId,
      before: actor,
      after,
      conflicts,
      recoveredSpellCount: recovery?.spellList?.length || 0,
      removedMirrorFields: ACTOR_RUNTIME_FIELD_NAMES.filter((key) => (
        Object.prototype.hasOwnProperty.call(actor.sheet || {}, key)
      )),
    });
  });

  return {
    writes,
    skipped,
    counts: {
      actors: actorRecords.length,
      writes: writes.length,
      skipped: skipped.length,
      conflicts: writes.filter((entry) => entry.conflicts.length > 0).length,
      recovered: writes.filter((entry) => entry.recoveredSpellCount > 0).length,
    },
  };
}

function applySpellRecovery(actor, recovery) {
  const spellList = Array.isArray(recovery?.spellList) ? cloneValue(recovery.spellList) : null;
  if (!spellList) return actor;
  const currentMagic = actor.magic || actor.sheet?.magic || {};
  return {
    ...actor,
    magic: {
      ...cloneValue(currentMagic),
      list: spellList,
    },
  };
}
