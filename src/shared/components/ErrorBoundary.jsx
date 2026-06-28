import React from 'react';

export default class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { error: null };
    }

    static getDerivedStateFromError(error) {
        return { error };
    }

    componentDidCatch(error, info) {
        console.error(error, info);
    }

    render() {
        if (!this.state.error) return this.props.children;
        const showDetails = import.meta.env.DEV;
        const errorText = this.state.error?.stack || this.state.error?.message || String(this.state.error);

        return (
            <div style={{
                minHeight: '100vh',
                background: '#111',
                color: '#e0e0e0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 24,
            }}>
                <div style={{
                    maxWidth: 520,
                    width: '100%',
                    border: '1px solid #5c2b2b',
                    background: '#1b1414',
                    borderRadius: 8,
                    padding: 20,
                    boxShadow: '0 12px 36px rgba(0,0,0,0.35)',
                }}>
                    <h1 style={{ margin: '0 0 10px 0', color: '#ffb4a8', fontSize: '1.3rem' }}>
                        View failed to render
                    </h1>
                    <p style={{ margin: '0 0 16px 0', color: '#cfc7c2', lineHeight: 1.5 }}>
                        A screen crashed while rendering. The technical details are in the browser console.
                    </p>
                    {showDetails && (
                        <pre
                            data-testid="error-boundary-details"
                            style={{
                                maxHeight: 220,
                                overflow: 'auto',
                                whiteSpace: 'pre-wrap',
                                background: '#100d0d',
                                border: '1px solid #3a2424',
                                color: '#f2c7c0',
                                padding: 10,
                                borderRadius: 6,
                                fontSize: '0.78rem',
                                margin: '0 0 16px 0',
                            }}
                        >
                            {errorText}
                        </pre>
                    )}
                    <button
                        className="set-btn"
                        type="button"
                        onClick={() => window.location.reload()}
                        style={{ margin: 0, width: 'auto', padding: '8px 14px' }}
                    >
                        Reload
                    </button>
                </div>
            </div>
        );
    }
}
