import { selectPendingPactOffer } from '../../shared/db/selectors/pactSelectors.js';
import { doesLoreDeliveryNeedPopup } from '../../shared/lore/loreModel.js';

export const PLAYER_POPUP_TYPES = {
    PACT_OFFER: 'pactOffer',
    LORE_RELEASE: 'loreRelease',
    NOTIFICATION: 'notification',
    XP: 'xp',
};

export const PLAYER_POPUP_PRIORITIES = {
    [PLAYER_POPUP_TYPES.PACT_OFFER]: 100,
    [PLAYER_POPUP_TYPES.LORE_RELEASE]: 70,
    [PLAYER_POPUP_TYPES.NOTIFICATION]: 50,
    [PLAYER_POPUP_TYPES.XP]: 20,
};

export function buildPlayerPopupCandidates({
    activeCampaign = null,
    actor = null,
    character = null,
    db = null,
    notificationQueue = [],
    loreDeliveries = [],
    xpNotification = null,
} = {}) {
    const actorId = actor?.id || character?.id || null;
    const campaignId = activeCampaign?.id || null;
    const candidates = [];
    const pactOffer = selectPendingPactOffer(actor || character, db);

    if (pactOffer?.id && pactOffer?.pact) {
        candidates.push(createPlayerPopup({
            type: PLAYER_POPUP_TYPES.PACT_OFFER,
            sourceId: pactOffer.id,
            actorId,
            campaignId,
            createdAt: pactOffer.offeredAt,
            requiresAction: true,
            payload: { offer: pactOffer },
        }));
    }

    for (const delivery of Array.isArray(loreDeliveries) ? loreDeliveries : []) {
        if (!doesLoreDeliveryNeedPopup(delivery)) continue;
        candidates.push(createPlayerPopup({
            type: PLAYER_POPUP_TYPES.LORE_RELEASE,
            sourceId: `${delivery.id}:v${delivery.attentionVersion}`,
            actorId,
            campaignId,
            createdAt: delivery.publishedAt,
            requiresAction: false,
            payload: { delivery },
        }));
    }

    for (const notification of Array.isArray(notificationQueue) ? notificationQueue : []) {
        if (!notification?.id) continue;
        candidates.push(createPlayerPopup({
            type: PLAYER_POPUP_TYPES.NOTIFICATION,
            sourceId: notification.id,
            actorId,
            campaignId,
            createdAt: notification.createdAt || notification.timestamp || notification.id,
            requiresAction: false,
            payload: { notification },
        }));
    }

    if (xpNotification?.id) {
        candidates.push(createPlayerPopup({
            type: PLAYER_POPUP_TYPES.XP,
            sourceId: xpNotification.id,
            actorId,
            campaignId,
            createdAt: xpNotification.createdAt || xpNotification.id,
            requiresAction: false,
            payload: { notification: xpNotification },
        }));
    }

    return sortPlayerPopupCandidates(dedupePlayerPopups(candidates));
}

export function createPlayerPopup({
    type,
    sourceId,
    actorId = null,
    campaignId = null,
    priority = PLAYER_POPUP_PRIORITIES[type] || 0,
    createdAt = null,
    payload = {},
    requiresAction = false,
}) {
    const safeSourceId = String(sourceId || `${type}-${Date.now()}`);
    const popup = {
        id: `${type}:${campaignId || 'global'}:${actorId || 'actorless'}:${safeSourceId}`,
        type,
        sourceId: safeSourceId,
        actorId,
        campaignId,
        priority,
        createdAt,
        payload,
        requiresAction,
    };
    return {
        ...popup,
        dedupeKey: createPlayerPopupDedupeKey(popup),
    };
}

export function createPlayerPopupDedupeKey(popup) {
    return [
        'player-popup',
        popup?.type || 'unknown',
        popup?.campaignId || 'global',
        popup?.actorId || 'actorless',
        popup?.sourceId || popup?.id || 'unknown',
    ].join(':');
}

export function sortPlayerPopupCandidates(candidates = []) {
    return [...candidates].sort((a, b) => {
        const priorityDiff = (Number(b.priority) || 0) - (Number(a.priority) || 0);
        if (priorityDiff) return priorityDiff;
        return normalizeCreatedAt(a.createdAt) - normalizeCreatedAt(b.createdAt);
    });
}

export function selectNextPlayerPopup(candidates = [], { isAcknowledged = () => false } = {}) {
    return sortPlayerPopupCandidates(candidates).find((popup) => !isAcknowledged(popup)) || null;
}

function dedupePlayerPopups(candidates) {
    const seen = new Set();
    const result = [];
    for (const candidate of candidates) {
        if (!candidate?.dedupeKey || seen.has(candidate.dedupeKey)) continue;
        seen.add(candidate.dedupeKey);
        result.push(candidate);
    }
    return result;
}

function normalizeCreatedAt(value) {
    if (value instanceof Date) return value.getTime();
    const numeric = Number(value);
    if (Number.isFinite(numeric)) return numeric;
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : 0;
}
