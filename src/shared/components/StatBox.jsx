import React from 'react';

/**
 * Standard visual box for a stat (AC, Save, DC, etc.)
 */
export function StatBox({ label, value, subtitle, onClick, style = {}, className = '', pressEvents }) {
    return (
        <div
            className={`stat-box ${className}`}
            onClick={onClick}
            style={{ cursor: onClick ? 'pointer' : 'default', ...style }}
            {...(pressEvents || {})}
        >
            <div className="stat-label">{label}</div>
            <div className="stat-value">{value}</div>
            {subtitle && <div className="stat-sub">{subtitle}</div>}
        </div>
    );
}
