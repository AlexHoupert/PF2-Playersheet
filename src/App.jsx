import { usePersistedDb } from './shared/db/usePersistedDb';
import dbData from './data/new_db.json';
import { CampaignProvider } from './shared/context/CampaignContext';
import PlayerApp from './player/PlayerApp';
import AdminApp from './admin/AdminApp';

export default function App() {
    const [db, setDb] = usePersistedDb(dbData);
    const queryParams = new URLSearchParams(window.location.search);

    if (!db) return <div style={{ color: '#fff' }}>Loading...</div>;

    const isAdmin = queryParams.get('admin') === 'true';

    return (
        <CampaignProvider db={db} setDb={setDb} isAdmin={isAdmin}>
            {isAdmin
                ? <AdminApp db={db} setDb={setDb} />
                : <PlayerApp db={db} setDb={setDb} />
            }
        </CampaignProvider>
    );
}

