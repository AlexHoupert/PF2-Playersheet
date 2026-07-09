import React, { useEffect, useRef } from 'react';
import { ModalLayerMount } from './ModalLayerProvider';

export default function OverlaySurface({
    id,
    active = true,
    ariaLabelledBy,
    backdropClassName = '',
    children,
    className = '',
    contentClassName = '',
    contentStyle,
    onBackdropClick,
    onEscape,
    role = 'dialog',
    style,
}) {
    const surfaceRef = useRef(null);

    useEffect(() => {
        if (!active) return undefined;
        const node = surfaceRef.current;
        if (!node) return undefined;
        const previousActive = document.activeElement;
        window.setTimeout(() => {
            if (!node.contains(document.activeElement)) node.focus({ preventScroll: true });
        }, 0);
        return () => {
            if (previousActive && typeof previousActive.focus === 'function') {
                try {
                    previousActive.focus({ preventScroll: true });
                } catch {
                    previousActive.focus();
                }
            }
        };
    }, [active]);

    if (!active) return null;

    const handleBackdropPointerDown = (event) => {
        if (event.target === event.currentTarget) {
            onBackdropClick?.(event);
        }
    };

    const handleBackdropTouchMove = (event) => {
        if (event.target === event.currentTarget) {
            event.preventDefault();
        }
    };

    const handleKeyDown = (event) => {
        if (event.key === 'Escape') {
            event.stopPropagation();
            onEscape?.(event);
        }
    };

    return (
        <ModalLayerMount id={id} active={active}>
            <div
                className={`modal-layer-backdrop ${backdropClassName}`.trim()}
                data-player-interaction-lock="true"
                onMouseDown={handleBackdropPointerDown}
                onTouchMove={handleBackdropTouchMove}
                style={style}
            >
                <div
                    ref={surfaceRef}
                    className={`modal-layer-surface ${className}`.trim()}
                    role={role}
                    aria-modal={role === 'dialog' ? 'true' : undefined}
                    aria-labelledby={ariaLabelledBy}
                    tabIndex={-1}
                    onKeyDown={handleKeyDown}
                    onMouseDown={(event) => event.stopPropagation()}
                    style={contentStyle}
                >
                    <div className={`modal-layer-scroll-body ${contentClassName}`.trim()}>
                        {children}
                    </div>
                </div>
            </div>
        </ModalLayerMount>
    );
}

