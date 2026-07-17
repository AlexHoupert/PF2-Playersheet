import { useCallback, useEffect, useRef, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db as firestore } from '../firebase-config';
import { composeV2ViewModelFromDocuments } from './viewModel.js';
import { V2_COLLECTIONS } from './schema.js';

const IS_FIREBASE_CONFIGURED = firestore && firestore.app.options.apiKey !== 'YOUR_API_KEY';
const CAMPAIGN_SUBCOLLECTIONS = [
    V2_COLLECTIONS.actors,
    V2_COLLECTIONS.actorEffects,
    V2_COLLECTIONS.effectTemplates,
    V2_COLLECTIONS.catalogEntries,
    V2_COLLECTIONS.catalogChangeEvents,
    V2_COLLECTIONS.effectRequests,
    V2_COLLECTIONS.loreContributions,
    V2_COLLECTIONS.quests,
    V2_COLLECTIONS.lootBags,
    V2_COLLECTIONS.encounters,
    V2_COLLECTIONS.maps,
    V2_COLLECTIONS.members,
];
const TOP_LEVEL_COLLECTIONS = [
    V2_COLLECTIONS.global,
    V2_COLLECTIONS.customItems,
    V2_COLLECTIONS.customCreatures,
    V2_COLLECTIONS.customActions,
    V2_COLLECTIONS.catalogOverrides,
    V2_COLLECTIONS.loreArticles,
];

export function useFirestoreV2Db() {
    const [v2Store, setV2Store] = useState(() => composeV2ViewModelFromDocuments([]));
    const [status, setStatus] = useState({
        mode: 'firestore-v2',
        configured: IS_FIREBASE_CONFIGURED,
        ready: !IS_FIREBASE_CONFIGURED,
        error: null,
        documentCount: 0,
    });

    const docsRef = useRef(new Map());
    const campaignUnsubsRef = useRef(new Map());

    const projectDocsToDb = useCallback((docsMap) => {
        const documents = Array.from(docsMap.entries()).map(([path, data]) => ({ path, data }));
        const nextV2Store = composeV2ViewModelFromDocuments(documents);
        setV2Store(nextV2Store);
        setStatus(prev => ({
            ...prev,
            ready: true,
            documentCount: documents.length,
            v2ViewModel: nextV2Store,
            error: null,
        }));
    }, []);

    const replaceCollectionDocs = useCallback((collectionPath, docs) => {
        const prefix = `${collectionPath}/`;
        const docPathLength = collectionPath.split('/').filter(Boolean).length + 1;
        const nextMap = new Map(docsRef.current);
        for (const path of Array.from(nextMap.keys())) {
            if (path.startsWith(prefix) && path.split('/').filter(Boolean).length === docPathLength) {
                nextMap.delete(path);
            }
        }
        for (const entry of docs) {
            nextMap.set(entry.path, entry.data);
        }
        docsRef.current = nextMap;
        projectDocsToDb(nextMap);
    }, [projectDocsToDb]);

    useEffect(() => {
        if (!IS_FIREBASE_CONFIGURED) return undefined;

        const unsubscribers = [];

        const subscribeTopLevel = (collectionName) => {
            const unsub = onSnapshot(
                collection(firestore, collectionName),
                snapshot => {
                    const docs = snapshot.docs.map(docSnap => ({
                        path: `${collectionName}/${docSnap.id}`,
                        data: docSnap.data(),
                    }));
                    replaceCollectionDocs(collectionName, docs);
                },
                err => {
                    console.error(`[Firestore V2] ${collectionName} snapshot failed`, err);
                    setStatus(prev => ({ ...prev, error: err.message || String(err) }));
                }
            );
            unsubscribers.push(unsub);
        };

        TOP_LEVEL_COLLECTIONS.forEach(subscribeTopLevel);

        const campaignsUnsub = onSnapshot(
            collection(firestore, V2_COLLECTIONS.campaigns),
            snapshot => {
                const campaignIds = new Set(snapshot.docs.map(docSnap => docSnap.id));

                for (const [campaignId, unsubMap] of campaignUnsubsRef.current.entries()) {
                    if (!campaignIds.has(campaignId)) {
                        for (const unsub of Object.values(unsubMap)) unsub();
                        campaignUnsubsRef.current.delete(campaignId);
                        const nextMap = new Map(docsRef.current);
                        for (const path of Array.from(nextMap.keys())) {
                            if (path.startsWith(`${V2_COLLECTIONS.campaigns}/${campaignId}/`) || path === `${V2_COLLECTIONS.campaigns}/${campaignId}`) {
                                nextMap.delete(path);
                            }
                        }
                        docsRef.current = nextMap;
                    }
                }

                const campaignDocs = snapshot.docs.map(docSnap => ({
                    path: `${V2_COLLECTIONS.campaigns}/${docSnap.id}`,
                    data: docSnap.data(),
                }));
                replaceCollectionDocs(V2_COLLECTIONS.campaigns, campaignDocs);

                snapshot.docs.forEach(docSnap => {
                    const campaignId = docSnap.id;
                    if (campaignUnsubsRef.current.has(campaignId)) return;

                    const subUnsubs = {};
                    CAMPAIGN_SUBCOLLECTIONS.forEach(collectionName => {
                        const collectionPath = `${V2_COLLECTIONS.campaigns}/${campaignId}/${collectionName}`;
                        subUnsubs[collectionName] = onSnapshot(
                            collection(firestore, V2_COLLECTIONS.campaigns, campaignId, collectionName),
                            subSnapshot => {
                                const docs = subSnapshot.docs.map(subDoc => ({
                                    path: `${collectionPath}/${subDoc.id}`,
                                    data: subDoc.data(),
                                }));
                                replaceCollectionDocs(collectionPath, docs);
                            },
                            err => {
                                console.error(`[Firestore V2] ${collectionPath} snapshot failed`, err);
                                setStatus(prev => ({ ...prev, error: err.message || String(err) }));
                            }
                        );
                    });
                    campaignUnsubsRef.current.set(campaignId, subUnsubs);
                });
            },
            err => {
                console.error('[Firestore V2] campaigns snapshot failed', err);
                setStatus(prev => ({ ...prev, error: err.message || String(err) }));
            }
        );
        unsubscribers.push(campaignsUnsub);

        return () => {
            unsubscribers.forEach(unsub => unsub());
            for (const unsubMap of campaignUnsubsRef.current.values()) {
                for (const unsub of Object.values(unsubMap)) unsub();
            }
            campaignUnsubsRef.current.clear();
        };
    }, [replaceCollectionDocs]);

    return {
        v2Store,
        status,
    };
}
