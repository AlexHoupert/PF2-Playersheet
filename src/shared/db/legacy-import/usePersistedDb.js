// LEGACY IMPORT/BACKUP ONLY.
// The normal runtime starts Firestore V2 through useFirestoreV2Db. Do not use
// this hook for new UI or runtime writes.
import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocalStorageJson } from '../../hooks/useLocalStorageJson';
import { deepClone } from '../../utils/deepClone';
import { migrateDb } from './migrateDb';
import { db as firestore } from '../firebase-config';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { cleanForFirestore } from '../v2/normalizers';
import { debugLog } from '../../utils/debugLog';

export const DB_STORAGE_KEY = 'pf2e-data';
const IS_FIREBASE_CONFIGURED = firestore && firestore.app.options.apiKey !== "YOUR_API_KEY";

// Echo suppression: track our pending writes to avoid re-applying our own changes
const ECHO_SUPPRESSION_WINDOW_MS = 2000; // Ignore echoes within 2 seconds of our write

export function usePersistedDb(defaultDb) {
    // 1. Always initialize with LocalStorage for offline/fast-load support
    const [localDb] = useLocalStorageJson(DB_STORAGE_KEY, () => deepClone(defaultDb), { migrate: migrateDb });
    const [dbState, setDbState] = useState(localDb);
    const dbStateRef = useRef(localDb);

    // Echo suppression state
    const lastWriteTimestampRef = useRef(0);
    const pendingWriteRef = useRef(false);
    const hasRemoteSnapshotRef = useRef(!IS_FIREBASE_CONFIGURED);

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
                const incomingData = migrateDb(docSnap.data());
                const incomingTimestamp = incomingData._lastWriteTimestamp || 0;
                const ourLastWrite = lastWriteTimestampRef.current;
                const isFirstRemoteSnapshot = !hasRemoteSnapshotRef.current;
                hasRemoteSnapshotRef.current = true;

                // ECHO SUPPRESSION: Skip if this is our own write echoing back
                if (!isFirstRemoteSnapshot && incomingTimestamp === ourLastWrite && ourLastWrite > 0) {
                    debugLog("[Firebase] Skipping own echo (exact match)");
                    return;
                }

                // ECHO SUPPRESSION: Skip if we recently wrote and this data looks like our echo
                const timeSinceOurWrite = Date.now() - ourLastWrite;
                if (!isFirstRemoteSnapshot && pendingWriteRef.current && timeSinceOurWrite < ECHO_SUPPRESSION_WINDOW_MS) {
                    // Check if incoming is same or older than what we wrote
                    if (incomingTimestamp <= ourLastWrite) {
                        debugLog("[Firebase] Skipping stale echo within suppression window");
                        return;
                    }
                }

                // INCOMING IS NEWER: Accept the update
                // This handles the case where another client made a change
                const currentTimestamp = dbStateRef.current?._lastWriteTimestamp || 0;
                if (isFirstRemoteSnapshot || incomingTimestamp > currentTimestamp) {
                    debugLog("[Firebase] Accepting newer update from remote", {
                        incoming: incomingTimestamp,
                        current: currentTimestamp
                    });
                    dbStateRef.current = incomingData;
                    setDbState(incomingData);
                    localStorage.setItem(DB_STORAGE_KEY, JSON.stringify(incomingData));
                    pendingWriteRef.current = false;
                } else if (incomingTimestamp === currentTimestamp) {
                    // Same timestamp, likely initial load or duplicate - ignore
                    debugLog("[Firebase] Ignoring duplicate timestamp");
                } else {
                    debugLog("[Firebase] Ignoring older update", {
                        incoming: incomingTimestamp,
                        current: currentTimestamp
                    });
                }
            } else {
                hasRemoteSnapshotRef.current = true;
                console.warn("[Firebase] Master document does not exist; using local fallback until first write");
            }
        });

        return () => unsub();
    }, []); // Only subscribe once on mount - timestamp comparisons handle freshness

    // 4. Custom Setter with Echo Suppression Metadata
    const setDb = useCallback((newValueOrFn) => {
        setDbState(currentState => {
            if (IS_FIREBASE_CONFIGURED && !hasRemoteSnapshotRef.current) {
                console.warn("[Firebase] Ignoring local write before initial cloud snapshot");
                return currentState;
            }

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
            dbStateRef.current = newValue;

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
                setDoc(doc(firestore, "data", "master"), cleanForFirestore(newValue))
                    .then(() => {
                        debugLog("[Firebase] Write successful");
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
