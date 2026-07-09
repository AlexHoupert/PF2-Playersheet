import React from 'react';
import PactOfferModal from '../../pacts/PactOfferModal';
import NotificationOverlay from '../components/NotificationOverlay';
import XpOverlay from '../components/XpOverlay';
import { PLAYER_POPUP_TYPES } from './playerPopupQueue';
import { usePlayerPopupQueue } from './usePlayerPopupQueue';

export default function PlayerPopupHost({
    activeCampaign,
    actor = null,
    character,
    dataActions,
    db,
    notificationQueue = [],
    onClearNotification,
    xpNotification = null,
}) {
    const {
        acknowledgePopup,
        activePopup,
    } = usePlayerPopupQueue({
        activeCampaign,
        actor,
        character,
        db,
        notificationQueue,
        xpNotification,
    });

    const acknowledgeInformationalPopup = React.useCallback(() => {
        if (!activePopup) return;
        acknowledgePopup(activePopup, { persist: true });
    }, [acknowledgePopup, activePopup]);

    const acknowledgeActionPopup = React.useCallback(() => {
        if (!activePopup) return;
        acknowledgePopup(activePopup, { persist: false });
    }, [acknowledgePopup, activePopup]);

    if (!activePopup) return null;

    if (activePopup.type === PLAYER_POPUP_TYPES.PACT_OFFER) {
        return (
            <PactOfferModal
                character={character}
                db={db}
                activeCampaignId={activeCampaign?.id}
                dataActions={dataActions}
                offerOverride={activePopup.payload.offer}
                onSettled={acknowledgeActionPopup}
            />
        );
    }

    if (activePopup.type === PLAYER_POPUP_TYPES.NOTIFICATION) {
        return (
            <NotificationOverlay
                notification={activePopup.payload.notification}
                onDone={() => {
                    onClearNotification?.(activePopup.sourceId);
                    acknowledgeInformationalPopup();
                }}
            />
        );
    }

    if (activePopup.type === PLAYER_POPUP_TYPES.XP) {
        return (
            <XpOverlay
                xpNotification={activePopup.payload.notification}
                disableLocalAck
                onDone={acknowledgeInformationalPopup}
            />
        );
    }

    return null;
}
