import test from 'node:test';
import assert from 'node:assert/strict';
import {
    buildPlayerPopupCandidates,
    createPlayerPopup,
    PLAYER_POPUP_TYPES,
    selectNextPlayerPopup,
} from '../src/player/popups/playerPopupQueue.js';
import {
    clearPlayerPopupAcksForTests,
    isPlayerPopupAcknowledged,
    markPlayerPopupAcknowledged,
} from '../src/player/popups/popupAckStore.js';

test.beforeEach(() => {
    installLocalStorage();
    clearPlayerPopupAcksForTests();
});

test('player popup candidates are prioritized and deduplicated', () => {
    const candidates = buildPlayerPopupCandidates({
        activeCampaign: { id: 'camp1' },
        actor: {
            id: 'actor1',
            sheet: {
                pactOffer: {
                    id: 'offer1',
                    pactId: 'pact1',
                    status: 'pending',
                    offeredAt: 30,
                },
            },
        },
        db: {
            pacts: {
                pact1: { id: 'pact1', name: 'Ember Pact' },
            },
        },
        notificationQueue: [
            { id: 'notice1', type: 'quest', text: 'Done', createdAt: 10 },
            { id: 'notice1', type: 'quest', text: 'Duplicate', createdAt: 11 },
        ],
        xpNotification: { id: 'xp1', amount: 25, createdAt: 20 },
    });

    assert.deepEqual(candidates.map((popup) => popup.type), [
        PLAYER_POPUP_TYPES.PACT_OFFER,
        PLAYER_POPUP_TYPES.NOTIFICATION,
        PLAYER_POPUP_TYPES.XP,
    ]);
    assert.equal(candidates.filter((popup) => popup.sourceId === 'notice1').length, 1);
    assert.equal(candidates[0].payload.offer.pact.name, 'Ember Pact');
});

test('player popup selection skips acknowledged popups', () => {
    const pactPopup = createPlayerPopup({
        type: PLAYER_POPUP_TYPES.PACT_OFFER,
        sourceId: 'offer1',
        actorId: 'actor1',
        campaignId: 'camp1',
        requiresAction: true,
    });
    const noticePopup = createPlayerPopup({
        type: PLAYER_POPUP_TYPES.NOTIFICATION,
        sourceId: 'notice1',
        actorId: 'actor1',
        campaignId: 'camp1',
    });

    markPlayerPopupAcknowledged(pactPopup, { persist: false });

    const nextPopup = selectNextPlayerPopup([noticePopup, pactPopup], {
        isAcknowledged: isPlayerPopupAcknowledged,
    });

    assert.equal(nextPopup.id, noticePopup.id);
    assert.equal(isPlayerPopupAcknowledged(pactPopup), true);
});

test('informational popup acknowledgements persist across local storage reads', () => {
    const xpPopup = createPlayerPopup({
        type: PLAYER_POPUP_TYPES.XP,
        sourceId: 'xp1',
        actorId: 'actor1',
        campaignId: 'camp1',
    });

    markPlayerPopupAcknowledged(xpPopup, { persist: true });

    assert.equal(isPlayerPopupAcknowledged(xpPopup), true);
    assert.match(globalThis.localStorage.getItem('pf2e-player-popup-acks'), /xp1/);
    assert.match(globalThis.localStorage.getItem('pf2e-seen-xp-notifications'), /xp1/);
});

function installLocalStorage() {
    const values = new Map();
    globalThis.localStorage = {
        getItem: (key) => values.has(key) ? values.get(key) : null,
        setItem: (key, value) => values.set(key, String(value)),
        removeItem: (key) => values.delete(key),
        clear: () => values.clear(),
    };
}
