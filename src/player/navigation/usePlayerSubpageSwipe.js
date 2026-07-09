import { useCallback, useRef } from 'react';
import {
    getSwipeTargetPlayerPageId,
    hasBlockingPlayerOverlay,
    isPlayerSwipeExcludedTarget,
    PLAYER_SWIPE_THRESHOLD,
    shouldCancelPlayerSubpageSwipeForVerticalScroll,
    shouldHandlePlayerSubpageSwipe,
} from './playerSubpageSwipe';

export function usePlayerSubpageSwipe({
    activePageId,
    disabled = false,
    onSelectPageId,
    threshold = PLAYER_SWIPE_THRESHOLD,
}) {
    const startRef = useRef(null);
    const activePointerIdRef = useRef(null);
    const pointerStartedAtRef = useRef(0);
    const disabledRef = useRef(Boolean(disabled));
    const activePageIdRef = useRef(activePageId);
    const onSelectPageIdRef = useRef(onSelectPageId);

    disabledRef.current = Boolean(disabled);
    activePageIdRef.current = activePageId;
    onSelectPageIdRef.current = onSelectPageId;

    const reset = useCallback(() => {
        startRef.current = null;
    }, []);

    const isLocked = useCallback(() => {
        return disabledRef.current || hasBlockingPlayerOverlay();
    }, []);

    const startGesture = useCallback((eventTarget, x, y) => {
        if (isLocked()) return;
        if (isPlayerSwipeExcludedTarget(eventTarget)) return;
        startRef.current = {
            x,
            y,
            cancelled: false,
        };
    }, [isLocked]);

    const moveGesture = useCallback((x, y) => {
        const start = startRef.current;
        if (!start || start.cancelled) return;
        if (isLocked()) {
            reset();
            return;
        }

        const distanceX = start.x - x;
        const distanceY = start.y - y;
        if (shouldCancelPlayerSubpageSwipeForVerticalScroll({ distanceX, distanceY })) {
            start.cancelled = true;
        }
    }, [isLocked, reset]);

    const endGesture = useCallback((x, y) => {
        const start = startRef.current;
        reset();
        if (!start || start.cancelled || isLocked()) return;

        const distanceX = start.x - x;
        const distanceY = start.y - y;
        if (!shouldHandlePlayerSubpageSwipe({ distanceX, distanceY, threshold })) return;

        const targetPageId = getSwipeTargetPlayerPageId(activePageIdRef.current, distanceX);
        if (targetPageId) {
            onSelectPageIdRef.current?.(targetPageId);
        }
    }, [isLocked, reset, threshold]);

    const onTouchStart = useCallback((event) => {
        if (Date.now() - pointerStartedAtRef.current < 120) return;
        const touch = event.touches?.[0];
        if (!touch) return;
        startGesture(event.target, touch.clientX, touch.clientY);
    }, [startGesture]);

    const onTouchMove = useCallback((event) => {
        if (Date.now() - pointerStartedAtRef.current < 120) return;
        const touch = event.touches?.[0];
        if (!touch) return;
        moveGesture(touch.clientX, touch.clientY);
    }, [moveGesture]);

    const onTouchEnd = useCallback((event) => {
        if (Date.now() - pointerStartedAtRef.current < 120) return;
        const touch = event.changedTouches?.[0];
        if (!touch) return;
        endGesture(touch.clientX, touch.clientY);
    }, [endGesture]);

    const onPointerDown = useCallback((event) => {
        if (event.pointerType && event.pointerType !== 'touch') return;
        pointerStartedAtRef.current = Date.now();
        activePointerIdRef.current = event.pointerId;
        event.currentTarget?.setPointerCapture?.(event.pointerId);
        startGesture(event.target, event.clientX, event.clientY);
    }, [startGesture]);

    const onPointerMove = useCallback((event) => {
        if (activePointerIdRef.current !== event.pointerId) return;
        moveGesture(event.clientX, event.clientY);
    }, [moveGesture]);

    const onPointerUp = useCallback((event) => {
        if (activePointerIdRef.current !== event.pointerId) return;
        activePointerIdRef.current = null;
        event.currentTarget?.releasePointerCapture?.(event.pointerId);
        endGesture(event.clientX, event.clientY);
    }, [endGesture]);

    const onPointerCancel = useCallback(() => {
        activePointerIdRef.current = null;
        reset();
    }, [reset]);

    return {
        onPointerDown,
        onPointerMove,
        onPointerUp,
        onPointerCancel,
        onTouchStart,
        onTouchMove,
        onTouchEnd,
        onTouchCancel: reset,
    };
}
