import React, { useState } from 'react';
import { useWindowSize } from '../hooks/useWindowSize';
import BottomSheet from './BottomSheet';
import { useAppFeedback } from '../feedback/AppFeedback';

function uuid() {
    return crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// ── Emoji quick-picks ──────────────────────────────────────────────────────────

const EMOJI_GROUPS = [
    { label: 'Settlements', icons: ['🏰', '🏚️', '⛺', '🏛️', '🗼', '⛩️', '🏯', '🏘️'] },
    { label: 'Terrain',     icons: ['🌲', '🌊', '🏔️', '🌋', '🏜️', '🌿', '🗻', '🏝️'] },
    { label: 'Danger',      icons: ['⚔️', '💀', '🧟', '🐉', '⚠️', '🔥', '☠️', '🧙'] },
    { label: 'Misc',        icons: ['📍', '❓', '💎', '🗝️', '🛡️', '🏹', '📜', '⭐'] },
];

function EmojiPicker({ value, onChange }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {EMOJI_GROUPS.map(group => (
                <div key={group.label}>
                    <div style={{ fontSize: '0.7em', color: '#555', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        {group.label}
                    </div>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {group.icons.map(icon => (
                            <button
                                key={icon}
                                type="button"
                                onClick={() => onChange(icon)}
                                style={{
                                    width: 36, height: 36,
                                    background: value === icon ? 'rgba(197,160,89,0.25)' : '#1e1e22',
                                    border: `1px solid ${value === icon ? '#c5a059' : '#333'}`,
                                    borderRadius: 4,
                                    fontSize: '1.2em',
                                    cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    transition: 'all 0.1s',
                                }}
                                title={icon}
                            >
                                {icon}
                            </button>
                        ))}
                    </div>
                </div>
            ))}

            {/* Custom emoji input */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                <span style={{ fontSize: '0.75em', color: '#555' }}>Custom:</span>
                <input
                    value={value}
                    onChange={e => onChange(e.target.value)}
                    placeholder="Type emoji or text"
                    maxLength={4}
                    style={{
                        width: 80, padding: '5px 8px',
                        background: '#1e1e22', border: '1px solid #444',
                        borderRadius: 4, color: '#e0e0e0', fontSize: '1em',
                        textAlign: 'center',
                    }}
                />
                <span style={{ fontSize: '1.5em' }}>{value}</span>
            </div>
        </div>
    );
}

// ── Form fields ────────────────────────────────────────────────────────────────

const INPUT_STYLE = {
    width: '100%',
    padding: '8px 10px',
    background: '#1e1e22',
    border: '1px solid #444',
    borderRadius: 4,
    color: '#e0e0e0',
    fontSize: '0.9em',
    boxSizing: 'border-box',
};

const LABEL_STYLE = {
    display: 'block',
    fontSize: '0.78em',
    color: '#777',
    marginBottom: 5,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
};

function Field({ label, children }) {
    return (
        <div style={{ marginBottom: 16 }}>
            <label style={LABEL_STYLE}>{label}</label>
            {children}
        </div>
    );
}

// ── Main modal body ────────────────────────────────────────────────────────────

function PinEditorBody({ pin, position, onSave, onDelete, onClose }) {
    const isNew = !pin;
    const { confirm } = useAppFeedback();

    const [form, setForm] = useState({
        label:            pin?.label            ?? '',
        description:      pin?.description      ?? '',
        icon:             pin?.icon             ?? '📍',
        imageUrl:         pin?.imageUrl         ?? '',
        link:             pin?.link             ?? '',
        visibleToPlayers: pin?.visibleToPlayers ?? true,
    });

    const set = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

    const handleSave = () => {
        const saved = {
            id:               pin?.id  ?? uuid(),
            x:                pin?.x   ?? position?.x ?? 0.5,
            y:                pin?.y   ?? position?.y ?? 0.5,
            label:            form.label.trim(),
            description:      form.description.trim(),
            icon:             form.icon || '📍',
            imageUrl:         form.imageUrl.trim(),
            link:             form.link.trim(),
            visibleToPlayers: form.visibleToPlayers,
        };
        onSave(saved);
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            <Field label="Label">
                <input
                    autoFocus
                    style={INPUT_STYLE}
                    value={form.label}
                    onChange={e => set('label', e.target.value)}
                    placeholder="Location name…"
                    onKeyDown={e => e.key === 'Enter' && handleSave()}
                />
            </Field>

            <Field label="Description">
                <textarea
                    style={{ ...INPUT_STYLE, minHeight: 80, resize: 'vertical', fontFamily: 'inherit' }}
                    value={form.description}
                    onChange={e => set('description', e.target.value)}
                    placeholder="Notes about this location…"
                />
            </Field>

            <Field label="Link (URL)">
                <input
                    style={INPUT_STYLE}
                    type="url"
                    value={form.link}
                    onChange={e => set('link', e.target.value)}
                    placeholder="https://…"
                />
            </Field>

            <Field label="Pin Icon">
                <EmojiPicker value={form.icon} onChange={v => set('icon', v)} />
            </Field>

            <Field label="Custom Pin Image (URL — replaces icon)">
                <input
                    style={INPUT_STYLE}
                    value={form.imageUrl}
                    onChange={e => set('imageUrl', e.target.value)}
                    placeholder="https://… or /api/static/…"
                />
                {form.imageUrl && (
                    <img
                        src={form.imageUrl}
                        alt=""
                        style={{ marginTop: 6, width: 48, height: 48, borderRadius: '50%', objectFit: 'cover', border: '2px solid #c5a059' }}
                        onError={e => e.target.style.display = 'none'}
                    />
                )}
            </Field>

            <Field label="Visibility">
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                    <input
                        type="checkbox"
                        checked={form.visibleToPlayers}
                        onChange={e => set('visibleToPlayers', e.target.checked)}
                    />
                    <span style={{
                        padding: '2px 10px', borderRadius: 12, fontSize: '0.8em', fontWeight: 'bold',
                        background: form.visibleToPlayers ? 'rgba(76,175,80,0.2)' : 'rgba(255,255,255,0.06)',
                        color: form.visibleToPlayers ? '#81c784' : '#888',
                        border: `1px solid ${form.visibleToPlayers ? '#388e3c' : '#444'}`,
                    }}>
                        {form.visibleToPlayers ? 'Visible to players' : 'Hidden from players'}
                    </span>
                </label>
            </Field>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 8, paddingTop: 8, borderTop: '1px solid #222', flexWrap: 'wrap' }}>
                <button
                    onClick={handleSave}
                    style={{
                        flex: 1, padding: '9px 16px',
                        background: '#c5a059', border: 'none', color: '#000',
                        fontWeight: 'bold', borderRadius: 4, cursor: 'pointer', fontSize: '0.9em',
                        minWidth: 80,
                    }}
                >
                    {isNew ? '+ Place Pin' : 'Save Changes'}
                </button>
                <button
                    onClick={onClose}
                    style={{
                        padding: '9px 16px',
                        background: 'transparent', border: '1px solid #444', color: '#aaa',
                        borderRadius: 4, cursor: 'pointer', fontSize: '0.9em',
                    }}
                >
                    Cancel
                </button>
                {!isNew && onDelete && (
                    <button
                        onClick={async () => {
                            const confirmed = await confirm({
                                title: 'Delete pin',
                                message: 'Delete this pin?',
                                confirmLabel: 'Delete',
                                danger: true,
                            });
                            if (confirmed) onDelete(pin.id);
                        }}
                        style={{
                            padding: '9px 12px',
                            background: 'transparent', border: '1px solid #c62828', color: '#ef5350',
                            borderRadius: 4, cursor: 'pointer', fontSize: '0.9em',
                        }}
                    >
                        🗑️ Delete
                    </button>
                )}
            </div>
        </div>
    );
}

// ── Public export: modal on desktop, BottomSheet on mobile ────────────────────

/**
 * Props:
 *   pin        – existing pin object to edit, or null for a new pin
 *   position   – { x, y } fractions for new pin placement (used when pin is null)
 *   onSave     – (pinObject) => void
 *   onDelete   – (pinId) => void
 *   onClose    – () => void
 */
export default function PinEditorModal({ pin, position, onSave, onDelete, onClose }) {
    const { isMobile } = useWindowSize();
    const title = pin ? `Edit: ${pin.label || 'Pin'}` : 'New Pin';

    if (isMobile) {
        return (
            <BottomSheet isOpen={true} onClose={onClose} title={title} height="92vh">
                <div style={{ padding: '0 16px 24px', overflowY: 'auto', height: '100%' }}>
                    <PinEditorBody
                        pin={pin}
                        position={position}
                        onSave={onSave}
                        onDelete={onDelete}
                        onClose={onClose}
                    />
                </div>
            </BottomSheet>
        );
    }

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 200,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
            onClick={e => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div style={{
                width: 'min(520px, 95vw)',
                background: '#141418',
                border: '1px solid #333',
                borderRadius: 10,
                overflow: 'hidden',
                display: 'flex', flexDirection: 'column',
                maxHeight: '90vh',
            }}>
                {/* Header */}
                <div style={{
                    padding: '14px 18px',
                    borderBottom: '1px solid #222',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    flexShrink: 0,
                }}>
                    <h3 style={{ margin: 0, color: '#c5a059', fontSize: '1em' }}>{title}</h3>
                    <button
                        onClick={onClose}
                        style={{ background: 'none', border: 'none', color: '#666', fontSize: '1.2em', cursor: 'pointer' }}
                    >✕</button>
                </div>

                {/* Scrollable body */}
                <div style={{ overflowY: 'auto', padding: 18, flex: 1 }}>
                    <PinEditorBody
                        pin={pin}
                        position={position}
                        onSave={onSave}
                        onDelete={onDelete}
                        onClose={onClose}
                    />
                </div>
            </div>
        </div>
    );
}
