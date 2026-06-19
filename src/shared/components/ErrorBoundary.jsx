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
