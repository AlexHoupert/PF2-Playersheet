import React, { Suspense, lazy } from 'react';
import SessionManager from './views/SessionManager';
import { CharacterCard } from './components/CharacterCard';

const ItemsView = lazy(() => import('./ItemsView'));
const SpellsView = lazy(() => import('./SpellsView'));
const ImpulsesView = lazy(() => import('./ImpulsesView'));
const FeatsView = lazy(() => import('./FeatsView'));
const ActionsView = lazy(() => import('./ActionsView'));
const AbilitiesView = lazy(() => import('./AbilitiesView'));
const QuestsView = lazy(() => import('./QuestsView'));
const LoreAdminView = lazy(() => import('./LoreAdminView'));
const BestiaryView = lazy(() => import('./BestiaryView'));
const EncounterView = lazy(() => import('./EncounterView'));
const MapAdminView = lazy(() => import('./MapAdminView'));
const ProgressAdminView = lazy(() => import('./ProgressAdminView'));
const CampingAdminView = lazy(() => import('../camping/CampingAdminView'));
const DeviantAbilitiesAdminView = lazy(() => import('../pacts/DeviantAbilitiesAdminView'));
const PactAdminView = lazy(() => import('../pacts/PactAdminView'));
const FirebaseMigrator = lazy(() => import('./FirebaseMigrator'));

export default function AdminTabContent({
    activeTab,
    activeCampaign,
    addPartyXp,
    assignUser,
    characters,
    db,
    handleContentLinkClick,
    handleRebuild,
    onInspectAction,
    onInspectFeat,
    onInspectImpulse,
    onInspectItem,
    onInspectSpell,
    playerTabMode,
    rebuildStatus,
    resetData,
    revokeUser,
    setActiveCharIndex,
    setModalData,
    setModalMode,
    setPartyXp,
    setPlayerTabMode,
    updateCharacter,
}) {
    if (activeTab === 'sessions') return <SessionManager db={db} />;
    if (activeTab === 'players') {
        return (
            <PlayersTab
                activeCampaign={activeCampaign}
                addPartyXp={addPartyXp}
                assignUser={assignUser}
                characters={characters}
                db={db}
                playerTabMode={playerTabMode}
                revokeUser={revokeUser}
                setActiveCharIndex={setActiveCharIndex}
                setModalData={setModalData}
                setModalMode={setModalMode}
                setPartyXp={setPartyXp}
                setPlayerTabMode={setPlayerTabMode}
                updateCharacter={updateCharacter}
            />
        );
    }
    if (activeTab === 'items') return withAdminSuspense(<ItemsView db={db} onInspectItem={onInspectItem} />);
    if (activeTab === 'spells') return withAdminSuspense(<SpellsView db={db} onInspectItem={onInspectSpell} />);
    if (activeTab === 'impulses') return withAdminSuspense(<ImpulsesView db={db} onInspectItem={onInspectImpulse} />);
    if (activeTab === 'feats') return withAdminSuspense(<FeatsView db={db} onInspectItem={onInspectFeat} />);
    if (activeTab === 'actions') return withAdminSuspense(<ActionsView db={db} onInspectItem={onInspectAction} />);
    if (activeTab === 'abilities') return withAdminSuspense(<AbilitiesView db={db} />);
    if (activeTab === 'quests') return withAdminSuspense(<QuestsView db={db} />);
    if (activeTab === 'lore') return withAdminSuspense(<LoreAdminView db={db} />);
    if (activeTab === 'maps') return withAdminSuspense(<MapAdminView />);
    if (activeTab === 'progress') return withAdminSuspense(<ProgressAdminView />);
    if (activeTab === 'camping') return withAdminSuspense(<CampingAdminView />);
    if (activeTab === 'deviant_abilities') return withAdminSuspense(<DeviantAbilitiesAdminView db={db} />);
    if (activeTab === 'pacts') return withAdminSuspense(<PactAdminView db={db} />);
    if (activeTab === 'bestiary' || activeTab === 'bestiary_overview') {
        return withAdminSuspense(<BestiaryView db={db} onContentLinkClick={handleContentLinkClick} />);
    }
    if (activeTab === 'bestiary_creatures') {
        return withAdminSuspense(<BestiaryView db={db} initialFilterType={['npc']} onContentLinkClick={handleContentLinkClick} />);
    }
    if (activeTab === 'bestiary_hazards') {
        return withAdminSuspense(<BestiaryView db={db} initialFilterType={['hazard']} onContentLinkClick={handleContentLinkClick} />);
    }
    if (activeTab === 'encounters') return withAdminSuspense(<EncounterView db={db} />);
    if (activeTab === 'system') {
        return (
            <div style={{ padding: 20, height: '100%', overflowY: 'auto' }}>
                <h2>System</h2>
                {withAdminSuspense(<FirebaseMigrator db={db} />)}
                <div style={{ marginTop: 20 }}>
                    <button onClick={() => handleRebuild('all')}>Rebuild Indexes</button>
                    {rebuildStatus && <span>{rebuildStatus.status}</span>}
                </div>
                <button onClick={resetData} style={{ marginTop: 20, background: 'red' }}>Reset All Data</button>
            </div>
        );
    }
    return null;
}

function withAdminSuspense(node) {
    return <Suspense fallback={<div style={{ padding: 20, color: '#ddd' }}>Loading...</div>}>{node}</Suspense>;
}

function PlayersTab({
    activeCampaign,
    addPartyXp,
    assignUser,
    characters,
    db,
    playerTabMode,
    revokeUser,
    setActiveCharIndex,
    setModalData,
    setModalMode,
    setPartyXp,
    setPlayerTabMode,
    updateCharacter,
}) {
    return (
        <div className="admin-layout-column" style={{ padding: 10, height: '100%', overflowY: 'auto' }}>
            <div className="admin-toolbar">
                <div className="toolbar-left">
                    <h3>{activeCampaign?.name || 'Legacy Campaign'}</h3>
                    <div className="toggle-group">
                        <button className={playerTabMode === 'cards' ? 'active' : ''} onClick={() => setPlayerTabMode('cards')}>Cards</button>
                        <button className={playerTabMode === 'users' ? 'active' : ''} onClick={() => setPlayerTabMode('users')}>Users</button>
                    </div>
                </div>
                {activeCampaign && (
                    <div className="xp-control" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            <span>XP: </span>
                            <input
                                className="modal-input"
                                style={{ width: 80 }}
                                type="number"
                                value={activeCampaign.xp || 0}
                                onChange={(e) => setPartyXp(activeCampaign.id, parseInt(e.target.value) || 0)}
                            />
                        </div>
                        <button
                            className="btn-add-condition"
                            style={{ margin: 0, background: '#c5a059', color: '#111', fontWeight: 'bold' }}
                            onClick={() => {
                                const amtStr = prompt("Amount of XP to add:");
                                if (!amtStr) return;
                                const amt = parseInt(amtStr);
                                if (isNaN(amt) || amt === 0) return;
                                addPartyXp(activeCampaign.id, amt);
                            }}
                        >
                            + Add XP
                        </button>
                    </div>
                )}
            </div>

            {playerTabMode === 'cards' && (
                <div className="players-grid-container">
                    {characters.map((char, i) => (
                        <CharacterCard
                            key={char.id || i}
                            character={char}
                            db={db}
                            updateCharacter={(fn) => updateCharacter(i, fn)}
                            setModalMode={setModalMode}
                            setModalData={setModalData}
                            onOpenModalLong={(data, mode) => {
                                setActiveCharIndex(i);
                                setModalData(data);
                                setModalMode(mode || 'context');
                            }}
                            onOpenModal={(mode, data) => {
                                setActiveCharIndex(i);
                                if (data) setModalData(data);
                                setModalMode(mode);
                            }}
                        />
                    ))}
                </div>
            )}

            {playerTabMode === 'users' && (
                <div className="user-management-panel">
                    <div className="add-user-row">
                        <input id="new-user-email" placeholder="New User Email" />
                        <button onClick={() => {
                            const el = document.getElementById('new-user-email');
                            if (el && el.value.includes('@')) {
                                assignUser(el.value, activeCampaign?.id, null, 'player');
                                el.value = '';
                            }
                        }}>Authorize</button>
                    </div>
                    <table className="user-table">
                        <thead>
                            <tr><th>Email</th><th>Role</th><th>Character</th><th>Action</th></tr>
                        </thead>
                        <tbody>
                            {db.users && Object.entries(db.users).map(([email, info]) => (
                                <tr key={email}>
                                    <td>{email}</td>
                                    <td>{info.role}</td>
                                    <td>
                                        <select
                                            value={info.characterId || ''}
                                            onChange={(e) => assignUser(email, info.campaignId, e.target.value, info.role)}
                                        >
                                            <option value="">None</option>
                                            {characters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                        </select>
                                    </td>
                                    <td><button onClick={() => revokeUser(email)}>Revoke</button></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
