import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocalStorageJson } from '../hooks/useLocalStorageJson';
import { deepClone } from '../utils/deepClone';
import { migrateDb } from './migrateDb';
import { db as firestore } from './firebase-config';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';

export const DB_STORAGE_KEY = 'pf2e-data';
const IS_FIREBASE_CONFIGURED = firestore && firestore.app.options.apiKey !== "YOUR_API_KEY";

// Echo suppression: track our pending writes to avoid re-applying our own changes
const ECHO_SUPPRESSION_WINDOW_MS = 2000; // Ignore echoes within 2 seconds of our write

export function usePersistedDb(defaultDb) {
    // 1. Always initialize with LocalStorage for offline/fast-load support
    const [localDb, setLocalDb] = useLocalStorageJson(DB_STORAGE_KEY, () => deepClone(defaultDb), { migrate: migrateDb });
    const [dbState, setDbState] = useState(localDb);

    // Echo suppression state
    const lastWriteTimestampRef = useRef(0);
    const pendingWriteRef = useRef(false);

    // 2. Sync State with LocalStorage wrapper (only on initial load)
    useEffect(() => {
        // Only sync from localStorage on mount, not on every localDb change
        // This prevents localStorage updates from causing re-renders
    }, []);

    // 3. Firebase Synchronization with Echo Suppression
    useEffect(() => {
        if (!IS_FIREBASE_CONFIGURED) return;

        const unsub = onSnapshot(doc(firestore, "data", "master"), (docSnap) => {
            if (docSnap.exists()) {
                const incomingData = docSnap.data();
                const incomingTimestamp = incomingData._lastWriteTimestamp || 0;
                const ourLastWrite = lastWriteTimestampRef.current;

                // ECHO SUPPRESSION: Skip if this is our own write echoing back
                if (incomingTimestamp === ourLastWrite && ourLastWrite > 0) {
                    console.log("[Firebase] Skipping own echo (exact match)");
                    return;
                }

                // ECHO SUPPRESSION: Skip if we recently wrote and this data looks like our echo
                const timeSinceOurWrite = Date.now() - ourLastWrite;
                if (pendingWriteRef.current && timeSinceOurWrite < ECHO_SUPPRESSION_WINDOW_MS) {
                    // Check if incoming is same or older than what we wrote
                    if (incomingTimestamp <= ourLastWrite) {
                        console.log("[Firebase] Skipping stale echo within suppression window");
                        return;
                    }
                }

                // INCOMING IS NEWER: Accept the update
                // This handles the case where another client made a change
                const currentTimestamp = dbState._lastWriteTimestamp || 0;
                if (incomingTimestamp > currentTimestamp) {
                    console.log("[Firebase] Accepting newer update from remote", {
                        incoming: incomingTimestamp,
                        current: currentTimestamp
                    });
                    setDbState(incomingData);
                    localStorage.setItem(DB_STORAGE_KEY, JSON.stringify(incomingData));
                    pendingWriteRef.current = false;
                } else if (incomingTimestamp === currentTimestamp) {
                    // Same timestamp, likely initial load or duplicate - ignore
                    console.log("[Firebase] Ignoring duplicate timestamp");
                } else {
                    console.log("[Firebase] Ignoring older update", {
                        incoming: incomingTimestamp,
                        current: currentTimestamp
                    });
                }
            }
        });

        return () => unsub();
    }, []); // Only subscribe once on mount - timestamp comparisons handle freshness

    // 4. Custom Setter with Echo Suppression Metadata
    const setDb = useCallback((newValueOrFn) => {
        setDbState(currentState => {
            // Calculate new value from current state (ensures we always have latest)
            let newValue;
            if (typeof newValueOrFn === 'function') {
                newValue = newValueOrFn(currentState);
            } else {
                newValue = newValueOrFn;
            }

            // Add timestamp for echo suppression
            const writeTimestamp = Date.now();
            newValue = { ...newValue, _lastWriteTimestamp: writeTimestamp };

            // Track our pending write
            lastWriteTimestampRef.current = writeTimestamp;
            pendingWriteRef.current = true;

            // Update localStorage synchronously for fast local persistence
            try {
                localStorage.setItem(DB_STORAGE_KEY, JSON.stringify(newValue));
            } catch (e) {
                console.error("[LocalStorage] Write failed:", e);
            }

            // Push to Firebase (async, but we've already applied locally)
            if (IS_FIREBASE_CONFIGURED) {
                setDoc(doc(firestore, "data", "master"), newValue)
                    .then(() => {
                        console.log("[Firebase] Write successful");
                        // Keep pendingWrite true briefly to handle echo
                        setTimeout(() => {
                            if (lastWriteTimestampRef.current === writeTimestamp) {
                                pendingWriteRef.current = false;
                            }
                        }, ECHO_SUPPRESSION_WINDOW_MS);
                    })
                    .catch(err => {
                        console.error("[Firebase] Write Failed:", err);
                        pendingWriteRef.current = false;
                    });
            }

            return newValue;
        });
    }, []);

    return [dbState, setDb];
}

