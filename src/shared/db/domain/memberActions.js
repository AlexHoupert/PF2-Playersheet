import {
  assignUserInDb,
  normalizeEmail,
  revokeUserInDb,
} from "./campaignReducers.js";
import { normalizeCampaignRole } from "../../auth/campaignCapabilities.js";
import { cloneValue } from "./inventoryReducers.js";
import { normalizePlayerUserSettings } from "../../../player/settings/playerUserSettings.js";

export function createMemberActions(context) {
  const {
    actor,
    capabilities,
    db,
    firestore,
    repos,
    updateDbLegacy,
    useFirestoreV2,
  } = context;

  const assignUser = (email, campaignId, characterId, role = "player") => {
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) return Promise.resolve();
    if (useFirestoreV2) {
      return repos.memberRepo.assignUser(firestore, campaignId, normalizedEmail, {
        role,
        characterId,
        assignedActorId: characterId || null,
      });
    }
    return updateDbLegacy((prev) => assignUserInDb(prev, normalizedEmail, campaignId, characterId, role));
  };

  const revokeUser = (email) => {
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) return Promise.resolve();
    const userInfo = db?.users?.[normalizedEmail] || db?.users?.[email];
    if (useFirestoreV2) {
      if (!userInfo?.campaignId) return Promise.resolve();
      return repos.memberRepo.revokeUser(firestore, userInfo.campaignId, normalizedEmail);
    }
    return updateDbLegacy((prev) => revokeUserInDb(prev, normalizedEmail));
  };

  const setRole = (campaignId, email, role) => {
    if (!capabilities?.canManageMembers) {
      return Promise.reject(new Error("Only a campaign GM can change member roles"));
    }
    const normalizedEmail = normalizeEmail(email);
    const normalizedRole = normalizeCampaignRole(role);
    if (!campaignId || !normalizedEmail) return Promise.resolve();
    if (useFirestoreV2) {
      return repos.memberRepo.setRole(firestore, campaignId, normalizedEmail, normalizedRole);
    }
    return updateDbLegacy((prev) => {
      const next = cloneValue(prev) || {};
      next.users = { ...(next.users || {}) };
      const current = next.users[normalizedEmail] || next.users[email];
      if (!current || current.campaignId !== campaignId) return prev;
      next.users[normalizedEmail] = { ...current, role: normalizedRole };
      if (email !== normalizedEmail) delete next.users[email];
      return next;
    });
  };

  const updateOwnSettings = (campaignId, settings) => {
    const normalizedEmail = normalizeEmail(actor);
    if (!campaignId || !normalizedEmail) return Promise.resolve();
    const normalizedSettings = normalizePlayerUserSettings(settings);
    if (useFirestoreV2) {
      return repos.memberRepo.updateSettings(firestore, campaignId, normalizedEmail, normalizedSettings);
    }
    return updateDbLegacy((prev) => {
      const next = cloneValue(prev) || {};
      next.users = { ...(next.users || {}) };
      const current = next.users[normalizedEmail];
      if (!current || current.campaignId !== campaignId) return prev;
      next.users[normalizedEmail] = { ...current, settings: normalizedSettings };
      return next;
    });
  };

  return {
    assignUser,
    revokeUser,
    setRole,
    updateOwnSettings,
  };
}
