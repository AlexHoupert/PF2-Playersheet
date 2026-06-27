import React, { useEffect, useRef, useState } from 'react';
import { useCampaign } from '../shared/context/CampaignContext';

// Backend / Services
import { fetchShopItemDetailBySourceFile, getShopIndexItemByName } from '../shared/catalog/shopIndex';
import { fetchSpellDetailBySourceFile, getSpellIndexItemByName } from '../shared/catalog/spellIndex';
import { fetchImpulseDetailBySourceFile } from '../shared/catalog/impulseIndex';
import { fetchFeatDetailBySourceFile, getFeatIndexItemByName } from '../shared/catalog/featIndex';
import { fetchActionDetailBySourceFile, getActionIndexItemByName } from '../shared/catalog/actionIndex';
import { getConditionCatalogEntry } from '../shared/constants/conditionsCatalog';
import { selectActiveCharacters } from '../shared/db/selectors/characterSelectors';

import AdminTabContent from './AdminTabContent';
import { ModalManager } from '../player/ModalManager';
import XpOverlay from '../player/components/XpOverlay';

import Sidebar from './components/Sidebar';
import Breadcrumbs from './components/Breadcrumbs';

import '../App.css';
import './AdminApp.css';

export default function AdminApp() {
    const { activeCampaign, assignUser, revokeUser, setPartyXp, setXpThreshold, addPartyXp, dataActions, db } = useCampaign();
    const [activeTab, setActiveTab] = useState('sessions');
    const [playerTabMode, setPlayerTabMode] = useState('cards'); // 'cards' or 'users'

    // Modal State
    const [modalMode, setModalMode] = useState(null);
    const [activeCharIndex, setActiveCharIndex] = useState(null); // For context of modal
    const [modalData, setModalData] = useState(null);

    // Shop Detail Loading (retained logic)
    const shopItemDetailCacheRef = useRef(new Map());
    const [shopItemDetailLoading, setShopItemDetailLoading] = useState(false);
    const [shopItemDetailError, setShopItemDetailError] = useState(null);
    const runDataAction = (action) => {
        Promise.resolve(action).catch(err => {
            console.error(err);
            alert(err?.message || String(err));
        });
    };

    // --- EFFECT: Load Shop Details for Modal ---
    useEffect(() => {
        if (modalMode !== 'item' && modalMode !== 'spell' && modalMode !== 'feat' && modalMode !== 'impulse' || !modalData) {
            setShopItemDetailLoading(false);
            setShopItemDetailError(null);
            return;
        }

        const sourceFile =
            modalData.sourceFile ||
            (modalData?.name ? getShopIndexItemByName(modalData.name)?.sourceFile : null);

        if (!sourceFile) return;
        // If we have description, no need to fetch (unless we want full details?)
        if (modalData.description && modalMode !== 'spell' && modalMode !== 'feat') return;

        const cached = shopItemDetailCacheRef.current.get(sourceFile);
        if (cached) {
            setModalData(prev => (prev && prev.name === modalData.name ? { ...cached, ...prev } : prev));
            return;
        }

        let cancelled = false;
        setShopItemDetailLoading(true);
        setShopItemDetailError(null);

        let fetcher = fetchShopItemDetailBySourceFile;
        if (modalMode === 'spell') fetcher = fetchSpellDetailBySourceFile;
        if (modalMode === 'impulse') fetcher = fetchImpulseDetailBySourceFile;
        if (modalMode === 'feat') fetcher = fetchFeatDetailBySourceFile;

        fetcher(sourceFile)
            .then(detail => {
                shopItemDetailCacheRef.current.set(sourceFile, detail);
                if (cancelled) return;
                setModalData(prev => (prev && prev.name === modalData.name ? { ...detail, ...prev } : prev));
                setShopItemDetailLoading(false);
            })
            .catch(err => {
                if (cancelled) return;
                setShopItemDetailError(err?.message || String(err));
                setShopItemDetailLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [modalData, modalMode]);

    // --- HELPERS ---
    const updateCharacter = (index, fn) => {
        const characterId = characters[index]?.id;
        if (!activeCampaign?.id || !characterId) return;
        runDataAction(dataActions.character.updateCharacter(activeCampaign.id, characterId, fn));
    };

    const handleContentLinkClick = async (e) => {
        const link = e.target.closest('.content-link');
        if (!link) return;
        e.preventDefault();
        e.stopPropagation();

        const type = link.dataset.type;
        const name = link.dataset.name;
        try {
            if (type === 'condition') {
                const entry = getConditionCatalogEntry(name);
                if (entry) { setModalData(name); setModalMode('conditionInfo'); }
            } else if (type === 'action') {
                const idx = getActionIndexItemByName(name);
                if (idx) {
                    const data = await fetchActionDetailBySourceFile(idx.sourceFile);
                    setModalData({ ...data, _entityType: 'action' });
                    setModalMode('item');
                }
            } else if (type === 'item') {
                const idx = getShopIndexItemByName(name);
                if (idx) {
                    const data = await fetchShopItemDetailBySourceFile(idx.sourceFile);
                    setModalData({ ...data, _entityType: 'item' });
                    setModalMode('item');
                }
            } else if (type === 'spell') {
                const idx = getSpellIndexItemByName(name);
                if (idx) {
                    const data = await fetchSpellDetailBySourceFile(idx.sourceFile);
                    setModalData({ ...data, _entityType: 'spell' });
                    setModalMode('item');
                }
            } else if (type === 'feat') {
                const idx = getFeatIndexItemByName(name);
                if (idx) {
                    const data = await fetchFeatDetailBySourceFile(idx.sourceFile);
                    setModalData({ ...data, _entityType: 'feat' });
                    setModalMode('item');
                }
            }
        } catch (err) {
            console.error('Content link navigation error', err);
        }
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
                            onInspectAction={(i) => { setModalData(i); setModalMode('item'); }}
                            onInspectFeat={(i) => { setModalData(i); setModalMode('feat'); }}
                            onInspectImpulse={(i) => { setModalData(i); setModalMode('impulse'); }}
                            onInspectItem={(i) => { setModalData(i); setModalMode('item'); }}
                            onInspectSpell={(i) => { setModalData(i); setModalMode('spell'); }}
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
        </div >
    );
}
