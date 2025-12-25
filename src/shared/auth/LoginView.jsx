import React, { useState } from 'react';
import { auth } from '../db/firebase-config';
import { signInWithPopup, GoogleAuthProvider, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';

export function LoginView() {
    const [mode, setMode] = useState('login'); // 'login' | 'register'
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState(null);

    const handleGoogleLogin = async () => {
        try {
            const provider = new GoogleAuthProvider();
            await signInWithPopup(auth, provider);
        } catch (err) {
            console.error("Google Login Error", err);
            setError(err.message);
        }
    };

    const handleEmailAuth = async (e) => {
        e.preventDefault();
        setError(null);
        try {
            if (mode === 'register') {
                await createUserWithEmailAndPassword(auth, email, password);
            } else {
                await signInWithEmailAndPassword(auth, email, password);
            }
        } catch (err) {
            console.error("Email Auth Error", err);
            setError(err.message);
        }
    };

    return (
        <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            height: '100vh', background: '#1a1a1d', color: '#e0e0e0', fontFamily: 'Inter, sans-serif'
        }}>
            <div style={{
                background: '#2b2b2e', padding: 40, borderRadius: 12, border: '1px solid #c5a059',
                maxWidth: 400, width: '100%', textAlign: 'center',
                boxShadow: '0 0 20px rgba(0,0,0,0.5)'
            }}>
                <h1 style={{ color: 'var(--text-gold)', fontFamily: 'Cinzel, serif', marginBottom: 30 }}>PF2e Player Sheet</h1>

                {error && <div style={{ background: '#ff525233', color: '#ff5252', padding: 10, borderRadius: 4, marginBottom: 20, fontSize: '0.9em' }}>{error}</div>}

                <button onClick={handleGoogleLogin} style={{
                    width: '100%', padding: 12, marginBottom: 20,
                    background: '#fff', color: '#333', border: 'none', borderRadius: 4,
                    fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10
                }}>
                    <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="G" style={{ width: 18 }} />
                    Sign in with Google
                </button>

                <div style={{ display: 'flex', alignItems: 'center', margin: '20px 0', color: '#666' }}>
                    <div style={{ flex: 1, height: 1, background: '#444' }}></div>
                    <span style={{ padding: '0 10px', fontSize: '0.8em' }}>OR</span>
                    <div style={{ flex: 1, height: 1, background: '#444' }}></div>
                </div>

                <form onSubmit={handleEmailAuth} style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
                    <input
                        type="email"
                        placeholder="Email Address"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        style={{ padding: 10, background: '#111', border: '1px solid #444', color: '#ccc', borderRadius: 4 }}
                        required
                    />
                    <input
                        type="password"
                        placeholder="Password"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        style={{ padding: 10, background: '#111', border: '1px solid #444', color: '#ccc', borderRadius: 4 }}
                        required
                    />
                    <button type="submit" style={{
                        marginTop: 10, padding: 12, background: '#c5a059', color: '#1a1a1d',
                        border: 'none', borderRadius: 4, fontWeight: 'bold', cursor: 'pointer',
                        textTransform: 'uppercase', letterSpacing: 1
                    }}>
                        {mode === 'login' ? 'Login' : 'Register'}
                    </button>
                </form>

                <div style={{ marginTop: 20, fontSize: '0.9em', color: '#888' }}>
                    {mode === 'login' ? "Don't have an account? " : "Already have an account? "}
                    <span
                        onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(null); }}
                        style={{ color: '#c5a059', cursor: 'pointer', textDecoration: 'underline' }}
                    >
                        {mode === 'login' ? 'Register' : 'Login'}
                    </span>
                </div>
            </div>
        </div>
    );
}
