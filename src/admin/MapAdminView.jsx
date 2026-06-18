import React, { useState, useRef } from 'react';
import { useCampaign } from '../shared/context/CampaignContext';
import { useWindowSize } from '../shared/hooks/useWindowSize';
import MapViewer from '../shared/components/MapViewer';
import PinEditorModal from '../shared/components/PinEditorModal';

// ── Helpers ──────────────────────────────────────────────────────────────────

function uuid() {
    return crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function makeMap(name) {
    return {
        id: uuid(),
        name,
        imageUrl: '',
        visibleToPlayers: false,
        order: Date.now(),
        scale: null,
        pins: [],
    };
}

// ── Styles ────────────────────────────────────────────────────────────────────

const S = {
    root: { display: 'flex', height: '100%', overflow: 'hidden', color: '#e0e0e0', gap: 0 },
    listPanel: {
        width: 260, minWidth: 220,
        background: '#1a1a1d', borderRight: '1px solid #333',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
    },
    listHeader: {
        padding: '14px 16px 10px', borderBottom: '1px solid #333',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    },
    listTitle: { margin: 0, fontSize: '1em', fontWeight: 'bold', color: '#c5a059' },
    listScroll: { flex: 1, overflowY: 'auto', padding: '8px 0' },
    listItem: (selected, visible) => ({
        display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', cursor: 'pointer',
        background: selected ? 'rgba(197,160,89,0.15)' : 'transparent',
        borderLeft: selected ? '3px solid #c5a059' : '3px solid transparent',
        transition: 'background 0.15s', opacity: visible ? 1 : 0.5,
    }),
    listItemName: (selected) => ({
        flex: 1, fontSize: '0.9em',
        color: selected ? '#c5a059' : '#e0e0e0',
        fontWeight: selected ? 'bold' : 'normal',
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
    }),
    createRow: { padding: '10px 12px', borderTop: '1px solid #333', display: 'flex', gap: 6 },
    editorPanel: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#111' },
    editorHeader: {
        padding: '14px 20px 10px', borderBottom: '1px solid #333',
        display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
    },
    editorScroll: { flex: 1, overflowY: 'auto', padding: 20 },
    field: { marginBottom: 18 },
    label: { display: 'block', fontSize: '0.8em', color: '#888', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em' },
    input: {
        width: '100%', padding: '8px 10px', background: '#1e1e22',
        border: '1px solid #444', borderRadius: 4, color: '#e0e0e0',
        fontSize: '0.9em', boxSizing: 'border-box',
    },
    previewBox: {
        width: '100%', aspectRatio: '16/9', background: '#0a0a0c',
        border: '1px solid #333', borderRadius: 6,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden', position: 'relative',
    },
    scaleBox: { background: '#1a1a1d', border: '1px solid #333', borderRadius: 6, padding: 14 },
    tag: (active) => ({
        display: 'inline-block', padding: '2px 8px', borderRadius: 12,
        fontSize: '0.75em', fontWeight: 'bold',
        background: active ? 'rgba(76,175,80,0.2)' : 'rgba(255,255,255,0.06)',
        color: active ? '#81c784' : '#888',
        border: `1px solid ${active ? '#388e3c' : '#444'}`,
    }),
    btnGold: {
        background: '#c5a059', border: 'none', color: '#000',
        fontWeight: 'bold', padding: '7px 14px', borderRadius: 4, cursor: 'pointer', fontSize: '0.85em',
    },
    btnGhost: {
        background: 'transparent', border: '1px solid #444', color: '#aaa',
        padding: '7px 14px', borderRadius: 4, cursor: 'pointer', fontSize: '0.85em',
    },
    btnBlue: {
        background: 'rgba(33,150,243,0.15)', border: '1px solid #1565c0', color: '#64b5f6',
        padding: '7px 14px', borderRadius: 4, cursor: 'pointer', fontSize: '0.85em', fontWeight: 'bold',
    },
    btnDanger: {
        background: 'transparent', border: '1px solid #c62828', color: '#ef5350',
        padding: '7px 14px', borderRadius: 4, cursor: 'pointer', fontSize: '0.85em',
    },
    btnSmall: {
        background: '#2a2a2e', border: '1px solid #444', color: '#ccc',
        padding: '5px 10px', borderRadius: 4, cursor: 'pointer', fontSize: '0.8em',
    },
    toggle: { display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' },
    divider: { borderTop: '1px solid #2a2a2e', margin: '20px 0' },
    pinRow: {
        display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
        background: '#1a1a1d', borderRadius: 4, marginBottom: 6,
    },
    empty: { color: '#555', fontStyle: 'italic', fontSize: '0.85em', textAlign: 'center', padding: 20 },
};

// ── Upload helper ─────────────────────────────────────────────────────────────

async function uploadMapImage(file) {
    // Always read as base64 first (needed for both server upload and inline fallback)
    const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target.result); // full data URL including prefix
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });

    // Try server upload via base64 endpoint (no multipart deps required)
    try {
        const ext      = file.name.includes('.') ? file.name.split('.').pop().toLowerCase() : 'jpg';
        const filename = `map_${Date.now()}.${ext}`;
        const res = await fetch('/api/files/upload-base64', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename, base64, directory: 'maps' }),
        });
        if (res.ok) {
            const json = await res.json();
            return json.path; // e.g. /api/static/maps/map_1234567890.jpg
        }
    } catch (_) { /* server unavailable — fall through to inline */ }

    // Fallback: store the data URL inline in the db (warn if large)
    if (file.size > 2 * 1024 * 1024) {
        const mb = (file.size / 1024 / 1024).toFixed(1);
        if (!window.confirm(
            `Server upload failed. The image (${mb} MB) will be stored inline.\n` +
            `This may slow cloud syncing for large images. Continue?`
        )) {
            throw new Error('Cancelled');
        }
    }
    return base64;
}

// ── Scale display ─────────────────────────────────────────────────────────────

function ScaleInfo({ scale }) {
    if (!scale) {
        return (
            <div style={{ fontSize: '0.82em', color: '#555', fontStyle: 'italic' }}>
                Not calibrated — open the viewer and use 📐 Calibrate Scale to set it up.
            </div>
        );
    }
    return (
        <div style={{ fontSize: '0.85em', color: '#aaa', lineHeight: 1.9 }}>
            <div>
                <span style={{ color: '#666' }}>Calibration span: </span>
                <strong style={{ color: '#e0e0e0' }}>{scale.realDistance} {scale.unit}</strong>
            </div>
            <div>
                <span style={{ color: '#666' }}>Points stored: </span>
                <strong style={{ color: '#e0e0e0' }}>
                    ({scale.pointA.x.toFixed(3)}, {scale.pointA.y.toFixed(3)}) →
                    ({scale.pointB.x.toFixed(3)}, {scale.pointB.y.toFixed(3)})
                </strong>
            </div>
            <div style={{ marginTop: 6, fontSize: '0.9em', color: '#666' }}>
                Distance measurement is active. Open the map viewer to measure.
            </div>
        </div>
    );
}

// ── Calibration distance dialog ────────────────────────────────────────────────

const CAL_UNITS = ['leagues', 'km', 'miles', 'hexes', 'days travel', 'ft', 'm', 'au', 'parsecs'];

function CalibrationDialog({ onSave, onCancel }) {
    const [realDist, setRealDist] = useState('');
    const [unit, setUnit]         = useState('leagues');

    const handleSave = () => {
        const dist = parseFloat(realDist);
        if (!dist || dist <= 0) return;
        onSave(dist, unit);
    };

    return (
        <div style={{
            position: 'absolute', inset: 0, zIndex: 10,
            background: 'rgba(0,0,0,0.75)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
            <div style={{
                background: '#141418', border: '1px solid #444', borderRadius: 10,
                padding: 24, width: 'min(380px, 90vw)',
                display: 'flex', flexDirection: 'column', gap: 16,
            }}>
                <div>
                    <h3 style={{ margin: '0 0 6px', color: '#ce93d8' }}>📐 Set Scale</h3>
                    <p style={{ margin: 0, fontSize: '0.85em', color: '#888' }}>
                        What is the real-world distance between points 1 and 2?
                    </p>
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                    <input
                        type="number"
                        value={realDist}
                        onChange={e => setRealDist(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSave()}
                        placeholder="e.g. 500"
                        autoFocus
                        style={{
                            flex: 1, padding: '9px 10px',
                            background: '#1e1e22', border: '1px solid #555',
                            borderRadius: 4, color: '#e0e0e0', fontSize: '1em',
                        }}
                    />
                    <select
                        value={unit}
                        onChange={e => setUnit(e.target.value)}
                        style={{
                            padding: '9px 10px',
                            background: '#1e1e22', border: '1px solid #555',
                            borderRadius: 4, color: '#e0e0e0', fontSize: '0.9em',
                        }}
                    >
                        {CAL_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                </div>

                <div style={{ fontSize: '0.78em', color: '#555' }}>
                    Example: if the two points span a 500-league distance on the map, enter 500 and select "leagues".
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                    <button
                        onClick={handleSave}
                        disabled={!realDist || parseFloat(realDist) <= 0}
                        style={{
                            flex: 1, padding: 10,
                            background: '#9c27b0', border: 'none', color: '#fff',
                            fontWeight: 'bold', borderRadius: 4, cursor: 'pointer',
                            opacity: !realDist || parseFloat(realDist) <= 0 ? 0.5 : 1,
                        }}
                    >
                        Save Calibration
                    </button>
                    <button
                        onClick={onCancel}
                        style={{
                            padding: '10px 16px',
                            background: 'none', border: '1px solid #444', color: '#aaa',
                            borderRadius: 4, cursor: 'pointer',
                        }}
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── Full-screen viewer overlay ────────────────────────────────────────────────

function MapViewerOverlay({ map, onClose, onSavePin, onDeletePin, onSaveScale }) {
    const [viewerMode, setViewerMode] = useState('pan');

    // Pin editing state
    const [editorOpen, setEditorOpen] = useState(false);
    const [editingPin, setEditingPin] = useState(null);
    const [pendingPos, setPendingPos] = useState(null);

    // Calibration state
    const [calA, setCalA]           = useState(null);
    const [calB, setCalB]           = useState(null);
    const [calDialog, setCalDialog] = useState(false);
    const [imgSize, setImgSize]     = useState({ w: 0, h: 0 });

    // ── Mode switch: reset calibration/measure state ────────────────────────
    const switchMode = (newMode) => {
        setViewerMode(newMode);
        if (newMode !== 'calibrate') { setCalA(null); setCalB(null); setCalDialog(false); }
        if (newMode !== 'pin') { setEditorOpen(false); setEditingPin(null); setPendingPos(null); }
    };

    // ── Keyboard shortcuts ──────────────────────────────────────────────────
    React.useEffect(() => {
        const handler = (e) => {
            // Don't fire when typing in an input
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
            if (e.key === 'Escape') { if (calDialog) { setCalDialog(false); setCalA(null); setCalB(null); } else if (editorOpen) { setEditorOpen(false); setEditingPin(null); setPendingPos(null); } else { onClose(); } }
            if (e.key === 'p' || e.key === 'P') switchMode('pan');
            if (e.key === 'n' || e.key === 'N') switchMode('pin');
            if (e.key === 'c' || e.key === 'C') switchMode('calibrate');
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [calDialog, editorOpen, onClose]);

    // ── Unified map-click dispatcher ────────────────────────────────────────
    const handleMapClick = (fraction) => {
        if (viewerMode === 'pin') {
            setEditingPin(null);
            setPendingPos(fraction);
            setEditorOpen(true);
        } else if (viewerMode === 'calibrate') {
            if (!calA) {
                setCalA(fraction);
            } else if (!calB) {
                setCalB(fraction);
                setCalDialog(true);
            } else {
                // Third click: restart calibration
                setCalA(fraction);
                setCalB(null);
                setCalDialog(false);
            }
        }
    };

    // ── Pin handlers ────────────────────────────────────────────────────────
    const openEditPin = (pin) => { setEditingPin(pin); setPendingPos(null); setEditorOpen(true); };

    const handlePinSave = (savedPin) => {
        onSavePin(savedPin, !!editingPin);
        setEditorOpen(false); setEditingPin(null); setPendingPos(null);
    };

    const handlePinDelete = (pinId) => {
        onDeletePin(pinId);
        setEditorOpen(false); setEditingPin(null);
    };

    // ── Calibration save ────────────────────────────────────────────────────
    const handleCalSave = (realDistance, unit) => {
        onSaveScale({ pointA: calA, pointB: calB, realDistance, unit });
        setCalA(null); setCalB(null); setCalDialog(false);
        switchMode('pan');
    };

    // ── Toolbar button ──────────────────────────────────────────────────────
    const modeBtn = (id, icon, label, activeColor = '#c5a059') => (
        <button
            key={id}
            onClick={() => switchMode(id)}
            style={{
                padding: '6px 12px',
                background: viewerMode === id ? `rgba(${activeColor === '#c5a059' ? '197,160,89' : '156,39,176'},0.2)` : 'transparent',
                border: `1px solid ${viewerMode === id ? activeColor : '#444'}`,
                color: viewerMode === id ? activeColor : '#aaa',
                borderRadius: 4, cursor: 'pointer', fontSize: '0.82em',
                fontWeight: viewerMode === id ? 'bold' : 'normal',
                transition: 'all 0.15s',
            }}
        >
            {icon} {label}
        </button>
    );

    // ── Toolbar hint text ───────────────────────────────────────────────────
    const hint = viewerMode === 'pin'
        ? 'Click map to add pin • Click existing pin to edit'
        : viewerMode === 'calibrate'
            ? !calA ? '① Click first calibration point'
            : !calB ? '② Click second calibration point'
            : 'Enter distance in the dialog'
        : null;

    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 150, background: '#080810', display: 'flex', flexDirection: 'column' }}>
            {/* Toolbar */}
            <div style={{
                display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
                padding: '8px 14px', background: '#111', borderBottom: '1px solid #333', flexShrink: 0,
            }}>
                <button onClick={onClose} style={{ ...S.btnGhost, padding: '6px 12px' }}>← Done</button>
                <div style={{ width: 1, height: 24, background: '#333', margin: '0 2px' }} />
                {modeBtn('pan', '🖐', 'Pan')}
                {modeBtn('pin', '📍', 'Place Pins')}
                {modeBtn('calibrate', '📐', 'Calibrate Scale', '#9c27b0')}
                {hint && <span style={{ fontSize: '0.78em', color: '#666', marginLeft: 4 }}>{hint}</span>}
                <div style={{ flex: 1 }} />
                <span style={{ fontSize: '0.72em', color: '#333', letterSpacing: '0.03em', display: 'flex', gap: 8 }}>
                    {['P pan', 'N pins', 'C cal', 'Esc close'].map(k => {
                        const [key, ...rest] = k.split(' ');
                        return <span key={k}><kbd style={{ background: '#222', border: '1px solid #3a3a3a', borderRadius: 3, padding: '1px 4px', color: '#555', fontFamily: 'monospace', fontSize: '0.9em' }}>{key}</kbd> <span style={{ color: '#3a3a3a' }}>{rest.join(' ')}</span></span>;
                    })}
                </span>
                <span style={{ fontSize: '0.82em', color: '#444', marginLeft: 8 }}>{map.name}</span>
            </div>

            {/* Viewer area */}
            <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
                <MapViewer
                    map={map}
                    mode={viewerMode}
                    showAllPins={true}
                    calA={calA}
                    calB={calB}
                    onPinClick={openEditPin}
                    onMapClick={handleMapClick}
                    onImageLoad={setImgSize}
                />

                {/* Calibration dialog rendered over the viewer */}
                {calDialog && calA && calB && (
                    <CalibrationDialog
                        onSave={handleCalSave}
                        onCancel={() => { setCalDialog(false); setCalA(null); setCalB(null); }}
                    />
                )}
            </div>

            {/* Pin editor modal */}
            {editorOpen && (
                <PinEditorModal
                    pin={editingPin}
                    position={pendingPos}
                    onSave={handlePinSave}
                    onDelete={editingPin ? handlePinDelete : null}
                    onClose={() => { setEditorOpen(false); setEditingPin(null); setPendingPos(null); }}
                />
            )}
        </div>
    );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function MapAdminView() {
    const { activeCampaign, activeCampaignId, dataActions } = useCampaign();
    const { isMobile } = useWindowSize();

    const [selectedMapId, setSelectedMapId] = useState(null);
    const [newMapName, setNewMapName]   = useState('');
    const [showList, setShowList]       = useState(true);
    const [viewerOpen, setViewerOpen]   = useState(false);
    const [uploadError, setUploadError] = useState(null);
    const [uploading, setUploading]     = useState(false);
    const fileInputRef = useRef(null);

    const campaignId = activeCampaignId || activeCampaign?.id;
    const maps = activeCampaign?.maps || [];
    const archivedMaps = activeCampaign?.archivedMaps || [];
    const selectedMap = maps.find(m => m.id === selectedMapId) || null;

    // ── Helpers ───────────────────────────────────────────────────────────────

    const runMapAction = (action) => {
        return Promise.resolve(action).catch(err => {
            console.error(err);
            alert(err?.message || String(err));
        });
    };

    const updateMap = (id, changes) => {
        if (!campaignId) return;
        runMapAction(dataActions.map.updateMap(campaignId, id, changes));
    };

    const handleCreate = () => {
        const name = newMapName.trim();
        if (!name || !campaignId) return;
        const action = dataActions.map.createMap(campaignId, name);
        runMapAction(action).then(id => {
            if (id) setSelectedMapId(id);
        });
        setNewMapName('');
        if (isMobile) setShowList(false);
    };

    const handleDelete = (id) => {
        if (!campaignId) return;
        if (!window.confirm('Archive this map? It can be restored later.')) return;
        runMapAction(dataActions.map.softDeleteMap(campaignId, id));
        if (selectedMapId === id) setSelectedMapId(null);
    };

    const handleRestore = (id) => {
        if (!campaignId) return;
        runMapAction(dataActions.map.restoreMap(campaignId, id));
        setSelectedMapId(id);
        if (isMobile) setShowList(false);
    };

    const handleMoveUp = (id) => {
        if (!campaignId) return;
        const idx = maps.findIndex(m => m.id === id);
        if (idx <= 0) return;
        const next = [...maps];
        [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
        runMapAction(dataActions.map.reorderMaps(campaignId, next.map(map => map.id)));
    };

    const handleMoveDown = (id) => {
        if (!campaignId) return;
        const idx = maps.findIndex(m => m.id === id);
        if (idx < 0 || idx >= maps.length - 1) return;
        const next = [...maps];
        [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
        runMapAction(dataActions.map.reorderMaps(campaignId, next.map(map => map.id)));
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file || !selectedMapId || !campaignId) return;
        setUploadError(null);
        setUploading(true);
        try {
            const url = await uploadMapImage(file);
            runMapAction(dataActions.map.setImageUrl(campaignId, selectedMapId, url));
        } catch (err) {
            if (err.message !== 'Cancelled') setUploadError(err.message || 'Upload failed');
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    // ── Pin save/delete handlers (called from viewer overlay) ─────────────────

    const handlePinSave = (savedPin, isEdit) => {
        if (!selectedMap || !campaignId) return;
        const pins = isEdit
            ? (selectedMap.pins || []).map(p => p.id === savedPin.id ? savedPin : p)
            : [...(selectedMap.pins || []), savedPin];
        const pinToSave = isEdit ? pins.find(p => p.id === savedPin.id) : savedPin;
        runMapAction(dataActions.map.upsertPin(campaignId, selectedMapId, pinToSave));
    };

    const handlePinDelete = (pinId) => {
        if (!selectedMap || !campaignId) return;
        runMapAction(dataActions.map.deletePin(campaignId, selectedMapId, pinId));
    };

    // ── Scale calibration save ─────────────────────────────────────────────────

    const handleSaveScale = (scale) => {
        if (!selectedMapId || !campaignId) return;
        runMapAction(dataActions.map.setScale(campaignId, selectedMapId, scale));
    };

    // ── No campaign guard ─────────────────────────────────────────────────────

    if (!activeCampaign) {
        return (
            <div style={{ padding: 40, textAlign: 'center', color: '#666' }}>
                <div style={{ fontSize: '2.5em', marginBottom: 12 }}>🗺️</div>
                <h3 style={{ color: '#888' }}>No active campaign</h3>
                <p>Select or create a campaign in Sessions first.</p>
            </div>
        );
    }

    // ── Full-screen viewer ────────────────────────────────────────────────────

    if (viewerOpen && selectedMap) {
        return (
            <MapViewerOverlay
                map={selectedMap}
                onClose={() => setViewerOpen(false)}
                onSavePin={handlePinSave}
                onDeletePin={handlePinDelete}
                onSaveScale={handleSaveScale}
            />
        );
    }

    // ── Map list panel ────────────────────────────────────────────────────────

    const listPanel = (
        <div style={isMobile ? { ...S.listPanel, width: '100%', borderRight: 'none', borderBottom: '1px solid #333' } : S.listPanel}>
            <div style={S.listHeader}>
                <h3 style={S.listTitle}>Maps</h3>
                <span style={{ color: '#555', fontSize: '0.8em' }}>{maps.length} map{maps.length !== 1 ? 's' : ''}</span>
            </div>

            <div style={S.listScroll}>
                {maps.length === 0 && <div style={S.empty}>No maps yet.<br />Create one below.</div>}
                {maps.map((map, idx) => (
                    <div
                        key={map.id}
                        style={S.listItem(selectedMapId === map.id, map.visibleToPlayers)}
                        onClick={() => { setSelectedMapId(map.id); if (isMobile) setShowList(false); }}
                    >
                        <div style={{
                            width: 36, height: 36, borderRadius: 3, overflow: 'hidden', flexShrink: 0,
                            background: '#0a0a0c', border: '1px solid #333',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                            {map.imageUrl
                                ? <img src={map.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                : <span style={{ fontSize: '1.2em', opacity: 0.4 }}>🗺️</span>
                            }
                        </div>

                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={S.listItemName(selectedMapId === map.id)}>{map.name}</div>
                            <div style={{ fontSize: '0.72em', color: '#555' }}>
                                {(map.pins || []).length} pin{(map.pins || []).length !== 1 ? 's' : ''} •{' '}
                                {map.visibleToPlayers ? <span style={{ color: '#66bb6a' }}>visible</span> : 'hidden'}
                            </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                            <button onClick={(e) => { e.stopPropagation(); handleMoveUp(map.id); }}
                                style={{ ...S.btnSmall, padding: '1px 5px', opacity: idx === 0 ? 0.2 : 1 }}
                                disabled={idx === 0} title="Move up">▲</button>
                            <button onClick={(e) => { e.stopPropagation(); handleMoveDown(map.id); }}
                                style={{ ...S.btnSmall, padding: '1px 5px', opacity: idx === maps.length - 1 ? 0.2 : 1 }}
                                disabled={idx === maps.length - 1} title="Move down">▼</button>
                        </div>
                    </div>
                ))}
                {archivedMaps.length > 0 && (
                    <div style={{ marginTop: 12, padding: '10px 14px', borderTop: '1px solid #333' }}>
                        <div style={{ fontSize: '0.75em', color: '#777', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                            Archived
                        </div>
                        {archivedMaps.map(map => (
                            <div key={map.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: '0.85em', color: '#999', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {map.name || '(untitled)'}
                                    </div>
                                    {map.deletedAt && (
                                        <div style={{ fontSize: '0.7em', color: '#555' }}>
                                            {new Date(map.deletedAt).toLocaleString()}
                                        </div>
                                    )}
                                </div>
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleRestore(map.id); }}
                                    style={{ ...S.btnSmall, color: '#81c784', borderColor: '#2e7d32' }}
                                    title="Restore map"
                                >
                                    Restore
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div style={S.createRow}>
                <input
                    value={newMapName}
                    onChange={e => setNewMapName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleCreate()}
                    placeholder="New map name..."
                    style={{ ...S.input, flex: 1, margin: 0 }}
                />
                <button onClick={handleCreate} style={S.btnGold} disabled={!newMapName.trim()}>+</button>
            </div>
        </div>
    );

    // ── Map editor panel ──────────────────────────────────────────────────────

    const editorPanel = (
        <div style={S.editorPanel}>
            {!selectedMap ? (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', color: '#555', gap: 12 }}>
                    <span style={{ fontSize: '3em' }}>🗺️</span>
                    <span>Select a map from the list to edit it.</span>
                </div>
            ) : (
                <>
                    <div style={S.editorHeader}>
                        {isMobile && (
                            <button onClick={() => setShowList(true)} style={S.btnGhost}>← Maps</button>
                        )}
                        <h3 style={{ margin: 0, flex: 1, color: '#c5a059', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {selectedMap.name}
                        </h3>
                        <button
                            onClick={() => setViewerOpen(true)}
                            style={S.btnBlue}
                            disabled={!selectedMap.imageUrl}
                            title={!selectedMap.imageUrl ? 'Add an image first' : 'Open full-screen map viewer'}
                        >
                            🗺️ Open Viewer
                        </button>
                        <button onClick={() => handleDelete(selectedMap.id)} style={S.btnDanger}>Delete</button>
                    </div>

                    <div style={S.editorScroll}>
                        {/* Name */}
                        <div style={S.field}>
                            <label style={S.label}>Map Name</label>
                            <input
                                style={S.input}
                                value={selectedMap.name}
                                onChange={e => updateMap(selectedMap.id, { name: e.target.value })}
                            />
                        </div>

                        {/* Visibility */}
                        <div style={S.field}>
                            <label style={S.label}>Player Visibility</label>
                            <label style={S.toggle}>
                                <input
                                    type="checkbox"
                                    checked={selectedMap.visibleToPlayers}
                                    onChange={e => updateMap(selectedMap.id, { visibleToPlayers: e.target.checked })}
                                />
                                <span style={S.tag(selectedMap.visibleToPlayers)}>
                                    {selectedMap.visibleToPlayers ? 'Visible to players' : 'Hidden from players'}
                                </span>
                            </label>
                        </div>

                        <div style={S.divider} />

                        {/* Image URL */}
                        <div style={S.field}>
                            <label style={S.label}>Map Image — URL</label>
                            <input
                                style={S.input}
                                placeholder="https://... or /api/static/maps/..."
                                value={selectedMap.imageUrl}
                                onChange={e => updateMap(selectedMap.id, { imageUrl: e.target.value })}
                            />
                        </div>

                        {/* File upload */}
                        <div style={S.field}>
                            <label style={S.label}>Map Image — Upload File</label>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                <input ref={fileInputRef} type="file" accept="image/*"
                                    style={{ display: 'none' }} onChange={handleFileUpload} />
                                <button style={S.btnGhost} onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                                    {uploading ? 'Uploading…' : '📁 Choose File'}
                                </button>
                                {uploadError && <span style={{ color: '#ef5350', fontSize: '0.8em' }}>{uploadError}</span>}
                            </div>
                            <div style={{ marginTop: 6, fontSize: '0.75em', color: '#555' }}>
                                Tries server upload first (ressources/maps/), falls back to base64.
                            </div>
                        </div>

                        {/* Preview */}
                        <div style={{ ...S.field, ...S.previewBox }}>
                            {selectedMap.imageUrl ? (
                                <img src={selectedMap.imageUrl} alt="Map preview"
                                    style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                                    onError={e => { e.target.style.display = 'none'; }} />
                            ) : (
                                <div style={{ color: '#444', textAlign: 'center', fontSize: '0.85em' }}>
                                    <div style={{ fontSize: '2em', marginBottom: 8 }}>🏔️</div>
                                    No image set
                                </div>
                            )}
                        </div>

                        <div style={S.divider} />

                        {/* Scale */}
                        <div style={S.field}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                                <label style={{ ...S.label, marginBottom: 0 }}>Distance Scale</label>
                                {selectedMap.imageUrl && (
                                    <button
                                        onClick={() => { setViewerOpen(true); }}
                                        style={{ ...S.btnGhost, padding: '4px 10px', fontSize: '0.78em', color: '#ce93d8', borderColor: '#6a1b9a' }}
                                        title="Open viewer in calibrate mode"
                                    >
                                        📐 {selectedMap.scale ? 'Recalibrate' : 'Calibrate'}
                                    </button>
                                )}
                            </div>
                            <div style={S.scaleBox}>
                                <ScaleInfo scale={selectedMap.scale} />
                            </div>
                        </div>

                        <div style={S.divider} />

                        {/* Pins */}
                        <div style={S.field}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                                <label style={{ ...S.label, marginBottom: 0 }}>Pins ({(selectedMap.pins || []).length})</label>
                                {selectedMap.imageUrl && (
                                    <button onClick={() => setViewerOpen(true)} style={{ ...S.btnBlue, padding: '5px 10px', fontSize: '0.8em' }}>
                                        + Add Pins in Viewer
                                    </button>
                                )}
                            </div>

                            {(selectedMap.pins || []).length === 0 ? (
                                <div style={S.empty}>
                                    No pins yet.{selectedMap.imageUrl ? ' Open the viewer and switch to Pin mode to place them.' : ' Add a map image first.'}
                                </div>
                            ) : (
                                <div>
                                    {(selectedMap.pins || []).map(pin => (
                                        <div key={pin.id} style={S.pinRow}>
                                            <span style={{ fontSize: '1.2em' }}>{pin.icon || '📍'}</span>
                                            <span style={{ flex: 1, fontSize: '0.85em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {pin.label || '(untitled)'}
                                            </span>
                                            <span style={S.tag(pin.visibleToPlayers)}>
                                                {pin.visibleToPlayers ? 'visible' : 'hidden'}
                                            </span>
                                            <button
                                                onClick={() => handlePinDelete(pin.id)}
                                                style={{ ...S.btnSmall, color: '#ef5350', borderColor: '#c62828' }}
                                                title="Delete pin"
                                            >✕</button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );

    // ── Layout ────────────────────────────────────────────────────────────────

    if (isMobile) {
        return (
            <div style={{ ...S.root, flexDirection: 'column', height: '100%' }}>
                {showList ? listPanel : editorPanel}
            </div>
        );
    }

    return (
        <div style={S.root}>
            {listPanel}
            {editorPanel}
        </div>
    );
}
