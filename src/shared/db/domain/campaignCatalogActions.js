import { canMutateCampaignCatalogEntry } from "../../auth/campaignCapabilities.js";
import {
  applyCampaignCatalogDelete,
  applyCampaignCatalogSave,
  createCampaignCatalogEntry,
  createCatalogChangeEvent,
} from "./campaignCatalogReducers.js";
import { assertCatalogEffectDefinitions } from "../../rules/catalogEffectDefinitions.js";

export function createCampaignCatalogActions(context) {
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
  const getEntry = (campaignId, entryId) => {
    const campaign = db?.campaigns?.[campaignId];
    if (campaign?.catalogEntries?.[entryId]) return campaign.catalogEntries[entryId];
    return (campaign?.catalogEntriesList || []).find(entry => entry.id === entryId) || null;
  };

  const saveCatalogEntry = async (entryInput, options = {}) => {
    const campaignId = resolveCampaignId(options.campaignId || entryInput?.campaignId);
    assertCampaignAuthoring(campaignId, capabilities);
    assertCatalogEffectDefinitions(entryInput?.payload || entryInput);
    const current = entryInput?.id ? getEntry(campaignId, entryInput.id) : null;
    let normalizedInput = { ...entryInput };

    if (capabilities.isTrustedPlayer && !capabilities.canOverrideCampaignCatalog) {
      if (current && !canMutateCampaignCatalogEntry(capabilities, current, actor)) {
        throw new Error("Trusted players can only edit their own campaign catalog entries");
      }
      if (entryInput?.mode === "hide" || entryInput?.mode === "override") {
        throw new Error("Trusted players must fork an existing entry instead of overriding it");
      }
      normalizedInput = {
        ...normalizedInput,
        mode: "custom",
        origin: normalizedInput.baseId ? "fork" : "custom",
        ownerEmail: actor,
      };
    }

    const timestamp = nowIso();
    const entry = createCampaignCatalogEntry(normalizedInput, {
      actorEmail: actor,
      campaignId,
      createId: () => createDomainId("catalog_entry"),
      role: capabilities.role,
      timestamp,
    });
    const event = createCatalogChangeEvent({
      entryId: entry.id,
      catalogType: entry.catalogType,
      operation: current
        ? "update"
        : entry.origin === "fork"
          ? "fork"
          : entry.mode === "hide"
            ? "hide"
            : entry.mode === "override"
              ? "override"
              : "create",
    }, {
      actorEmail: actor,
      campaignId,
      createId: () => createDomainId("catalog_event"),
      role: capabilities.role,
      timestamp,
    });

    if (useFirestoreV2) {
      await repos.campaignCatalogRepo.saveEntryWithEvent(firestore, campaignId, entry, event);
    } else {
      await updateCampaignLegacy(campaignId, campaign => applyCampaignCatalogSave(campaign, entry, {
        ...event,
        before: current,
        after: entry,
      }));
    }
    return entry.id;
  };

  const deleteCatalogEntry = async (entryOrId, options = {}) => {
    const campaignId = resolveCampaignId(options.campaignId || entryOrId?.campaignId);
    const entryId = entryOrId?.id || entryOrId;
    assertCampaignAuthoring(campaignId, capabilities);
    const current = getEntry(campaignId, entryId) || (typeof entryOrId === "object" ? entryOrId : null);
    if (!current) throw new Error(`Campaign catalog entry not found: ${entryId}`);
    if (!canMutateCampaignCatalogEntry(capabilities, current, actor)) {
      throw new Error("You cannot delete this campaign catalog entry");
    }
    const timestamp = nowIso();
    const event = createCatalogChangeEvent({
      entryId,
      catalogType: current.catalogType,
      operation: "delete",
    }, {
      actorEmail: actor,
      campaignId,
      createId: () => createDomainId("catalog_event"),
      role: capabilities.role,
      timestamp,
    });
    if (useFirestoreV2) {
      await repos.campaignCatalogRepo.deleteEntryWithEvent(firestore, campaignId, entryId, event);
    } else {
      await updateCampaignLegacy(campaignId, campaign => applyCampaignCatalogDelete(campaign, entryId, {
        ...event,
        before: current,
      }));
    }
  };

  const revertCatalogChange = async (eventId, options = {}) => {
    const campaignId = resolveCampaignId(options.campaignId);
    if (!capabilities.canRevertCampaignChanges) throw new Error("Only a campaign GM can revert catalog changes");
    const timestamp = nowIso();
    const event = createCatalogChangeEvent({ operation: "revert" }, {
      actorEmail: actor,
      campaignId,
      createId: () => createDomainId("catalog_event"),
      role: capabilities.role,
      timestamp,
    });
    if (!useFirestoreV2) throw new Error("Catalog change reverts require Firestore V2");
    return repos.campaignCatalogRepo.revertEvent(firestore, campaignId, eventId, event);
  };

  const promoteToGlobalCatalog = async (entryOrId, options = {}) => {
    if (!capabilities.canPromoteGlobalCatalog) throw new Error("Only a global admin can promote catalog entries");
    const campaignId = resolveCampaignId(options.campaignId || entryOrId?.campaignId);
    const entry = typeof entryOrId === "object" ? entryOrId : getEntry(campaignId, entryOrId);
    if (!entry) throw new Error("Campaign catalog entry not found");
    const timestamp = nowIso();
    const globalOverride = {
      ...entry,
      id: entry.globalOverrideId || entry.id,
      updatedAt: timestamp,
      updatedBy: actor,
    };
    const event = createCatalogChangeEvent({
      entryId: entry.id,
      catalogType: entry.catalogType,
      operation: "promote",
    }, {
      actorEmail: actor,
      campaignId,
      createId: () => createDomainId("catalog_event"),
      role: capabilities.role,
      timestamp,
    });
    if (!useFirestoreV2) throw new Error("Global catalog promotion requires Firestore V2");
    return repos.campaignCatalogRepo.promoteEntryWithEvent(
      firestore,
      campaignId,
      globalOverride,
      event
    );
  };

  return {
    saveCatalogEntry,
    deleteCatalogEntry,
    revertCatalogChange,
    promoteToGlobalCatalog,
    // Compatibility names let catalog editors cut over without changing their
    // editor contract. These methods are campaign-scoped, not global.
    saveCatalogOverride: saveCatalogEntry,
    deleteCatalogOverride: deleteCatalogEntry,
  };
}

function assertCampaignAuthoring(campaignId, capabilities) {
  if (!campaignId) throw new Error("A campaign is required for catalog changes");
  if (!capabilities?.canAuthorCampaignContent) {
    throw new Error("Your campaign role cannot author catalog content");
  }
}
