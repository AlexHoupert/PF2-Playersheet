/* d:\Repositories\PF2-Playersheet-1\src\player\PlayerApp.jsx */
import React, { useEffect, useRef, useState } from 'react';
import { useCampaign } from '../shared/context/CampaignContext';
import { calculateStat, formatText, ACTION_ICONS } from '../utils/rules';
import { deepClone } from '../shared/utils/deepClone';
import ShopView from './ShopView';
// import { usePersistedDb } from '../shared/db/usePersistedDb';
import { NEG_CONDS, POS_CONDS, VIS_CONDS, BINARY_CONDS, CONDITION_ICONS, getConditionIcon } from '../shared/constants/conditions';
import { conditionsCatalog, getConditionCatalogEntry, getConditionImgSrc, isConditionValued } from '../shared/constants/conditionsCatalog';
import { fetchShopItemDetailBySourceFile, getShopIndexItemByName } from '../shared/catalog/shopIndex';
import { fetchSpellDetailBySourceFile, getSpellIndexItemByName, SPELL_INDEX_ITEMS, SPELL_INDEX_FILTER_OPTIONS } from '../shared/catalog/spellIndex';
import { fetchFeatDetailBySourceFile, getFeatIndexItemByName, FEAT_INDEX_ITEMS, FEAT_INDEX_FILTER_OPTIONS } from '../shared/catalog/featIndex';
import { fetchActionDetailBySourceFile, getAllActionIndexItems, getActionIndexItemByName } from '../shared/catalog/actionIndex';
import { fetchImpulseDetailBySourceFile, getImpulseIndexItemByName, IMPULSE_INDEX_ITEMS, IMPULSE_INDEX_FILTER_OPTIONS } from '../shared/catalog/impulseIndex';
import { getShopItemRowMeta } from '../shared/catalog/shopRowMeta';

import { shouldStack } from '../shared/utils/inventoryUtils';
import bloodMagicEffects from '../../ressources/classfeatures/bloodmagic-effects.json';
import ItemCatalog from './ItemCatalog';
import ItemActionsModal from './ItemActionsModal';
import QuickSheetModal from './QuickSheetModal';
import { StatBreakdown } from './components/StatBreakdown';
import { StatsView } from './views/StatsView';
import { ActionsView } from './views/ActionsView';
import { InventoryView } from './views/InventoryView';
import { MagicView } from './views/MagicView';
import { FeatsView } from './views/FeatsView';
import { ImpulsesView } from './views/ImpulsesView';
import { isEquipableInventoryItem, getWeaponCapacity } from '../shared/utils/combatUtils';
import { ModalManager } from './ModalManager';



const ARMOR_RANKS = [
    { value: 0, label: 'Untrained (+0)' },
    { value: 2, label: 'Trained (+2)' },
    { value: 4, label: 'Expert (+4)' },
    { value: 6, label: 'Master (+6)' },
    { value: 8, label: 'Legendary (+8)' }
];



export default function PlayerApp({ db, setDb }) {
    const { activeCampaign, myCharacter, updateActiveCampaign, isGM } = useCampaign();
    // const [db, setDb] = usePersistedDb(dbData);
    // const [db, setDb] = useState(dbData);

    const [activeCharIndex, setActiveCharIndex] = useState(0);

    const [activeTab, setActiveTab] = useState('stats');
    // const [actionSubTab, setActionSubTab] = useState('Combat'); // Removed
    // const [itemSubTab, setItemSubTab] = useState('Equipment'); // Removed

    const [dailyPrepQueue, setDailyPrepQueue] = useState([]);
    const [modalMode, setModalMode] = useState(null);
    const [modalData, setModalData] = useState(null);
    const [modalHistory, setModalHistory] = useState([]);
    const [actionModal, setActionModal] = useState({ mode: null, item: null });
    const [condTab, setCondTab] = useState('active');
    const tapRef = useRef({ id: null, time: 0 });
    const tapTimeout = useRef(null);

    useEffect(() => {
        if (myCharacter && activeCampaign?.characters) {
            const idx = activeCampaign.characters.findIndex(c => c.id === myCharacter.id);
            if (idx !== -1) setActiveCharIndex(idx);
        }
    }, [myCharacter, activeCampaign]);



    // Fallback if no campaign
    const characters = activeCampaign?.characters || [];
    const character = characters[activeCharIndex];

    // INITIALIZATION GUARD
    if (character) {
        if (!character.impulses) character.impulses = [];
        if (!character.stats.impulse_proficiency) character.stats.impulse_proficiency = 0;
        if (character.isKineticist === undefined) character.isKineticist = false;
        if (character.isCaster === undefined) character.isCaster = false;
        if (!character.stats.spell_proficiency) character.stats.spell_proficiency = 0;
    }

    // If no character found (e.g. empty campaign), guard against crash
    if (!character) {
        return (
            <div style={{ padding: 20, color: '#e0e0e0', textAlign: 'center', marginTop: '20vh' }}>
                <h1 style={{ fontFamily: 'Cinzel, serif', color: '#c5a059' }}>PF2e Companion</h1>
                {activeCampaign ? (
                    <div>
                        <h3>Connected to: {activeCampaign.name}</h3>
                        <p>No character assigned to you.</p>
                        <p style={{ opacity: 0.7 }}>Ask your GM to assign a character to your email.</p>
                    </div>
                ) : (
                    <div>
                        <h3>No Active Campaign</h3>
                        <p>Waiting for connection...</p>
                    </div>
                )}

                <div style={{ marginTop: 40 }}>
                    <button
                        onClick={() => window.location.search = '?admin=true'}
                        style={{ padding: '10px 20px', background: '#333', border: '1px solid #555', color: '#fff', borderRadius: 4, cursor: 'pointer' }}
                    >
                        Login as GM
                    </button>
                </div>
            </div>
        );
    }


    const handleItemClick = (item) => {
        const now = Date.now();
        const isSame = tapRef.current.id === item.name; // Simple ID check
        const isDouble = isSame && (now - tapRef.current.time < 300);

        if (tapTimeout.current) clearTimeout(tapTimeout.current);

        if (isDouble && (item.type === 'Consumable' || item.consumable)) {
            // Execute Consume
            updateCharacter(c => {
                const invIdx = c.inventory.findIndex(i => i.name === item.name);
                if (invIdx > -1) {
                    const invItem = c.inventory[invIdx];
                    if (invItem && invItem.qty > 0) {
                        invItem.qty--;
                        if (invItem.qty === 0) c.inventory.splice(invIdx, 1);
                    }
                }
            });
            // Toast?
            alert(`Used ${item.name}`); // Placeholder for Toast
            tapRef.current = { id: null, time: 0 };
        } else {
            tapRef.current = { id: item.name, time: now };
            // Delay single tap to wait for double
            tapTimeout.current = setTimeout(() => {
                setModalData(item);
                setModalMode('item');
                tapRef.current = { id: null, time: 0 };
            }, 300);
        }
    };

    const handleItemLongPressAction = (item) => {
        setActionModal({ mode: 'CONTEXT', item });
    };

    const handleLongPress = (data, type) => {
        if (type === 'item') {
            setActionModal({ mode: 'CONTEXT', item: data });
        } else {
            setModalData({ item: data, type });
            setModalMode('context');
        }
    };

    // Reuse pressEvents generic but map to this specific handler
    // Overriding generic pressEvents for Inventory Items
    const itemPressEvents = (item) => {
        // Reuse similar logic or create new ref if needed, but generic works if we pass callback
        // Creating local closure
        let timer = null;
        const start = () => {
            timer = setTimeout(() => {
                handleItemLongPressAction(item);
                timer = null;
            }, 600);
        };
        const cancel = () => {
            if (timer) { clearTimeout(timer); timer = null; }
        };
        return {
            onMouseDown: start, onMouseUp: cancel, onMouseLeave: cancel,
            onTouchStart: start, onTouchEnd: cancel
        };
    };

    const executeBuy = (item, qty) => {
        updateCharacter(c => {
            const cost = (item.price || 0) * qty;
            if (c.gold >= cost) {
                c.gold -= cost;
                // Add item
                const stackable = shouldStack(item);
                const existing = stackable ? c.inventory.find(i => i.name === item.name) : null;
                if (existing) existing.qty = (existing.qty || 1) + qty;
                else c.inventory.push({ ...item, qty: qty });
            } else {
                alert("Not enough gold!");
            }
        });
        setActionModal({ mode: null, item: null });
    };

    const executeQty = (item, qty) => {
        updateCharacter(c => {
            const idx = c.inventory.findIndex(i =>
                (item.instanceId && i.instanceId === item.instanceId) ||
                (
                    !item.instanceId &&
                    i.name === item.name &&
                    !!i.equipped === !!item.equipped &&
                    !!i.prepared === !!item.prepared &&
                    i.addedAt === item.addedAt
                )
            );

            if (idx > -1) {
                if (qty <= 0) {
                    c.inventory.splice(idx, 1);
                } else {
                    c.inventory[idx].qty = qty;
                }
            }
        });
        setActionModal({ mode: null, item: null });
    };

    const executeUnstack = (item) => {
        updateCharacter(c => {
            const target = c.inventory.find(i =>
                i.name === item.name &&
                i.qty === item.qty &&
                !!i.equipped === !!item.equipped &&
                !!i.prepared === !!item.prepared &&
                i.addedAt === item.addedAt
            );
            if (target && (target.qty || 1) > 1) {
                const qty = target.qty;
                target.qty = 1;
                for (let k = 1; k < qty; k++) {
                    c.inventory.push({ ...target, qty: 1 });
                }
            }
        });
        setActionModal({ mode: null, item: null });
    };

    // getWeaponCapacity removed (moved to combatUtils)

    const loadWeapon = (weaponIndex, slotIndex, ammoItem = null) => {
        updateCharacter(c => {
            const w = c.inventory[weaponIndex];
            if (!w) return;

            if (!w.loaded) w.loaded = [];

            // If explicit ammo not provided, try to find "Rounds (universal)" or best match
            let ammoToLoad = ammoItem;

            if (!ammoToLoad) {
                // Find standard ammo
                // Logic: Look for "Rounds (universal)" (case insensitive) or any item with "rounds" in name and type/category ammo
                const universal = c.inventory.find(i => i.name.toLowerCase() === "rounds (universal)" && i.qty > 0);
                if (universal) {
                    ammoToLoad = universal;
                } else {
                    // Fallback to any "rounds"
                    const compatible = c.inventory.find(i =>
                        i.name.toLowerCase().includes('round') &&
                        i.qty > 0 &&
                        (i.category === 'ammo' || i.type === 'ammunition' || (i.traits?.value || []).includes('ammunition') || i.name.toLowerCase().includes('rounds'))
                    );
                    if (compatible) ammoToLoad = compatible;
                }
            }

            if (!ammoToLoad) {
                alert("No ammunition found!");
                return;
            }

            // Deduct
            // Use findIndex to ensure safe removal
            const ammoIdx = c.inventory.findIndex(i => (ammoToLoad.instanceId ? i.instanceId === ammoToLoad.instanceId : i.name === ammoToLoad.name) && i.qty > 0);
            if (ammoIdx > -1) {
                const invAmmo = c.inventory[ammoIdx];
                invAmmo.qty--;
                if (invAmmo.qty <= 0) c.inventory.splice(ammoIdx, 1);

                // Load
                // Load
                const isStandard = /^(rounds \(universal\)|rounds?|bolts?|arrows?)/i.test(ammoToLoad.name);
                w.loaded[slotIndex] = {
                    name: ammoToLoad.name,
                    id: ammoToLoad.instanceId || "std",
                    isSpecial: !isStandard // Only special if NOT matches standard patterns
                };
            } else {
                alert("Ammo not found in inventory.");
            }
        });
    };

    const unloadWeapon = (weaponIndex, slotIndex) => { // Legacy cleanup if needed, replaced by fire/unloadAll
        updateCharacter(c => {
            const w = c.inventory[weaponIndex];
            if (!w || !w.loaded || !w.loaded[slotIndex]) return;
            const ammoData = w.loaded[slotIndex];
            // Return to inventory
            const existingStack = c.inventory.find(i => i.name === ammoData.name);
            if (existingStack) {
                existingStack.qty = (existingStack.qty || 0) + 1;
            } else {
                c.inventory.push({ name: ammoData.name, qty: 1, type: 'consumable', category: 'ammo' });
            }
            w.loaded[slotIndex] = null;
        });
    };

    const fireWeapon = (weaponIndex, slotIndex) => {
        updateCharacter(c => {
            const w = c.inventory[weaponIndex];
            if (!w || !w.loaded || !w.loaded[slotIndex]) return;
            // Consume ammo (do NOT return to inventory)
            w.loaded[slotIndex] = null;
        });
    };

    const handleUnloadAll = (weaponOrIndex) => {
        const char = db.characters[activeCharIndex];
        let weaponIndex = weaponOrIndex;
        if (typeof weaponOrIndex === 'object') {
            weaponIndex = char.inventory.findIndex(i =>
                (weaponOrIndex.instanceId && i.instanceId === weaponOrIndex.instanceId) ||
                (i.name === weaponOrIndex.name && !!i.equipped === !!weaponOrIndex.equipped)
            );
        }

        updateCharacter(c => {
            const w = c.inventory[weaponIndex];
            if (!w || !w.loaded) return;

            w.loaded.forEach(ammoData => {
                if (!ammoData) return;
                const existingStack = c.inventory.find(i => i.name === ammoData.name);
                if (existingStack) {
                    existingStack.qty = (existingStack.qty || 0) + 1;
                } else {
                    c.inventory.push({ name: ammoData.name, qty: 1, type: 'consumable', category: 'ammo' });
                }
            });
            w.loaded = []; // Clear all
        });
        setActionModal({ mode: null, item: null });
    };

    const handleLoadSpecial = (weaponOrIndex, ammoItem) => {
        // Fix: Use the `character` prop/state directly instead of trying to look it up from an undefined `db`
        // assuming `character` is available in scope (it is, from props)
        const char = character;

        // If we really need the latest from props, we use 'character'
        // If 'character' is not in scope of this function (it is inside PlayerApp component), we use it. This component receives 'character' as prop.

        let weaponIndex = weaponOrIndex;
        if (typeof weaponOrIndex === 'object') {
            // Fix: Use exact index if provided (from InventoryView injection), otherwise fallback to findIndex
            if (typeof weaponOrIndex._index === 'number') {
                weaponIndex = weaponOrIndex._index;
            } else {
                weaponIndex = char.inventory.findIndex(i =>
                    (weaponOrIndex.instanceId && i.instanceId === weaponOrIndex.instanceId) ||
                    (i.name === weaponOrIndex.name && !!i.equipped === !!weaponOrIndex.equipped)
                );
            }
        }

        const weapon = char.inventory[weaponIndex];
        if (!weapon) return;

        // We need merged for capacity traits?
        const fromIndex = getShopIndexItemByName(weapon.name);
        const merged = fromIndex ? { ...fromIndex, ...weapon } : weapon;

        const capacity = getWeaponCapacity(merged);
        const currentLoaded = weapon.loaded || [];
        let emptySlot = -1;

        for (let i = 0; i < capacity; i++) {
            if (!currentLoaded[i]) {
                emptySlot = i;
                break;
            }
        }

        if (emptySlot === -1) {
            alert("Weapon is full!");
        } else {
            loadWeapon(weaponIndex, emptySlot, ammoItem);
        }

        setActionModal({ mode: null, item: null });
    };

    // getWeaponAttackBonus removed (moved to combatUtils)

    const executeTransfer = (item, targetIdx, qty) => {
        const targetInd = parseInt(targetIdx);
        if (isNaN(targetInd)) return;

        updateActiveCampaign(camp => {
            const chars = [...(camp.characters || [])];
            const sender = { ...chars[activeCharIndex], inventory: [...(chars[activeCharIndex].inventory || [])] };
            const recipient = { ...chars[targetInd], inventory: [...(chars[targetInd].inventory || [])] };

            if (!sender || !recipient) return camp;

            chars[activeCharIndex] = sender;
            chars[targetInd] = recipient;

            const sIdx = sender.inventory.findIndex(i =>
                (item.instanceId && i.instanceId === item.instanceId) ||
                (!item.instanceId && i.name === item.name)
            );

            if (sIdx === -1) {
                alert("Error: Item not available.");
                return camp;
            }

            const sItem = { ...sender.inventory[sIdx] };
            if ((sItem.qty || 1) < qty) {
                alert("Not enough qty");
                return camp;
            }

            // Remove from sender
            if ((sItem.qty || 1) > qty) {
                sItem.qty = (sItem.qty || 1) - qty;
                sender.inventory[sIdx] = sItem;
            } else {
                sender.inventory.splice(sIdx, 1);
            }

            // Add to recipient
            if (shouldStack(item)) {
                const existingIndex = recipient.inventory.findIndex(i => i.name === item.name);
                if (existingIndex > -1) {
                    const existing = { ...recipient.inventory[existingIndex] };
                    existing.qty = (existing.qty || 1) + qty;
                    recipient.inventory[existingIndex] = existing;
                } else {
                    recipient.inventory.push({ ...item, qty });
                }
            } else {
                for (let i = 0; i < qty; i++) {
                    recipient.inventory.push({ ...item, qty: 1, instanceId: crypto.randomUUID() });
                }
            }

            return { ...camp, characters: chars };
        });

        setActionModal({ mode: null, item: null });
    };

    // Catalog State
    const [catalogMode, setCatalogMode] = useState(null); // 'feat', 'spell'

    // Long Press State
    // Long Press State
    const longPressTimer = useRef(null);
    // handleLongPress is defined above at line 160

    // Legacy helpers (startPress/cancelPress/pressEvents) might still be used by non-refactored parts?
    // Let's keep them but remove the duplicate function definitions if they collide.
    // However, the error was specifically about 'handleLongPress' redeclaration.
    // The previous definition at 160 covers it.

    // Removing the duplicate handleLongPress here.

    const startPress = (item, type) => {
        longPressTimer.current = setTimeout(() => {
            handleLongPress(item, type);
            longPressTimer.current = null;
        }, 600);
    };
    const cancelPress = () => {
        if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
        }
    };
    // Helper to bind events
    const pressEvents = (item, type) => ({
        onContextMenu: (e) => {
            e.preventDefault();
            e.stopPropagation();
            handleLongPress(item, type);
        }
    });

    // Helper functions for Catalog
    const addToCharacter = (item, type) => {
        updateCharacter(c => {
            const newItem = { name: item.name };
            if (type === 'feat') {
                if (!c.feats.includes(item.name)) c.feats.push(item.name);
            } else if (type === 'spell') {
                if (!c.magic) c.magic = { list: [] };
                if (!c.magic.list) c.magic.list = [];
                // Default to lvl 1 or cantrip 0
                const level = item.level && typeof item.level === 'number' ? String(item.level) : "1";
                newItem.level = level;
                c.magic.list.push(newItem);
            } else if (type === 'impulse') {
                if (!c.impulses) c.impulses = [];
                // Check dupes?
                if (!c.impulses.find(i => i.name === newItem.name)) {
                    // Fetch details? Usually item has them.
                    // Flatten if needed.
                    c.impulses.push({ ...item });
                }
            }
        });
        setCatalogMode(null);
    };

    const removeFromCharacter = (item, type) => {
        updateCharacter(c => {
            if (type === 'feat') {
                c.feats = c.feats.filter(f => f !== item.name);
            } else if (type === 'spell') {
                const idx = c.magic.list.findIndex(s => s.name === item.name && s.level === item.level);
                if (idx > -1) c.magic.list.splice(idx, 1);
            } else if (type === 'impulse') {
                if (c.impulses) c.impulses = c.impulses.filter(i => i.name !== item.name);
            }
        });
        setModalMode(null);
    };

    const toggleBloodmagic = (spell) => {
        updateCharacter(c => {
            const idx = c.magic.list.findIndex(s => s.name === spell.name && s.level === spell.level);
            if (idx > -1) {
                c.magic.list[idx].Bloodmagic = !c.magic.list[idx].Bloodmagic;
            }
        });
        setModalMode(null);
    };

    const handleBuyFormula = (item, price) => {
        if (!confirm(`Buy Formula for ${item.name} (${price} gp)?`)) return;

        updateCharacter(c => {
            const currentGold = parseFloat(c.gold || 0);
            if (currentGold < price) {
                alert("Not enough gold!");
                return;
            }
            if (!c.formulaBook) c.formulaBook = [];
            if (c.formulaBook.includes(item.name)) {
                alert("You already know this formula.");
                return;
            }

            c.gold = (currentGold - price).toFixed(2);
            c.formulaBook.push(item.name);
        });
    };

    const handleContentLinkClick = async (e) => {
        const link = e.target.closest('.content-link');
        if (!link) return;

        e.preventDefault();
        e.stopPropagation();

        const type = link.dataset.type;
        const name = link.dataset.name; // This name comes from UUID, e.g. "Longsword"

        console.log(`Link clicked: ${type} - ${name}`);

        try {
            if (type === 'action') {
                const idx = getActionIndexItemByName(name);
                if (idx) {
                    const data = await fetchActionDetailBySourceFile(idx.sourceFile);
                    setModalHistory(h => [...h, { mode: modalMode, data: modalData }]);
                    setModalData({ ...data, _entityType: 'action' });
                    setModalMode('item');
                }
            } else if (type === 'item') {
                const idx = getShopIndexItemByName(name);
                if (idx) {
                    const data = await fetchShopItemDetailBySourceFile(idx.sourceFile);
                    setModalHistory(h => [...h, { mode: modalMode, data: modalData }]);
                    setModalData({ ...data, _entityType: 'item' });
                    setModalMode('item');
                }
            } else if (type === 'spell') {
                const idx = getSpellIndexItemByName(name);
                if (idx) {
                    const data = await fetchSpellDetailBySourceFile(idx.sourceFile);
                    setModalHistory(h => [...h, { mode: modalMode, data: modalData }]);
                    setModalData({ ...data, _entityType: 'spell' });
                    setModalMode('item');
                }
            } else if (type === 'feat') {
                const idx = getFeatIndexItemByName(name);
                if (idx) {
                    const data = await fetchFeatDetailBySourceFile(idx.sourceFile);
                    setModalHistory(h => [...h, { mode: modalMode, data: modalData }]);
                    setModalData({ ...data, _entityType: 'feat' });
                    setModalMode('item');
                }
            } else if (type === 'condition') {
                // Use existing catalog helper
                const entry = getConditionCatalogEntry(name);
                if (entry) {
                    // logic in EditModal for 'conditionInfo' expects modalData to be name or object with name
                    // It re-fetches entry from catalog inside EditModal (line 1271)
                    setModalHistory(h => [...h, { mode: modalMode, data: modalData }]);
                    setModalData(name);
                    setModalMode('conditionInfo');
                }
            }
        } catch (err) {
            console.error("Error navigating to link", err);
        }
    };

    const handleBack = () => {
        if (modalHistory.length === 0) return;
        const prev = modalHistory[modalHistory.length - 1];
        setModalData(prev.data);
        setModalMode(prev.mode);
        setModalHistory(prevHistory => prevHistory.slice(0, -1));
    };



    const equipTapRef = useRef({ key: null, time: 0 });
    const equipTapTimeoutRef = useRef(null);
    const shopItemDetailCacheRef = useRef(new Map());
    const [shopItemDetailLoading, setShopItemDetailLoading] = useState(false);
    const [shopItemDetailError, setShopItemDetailError] = useState(null);

    useEffect(() => {
        if (activeTab !== 'items') {
            if (equipTapTimeoutRef.current) {
                clearTimeout(equipTapTimeoutRef.current);
                equipTapTimeoutRef.current = null;
            }
            equipTapRef.current = { key: null, time: 0 };
        }
    }, [activeTab]);

    useEffect(() => {
        return () => {
            if (equipTapTimeoutRef.current) clearTimeout(equipTapTimeoutRef.current);
        };
    }, []);

    useEffect(() => {
        if (modalMode !== 'item' || !modalData) {
            setShopItemDetailLoading(false);
            setShopItemDetailError(null);
            return;
        }

        const isSpell = modalData._entityType === 'spell';
        const isFeat = modalData._entityType === 'feat';

        const isAction = modalData._entityType === 'action';
        const isImpulse = modalData._entityType === 'impulse' || modalData.type === 'Impulse';

        let sourceFile = modalData.sourceFile;
        // Fallback lookup if sourceFile missing but name exists
        if (!sourceFile && modalData.name) {

            if (isSpell) sourceFile = getSpellIndexItemByName(modalData.name)?.sourceFile;
            else if (isFeat) sourceFile = getFeatIndexItemByName(modalData.name)?.sourceFile;
            else if (isAction) sourceFile = getActionIndexItemByName(modalData.name)?.sourceFile;
            else if (isImpulse) sourceFile = getImpulseIndexItemByName(modalData.name)?.sourceFile;
            else sourceFile = getShopIndexItemByName(modalData.name)?.sourceFile;
        }

        if (!sourceFile) return;
        if (modalData.description) return;

        const cached = shopItemDetailCacheRef.current.get(sourceFile);
        if (cached) {
            setModalData(prev => (prev && prev.name === modalData.name ? { ...cached, ...prev } : prev));
            return;
        }

        let cancelled = false;
        setShopItemDetailLoading(true);
        setShopItemDetailError(null);

        let promise = null;

        if (isSpell) promise = fetchSpellDetailBySourceFile(sourceFile);
        else if (isFeat) promise = fetchFeatDetailBySourceFile(sourceFile);
        else if (isAction) promise = fetchActionDetailBySourceFile(sourceFile);
        else if (isImpulse) promise = fetchImpulseDetailBySourceFile(sourceFile);
        else promise = fetchShopItemDetailBySourceFile(sourceFile);

        promise
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

    // --- STATE UPDATERS ---


    const updateCharacter = (updater) => {
        setDb(prev => {
            const next = { ...prev };
            const campaignId = activeCampaign?.id;
            if (!campaignId || !next.campaigns?.[campaignId]) return prev;

            const nextChars = [...next.campaigns[campaignId].characters];
            const charClone = deepClone(nextChars[activeCharIndex]);

            if (typeof updater === 'function') {
                updater(charClone); // Allow mutation
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

    const buyFromCatalog = (item) => {
        if (character.gold < item.price) {
            alert("Not enough gold!");
            return;
        }

        updateCharacter(c => {
            c.gold = parseFloat((c.gold - item.price).toFixed(2));
            // Check if item exists to stack it, or add new
            const stackable = shouldStack(item);
            const existing = stackable ? c.inventory.find(i => i.name === item.name) : null;
            if (existing) {
                existing.qty = (existing.qty || 1) + 1;
                Object.assign(existing, item, { qty: existing.qty });
            }
            else c.inventory.push({ ...item, qty: 1 });
        });
    };

    const inspectInventoryItem = (item) => {
        const fromIndex = item?.name ? getShopIndexItemByName(item.name) : null;
        // Ensure _index is preserved from the item object if present
        const merged = fromIndex ? { ...fromIndex, ...item, qty: item.qty || 1 } : { ...item };
        // If item has _index, ensure it's in the merged object (it should be since we spread item, but let's be safe)
        if (item._index !== undefined) merged._index = item._index;

        setModalData(merged);
        setModalMode('item');
    };

    // isEquipableInventoryItem and getInventoryBucket removed (moved to combatUtils)

    const toggleInventoryEquipped = async (targetItem) => {
        const itemName = targetItem?.name || targetItem;
        if (!itemName) return;

        console.log("ToggleInventory Target:", {
            name: itemName,
            index: targetItem._index, // Log index
            equipped: targetItem.equipped,
            prepared: targetItem.prepared,
            added: targetItem.addedAt
        });

        let shieldFetchData = null;
        // Use the character variable from component scope (derived from activeCampaign)
        // Check if character exists in scope
        const char = character;
        if (!char) return;

        // Find specific item using _index property if available (Most Robust)
        // Fallback to equipped state AND unique props
        const itemToToggle = (typeof targetItem === 'object' && targetItem._index !== undefined)
            ? char.inventory[targetItem._index]
            : (typeof targetItem === 'object'
                ? char.inventory.find(i =>
                    i.name === itemName &&
                    !!i.equipped === !!targetItem.equipped &&
                    !!i.prepared === !!targetItem.prepared &&
                    i.addedAt === targetItem.addedAt
                )
                : char.inventory.find(i => i.name === itemName));

        if (itemToToggle) {
            const fromIndex = itemToToggle?.name ? getShopIndexItemByName(itemToToggle.name) : null;
            const type = String(itemToToggle?.type || fromIndex?.type || '').toLowerCase();

            if (type === 'shield' && !itemToToggle.equipped && (!itemToToggle.system || !itemToToggle.system.hardness)) {
                const sourceFile = itemToToggle.sourceFile || fromIndex?.sourceFile;
                if (sourceFile) {
                    try {
                        const res = await fetch(`/api/static/equipment/${sourceFile}`);
                        if (res.ok) {
                            shieldFetchData = await res.json();
                        }
                    } catch (e) {
                        console.error("Failed to fetch shield data", e);
                    }
                }
            }
        }

        updateCharacter(c => {
            // Precise lookup: Match _index if available
            let idx = -1;

            if (typeof targetItem === 'object' && targetItem._index !== undefined) {
                idx = targetItem._index;
                // Validation: Ensure the item at this index actually matches the name
                if (!c.inventory[idx] || c.inventory[idx].name !== itemName) {
                    console.warn("Index mismatch in toggleInventoryEquipped, falling back to search");
                    idx = -1;
                }
            }

            if (idx === -1) {
                idx = c.inventory.findIndex(i => {
                    if (i.name !== itemName) return false;
                    if (typeof targetItem === 'object') {
                        return !!i.equipped === !!targetItem.equipped &&
                            !!i.prepared === !!targetItem.prepared &&
                            i.addedAt === targetItem.addedAt;
                    }
                    return true;
                });
            }

            if (idx === -1) return;
            const current = c.inventory[idx];
            if (!isEquipableInventoryItem(current)) return;

            const fromIndex = current?.name ? getShopIndexItemByName(current.name) : null;
            const type = String(current?.type || fromIndex?.type || '').toLowerCase();

            if (type === 'armor') {
                const nextEquipped = !Boolean(current.equipped);

                if (!c.stats) c.stats = {};
                if (!c.stats.ac) c.stats.ac = {};

                c.stats.ac.last_armor = current.name;

                if (nextEquipped) {
                    c.inventory.forEach(invItem => {
                        const invIndex = invItem?.name ? getShopIndexItemByName(invItem.name) : null;
                        const invType = String(invItem?.type || invIndex?.type || '').toLowerCase();
                        if (invType === 'armor') invItem.equipped = false;
                    });
                    current.equipped = true;
                    c.stats.ac.armor_equipped = true;
                } else {
                    current.equipped = false;
                    const anyArmorEquipped = c.inventory.some(invItem => {
                        const invIndex = invItem?.name ? getShopIndexItemByName(invItem.name) : null;
                        const invType = String(invItem?.type || invIndex?.type || '').toLowerCase();
                        return invType === 'armor' && Boolean(invItem?.equipped);
                    });
                    c.stats.ac.armor_equipped = anyArmorEquipped;
                }
                return;
            }

            if (type === 'shield') {
                const nextEquipped = !Boolean(current.equipped);

                // Initialize AC stats if missing
                if (!c.stats) c.stats = {};
                if (!c.stats.ac) c.stats.ac = {};

                if (nextEquipped) {
                    // Un-equip other shields
                    c.inventory.forEach(invItem => {
                        const invIndex = invItem?.name ? getShopIndexItemByName(invItem.name) : null;
                        const invType = String(invItem?.type || invIndex?.type || '').toLowerCase();
                        if (invType === 'shield') invItem.equipped = false;
                    });
                    current.equipped = true;

                    if (shieldFetchData) {
                        current.system = { ...(current.system || {}), ...shieldFetchData.system };
                    }

                    const itemMax = (current.system?.hp?.max) || (fromIndex?.system?.hp?.max) || 20;
                    const itemVal = (current.system?.hp?.value) || (fromIndex?.system?.hp?.value) || itemMax;
                    c.stats.ac.shield_hp = itemVal;
                } else {
                    current.equipped = false;
                }
                return;
            }

            // Handle Stackable Items (e.g., Bombs)
            if (shouldStack(current)) {
                // CASE 1: Equipping from a stack > 1 -> Split
                if (!current.equipped && (current.qty || 1) > 1) {
                    current.qty -= 1;
                    c.inventory.push({ ...current, qty: 1, equipped: true });
                    return;
                }

                // CASE 2: Unequipping -> Merge back if possible
                if (current.equipped) {
                    const stackTarget = c.inventory.find(i =>
                        i.name === current.name &&
                        !i.equipped &&
                        i !== current &&
                        !!i.prepared === !!current.prepared &&
                        i.addedAt === current.addedAt
                    );
                    if (stackTarget) {
                        stackTarget.qty = (stackTarget.qty || 1) + (current.qty || 1);
                        // Remove the now-merged item
                        c.inventory.splice(idx, 1);
                        return;
                    }
                }
            }

            current.equipped = !current.equipped;
        });
    };

    const saveNewAction = (actionData) => {
        if (!actionData.name) return;

        // Auto-wrap name in gold as requested
        const finalName = `[gold]${actionData.name}[/gold]`;
        const id = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString();

        const actionObj = {
            id,
            name: finalName,
            type: actionData.type,
            subtype: actionData.subtype,
            skill: actionData.skill,
            feat: actionData.feat,
            description: actionData.description
        };

        setDb(prev => ({ ...prev, actions: { ...prev.actions, [finalName]: actionObj } }));
        setModalMode(null);
    };

    // --- RENDER HELPERS ---

    const renderHealth = () => {
        const hp = character.stats.hp.current;
        const maxHp = character.stats.hp.max;
        const tempHp = character.stats.hp.temp;
        const pct = Math.min(100, Math.max(0, (hp / maxHp) * 100));
        const tempPct = Math.min(100, Math.max(0, (tempHp / maxHp) * 100));

        let barColor = '#4caf50';
        if (pct < 25) barColor = '#d32f2f';
        else if (pct < 50) barColor = '#f57c00';

        return (
            <div className={`health-section ${tempHp > 0 ? 'has-temp-hp' : ''}`} onClick={() => setModalMode('hp')} {...pressEvents(null, 'max_hp')}>
                <div className="bar-container">
                    <div className="bar-fill" style={{ width: `${pct}%`, backgroundColor: barColor }}></div>
                    <div className="bar-text">
                        {hp} / {maxHp} {tempHp > 0 && <span style={{ color: '#e3f2fd', marginLeft: 5 }}>(+{tempHp})</span>}
                    </div>
                </div>
                {tempHp > 0 && (
                    <div id="tempHpArea">
                        <div
                            className="temp-hp-container"
                            style={{
                                display: 'block',
                                width: `${tempPct}%`
                            }}
                        >
                            <div className="temp-bar-fill" style={{ width: '100%' }}></div>
                            <div className="temp-text">
                                {`+${tempHp}${tempHp >= 5 ? ` ${tempHp >= 7 ? 'Temp HP' : 'Temp'}` : ''}`}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    const renderConditions = () => {
        const activeConditions = character.conditions.filter(c => c.level > 0);
        return (
            <div style={{ minHeight: 36 }}>
                <div className="conditions-container">
                    {activeConditions.map(c => {
                        const lower = c.name.toLowerCase();
                        let badgeClass = "condition-badge";
                        if (POS_CONDS.includes(lower)) badgeClass += " cond-positive";
                        else if (VIS_CONDS.includes(lower)) badgeClass += " cond-visibility";
                        const isBinary = !isConditionValued(c.name);
                        const iconSrc = getConditionImgSrc(c.name);

                        return (
                            <div key={c.name} className={badgeClass} onClick={() => { setModalMode('condition'); setCondTab('active'); }}>
                                {iconSrc ? (
                                    <img src={iconSrc} alt="" style={{ width: 20, height: 20, objectFit: 'contain' }} />
                                ) : (
                                    <span style={{ fontSize: '1.2em' }}>{getConditionIcon(c.name) || "🔴"}</span>
                                )}
                                <span className="cond-name">{c.name}</span>
                                <span className={isBinary ? "cond-level-hidden" : "cond-level"}>{c.level}</span>
                            </div>
                        );
                    })}
                </div>
                {activeConditions.length === 0 && <button className="btn-add-condition" onClick={() => { setModalMode('condition'); setCondTab(activeConditions.length > 0 ? 'active' : 'negative'); }}>
                    + Add Condition
                </button>}
            </div>
        );
    };

    const getArmorClassData = (char) => {
        const dexMod = Number(char?.stats?.attributes?.dexterity) || 0;
        const level = Math.max(0, Math.trunc(Number(char?.level) || 0));

        const getProfValue = (key) => {
            const profs = char?.proficiencies;
            if (profs && typeof profs === 'object' && !Array.isArray(profs)) {
                const val = profs[key] ?? profs[String(key).toLowerCase()];
                const num = Number(val);
                return Number.isFinite(num) ? num : 0;
            }
            if (Array.isArray(profs)) {
                const found = profs.find(p => String(p?.name || '').toLowerCase() === String(key).toLowerCase());
                const num = Number(found?.prof);
                return Number.isFinite(num) ? num : 0;
            }
            return 0;
        };

        const getArmorProfKey = (category) => {
            const cat = String(category || '').toLowerCase();
            if (cat.startsWith('light')) return 'Light';
            if (cat.startsWith('medium')) return 'Medium';
            if (cat.startsWith('heavy')) return 'Heavy';
            return 'Unarmored';
        };

        const inventory = Array.isArray(char?.inventory) ? char.inventory : [];
        const equippedArmorEntry = inventory.find(invItem => {
            if (!invItem?.equipped) return false;
            const fromIndex = invItem?.name ? getShopIndexItemByName(invItem.name) : null;
            const type = String(invItem?.type || fromIndex?.type || '').toLowerCase();
            return type === 'armor';
        });
        const equippedArmor = equippedArmorEntry?.name
            ? { ...(getShopIndexItemByName(equippedArmorEntry.name) || {}), ...equippedArmorEntry }
            : null;

        const armorCategory = equippedArmor?.category || null;
        const armorItemBonus = typeof equippedArmor?.acBonus === 'number' ? equippedArmor.acBonus : 0;
        const dexCap = equippedArmor?.dexCap;
        const dexUsed = typeof dexCap === 'number' ? Math.min(dexMod, dexCap) : dexMod;

        const profKey = equippedArmor ? getArmorProfKey(armorCategory) : 'Unarmored';
        const profRank = getProfValue(profKey);
        const profBonus = profRank > 0 ? profRank + level : 0;

        // Shield Logic
        const equippedShieldEntry = inventory.find(invItem => {
            if (!invItem?.equipped) return false;
            const fromIndex = invItem?.name ? getShopIndexItemByName(invItem.name) : null;
            const type = String(invItem?.type || fromIndex?.type || '').toLowerCase();
            return type === 'shield';
        });
        const equippedShield = equippedShieldEntry?.name
            ? { ...(getShopIndexItemByName(equippedShieldEntry.name) || {}), ...equippedShieldEntry }
            : null;

        const shieldRaised = Boolean(char.stats?.ac?.shield_raised); // UPDATED: Use shield_raised instead of shield_equipped
        // Default steel shield has 2 AC bonus usually
        const shieldItemBonus = equippedShield ? (equippedShield.system?.acBonus || 2) : 0;
        const activeShieldBonus = shieldRaised ? shieldItemBonus : 0;

        const baseAC = 10 + dexUsed + profBonus + armorItemBonus + activeShieldBonus;

        const getCondLevel = (n) => {
            const c = (char?.conditions || []).find(x => String(x?.name || '').toLowerCase() === String(n).toLowerCase());
            return c ? c.level : 0;
        };

        let statusPenalty = 0;
        const frightened = getCondLevel('frightened');
        const clumsy = getCondLevel('clumsy');
        const sickened = getCondLevel('sickened');

        if (frightened > 0) statusPenalty = Math.min(statusPenalty, -frightened);
        if (clumsy > 0) statusPenalty = Math.min(statusPenalty, -clumsy);
        if (sickened > 0) statusPenalty = Math.min(statusPenalty, -sickened);

        let circPenalty = 0;
        const offGuardSources = ['off-guard', 'prone', 'grabbed', 'restrained', 'paralyzed', 'unconscious', 'blinded'];
        const isOffGuard = (char?.conditions || []).some(c => offGuardSources.includes(String(c?.name || '').toLowerCase()) && c.level > 0);
        if (isOffGuard) circPenalty = -2;

        const acPenalty = statusPenalty + circPenalty;
        const totalAC = baseAC + acPenalty;

        return {
            armorName: equippedArmor?.name || null,
            armorCategory,
            armorItemBonus,
            shieldName: equippedShield?.name || null,
            shieldItemBonus,
            shieldRaised,
            activeShieldBonus,
            dexMod,
            dexCap,
            dexUsed,
            profKey,
            profRank,
            level,
            profBonus,
            baseAC,
            statusPenalty,
            circPenalty,
            acPenalty,
            totalAC
        };
    };

    const renderDefenses = () => {
        const saves = ["Fortitude", "Reflex", "Will"];

        const acData = getArmorClassData(character);
        const totalAC = acData.totalAC;
        const acPenalty = acData.acPenalty;
        const equippedShield = acData.shieldName ? character.inventory.find(i => i.name === acData.shieldName) : null;

        // Calculate Shield Stats for both Badge and Bar
        let shieldHp = 0, shieldMax = 20, isBroken = false, hardness = 0, shieldPct = 0;
        if (equippedShield) {
            shieldHp = character.stats.ac.shield_hp || 0;
            const fromIndex = equippedShield?.name ? getShopIndexItemByName(equippedShield.name) : null;
            const merged = fromIndex ? { ...fromIndex, ...equippedShield } : equippedShield;
            shieldMax = (merged.system?.hp?.max) || 20;
            hardness = (merged.system?.hardness) || 0;
            isBroken = shieldHp < (shieldMax / 2);
            shieldPct = Math.min(100, Math.max(0, (shieldHp / shieldMax) * 100));
        }

        return (
            <div>
                <h3 style={{ borderBottom: '1px solid #5c4033', paddingBottom: 5, marginBottom: 10 }}>Defenses</h3>
                <div className="defenses-row">
                    {/* AC Shield */}
                    <div className="shield-container" style={{ position: 'relative' }} onClick={() => setModalMode('ac')} {...pressEvents(null, 'ac_button')}>
                        <div className="shield-shape">
                            <div className={`shield-val ${acPenalty < 0 ? 'stat-penalty' : ''}`}>
                                {totalAC}
                                {acPenalty < 0 && <span className="stat-penalty-inline">({acPenalty})</span>}
                            </div>
                            <div className="shield-label">AC</div>
                        </div>
                        {/* Raise Shield Badge */}
                        {equippedShield && (
                            <div
                                style={{
                                    position: 'absolute',
                                    bottom: -5,
                                    right: -8,
                                    width: 28,
                                    height: 28,
                                    borderRadius: '50%',
                                    background: acData.shieldRaised ? '#222' : 'rgba(0,0,0,0.5)',
                                    border: `2px solid ${acData.shieldRaised ? '#ffecb3' : '#666'}`,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '0.8em',
                                    fontWeight: 'bold',
                                    cursor: 'pointer',
                                    zIndex: 10,
                                    boxShadow: '0 2px 4px rgba(0,0,0,0.5)',
                                    textDecorationLine: (isBroken) ? 'line-through' : 'none',
                                    textDecorationColor: '#ff5252',
                                    textDecorationThickness: '2px',
                                    borderColor: isBroken ? '#ff5252' : (acData.shieldRaised ? '#ffecb3' : '#666'),
                                    color: isBroken ? '#ff5252' : (acData.shieldRaised ? '#ffecb3' : '#aaa')
                                }}
                                onClick={(e) => {
                                    e.stopPropagation(); // Don't open modal
                                    if (isBroken && !acData.shieldRaised) return; // Prevent RAISING if broken. Allow lowering.
                                    updateCharacter(c => {
                                        if (!c.stats.ac) c.stats.ac = {};
                                        c.stats.ac.shield_raised = !c.stats.ac.shield_raised;
                                    });
                                }}
                                title={isBroken ? "Shield Broken (Cannot Raise)" : (acData.shieldRaised ? "Lower Shield" : "Raise Shield")}
                            >
                                <span style={{ pointerEvents: 'none' }}>+{acData.shieldItemBonus}</span>
                            </div>
                        )}
                    </div>

                    {/* Saves */}
                    {saves.map(save => {
                        const raw = character.stats.saves[save.toLowerCase()] || 0;
                        const calc = calculateStat(character, save, raw);
                        return (
                            <div className="save-box" key={save} onClick={() => {
                                setModalData({ title: save, ...calc });
                                setModalMode('detail');
                            }} {...pressEvents(save, 'save')}>
                                <div className={`save-val ${calc.penalty < 0 ? 'stat-penalty' : ''}`}>
                                    {calc.total >= 0 ? '+' : ''}{calc.total}
                                    {calc.penalty < 0 && <span className="stat-penalty-inline">({calc.penalty})</span>}
                                </div>
                                <div className="save-label">{save}</div>
                            </div>
                        );
                    })}
                </div>

                {
                    equippedShield && (
                        <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 10 }} onClick={() => setModalMode('shield')}>
                            <div style={{ fontSize: '0.85em', color: isBroken ? '#ff5252' : '#ccc', width: 80, flexShrink: 0, textDecorationLine: isBroken ? 'line-through' : 'none', textDecorationColor: '#ff5252', textDecorationThickness: '2px' }}>
                                Hardness: <span style={{ color: isBroken ? '#ff5252' : '#fff' }}>{hardness}</span>
                            </div>
                            <div className="shield-hp-bar" style={{ flex: 1, height: 20, background: '#222', borderRadius: 4, overflow: 'hidden', position: 'relative', border: '1px solid #555', cursor: 'pointer' }}>
                                <div style={{ width: `${shieldPct}%`, background: '#9e9e9e', height: '100%', transition: 'width 0.3s' }}></div>
                                <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75em', color: '#fff', textShadow: '0 0 3px black', fontWeight: 'bold' }}>
                                    {shieldHp} / {shieldMax} {isBroken && <span style={{ color: '#ff5252', marginLeft: 5 }}>(BROKEN)</span>}
                                </div>
                            </div>
                        </div>
                    )
                }
            </div >
        );
    };

    const ATTR_ABBREV = {
        "strength": "STR", "dexterity": "DEX", "constitution": "CON",
        "intelligence": "INT", "wisdom": "WIS", "charisma": "CHA"
    };

    const renderAttributes = () => {
        const orderedKeys = ["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"];
        return (
            <div className="attributes-container">
                {orderedKeys.map(key => {
                    const val = character.stats.attributes[key] || 0;
                    return (
                        <div className="attr-box" key={key} {...pressEvents({ key, label: ATTR_ABBREV[key] || key }, 'attribute')}>
                            <div className="attr-val">{val >= 0 ? `+${val}` : val}</div>
                            <div className="attr-label">{ATTR_ABBREV[key] || key.substring(0, 3)}</div>
                        </div>
                    );
                })}
            </div>
        );
    };

    const renderSpecialStats = () => (
        <div className="special-stats-row">
            <div style={{ width: '100%', height: '1px', backgroundColor: '#5c4033', margin: '5px 0' }}></div>
            {/* Perception Eye */}
            <div className="special-stat-group">
                <div className="eye-box" onClick={() => {
                    const calc = calculateStat(character, "Perception", character.stats.perception);
                    setModalData({ title: "Perception", ...calc });
                    setModalMode('detail');
                }} {...pressEvents(character.stats.perception, 'perception')}>
                    <div className="eye-content">
                        <span>+{calculateStat(character, "Perception", character.stats.perception).total}</span>
                        <span style={{ fontSize: '0.4em', textTransform: 'uppercase' }}>Perception</span>
                    </div>
                </div>
                <div className="senses-box">
                    {character.senses.length ? character.senses.join(", ") : "Normal"}
                </div>
            </div>

            {/* Speed Circle */}
            <div className="special-stat-group">
                <div className="circle-box"
                    onClick={() => {
                        setModalData({ title: "Speed", description: Object.entries(character.stats.speed).map(([k, v]) => `${k}: ${v} ft`).join('\n') });
                        setModalMode('item'); // Reuse item modal for simple text
                    }}
                    {...pressEvents(character.stats.speed, 'speed')}
                >
                    <div className="circle-content">
                        <span>{character.stats.speed.land}</span>
                        <span style={{ fontSize: '0.4em', textTransform: 'uppercase' }}>Speed</span>
                    </div>
                </div>
            </div>

            {/* Class DC Diamond */}
            <div className="special-stat-group">
                <div className="diamond-box" {...pressEvents(null, 'class_dc')}>
                    <div className="diamond-content">
                        <span>{character.stats.class_dc}</span>
                        <span style={{ fontSize: '0.4em', textTransform: 'uppercase' }}>Class DC</span>
                    </div>
                </div>
            </div>
        </div >
    );

    const renderLanguages = () => (
        <div className="languages-box" {...pressEvents(null, 'language')}>
            <div className="lang-header">Languages</div>
            <div className="lang-list">
                {character.languages.map(l => <div key={l} className="lang-item">{l}</div>)}
            </div>
        </div>
    );

    const renderSkills = () => {
        const skillAbility = {
            acrobatics: 'Dex',
            arcana: 'Int',
            athletics: 'Str',
            crafting: 'Int',
            deception: 'Cha',
            diplomacy: 'Cha',
            intimidation: 'Cha',
            intimidate: 'Cha', // Alias
            medicine: 'Wis',
            nature: 'Wis',
            occultism: 'Int',
            performance: 'Cha',
            perform: 'Cha', // Alias
            religion: 'Wis',
            society: 'Int',
            stealth: 'Dex',
            survival: 'Wis',
            thievery: 'Dex'
        };

        return Object.entries(character.skills).sort().map(([name, val]) => {
            if ((!val && val !== 0) && name.startsWith("Lore")) return null;
            const calc = calculateStat(character, name, val);
            const isTrained = val > 0;
            const baseSkill = name.split('_')[0].toLowerCase();
            const ability = baseSkill === 'lore' ? 'Int' : skillAbility[baseSkill];
            const rawName = name.replace('_', ' ');
            const displayName = rawName.charAt(0).toUpperCase() + rawName.slice(1);
            const label = ability ? `${displayName} (${ability})` : displayName;

            return (
                <div className="item-row" key={name}
                    onClick={() => {
                        setModalData({ title: name.replace('_', ' '), ...calc });
                        setModalMode('detail');
                    }}
                    {...pressEvents({ key: name, name: label }, 'skill')}
                >
                    <span className="item-name" style={{ color: isTrained ? 'var(--text-gold)' : '#ccc' }}>
                        {label} {calc.penalty < 0 && <span className="stat-penalty-sub">({calc.penalty})</span>}
                    </span>
                    <span className={`skill-val ${calc.penalty < 0 ? 'stat-penalty' : ''}`} style={{ color: isTrained && calc.penalty >= 0 ? 'var(--text-gold)' : '' }}>
                        {calc.total >= 0 ? '+' : ''}{calc.total}
                    </span>
                </div>
            );
        });
    };



    const renderInventory = () => {
        const items = Array.isArray(character.inventory) ? character.inventory : [];
        // Fix: We must access items by their original index in character.inventory for updates to work
        const wrappedItems = items.map((item, index) => ({ item, index }));

        const equipmentItems = wrappedItems.filter(({ item }) => getInventoryBucket(item) === 'equipment');
        const consumableItems = wrappedItems.filter(({ item }) => getInventoryBucket(item) === 'consumables');
        const miscItems = wrappedItems.filter(({ item }) => getInventoryBucket(item) === 'misc');

        const renderRow = (item, index, { enableEquipTap = false } = {}) => {
            const key = `${item?.name}-${index}`;
            const qty = item?.qty || 1;
            const fromIndex = item?.name ? getShopIndexItemByName(item.name) : null;
            const merged = fromIndex ? { ...fromIndex, ...item } : item;
            const { row1, row2 } = getShopItemRowMeta(merged);

            // Determine Click Handler
            // If EnableEquipTap is true AND item is equipable: Double click = Toggle Equip.
            // Else if item is Consumable: Double click = Consume (via handleItemClick).
            // Else: Single Click = Inspect (via handleItemClick which has built-in delay).

            let clickHandler;
            if (enableEquipTap && isEquipableInventoryItem(item)) {
                // Use local equip logic
                clickHandler = () => {
                    const tapKey = String(item?.name || '');
                    const now = Date.now();
                    const last = equipTapRef.current;
                    const isDoubleTap = last.key === tapKey && now - last.time < 320;

                    if (equipTapTimeoutRef.current) {
                        clearTimeout(equipTapTimeoutRef.current);
                        equipTapTimeoutRef.current = null;
                    }

                    if (isDoubleTap) {
                        equipTapRef.current = { key: null, time: 0 };
                        toggleInventoryEquipped(item); // Pass full item for context
                        return;
                    }

                    equipTapRef.current = { key: tapKey, time: now };
                    equipTapTimeoutRef.current = setTimeout(() => {
                        inspectInventoryItem(item);
                        equipTapTimeoutRef.current = null;
                    }, 260);
                };
            } else {
                // Use global Consumable/Inspect logic
                clickHandler = () => handleItemClick(item);
            }

            return (
                <div className="item-row inventory-item-row" key={key}
                    onClick={clickHandler}
                    {...itemPressEvents(merged)}
                >
                    {merged?.img && (
                        <img
                            className="item-icon"
                            src={`ressources/${merged.img}`}
                            alt=""
                        />
                    )}
                    <div className="item-row-main">
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div className="item-name">
                                {merged?.name || 'Unknown Item'}
                                {item.prepared && (
                                    <span style={{
                                        marginLeft: 8,
                                        fontSize: '0.7em',
                                        background: '#30204a',
                                        color: '#b39ddb',
                                        border: '1px solid #5e35b1',
                                        padding: '1px 4px',
                                        borderRadius: 4,
                                        verticalAlign: 'middle',
                                        fontStyle: 'italic',
                                        display: 'inline-block'
                                    }}>
                                        ⚡ Temp
                                    </span>
                                )}
                            </div>

                            {/* Ammo Slots & Counter (Left of Bonus) */}
                            {isEquipableInventoryItem(item) && (['crossbow', 'firearm'].includes((merged.group || '').toLowerCase()) || (merged.traits?.value || []).includes('repeating') || /bow|crossbow|firearm|pistol|musket|rifle|gun/i.test(merged.name)) && (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', marginLeft: 10 }}>
                                    <div style={{ display: 'flex', gap: 4 }}>
                                        {Array.from({ length: getWeaponCapacity(merged) }).map((_, idx) => {
                                            const loadedAmmo = item.loaded && item.loaded[idx];
                                            const isFilled = !!loadedAmmo;
                                            const isSpecial = loadedAmmo?.isSpecial;

                                            return (
                                                <div
                                                    key={idx}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        // Pass INDEX of item in inventory
                                                        if (isFilled) fireWeapon(index, idx);
                                                        else loadWeapon(index, idx);
                                                    }}
                                                    style={{
                                                        width: 18, height: 18, borderRadius: '50%',
                                                        border: '1px solid #c5a059',
                                                        background: isFilled ? (isSpecial ? '#42a5f5' : '#c5a059') : 'transparent',
                                                        cursor: 'pointer'
                                                    }}
                                                    title={isFilled ? `Unload ${loadedAmmo.name}` : "Load Standard Ammo"}
                                                />
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Weapon Proficiency Bonus (Right side) - Hide for Armor */}
                            {isEquipableInventoryItem(item) && String(merged.type || '').toLowerCase() !== 'armor' && (
                                <div
                                    style={{
                                        marginLeft: 10,
                                        fontWeight: 'bold',
                                        color: 'var(--text-gold)',
                                        fontSize: '1.1em',
                                        whiteSpace: 'nowrap',
                                        cursor: 'help'
                                    }}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        const bonusInfo = getWeaponAttackBonus(merged);
                                        // Handle legacy or transition state where it might return number
                                        const bonusData = (typeof bonusInfo === 'object') ? bonusInfo : {
                                            total: bonusInfo,
                                            breakdown: { proficiency: 0, level: 0, attribute: 0, item: 0 },
                                            source: {}
                                        };

                                        setModalData({
                                            title: `Attack Bonus: ${merged.name}`,
                                            total: bonusData.total,
                                            base: 0,
                                            breakdown: bonusData.breakdown,
                                            source: bonusData.source
                                        });
                                        setModalMode('detail');
                                    }}
                                >
                                    {(() => {
                                        const bonusInfo = getWeaponAttackBonus(merged);
                                        const bonus = (typeof bonusInfo === 'object') ? bonusInfo.total : bonusInfo;
                                        return bonus >= 0 ? `+${bonus}` : bonus;
                                    })()}
                                </div>
                            )}
                        </div>
                        {row1 && <div className="item-row-meta item-row-meta-1">{row1}</div>}
                        {/* Merged Footer: Row2 (Description) + Ammo Counter */
                            /* Use minHeight to avoid empty space if both are missing? row1 handles meta 1. This handles meta 2 (desc) and ammo */
                        }
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: row2 ? 0 : 4 }}>
                            <div className="item-row-meta item-row-meta-2" style={{ flex: 1, marginRight: 10 }}>
                                {row2}
                            </div>

                            {/* Remaining Standard Ammo */}
                            {isEquipableInventoryItem(item) && (['crossbow', 'firearm'].includes((merged.group || '').toLowerCase()) || (merged.traits?.value || []).includes('repeating') || /bow|crossbow|firearm|pistol|musket|rifle|gun/i.test(merged.name)) && (() => {
                                const grp = (merged.group || '').toLowerCase();
                                const name = (merged.name || '').toLowerCase();
                                let ammoName = null;
                                let count = 0;

                                if (grp === 'firearm' || /firearm|pistol|musket|rifle|gun|pepperbox/i.test(name)) {
                                    // Count Rounds (universal)
                                    const matches = character.inventory.filter(i => i.name === 'Rounds (universal)' || i.name.toLowerCase().includes('round'));
                                    count = matches.reduce((acc, i) => acc + (i.qty || 0), 0);
                                    ammoName = "Rounds";
                                } else if (grp === 'crossbow' || name.includes('crossbow')) {
                                    const matches = character.inventory.filter(i => /bolts?/i.test(i.name));
                                    count = matches.reduce((acc, i) => acc + (i.qty || 0), 0);
                                    ammoName = "Bolts";
                                } else if (grp === 'bow' || name.includes('bow')) {
                                    const matches = character.inventory.filter(i => /arrows?/i.test(i.name));
                                    count = matches.reduce((acc, i) => acc + (i.qty || 0), 0);
                                    ammoName = "Arrows";
                                }

                                if (ammoName) {
                                    return (
                                        <div style={{ fontSize: '0.75em', color: '#888', fontStyle: 'italic', whiteSpace: 'nowrap', paddingTop: 2, marginRight: 10 }}>
                                            {count} {ammoName} left
                                        </div>
                                    );
                                }
                                return null;
                            })()}

                            {/* Qty for Equipables (e.g. Bombs): Bottom Right inside Row 2 */}
                            {isEquipableInventoryItem(item) && shouldStack(item) && (
                                <div style={{ fontSize: '0.75em', color: '#888', fontStyle: 'italic', whiteSpace: 'nowrap', paddingTop: 2, marginLeft: 'auto' }}>
                                    {qty} left
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Qty for Consumables/Others: Original Position (Outside Main) */}
                    {(!isEquipableInventoryItem(item)) && <div className="inventory-qty" style={{ marginLeft: 10, alignSelf: 'center' }}>x{qty}</div>}
                </div>
            );
        };

        // Check for ANY unclaimed, unlocked loot
        const hasLoot = db.lootBags?.some(b =>
            !b.isLocked && b.items.some(i => !i.claimedBy)
        );

        if (!hasLoot && itemSubTab === 'Loot') {
            // Auto-switch away if tab is active but became empty (optional, but requested behavior implies hiding)
            // We won't force switch to avoid jarring jumps, but we will hide the button.
            // Actually, if we hide the button, we should probably switch tab or show empty state?
            // User asked "make the Loot tab show conditionally", so we'll hide the button.
            // If user IS on the tab, we render "No loot available" or similar.
        }

        const tabButtons = (
            <div className="sub-tabs">
                {['Equipment', 'Consumables', 'Misc', hasLoot ? 'Loot' : null].filter(Boolean).map(t => (
                    <button
                        key={t}
                        className={`sub-tab-btn ${itemSubTab === t ? 'active' : ''}`}
                        onClick={() => setItemSubTab(t)}
                    >
                        {t}
                        {t === 'Loot' && hasLoot && <span style={{ color: '#d32f2f', marginLeft: 5 }}>!</span>}
                    </button>
                ))}
            </div>
        );

        const openShopButton = (
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                <button className="btn-add-condition" style={{ flex: 1, margin: 0 }} onClick={() => setActiveTab('shop')}>
                    + Open Shop
                </button>
                <button className="btn-add-condition" style={{ flex: 1, margin: 0 }} onClick={() => {
                    setModalData({ title: "Formula Book" });
                    setModalMode('formula_book');
                }}>
                    📖 Formulas
                </button>
            </div>
        );

        if (itemSubTab === 'Loot') {
            // Only show items that are NOT claimed
            const visibleBags = (db.lootBags || []).filter(b => !b.isLocked);
            const bagsWithLoot = visibleBags.filter(b => b.items.some(i => !i.claimedBy));

            return (
                <div>
                    {tabButtons}
                    {bagsWithLoot.length === 0 && <div style={{ color: '#666', fontStyle: 'italic', marginTop: 20 }}>No loot available.</div>}

                    {bagsWithLoot.map(bag => {
                        const unclaimedItems = bag.items.filter(i => !i.claimedBy);
                        if (unclaimedItems.length === 0) return null;

                        return (
                            <div key={bag.id} style={{ background: '#222', border: '1px solid #c5a059', borderRadius: 8, padding: 10, marginBottom: 15, marginTop: 10 }}>
                                <h3 style={{ marginTop: 0, color: '#ffecb3', borderBottom: '1px solid #444', paddingBottom: 5, fontSize: '1em' }}>💰 {bag.name}</h3>

                                {unclaimedItems.map((item, idx) => {
                                    // Adapt item for renderRow style logic
                                    const fromIndex = item?.name ? getShopIndexItemByName(item.name) : null;
                                    const merged = fromIndex ? { ...fromIndex, ...item } : item;
                                    const { row1, row2 } = getShopItemRowMeta(merged);

                                    // Reuse inspect logic
                                    const handleLootTap = () => {
                                        inspectInventoryItem(item); // View description
                                    };

                                    return (
                                        <div key={item.instanceId} className="item-row inventory-item-row" style={{ marginTop: 5 }} onClick={handleLootTap}>
                                            {merged?.img && (
                                                <img className="item-icon" src={`ressources/${merged.img}`} alt="" />
                                            )}
                                            <div className="item-row-main">
                                                <div className="item-name">{merged?.name || 'Unknown Item'}</div>
                                                {row1 && <div className="item-row-meta item-row-meta-1">{row1}</div>}
                                                {row2 && <div className="item-row-meta item-row-meta-2">{row2}</div>}
                                            </div>

                                            <button
                                                className="set-btn"
                                                style={{ margin: '0 0 0 10px', padding: '6px 14px', fontSize: '0.9em', width: 'auto', flexShrink: 0, height: 'auto' }}
                                                onClick={(e) => {
                                                    // Claim Item logic
                                                    updateCharacter(c => {
                                                        const stackable = shouldStack(item);
                                                        const existing = stackable ? c.inventory.find(i => i.name === item.name) : null;
                                                        if (existing) {
                                                            existing.qty = (existing.qty || 1) + 1;
                                                        } else {
                                                            c.inventory.push({ ...item, qty: 1, instanceId: undefined, addedAt: undefined, claimedBy: undefined });
                                                        }
                                                    });
                                                    setDb(prev => {
                                                        const bags = deepClone(prev.lootBags || []);
                                                        const b = bags.find(xb => xb.id === bag.id);
                                                        if (b) {
                                                            const it = b.items.find(x => x.instanceId === item.instanceId);
                                                            if (it) it.claimedBy = character.name;
                                                        }
                                                        return { ...prev, lootBags: bags };
                                                    });
                                                }}
                                            >
                                                Claim
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        );
                    })}
                </div>
            );
        }

        if (itemSubTab === 'Equipment') {
            const equipped = equipmentItems.filter(({ item }) => item?.equipped);
            const unequipped = equipmentItems.filter(({ item }) => !item?.equipped);

            return (
                <div>
                    {tabButtons}

                    <div className="action-subtype-header">Equipped</div>
                    {equipped.length === 0 && <div style={{ color: '#666', fontStyle: 'italic' }}>No equipped items.</div>}
                    {equipped.map(({ item, index }) => renderRow(item, index, { enableEquipTap: true }))}

                    <div className="action-subtype-header">Unequipped</div>
                    {unequipped.length === 0 && <div style={{ color: '#666', fontStyle: 'italic' }}>No unequipped items.</div>}
                    {unequipped.map(({ item, index }) => renderRow(item, index, { enableEquipTap: true }))}

                    {openShopButton}
                </div>
            );
        }

        const list = itemSubTab === 'Consumables' ? consumableItems : miscItems;
        const emptyText = itemSubTab === 'Consumables' ? 'No consumables.' : 'No misc items.';

        return (
            <div>
                {tabButtons}
                {list.length === 0 && <div style={{ color: '#666', fontStyle: 'italic' }}>{emptyText}</div>}
                {list.map(({ item, index }) => renderRow(item, index))}
                {openShopButton}
            </div>
        );
    };

    const toggleSpellSlot = (lvlKey, indexClicked, currentVal) => {
        let newVal = currentVal;
        if (indexClicked === currentVal) newVal = currentVal - 1; // Toggle off top
        else newVal = indexClicked; // Set to this level

        updateCharacter(c => {
            if (!c.magic) c.magic = { slots: {} };
            if (!c.magic.slots) c.magic.slots = {};
            c.magic.slots[lvlKey + "_curr"] = newVal;
        });
    };


    const renderImpulses = () => {
        const impulses = character.impulses || [];
        // Group by Level? Or simple list? Magic uses Rank (Level).
        // Let's group by Level.


        // Stats Calculation
        // Stats Calculation
        // const classDC = character.stats.class_dc || 10; // Removed to avoid dup

        const profRank = character.stats.impulse_proficiency || 0;
        const level = parseInt(character.level) || 1;
        const conMod = character.stats.attributes?.constitution ?? 0;

        const profBonus = profRank > 0 ? (level + profRank) : 0;
        const classDC = 10 + profBonus + conMod;
        const impulseAttack = profBonus + conMod; // d20 + ...

        console.log("Impulse Stats Debug:", {
            level,
            conMod,
            profRank,
            profBonus,
            classDC,
            impulseAttack,
            attributes: character.stats.attributes
        });

        return (
            <div className="magic-container" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {/* 1. Header Stats (Centered) */}
                <div style={{ display: 'flex', justifyContent: 'center', gap: 30, paddingBottom: 10, borderBottom: '1px solid #333' }}>
                    <div className="hex-box">
                        <div className="hex-content">
                            <div className="stat-val" style={{ fontSize: '1.4em', fontWeight: 'bold', color: '#c5a059', lineHeight: 1.1 }}>{classDC}</div>
                            <div className="stat-label" style={{ fontSize: '0.6em', textTransform: 'uppercase', color: '#888', marginTop: 2 }}>CLASS DC</div>
                        </div>
                    </div>
                    <div className="spell-attack-box" style={{
                        display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
                        padding: '8px 16px', border: '2px solid var(--text-gold)', borderRadius: '4px',
                        background: 'var(--bg-panel)', alignSelf: 'center'
                    }}>
                        <div className="stat-val" style={{ fontSize: '1.4em', fontWeight: 'bold', color: '#c5a059', lineHeight: 1.1 }}>+{impulseAttack}</div>
                        <div className="stat-label" style={{ fontSize: '0.6em', textTransform: 'uppercase', color: '#888', marginTop: 2 }}>ATTACK</div>
                    </div>
                </div>

                <div className="spells-list" style={{ width: '100%' }}>
                    <div className="spell-level-header" style={{ textAlign: 'left', borderBottom: '2px solid #5c4033', paddingBottom: 5, marginBottom: 10, color: 'var(--text-gold)', fontFamily: 'Cinzel, serif', fontSize: '1.2em' }}>
                        Impulses
                    </div>

                    {impulses.length === 0 && <div style={{ textAlign: 'center', color: '#666', marginTop: 20 }}>No Impulses learned.</div>}
                    {impulses.sort((a, b) => a.name.localeCompare(b.name)).map(imp => {
                        // Extract Meta Info (Time, Range, Target, Defense)
                        // Support both flat index data and nested system data
                        const rawTime = imp.time || imp.actions || imp.system?.actions?.value || "";
                        console.log("Impulse Render:", imp.name, { rawTime, actions: imp.actions, sysActions: imp.system?.actions });
                        let timeIcon = "";
                        if (rawTime) {
                            const t = String(rawTime).toLowerCase();
                            if (t === "1" || t.includes("one")) timeIcon = ACTION_ICONS["[one-action]"];
                            else if (t === "2" || t.includes("two")) timeIcon = ACTION_ICONS["[two-actions]"];
                            else if (t === "3" || t.includes("three")) timeIcon = ACTION_ICONS["[three-actions]"];
                            else if (t.includes("reaction")) timeIcon = ACTION_ICONS["[reaction]"];
                            else if (t.includes("free")) timeIcon = ACTION_ICONS["[free-action]"];
                            else timeIcon = formatText(rawTime);
                        }

                        // Range / Target / Defense
                        let range = imp.range || imp.system?.range?.value || "";
                        if (range) range = range.replace(/feet/gi, "ft");

                        const target = imp.target || imp.area || imp.system?.target?.value || imp.system?.area?.value || "";

                        let defense = imp.defense || imp.system?.defense?.save?.statistic || "";
                        // Fallback: If no defense but it's an attack, maybe show "AC"? 
                        // Actually Elemental Blast text says "against the AC". 
                        // If no specific save is defined, but it is an attack, we might assume AC or just leave it.
                        // The user JSON for Elemental Blast has actionType: "action" and traits: "attack".
                        if (!defense && (imp.traits?.includes('attack') || imp.system?.traits?.value?.includes('attack'))) {
                            defense = "AC";
                        }

                        if (defense) {
                            const defMap = { fortitude: "Fort", reflex: "Ref", will: "Will", ac: "AC" };
                            defense = defMap[defense.toLowerCase()] || (defense.charAt(0).toUpperCase() + defense.slice(1));
                        }

                        const metaParts = [];
                        if (range) metaParts.push(<span key="range">{range}</span>);
                        if (target) metaParts.push(<span key="target">{target}</span>);
                        if (defense) metaParts.push(<span key="def" style={{ color: '#aaa' }}>{defense}</span>);
                        if (timeIcon) metaParts.push(<span key="cast" dangerouslySetInnerHTML={{ __html: timeIcon }} style={{ display: 'flex', alignItems: 'center' }} />);


                        return (
                            <div key={imp.name} className="spell-row"
                                onClick={() => {
                                    setModalData({ title: imp.name, ...imp, _entityType: 'impulse' });
                                    setModalMode('item');
                                }}
                                {...pressEvents(imp, 'impulse')}
                            >
                                <div style={{ fontWeight: 'bold', color: '#ccc', display: 'flex', alignItems: 'center' }}>
                                    {imp.name}
                                </div>
                                <div className="spell-meta">
                                    {metaParts.reduce((acc, curr, idx) => {
                                        if (idx > 0) acc.push(<span key={`sep-${idx}`} style={{ color: '#444' }}>•</span>);
                                        acc.push(curr);
                                        return acc;
                                    }, [])}
                                </div>
                            </div>
                        );
                    })}

                    <div style={{ marginTop: 20, textAlign: 'center' }}>
                        <button className="add-item-btn" onClick={() => {
                            setCatalogMode('impulse');
                            setModalMode('catalog');
                        }}>+ Add Impulse</button>
                    </div>
                </div>
            </div>
        );
    };



    const renderMagic = () => (
        <MagicView
            character={character}
            updateCharacter={updateCharacter}
            setModalData={setModalData}
            setModalMode={setModalMode}
            setCatalogMode={setCatalogMode}
            onLongPress={handleLongPress}
        />
    );

    const renderFeats = () => (
        <FeatsView
            character={character}
            setModalData={setModalData}
            setModalMode={setModalMode}
            setCatalogMode={setCatalogMode}
            onLongPress={handleLongPress}
        />
    );

// --- MAIN RENDER ---

return (
    <div className="app-container">
        {/* HEADER */}
        <style>{`
                /* MAGIC TAB CSS */
                .magic-split { display: grid; grid-template-columns: 80px 1fr; gap: 15px; align-items: start; }
                .magic-stat-block { display: flex; flex-direction: column; align-items: center; gap: 10px; margin-bottom: 15px; }
                .hex-box {
                    width: 70px; height: 75px; background: #222;
                    clip-path: polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%);
                    display: flex; flex-direction: column; align-items: center; justify-content: center;
                    box-shadow: 0 0 10px var(--text-gold); position: relative;
                }
                .hex-content { text-align: center; z-index: 2; margin-top: -2px; }
                .spell-attack-box {
                    background: #2b2b2e; border: 2px solid #5c4033;
                    padding: 5px 0; border-radius: 4px; text-align: center; width: 70px;
                }
                .slot-box {
                    background: #2b2b2e; border: 1px solid #5c4033; border-radius: 4px; padding: 1px;
                    margin-bottom: 4px; text-align: center; width: 100%;
                }
                .slot-title { font-size: 0.6em; text-transform: uppercase; color: #888; margin-bottom: 2px; }
                .slot-checks { display: flex; flex-wrap: wrap; justify-content: center; gap: 3px; width: 52px; margin: 0 auto; padding: 2px 0; }
                .slot-check {
                    width: 14px; height: 14px; background: #111; border: 1px solid var(--text-gold);
                    transform: rotate(45deg); cursor: pointer; margin: 4px;
                }
                .slot-check.active { background: var(--text-gold); box-shadow: 0 0 5px var(--text-gold); }
                .spell-list-header {
                    background: transparent; padding: 5px 0; font-family: 'Cinzel', serif; font-size: 1.1em;
                    color: var(--text-gold); margin-top: 15px; border-bottom: 2px solid #5c4033; font-weight: bold;
                }
                .spell-row {
                    display: flex; justify-content: space-between; align-items: center; padding: 8px 10px;
                    border-bottom: 1px solid #333; cursor: pointer;
                }
                .spell-row:hover { background: rgba(255,255,255,0.03); }
                .spell-meta { display: flex; align-items: center; gap: 8px; font-size: 0.8em; color: #888; }
                .bloodline-drop { color: #d32f2f; margin-left: 5px; font-size: 0.9em; }

                /* MOBILE TABS POLISH */
                .tabs { 
                    display: flex; 
                    flex-wrap: nowrap; 
                    gap: 5px; 
                    overflow-x: auto; 
                    -webkit-overflow-scrolling: touch;
                    scrollbar-width: none; /* Firefox */
                }
                .tabs::-webkit-scrollbar { display: none; } /* Chrome/Safari */
                .tab-btn { 
                    flex: 1; 
                    white-space: nowrap; 
                    min-width: fit-content; 
                    padding: 8px 12px;
                }
                
                /* MODAL TABS POLISH */
                .modal-tabs {
                    display: flex;
                    flex-wrap: nowrap;
                    overflow-x: auto;
                    gap: 5px;
                    margin-bottom: 15px;
                    padding-bottom: 5px;
                    -webkit-overflow-scrolling: touch;
                }
                .modal-tabs .tab-btn {
                    flex: 1; /* Match main tabs behavior (squeeze) */
                    min-width: 0; /* Allow shrinking below content size if needed, or stick to fit-content */
                    padding: 8px 4px; /* Reduced padding */
                    font-size: 0.9em;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
            `}</style>
        <div className="header-bar">
            <div className="header-title">
                <h1 {...pressEvents(null, 'level')}>{character.name}</h1>
                <small>Level {character.level} | XP: {character.xp.current}</small>
            </div>
            <div className="header-controls">
                {isGM && <button className="btn-char-switch" onClick={() => {
                    setActiveCharIndex((prev) => (prev + 1) % characters.length);
                }}>👥</button>}
                <div className="gold-display" onClick={() => setModalMode('gold')}>
                    <span>💰</span> {parseFloat(character.gold).toFixed(2)} <span className="gold-unit">gp</span>
                </div>
                {isGM && <button className="btn-char-switch" onClick={() => window.location.search = '?admin=true'} title="GM Screen">GM</button>}
            </div>
        </div>


        {/* TABS */}
        <div className="tabs">
            {['stats', 'actions', 'feats', ...(character.isCaster || character.magic?.list?.length > 0 ? ['magic'] : []), ...(character.isKineticist ? ['impulses'] : []), 'items'].map(tab => {
                const hasLoot = tab === 'items' && (
                    character?.inventory?.some(i => i.isLoot) ||
                    db?.lootBags?.some(b => !b.isLocked && b.items.some(i => !i.claimedBy))
                );
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

        {/* VIEW CONTENT */}
        <div className="view-section">
            {activeTab === 'stats' && (
                <StatsView
                    character={character}
                    updateCharacter={updateCharacter}
                    onOpenModal={(mode, data) => {
                        setModalMode(mode);
                        if (data) setModalData(data);
                    }}
                    onLongPress={handleLongPress}
                />
            )}

            {activeTab === 'actions' && (
                <ActionsView
                    character={character}
                    onOpenModal={(mode, data) => {
                        setModalMode(mode);
                        setModalData(data);
                    }}
                    onLongPress={(item, type) => handleLongPress(item, type)}
                />
            )}

            {activeTab === 'magic' && renderMagic()}
            {activeTab === 'impulses' && (
                <ImpulsesView
                    character={character}
                    setModalData={setModalData}
                    setModalMode={setModalMode}
                    onLongPress={handleLongPress}
                />
            )}
            {activeTab === 'feats' && renderFeats()}
        </div>

        {/* MODALS / FULL PAGE VIEWS */}

        {
            activeTab === 'items' && (
                <div>
                    <InventoryView
                        character={character}
                        db={db}
                        onUpdateCharacter={updateCharacter}
                        onSetDb={setDb}
                        onOpenModal={(mode, data) => {
                            setModalMode(mode);
                            setModalData(data);
                        }}
                        onInspectItem={inspectInventoryItem}
                        onToggleEquip={toggleInventoryEquipped}
                        onFireWeapon={fireWeapon}
                        onLoadWeapon={loadWeapon}
                        onLongPress={handleLongPress}
                        onClaimLoot={(bag, item) => {
                            setDb(prev => {
                                const next = { ...prev };
                                const campaignId = activeCampaign?.id;
                                if (!campaignId || !next.campaigns?.[campaignId]) return prev;

                                const nextChars = [...next.campaigns[campaignId].characters];
                                const charIndex = activeCharIndex;
                                const char = { ...nextChars[charIndex], inventory: [...nextChars[charIndex].inventory] };

                                // 1. Add to Inventory
                                const stackable = shouldStack(item);
                                const existing = stackable ? char.inventory.find(i => i.name === item.name) : null;
                                if (existing) {
                                    existing.qty = (existing.qty || 1) + 1;
                                } else {
                                    // Ensure clean properties for new owned item
                                    const newItem = { ...item, qty: 1 };
                                    delete newItem.instanceId; // New ID will be generated or undefined
                                    delete newItem.addedAt;
                                    delete newItem.claimedBy;
                                    char.inventory.push(newItem);
                                }

                                nextChars[charIndex] = char;
                                next.campaigns[campaignId].characters = nextChars;

                                // 2. Mark in Loot Bag
                                if (next.lootBags) {
                                    const bags = deepClone(next.lootBags);
                                    const targetBag = bags.find(b => b.id === bag.id);
                                    if (targetBag) {
                                        const targetItem = targetBag.items.find(i => i.instanceId === item.instanceId);
                                        if (targetItem) targetItem.claimedBy = char.name; // Use current char name for claim signature
                                    }
                                    next.lootBags = bags;
                                }

                                return next;
                            });
                        }}
                        onOpenShop={() => setActiveTab('shop')}
                    />
                </div>
            )
        }

        {
            activeTab === 'shop' && (
                <ShopView
                    db={db}
                    onInspectItem={(item) => {
                        setModalData(item);
                        setModalMode('item');
                    }}
                    onBuyItem={(item) => setActionModal({ mode: 'BUY_RESTOCK', item })}
                    onBuyFormula={handleBuyFormula}
                    knownFormulas={character.formulaBook || []}
                />
            )
        }

        {/* Item Actions Modal */}
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
                setModalData({ item, type: 'weapon_prof' }); // Reuse modalData to pass item
                setModalMode('item_proficiencies');
            }}
        />

        {/* Catalog Overlay */}
        {
            catalogMode === 'feat' && (
                <ItemCatalog
                    title="Add Feat"
                    items={FEAT_INDEX_ITEMS}
                    filterOptions={FEAT_INDEX_FILTER_OPTIONS}
                    onSelect={(item) => addToCharacter(item, 'feat')}
                    onClose={() => setCatalogMode(null)}
                />
            )
        }

        {
            catalogMode === 'impulse' && (
                <ItemCatalog
                    title="Add Impulse"
                    items={IMPULSE_INDEX_ITEMS}
                    filterOptions={IMPULSE_INDEX_FILTER_OPTIONS}
                    onClose={() => setCatalogMode(null)}
                    onSelect={(impulseData) => {
                        updateCharacter(c => {
                            if (!c.impulses) c.impulses = [];
                            c.impulses.push(impulseData);
                        });
                        setCatalogMode(null);
                    }}
                />
            )
        }

        {
            catalogMode === 'spell' && (
                <ItemCatalog
                    title="Add Spell"
                    items={SPELL_INDEX_ITEMS}
                    filterOptions={SPELL_INDEX_FILTER_OPTIONS}
                    onSelect={(item) => addToCharacter(item, 'spell')}
                    onClose={() => setCatalogMode(null)}
                />
            )
        }

        {/* General Modals */}
        <ModalManager
            modalMode={modalMode}
            setModalMode={setModalMode}
            modalData={modalData}
            setModalData={setModalData}
            character={character}
            updateCharacter={updateCharacter}
            onClose={() => setModalMode(null)}
            onBack={handleBack}
            hasHistory={modalHistory.length > 0}
            onContentLinkClick={handleContentLinkClick}

            // Features
            dailyPrepQueue={dailyPrepQueue}
            setDailyPrepQueue={setDailyPrepQueue}
            toggleInventoryEquipped={toggleInventoryEquipped}
            isLoadingShopDetail={shopItemDetailLoading}
            shopDetailError={shopItemDetailError}

            // Callbacks
            toggleBloodmagic={toggleBloodmagic}
            removeFromCharacter={removeFromCharacter}
            saveNewAction={saveNewAction}
        />
    </div>
);
}
