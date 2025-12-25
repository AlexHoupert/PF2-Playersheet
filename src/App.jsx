import { usePersistedDb } from './shared/db/usePersistedDb';
import dbData from './data/new_db.json';
import { CampaignProvider } from './shared/context/CampaignContext';

export default function App() {
    const [db, setDb] = usePersistedDb(dbData);
    const queryParams = new URLSearchParams(window.location.search);

    if (!db) return <div style={{ color: '#fff' }}>Loading...</div>;

    return (
        <CampaignProvider db={db} setDb={setDb}>
            {queryParams.get('admin') === 'true'
                ? <AdminApp db={db} setDb={setDb} />
                : <PlayerApp db={db} setDb={setDb} />
            }
        </CampaignProvider>
    );
}

