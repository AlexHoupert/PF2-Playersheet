import React, { useEffect, useRef, useState } from 'react';
import { useCampaign } from '../shared/context/CampaignContext';
import { usePersistedDb } from '../shared/db/usePersistedDb';
import { deepClone } from '../shared/utils/deepClone';
import { shouldStack } from '../shared/utils/inventoryUtils';

// Views
import { StatsView } from './views/StatsView';
import { ActionsView } from './views/ActionsView';
import { InventoryView } from './views/InventoryView';
import { MagicView } from './views/MagicView';
import { ImpulsesView } from './views/ImpulsesView';
import { FeatsView } from './views/FeatsView';
import ShopView from './ShopView';
import ItemCatalog from './ItemCatalog';

// Modals
import ItemActionsModal from './ItemActionsModal';
import { UnifiedModalManager } from './modals/UnifiedModalManager';

// Catalog Constants
import {
    FEAT_INDEX_ITEMS, FEAT_INDEX_FILTER_OPTIONS,
    IMPULSE_INDEX_ITEMS, IMPULSE_INDEX_FILTER_OPTIONS,
    SPELL_INDEX_ITEMS, SPELL_INDEX_FILTER_OPTIONS
} from '../shared/catalog';
import { getShopIndexItemByName } from '../shared/catalog/shopIndex';

export default function PlayerApp() {
    const {
        activeCampaign, updateUser, activeCharIndex,
        setActiveCharIndex, isGM
    } = useCampaign();

    // DB Persistence
    const [db, setDb] = usePersistedDb();

    // Local State
    const [activeTab, setActiveTab] = useState('stats');
    const [modalMode, setModalMode] = useState(null);
    const [modalData, setModalData] = useState(null);

    // Shop / Item Actions State
    const [actionModal, setActionModal] = useState({ mode: null, item: null });
    const [catalogMode, setCatalogMode] = useState(null);

    // Derived Character
    const emptyChar = { name: "No Character", level: 1, stats: { hp: { current: 10, max: 10, temp: 0 }, attributes: {} }, inventory: [], conditions: [], feats: [], skills: {} };
    const characters = activeCampaign?.characters || [];
    const character = characters[activeCharIndex] || emptyChar;

    // Helper to update current character
    const updateCharacter = (updater) => {
        setDb(prev => {
            const next = { ...prev };
            const campaignId = activeCampaign?.id;
            if (!campaignId || !next.campaigns?.[campaignId]) return prev;

            const nextChars = [...next.campaigns[campaignId].characters];
            const charClone = deepClone(nextChars[activeCharIndex]);

            if (typeof updater === 'function') {
                updater(charClone);
                nextChars[activeCharIndex] = charClone;
            } else {
                nextChars[activeCharIndex] = updater;
            }

            next.campaigns[campaignId] = {
                ...next.campaigns[campaignId],
                characters: nextChars
            };
            return next;
        });
    };

    // --- Business Logic (Preserved from original) ---

    // Catalog Add Helper
    const addToCharacter = (item, type) => {
        updateCharacter(c => {
            const newItem = { name: item.name };
            if (type === 'feat') {
                if (!c.feats.includes(item.name)) c.feats.push(item.name);
            } else if (type === 'spell') {
                if (!c.magic) c.magic = { list: [] };
                if (!c.magic.list) c.magic.list = [];
                const level = item.level && typeof item.level === 'number' ? String(item.level) : "1";
                newItem.level = level;
                c.magic.list.push(newItem);
            } else if (type === 'impulse') {
                if (!c.impulses) c.impulses = [];
                if (!c.impulses.find(i => i.name === newItem.name)) {
                    c.impulses.push({ ...item });
                }
            }
        });
        setCatalogMode(null);
    };

    // Shop / Item Action Executors
    const executeBuy = (item, qty) => {
        const cost = (item.price || 0) * qty;
        if ((character.gold || 0) < cost) {
            alert("Not enough gold!");
            return;
        }
        updateCharacter(c => {
            c.gold = parseFloat(((c.gold || 0) - cost).toFixed(2));
            if (shouldStack(item)) {
                const existing = c.inventory.find(i => i.name === item.name);
                if (existing) {
                    existing.qty = (existing.qty || 1) + qty;
                } else {
                    c.inventory.push({ ...item, qty });
                }
            } else {
                for (let i = 0; i < qty; i++) {
                    c.inventory.push({ ...item, qty: 1, instanceId: crypto.randomUUID() });
                }
            }
        });
        setActionModal({ mode: null, item: null });
    };

    const executeQty = (item, delta) => {
        updateCharacter(c => {
            const idx = c.inventory.findIndex(i =>
                (item.instanceId && i.instanceId === item.instanceId) ||
                (!item.instanceId && i.name === item.name)
            );
            if (idx === -1) return;
            const current = c.inventory[idx];
            const newQty = (current.qty || 1) + delta;

            if (newQty <= 0) {
                if (confirm(`Remove ${current.name}?`)) {
                    c.inventory.splice(idx, 1);
                }
            } else {
                current.qty = newQty;
            }
        });
        setActionModal({ mode: null, item: null });
    };

    const executeTransfer = (item, targetIdx, qty) => {
        const targetInd = parseInt(targetIdx);
        if (isNaN(targetInd)) return;

        setDb(prev => {
            const next = { ...prev };
            const campaignId = activeCampaign?.id;
            const chars = [...next.campaigns[campaignId].characters];

            const sender = deepClone(chars[activeCharIndex]);
            const recipient = deepClone(chars[targetInd]);

            const sIdx = sender.inventory.findIndex(i =>
                (item.instanceId && i.instanceId === item.instanceId) ||
                (!item.instanceId && i.name === item.name)
            );

            if (sIdx === -1) {
                alert("Error: Item not available.");
                return prev;
            }

            const sItem = sender.inventory[sIdx];
            if ((sItem.qty || 1) < qty) {
                alert("Not enough qty");
                return prev;
            }

            // Remove from sender
            if ((sItem.qty || 1) > qty) {
                sItem.qty = (sItem.qty || 1) - qty;
            } else {
                sender.inventory.splice(sIdx, 1);
            }

            // Add to recipient
            if (shouldStack(item)) {
                const existingIndex = recipient.inventory.findIndex(i => i.name === item.name);
                if (existingIndex > -1) {
                    recipient.inventory[existingIndex].qty = (recipient.inventory[existingIndex].qty || 1) + qty;
                } else {
                    recipient.inventory.push({ ...item, qty });
                }
            } else {
                for (let i = 0; i < qty; i++) {
                    recipient.inventory.push({ ...item, qty: 1, instanceId: crypto.randomUUID() });
                }
            }

            chars[activeCharIndex] = sender;
            chars[targetInd] = recipient;

            next.campaigns[campaignId].characters = chars;
            return next;
        });

        setActionModal({ mode: null, item: null });
    };

    const executeUnstack = (item, qty) => {
        updateCharacter(c => {
            const idx = c.inventory.findIndex(i => i.name === item.name);
            if (idx === -1) return;
            const current = c.inventory[idx];

            if ((current.qty || 1) <= qty) return; // Cannot split more than have

            current.qty -= qty;

            // Add new stack
            c.inventory.push({ ...current, qty, instanceId: crypto.randomUUID() });
        });
        setActionModal({ mode: null, item: null });
    };

    const handleLoadSpecial = (item, ammoItem) => {
        // Placeholder for reloading specific ammo logic
        // This was used for reloading specific ammo into items from the Modal.
        // We can defer this to InventoryView logic if possible, but Modal calls it.
        console.log("Load Special Requested", item, ammoItem);
    };

    const handleUnloadAll = (item) => {
        updateCharacter(c => {
            const idx = c.inventory.findIndex(i => i.name === item.name);
            if (idx > -1) {
                if (c.inventory[idx].loaded) delete c.inventory[idx].loaded;
            }
        });
        setActionModal({ mode: null, item: null });
    };

    const handleBuyFormula = (item, price) => {
        // Used by ShopView
        if (price > character.gold) { alert("Not enough gold"); return; }
        updateCharacter(c => {
            c.gold = (c.gold - price).toFixed(2);
            if (!c.formulaBook) c.formulaBook = [];
            c.formulaBook.push(item.name);
        });
    };

    // --- RENDER ---

    if (activeCharIndex === -1 && !isGM) {
        return (
            <div className="login-container" style={{ justifyContent: 'center', height: '100vh', display: 'flex', alignItems: 'center' }}>
                <div style={{ textAlign: 'center', background: '#1e1e1e', padding: 40, borderRadius: 10 }}>
                    <h2>No Character Assigned</h2>
                    <p>Please ask your GM to assign a character to your account <strong>({db.currentUser?.email})</strong>.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="app-container">
            {/* Header */}
            <div className="header-bar">
                <div className="header-title">
                    <h1 onClick={() => setModalMode('edit_level')}>{character.name}</h1>
                    <small>Level {character.level} | XP: {character.xp?.current}</small>
                </div>
                <div className="header-controls">
                    {isGM && <button className="btn-char-switch" onClick={() => {
                        setActiveCharIndex((prev) => (prev + 1) % characters.length);
                    }}>👥</button>}
                    <div className="gold-display" onClick={() => setModalMode('gold')}>
                        <span>💰</span> {parseFloat(character.gold || 0).toFixed(2)} <span className="gold-unit">gp</span>
                    </div>
                    {isGM && <button className="btn-char-switch" onClick={() => window.location.search = '?admin=true'} title="GM Screen">GM</button>}
                </div>
            </div>

            {/* Navigation */}
            <div className="tabs">
                {['stats', 'actions', 'feats', ...(character.isCaster || character.magic?.list?.length > 0 ? ['magic'] : []), ...(character.isKineticist || character.impulses?.length > 0 ? ['impulses'] : []), 'items', 'shop'].map(tab => {
                    const hasLoot = tab === 'items' && character?.inventory?.some(i => i.isLoot);
                    return (
                        <button
                            key={tab}
                            className={`tab-btn ${activeTab === tab ? 'active' : ''}`}
                            onClick={() => setActiveTab(tab)}
                        >
                            {tab === 'magic' ? 'Magic' : tab === 'impulses' ? 'Impulses' : tab.charAt(0).toUpperCase() + tab.slice(1)}
                            {hasLoot && <span style={{ color: '#d32f2f', marginLeft: 5, fontWeight: 'bold' }}>!</span>}
                        </button>
                    );
                })}
            </div>

            {/* View Content */}
            <div className="view-section">
                {activeTab === 'stats' && <StatsView
                    character={character}
                    updateCharacter={updateCharacter}
                    onOpenModal={(mode, data) => {
                        setModalData(data);
                        setModalMode(mode);
                    }}
                />}

                {activeTab === 'actions' && <ActionsView
                    character={character}
                    onOpenModal={(mode, data) => {
                        setModalData(data);
                        setModalMode(mode);
                    }}
                />}

                {activeTab === 'items' && <InventoryView
                    character={character}
                    updateCharacter={updateCharacter}
                    onOpenModal={(mode, data) => {
                        setModalData(data);
                        setModalMode(mode);
                    }}
                    onOpenActionModal={(mode, item) => setActionModal({ mode, item })}
                />}

                {activeTab === 'magic' && <MagicView
                    character={character}
                    updateCharacter={updateCharacter}
                    onOpenModal={(mode, data) => {
                        setModalData(data);
                        setModalMode(mode);
                    }}
                    onOpenCatalog={() => setCatalogMode('spell')}
                />}

                {activeTab === 'impulses' && <ImpulsesView
                    character={character}
                    onOpenModal={(mode, data) => {
                        setModalData(data);
                        setModalMode(mode);
                    }}
                    onOpenCatalog={() => setCatalogMode('impulse')}
                />}

                {activeTab === 'feats' && <FeatsView
                    character={character}
                    onOpenModal={(mode, data) => {
                        setModalData(data);
                        setModalMode(mode);
                    }}
                    onOpenCatalog={() => setCatalogMode('feat')}
                />}

                {activeTab === 'shop' && <ShopView
                    db={db}
                    onInspectItem={(item) => {
                        setModalData(item);
                        setModalMode('item');
                    }}
                    onBuyItem={(item) => setActionModal({ mode: 'BUY_RESTOCK', item })}
                    onBuyFormula={handleBuyFormula}
                    knownFormulas={character.formulaBook || []}
                />}
            </div>

            {/* --- Modals & Overlays --- */}

            <UnifiedModalManager
                modalMode={modalMode}
                setModalMode={setModalMode}
                modalData={modalData}
                setModalData={setModalData}
                character={character}
                updateCharacter={updateCharacter}
                close={() => setModalMode(null)}
            />

            <ItemActionsModal
                mode={actionModal.mode}
                item={actionModal.item}
                characters={characters}
                activeCharIndex={activeCharIndex}
                onClose={() => setActionModal({ mode: null, item: null })}
                onOpenMode={(m, i) => setActionModal({ mode: m, item: i })}
                onBuy={executeBuy}
                onChangeQty={executeQty}
                onTransfer={executeTransfer}
                onUnstack={executeUnstack}
                onLoadSpecial={handleLoadSpecial}
                onUnloadAll={handleUnloadAll}
                onEditProficiency={(item) => {
                    setActionModal({ mode: null, item: null });
                    setModalData({ item, type: 'weapon_prof' });
                    setModalMode('item_proficiencies');
                }}
            />

            {/* Catalogs */}
            {catalogMode === 'feat' && (
                <ItemCatalog
                    title="Add Feat"
                    items={FEAT_INDEX_ITEMS}
                    filterOptions={FEAT_INDEX_FILTER_OPTIONS}
                    onSelect={(item) => addToCharacter(item, 'feat')}
                    onClose={() => setCatalogMode(null)}
                />
            )}

            {catalogMode === 'spell' && (
                <ItemCatalog
                    title="Add Spell"
                    items={SPELL_INDEX_ITEMS}
                    filterOptions={SPELL_INDEX_FILTER_OPTIONS}
                    onSelect={(item) => addToCharacter(item, 'spell')}
                    onClose={() => setCatalogMode(null)}
                />
            )}

            {catalogMode === 'impulse' && (
                <ItemCatalog
                    title="Add Impulse"
                    items={IMPULSE_INDEX_ITEMS}
                    filterOptions={IMPULSE_INDEX_FILTER_OPTIONS}
                    onClose={() => setCatalogMode(null)}
                    onSelect={(item) => addToCharacter(item, 'impulse')}
                />
            )}
        </div>
    );
}
