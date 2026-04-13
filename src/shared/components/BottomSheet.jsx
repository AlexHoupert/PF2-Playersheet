/**
 * BottomSheet — slides up from the bottom of the screen.
 *
 * Props:
 *   isOpen       boolean
 *   onClose      () => void
 *   title        string | ReactNode  (optional)
 *   height       string              CSS value for max-height, default '70vh'
 *   children     ReactNode
 */
import React, { useEffect, useRef, useState } from 'react';
import './BottomSheet.css';

export default function BottomSheet({ isOpen, onClose, title, height = '70vh', children }) {
    const sheetRef = useRef(null);

    // Drag-to-dismiss state
    const dragStart = useRef(null);
    const [dragOffset, setDragOffset] = useState(0);
    const [isDragging, setIsDragging] = useState(false);

    // Lock body scroll while open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
            setDragOffset(0);
        }
        return () => { document.body.style.overflow = ''; };
    }, [isOpen]);

    // Close on Escape
    useEffect(() => {
        if (!isOpen) return;
        const onKey = (e) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [isOpen, onClose]);

    // ── Drag handle touch events ────────────────────────────────────────────
    const onDragHandlePointerDown = (e) => {
        dragStart.current = e.clientY ?? e.touches?.[0]?.clientY;
        setIsDragging(true);
    };

    const onPointerMove = (e) => {
        if (!isDragging || dragStart.current == null) return;
        const y = e.clientY ?? e.touches?.[0]?.clientY;
        const delta = Math.max(0, y - dragStart.current);
        setDragOffset(delta);
    };

    const onPointerUp = () => {
        if (!isDragging) return;
        setIsDragging(false);
        if (dragOffset > 80) {
            onClose();
        } else {
            setDragOffset(0);
        }
        dragStart.current = null;
    };

    if (!isOpen && dragOffset === 0) return null;

    const translateY = isOpen ? dragOffset : '100%';

    return (
        <div
            className={`bottom-sheet-backdrop ${isOpen ? 'open' : ''}`}
            onClick={onClose}
        >
            <div
                ref={sheetRef}
                className="bottom-sheet"
                style={{ maxHeight: height, transform: `translateY(${typeof translateY === 'number' ? translateY + 'px' : translateY})` }}
                onClick={e => e.stopPropagation()}
                onMouseMove={onPointerMove}
                onMouseUp={onPointerUp}
                onTouchMove={onPointerMove}
                onTouchEnd={onPointerUp}
            >
                {/* Drag handle */}
                <div
                    className="bottom-sheet-handle"
                    onMouseDown={onDragHandlePointerDown}
                    onTouchStart={onDragHandlePointerDown}
                >
                    <div className="bottom-sheet-handle-bar" />
                </div>

                {/* Header */}
                {title && (
                    <div className="bottom-sheet-header">
                        <span className="bottom-sheet-title">{title}</span>
                        <button className="bottom-sheet-close" onClick={onClose}>×</button>
                    </div>
                )}

                {/* Content */}
                <div className="bottom-sheet-content">
                    {children}
                </div>
            </div>
        </div>
    );
}
