import { useState, useEffect } from 'react';
import { useLocalStorageJson } from '../hooks/useLocalStorageJson';
import { deepClone } from '../utils/deepClone';
import { migrateDb } from './migrateDb';
import { db as firestore } from './firebase-config';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';

export const DB_STORAGE_KEY = 'pf2e-data';
const IS_FIREBASE_CONFIGURED = firestore && firestore.app.options.apiKey !== "YOUR_API_KEY";

export function usePersistedDb(defaultDb) {
    // 1. Always initialize with LocalStorage for offline/fast-load support
    const [localDb, setLocalDb] = useLocalStorageJson(DB_STORAGE_KEY, () => deepClone(defaultDb), { migrate: migrateDb });
    const [dbState, setDbState] = useState(localDb);

    // 2. Sync State with LocalStorage wrapper
    useEffect(() => {
        setDbState(localDb);
    }, [localDb]);

    // 3. Firebase Synchronization
    useEffect(() => {
        if (!IS_FIREBASE_CONFIGURED) return;

        // Subscribe to Firestore 'data/master' document
        const unsub = onSnapshot(doc(firestore, "data", "master"), (doc) => {
            if (doc.exists()) {
                const data = doc.data();
                // Compare timestamps or versions if needed. For now, Cloud wins.
                // We update local state, AND writing to localStorage to keep cache warm
                console.log("[Firebase] Received Update", data);
                // We avoid calling setLocalDb here to prevent infinite loop if we're not careful,
                // but since setLocalDb writes to storage, it might trigger updates.
                // Simple approach: Update state.
                setDbState(data);
                // Optimistic Local Cache Update (Optional, careful of loops)
                localStorage.setItem(DB_STORAGE_KEY, JSON.stringify(data));
            }
        });

        return () => unsub();
    }, []);

    // 4. Custom Setter that writes to WHEREVER is active
    const setDb = (newValueOrFn) => {
        // Calculate new value
        let newValue;
        if (typeof newValueOrFn === 'function') {
            newValue = newValueOrFn(dbState);
        } else {
            newValue = newValueOrFn;
        }

        // Always update Local State & Storage immediately for responsiveness
        setDbState(newValue);
        setLocalDb(newValue);

        // If Firebase is active, push update
        if (IS_FIREBASE_CONFIGURED) {
            // Debounce appropriately in production, but here we just write
            setDoc(doc(firestore, "data", "master"), newValue).catch(err => {
                console.error("[Firebase] Write Failed:", err);
            });
        }
    };

    return [dbState, setDb];
}

