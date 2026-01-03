import { useRef, useEffect } from 'react';

/**
 * Custom hook to detect swipe gestures and prevent accidental clicks.
 * Uses Touch and Mouse events for broad compatibility.
 */
export function useSwipe({ onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown, threshold = 50, disabled = false }) {
    const startObj = useRef(null); // {x, y}
    const currentObj = useRef(null); // {x, y}
    const isDragging = useRef(false);
    const containerRef = useRef(null);
    const endTimeout = useRef(null);
    const isMouseDown = useRef(false);
    const disabledRef = useRef(Boolean(disabled));

    // Toggle body class
    const setSwipingState = (active) => {
        if (active) {
            document.body.classList.add('swiping-active');
        } else {
            document.body.classList.remove('swiping-active');
        }
    };

    const cleanup = () => {
        setSwipingState(false);
        isDragging.current = false;
        isMouseDown.current = false;
        if (endTimeout.current) clearTimeout(endTimeout.current);
    };

    // Keep latest disabled flag + clear any swipe shield when disabling.
    useEffect(() => {
        disabledRef.current = Boolean(disabled);
        if (disabledRef.current) cleanup();
    }, [disabled]);

    // Native Click/Context Guard
    useEffect(() => {
        const handleEvent = (e) => {
            if (disabledRef.current) return;
            // If dragging or swiping class active, block everything
            if (isDragging.current || document.body.classList.contains('swiping-active')) {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
            }
        };

        const handleScroll = () => {
            if (disabledRef.current) return;
            // Scroll implies drag
            if (!document.body.classList.contains('swiping-active')) {
                setSwipingState(true);
                isDragging.current = true;
            }
        };

        window.addEventListener('click', handleEvent, { capture: true });
        window.addEventListener('contextmenu', handleEvent, { capture: true });
        window.addEventListener('scroll', handleScroll, { capture: true });

        // Safety: Global mouse up to catch drags releasing outside
        const handleGlobalMouseUp = () => {
            if (isMouseDown.current) {
                end();
                isMouseDown.current = false;
            }
        };
        window.addEventListener('mouseup', handleGlobalMouseUp);

        return () => {
            window.removeEventListener('click', handleEvent, { capture: true });
            window.removeEventListener('contextmenu', handleEvent, { capture: true });
            window.removeEventListener('scroll', handleScroll, { capture: true });
            window.removeEventListener('mouseup', handleGlobalMouseUp);
            cleanup();
        };
    }, []);

    // --- LOGIC ---
    const start = (x, y) => {
        if (disabledRef.current) return;
        if (endTimeout.current) clearTimeout(endTimeout.current);
        setSwipingState(false);
        isDragging.current = false;
        startObj.current = { x, y };
        currentObj.current = { x, y };
    };

    const move = (x, y) => {
        if (disabledRef.current) return;
        currentObj.current = { x, y };
        if (startObj.current) {
            const dx = x - startObj.current.x;
            const dy = y - startObj.current.y;
            // 3px threshold
            if (!isDragging.current && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) {
                isDragging.current = true;
                setSwipingState(true);
            }
        }
    };

    const end = () => {
        if (disabledRef.current) return;
        // Keep shield up for 300ms
        endTimeout.current = setTimeout(cleanup, 300);

        if (!startObj.current || !currentObj.current) return;

        const distanceX = startObj.current.x - currentObj.current.x;
        const distanceY = startObj.current.y - currentObj.current.y;

        const isHorizontal = Math.abs(distanceX) > Math.abs(distanceY);

        if (isHorizontal) {
            if (Math.abs(distanceX) > threshold) {
                if (distanceX > 0) {
                    onSwipeLeft && onSwipeLeft();
                } else {
                    onSwipeRight && onSwipeRight();
                }
            }
        } else {
            if (Math.abs(distanceY) > threshold) {
                if (distanceY > 0) {
                    onSwipeUp && onSwipeUp();
                } else {
                    onSwipeDown && onSwipeDown();
                }
            }
        }
    };

    // --- HANDLERS ---
    const onTouchStart = (e) => {
        if (disabledRef.current) return;
        start(e.targetTouches[0].clientX, e.targetTouches[0].clientY);
    };
    const onTouchMove = (e) => {
        if (disabledRef.current) return;
        move(e.targetTouches[0].clientX, e.targetTouches[0].clientY);
    };
    const onTouchEnd = () => {
        if (disabledRef.current) return;
        end();
    };
    const onTouchCancel = () => {
        if (disabledRef.current) return;
        isDragging.current = true;
        setSwipingState(true);
        endTimeout.current = setTimeout(cleanup, 300);
    };

    const onMouseDown = (e) => {
        if (disabledRef.current) return;
        isMouseDown.current = true;
        start(e.clientX, e.clientY);
    };
    const onMouseMove = (e) => {
        if (disabledRef.current) return;
        if (!isMouseDown.current) return;
        move(e.clientX, e.clientY);
    };
    const onMouseUp = (e) => {
        if (disabledRef.current) return;
        if (!isMouseDown.current) return;
        end();
        isMouseDown.current = false;
    };
    const onMouseLeave = (e) => {
        if (disabledRef.current) return;
        if (isMouseDown.current) {
            end();
            isMouseDown.current = false;
        }
    };

    return {
        handlers: {
            onTouchStart,
            onTouchMove,
            onTouchEnd,
            onTouchCancel,
            onMouseDown,
            onMouseMove,
            onMouseUp,
            onMouseLeave
        },
        ref: containerRef
    };
}
