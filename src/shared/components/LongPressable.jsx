import React from 'react';
import { useLongPress } from '../hooks/useLongPress';

export function LongPressable({ onLongPress, onClick, children, shouldPreventDefault = true, delay = 500, ...props }) {
    const handlers = useLongPress((e) => onLongPress && onLongPress(e), (e) => onClick && onClick(e), {
        shouldPreventDefault,
        delay,
    });

    return (
        <div {...props} {...handlers} style={{ ...props.style }}>
            {children}
        </div>
    );
}
