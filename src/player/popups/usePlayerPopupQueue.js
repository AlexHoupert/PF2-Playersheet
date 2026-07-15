import React from 'react';
import {
    buildPlayerPopupCandidates,
    selectNextPlayerPopup,
} from './playerPopupQueue';
import {
    isPlayerPopupAcknowledged,
    markPlayerPopupAcknowledged,
} from './popupAckStore';

export function usePlayerPopupQueue({
    activeCampaign,
    actor,
    character,
    db,
    notificationQueue,
    loreDeliveries,
    xpNotification,
}) {
    const candidates = React.useMemo(() => buildPlayerPopupCandidates({
        activeCampaign,
        actor,
        character,
        db,
        notificationQueue,
        loreDeliveries,
        xpNotification,
    }), [activeCampaign, actor, character, db, loreDeliveries, notificationQueue, xpNotification]);

    const [activePopupId, setActivePopupId] = React.useState(null);

    const activePopup = React.useMemo(() => {
        if (!activePopupId) return null;
        return candidates.find((popup) => popup.id === activePopupId && !isPlayerPopupAcknowledged(popup)) || null;
    }, [activePopupId, candidates]);

    React.useEffect(() => {
        if (activePopup) return;
        const nextPopup = selectNextPlayerPopup(candidates, { isAcknowledged: isPlayerPopupAcknowledged });
        setActivePopupId(nextPopup?.id || null);
    }, [activePopup, candidates]);

    const acknowledgePopup = React.useCallback((popup = activePopup, options = {}) => {
        if (!popup) return;
        markPlayerPopupAcknowledged(popup, options);
        setActivePopupId(null);
    }, [activePopup]);

    return {
        acknowledgePopup,
        activePopup,
        candidates,
    };
}
