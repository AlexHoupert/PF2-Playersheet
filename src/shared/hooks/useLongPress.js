import { useRef, useCallback } from 'react';

export function useLongPress(
    onLongPress,
    onClick,
    { shouldPreventDefault = true, delay = 500, moveThreshold = 10 } = {}
) {
    const timeout = useRef();
    const target = useRef();
    const startPoint = useRef(null); // {x, y}
    const hasMoved = useRef(false);
    const startedAt = useRef(0);

    const start = useCallback((event, data) => {
        if (shouldPreventDefault && event.target) {
            event.target.addEventListener('touchend', preventDefault, { passive: false });
            target.current = event.target;
        }

        startPoint.current = getPoint(event);
        hasMoved.current = false;
        startedAt.current = Date.now();

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

        startPoint.current = null;
        hasMoved.current = false;
    }, [shouldPreventDefault, onClick]);

    const move = useCallback((event, data) => {
        if (!startPoint.current) return;
        if (hasMoved.current) return;

        // Multi-touch implies pinch/zoom; never treat as click/long-press.
        if (isTouchEvent(event) && event.touches && event.touches.length > 1) {
            hasMoved.current = true;
            clear(event, false, data);
            return;
        }

        const point = getPoint(event);
        if (!point) return;

        const dx = point.x - startPoint.current.x;
        const dy = point.y - startPoint.current.y;

        if (Math.abs(dx) > moveThreshold || Math.abs(dy) > moveThreshold) {
            hasMoved.current = true;
            clear(event, false, data);
        }
    }, [clear, moveThreshold]);

    const end = useCallback((event, data) => {
        const point = getPoint(event);
        const moved =
            hasMoved.current ||
            (startPoint.current &&
                point &&
                (Math.abs(point.x - startPoint.current.x) > moveThreshold ||
                    Math.abs(point.y - startPoint.current.y) > moveThreshold));

        clear(event, !moved, data);
    }, [clear, moveThreshold]);

    // Firefox Android ends a long-press with contextmenu followed by
    // touchcancel, which clears the timer before it can fire. Treat the
    // contextmenu event itself as the long-press instead.
    const contextMenu = useCallback((event, data) => {
        if (event && event.preventDefault) event.preventDefault();
        if (timeout.current) {
            clearTimeout(timeout.current);
            timeout.current = null;
            onLongPress && onLongPress(event, data);
        }
    }, [onLongPress]);

    // Firefox Android can also abort a long-press with touchcancel alone
    // (no contextmenu on plain elements). If the press was held nearly the
    // full delay without moving, the browser takeover *is* the long-press.
    const cancel = useCallback((event, data) => {
        if (
            timeout.current &&
            !hasMoved.current &&
            startedAt.current &&
            Date.now() - startedAt.current >= Math.max(delay - 100, delay * 0.8)
        ) {
            clearTimeout(timeout.current);
            timeout.current = null;
            onLongPress && onLongPress(event, data);
        }
        clear(event, false, data);
    }, [clear, delay, onLongPress]);

    return {
        onMouseDown: (e) => start(e),
        onTouchStart: (e) => start(e),
        onTouchMove: (e) => move(e),
        onMouseUp: (e) => clear(e),
        onMouseLeave: (e) => clear(e, false),
        onTouchEnd: (e) => end(e),
        onTouchCancel: (e) => cancel(e),
        onContextMenu: (e) => contextMenu(e)
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

const getPoint = (e) => {
    if (!e) return null;

    // Touch events
    if ('touches' in e || 'changedTouches' in e) {
        const t = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0]);
        if (!t) return null;
        return { x: t.clientX, y: t.clientY };
    }

    // Mouse / Pointer-like events
    if (typeof e.clientX === 'number' && typeof e.clientY === 'number') {
        return { x: e.clientX, y: e.clientY };
    }

    return null;
};
