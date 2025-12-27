import { useRef, useCallback } from 'react';

export function useLongPress(onLongPress, onClick, { shouldPreventDefault = true, delay = 500 } = {}) {
    const timeout = useRef();
    const target = useRef();

    const start = useCallback((event, data) => {
        if (shouldPreventDefault && event.target) {
            event.target.addEventListener('touchend', preventDefault, { passive: false });
            target.current = event.target;
        }
        // Clear any existing timeout just in case
        if (timeout.current) clearTimeout(timeout.current);

        timeout.current = setTimeout(() => {
            onLongPress && onLongPress(event, data);
            timeout.current = null; // Mark as fired
        }, delay);
    }, [onLongPress, delay, shouldPreventDefault]);

    const clear = useCallback((event, shouldTriggerClick = true, data) => {
        // If timeout exists, it means Long Press has NOT fired yet -> It's a click
        if (timeout.current) {
            clearTimeout(timeout.current);
            timeout.current = null;
            if (shouldTriggerClick && onClick) {
                onClick(event, data);
            }
        }

        if (shouldPreventDefault && target.current) {
            target.current.removeEventListener('touchend', preventDefault);
            target.current = null;
        }
    }, [shouldPreventDefault, onClick]);

    return {
        onMouseDown: (e) => start(e),
        onTouchStart: (e) => start(e),
        onMouseUp: (e) => clear(e),
        onMouseLeave: (e) => clear(e, false),
        onTouchEnd: (e) => clear(e)
    };
}

const preventDefault = (e) => {
    if (!isTouchEvent(e)) return;
    if (e.touches.length < 2 && e.preventDefault) {
        e.preventDefault();
    }
};

const isTouchEvent = (e) => {
    return e && 'touches' in e;
};
