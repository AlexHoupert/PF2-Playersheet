import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth } from '../db/firebase-config';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { LoginView } from './LoginView';

const AuthContext = createContext();

export function useAuth() {
    return useContext(AuthContext);
}

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            setLoading(false);
        });
        return unsubscribe;
    }, []);

    const logout = () => {
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
