export const CAMPAIGN_ROLES = Object.freeze([
  "player",
  "trusted_player",
  "assistant_gm",
  "spectator",
  "gm",
  "admin",
]);

const ROLE_SET = new Set(CAMPAIGN_ROLES);
const ASSISTANT_ADMIN_TABS = new Set([
  "items",
  "spells",
  "impulses",
  "feats",
  "actions",
  "lore",
  "campaign_changes",
]);

export function normalizeCampaignRole(role) {
  const value = String(role || "player").trim().toLowerCase();
  return ROLE_SET.has(value) ? value : "player";
}

export function selectCampaignCapabilities(memberOrRole, options = {}) {
  const role = normalizeCampaignRole(
    typeof memberOrRole === "string" ? memberOrRole : memberOrRole?.role
  );
  const isGlobalAdmin = Boolean(options.isGlobalAdmin) || role === "admin";
  const isGm = isGlobalAdmin || role === "gm";
  const isAssistantGm = role === "assistant_gm";
  const isTrustedPlayer = role === "trusted_player";
  const isSpectator = role === "spectator";
  const canAuthorCampaignContent = isGm || isAssistantGm || isTrustedPlayer;

  return Object.freeze({
    role,
    isGlobalAdmin,
    isGm,
    isAssistantGm,
    isTrustedPlayer,
    isSpectator,
    isReadOnly: isSpectator,
    canAccessAdmin: isGm || isAssistantGm,
    canAccessFullAdmin: isGm,
    canManageCampaign: isGm,
    canManageMembers: isGm,
    canManageActors: isGm,
    canAuthorCampaignContent,
    canCreatePlayerContent: canAuthorCampaignContent,
    canOverrideCampaignCatalog: isGm || isAssistantGm,
    canPromoteGlobalCatalog: isGlobalAdmin,
    canViewCampaignChanges: isGm || isAssistantGm,
    canRevertCampaignChanges: isGm,
    canViewEffectRequests: isGm || isAssistantGm,
    canDecideEffectRequests: isGm,
    canEditOwnActor: !isSpectator,
    canApplyEffects: !isSpectator,
    canSwitchActors: isGm || isSpectator,
    canViewFullyRevealedParty: isGm || isSpectator,
    assistantAdminTabs: ASSISTANT_ADMIN_TABS,
  });
}

export function canAccessAdminTab(capabilities, tabId) {
  if (capabilities?.canAccessFullAdmin) return true;
  if (!capabilities?.isAssistantGm) return false;
  return ASSISTANT_ADMIN_TABS.has(tabId);
}

export function firstAccessibleAdminTab(capabilities) {
  return capabilities?.canAccessFullAdmin ? "sessions" : "items";
}

export function canMutateCampaignCatalogEntry(capabilities, entry, actorEmail) {
  if (capabilities?.canOverrideCampaignCatalog) return true;
  if (!capabilities?.isTrustedPlayer) return false;
  const owner = normalizeEmail(entry?.ownerEmail || entry?.createdBy);
  return Boolean(owner && owner === normalizeEmail(actorEmail) && entry?.mode === "custom");
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}
