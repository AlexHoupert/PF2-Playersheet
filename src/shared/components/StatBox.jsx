import React from 'react';
import { LongPressable } from './LongPressable';

export function StatBox({ label, value, subValue, onClick, onLongPress, className }) {
    return (
        <LongPressable className={`stat-box ${className || ''}`}
            onClick={onClick}
            onLongPress={onLongPress}
        >
            <div className="stat-val">
                {value}
                {subValue && <span className="stat-sub">{subValue}</span>}
            </div>
            <div className="stat-label">{label}</div>
        </LongPressable>
    );
}
