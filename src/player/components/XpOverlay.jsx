import React, { useEffect, useState } from 'react';

export default function XpOverlay({ xpNotification }) {
    const [active, setActive] = useState(null); // { amount }

    useEffect(() => {
        if (xpNotification && xpNotification.id) {
            setActive(xpNotification);
            const timer = setTimeout(() => {
                setActive(null);
            }, 3500); // 3.5s total duration
            return () => clearTimeout(timer);
        }
    }, [xpNotification?.id]);

    if (!active) return null;

    return (
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
                    font-family: 'Cinzel', serif; /* Assuming global font or fallback */
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
    );
}
