import React, { useState, useEffect, useCallback } from 'react';
import { useCampaign } from '../../shared/context/CampaignContext';
import { useWindowSize } from '../../shared/hooks/useWindowSize';
import MapViewer from '../../shared/components/MapViewer';
import BottomSheet from '../../shared/components/BottomSheet';

// ── Pin detail ─────────────────────────────────────────────────────────────────

function PinDetail({ pin, onClose }) {
    if (!pin) return null;
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: '1.8em' }}>{pin.icon || '📍'}</span>
                <strong style={{ fontSize: '1.05em', color: '#e0e0e0', flex: 1 }}>
                    {pin.label || '(untitled)'}
                </strong>
                <button
                    onClick={onClose}
                    style={{ background: 'none', border: 'none', color: '#666', fontSize: '1.2em', cursor: 'pointer', padding: 4 }}
                >✕</button>
            </div>

            {pin.imageUrl && (
                <img
                    src={pin.imageUrl}
                    alt={pin.label || ''}
                    style={{ maxWidth: '100%', borderRadius: 6, maxHeight: 200, objectFit: 'contain' }}
                />
            )}

            {pin.description && (
                <p style={{ margin: 0, color: '#aaa', fontSize: '0.9em', lineHeight: 1.6 }}>
                    {pin.description}
                </p>
            )}

            {pin.link && (
                <a
                    href={pin.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: '#c5a059', fontSize: '0.85em', wordBreak: 'break-all' }}
                >
                    🔗 {pin.link}
                </a>
            )}
        </div>
    );
}

// ── Map tab bar ────────────────────────────────────────────────────────────────

function MapTabs({ maps, selectedId, onSelect }) {
    return (
        <div style={{
            display: 'flex',
            overflowX: 'auto',
            background: '#111',
            borderBottom: '1px solid #1e1e22',
            scrollbarWidth: 'none',
            flexShrink: 0,
        }}>
            {maps.map(map => {
                const active = selectedId === map.id;
                return (
                    <button
                        key={map.id}
                        onClick={() => onSelect(map.id)}
                        style={{
                            flexShrink: 0,
                            padding: '9px 18px',
                            background: 'none', border: 'none',
                            borderBottom: active ? '2px solid #c5a059' : '2px solid transparent',
                            color: active ? '#c5a059' : '#666',
                            fontWeight: active ? 'bold' : 'normal',
                            cursor: 'pointer',
                            fontSize: '0.88em',
                            whiteSpace: 'nowrap',
                            transition: 'color 0.15s',
                        }}
                    >
                        {map.name}
                    </button>
                );
            })}
        </div>
    );
}

// ── Toolbar ────────────────────────────────────────────────────────────────────

function Toolbar({ mode, onMode, measureA, measureB, onClearMeasure, onFullscreen, isFullscreen }) {
    const hasMeasure = measureA || measureB;

    const btn = (id, label, title) => (
        <button
            onClick={() => onMode(id)}
            title={title}
            style={{
                padding: '6px 12px',
                background: mode === id ? 'rgba(197,160,89,0.2)' : 'transparent',
                border: `1px solid ${mode === id ? '#c5a059' : '#333'}`,
                color: mode === id ? '#c5a059' : '#777',
                borderRadius: 4, cursor: 'pointer', fontSize: '0.82em',
                fontWeight: mode === id ? 'bold' : 'normal',
                transition: 'all 0.15s',
            }}
        >
            {label}
        </button>
    );

    return (
        <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '5px 10px',
            background: '#0e0e12',
            borderBottom: '1px solid #1a1a1a',
            flexShrink: 0, flexWrap: 'wrap',
        }}>
            {btn('pan',     '🖐 Pan',     'Click and drag to pan')}
            {btn('measure', '📏 Measure', 'Click two points to measure distance')}

            {mode === 'measure' && (
                <span style={{ fontSize: '0.76em', color: '#444' }}>
                    {!measureA ? 'Click A' : !measureB ? 'Click B' : 'Click to restart'}
                </span>
            )}

            {hasMeasure && (
                <button
                    onClick={onClearMeasure}
                    title="Clear measurement"
                    style={{
                        padding: '5px 9px', background: 'none',
                        border: '1px solid #2a2a2a', color: '#555',
                        borderRadius: 4, cursor: 'pointer', fontSize: '0.8em',
                    }}
                >✕ Clear</button>
            )}

            <div style={{ flex: 1 }} />

            <button
                onClick={onFullscreen}
                title={isFullscreen ? 'Exit fullscreen (F)' : 'Fullscreen (F)'}
                style={{
                    padding: '5px 9px', background: 'none',
                    border: '1px solid #2a2a2a', color: '#555',
                    borderRadius: 4, cursor: 'pointer', fontSize: '0.85em',
                }}
            >
                {isFullscreen ? '⛶' : '⛶'}
                {isFullscreen ? ' Exit' : ' Full'}
            </button>
        </div>
    );
}

// ── Prev/Next navigation arrows ────────────────────────────────────────────────

function MapNavArrows({ maps, selectedId, onSelect }) {
    const idx  = maps.findIndex(m => m.id === selectedId);
    const prev = idx > 0 ? maps[idx - 1] : null;
    const next = idx < maps.length - 1 ? maps[idx + 1] : null;

    const arrowStyle = (side) => ({
        position: 'absolute',
        top: '50%',
        [side]: 8,
        transform: 'translateY(-50%)',
        background: 'rgba(0,0,0,0.6)',
        border: '1px solid #333',
        color: '#888',
        borderRadius: 6,
        width: 32, height: 48,
        cursor: 'pointer',
        fontSize: '1.1em',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 5,
        pointerEvents: 'all',
        transition: 'background 0.15s, color 0.15s',
    });

    return (
        <>
            {prev && (
                <button
                    onClick={() => onSelect(prev.id)}
                    title={`← ${prev.name}`}
                    style={arrowStyle('left')}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.85)'; e.currentTarget.style.color = '#c5a059'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.6)';  e.currentTarget.style.color = '#888'; }}
                >‹</button>
            )}
            {next && (
                <button
                    onClick={() => onSelect(next.id)}
                    title={`${next.name} →`}
                    style={arrowStyle('right')}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.85)'; e.currentTarget.style.color = '#c5a059'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.6)';  e.currentTarget.style.color = '#888'; }}
                >›</button>
            )}
            {/* Map counter badge */}
            {maps.length > 1 && (
                <div style={{
                    position: 'absolute', bottom: 48, left: '50%',
                    transform: 'translateX(-50%)',
                    background: 'rgba(0,0,0,0.6)', color: '#555',
                    padding: '2px 10px', borderRadius: 10,
                    fontSize: '0.72em', pointerEvents: 'none', zIndex: 5,
                }}>
                    {maps.findIndex(m => m.id === selectedId) + 1} / {maps.length}
                </div>
            )}
        </>
    );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function MapsView() {
    const { activeCampaign, isGM } = useCampaign();
    const { isMobile } = useWindowSize();

    const [selectedMapId, setSelectedMapId] = useState(null);
    const [mode, setMode]               = useState('pan');
    const [measureA, setMeasureA]       = useState(null);
    const [measureB, setMeasureB]       = useState(null);
    const [selectedPin, setSelectedPin] = useState(null);
    const [fullscreen, setFullscreen]   = useState(false);

    // Filter maps
    const allMaps = activeCampaign?.maps || [];
    const maps = isGM ? allMaps : allMaps.filter(m => m.visibleToPlayers);

    // Auto-select first available map (or keep selection valid)
    useEffect(() => {
        if (maps.length > 0 && (!selectedMapId || !maps.find(m => m.id === selectedMapId))) {
            setSelectedMapId(maps[0].id);
        }
    }, [maps, selectedMapId]);

    const selectedMap = maps.find(m => m.id === selectedMapId) || null;

    // ── Navigation helpers ────────────────────────────────────────────────────
    const selectMap = useCallback((id) => {
        setSelectedMapId(id);
        setMeasureA(null);
        setMeasureB(null);
        setSelectedPin(null);
    }, []);

    const navigateMaps = useCallback((dir) => {
        const idx = maps.findIndex(m => m.id === selectedMapId);
        const next = maps[idx + dir];
        if (next) selectMap(next.id);
    }, [maps, selectedMapId, selectMap]);

    // ── Measure logic ─────────────────────────────────────────────────────────
    const handleMapClick = useCallback((fraction) => {
        if (mode !== 'measure') return;
        if (!measureA)      { setMeasureA(fraction); }
        else if (!measureB) { setMeasureB(fraction); }
        else                { setMeasureA(fraction); setMeasureB(null); }
    }, [mode, measureA, measureB]);

    const clearMeasure = useCallback(() => { setMeasureA(null); setMeasureB(null); }, []);

    const handleModeChange = useCallback((m) => {
        setMode(m);
        if (m !== 'measure') clearMeasure();
    }, [clearMeasure]);

    // ── Keyboard shortcuts ────────────────────────────────────────────────────
    useEffect(() => {
        const handler = (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            if (e.key === 'ArrowRight') navigateMaps(1);
            if (e.key === 'ArrowLeft')  navigateMaps(-1);
            if (e.key === 'f' || e.key === 'F') setFullscreen(f => !f);
            if (e.key === 'Escape') { setFullscreen(false); setSelectedPin(null); }
            if (e.key === 'p' || e.key === 'P') handleModeChange('pan');
            if (e.key === 'm' || e.key === 'M') handleModeChange('measure');
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [navigateMaps, handleModeChange]);

    // ── Empty states ──────────────────────────────────────────────────────────
    if (!activeCampaign) {
        return (
            <div style={{ padding: 40, textAlign: 'center', color: '#555' }}>
                <div style={{ fontSize: '3em', marginBottom: 12 }}>🗺️</div>
                <p>No active campaign.</p>
            </div>
        );
    }

    if (maps.length === 0) {
        return (
            <div style={{ padding: 40, textAlign: 'center', color: '#555' }}>
                <div style={{ fontSize: '3em', marginBottom: 12 }}>🗺️</div>
                <h3 style={{ color: '#666', marginBottom: 8 }}>No maps available</h3>
                <p style={{ fontSize: '0.9em' }}>
                    {isGM
                        ? 'Create a map in the GM Maps panel (Story → Maps) and mark it visible.'
                        : 'Your GM hasn\'t shared any maps yet.'}
                </p>
            </div>
        );
    }

    // ── Pin detail: BottomSheet on mobile, side panel on desktop ─────────────
    const pinDetailContent = selectedPin
        ? <PinDetail pin={selectedPin} onClose={() => setSelectedPin(null)} />
        : null;

    // ── Viewer area (shared between fullscreen and normal layout) ─────────────
    const viewerArea = (
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
            <MapViewer
                map={selectedMap}
                mode={mode}
                showAllPins={isGM}
                measureA={measureA}
                measureB={measureB}
                onPinClick={setSelectedPin}
                onMapClick={handleMapClick}
            />

            {/* Prev/Next arrows */}
            {maps.length > 1 && (
                <MapNavArrows maps={maps} selectedId={selectedMapId} onSelect={selectMap} />
            )}

            {/* Desktop pin detail side panel */}
            {!isMobile && selectedPin && (
                <div style={{
                    width: 300, flexShrink: 0,
                    borderLeft: '1px solid #1a1a1a',
                    overflowY: 'auto', padding: 16,
                    background: '#0e0e12',
                }}>
                    {pinDetailContent}
                </div>
            )}

            {/* Fullscreen overlay controls (top-right corner) */}
            {fullscreen && (
                <div style={{
                    position: 'absolute', top: 10, right: 48,
                    display: 'flex', gap: 6, zIndex: 10,
                }}>
                    <div style={{
                        background: 'rgba(0,0,0,0.7)', border: '1px solid #2a2a2a',
                        borderRadius: 6, padding: '4px 10px',
                        display: 'flex', gap: 6,
                    }}>
                        {['pan', 'measure'].map(m => (
                            <button
                                key={m}
                                onClick={() => handleModeChange(m)}
                                style={{
                                    background: mode === m ? 'rgba(197,160,89,0.25)' : 'none',
                                    border: `1px solid ${mode === m ? '#c5a059' : '#333'}`,
                                    color: mode === m ? '#c5a059' : '#666',
                                    borderRadius: 4, padding: '4px 9px',
                                    cursor: 'pointer', fontSize: '0.78em',
                                }}
                            >
                                {m === 'pan' ? '🖐' : '📏'}
                            </button>
                        ))}
                        {(measureA || measureB) && (
                            <button onClick={clearMeasure}
                                style={{ background: 'none', border: '1px solid #2a2a2a', color: '#555', borderRadius: 4, padding: '4px 8px', cursor: 'pointer', fontSize: '0.78em' }}>
                                ✕
                            </button>
                        )}
                    </div>
                    <button
                        onClick={() => setFullscreen(false)}
                        title="Exit fullscreen (Esc)"
                        style={{
                            background: 'rgba(0,0,0,0.7)', border: '1px solid #2a2a2a',
                            color: '#777', borderRadius: 6, padding: '4px 10px',
                            cursor: 'pointer', fontSize: '0.8em',
                        }}
                    >✕ Exit</button>
                </div>
            )}
        </div>
    );

    // ── Fullscreen mode: covers entire viewport ───────────────────────────────
    if (fullscreen) {
        return (
            <div style={{
                position: 'fixed', inset: 0, zIndex: 100,
                background: '#080810',
                display: 'flex', flexDirection: 'column',
            }}>
                {/* Slim map name bar */}
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: '4px 8px', background: 'rgba(0,0,0,0.7)',
                    borderBottom: '1px solid #111', flexShrink: 0, gap: 12,
                }}>
                    {maps.length > 1 && maps.map(m => (
                        <button key={m.id} onClick={() => selectMap(m.id)} style={{
                            background: 'none', border: 'none',
                            color: m.id === selectedMapId ? '#c5a059' : '#444',
                            fontSize: '0.8em', cursor: 'pointer', padding: '2px 6px',
                            fontWeight: m.id === selectedMapId ? 'bold' : 'normal',
                        }}>{m.name}</button>
                    ))}
                    {maps.length === 1 && (
                        <span style={{ color: '#555', fontSize: '0.8em' }}>{selectedMap?.name}</span>
                    )}
                </div>
                {viewerArea}

                {/* Mobile pin sheet inside fullscreen */}
                {isMobile && (
                    <BottomSheet isOpen={!!selectedPin} onClose={() => setSelectedPin(null)}
                        title={selectedPin?.label || 'Location'} height="50vh">
                        <div style={{ padding: '0 16px 16px' }}>{pinDetailContent}</div>
                    </BottomSheet>
                )}
            </div>
        );
    }

    // ── Normal layout ─────────────────────────────────────────────────────────
    return (
        <div style={{
            display: 'flex', flexDirection: 'column',
            height: '100%', overflow: 'hidden',
            background: '#080810',
        }}>
            <MapTabs maps={maps} selectedId={selectedMapId} onSelect={selectMap} />

            <Toolbar
                mode={mode}
                onMode={handleModeChange}
                measureA={measureA}
                measureB={measureB}
                onClearMeasure={clearMeasure}
                onFullscreen={() => setFullscreen(true)}
                isFullscreen={false}
            />

            {viewerArea}

            {/* Mobile pin detail BottomSheet */}
            {isMobile && (
                <BottomSheet
                    isOpen={!!selectedPin}
                    onClose={() => setSelectedPin(null)}
                    title={selectedPin?.label || 'Location'}
                    height="50vh"
                >
                    <div style={{ padding: '0 16px 16px' }}>{pinDetailContent}</div>
                </BottomSheet>
            )}
        </div>
    );
}
