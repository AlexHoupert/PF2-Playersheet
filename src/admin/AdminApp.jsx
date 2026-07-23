import React, { useEffect, useState } from 'react';
import { useCampaign } from '../shared/context/CampaignContext';
import { useAppFeedback } from '../shared/feedback/AppFeedback';

import { selectActiveCharacters } from '../shared/db/selectors/characterSelectors';
import { useCatalogDetailController } from '../shared/hooks/useCatalogDetailController';
import { canAccessAdminTab, firstAccessibleAdminTab } from '../shared/auth/campaignCapabilities';

import AdminTabContent from './AdminTabContent';
import { ModalManager } from '../player/ModalManager';
import XpOverlay from '../player/components/XpOverlay';

import Sidebar from './components/Sidebar';
import Breadcrumbs from './components/Breadcrumbs';
import EffectRequestCenter from './components/EffectRequestCenter';

import '../App.css';
import './AdminApp.css';

export default function AdminApp() {
    const { activeCampaign, assignUser, revokeUser, setPartyXp, setXpThreshold, addPartyXp, capabilities, dataActions, db } = useCampaign();
    const { notifyError } = useAppFeedback();
    const [activeTab, setActiveTab] = useState(() => firstAccessibleAdminTab(capabilities));
    const [playerTabMode, setPlayerTabMode] = useState('cards'); // 'cards' or 'users'

    // Modal State
    const [modalMode, setModalMode] = useState(null);
    const [activeCharIndex, setActiveCharIndex] = useState(null); // For context of modal
    const [modalData, setModalData] = useState(null);

    useEffect(() => {
        if (!canAccessAdminTab(capabilities, activeTab)) {
            setActiveTab(firstAccessibleAdminTab(capabilities));
        }
    }, [activeTab, capabilities]);

    const { handleContentLinkClick, shopItemDetailError, shopItemDetailLoading } = useCatalogDetailController({
        db,
        modalData,
        modalMode,
        setModalData,
        setModalMode,
    });
    const runDataAction = (action) => {
        Promise.resolve(action).catch(err => {
            console.error(err);
            notifyError(err);
        });
    };

    // --- HELPERS ---
    const updateCharacter = (index, fn) => {
        const characterId = characters[index]?.id;
        if (!activeCampaign?.id || !characterId) return;
        runDataAction(dataActions.character.updateCharacter(activeCampaign.id, characterId, fn));
    };

    const [rebuildStatus, setRebuildStatus] = useState(null);

    const handleRebuild = async (type) => {
        setRebuildStatus({ type, status: 'running' });
        try {
            const res = await fetch(`/api/admin/rebuild-index/${type}`, { method: 'POST' });
            const data = await res.json();
            if (!res.ok) {
                setRebuildStatus({ type, status: 'error', message: data.error || 'Rebuild failed' });
            } else {
                setRebuildStatus({ type, status: 'done', message: data.message || 'Done' });
            }
        } catch (err) {
            setRebuildStatus({ type, status: 'error', message: String(err) });
        }
    };

    // --- RENDER ---
    const characters = selectActiveCharacters(activeCampaign);

    return (
        <div className="app-container admin-theme" onClick={handleContentLinkClick}>
            <div className="admin-shell" style={{ display: 'flex', width: '100%', height: '100%', overflow: 'hidden' }}>
                <Sidebar activeTab={activeTab} onSelect={setActiveTab} />

                {/* HEAD & CONTENT */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
                    <Breadcrumbs activeTab={activeTab} />

                    <div className="admin-content-area" style={{ flex: 1, overflow: 'hidden', padding: 15, background: '#111', display: 'flex', flexDirection: 'column' }}>
                        <AdminTabContent
                            activeTab={activeTab}
                            activeCampaign={activeCampaign}
                            addPartyXp={addPartyXp}
                            assignUser={assignUser}
                            characters={characters}
                            db={db}
                            handleContentLinkClick={handleContentLinkClick}
                            handleRebuild={handleRebuild}
                            onInspectAction={(i) => { setModalData({ ...i, _entityType: 'action' }); setModalMode('catalog_detail'); }}
                            onInspectFeat={(i) => { setModalData({ ...i, _entityType: 'feat' }); setModalMode('catalog_detail'); }}
                            onInspectImpulse={(i) => { setModalData({ ...i, _entityType: 'impulse' }); setModalMode('catalog_detail'); }}
                            onInspectItem={(i) => { setModalData({ ...i, _entityType: 'item' }); setModalMode('catalog_detail'); }}
                            onInspectSpell={(i) => { setModalData({ ...i, _entityType: 'spell' }); setModalMode('catalog_detail'); }}
                            playerTabMode={playerTabMode}
                            rebuildStatus={rebuildStatus}
                            revokeUser={revokeUser}
                            setActiveCharIndex={setActiveCharIndex}
                            setModalData={setModalData}
                            setModalMode={setModalMode}
                            setPartyXp={setPartyXp}
                            setXpThreshold={setXpThreshold}
                            setPlayerTabMode={setPlayerTabMode}
                            updateCharacter={updateCharacter}
                        />
                    </div>
                </div>
            </div>

            <ModalManager
                modalMode={modalMode}
                setModalMode={setModalMode}
                modalData={modalData}
                setModalData={setModalData}
                character={characters[activeCharIndex]}
                updateCharacter={(fn) => updateCharacter(activeCharIndex, fn)}
                onClose={() => { setModalMode(null); setModalData(null); }}
                isLoadingShopDetail={shopItemDetailLoading}
                shopDetailError={shopItemDetailError}
                dailyPrepQueue={[]}
                setDailyPrepQueue={() => { }}
                onContentLinkClick={handleContentLinkClick}
            />

            {/* XP Overlay */}
            <XpOverlay xpNotification={activeCampaign?.xpNotification} />
            <EffectRequestCenter />
        </div >
    );
}
