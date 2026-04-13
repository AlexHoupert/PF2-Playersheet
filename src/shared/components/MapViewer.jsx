import React, { useState, useEffect, useRef, useCallback } from 'react';
import PinMarker from './PinMarker';

// ── Constants ──────────────────────────────────────────────────────────────────

const MIN_SCALE = 0.04;
const MAX_SCALE = 14;
const DRAG_THRESHOLD = 5; // px moved before classifying as drag (not click)

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

/**
 * Convert a clientX/Y position to 0-1 fractions of the inner (image) element.
 * Works after CSS transform because getBoundingClientRect reflects rendered size.
 */
function clientToFraction(clientX, clientY, innerEl) {
    const rect = innerEl.getBoundingClientRect();
    return {
        x: clamp((clientX - rect.left) / rect.width, 0, 1),
        y: clamp((clientY - rect.top) / rect.height, 0, 1),
    };
}

// ── MapViewer ──────────────────────────────────────────────────────────────────

/**
 * Core pan/zoom map viewer.
 *
 * Props:
 *   map            – campaign map object { imageUrl, pins, scale, name }
 *   mode           – 'pan' | 'measure' | 'pin' | 'calibrate'  (default: 'pan')
 *   showAllPins    – if true, shows pins regardless of visibleToPlayers flag (GM mode)
 *   measureA/B     – { x, y } fractions for measurement endpoints (controlled from parent)
 *   calA/B         – { x, y } fractions for calibration endpoints (purple, GM only)
 *   onPinClick     – (pin) => void
 *   onMapClick     – (fraction {x,y}) => void  — fires on background click in non-pan modes
 *   onImageLoad    – ({ w, h }) => void  — called when image natural size is known
 *   extraOverlay   – optional JSX rendered inside the transform
 */
export default function MapViewer({
    map,
    mode = 'pan',
    showAllPins = false,
    measureA = null,
    measureB = null,
    calA = null,
    calB = null,
    onPinClick,
    onMapClick,
    onImageLoad,
    extraOverlay,
}) {
    const containerRef = useRef(null);
    const innerRef     = useRef(null);
    const imgRef       = useRef(null);

    const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
    const [imgSize, setImgSize]     = useState({ w: 0, h: 0 });
    const [imgLoaded, setImgLoaded] = useState(false);

    // Refs for values that need to be read inside stable event handlers
    const transformRef    = useRef(transform);
    const dragRef         = useRef(null);   // active drag state
    const touchRef        = useRef(null);   // active touch state
    const lastWasDragRef  = useRef(false);  // whether the last pointer action was a drag

    const applyTransform = useCallback((t) => {
        transformRef.current = t;
        setTransform(t);
    }, []);

    // Keep ref in sync whenever state changes from outside
    useEffect(() => { transformRef.current = transform; }, [transform]);

    // ── Reset image state when map image changes ────────────────────────────
    useEffect(() => {
        setImgLoaded(false);
        setImgSize({ w: 0, h: 0 });
        applyTransform({ x: 0, y: 0, scale: 1 });
    }, [map?.imageUrl, applyTransform]);

    // ── Fit image inside container ──────────────────────────────────────────
    const fitToScreen = useCallback(() => {
        const img = imgRef.current;
        const ctr = containerRef.current;
        if (!img || !ctr) return;
        const iw = img.naturalWidth;
        const ih = img.naturalHeight;
        if (!iw || !ih) return;
        const cw = ctr.clientWidth;
        const ch = ctr.clientHeight;
        const scale = Math.min(cw / iw, ch / ih);
        const t = {
            scale,
            x: (cw - iw * scale) / 2,
            y: (ch - ih * scale) / 2,
        };
        applyTransform(t);
        setImgSize({ w: iw, h: ih });
        setImgLoaded(true);
        onImageLoad?.({ w: iw, h: ih });
    }, [applyTransform, onImageLoad]);

    // ── Zoom toward a viewport-relative origin point ────────────────────────
    const zoomAt = useCallback((factor, ox, oy) => {
        const t = transformRef.current;
        const newScale = clamp(t.scale * factor, MIN_SCALE, MAX_SCALE);
        const af = newScale / t.scale;
        applyTransform({
            scale: newScale,
            x: ox - (ox - t.x) * af,
            y: oy - (oy - t.y) * af,
        });
    }, [applyTransform]);

    // ── Mouse wheel zoom ────────────────────────────────────────────────────
    const handleWheel = useCallback((e) => {
        e.preventDefault();
        const rect = containerRef.current.getBoundingClientRect();
        zoomAt(e.deltaY < 0 ? 1.14 : 0.88, e.clientX - rect.left, e.clientY - rect.top);
    }, [zoomAt]);

    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        el.addEventListener('wheel', handleWheel, { passive: false });
        return () => el.removeEventListener('wheel', handleWheel);
    }, [handleWheel]);

    // ── Mouse drag ──────────────────────────────────────────────────────────
    const onMouseDown = useCallback((e) => {
        if (e.button !== 0 && e.button !== 1) return;
        e.preventDefault();
        dragRef.current = {
            startX: e.clientX, startY: e.clientY,
            startTX: transformRef.current.x,
            startTY: transformRef.current.y,
            moved: false,
        };
        lastWasDragRef.current = false;
    }, []);

    useEffect(() => {
        const onMove = (e) => {
            const d = dragRef.current;
            if (!d) return;
            const dx = e.clientX - d.startX;
            const dy = e.clientY - d.startY;
            if (!d.moved && Math.hypot(dx, dy) > DRAG_THRESHOLD) d.moved = true;
            applyTransform({
                ...transformRef.current,
                x: d.startTX + dx,
                y: d.startTY + dy,
            });
        };
        const onUp = () => {
            lastWasDragRef.current = dragRef.current?.moved || false;
            dragRef.current = null;
        };
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
        return () => {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
        };
    }, [applyTransform]);

    // ── Touch (pan + pinch-to-zoom) ─────────────────────────────────────────
    const handleTouchStart = useCallback((e) => {
        lastWasDragRef.current = false;
        if (e.touches.length === 1) {
            touchRef.current = {
                type: 'pan',
                startX: e.touches[0].clientX,
                startY: e.touches[0].clientY,
                startTX: transformRef.current.x,
                startTY: transformRef.current.y,
                moved: false,
            };
        } else if (e.touches.length === 2) {
            const dx = e.touches[1].clientX - e.touches[0].clientX;
            const dy = e.touches[1].clientY - e.touches[0].clientY;
            touchRef.current = {
                type: 'pinch',
                startDist: Math.hypot(dx, dy),
                startScale: transformRef.current.scale,
                midX: (e.touches[0].clientX + e.touches[1].clientX) / 2,
                midY: (e.touches[0].clientY + e.touches[1].clientY) / 2,
                startTX: transformRef.current.x,
                startTY: transformRef.current.y,
            };
        }
    }, []);

    const handleTouchMove = useCallback((e) => {
        e.preventDefault();
        const tc = touchRef.current;
        if (!tc) return;

        if (tc.type === 'pan' && e.touches.length === 1) {
            const dx = e.touches[0].clientX - tc.startX;
            const dy = e.touches[0].clientY - tc.startY;
            if (!tc.moved && Math.hypot(dx, dy) > DRAG_THRESHOLD) tc.moved = true;
            applyTransform({
                ...transformRef.current,
                x: tc.startTX + dx,
                y: tc.startTY + dy,
            });
        } else if (tc.type === 'pinch' && e.touches.length === 2) {
            const dx = e.touches[1].clientX - e.touches[0].clientX;
            const dy = e.touches[1].clientY - e.touches[0].clientY;
            const dist = Math.hypot(dx, dy);
            const newScale = clamp(tc.startScale * (dist / tc.startDist), MIN_SCALE, MAX_SCALE);
            const af = newScale / tc.startScale;
            const rect = containerRef.current.getBoundingClientRect();
            const ox = tc.midX - rect.left;
            const oy = tc.midY - rect.top;
            applyTransform({
                scale: newScale,
                x: ox - (ox - tc.startTX) * af,
                y: oy - (oy - tc.startTY) * af,
            });
        }
    }, [applyTransform]);

    const handleTouchEnd = useCallback((e) => {
        const tc = touchRef.current;
        lastWasDragRef.current = tc?.moved || false;
        touchRef.current = null;
    }, []);

    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        el.addEventListener('touchstart', handleTouchStart, { passive: true });
        el.addEventListener('touchmove',  handleTouchMove,  { passive: false });
        el.addEventListener('touchend',   handleTouchEnd,   { passive: true });
        return () => {
            el.removeEventListener('touchstart', handleTouchStart);
            el.removeEventListener('touchmove',  handleTouchMove);
            el.removeEventListener('touchend',   handleTouchEnd);
        };
    }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

    // ── Background click (for measure/pin modes) ────────────────────────────
    const handleContainerClick = useCallback((e) => {
        if (lastWasDragRef.current) { lastWasDragRef.current = false; return; }
        if (!innerRef.current || !imgLoaded) return;
        if (mode === 'pan') return;
        const frac = clientToFraction(e.clientX, e.clientY, innerRef.current);
        onMapClick?.(frac);
    }, [mode, imgLoaded, onMapClick]);

    // ── Double-click to zoom in (2.5×) toward click point ──────────────────
    const handleDoubleClick = useCallback((e) => {
        if (!imgLoaded) return;
        e.preventDefault();
        const rect = containerRef.current.getBoundingClientRect();
        // If already zoomed in significantly, reset to fit instead
        if (transformRef.current.scale > 2) {
            fitToScreen();
        } else {
            zoomAt(2.5, e.clientX - rect.left, e.clientY - rect.top);
        }
    }, [imgLoaded, zoomAt, fitToScreen]);

    // ── Measure distance calculation ────────────────────────────────────────
    let measureLabel = null;
    if (measureA && measureB && imgSize.w > 0) {
        const pxDist = Math.hypot(
            (measureB.x - measureA.x) * imgSize.w,
            (measureB.y - measureA.y) * imgSize.h,
        );
        const sc = map?.scale;
        if (sc?.pointA && sc?.pointB && sc?.realDistance) {
            const calDist = Math.hypot(
                (sc.pointB.x - sc.pointA.x) * imgSize.w,
                (sc.pointB.y - sc.pointA.y) * imgSize.h,
            );
            if (calDist > 0) {
                const real = (pxDist / calDist) * sc.realDistance;
                measureLabel = `${real % 1 === 0 ? real : real.toFixed(1)} ${sc.unit || ''}`.trim();
            }
        }
        if (!measureLabel) {
            measureLabel = `${Math.round(pxDist)} px (no scale)`;
        }
    }

    // ── Visible pins ────────────────────────────────────────────────────────
    const visiblePins = (map?.pins || []).filter(p => showAllPins || p.visibleToPlayers);

    const isDragging = !!dragRef.current;
    const cursor = (mode === 'measure' || mode === 'pin' || mode === 'calibrate')
        ? 'crosshair'
        : isDragging ? 'grabbing' : 'grab';

    // Scale-invariant SVG sizes
    const s = transform.scale;

    return (
        <div
            ref={containerRef}
            onMouseDown={onMouseDown}
            onClick={handleContainerClick}
            onDoubleClick={handleDoubleClick}
            style={{
                position: 'relative',
                width: '100%', height: '100%',
                overflow: 'hidden',
                background: '#080810',
                cursor,
                userSelect: 'none',
                touchAction: 'none',
            }}
        >
            {/* ── Transformed area (image + pins + measure SVG) ── */}
            <div
                ref={innerRef}
                style={{
                    position: 'absolute',
                    transformOrigin: '0 0',
                    transform: `translate(${transform.x}px, ${transform.y}px) scale(${s})`,
                    width:  imgSize.w || 'auto',
                    height: imgSize.h || 'auto',
                    // Subpixel rendering hint
                    willChange: 'transform',
                }}
            >
                {map?.imageUrl && (
                    <img
                        ref={imgRef}
                        src={map.imageUrl}
                        alt={map?.name || 'map'}
                        draggable={false}
                        onLoad={fitToScreen}
                        style={{ display: 'block', maxWidth: 'none', userSelect: 'none' }}
                    />
                )}

                {/* Pins */}
                {imgLoaded && visiblePins.map(pin => (
                    <PinMarker
                        key={pin.id}
                        pin={pin}
                        scale={s}
                        onClick={onPinClick}
                    />
                ))}

                {/* Measure SVG overlay */}
                {imgLoaded && imgSize.w > 0 && (measureA || measureB) && (
                    <svg
                        style={{
                            position: 'absolute', inset: 0,
                            width: imgSize.w, height: imgSize.h,
                            overflow: 'visible',
                            pointerEvents: 'none',
                        }}
                    >
                        {/* Line */}
                        {measureA && measureB && (
                            <line
                                x1={measureA.x * imgSize.w} y1={measureA.y * imgSize.h}
                                x2={measureB.x * imgSize.w} y2={measureB.y * imgSize.h}
                                stroke="#f0b429"
                                strokeWidth={Math.max(0.5, 2 / s)}
                                strokeDasharray={`${8 / s} ${5 / s}`}
                                strokeLinecap="round"
                            />
                        )}

                        {/* Endpoint circles */}
                        {[measureA, measureB].filter(Boolean).map((pt, i) => (
                            <g key={i}>
                                <circle
                                    cx={pt.x * imgSize.w} cy={pt.y * imgSize.h}
                                    r={7 / s}
                                    fill="#f0b429" stroke="#000"
                                    strokeWidth={2 / s}
                                />
                                <text
                                    x={pt.x * imgSize.w + 11 / s}
                                    y={pt.y * imgSize.h - 9 / s}
                                    fill="#f0b429"
                                    fontSize={14 / s}
                                    fontWeight="bold"
                                    style={{ paintOrder: 'stroke', stroke: '#000', strokeWidth: 3 / s }}
                                >
                                    {i === 0 ? 'A' : 'B'}
                                </text>
                            </g>
                        ))}
                    </svg>
                )}

                {/* Calibration SVG overlay (purple) */}
                {imgLoaded && imgSize.w > 0 && (calA || calB) && (
                    <svg
                        style={{
                            position: 'absolute', inset: 0,
                            width: imgSize.w, height: imgSize.h,
                            overflow: 'visible', pointerEvents: 'none',
                        }}
                    >
                        {calA && calB && (
                            <line
                                x1={calA.x * imgSize.w} y1={calA.y * imgSize.h}
                                x2={calB.x * imgSize.w} y2={calB.y * imgSize.h}
                                stroke="#9c27b0"
                                strokeWidth={Math.max(0.5, 2 / s)}
                                strokeDasharray={`${6 / s} ${4 / s}`}
                                strokeLinecap="round"
                            />
                        )}
                        {[calA, calB].filter(Boolean).map((pt, i) => (
                            <g key={i}>
                                <circle
                                    cx={pt.x * imgSize.w} cy={pt.y * imgSize.h}
                                    r={8 / s}
                                    fill="#9c27b0" stroke="#fff" strokeWidth={2 / s}
                                />
                                <text
                                    x={pt.x * imgSize.w + 12 / s}
                                    y={pt.y * imgSize.h - 10 / s}
                                    fill="#ce93d8" fontSize={14 / s} fontWeight="bold"
                                    style={{ paintOrder: 'stroke', stroke: '#000', strokeWidth: 3 / s }}
                                >
                                    {i + 1}
                                </text>
                            </g>
                        ))}
                    </svg>
                )}

                {/* Slot for extra GM overlays */}
                {extraOverlay}
            </div>

            {/* ── Fixed overlays (outside transform) ── */}

            {/* Measure distance label */}
            {measureLabel && (
                <div style={{
                    position: 'absolute', top: 10, left: '50%',
                    transform: 'translateX(-50%)',
                    background: 'rgba(0,0,0,0.88)', color: '#f0b429',
                    padding: '5px 16px', borderRadius: 20,
                    fontSize: '0.88em', fontWeight: 'bold',
                    pointerEvents: 'none', zIndex: 20,
                    border: '1px solid rgba(240,180,41,0.35)',
                    whiteSpace: 'nowrap',
                }}>
                    📏 {measureLabel}
                </div>
            )}

            {/* No image placeholder */}
            {!map?.imageUrl && (
                <div style={{
                    position: 'absolute', inset: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexDirection: 'column', color: '#2a2a30', gap: 12,
                    pointerEvents: 'none',
                }}>
                    <span style={{ fontSize: '4em' }}>🏔️</span>
                    <span style={{ fontSize: '0.85em', color: '#444' }}>No map image — add one in GM Maps settings</span>
                </div>
            )}

            {/* Reset view button */}
            <button
                onClick={(e) => { e.stopPropagation(); fitToScreen(); }}
                title="Reset view (fit to screen)"
                style={{
                    position: 'absolute', bottom: 12, right: 12,
                    background: 'rgba(0,0,0,0.65)', border: '1px solid #444',
                    color: '#ccc', borderRadius: 6, width: 34, height: 34,
                    cursor: 'pointer', fontSize: '1.1em', zIndex: 10,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
            >
                ⟳
            </button>

            {/* Zoom level badge */}
            <div style={{
                position: 'absolute', bottom: 12, left: 12,
                background: 'rgba(0,0,0,0.55)', color: '#666',
                padding: '3px 8px', borderRadius: 4,
                fontSize: '0.72em', pointerEvents: 'none', zIndex: 10,
                fontVariantNumeric: 'tabular-nums',
            }}>
                {Math.round(s * 100)}%
            </div>
        </div>
    );
}
