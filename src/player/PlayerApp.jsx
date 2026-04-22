/* d:\Repositories\PF2-Playersheet-1\src\player\PlayerApp.jsx */
import React, { useEffect, useRef, useState, useMemo } from 'react';
import { useSwipe } from '../shared/hooks/useSwipe';
import { useCampaign } from '../shared/context/CampaignContext';
import { calculateStat } from '../utils/rules';
import { parseFoundry, ACTION_ICONS } from '../shared/utils/foundryParser';
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
import SpellScrollSelectorModal from './modals/SpellScrollSelectorModal';
import ItemActionsModal from './ItemActionsModal';
import QuickSheetModal from './QuickSheetModal';
import { StatBreakdown } from './components/StatBreakdown';
import { StatsView } from './views/StatsView';
import { ActionsView } from './views/ActionsView';
import { InventoryView } from './views/InventoryView';
import { MagicView } from './views/MagicView';
import { FeatsView } from './views/FeatsView';
import { ImpulsesView } from './views/ImpulsesView';
import PlayerQuestsView from './views/PlayerQuestsView';
import LoreView from './views/LoreView';
import CompanionTab from './views/CompanionTab';
import MapsView from './views/MapsView';
import ProgressView from './views/ProgressView';
import CampScreen from '../camping/CampScreen';
import PactView from '../pacts/PactView';
import { isEquipableInventoryItem, getWeaponCapacity } from '../shared/utils/combatUtils';
import { ModalManager } from './ModalManager';
// Top of file
import NotificationOverlay from './components/NotificationOverlay';
import XpOverlay from './components/XpOverlay';





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

    const handleClearNotification = (id) => {
        setDb(prev => {
            if (!prev.notificationQueue) return prev;
            return {
                ...prev,
                notificationQueue: prev.notificationQueue.filter(n => n.id !== id)
            };
        });
    };
    // Let's replace the top imports first.


    const [activeTab, setActiveTab] = useState('stats');
    // const [actionSubTab, setActionSubTab] = useState('Combat'); // Removed
    // const [itemSubTab, setItemSubTab] = useState('Equipment'); // Removed

    const [dailyPrepQueue, setDailyPrepQueue] = useState([]);
    const [modalMode, setModalMode] = useState(null);
    const [modalData, setModalData] = useState(null);
    const [modalHistory, setModalHistory] = useState([]);
    const [actionModal, setActionModal] = useState({ mode: null, item: null });
    const [condTab, setCondTab] = useState('active');
    const [appMode, setAppMode] = useState('character'); // 'character' | 'story'
    const tapRef = useRef({ id: null, time: 0 });
    const tapTimeout = useRef(null);

    useEffect(() => {
        if (myCharacter && activeCampaign?.characters) {
            const idx = activeCampaign.characters.findIndex(c => c.id === myCharacter.id);
            if (idx !== -1) setActiveCharIndex(idx);
        }
    }, [myCharacter, activeCampaign]);

    // Migration: Intimidate -> Intimidation, Perform -> Performance
    useEffect(() => {
        if (!activeCampaign || !activeCampaign.characters || !myCharacter?.id) return;

        // Check availability first to avoid unnecessary state updates
        const charToCheck = activeCampaign.characters.find(c => c.id === myCharacter.id);
        if (!charToCheck || !charToCheck.skills) return;

        const needsIntimidate = charToCheck.skills.hasOwnProperty('Intimidate') || charToCheck.skills.hasOwnProperty('intimidate');
        const needsPerform = charToCheck.skills.hasOwnProperty('Perform') || charToCheck.skills.hasOwnProperty('perform');

        if (needsIntimidate || needsPerform) {
            console.log("Running Skill Migrations for", charToCheck.name);

            updateActiveCampaign(camp => {
                const chars = [...(camp.characters || [])];
                const idx = chars.findIndex(c => c.id === myCharacter.id);
                if (idx === -1) return camp;

                const c = deepClone(chars[idx]);
                let changed = false;

                // Intimidate
                if (c.skills.hasOwnProperty('Intimidate')) {
                    const val = c.skills.Intimidate;
                    delete c.skills.Intimidate;
                    c.skills.Intimidation = val;
                    changed = true;
                }
                if (c.skills.hasOwnProperty('intimidate')) {
                    const val = c.skills.intimidate;
                    delete c.skills.intimidate;
                    c.skills.Intimidation = val;
                    changed = true;
                }

                // Performance
                if (c.skills.hasOwnProperty('Perform')) {
                    const val = c.skills.Perform;
                    delete c.skills.Perform;
                    c.skills.Performance = val;
                    changed = true;
                }
                if (c.skills.hasOwnProperty('perform')) {
                    const val = c.skills.perform;
                    delete c.skills.perform;
                    c.skills.Performance = val;
                    changed = true;
                }

                if (changed) {
                    chars[idx] = c;
                    return { ...camp, characters: chars };
                }
                return camp;
            });
        }
    }, [activeCampaign, myCharacter, updateActiveCampaign]);



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


    const handleConsumeItem = (item) => {
        const name = item.name;
        updateCharacter(c => {
            let invIdx = -1;
            // Robust find
            if (item._index !== undefined) {
                invIdx = item._index;
                // verify
                if (!c.inventory[invIdx] || c.inventory[invIdx].name !== name) invIdx = -1;
            }

            if (invIdx === -1) {
                invIdx = c.inventory.findIndex(i => i.name === name);
            }

            if (invIdx > -1) {
                const invItem = c.inventory[invIdx];
                if (invItem && invItem.qty > 0) {
                    invItem.qty--;
                    if (invItem.qty === 0) c.inventory.splice(invIdx, 1);

                    // --- Mutagen / Elixir Logic ---
                    const lowerName = name.toLowerCase();
                    const level = parseInt(item.level) || 1;

                    if (lowerName.includes("mutagen")) {
                        if (!c.conditions) c.conditions = [];

                        // Add Condition
                        c.conditions.push({ name: name, level: level, type: 'item_effect' });

                        // Side Effects (Immediate)
                        // Juggernaut: Temp HP
                        if (lowerName.includes("juggernaut")) {
                            let thp = 5;
                            if (level >= 17) thp = 40;
                            else if (level >= 11) thp = 30;
                            else if (level >= 3) thp = 10;
                            c.stats.hp.temp = Math.max(c.stats.hp.temp || 0, thp);
                        }
                        // Quicksilver: Damage (2 * Level)
                        if (lowerName.includes("quicksilver")) {
                            const charLevel = parseInt(c.level) || 1;
                            const dmg = charLevel * 2;
                            c.stats.hp.current = Math.max(0, (c.stats.hp.current || 0) - dmg);
                        }
                    }
                }
            }
        });
        // We can add a toast here later
        // console.log(`Consumed ${name}`);
    };

    const handleItemClick = (item) => {
        const now = Date.now();
        const isSame = tapRef.current.id === item.name;
        const isDouble = isSame && (now - tapRef.current.time < 300);

        if (tapTimeout.current) clearTimeout(tapTimeout.current);

        if (isDouble && (item.type === 'Consumable' || item.consumable)) {
            handleConsumeItem(item);
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
            onTouchStart: start, onTouchEnd: cancel, onTouchMove: cancel
        };
    };

    const isBasicAmmo = (item) =>
        /^(arrows?|bolts?|rounds?\s*\()/i.test(item?.name || '') ||
        ((item?.type || '').toLowerCase() === 'ammunition' && /\b(arrow|bolt|round)\b/i.test(item?.name || ''));

    const performDailyPrep = () => {
        const feats = character.feats || [];
        const hasQuickAlchemy = feats.includes("Quick Alchemy");
        const slotKeys = ['f', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];

        updateCharacter(c => {
            // 1. Refill all spell slots (_curr = available remaining, so reset to max)
            if (c.magic?.slots) {
                slotKeys.forEach(k => {
                    const max = c.magic.slots[k + "_max"] || 0;
                    if (max > 0) {
                        c.magic.slots[k + "_curr"] = max;
                    }
                });
            }

            // 2. Refill equipped staff charges
            // Derive highest spell slot level for staff charge calculation
            let highestSlotLevel = 0;
            if (c.magic?.slots) {
                for (let i = 10; i >= 1; i--) {
                    if ((c.magic.slots[`${i}_max`] || 0) > 0) { highestSlotLevel = i; break; }
                }
            }
            (c.inventory || []).forEach(item => {
                if (!item.equipped) return;
                const rawTraits = item.system?.traits?.value || item.traits || [];
                const traitsList = (Array.isArray(rawTraits) ? rawTraits : []).map(t => String(t).toLowerCase());
                const isStaff = traitsList.includes('staff')
                    || (item.name || '').toLowerCase().includes('staff')
                    || (item.system?.staff?.max > 0);
                if (!isStaff) return;
                const maxCharges = item.system?.staff?.max || highestSlotLevel;
                if (!maxCharges) return;
                if (!item.system) item.system = {};
                if (!item.system.staff) item.system.staff = {};
                item.system.staff.charges = maxCharges;
                item.system.staff.max = maxCharges;
            });

            // 3. Remove all temporary (prepared) items
            c.inventory = (c.inventory || []).filter(i => !i.prepared);

            // 4. Add 4 Versatile Vials if character has Quick Alchemy
            if (hasQuickAlchemy) {
                const vialBase = getShopIndexItemByName('Versatile Vial') || { name: 'Versatile Vial' };
                c.inventory.push({ ...vialBase, qty: 4, prepared: true, addedAt: Date.now() });
            }
        });

        // 5. Clear daily prep queue
        setDailyPrepQueue([]);
        setModalMode(null);
    };

    const executeBuy = (item, qty) => {
        updateCharacter(c => {
            const cost = (item.price || 0) * qty;
            if (c.gold >= cost) {
                c.gold -= cost;
                // Basic ammo (arrows/bolts/rounds) yields 10 units per purchase
                const receivedQty = isBasicAmmo(item) ? qty * 10 : qty;
                const stackable = shouldStack(item);
                const existing = stackable ? c.inventory.find(i => i.name === item.name) : null;
                if (existing) existing.qty = (existing.qty || 1) + receivedQty;
                else c.inventory.push({ ...item, qty: receivedQty });
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

            // Determine Required Ammo Type
            const tags = (w.tags || []).map(t => t.toLowerCase());
            const traits = (w.traits?.value || []).map(t => t.toLowerCase());
            const allTags = [...tags, ...traits];

            let requiredKeyword = null;
            if (allTags.includes('crossbow') || w.name.toLowerCase().includes('crossbow')) {
                requiredKeyword = 'bolt';
            } else if (allTags.includes('bow') || w.name.toLowerCase().includes('bow') || allTags.includes('shortbow') || allTags.includes('longbow')) {
                requiredKeyword = 'arrow';
            } else if (allTags.includes('firearm') || w.name.toLowerCase().includes('gun') || w.name.toLowerCase().includes('pistol') || w.name.toLowerCase().includes('musket')) {
                requiredKeyword = 'round'; // Covers "Round (universal)" or "Paper Cartridge" etc if they contain 'round'
                // Actually firearm ammo is tricky, but "Rounds (Universal)" is standard.
                // Let's stick to 'round' for now, but also allow specific firearm matches if needed.
            }

            // If explicit ammo provided, just use it (assuming user knows best, or add check?)
            // Let's add a check if explicit ammo is provided but wrong type? No, trust manual selection for now.
            let ammoToLoad = ammoItem;

            if (!ammoToLoad) {
                if (requiredKeyword) {
                    // Search for specific ammo
                    ammoToLoad = c.inventory.find(i =>
                        i.qty > 0 &&
                        (i.category === 'ammo' || i.type === 'ammunition' || (i.traits?.value || []).includes('ammunition') || i.name.toLowerCase().includes('ammo')) &&
                        i.name.toLowerCase().includes(requiredKeyword)
                    );
                }

                // If not found or no specific requirement, try generic fallback (original logic)
                if (!ammoToLoad && !requiredKeyword) {
                    const universal = c.inventory.find(i => i.name.toLowerCase() === "rounds (universal)" && i.qty > 0);
                    if (universal) {
                        ammoToLoad = universal;
                    } else {
                        const compatible = c.inventory.find(i =>
                            i.name.toLowerCase().includes('round') &&
                            i.qty > 0 &&
                            (i.category === 'ammo' || i.type === 'ammunition' || (i.traits?.value || []).includes('ammunition'))
                        );
                        if (compatible) ammoToLoad = compatible;
                    }
                }
            }

            if (!ammoToLoad) {
                alert(requiredKeyword ? `No ammunition found! Required: ${requiredKeyword}s` : "No ammunition found!");
                return;
            }

            // Deduct
            const ammoIdx = c.inventory.findIndex(i => (ammoToLoad.instanceId ? i.instanceId === ammoToLoad.instanceId : i.name === ammoToLoad.name) && i.qty > 0);
            if (ammoIdx > -1) {
                const invAmmo = c.inventory[ammoIdx];
                invAmmo.qty--;
                if (invAmmo.qty <= 0) c.inventory.splice(ammoIdx, 1);

                // Load
                // Check if it's standard based on requirement
                const isStandard = requiredKeyword
                    ? ammoToLoad.name.toLowerCase().includes(requiredKeyword)
                    : /^(rounds \(universal\)|rounds?|bolts?|arrows?)/i.test(ammoToLoad.name);

                w.loaded[slotIndex] = {
                    name: ammoToLoad.name,
                    id: ammoToLoad.instanceId || "std",
                    isSpecial: !isStandard
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
        let fromIndex = item?.name ? getShopIndexItemByName(item.name) : null;
        if (!fromIndex && item.system?.originalName) {
            fromIndex = getShopIndexItemByName(item.system.originalName);
        }
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

    // --- SWIPE LOGIC ---
    const mainTabs = useMemo(() => {
        if (appMode === 'story') {
            return ['quests', 'lore', 'maps', 'progress', 'camp'];
        }
        // Character Mode
        const tabs = ['stats', 'actions', 'feats'];
        if (character.isCaster || character.magic?.list?.length > 0) tabs.push('magic');
        if (character.isKineticist) tabs.push('impulses');
        tabs.push('items');
        if (character.has_companion) tabs.push('companion');
        if (character.pact?.pactId && db?.pacts?.[character.pact.pactId]) tabs.push('pact');
        return tabs;
    }, [appMode, character.isCaster, character.magic, character.isKineticist, character.has_companion, character.pact?.pactId, db?.pacts]);

    const { handlers: swipeHandlers, ref: swipeRef } = useSwipe({
        // Swipe Left -> Next Tab
        onSwipeLeft: () => {
            if (modalMode) return; // Disable swipe if modal open
            const idx = mainTabs.indexOf(activeTab);
            if (idx > -1 && idx < mainTabs.length - 1) {
                setActiveTab(mainTabs[idx + 1]);
            } else if (idx === -1 && mainTabs.length > 0) {
                // If active tab not in current mode list (e.g. switched mode), default to first? 
                // Or better, we should reset activeTab when appMode changes.
                // We'll handle that in a useEffect.
            }
        },
        // Swipe Right -> Prev Tab
        onSwipeRight: () => {
            if (modalMode) return;
            const idx = mainTabs.indexOf(activeTab);
            if (idx > 0) {
                setActiveTab(mainTabs[idx - 1]);
            }
        },
        threshold: 60, // Slightly higher threshold to avoid scroll interference
        disabled: Boolean(modalMode), // Prevent swipe/scroll shield from interfering with modal scrolling
        excludeSelectors: ['.tabs', '.modal-tabs', '.scroll-x', '.no-swipe'] // Allow native horizontal scrolling
    });

    // --- MAIN RENDER ---

    return (
        <div className="app-container" ref={swipeRef} {...swipeHandlers} onClick={handleContentLinkClick}>
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
                .header-title { min-width: 0; flex: 1; overflow: hidden; white-space: nowrap; }
                .header-title h1 { overflow: hidden; text-overflow: ellipsis; }

            `}</style>
            <div className="header-bar">
                <div className="header-title">
                    <h1 {...pressEvents(null, 'level')}>{character.name}</h1>
                    <small>Level {character.level} | XP: {character.xp.current}</small>
                </div>
                <div className="header-controls" style={{ flexShrink: 0, gap: 5, marginRight: -5 }}>
                    {/* MODE TOGGLE */}
                    <button
                        className="btn-char-switch"
                        onClick={() => {
                            const newMode = appMode === 'character' ? 'story' : 'character';
                            setAppMode(newMode);
                            // Default tabs
                            if (newMode === 'story') setActiveTab('quests');
                            else setActiveTab('stats');
                        }}
                        title={appMode === 'character' ? 'Switch to Story' : 'Switch to Character'}
                        style={{ border: '1px solid var(--border-color)', color: 'var(--text-light)' }}
                    >
                        {appMode === 'character' ? '📖' : '👤'}
                    </button>

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
            <div className="tabs no-swipe">
                {mainTabs.map(tab => {
                    const hasLoot = tab === 'items' && (
                        character?.inventory?.some(i => i.isLoot) ||
                        activeCampaign?.lootBags?.some(b => !b.isLocked && b.items.some(i => !i.claimedBy))
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

                {activeTab === 'quests' && (
                    <PlayerQuestsView quests={db?.quests || []} />
                )}

                {activeTab === 'lore' && (
                    <LoreView lore={db?.lore || { articles: [] }} bestiary={db?.bestiary} />
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

                {activeTab === 'magic' && (
                    <MagicView
                        character={character}
                        updateCharacter={updateCharacter}
                        setModalData={setModalData}
                        setModalMode={setModalMode}
                        setCatalogMode={setCatalogMode}
                        onLongPress={handleLongPress}
                    />
                )}
                {activeTab === 'impulses' && (
                    <ImpulsesView
                        character={character}
                        setModalData={setModalData}
                        setModalMode={setModalMode}
                        onLongPress={handleLongPress}
                    />
                )}
                {activeTab === 'feats' && (
                    <FeatsView
                        character={character}
                        setModalData={setModalData}
                        setModalMode={setModalMode}
                        setCatalogMode={setCatalogMode}
                        onLongPress={handleLongPress}
                    />
                )}

                {activeTab === 'maps' && <MapsView />}
                {activeTab === 'progress' && <ProgressView />}
                {activeTab === 'camp' && <CampScreen />}
                {activeTab === 'companion' && <CompanionTab character={character} updateCharacter={updateCharacter} />}
                {activeTab === 'pact' && <PactView character={character} db={db} />}
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
                            onConsumeItem={handleConsumeItem}
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
                                    const qtyToClaim = item.qty || 1;
                                    const stackable = shouldStack(item);
                                    const existing = stackable ? char.inventory.find(i => i.name === item.name) : null;
                                    if (existing) {
                                        existing.qty = (existing.qty || 1) + qtyToClaim;
                                    } else {
                                        // Ensure clean properties for new owned item
                                        const newItem = { ...item, qty: qtyToClaim };
                                        delete newItem.instanceId; // New ID will be generated or undefined
                                        delete newItem.addedAt;
                                        delete newItem.claimedBy;
                                        char.inventory.push(newItem);
                                    }

                                    nextChars[charIndex] = char;
                                    next.campaigns[campaignId].characters = nextChars;

                                    // 2. Mark in Loot Bag (campaign-level)
                                    const campData = next.campaigns[campaignId];
                                    if (campData?.lootBags) {
                                        const bags = deepClone(campData.lootBags);
                                        const targetBag = bags.find(b => b.id === bag.id);
                                        if (targetBag) {
                                            const targetItem = targetBag.items.find(i => i.instanceId === item.instanceId);
                                            if (targetItem) targetItem.claimedBy = char.name;
                                        }
                                        campData.lootBags = bags;
                                    }

                                    return next;
                                });
                            }}
                            onClaimGold={(bagId, amount) => {
                                setDb(prev => {
                                    const next = { ...prev };
                                    const campaignId = activeCampaign?.id;
                                    if (!campaignId || !next.campaigns?.[campaignId]) return prev;

                                    // Update Bag (campaign-level)
                                    const campData = next.campaigns[campaignId];
                                    const bags = deepClone(campData?.lootBags || []);
                                    const bag = bags.find(b => b.id === bagId);
                                    if (!bag || (bag.goldValue || 0) < amount) return prev;

                                    bag.goldValue = Math.max(0, (bag.goldValue || 0) - amount);
                                    campData.lootBags = bags;

                                    // Update Character
                                    const nextChars = [...next.campaigns[campaignId].characters];
                                    const charIndex = activeCharIndex;
                                    const char = { ...nextChars[charIndex] };

                                    char.gold = (parseFloat(char.gold || 0) + parseFloat(amount)).toFixed(2);

                                    nextChars[charIndex] = char;
                                    next.campaigns[campaignId].characters = nextChars;

                                    return next;
                                });
                            }}
                            onSplitGold={(bagId) => {
                                setDb(prev => {
                                    const next = { ...prev };
                                    const campaignId = activeCampaign?.id;
                                    if (!campaignId || !next.campaigns?.[campaignId]) return prev;

                                    // Update Bag (campaign-level)
                                    const campData2 = next.campaigns[campaignId];
                                    const bags = deepClone(campData2?.lootBags || []);
                                    const bag = bags.find(b => b.id === bagId);
                                    if (!bag || (bag.goldValue || 0) <= 0) return prev;

                                    const totalGold = bag.goldValue;
                                    bag.goldValue = 0;
                                    campData2.lootBags = bags;

                                    // Distribute to characters
                                    const nextChars = [...next.campaigns[campaignId].characters];
                                    const count = nextChars.length;
                                    if (count === 0) return prev;

                                    const share = Math.floor((totalGold / count) * 100) / 100; // Round down to 2 decimals
                                    // Remainder lost or could be given to first player. Let's discard for simplicity or add to first?
                                    // Let's just give share.

                                    nextChars.forEach((c, i) => {
                                        const newC = { ...c };
                                        newC.gold = (parseFloat(newC.gold || 0) + share).toFixed(2);
                                        nextChars[i] = newC;
                                    });

                                    next.campaigns[campaignId].characters = nextChars;
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
                        onBuyItem={(item) => {
                            const scrollMatch = item.name.match(/(?:Scroll of Rank (\d+)|Scroll of (\d+)(?:st|nd|rd|th)?-rank Spell)/i);
                            const wandMatch = item.name.match(/(?:Wand of Rank (\d+)|Magic Wand \((\d+)(?:st|nd|rd|th)?-Rank Spell\))/i);

                            if (scrollMatch) {
                                setActionModal({ mode: 'SELECT_SPELL', rank: parseInt(scrollMatch[1] || scrollMatch[2]), type: 'scroll', baseItem: item });
                            } else if (wandMatch) {
                                setActionModal({ mode: 'SELECT_SPELL', rank: parseInt(wandMatch[1] || wandMatch[2]), type: 'wand', baseItem: item });
                            } else {
                                setActionModal({ mode: 'BUY_RESTOCK', item });
                            }
                        }}
                        onBuyFormula={handleBuyFormula}
                        knownFormulas={character.formulaBook || []}
                    />
                )
            }

            {/* Item Actions Modal */}
            {actionModal.mode !== 'SELECT_SPELL' && (
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
            )}

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

            {/* Spell Scroll/Wand Selector */}
            {
                actionModal.mode === 'SELECT_SPELL' && (
                    <SpellScrollSelectorModal
                        rank={actionModal.rank}
                        type={actionModal.type}
                        onCancel={() => setActionModal({ mode: null, item: null })}
                        onSelect={(spell) => {
                            const { baseItem, type, rank } = actionModal;
                            const newItem = { ...baseItem };
                            // Clone system to avoid mutation
                            newItem.system = baseItem.system ? JSON.parse(JSON.stringify(baseItem.system)) : {};

                            // Preserve linkage to Shop Index for properties lookup
                            newItem.system.originalName = baseItem.name;

                            // Set Name
                            newItem.name = `${type === 'scroll' ? 'Scroll' : 'Wand'} of ${spell.name} (Rank ${rank})`;

                            // Embed Spell Index Entry
                            newItem.system.spell = spell;

                            // Initialize Wand Charges
                            if (type === 'wand') {
                                newItem.system.wand = { charges: 1, max: 1 };
                            }

                            // Continue to Buy Flow
                            setActionModal({ mode: 'BUY_RESTOCK', item: newItem });
                        }}
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
                onDailyPrep={performDailyPrep}
            />


            {/* Notification Overlay */}
            <NotificationOverlay queue={db.notificationQueue || []} onClear={handleClearNotification} />

            {/* XP Overlay */}
            <XpOverlay xpNotification={activeCampaign?.xpNotification} />
        </div>
    );
}
