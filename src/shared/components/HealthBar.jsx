import React from 'react';
import { LongPressable } from './LongPressable';

export function HealthBar({ current, max, temp, penalty, onLongPress, onClick }) {
    const totalHP = max + (temp || 0);

    const getHpColor = (c, m, t) => {
        // Effective max for color calculation is max - penalty
        const effectiveMax = Math.max(1, m - (penalty || 0));
        const pct = c / effectiveMax;
        if (pct > 0.5) return '#4caf50';
        if (pct > 0.25) return '#ffeb3b';
        return '#f44336';
    };

    const hpPercent = Math.min(100, Math.max(0, (current / max) * 100));
    const penaltyPercent = Math.min(100, Math.max(0, ((penalty || 0) / max) * 100));
    // Calculate temp HP percent relative to MAX HP
    const tempPercent = Math.min(100, (temp / max) * 100);

    return (
        <div className={`health-section ${temp > 0 ? 'has-temp-hp' : ''}`} data-testid="player-health-section">
            <LongPressable
                className="bar-container"
                data-testid="player-health-bar"
                onClick={onClick}
                onLongPress={() => onLongPress && onLongPress(null, 'hp')}
                style={{ position: 'relative', background: '#333' }}
            >
                {/* Penalty Bar (Grey) */}
                {penaltyPercent > 0 && (
                    <div className="bar-penalty" style={{
                        position: 'absolute',
                        right: 0,
                        top: 0,
                        height: '100%',
                        width: `${penaltyPercent}%`,
                        backgroundColor: '#777',
                        zIndex: 1
                    }}></div>
                )}

                <div className="bar-fill" style={{ width: `${hpPercent}%`, backgroundColor: getHpColor(current, max, temp), zIndex: 2 }}></div>
                <div className="bar-text" style={{ zIndex: 3 }} data-testid="player-health-text">
                    {current} <span style={{ color: '#888', margin: '0 5px' }}>/</span> {max - (penalty || 0)}
                    {penalty > 0 && <span style={{ fontSize: '0.8em', color: '#bbb', marginLeft: 4 }}>({max})</span>}
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
