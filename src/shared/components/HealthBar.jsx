import React from 'react';
import { LongPressable } from './LongPressable';

export function HealthBar({ current, max, temp, onLongPress, onClick }) {
    const totalHP = max + (temp || 0);

    const getHpColor = (c, m, t) => {
        const pct = c / m;
        if (pct > 0.5) return '#4caf50';
        if (pct > 0.25) return '#ffeb3b';
        return '#f44336';
    };

    const hpPercent = Math.min(100, Math.max(0, (current / max) * 100));
    // Calculate temp HP percent relative to MAX HP
    const tempPercent = Math.min(100, (temp / max) * 100);

    return (
        <div className={`health-section ${temp > 0 ? 'has-temp-hp' : ''}`}>
            <LongPressable
                className="bar-container"
                onClick={onClick}
                onLongPress={() => onLongPress && onLongPress(null, 'hp')}
                style={{ position: 'relative' }}
            >
                <div className="bar-fill" style={{ width: `${hpPercent}%`, backgroundColor: getHpColor(current, max, temp) }}></div>
                <div className="bar-text">
                    {current} <span style={{ color: '#888', margin: '0 5px' }}>/</span> {max}
                </div>
            </LongPressable>

            {temp > 0 && (
                <div className="temp-hp-container" style={{ width: `${Math.max(tempPercent, 10)}%`, minWidth: 'fit-content', paddingRight: 5 }}>
                    <div className="temp-text" style={{ paddingLeft: 5, zIndex: 5, position: 'relative', whiteSpace: 'nowrap' }}>+{temp} Temp HP</div>
                    <div className="temp-bar-fill" style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0, backgroundColor: '#42a5f5', zIndex: 1 }}></div>
                </div>
            )}
        </div>
    );
}
