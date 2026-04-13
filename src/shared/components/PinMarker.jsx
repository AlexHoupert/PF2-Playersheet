import React, { useState } from 'react';

/**
 * A single map pin rendered as a positioned element inside the map image div.
 * Coordinates are 0-1 fractions of image dimensions.
 * Counter-scales against the map's current zoom so pins stay the same visual size.
 */
export default function PinMarker({ pin, scale = 1, onClick }) {
    const [hovered, setHovered] = useState(false);

    // Counter-scale: keeps pin at constant visual size as the map zooms
    const cs = 1 / Math.max(0.05, scale);

    return (
        <div
            onClick={(e) => { e.stopPropagation(); onClick?.(pin); }}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
                position: 'absolute',
                left: `${pin.x * 100}%`,
                top: `${pin.y * 100}%`,
                transform: `translate(-50%, -100%) scale(${cs})`,
                transformOrigin: 'bottom center',
                cursor: 'pointer',
                userSelect: 'none',
                zIndex: hovered ? 30 : 10,
                pointerEvents: 'all',
                transition: 'filter 0.1s',
                filter: hovered ? 'brightness(1.3) drop-shadow(0 2px 6px rgba(0,0,0,0.9))' : 'drop-shadow(0 1px 4px rgba(0,0,0,0.8))',
            }}
        >
            {/* Pin head */}
            {pin.imageUrl ? (
                <img
                    src={pin.imageUrl}
                    alt={pin.label || ''}
                    style={{
                        width: 36, height: 36,
                        borderRadius: '50%',
                        border: '2px solid #c5a059',
                        objectFit: 'cover',
                        display: 'block',
                    }}
                />
            ) : (
                <div style={{ fontSize: 28, lineHeight: 1, textAlign: 'center' }}>
                    {pin.icon || '📍'}
                </div>
            )}

            {/* Label tooltip — shown on hover or always if no icon image */}
            {pin.label && (
                <div style={{
                    position: 'absolute',
                    bottom: 'calc(100% + 4px)',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: 'rgba(0,0,0,0.85)',
                    color: '#e0e0e0',
                    padding: '3px 8px',
                    borderRadius: 4,
                    fontSize: 12,
                    whiteSpace: 'nowrap',
                    pointerEvents: 'none',
                    border: '1px solid rgba(255,255,255,0.1)',
                    opacity: hovered ? 1 : 0.75,
                    transition: 'opacity 0.15s',
                }}>
                    {pin.label}
                </div>
            )}

            {/* Stem (small triangle pointing down) */}
            <div style={{
                width: 0, height: 0,
                margin: '0 auto',
                borderLeft: '5px solid transparent',
                borderRight: '5px solid transparent',
                borderTop: `8px solid ${pin.imageUrl ? '#c5a059' : 'transparent'}`,
            }} />
        </div>
    );
}
