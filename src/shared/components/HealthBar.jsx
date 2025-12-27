import React from 'react';

/**
 * Reusable Health Bar Component.
 * Supports Temp HP visualization and click interaction.
 */
export function HealthBar({ hp = 0, maxHp = 1, tempHp = 0, onClick, style = {} }) {
    const safeMax = Math.max(1, maxHp);
    const pct = Math.min(100, Math.max(0, (hp / safeMax) * 100));
    const tempPct = Math.min(100, Math.max(0, (tempHp / safeMax) * 100));

    let barColor = '#4caf50';
    if (pct < 25) barColor = '#d32f2f';
    else if (pct < 50) barColor = '#f57c00';

    return (
        <div
            className={`health-section ${tempHp > 0 ? 'has-temp-hp' : ''}`}
            onClick={onClick}
            style={{ ...style, cursor: onClick ? 'pointer' : 'default' }}
        >
            <div className="bar-container">
                <div className="bar-fill" style={{ width: `${pct}%`, backgroundColor: barColor }}></div>
                <div className="bar-text">
                    {hp} / {maxHp} {tempHp > 0 && <span style={{ color: '#e3f2fd', marginLeft: 5 }}>(+{tempHp})</span>}
                </div>
            </div>
            {tempHp > 0 && (
                <div id="tempHpArea">
                    <div
                        className="temp-hp-container"
                        style={{
                            display: 'block',
                            width: `${tempPct}%`
                        }}
                    >
                        <div className="temp-bar-fill" style={{ width: '100%' }}></div>
                        <div className="temp-text">
                            {`+${tempHp}${tempHp >= 5 ? ` ${tempHp >= 7 ? 'Temp HP' : 'Temp'}` : ''}`}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
