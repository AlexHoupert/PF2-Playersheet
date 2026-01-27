import React, { useEffect, useState, useRef } from 'react';

export default function NotificationOverlay({ queue = [], onClear }) {
    const [active, setActive] = useState(null); // The current notification object
    const [isAnimating, setIsAnimating] = useState(false);
    const timeoutRef = useRef(null);

    // Watch queue
    useEffect(() => {
        if (!isAnimating && !active && queue.length > 0) {
            playNext(queue[0]);
        }
    }, [queue, isAnimating, active]);

    const playNext = (notification) => {
        setActive(notification);
        setIsAnimating(true);

        const duration = 4000; // 4s total animation

        timeoutRef.current = setTimeout(() => {
            // Animation done
            setIsAnimating(false);
            setActive(null);
            if (onClear) onClear(notification.id);
        }, duration);
    };

    if (!active) return null;

    let content = null;
    let color = '#c5a059'; // Default Gold/Quest
    let icon = '';

    switch (active.type) {
        case 'quest':
            content = `Quest Completed:\n"${active.text}"!`;
            color = '#c5a059';
            break;
        case 'xp':
            content = `+${active.amount} XP!!!`;
            color = '#90caf9'; // Blueish for XP
            break;
        case 'gold':
            content = `+${active.amount} gp!!!`;
            color = '#ffd700';
            break;
        case 'reputation':
            const isGain = active.amount > 0;
            const sign = isGain ? '+' : '';
            color = isGain ? '#66bb6a' : '#ef5350'; // Green or Red
            icon = isGain ? '▲' : '▼';
            content = `${icon} Reputation ${isGain ? 'gained' : 'lost'}:\n${active.faction} ${sign}${active.amount}`;
            break;
        default:
            content = active.text || 'Notification';
    }

    // Determine text size based on length
    let sizeClass = '';
    if (content.length > 60) sizeClass = 'text-tiny';
    else if (content.length > 25) sizeClass = 'text-small';

    return (
        <div className="notification-overlay">
            <div className={`notification-content type-${active.type}`}>
                <div className={`notification-text ${sizeClass}`} style={{ color }}>{content}</div>
            </div>


        </div>
    );
}
