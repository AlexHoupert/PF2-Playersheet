import { usePersistedDb } from './shared/db/usePersistedDb';
import { useFirestoreV2Db } from './shared/db/v2/useFirestoreV2Db';
import dbData from './data/new_db.json';
import { CampaignProvider } from './shared/context/CampaignContext';
import PlayerApp from './player/PlayerApp';
import AdminApp from './admin/AdminApp';
import PartyScreen from './player/PartyScreen';
import CampScreen from './camping/CampScreen';

export default function App() {
    const queryParams = new URLSearchParams(window.location.search);
    const dbMode = queryParams.get('db') || import.meta.env.VITE_DB_MODE || 'legacy';

    if (dbMode === 'v2') {
        return <FirestoreV2App />;
    }

    return <LegacyApp />;
}

function LegacyApp() {
    const [db, setDb] = usePersistedDb(dbData);
    return <AppRoutes db={db} setDb={setDb} dbMode="legacy" />;
}

function FirestoreV2App() {
    const [db, setDb, status] = useFirestoreV2Db(dbData);
    return <AppRoutes db={db} setDb={setDb} dbMode="firestore-v2" dbStatus={status} />;
}

function AppRoutes({ db, setDb, dbMode, dbStatus }) {
    const queryParams = new URLSearchParams(window.location.search);

    if (!db) return <div style={{ color: '#fff' }}>Loading...</div>;

    const isAdmin = queryParams.get('admin') === 'true';
    const isParty = queryParams.get('party') === 'true';
    const isCamp  = queryParams.get('camp')  === 'true';

    return (
        <CampaignProvider db={db} setDb={setDb} isAdmin={isAdmin || isParty || isCamp} dbMode={dbMode} dbStatus={dbStatus}>
            {isParty
                ? <PartyScreen db={db} />
                : isCamp
                    ? <CampScreenWrapper />
                    : isAdmin
                        ? <AdminApp db={db} setDb={setDb} />
                        : <PlayerApp db={db} setDb={setDb} />
            }
        </CampaignProvider>
    );
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

