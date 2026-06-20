import React, { Suspense, lazy } from 'react';
import { useFirestoreV2Db } from './shared/db/v2/useFirestoreV2Db';
import dbData from './data/new_db.json';
import { CampaignProvider } from './shared/context/CampaignContext';
import ErrorBoundary from './shared/components/ErrorBoundary';

const PlayerApp = lazy(() => import('./player/PlayerApp'));
const AdminApp = lazy(() => import('./admin/AdminApp'));
const PartyScreen = lazy(() => import('./player/PartyScreen'));
const CampScreen = lazy(() => import('./camping/CampScreen'));

export default function App() {
    return <FirestoreV2App />;
}

function FirestoreV2App() {
    const { legacyProjection, v2Store, status } = useFirestoreV2Db(dbData);
    return <AppRoutes legacyDb={legacyProjection} v2Store={v2Store} dbMode="firestore-v2" dbStatus={status} />;
}

function AppRoutes({ legacyDb, v2Store, dbMode, dbStatus }) {
    const queryParams = new URLSearchParams(window.location.search);

    if (!v2Store) return <div style={{ color: '#fff' }}>Loading...</div>;

    const isAdmin = queryParams.get('admin') === 'true';
    const isParty = queryParams.get('party') === 'true';
    const isCamp  = queryParams.get('camp')  === 'true';

    return (
        <CampaignProvider legacyDb={legacyDb} v2Store={v2Store} isAdmin={isAdmin || isParty || isCamp} dbMode={dbMode} dbStatus={dbStatus}>
            <ErrorBoundary>
                <Suspense fallback={<RouteFallback />}>
                    {isParty
                        ? <PartyScreen />
                        : isCamp
                            ? <CampScreenWrapper />
                            : isAdmin
                                ? <AdminApp />
                                : <PlayerApp />
                    }
                </Suspense>
            </ErrorBoundary>
        </CampaignProvider>
    );
}

function RouteFallback() {
    return <div style={{ color: '#fff', padding: 20 }}>Loading...</div>;
}

function CampScreenWrapper() {
    return (
        <div style={{ background: '#111', minHeight: '100vh', color: '#e0e0e0', padding: '20px 24px' }}>
            <div style={{ maxWidth: 700, margin: '0 auto' }}>
                <h1 style={{ fontFamily: 'Cinzel, serif', color: '#c5a059', margin: '0 0 20px 0', fontSize: '1.6em' }}>
                    🏕️ Camp Overview
                </h1>
                <CampScreen />
            </div>
        </div>
    );
}

