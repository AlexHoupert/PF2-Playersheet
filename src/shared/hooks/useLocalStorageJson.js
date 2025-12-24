import { useEffect, useState } from 'react';

export function useLocalStorageJson(key, defaultValue, { migrate } = {}) {
    const [state, setState] = useState(() => {
        try {
            const raw = localStorage.getItem(key);
            if (raw != null) {
                const parsed = JSON.parse(raw);
                return migrate ? migrate(parsed) : parsed;
            }
        } catch (err) {
            console.warn(`[useLocalStorageJson] Failed to load key "${key}"`, err);
        }

        const fallback = typeof defaultValue === 'function' ? defaultValue() : defaultValue;
        return migrate ? migrate(fallback) : fallback;
    });

    useEffect(() => {
        try {
            localStorage.setItem(key, JSON.stringify(state));
        } catch (err) {
            console.warn(`[useLocalStorageJson] Failed to save key "${key}"`, err);
        }
    }, [key, state]);

    // Listen for changes from other tabs
    useEffect(() => {
        const handleStorageChange = (e) => {
            if (e.key === key && e.newValue != null) {
                try {
                    const parsed = JSON.parse(e.newValue);
                    const migrated = migrate ? migrate(parsed) : parsed;
                    setState(migrated);
                } catch (err) {
                    console.warn(`[useLocalStorageJson] Failed to sync key "${key}"`, err);
                }
            }
        };

        window.addEventListener('storage', handleStorageChange);
        return () => window.removeEventListener('storage', handleStorageChange);
    }, [key, migrate]);

    return [state, setState];
}

