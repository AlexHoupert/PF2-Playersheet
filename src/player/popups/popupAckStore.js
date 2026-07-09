const LOCAL_ACK_KEY = 'pf2e-player-popup-acks';
const LEGACY_XP_SEEN_KEY = 'pf2e-seen-xp-notifications';
const MAX_LOCAL_ACKS = 200;

const sessionAcks = new Set();

export function isPlayerPopupAcknowledged(popup) {
    if (!popup?.dedupeKey) return false;
    if (sessionAcks.has(popup.dedupeKey)) return true;
    if (isLegacyXpAcknowledged(popup)) return true;
    return readLocalAckSet().has(popup.dedupeKey);
}

export function markPlayerPopupAcknowledged(popup, { persist = !popup?.requiresAction } = {}) {
    if (!popup?.dedupeKey) return;
    sessionAcks.add(popup.dedupeKey);
    if (!persist) return;
    const localAcks = readLocalAckSet();
    localAcks.add(popup.dedupeKey);
    writeLocalAckSet(localAcks);
    if (popup.type === 'xp') markLegacyXpSeen(popup.sourceId);
}

export function clearPlayerPopupAcksForTests() {
    sessionAcks.clear();
    try {
        getStorage()?.removeItem(LOCAL_ACK_KEY);
        getStorage()?.removeItem(LEGACY_XP_SEEN_KEY);
    } catch {
        // Test helper only.
    }
}

function readLocalAckSet() {
    try {
        const raw = getStorage()?.getItem(LOCAL_ACK_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        return new Set(Array.isArray(parsed) ? parsed : []);
    } catch {
        return new Set();
    }
}

function writeLocalAckSet(ackSet) {
    try {
        const storage = getStorage();
        if (!storage) return;
        const values = [...ackSet].slice(-MAX_LOCAL_ACKS);
        storage.setItem(LOCAL_ACK_KEY, JSON.stringify(values));
    } catch {
        // Local acknowledgement is best effort.
    }
}

function isLegacyXpAcknowledged(popup) {
    if (popup?.type !== 'xp' || !popup?.sourceId) return false;
    try {
        const parsed = JSON.parse(getStorage()?.getItem(LEGACY_XP_SEEN_KEY) || '[]');
        return Array.isArray(parsed) && parsed.includes(popup.sourceId);
    } catch {
        return false;
    }
}

function markLegacyXpSeen(sourceId) {
    if (!sourceId) return;
    try {
        const storage = getStorage();
        if (!storage) return;
        const parsed = JSON.parse(storage.getItem(LEGACY_XP_SEEN_KEY) || '[]');
        const seen = Array.isArray(parsed) ? parsed : [];
        if (!seen.includes(sourceId)) seen.push(sourceId);
        storage.setItem(LEGACY_XP_SEEN_KEY, JSON.stringify(seen.slice(-50)));
    } catch {
        // Compatibility acknowledgement is best effort.
    }
}

function getStorage() {
    return typeof localStorage !== 'undefined' ? localStorage : null;
}

