import {
  archiveLoreContribution,
  normalizeLoreContribution,
  promoteLoreContribution,
} from "./loreContributionReducers.js";

export function createLoreContributionActions(context) {
  const {
    actor,
    capabilities,
    createDomainId,
    db,
    defaultCampaignId,
    firestore,
    nowIso,
    repos,
    updateCampaignLegacy,
    useFirestoreV2,
  } = context;

  const resolveCampaignId = campaignId => campaignId || defaultCampaignId;
  const selectContribution = (campaignId, contributionId) => {
    const campaign = db?.campaigns?.[campaignId];
    return (campaign?.loreContributions || campaign?.loreContributionsList || [])
      .find(entry => entry.id === contributionId) || null;
  };

  const saveContribution = async (campaignId, input) => {
    const targetCampaignId = resolveCampaignId(campaignId || input?.campaignId);
    assertCanAuthor(capabilities, targetCampaignId);
    const current = input?.id ? selectContribution(targetCampaignId, input.id) : null;
    if (current && !canEditContribution(current, actor, capabilities)) {
      throw new Error("You can only edit your own player contribution");
    }
    const actorId = input?.createdByActorId || selectAssignedActorId(db, targetCampaignId, actor);
    const contribution = normalizeLoreContribution({
      ...current,
      ...input,
      campaignId: targetCampaignId,
      createdBy: current?.createdBy || actor,
      createdByActorId: current?.createdByActorId || actorId,
      status: current?.status === "promoted" ? "promoted" : "active",
    }, {
      actorEmail: actor,
      actorId,
      campaignId: targetCampaignId,
      createId: () => createDomainId("lore_contribution"),
      now: nowIso(),
      role: capabilities.role,
    });
    if (useFirestoreV2) {
      await repos.loreContributionRepo.setContribution(firestore, targetCampaignId, contribution);
    } else {
      await updateCampaignLegacy(targetCampaignId, campaign => upsertContribution(campaign, contribution));
    }
    return contribution.id;
  };

  const archiveContribution = async (campaignId, contributionId) => {
    const targetCampaignId = resolveCampaignId(campaignId);
    assertCanManage(capabilities);
    const current = selectContribution(targetCampaignId, contributionId);
    if (!current) throw new Error(`Lore contribution not found: ${contributionId}`);
    const next = archiveLoreContribution(current, { actorEmail: actor, now: nowIso() });
    if (useFirestoreV2) {
      await repos.loreContributionRepo.setContribution(firestore, targetCampaignId, next);
    } else {
      await updateCampaignLegacy(targetCampaignId, campaign => upsertContribution(campaign, next));
    }
  };

  const promoteContributionToOfficial = async (campaignId, contributionId) => {
    const targetCampaignId = resolveCampaignId(campaignId);
    assertCanManage(capabilities);
    const current = selectContribution(targetCampaignId, contributionId);
    if (!current) throw new Error(`Lore contribution not found: ${contributionId}`);
    if (current.status !== "active") throw new Error("Only active contributions can be promoted");
    const result = promoteLoreContribution(current, {
      actorEmail: actor,
      articleId: createDomainId("lore"),
      campaignId: targetCampaignId,
      now: nowIso(),
    });
    if (useFirestoreV2) {
      await repos.loreContributionRepo.promoteContribution(
        firestore,
        targetCampaignId,
        result.contribution,
        result.article
      );
    } else {
      await updateCampaignLegacy(targetCampaignId, campaign => ({
        ...upsertContribution(campaign, result.contribution),
        loreArticles: upsertRecord(campaign.loreArticles, result.article),
      }));
    }
    return result.article.id;
  };

  return { archiveContribution, promoteContributionToOfficial, saveContribution };
}

function assertCanAuthor(capabilities, campaignId) {
  if (!campaignId) throw new Error("Campaign is required for a lore contribution");
  if (!capabilities?.canAuthorCampaignContent) {
    throw new Error("Your campaign role cannot create lore contributions");
  }
}

function assertCanManage(capabilities) {
  if (!capabilities?.isGm) throw new Error("Only a GM can manage player lore contributions");
}

function canEditContribution(contribution, actorEmail, capabilities) {
  if (capabilities?.isGm) return true;
  return String(contribution.createdBy || "").toLowerCase() === String(actorEmail || "").toLowerCase();
}

function selectAssignedActorId(db, campaignId, actorEmail) {
  const campaign = db?.campaigns?.[campaignId];
  const members = campaign?.members || campaign?.membersList || [];
  const member = Array.isArray(members)
    ? members.find(entry => String(entry.email || entry.id || "").toLowerCase() === actorEmail)
    : members?.[actorEmail];
  return member?.assignedActorId || member?.characterId || null;
}

function upsertContribution(campaign, contribution) {
  return { ...campaign, loreContributions: upsertRecord(campaign?.loreContributions, contribution) };
}

function upsertRecord(records, record) {
  const list = Array.isArray(records) ? records : [];
  const index = list.findIndex(entry => entry.id === record.id);
  return index < 0 ? [...list, record] : list.map((entry, itemIndex) => itemIndex === index ? record : entry);
}
