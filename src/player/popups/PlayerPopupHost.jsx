import React from 'react';
import PactOfferModal from '../../pacts/PactOfferModal';
import NotificationOverlay from '../components/NotificationOverlay';
import XpOverlay from '../components/XpOverlay';
import LoreReleaseOverlay from '../components/LoreReleaseOverlay';
import { useAppFeedback } from '../../shared/feedback/AppFeedback.jsx';
import { PLAYER_POPUP_TYPES } from './playerPopupQueue';
import { usePlayerPopupQueue } from './usePlayerPopupQueue';

export default function PlayerPopupHost({
    activeCampaign,
    actor = null,
    character,
    dataActions,
    db,
    notificationQueue = [],
    loreDeliveries = [],
    onOpenLoreArticle,
    onOpenLoreCreature,
    onClearNotification,
    xpNotification = null,
}) {
    const { notifyError } = useAppFeedback();
    const [settlingLoreId, setSettlingLoreId] = React.useState(null);
    const {
        acknowledgePopup,
        activePopup,
    } = usePlayerPopupQueue({
        activeCampaign,
        actor,
        character,
        db,
        notificationQueue,
        loreDeliveries,
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

    if (activePopup.type === PLAYER_POPUP_TYPES.LORE_RELEASE) {
        const delivery = activePopup.payload.delivery;
        const settle = async (open) => {
            if (settlingLoreId) return;
            setSettlingLoreId(delivery.id);
            try {
                if (open) {
                    await dataActions.lore.markDeliveryRead(activeCampaign?.id, delivery.id);
                    if (delivery.deliveryKind === 'bestiaryReveal') {
                        onOpenLoreCreature?.(delivery.referenceId || delivery.snapshot?.creatureId);
                    } else {
                        onOpenLoreArticle?.(delivery.snapshot?.category, delivery.articleId);
                    }
                } else {
                    await dataActions.lore.markDeliveryNotified(activeCampaign?.id, delivery.id);
                }
                acknowledgePopup(activePopup, { persist: false });
            } catch (error) {
                notifyError(error);
            } finally {
                setSettlingLoreId(null);
            }
        };
        return <LoreReleaseOverlay delivery={delivery} pending={settlingLoreId === delivery.id} onDismiss={() => settle(false)} onOpen={() => settle(true)} />;
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
