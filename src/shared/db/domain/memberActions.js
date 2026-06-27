import {
  assignUserInDb,
  normalizeEmail,
  revokeUserInDb,
} from "./campaignReducers.js";

export function createMemberActions(context) {
  const {
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

  return {
    assignUser,
    revokeUser,
  };
}
