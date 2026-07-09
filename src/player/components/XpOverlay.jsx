import React, { useEffect, useState } from 'react';
import { ModalLayerMount } from '../../shared/overlays/ModalLayerProvider';

const SEEN_KEY = 'pf2e-seen-xp-notifications';

function getSeenIds() {
    try { return JSON.parse(localStorage.getItem(SEEN_KEY) || '[]'); } catch { return []; }
}
function markSeen(id) {
    const seen = getSeenIds();
    if (!seen.includes(id)) {
        seen.push(id);
        // Keep only last 50 to avoid unbounded growth
        if (seen.length > 50) seen.splice(0, seen.length - 50);
        localStorage.setItem(SEEN_KEY, JSON.stringify(seen));
    }
}

export default function XpOverlay({ xpNotification, onDone, disableLocalAck = false }) {
    const [active, setActive] = useState(null); // { amount }
    const xpNotificationId = xpNotification?.id;

    useEffect(() => {
        if (xpNotification && xpNotification.id) {
            // Skip if already seen on this client
            if (!disableLocalAck && getSeenIds().includes(xpNotification.id)) {
                onDone?.(xpNotification);
                return;
            }

            if (!disableLocalAck) markSeen(xpNotification.id);
            setActive(xpNotification);
            const timer = setTimeout(() => {
                setActive(null);
                onDone?.(xpNotification);
            }, 3500); // 3.5s total duration
            return () => clearTimeout(timer);
        }
    }, [disableLocalAck, onDone, xpNotificationId]);

    if (!active) return null;

    return (
        <ModalLayerMount
            id={`player-xp-${active.id || 'active'}`}
            options={{ blocking: false, lockPageScroll: false, suspendPageGestures: true }}
        >
        <div className="xp-overlay">
            <div className="xp-content">
                <div className="xp-amount">+{active.amount} XP!!!</div>
            </div>
            <style>{`
                .xp-overlay {
                    position: fixed;
                    top: 0; left: 0; width: 100vw; height: 100vh;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    pointer-events: none;
                    z-index: 9999;
                }
                .xp-content {
                    animation: xp-pop-fade 3.5s ease-out forwards;
                    text-align: center;
                }
                .xp-amount {
                    font-size: 5rem;
                    font-weight: 900;
                    color: #c5a059;
                    text-shadow: 
                        0 0 10px rgba(0,0,0,0.8),
                        0 0 20px #c5a059,
                        0 0 40px #c5a059;
                    font-family: 'Cinzel', serif;
                    letter-spacing: 2px;
                }

                @keyframes xp-pop-fade {
                    0% {
                        opacity: 0;
                        transform: scale(0.5) translateY(50px);
                    }
                    15% {
                        opacity: 1;
                        transform: scale(1.2) translateY(0);
                    }
                    30% { /* Hold */
                        opacity: 1;
                        transform: scale(1);
                    }
                    100% { /* Fade Out */
                        opacity: 0;
                        transform: scale(0.8) translateY(-50px);
                    }
                }
            `}</style>
        </div>
        </ModalLayerMount>
    );
}
