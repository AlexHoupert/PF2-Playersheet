import { useRef, useEffect } from 'react';

/**
 * Custom hook to detect swipe gestures and prevent accidental clicks.
 * Uses Pointer Events for universal support (Touch, Mouse, Pen).
 */
export function useSwipe({ onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown, threshold = 50 }) {
    const startObj = useRef(null); // {x, y}
    const currentObj = useRef(null); // {x, y}
    const isDragging = useRef(false);
    const containerRef = useRef(null);
    const endTimeout = useRef(null);
    const isPointerDown = useRef(false);

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
        isPointerDown.current = false;
        if (endTimeout.current) clearTimeout(endTimeout.current);
    };

    // Native Click/Context Guard
    useEffect(() => {
        const handleEvent = (e) => {
            if (isDragging.current || document.body.classList.contains('swiping-active')) {
                // console.log(`[Swipe] Guard: Blocked ${e.type}`);
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
            }
        };

        const handleScroll = () => {
            if (document.body.classList.contains('swiping-active') === false) {
                setSwipingState(true);
                isDragging.current = true;
            }
        };

        window.addEventListener('click', handleEvent, { capture: true });
        window.addEventListener('contextmenu', handleEvent, { capture: true });
        window.addEventListener('scroll', handleScroll, { capture: true });

        // Backup: PointerUp global listener to catch releases outside container
        const handleGlobalPointerUp = () => {
            if (isPointerDown.current) {
                end();
                isPointerDown.current = false;
            }
        };
        window.addEventListener('pointerup', handleGlobalPointerUp);

        return () => {
            window.removeEventListener('click', handleEvent, { capture: true });
            window.removeEventListener('contextmenu', handleEvent, { capture: true });
            window.removeEventListener('scroll', handleScroll, { capture: true });
            window.removeEventListener('pointerup', handleGlobalPointerUp);
            cleanup();
        };
    }, []);

    // --- LOGIC ---
    const start = (x, y) => {
        if (endTimeout.current) clearTimeout(endTimeout.current);
        setSwipingState(false);
        isDragging.current = false;
        startObj.current = { x, y };
        currentObj.current = { x, y };
        isPointerDown.current = true;
    };

    const move = (x, y) => {
        if (!isPointerDown.current) return;
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
        // Keep shield up for 300ms
        endTimeout.current = setTimeout(cleanup, 300);
        isPointerDown.current = false;

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

    // --- POINTER HANDLERS ---
    const onPointerDown = (e) => {
        // Only primary pointers? e.isPrimary?
        // Let's accept all for now to be safe.
        start(e.clientX, e.clientY);
    };
    const onPointerMove = (e) => move(e.clientX, e.clientY);
    const onPointerUp = (e) => end();
    const onPointerCancel = (e) => {
        isDragging.current = true;
        setSwipingState(true);
        endTimeout.current = setTimeout(cleanup, 300);
    };
    const onPointerLeave = (e) => {
        // Optional: treat leaving as end? Or cancel?
        // Usually handled by global pointerup, but safe to ignore here if we trust global listener
    };

    return {
        handlers: {
            onPointerDown,
            onPointerMove,
            onPointerUp,
            onPointerCancel,
            onPointerLeave
        },
        ref: containerRef
    };
}
