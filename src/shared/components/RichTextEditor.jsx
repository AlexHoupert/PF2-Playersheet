import React, { useRef } from 'react';
import './RichTextEditor.css';

export default function RichTextEditor({ value, onChange, className, style, placeholder }) {
    const textareaRef = useRef(null);

    const insertAtCursor = (text) => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const before = (value || '').substring(0, start);
        const after = (value || '').substring(end);

        const newValue = before + text + after;
        onChange(newValue);

        // Restore cursor/focus next tick
        setTimeout(() => {
            textarea.focus();
            textarea.setSelectionRange(start + text.length, start + text.length);
        }, 0);
    };

    return (
        <div className={`rich-text-editor ${className || ''}`} style={style}>
            <div className="rte-toolbar">
                <button type="button" onClick={() => insertAtCursor('**bold**')} title="Bold" style={{ fontWeight: 'bold' }}>B</button>
                <button type="button" onClick={() => insertAtCursor('*italic*')} title="Italic" style={{ fontStyle: 'italic' }}>I</button>
                <button type="button" onClick={() => insertAtCursor('### ')} title="Heading">H3</button>
                <span className="rte-sep">|</span>
                <button type="button" onClick={() => insertAtCursor('[one-action]')} title="One Action">
                    <span className="pf2-icon">1</span>
                </button>
                <button type="button" onClick={() => insertAtCursor('[two-actions]')} title="Two Actions">
                    <span className="pf2-icon">2</span>
                </button>
                <button type="button" onClick={() => insertAtCursor('[three-actions]')} title="Three Actions">
                    <span className="pf2-icon">3</span>
                </button>
                <button type="button" onClick={() => insertAtCursor('[reaction]')} title="Reaction">
                    <span className="pf2-icon">R</span>
                </button>
                <button type="button" onClick={() => insertAtCursor('[free-action]')} title="Free Action">
                    <span className="pf2-icon">F</span>
                </button>
                <span className="rte-sep">|</span>
                <button type="button" onClick={() => insertAtCursor(' [[Duration: 1 min]] ')} title="Duration Template">⏱️</button>
                <button type="button" onClick={() => insertAtCursor(' [[Check: DC 15 Reflex]] ')} title="Check Template">🎲</button>
            </div>
            <textarea
                ref={textareaRef}
                className="rte-textarea"
                value={value || ''}
                onChange={e => onChange(e.target.value)}
                placeholder={placeholder}
            />
        </div>
    );
}
