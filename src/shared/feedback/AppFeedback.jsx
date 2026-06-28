import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

const FeedbackContext = createContext({
    notify: () => {},
    notifyError: () => {},
    notifySuccess: () => {},
    confirm: async () => false,
    prompt: async () => null,
});

export function useAppFeedback() {
    return useContext(FeedbackContext);
}

export function AppFeedbackProvider({ children }) {
    const [messages, setMessages] = useState([]);
    const [dialog, setDialog] = useState(null);

    const dismiss = useCallback((id) => {
        setMessages((current) => current.filter((message) => message.id !== id));
    }, []);

    const notify = useCallback((message, options = {}) => {
        const text = typeof message === 'string' ? message : message?.message || String(message || 'Unknown error');
        const id = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
        const entry = {
            id,
            type: options.type || 'info',
            title: options.title || null,
            text,
        };
        setMessages((current) => [...current.slice(-3), entry]);
        window.setTimeout(() => dismiss(id), options.durationMs ?? 6000);
        return id;
    }, [dismiss]);

    const notifyError = useCallback((error, options = {}) => {
        const text = error?.message || String(error || 'Unknown error');
        return notify(text, { ...options, type: 'error', title: options.title || 'Action failed' });
    }, [notify]);

    const notifySuccess = useCallback((message, options = {}) => {
        return notify(message, { ...options, type: 'success' });
    }, [notify]);

    const confirm = useCallback((options = {}) => {
        return new Promise((resolve) => {
            setDialog({
                kind: 'confirm',
                title: options.title || 'Confirm action',
                message: options.message || '',
                confirmLabel: options.confirmLabel || 'Confirm',
                cancelLabel: options.cancelLabel || 'Cancel',
                danger: Boolean(options.danger),
                resolve,
            });
        });
    }, []);

    const prompt = useCallback((options = {}) => {
        return new Promise((resolve) => {
            setDialog({
                kind: 'prompt',
                title: options.title || 'Enter value',
                message: options.message || '',
                inputLabel: options.inputLabel || '',
                defaultValue: options.defaultValue ?? options.initialValue ?? '',
                placeholder: options.placeholder || '',
                inputType: options.inputType || 'text',
                confirmLabel: options.confirmLabel || 'OK',
                cancelLabel: options.cancelLabel || 'Cancel',
                danger: Boolean(options.danger),
                resolve,
            });
        });
    }, []);

    const closeDialog = useCallback((value) => {
        setDialog((current) => {
            current?.resolve(value);
            return null;
        });
    }, []);

    const value = useMemo(() => ({
        notify,
        notifyError,
        notifySuccess,
        confirm,
        prompt,
    }), [notify, notifyError, notifySuccess, confirm, prompt]);

    return (
        <FeedbackContext.Provider value={value}>
            {children}
            <FeedbackToasts messages={messages} onDismiss={dismiss} />
            <FeedbackDialog dialog={dialog} onClose={closeDialog} />
        </FeedbackContext.Provider>
    );
}

function FeedbackToasts({ messages, onDismiss }) {
    if (!messages.length) return null;
    return (
        <div
            aria-live="polite"
            style={{
                position: 'fixed',
                right: 16,
                bottom: 16,
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                zIndex: 10000,
                maxWidth: 'min(420px, calc(100vw - 32px))',
            }}
        >
            {messages.map((message) => (
                <div
                    key={message.id}
                    role={message.type === 'error' ? 'alert' : 'status'}
                    style={{
                        background: message.type === 'error' ? '#421d1d' : message.type === 'success' ? '#17351f' : '#20242c',
                        border: `1px solid ${message.type === 'error' ? '#d45a5a' : message.type === 'success' ? '#4caf50' : '#666'}`,
                        borderRadius: 6,
                        color: '#f5f5f5',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
                        padding: '10px 12px',
                        fontSize: '0.9rem',
                    }}
                >
                    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                        <div style={{ flex: 1 }}>
                            {message.title && (
                                <div style={{ fontWeight: 700, marginBottom: 3 }}>
                                    {message.title}
                                </div>
                            )}
                            <div>{message.text}</div>
                        </div>
                        <button
                            type="button"
                            onClick={() => onDismiss(message.id)}
                            aria-label="Dismiss notification"
                            style={{
                                background: 'transparent',
                                border: 0,
                                color: '#ddd',
                                cursor: 'pointer',
                                fontSize: 18,
                                lineHeight: 1,
                                padding: 0,
                            }}
                        >
                            ×
                        </button>
                    </div>
                </div>
            ))}
        </div>
    );
}

function FeedbackDialog({ dialog, onClose }) {
    const [value, setValue] = useState('');

    React.useEffect(() => {
        setValue(dialog?.defaultValue ?? '');
    }, [dialog]);

    if (!dialog) return null;

    const isPrompt = dialog.kind === 'prompt';
    const submit = () => onClose(isPrompt ? value : true);
    const cancel = () => onClose(isPrompt ? null : false);

    return (
        <div
            role="presentation"
            data-testid="app-feedback-backdrop"
            onMouseDown={(event) => {
                if (event.target === event.currentTarget) cancel();
            }}
            style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.62)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 16,
                zIndex: 11000,
            }}
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="app-feedback-dialog-title"
                data-testid="app-feedback-dialog"
                style={{
                    width: 'min(440px, 100%)',
                    background: '#202020',
                    border: `1px solid ${dialog.danger ? '#d45a5a' : '#c5a059'}`,
                    borderRadius: 8,
                    boxShadow: '0 18px 48px rgba(0,0,0,0.55)',
                    color: '#eee',
                    padding: 18,
                }}
            >
                <h3
                    id="app-feedback-dialog-title"
                    style={{
                        margin: '0 0 10px',
                        color: dialog.danger ? '#ff9d9d' : '#ffecb3',
                        fontFamily: 'Cinzel, serif',
                    }}
                >
                    {dialog.title}
                </h3>
                {dialog.message && (
                    <p style={{ margin: '0 0 14px', color: '#ccc', whiteSpace: 'pre-wrap', lineHeight: 1.45 }}>
                        {dialog.message}
                    </p>
                )}
                {isPrompt && (
                    <label style={{ display: 'block', marginBottom: 16 }}>
                        {dialog.inputLabel && (
                            <span style={{ display: 'block', color: '#aaa', fontSize: '0.82rem', marginBottom: 5 }}>
                                {dialog.inputLabel}
                            </span>
                        )}
                        <input
                            autoFocus
                            className="modal-input"
                            data-testid="app-feedback-input"
                            type={dialog.inputType}
                            value={value}
                            placeholder={dialog.placeholder}
                            onChange={(event) => setValue(event.target.value)}
                            onKeyDown={(event) => {
                                if (event.key === 'Enter') submit();
                                if (event.key === 'Escape') cancel();
                            }}
                            style={{
                                width: '100%',
                                boxSizing: 'border-box',
                            }}
                        />
                    </label>
                )}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                    <button type="button" className="btn-secondary" data-testid="app-feedback-cancel" onClick={cancel}>
                        {dialog.cancelLabel}
                    </button>
                    <button
                        type="button"
                        className="btn-primary"
                        data-testid="app-feedback-confirm"
                        onClick={submit}
                        style={dialog.danger ? { background: '#9b2d2d', borderColor: '#d45a5a' } : undefined}
                    >
                        {dialog.confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}
