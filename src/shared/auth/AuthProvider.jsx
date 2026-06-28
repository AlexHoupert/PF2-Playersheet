import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth } from '../db/firebase-config';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { LoginView } from './LoginView';
import { createE2eUser, isE2eFixtureEnabled } from '../testing/e2eFixture';

const AuthContext = createContext();

export function useAuth() {
    return useContext(AuthContext);
}

export function AuthProvider({ children }) {
    const e2eFixture = isE2eFixtureEnabled();
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(!e2eFixture);

    useEffect(() => {
        if (e2eFixture) {
            setUser(createE2eUser());
            setLoading(false);
            return undefined;
        }
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            setLoading(false);
        });
        return unsubscribe;
    }, [e2eFixture]);

    const logout = () => {
        if (e2eFixture) return Promise.resolve();
        return signOut(auth);
    };

    if (loading) {
        return <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1a1a1d', color: '#666' }}>Loading...</div>;
    }

    if (!user) {
        return <LoginView />;
    }

    const value = {
        user,
        logout
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}
