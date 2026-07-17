import React, { Suspense, lazy } from 'react';
import { useFirestoreV2Db } from './shared/db/v2/useFirestoreV2Db';
import { CampaignProvider } from './shared/context/CampaignContext';
import { useCampaign } from './shared/context/CampaignContext';
import ErrorBoundary from './shared/components/ErrorBoundary';
import { createE2eRuntimeDb, createE2eV2Store, isE2eFixtureEnabled } from './shared/testing/e2eFixture';

const PlayerApp = lazy(() => import('./player/PlayerApp'));
const AdminApp = lazy(() => import('./admin/AdminApp'));
const PartyScreen = lazy(() => import('./player/PartyScreen'));
const CampScreen = lazy(() => import('./camping/CampScreen'));

export default function App() {
    if (isE2eFixtureEnabled()) return <E2eFixtureApp />;
    return <FirestoreV2App />;
}

function E2eFixtureApp() {
    const [runtimeDb, setRuntimeDb] = React.useState(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.get('e2eReset') === 'true') {
            localStorage.removeItem('pf2:e2e-runtime-db');
        }
        try {
            const stored = localStorage.getItem('pf2:e2e-runtime-db');
            return stored ? JSON.parse(stored) : createE2eRuntimeDb();
        } catch {
            return createE2eRuntimeDb();
        }
    });
    const v2Store = React.useMemo(() => {
        const store = createE2eV2Store();
        const params = new URLSearchParams(window.location.search);
        const requestedRole = params.get('e2eRole');
        if (requestedRole || params.get('admin') === 'true') {
            const campaign = Object.values(store.campaigns || {})[0];
            const member = campaign?.members?.['e2e.player@example.test'];
            if (member) member.role = requestedRole || 'gm';
        }
        return store;
    }, []);
    React.useEffect(() => {
        localStorage.setItem('pf2:e2e-runtime-db', JSON.stringify(runtimeDb));
    }, [runtimeDb]);
    const status = React.useMemo(() => ({
        mode: 'e2e-fixture',
        configured: true,
        ready: true,
        error: null,
        documentCount: v2Store.documentCount || 0,
    }), [v2Store.documentCount]);
    return (
        <AppRoutes
            v2Store={v2Store}
            runtimeDb={runtimeDb}
            setRuntimeDb={setRuntimeDb}
            dbMode="legacy"
            dbStatus={status}
        />
    );
}

function FirestoreV2App() {
    const { v2Store, status } = useFirestoreV2Db();
    return <AppRoutes v2Store={v2Store} dbMode="firestore-v2" dbStatus={status} />;
}

function AppRoutes({ v2Store, runtimeDb = null, setRuntimeDb = null, dbMode, dbStatus }) {
    const queryParams = new URLSearchParams(window.location.search);

    if (!v2Store) return <div style={{ color: '#fff' }}>Loading...</div>;

    const requestedRoute = queryParams.get('party') === 'true'
        ? 'party'
        : queryParams.get('camp') === 'true'
            ? 'camp'
            : queryParams.get('admin') === 'true'
                ? 'admin'
                : 'player';

    return (
        <CampaignProvider
            v2Store={v2Store}
            runtimeDb={runtimeDb}
            setRuntimeDb={setRuntimeDb}
            dbMode={dbMode}
            dbStatus={dbStatus}
        >
            <ErrorBoundary>
                <Suspense fallback={<RouteFallback />}>
                    <AuthorizedRoute route={requestedRoute} />
                </Suspense>
            </ErrorBoundary>
        </CampaignProvider>
    );
}

function AuthorizedRoute({ route }) {
    const { capabilities, userInfo } = useCampaign();
    if (route === 'admin' && !capabilities?.canAccessAdmin) {
        return (
            <div data-testid="route-access-denied" style={{ color: '#ddd', padding: 24 }}>
                This campaign role cannot open the GM screen.
            </div>
        );
    }
    if (!userInfo) return <RouteFallback />;

    return (
        <div data-testid={`${route}-route`}>
            {route === 'party'
                ? <PartyScreen />
                : route === 'camp'
                    ? <CampScreenWrapper />
                    : route === 'admin'
                        ? <AdminApp />
                        : <PlayerApp />}
        </div>
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

