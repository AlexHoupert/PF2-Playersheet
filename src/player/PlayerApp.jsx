/* d:\Repositories\PF2-Playersheet-1\src\player\PlayerApp.jsx */
import React, { useEffect, useRef, useState } from 'react';
import { calculateStat, formatText, ACTION_ICONS } from '../utils/rules';
import dbData from '../data/new_db.json';
import ShopView from './ShopView';
import { usePersistedDb } from '../shared/db/usePersistedDb';
import { NEG_CONDS, POS_CONDS, VIS_CONDS, getConditionIcon } from '../shared/constants/conditions';
import { conditionsCatalog, getConditionCatalogEntry, getConditionImgSrc, isConditionValued } from '../shared/constants/conditionsCatalog';
import { fetchShopItemDetailBySourceFile, getShopIndexItemByName } from '../shared/catalog/shopIndex';
import { fetchSpellDetailBySourceFile, getSpellIndexItemByName, SPELL_INDEX_ITEMS, SPELL_INDEX_FILTER_OPTIONS } from '../shared/catalog/spellIndex';
import { fetchFeatDetailBySourceFile, getFeatIndexItemByName, FEAT_INDEX_ITEMS, FEAT_INDEX_FILTER_OPTIONS } from '../shared/catalog/featIndex';
import { fetchActionDetailBySourceFile, getAllActionIndexItems, getActionIndexItemByName } from '../shared/catalog/actionIndex';
import { getShopItemRowMeta } from '../shared/catalog/shopRowMeta';
import { deepClone } from '../shared/utils/deepClone';
import { shouldStack } from '../shared/utils/inventoryUtils';
import bloodMagicEffects from '../../ressources/classfeatures/bloodmagic-effects.json';
import ItemCatalog from './ItemCatalog';
import ItemActionsModal from './ItemActionsModal';



const ARMOR_RANKS = [
    { value: 0, label: 'Untrained (+0)' },
    { value: 2, label: 'Trained (+2)' },
    { value: 4, label: 'Expert (+4)' },
    { value: 6, label: 'Master (+6)' },
    { value: 8, label: 'Legendary (+8)' }
];

export default function PlayerApp() {
    const [db, setDb] = usePersistedDb(dbData);
    // const [db, setDb] = useState(dbData);

    const [activeCharIndex, setActiveCharIndex] = useState(0);
    const [activeTab, setActiveTab] = useState('stats');
    const [actionSubTab, setActionSubTab] = useState('Combat');
    const [itemSubTab, setItemSubTab] = useState('Equipment');

    // New Action Form State
    const [newAction, setNewAction] = useState({ name: '', type: 'Combat', subtype: 'Basic', skill: '', feat: '', description: '' });

    // Daily Crafting State
    const [dailyPrepQueue, setDailyPrepQueue] = useState([]);

    // Modal State
    const [modalMode, setModalMode] = useState(null); // null, 'hp', 'gold', 'ac', 'condition', 'detail', 'item'
    const [modalData, setModalData] = useState(null);
    const [modalHistory, setModalHistory] = useState([]);
    // Modals
    const [actionModal, setActionModal] = useState({ mode: null, item: null });

    // Double Tap Logic
    const tapRef = useRef({ id: null, time: 0 });
    const tapTimeout = useRef(null);

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
                (!item.instanceId && i.name === item.name && !!i.equipped === !!item.equipped)
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
            const target = c.inventory.find(i => i.name === item.name && i.qty === item.qty && !!i.equipped === !!item.equipped);
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

    const getWeaponCapacity = (item) => {
        const traits = (item?.traits?.value || []);
        if (traits.includes('repeating')) return 5;
        if (traits.includes('double-barrel')) return 2;
        if (traits.includes('triple-barrel')) return 3;

        // Capacity-x check
        const capTrait = traits.find(t => t.startsWith('capacity-'));
        if (capTrait) {
            const val = parseInt(capTrait.split('-')[1]);
            return isNaN(val) ? 1 : val;
        }

        return 1;
    };

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
        const char = db.characters[activeCharIndex];

        let weaponIndex = weaponOrIndex;
        if (typeof weaponOrIndex === 'object') {
            weaponIndex = char.inventory.findIndex(i =>
                (weaponOrIndex.instanceId && i.instanceId === weaponOrIndex.instanceId) ||
                (i.name === weaponOrIndex.name && !!i.equipped === !!weaponOrIndex.equipped)
            );
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

    const getWeaponAttackBonus = (item) => {
        if (!character || !item) return 0;

        const grp = (item.group || '').toLowerCase();
        const cat = (item.category || '').toLowerCase(); // Simple, Martial, Advanced
        const traits = (item.traits?.value || []);

        // 1. Proficiency Rank (0=Untrained, 2=Trained, 4=Expert, 6=Master, 8=Legendary)
        // Check Group Score (e.g. "Firearms") vs Category Score (e.g. "Martial")
        let profScore = 0;

        // Map raw strings to DB keys if needed, assuming direct mapping for now based on new_db.json
        // DB keys: "Unarmored", "Light", "Medium", "Heavy", "Firearms", "Crossbows", "Bombs"
        // Also "Simple", "Martial", "Advanced", "Unarmed" might exist in full schema or inferred.
        // Let's check DB structure again... new_db.json had "Firearms": 4, "Crossbows": 4.
        const profs = character.proficiencies || {};

        const getScore = (key) => profs[key] || profs[key.charAt(0).toUpperCase() + key.slice(1)] || 0;

        // Specific Group Priority
        let groupScore = 0;
        if (grp === 'firearm') groupScore = getScore("Firearms");
        else if (grp === 'crossbow') groupScore = getScore("Crossbows");
        else if (grp === 'bomb') groupScore = getScore("Bombs");
        else if (grp === 'sword') groupScore = getScore("Swords"); // Speculative
        else if (grp === 'bow') groupScore = getScore("Bows"); // Speculative

        // Category Priority
        let catScore = 0;
        if (cat === 'simple') catScore = getScore("Simple");
        else if (cat === 'martial') catScore = getScore("Martial");
        else if (cat === 'advanced') catScore = getScore("Advanced");
        else if (cat === 'unarmed') catScore = getScore("Unarmed");

        profScore = Math.max(groupScore, catScore);

        // 2. Attribute
        // Ranged (Firearm, Bow, Crossbow, Bomb) -> DEX
        // Melee + Finesse -> Max(STR, DEX)
        // Melee -> STR
        // Thrown -> DEX (Attack), STR (Damage). Attack is DEX.

        let attrMod = 0;
        const str = character.stats.attributes.strength || 0;
        const dex = character.stats.attributes.dexterity || 0;

        const isRanged = /ranged|firearm|crossbow|bow|bomb/.test(grp) || traits.includes('thrown');
        const isFinesse = traits.includes('finesse');

        if (isRanged) {
            attrMod = dex;
        } else if (isFinesse) {
            attrMod = Math.max(str, dex);
        } else {
            attrMod = str;
        }

        // 3. Level (If Trained+)
        const level = (profScore > 0) ? character.level : 0;

        // 4. Item Bonus (Potency Runes)
        let itemBonus = 0;
        if (item.system?.runes?.potency) itemBonus = item.system.runes.potency;
        else if (item.bonus) itemBonus = item.bonus; // Fallback
        else if (item.name.includes('+1')) itemBonus = 1;
        else if (item.name.includes('+2')) itemBonus = 2;
        else if (item.name.includes('+3')) itemBonus = 3;

        return {
            total: profScore + level + attrMod + itemBonus,
            breakdown: {
                proficiency: profScore,
                level: level,
                attribute: attrMod,
                item: itemBonus
            },
            source: {
                profRaw: profScore,
                profName: profScore === 2 ? 'Trained' : profScore === 4 ? 'Expert' : profScore === 6 ? 'Master' : profScore === 8 ? 'Legendary' : 'Untrained',
                attrName: isRanged ? 'Dex' : isFinesse && dex > str ? 'Dex (Finesse)' : 'Str',
                levelVal: character.level
            }
        };
    };

    const executeTransfer = (item, targetIdx, qty) => {
        const sourceChar = db.characters[activeCharIndex];
        const targetChar = db.characters[parseInt(targetIdx)];

        if (!targetChar) return;

        // Confirmation is partly handled by UI, assuming standard flow
        // "Confirm" button on modal commits this

        // We need to update DB root, not just current char
        // But `updateCharacter` only updates active char.
        // We need `setDb`.

        setDb(prev => {
            const next = deepClone(prev);
            const sChar = next.characters[activeCharIndex];
            const tChar = next.characters[parseInt(targetIdx)];

            const sIdx = sChar.inventory.findIndex(i =>
                (item.instanceId && i.instanceId === item.instanceId) ||
                (!item.instanceId && i.name === item.name && !!i.equipped === !!item.equipped)
            );

            if (sIdx === -1) {
                alert("Error: Item not available.");
                return prev;
            }

            const sItem = sChar.inventory[sIdx];
            if (sItem.qty < qty) {
                // Should validation be stricter here?
            }

            // Deduct
            sItem.qty -= qty;
            if (sItem.qty <= 0) {
                sChar.inventory.splice(sIdx, 1);
            }

            // Add
            const stackable = shouldStack(item);
            const tItem = stackable ? tChar.inventory.find(i => i.name === item.name) : null;
            if (tItem) tItem.qty = (tItem.qty || 1) + qty;
            else tChar.inventory.push({ ...item, qty: qty, equipped: false, instanceId: crypto.randomUUID ? crypto.randomUUID() : undefined }); // Ensure new instance gets ID if possible

            alert(`Transferred ${qty}x ${item.name} to ${tChar.name}.`);
            return next;
        });
        setActionModal({ mode: null, item: null });
    };

    // Catalog State
    const [catalogMode, setCatalogMode] = useState(null); // 'feat', 'spell'

    // Long Press State
    const longPressTimer = useRef(null);
    const handleLongPress = (item, type) => {
        setModalData({ item, type });
        setModalMode('context');
    };
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

    const character = db.characters[activeCharIndex];

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

        let sourceFile = modalData.sourceFile;
        // Fallback lookup if sourceFile missing but name exists
        if (!sourceFile && modalData.name) {
            if (isSpell) sourceFile = getSpellIndexItemByName(modalData.name)?.sourceFile;
            else if (isFeat) sourceFile = getFeatIndexItemByName(modalData.name)?.sourceFile;
            else if (isAction) sourceFile = getActionIndexItemByName(modalData.name)?.sourceFile;
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

    const updateCharacter = (fn) => {
        setDb(prev => {
            const newDb = { ...prev };
            const newChars = [...newDb.characters];
            const charClone = deepClone(newChars[activeCharIndex]);
            fn(charClone);
            newChars[activeCharIndex] = charClone;
            newDb.characters = newChars;
            return newDb;
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
        const merged = fromIndex ? { ...fromIndex, ...item, qty: item.qty || 1 } : item;
        setModalData(merged);
        setModalMode('item');
    };

    const getInventoryBucket = (item) => {
        const fromIndex = item?.name ? getShopIndexItemByName(item.name) : null;
        const type = String(item?.type || fromIndex?.type || '').toLowerCase();
        const category = String(item?.category || fromIndex?.category || '').toLowerCase();

        if (['armor', 'shield', 'weapon'].includes(type)) return 'equipment';
        if (type === 'ammo') return 'consumables';
        if (['potion', 'poison', 'mutagen', 'ammo', 'gadget'].includes(category)) return 'consumables';
        return 'misc';
    };

    const isEquipableInventoryItem = (item) => {
        const fromIndex = item?.name ? getShopIndexItemByName(item.name) : null;
        const type = String(item?.type || fromIndex?.type || '').toLowerCase();
        return ['armor', 'shield', 'weapon'].includes(type);
    };

    const toggleInventoryEquipped = async (targetItem) => {
        const itemName = targetItem?.name || targetItem;
        if (!itemName) return;

        let shieldFetchData = null;
        const char = db.characters[activeCharIndex];

        // Find specific item using equipped state to avoid ambiguity (e.g. split bombs)
        const itemToToggle = typeof targetItem === 'object'
            ? char.inventory.find(i => i.name === itemName && !!i.equipped === !!targetItem.equipped)
            : char.inventory.find(i => i.name === itemName);

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
            // Precise lookup: Match Name AND Equipped status if targetItem is an object
            const idx = c.inventory.findIndex(i => {
                if (i.name !== itemName) return false;
                if (typeof targetItem === 'object') {
                    return !!i.equipped === !!targetItem.equipped;
                }
                return true;
            });
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
                    const stackTarget = c.inventory.find(i => i.name === current.name && !i.equipped && i !== current);
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

    const saveNewAction = () => {
        if (!newAction.name) return;

        // Auto-wrap name in gold as requested
        const finalName = `[gold]${newAction.name}[/gold]`;
        const id = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString();

        const actionObj = {
            id,
            name: finalName,
            type: newAction.type,
            subtype: newAction.subtype,
            skill: newAction.skill,
            feat: newAction.feat,
            description: newAction.description
        };

        setDb(prev => ({ ...prev, actions: { ...prev.actions, [finalName]: actionObj } }));
        setModalMode(null);
        setNewAction({ name: '', type: 'Combat', subtype: 'Basic', skill: '', feat: '', description: '' });
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
                            <div key={c.name} className={badgeClass} onClick={() => setModalMode('condition')}>
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
                {activeConditions.length === 0 && <button className="btn-add-condition" onClick={() => setModalMode('condition')}>
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
                            }}>
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

    const renderAttributes = () => (
        <div className="attributes-container">
            {Object.entries(character.stats.attributes).map(([key, val]) => (
                <div className="attr-box" key={key} {...pressEvents({ key, label: ATTR_ABBREV[key] || key }, 'attribute')}>
                    <div className="attr-val">{val >= 0 ? `+${val}` : val}</div>
                    <div className="attr-label">{ATTR_ABBREV[key] || key.substring(0, 3)}</div>
                </div>
            ))}
        </div>
    );

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
            const displayName = name.replace('_', ' ');
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

    const renderActions = () => {
        // 1. Collect Actions: Index based only (File System)
        const allActions = getAllActionIndexItems().map(a => ({
            ...a,
            // Ensure fields match schema used throughout
            type: a.userType || a.type || 'Other',
            subtype: a.userSubtype || a.subtype || 'General',
            // isCustom is derived from sourceFile now if needed, but not critical for Player View filtering usually
            isCustom: a.sourceFile?.startsWith('actions/') || false
        }));

        // 2. Feat Prerequisite Filtering
        const knownFeats = new Set((character.feats || []).map(f => (typeof f === 'string' ? f : f.name)));

        // Derive categories/types for tabs from user definitions
        // Flatten actions if they have multiple types (e.g. ["Combat", "Skills"])
        const categorized = [];
        allActions.forEach(a => {
            // Feat Check
            if (a.feat && !knownFeats.has(a.feat)) return;

            const rawType = a.userType || a.type || "Other";
            const rawSub = a.userSubtype || a.subtype || "General";

            const types = Array.isArray(rawType) ? rawType : [rawType];
            const subtypes = Array.isArray(rawSub) ? rawSub : [rawSub];

            types.forEach((t, index) => {
                // Parallel mapping: Use subtype at same index, or fallback to first/only
                let mappedSub = subtypes[index];
                if (!mappedSub) mappedSub = subtypes[0] || "General";

                categorized.push({
                    ...a,
                    type: t, // flattened type
                    subtype: mappedSub,
                    _entityType: 'action'
                });
            });
        });

        // Filter based on active tab
        const filteredActions = categorized.filter(a => a.type === actionSubTab);

        // Group by Subtype/Category
        const grouped = {};
        filteredActions.forEach(a => {
            const sub = a.subtype || "General";
            if (!grouped[sub]) grouped[sub] = [];
            grouped[sub].push(a);
        });

        // Defined order of priority for Subtypes
        const subtypePriority = [
            'Attack', 'Defense', 'Social', 'Assist',
            'Ground', 'Jumping & Falling', 'Maneuver',
            'Cloak & Dagger', 'Other', 'Downtime'
        ];

        const sortedSubtypes = Object.keys(grouped).sort((a, b) => {
            let ia = subtypePriority.indexOf(a);
            let ib = subtypePriority.indexOf(b);
            if (ia === -1) ia = 99;
            if (ib === -1) ib = 99;
            if (ia !== ib) return ia - ib;
            return a.localeCompare(b);
        });

        // Calculate available tabs
        const allTypes = new Set();
        categorized.forEach(a => allTypes.add(a.type));

        // Defined order of priority for Tabs
        const tabPriority = ['Combat', 'Movement', 'Skills', 'Other'];
        const availableTabs = Array.from(allTypes).sort((a, b) => {
            let ia = tabPriority.indexOf(a);
            let ib = tabPriority.indexOf(b);
            if (ia === -1) ia = 99;
            if (ib === -1) ib = 99;
            if (ia !== ib) return ia - ib;
            return a.localeCompare(b);
        });

        // Common action sorting priority (optional, specific actions first)
        const actionPriority = [
            'Strike', 'Feint', 'Shove', 'Trip', 'Grapple', 'Escape', 'Raise a Shield', 'Take Cover',
            'Stride', 'Step', 'Leap', 'Long Jump', 'High Jump', 'Arrest a Fall', 'Grab an Edge',
            'Sense Motive', 'Make an Impression', 'Lie', 'Coerce', 'Impersonate',
            'Sneak', 'Hide', 'Steal', 'Pick a Lock', 'Palm an Object', 'Recall Knowledge', 'Seek', 'Treat Wounds'
        ];

        return (
            <div>
                <div className="sub-tabs">
                    {availableTabs.map(t => (
                        <button key={t} className={`sub-tab-btn ${actionSubTab === t ? 'active' : ''}`} onClick={() => setActionSubTab(t)}>
                            {t === 'Other' ? 'Exploration' : t}
                        </button>
                    ))}
                </div>

                {sortedSubtypes.map(sub => (
                    <div key={sub}>
                        {sub !== "General" && sortedSubtypes.length > 1 && <div className="action-subtype-header">{sub}</div>}
                        {grouped[sub].sort((a, b) => { // Sort actions within subtype
                            let ia = actionPriority.indexOf(a.name);
                            let ib = actionPriority.indexOf(b.name);
                            if (ia === -1) ia = 999;
                            if (ib === -1) ib = 999;
                            // If both unknown, sort alpha
                            if (ia === 999 && ib === 999) return a.name.localeCompare(b.name);
                            return ia - ib;
                        }).map(action => {
                            // Calculate Skill Bonus To Display
                            // skill field can be string ("Athletics"), array (["Athletics", "Acrobatics"]), or special ("ToHit", "Perception", "Deception")
                            let skillDisplay = null;
                            let bonusVal = null;
                            let bestLabel = null;

                            const skillDef = action.skill;
                            if (skillDef) {
                                let skillsToCheck = Array.isArray(skillDef) ? skillDef : [skillDef];
                                let best = -999;

                                skillsToCheck.forEach(s => {
                                    if (s === 'ToHit') {
                                        // Special case for attack bonus
                                        return;
                                    }

                                    // Fix for Seek (Perception)
                                    if (s === 'Perception') {
                                        const calc = calculateStat(character, "Perception", character.stats.perception);
                                        if (calc && calc.total > best) {
                                            best = calc.total;
                                            bestLabel = "Perception";
                                        }
                                        return;
                                    }

                                    const val = character.skills[s] || 0;
                                    const calc = calculateStat(character, s, val);
                                    if (calc && calc.total > best) {
                                        best = calc.total;
                                        bestLabel = s.replace(/_/g, ' '); // simple format if needed
                                    }
                                });

                                if (best > -999) {
                                    bonusVal = best;
                                }
                            }

                            // Map typeCode to Icon
                            // typeCode: '1', '2', '3', 'R', 'F', 'P'
                            let ActionIcon = null;
                            if (action.typeCode === '1') ActionIcon = ACTION_ICONS['[one-action]'];
                            else if (action.typeCode === '2') ActionIcon = ACTION_ICONS['[two-actions]'];
                            else if (action.typeCode === '3') ActionIcon = ACTION_ICONS['[three-actions]'];
                            else if (action.typeCode === 'R') ActionIcon = ACTION_ICONS['[reaction]'];
                            else if (action.typeCode === 'F') ActionIcon = ACTION_ICONS['[free-action]'];

                            return (
                                <div className="item-row" key={`${action.name}-${action.type}`} onClick={() => { setModalData(action); setModalMode('item'); }}>
                                    <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
                                        <span className="item-name" dangerouslySetInnerHTML={{ __html: formatText(action.name) }} />
                                        {ActionIcon && (
                                            <span style={{ marginLeft: 6, display: 'flex', alignItems: 'center' }}
                                                title={action.typeCode === 'R' ? 'Reaction' : action.typeCode === 'F' ? 'Free Action' : `${action.typeCode} Action(s)`}
                                                dangerouslySetInnerHTML={{ __html: ActionIcon }}
                                            />
                                        )}
                                    </div>

                                    {bestLabel && (
                                        <span style={{ marginRight: 8, color: 'rgba(255,255,255,0.5)', fontSize: '0.75em', fontStyle: 'italic' }}>
                                            ({bestLabel})
                                        </span>
                                    )}

                                    {bonusVal !== null && (
                                        <div style={{ color: 'var(--text-gold)', fontWeight: 'bold', fontSize: '1.1em', minWidth: '1.5em', textAlign: 'right' }}>
                                            {bonusVal >= 0 ? '+' : ''}{bonusVal}
                                        </div>
                                    )}
                                    {skillDef === 'ToHit' && (
                                        <div style={{ color: '#888', fontSize: '0.8em', fontStyle: 'italic' }}>Attack</div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                ))}
                {filteredActions.length === 0 && <div style={{ color: '#666', fontStyle: 'italic' }}>No actions found.</div>}
            </div>
        );
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

                            {/* Weapon Proficiency Bonus (Right side) */}
                            {isEquipableInventoryItem(item) && (
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

    const renderMagic = () => {
        // Guard for missing magic data
        const magic = character.magic || { slots: {}, list: [] };

        // --- 1. SLOTS & STATS COLUMN (LEFT) ---
        // Calc Attack & DC: 10 + Attr + Prof + Level
        const attrName = magic.attribute || "Intelligence";
        const attrMod = parseInt(character.stats.attributes[(attrName || "").toLowerCase()]) || 0;
        const prof = parseFloat(magic.proficiency) || 0;
        const level = parseInt(character.level) || 0;

        // Stats Fix: Only add level if proficiency > 0
        const atkBonus = Math.floor(attrMod + prof + (prof > 0 ? level : 0));
        const dcVal = 10 + atkBonus;
        const atkStr = (atkBonus >= 0 ? "+" : "") + atkBonus;

        const slotKeys = ['f', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];
        const slots = magic.slots || {};

        const renderSlots = () => slotKeys.map(k => {
            const max = slots[k + "_max"];
            const curr = slots[k + "_curr"] || 0;
            if (max > 0) {
                const title = (k === 'f') ? "Focus Points" : "Level " + k;
                const checks = [];
                for (let i = 1; i <= max; i++) {
                    const isActive = i <= curr;
                    checks.push(
                        <div
                            key={i}
                            className={`slot-check ${isActive ? 'active' : ''}`}
                            onClick={() => toggleSpellSlot(k, i, curr)}
                        />
                    );
                }
                return (
                    <div className="slot-box" key={k} {...pressEvents({ level: k, max }, 'spell_slots')}>
                        <div className="slot-title">{title}</div>
                        <div className="slot-checks">{checks}</div>
                    </div>
                );
            }
            return null;
        });

        // --- 2. SPELLS LIST COLUMN (RIGHT) ---
        const spellsByLevel = {};
        const spellList = Array.isArray(magic.list) ? magic.list : [];

        spellList.forEach(s => {
            const spellFromIndex = getSpellIndexItemByName(s.name);
            // Merge index data with character data (e.g. Bloodmagic prop)
            const spellData = { ...(spellFromIndex || {}), ...s, _entityType: 'spell' };
            const lvl = s.level;
            if (!spellsByLevel[lvl]) spellsByLevel[lvl] = [];
            spellsByLevel[lvl].push(spellData);
        });

        const sortedLevels = Object.keys(spellsByLevel).sort((a, b) => {
            if (a === 'Focus') return 1;
            if (b === 'Focus') return -1;
            return parseInt(a) - parseInt(b);
        });

        const renderSpellList = () => sortedLevels.map(lvl => {
            const label = lvl === '0' ? 'Cantrips' : lvl === 'Focus' ? 'Focus Spells' : `Rank ${lvl}`;
            return (
                <div key={lvl}>
                    <div className="spell-list-header">{label}</div>
                    {spellsByLevel[lvl].map(spell => {
                        const isBloodline = spell.Bloodmagic === true;

                        // Meta info
                        const rawTarget = spell.target || spell.area || "";
                        // Enhance with Index Data
                        const idxItem = getSpellIndexItemByName(spell.name);

                        // Defense
                        let defense = idxItem?.defense || "";
                        if (defense) {
                            const defMap = { fortitude: "Fort", reflex: "Ref", will: "Will", ac: "AC" };
                            defense = defMap[defense.toLowerCase()] || (defense.charAt(0).toUpperCase() + defense.slice(1));
                        }

                        // Range
                        let range = idxItem?.range || spell.range || "";
                        if (range) {
                            range = range.replace(/feet/gi, "ft");
                        }

                        // Time / Actions
                        const rawTime = idxItem?.time || spell.time || spell.cast || "";
                        let timeIcon = "";
                        if (rawTime) {
                            // Map simple values to icon keys
                            const t = String(rawTime).toLowerCase();
                            if (t === "1") timeIcon = ACTION_ICONS["[one-action]"];
                            else if (t === "2") timeIcon = ACTION_ICONS["[two-actions]"];
                            else if (t === "3") timeIcon = ACTION_ICONS["[three-actions]"];
                            else if (t.includes("reaction")) timeIcon = ACTION_ICONS["[reaction]"];
                            else if (t.includes("free")) timeIcon = ACTION_ICONS["[free-action]"];
                            else timeIcon = formatText(rawTime); // Fallback
                        }

                        const metaParts = [];
                        if (range) metaParts.push(<span key="range">{range}</span>);
                        if (defense) metaParts.push(<span key="def" style={{ color: '#aaa' }}>{defense}</span>);
                        if (timeIcon) metaParts.push(<span key="cast" dangerouslySetInnerHTML={{ __html: timeIcon }} style={{ display: 'flex', alignItems: 'center' }} />);

                        return (
                            <div className="spell-row" key={spell.name}
                                onClick={() => { setModalData(spell); setModalMode('item'); }}
                                {...pressEvents(spell, 'spell')}
                            >
                                <div style={{ fontWeight: 'bold', color: '#ccc', display: 'flex', alignItems: 'center' }}>
                                    {spell.name}
                                    {isBloodline && <span className="bloodline-drop">🩸</span>}
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
                </div>
            );
        });

        return (
            <div className="magic-split">
                <div id="slotColumn">
                    <div className="magic-stat-block">
                        {/* Spell DC Hex */}
                        <div className="hex-box"
                            onClick={() => setModalMode('spell_stat_info')}
                            {...pressEvents(null, 'spell_proficiency')}
                        >
                            <div className="hex-content">
                                <div className="stat-val" style={{ fontSize: '1.4em', fontWeight: 'bold', color: '#c5a059', lineHeight: 1.1 }}>{dcVal}</div>
                                <div className="stat-label" style={{ fontSize: '0.6em', textTransform: 'uppercase', color: '#888', marginTop: 2 }}>SPELL DC</div>
                            </div>
                        </div>
                        {/* Attack */}
                        <div className="spell-attack-box"
                            onClick={() => setModalMode('spell_stat_info')}
                            {...pressEvents(null, 'spell_proficiency')}
                        >
                            <div className="stat-val" style={{ fontSize: '1.4em', fontWeight: 'bold', color: '#c5a059', lineHeight: 1.1 }}>{atkStr}</div>
                            <div className="stat-label" style={{ fontSize: '0.6em', textTransform: 'uppercase', color: '#888', marginTop: 2 }}>ATTACK</div>
                        </div>
                    </div>
                    <div style={{ borderBottom: '2px solid #5c4033', margin: '5px 0 15px 0', width: '100%' }}></div>
                    {renderSlots()}
                </div>
                <div id="spellListColumn">
                    {renderSpellList()}
                    <button
                        className="btn-add-condition"
                        style={{ marginTop: 20, width: '100%' }}
                        onClick={() => setCatalogMode('spell')}
                    >
                        + Add Spell
                    </button>
                </div>
            </div>
        );
    };

    const renderFeats = () => {
        const featsByType = {};

        character.feats.forEach(featName => {
            const featFromIndex = getFeatIndexItemByName(featName);
            if (featFromIndex) {
                const feat = { ...featFromIndex, _entityType: 'feat' };
                let rawType = feat.category || feat.type || 'General';
                // Capitalize first letter, lowercase rest for consistent keys
                let type = rawType.charAt(0).toUpperCase() + rawType.slice(1).toLowerCase();

                if (!featsByType[type]) featsByType[type] = [];
                featsByType[type].push(feat);
            }
        });

        // Forced Order: Ancestry, Class, General, Skill, Bonus, everything else
        const order = ['Ancestry', 'Class', 'General', 'Skill', 'Bonus'];
        const sortedKeys = Object.keys(featsByType).sort((a, b) => {
            const ia = order.indexOf(a);
            const ib = order.indexOf(b);
            if (ia !== -1 && ib !== -1) return ia - ib;
            if (ia !== -1) return -1;
            if (ib !== -1) return 1;
            return a.localeCompare(b);
        });

        return (
            <div>
                {sortedKeys.map(type => (
                    <div key={type} style={{ marginBottom: 20 }}>
                        <h3 style={{ borderBottom: '1px solid #5c4033', paddingBottom: 5 }}>{type}</h3>
                        {featsByType[type].map((feat, i) => (
                            <div className="item-row" key={feat.name}
                                onClick={() => { setModalData(feat); setModalMode('item'); }}
                                {...pressEvents(feat, 'feat')}
                            >
                                <span className="item-name">{feat.name}</span>
                            </div>
                        ))}
                    </div>
                ))}
                <button
                    className="btn-add-condition"
                    style={{ marginTop: 20, width: '100%' }}
                    onClick={() => setCatalogMode('feat')}
                >
                    + Add Feat
                </button>
            </div>
        );
    };

    // --- MODAL COMPONENT ---
    const EditModal = () => {
        // Helper for HP/Gold Modals
        const [editVal, setEditVal] = useState("");

        // Condition Modal State
        const [condTab, setCondTab] = useState('active'); // 'active', 'negative', 'positive', 'visibility'

        // New Collapsible State
        const [showProficiencies, setShowProficiencies] = useState(false);
        const [showTempHp, setShowTempHp] = useState(false);

        if (!modalMode) return null;
        const close = () => {
            setModalMode(null);
            setModalData(null);
            setEditVal("");
            setCondTab('active');
        };
        let content = null;

        if (modalMode === 'hp') {
            content = (
                <>
                    <h2>Manage Hit Points</h2>
                    <p style={{ textAlign: 'center', color: '#888' }}>
                        Current HP: <span style={{ color: 'var(--text-gold)', fontWeight: 'bold' }}>{character.stats.hp.current}</span>
                        &nbsp; | &nbsp;
                        <span
                            onClick={() => setShowTempHp(!showTempHp)}
                            style={{ cursor: 'pointer', textDecoration: 'underline', textDecorationStyle: 'dotted', textUnderlineOffset: 4, color: '#888' }}
                        >
                            Temp: <span style={{ color: 'var(--accent-blue)', fontWeight: 'bold' }}>{character.stats.hp.temp}</span>
                        </span>
                    </p>

                    <div className="modal-form-group" style={{ textAlign: 'center' }}>
                        <label>Hit Points</label>
                        <div className="qty-control-box">
                            <button className="qty-btn" onClick={() => updateCharacter(c => c.stats.hp.current = Math.max(0, c.stats.hp.current - (parseInt(editVal) || 0)))}>-</button>
                            <input type="number" className="modal-input" style={{ width: 100, textAlign: 'center' }} value={editVal} onChange={e => setEditVal(e.target.value)} placeholder="0" />
                            <button className="qty-btn" onClick={() => updateCharacter(c => c.stats.hp.current = Math.max(0, c.stats.hp.current + (parseInt(editVal) || 0)))}>+</button>
                        </div>
                        <div style={{ marginTop: 10 }}>
                            <button className="set-btn" onClick={() => { updateCharacter(c => c.stats.hp.current = parseInt(editVal) || 0); setEditVal(""); }}>Set HP</button>
                        </div>
                    </div>

                    {showTempHp && (
                        <div className="modal-form-group" style={{ textAlign: 'center', marginTop: 20, borderTop: '1px solid #444', paddingTop: 20 }}>
                            <label style={{ color: 'var(--accent-blue)' }}>Temp HP</label>
                            <div className="qty-control-box">
                                <button className="qty-btn" onClick={() => updateCharacter(c => c.stats.hp.temp = Math.max(0, c.stats.hp.temp - (parseInt(editVal) || 0)))}>-</button>
                                <input type="number" className="modal-input" style={{ width: 100, textAlign: 'center' }} value={editVal} onChange={e => setEditVal(e.target.value)} placeholder="0" />
                                <button className="qty-btn" onClick={() => updateCharacter(c => c.stats.hp.temp = c.stats.hp.temp + (parseInt(editVal) || 0))}>+</button>
                            </div>
                            <button className="set-btn" onClick={() => { updateCharacter(c => c.stats.hp.temp = parseInt(editVal) || 0); setEditVal(""); }}>Set Temp to Value</button>
                        </div>
                    )}
                </>
            );
        } else if (modalMode === 'addAction') {
            content = (
                <>
                    <h2>Create New Action</h2>
                    <div className="modal-form-group">
                        <label>Name</label>
                        <input className="modal-input" value={newAction.name} onChange={e => setNewAction({ ...newAction, name: e.target.value })} placeholder="Action Name" />
                    </div>
                    <div className="modal-form-group">
                        <label>Type (comma separated)</label>
                        <input className="modal-input" value={newAction.type} onChange={e => setNewAction({ ...newAction, type: e.target.value })} placeholder="Combat, Movement" />
                    </div>
                    <div className="modal-form-group">
                        <label>Subtype</label>
                        <input className="modal-input" value={newAction.subtype} onChange={e => setNewAction({ ...newAction, subtype: e.target.value })} placeholder="Basic, Skill, Class..." />
                    </div>
                    <div className="modal-form-group">
                        <label>Skill (optional)</label>
                        <input className="modal-input" value={newAction.skill} onChange={e => setNewAction({ ...newAction, skill: e.target.value })} placeholder="Athletics" />
                    </div>
                    <div className="modal-form-group">
                        <label>Feat (optional)</label>
                        <input className="modal-input" value={newAction.feat} onChange={e => setNewAction({ ...newAction, feat: e.target.value })} placeholder="Feat Name" />
                    </div>
                    <div className="modal-form-group">
                        <label>Description</label>
                        <textarea className="modal-input" style={{ height: 100, fontFamily: 'inherit', resize: 'vertical' }} value={newAction.description} onChange={e => setNewAction({ ...newAction, description: e.target.value })} placeholder="Action description..." />
                    </div>
                    <button className="set-btn" onClick={saveNewAction}>Save Action</button>
                </>
            );
        } else if (modalMode === 'context') {
            const type = modalData?.type;
            const item = modalData?.item;
            const title = item?.name || item?.title || (type ? type.replace(/_/g, ' ').toUpperCase() : 'OPTIONS'); // From inline block logic

            content = (
                <>
                    <h2 style={{ margin: '0 0 10px 0', color: 'var(--text-gold)', fontFamily: 'Cinzel, serif' }}>{title}</h2>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {/* Spell/Feat Actions */}
                        {type === 'spell' && (
                            <button className="set-btn" onClick={() => toggleBloodmagic(item)}>
                                {item.Bloodmagic ? 'Remove Bloodmagic' : 'Add Bloodmagic'}
                            </button>
                        )}
                        {(type === 'feat' || type === 'spell') && (
                            <button className="set-btn" style={{ background: '#d32f2f', color: '#fff' }} onClick={() => removeFromCharacter(item, type)}>
                                Remove {type === 'feat' ? 'Feat' : 'Spell'}
                            </button>
                        )}

                        {/* Stat Context Options */}
                        {type === 'attribute' && (
                            <button className="set-btn" onClick={() => setModalMode('edit_attribute')}>Change Attribute</button>
                        )}
                        {type === 'skill' && (
                            <button className="set-btn" onClick={() => setModalMode('edit_proficiency')}>Change Proficiency</button>
                        )}
                        {type === 'speed' && (
                            <button className="set-btn" onClick={() => setModalMode('edit_speed')}>Change Speed</button>
                        )}
                        {type === 'class_dc' && (
                            <button className="set-btn" onClick={() => setModalMode('edit_proficiency')}>Change Class DC</button>
                        )}
                        {type === 'language' && (
                            <button className="set-btn" onClick={() => setModalMode('edit_languages')}>Edit Languages</button>
                        )}

                        {/* AC & Defense */}
                        {type === 'ac_button' && (
                            <button className="set-btn" onClick={() => setModalMode('edit_armor_prof')}>Change Armor Proficiency</button>
                        )}
                        {type === 'perception' && (
                            <button className="set-btn" onClick={() => setModalMode('edit_perception')}>Edit Perception</button>
                        )}

                        {/* HP / Level */}
                        {(type === 'level' || type === 'hp' || type === 'max_hp') && (
                            <button className="set-btn" onClick={() => setModalMode(type === 'hp' ? 'hp' : 'edit_max_hp')}>Change Max HP</button>
                        )}
                        {type === 'level' && (
                            <button className="set-btn" onClick={() => setModalMode('edit_level')}>Change Character Level</button>
                        )}

                        {/* Magic */}
                        {type === 'spell_proficiency' && (
                            <button className="set-btn" onClick={() => setModalMode('edit_spell_proficiency')}>Edit Spell Proficiency</button>
                        )}
                        {type === 'spell_slots' && (
                            <button className="set-btn" onClick={() => setModalMode('edit_spell_slots')}>Edit Spell Slots</button>
                        )}
                    </div>
                </>
            );
        } else if (modalMode === 'gold') {
            content = (
                <>
                    <h2>Manage Gold</h2>
                    <p style={{ textAlign: 'center', color: '#888' }}>Current: <span style={{ color: 'var(--text-gold)', fontWeight: 'bold' }}>{character.gold}</span></p>
                    <div className="qty-control-box">
                        <button className="qty-btn" style={{ borderColor: 'var(--accent-red)', color: 'var(--accent-red)' }} onClick={() => updateCharacter(c => c.gold = parseFloat((c.gold - (parseFloat(editVal) || 0)).toFixed(2)))}>-</button>
                        <input type="number" className="modal-input" style={{ width: 100, textAlign: 'center' }} value={editVal} onChange={e => setEditVal(e.target.value)} placeholder="0" />
                        <button className="qty-btn" style={{ borderColor: 'var(--accent-green)', color: 'var(--accent-green)' }} onClick={() => updateCharacter(c => c.gold = parseFloat((c.gold + (parseFloat(editVal) || 0)).toFixed(2)))}>+</button>
                    </div>
                    <button className="set-btn" onClick={() => { updateCharacter(c => c.gold = parseFloat(editVal) || 0); setEditVal(""); }}>Set to Value</button>
                </>
            );
        } else if (modalMode === 'shield') {
            // New Shield Status Modal
            const inventory = Array.isArray(character.inventory) ? character.inventory : [];
            // Find equipped shield directly again to be safe
            const shields = inventory.filter(i => {
                const fromIndex = i?.name ? getShopIndexItemByName(i.name) : null;
                const type = String(i?.type || fromIndex?.type || '').toLowerCase();
                return type === 'shield';
            });
            const equippedShield = shields.find(i => Boolean(i?.equipped));

            if (!equippedShield) {
                content = <div>No shield equipped.</div>;
            } else {
                const shieldHp = character.stats.ac.shield_hp || 0;
                const fromIndex = equippedShield?.name ? getShopIndexItemByName(equippedShield.name) : null;
                const merged = fromIndex ? { ...fromIndex, ...equippedShield } : equippedShield;
                const shieldMax = (merged.system?.hp?.max) || 20;
                const hardness = (merged.system?.hardness) || 0;

                content = (
                    <>
                        <h2>Shield Status</h2>
                        <div style={{ marginBottom: 20, textAlign: 'center' }}>
                            <div style={{ fontSize: '1.2em', fontWeight: 'bold', color: 'var(--text-gold)' }}>{equippedShield.name}</div>
                            <div style={{ display: 'flex', justifyContent: 'center', gap: 20, marginTop: 10 }}>
                                <div style={{ background: '#333', padding: '5px 10px', borderRadius: 5 }}>
                                    <div style={{ fontSize: '0.8em', color: '#aaa' }}>Hardness</div>
                                    <div style={{ fontSize: '1.2em' }}>{hardness}</div>
                                </div>
                                <div style={{ background: '#333', padding: '5px 10px', borderRadius: 5 }}>
                                    <div style={{ fontSize: '0.8em', color: '#aaa' }}>Max HP</div>
                                    <div style={{ fontSize: '1.2em' }}>{shieldMax}</div>
                                </div>
                            </div>
                        </div>

                        <div className="modal-form-group" style={{ textAlign: 'center' }}>
                            <label>Current Shield HP: <span style={{ color: shieldHp < shieldMax / 2 ? '#ff5252' : '#fff' }}>{shieldHp}</span></label>

                            <div className="qty-control-box">
                                <button className="qty-btn" onClick={() => updateCharacter(c => {
                                    const oldHp = parseInt(c.stats.ac.shield_hp || 0);
                                    const max = parseInt(shieldMax || 20);
                                    const newHp = Math.max(0, oldHp - (parseInt(editVal) || 0));
                                    c.stats.ac.shield_hp = newHp;
                                    if (newHp < max / 2) {
                                        c.stats.ac.shield_raised = false; // Auto-lower if broken
                                    }
                                })}>-</button>
                                <input type="number" className="modal-input" style={{ width: 80, textAlign: 'center' }} value={editVal} onChange={e => setEditVal(e.target.value)} placeholder="Amount" />
                                <button className="qty-btn" onClick={() => updateCharacter(c => c.stats.ac.shield_hp = Math.min(shieldMax, (c.stats.ac.shield_hp || 0) + (parseInt(editVal) || 0)))}>+</button>
                            </div>

                            <div style={{ marginTop: 15, display: 'flex', justifyContent: 'center' }}>
                                <button
                                    className="set-btn"
                                    style={{ width: 'auto', padding: '5px 15px', fontSize: '0.9em' }}
                                    onClick={() => {
                                        updateCharacter(c => c.stats.ac.shield_hp = shieldMax);
                                        setEditVal("");
                                    }}
                                >Full Repair</button>
                                <button
                                    className="set-btn"
                                    style={{ width: 'auto', padding: '5px 15px', fontSize: '0.9em', marginLeft: 10, background: '#444' }}
                                    onClick={() => {
                                        updateCharacter(c => {
                                            const max = parseInt(shieldMax || 20);
                                            const newHp = parseInt(editVal) || 0;
                                            c.stats.ac.shield_hp = newHp;
                                            if (newHp < max / 2) {
                                                c.stats.ac.shield_raised = false;
                                            }
                                        });
                                        setEditVal("");
                                    }}
                                >Set to Value</button>
                            </div>
                        </div>
                    </>
                );
            }

        } else if (modalMode === 'ac') {
            const acData = getArmorClassData(character);
            const inventory = Array.isArray(character?.inventory) ? character.inventory : [];
            const armorItems = inventory.filter(invItem => {
                const fromIndex = invItem?.name ? getShopIndexItemByName(invItem.name) : null;
                const type = String(invItem?.type || fromIndex?.type || '').toLowerCase();
                return type === 'armor';
            });
            const equippedArmor = armorItems.find(i => Boolean(i?.equipped));

            const shieldItems = inventory.filter(invItem => {
                const fromIndex = invItem?.name ? getShopIndexItemByName(invItem.name) : null;
                const type = String(invItem?.type || fromIndex?.type || '').toLowerCase();
                return type === 'shield';
            });
            const equippedShield = shieldItems.find(i => Boolean(i?.equipped));

            const ARMOR_PROF_KEYS = ['Unarmored', 'Light', 'Medium', 'Heavy'];
            const ARMOR_RANKS = [
                { value: 0, label: 'Untrained (+0)' },
                { value: 2, label: 'Trained (+2)' },
                { value: 4, label: 'Expert (+4)' },
                { value: 6, label: 'Master (+6)' },
                { value: 8, label: 'Legendary (+8)' }
            ];

            const toggleArmorEquipped = () => {
                updateCharacter(c => {
                    if (!Array.isArray(c.inventory)) c.inventory = [];
                    if (!c.stats) c.stats = {};
                    if (!c.stats.ac) c.stats.ac = {};

                    const isArmor = (invItem) => {
                        const fromIndex = invItem?.name ? getShopIndexItemByName(invItem.name) : null;
                        const type = String(invItem?.type || fromIndex?.type || '').toLowerCase();
                        return type === 'armor';
                    };

                    const armorInv = c.inventory.filter(isArmor);
                    const currentlyEquipped = armorInv.find(i => Boolean(i?.equipped));

                    if (currentlyEquipped) {
                        c.stats.ac.last_armor = currentlyEquipped.name;
                        armorInv.forEach(i => { i.equipped = false; });
                        c.stats.ac.armor_equipped = false;
                        return;
                    }

                    const lastName = c.stats.ac.last_armor;
                    let toEquip = lastName ? armorInv.find(i => i.name === lastName) : null;
                    if (!toEquip && armorInv.length === 1) toEquip = armorInv[0];
                    if (!toEquip) {
                        c.stats.ac.armor_equipped = false;
                        return;
                    }

                    armorInv.forEach(i => { i.equipped = false; });
                    toEquip.equipped = true;
                    c.stats.ac.last_armor = toEquip.name;
                    c.stats.ac.armor_equipped = true;
                });
            };

            content = (
                <>
                    <h2>Armor & Shield</h2>
                    <div className="modal-toggle-row" onClick={toggleArmorEquipped}>
                        <span>Armor Equipped</span>
                        <label className="switch">
                            <input type="checkbox" checked={Boolean(equippedArmor)} readOnly />
                            <span className="slider"></span>
                        </label>
                    </div>
                    {armorItems.length > 0 && (
                        <div style={{ marginTop: -2, marginBottom: 10, color: '#888', fontSize: '0.85em' }}>
                            {equippedArmor ? `Equipped: ${equippedArmor.name}` : 'No armor equipped.'}
                        </div>
                    )}
                    {armorItems.length === 0 && (
                        <div style={{ marginTop: -2, marginBottom: 10, color: '#666', fontStyle: 'italic', fontSize: '0.85em' }}>
                            No armor found in inventory.
                        </div>
                    )}
                    <div className="modal-toggle-row" onClick={() => {
                        const shieldToToggle = equippedShield ? equippedShield.name : (() => {
                            // Find best available shield in inventory
                            const inv = character.inventory || [];
                            const shields = inv.filter(i => {
                                const fromIndex = i?.name ? getShopIndexItemByName(i.name) : null;
                                const type = String(i?.type || fromIndex?.type || '').toLowerCase();
                                return type === 'shield';
                            });
                            return shields.length > 0 ? shields[0].name : null;
                        })();

                        if (shieldToToggle) toggleInventoryEquipped(shieldToToggle);
                    }}>
                        <span>Shield Equipped</span>
                        <label className="switch">
                            <input type="checkbox" checked={Boolean(inventory.some(i => {
                                const fromIndex = i?.name ? getShopIndexItemByName(i.name) : null;
                                const type = String(i?.type || fromIndex?.type || '').toLowerCase();
                                return type === 'shield' && i.equipped;
                            }))} readOnly />
                            <span className="slider"></span>
                        </label>
                    </div>
                    {/* Shield HP is now managed in the dedicated shield modal */}

                    <div style={{
                        marginTop: 15,
                        paddingTop: 12,
                        borderTop: '1px solid #444',
                        fontSize: '0.85em',
                        color: '#aaa',
                        lineHeight: 1.5
                    }}>
                        <div style={{ textTransform: 'uppercase', letterSpacing: 0.6, fontSize: '0.75em', color: '#888', marginBottom: 6 }}>
                            AC Breakdown
                        </div>
                        <div>
                            <strong>Total:</strong> {acData.totalAC}
                            {acData.acPenalty < 0 ? <span style={{ color: 'var(--accent-red)' }}> ({acData.acPenalty})</span> : null}
                            <span style={{ color: '#888' }}> — Base {acData.baseAC}</span>
                        </div>
                        <div style={{ marginTop: 6 }}>
                            <strong>Armor:</strong> {acData.armorName ? `${acData.armorName} (${acData.armorCategory || 'untyped'})` : 'None (Unarmored)'}
                            {acData.armorItemBonus ? <span style={{ color: '#888' }}> — Item +{acData.armorItemBonus} AC</span> : null}
                        </div>
                        {acData.shieldName && (
                            <div style={{ marginTop: 6 }}>
                                <strong>Shield:</strong> {acData.shieldName} {acData.shieldRaised ? '(Raised)' : '(Lowered)'}
                                <span style={{ color: '#888' }}> — Item +{acData.shieldItemBonus} AC {acData.shieldRaised ? '' : '(Inactive)'}</span>
                            </div>
                        )}
                        <div>
                            <strong>Dex:</strong> {acData.dexMod >= 0 ? `+${acData.dexMod}` : acData.dexMod}
                            {typeof acData.dexCap === 'number'
                                ? <span style={{ color: '#888' }}> (cap {acData.dexCap}, used {acData.dexUsed >= 0 ? `+${acData.dexUsed}` : acData.dexUsed})</span>
                                : <span style={{ color: '#888' }}> (used {acData.dexUsed >= 0 ? `+${acData.dexUsed}` : acData.dexUsed})</span>}
                        </div>
                        <div>
                            <strong>Proficiency:</strong> {acData.profKey} {acData.profRank}
                            {acData.profRank > 0
                                ? <span style={{ color: '#888' }}> + lvl {acData.level} = {acData.profBonus}</span>
                                : <span style={{ color: '#888' }}> (untrained, no level)</span>}
                        </div>
                        <div>
                            <strong>Formula:</strong> 10 + {acData.dexUsed} + {acData.profBonus} + {acData.armorItemBonus} {acData.activeShieldBonus ? `+ ${acData.activeShieldBonus} (Shield)` : ''} = {acData.baseAC}
                        </div>
                        {acData.acPenalty !== 0 && (
                            <div>
                                <strong>Penalties:</strong> status {acData.statusPenalty}, circumstance {acData.circPenalty}
                            </div>
                        )}
                    </div>

                    {/* Armor Proficiencies (Removed and moved to Context Menu) */}



                    <div style={{ marginTop: 15, borderTop: '1px solid #444', paddingTop: 10 }}>
                        <div style={{ fontSize: '0.9em', color: '#aaa', marginBottom: 5, textAlign: 'center' }}>Trained Proficiencies</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
                            {['Unarmored', 'Light', 'Medium', 'Heavy'].map(key => {
                                const val = character?.stats?.proficiencies?.[key.toLowerCase()] || 0;
                                if (val < 2) return null;
                                const rankLabel = ARMOR_RANKS.find(r => r.value === val)?.label.split(' ')[0] || 'Trained'; // Get 'Trained', 'Expert' etc
                                return (
                                    <div key={key} style={{ background: '#333', padding: '2px 8px', borderRadius: 4, fontSize: '0.85em' }}>
                                        <span style={{ color: '#ccc' }}>{key}</span> <span style={{ color: 'var(--text-gold)' }}>{rankLabel}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div style={{ marginTop: 20, textAlign: 'center', borderTop: '1px solid #444', paddingTop: 10 }}>
                        <div style={{ fontSize: '0.9em', color: '#888', marginBottom: 5 }}>Base Calculation</div>
                        <div style={{ fontSize: '0.85em', fontFamily: 'monospace' }}>
                            10 + Dex({acData.dexUsed}) + Prof({acData.profBonus || 0}) + Item({acData.armorItemBonus || 0})
                            {acData.activeShieldBonus > 0 ? ` + Shield(${acData.activeShieldBonus})` : ''}
                        </div>
                    </div>
                </>
            );
        } else if (modalMode === 'condition') {
            const allConditions = Object.keys(conditionsCatalog).sort();
            const activeConditions = character.conditions.filter(c => c.level > 0).map(c => c.name);

            const adjustCondition = (condName, delta) => {
                const valued = isConditionValued(condName);
                updateCharacter(c => {
                    const idx = c.conditions.findIndex(x => x.name === condName);
                    if (!valued) {
                        if (delta > 0) {
                            if (idx > -1) c.conditions[idx].level = 1;
                            else c.conditions.push({ name: condName, level: 1 });
                        } else if (idx > -1) {
                            c.conditions.splice(idx, 1);
                        }
                        return;
                    }

                    if (delta > 0) {
                        if (idx > -1) c.conditions[idx].level = (c.conditions[idx].level || 0) + 1;
                        else c.conditions.push({ name: condName, level: 1 });
                    } else if (idx > -1) {
                        const nextLevel = (c.conditions[idx].level || 0) - 1;
                        if (nextLevel <= 0) c.conditions.splice(idx, 1);
                        else c.conditions[idx].level = nextLevel;
                    }
                });
            };

            let listToRender = [];
            if (condTab === 'active') {
                listToRender = activeConditions;
            } else {
                // Filter all conditions by category
                let catList = [];
                if (condTab === 'negative') catList = NEG_CONDS;
                else if (condTab === 'positive') catList = POS_CONDS;
                else if (condTab === 'visibility') catList = VIS_CONDS;

                // Match case-insensitive
                catList = catList.map(s => s.toLowerCase());
                listToRender = allConditions.filter(c => catList.includes(c.toLowerCase()));
            }

            content = (
                <>
                    <h2>Conditions</h2>
                    <div className="modal-tabs">
                        <button className={`tab-btn ${condTab === 'active' ? 'active' : ''}`} onClick={() => setCondTab('active')}>Active</button>
                        <button className={`tab-btn ${condTab === 'negative' ? 'active' : ''}`} onClick={() => setCondTab('negative')}>Negative</button>
                        <button className={`tab-btn ${condTab === 'positive' ? 'active' : ''}`} onClick={() => setCondTab('positive')}>Positive</button>
                        <button className={`tab-btn ${condTab === 'visibility' ? 'active' : ''}`} onClick={() => setCondTab('visibility')}>Visibility</button>
                    </div>
                    <div style={{ maxHeight: '50vh', overflowY: 'auto' }}>
                        {listToRender.length === 0 && <div style={{ padding: 10, color: '#666' }}>No conditions found.</div>}
                        {listToRender.map(condName => {
                            const active = character.conditions.find(c => c.name === condName);
                            const level = active ? active.level : 0;
                            const iconSrc = getConditionImgSrc(condName);
                            return (
                                <div key={condName} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px', borderBottom: '1px solid #333' }}>
                                    <button
                                        type="button"
                                        onClick={() => { setModalData(condName); setModalMode('conditionInfo'); }}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 8,
                                            background: 'transparent',
                                            border: 'none',
                                            color: 'inherit',
                                            padding: 0,
                                            cursor: 'pointer',
                                            font: 'inherit',
                                            textAlign: 'left'
                                        }}
                                        title="View description"
                                    >
                                        {iconSrc ? (
                                            <img src={iconSrc} alt="" style={{ width: 20, height: 20, objectFit: 'contain' }} />
                                        ) : (
                                            <span style={{ width: 20, display: 'inline-flex', justifyContent: 'center' }}>{getConditionIcon(condName) || "⚪"}</span>
                                        )}
                                        <span>{condName}</span>
                                    </button>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                        <button className="qty-btn" style={{ width: 30, height: 30, fontSize: '1em' }} onClick={() => adjustCondition(condName, -1)}>-</button>
                                        <span style={{ width: 20, textAlign: 'center', fontWeight: 'bold' }}>{level}</span>
                                        <button className="qty-btn" style={{ width: 30, height: 30, fontSize: '1em' }} onClick={() => adjustCondition(condName, 1)}>+</button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </>
            );
        } else if (modalMode === 'edit_attribute') {
            const key = modalData.item.key;
            const val = character.stats.attributes[key];
            const label = modalData.item.label;
            content = (
                <>
                    <h2>Edit {label}</h2>
                    <div className="qty-control-box">
                        <button className="qty-btn" onClick={() => updateCharacter(c => c.stats.attributes[key] = (c.stats.attributes[key] || 0) - 1)}>-</button>
                        <span style={{ fontSize: '2em', width: 60, textAlign: 'center' }}>{val >= 0 ? `+${val}` : val}</span>
                        <button className="qty-btn" onClick={() => updateCharacter(c => c.stats.attributes[key] = (c.stats.attributes[key] || 0) + 1)}>+</button>
                    </div>
                </>
            );
        } else if (modalMode === 'edit_proficiency') {
            const isSkill = modalData.type === 'skill';
            const isClassDC = modalData.type === 'class_dc';
            const key = isSkill ? modalData.item.key : 'class_dc'; // For Class DC we might need direct access or store it in stats? 
            // Wait, Class DC structure in new_db.json: "stats": { "class_dc": 19, ... } -> It's a calculated value or specific?
            // Actually, Class DC is usually derived from Key Ability + Proficiency + Level + 10.
            // But my DB has a specific value. If I want to edit proficiency I need to know WHERE it is stored.
            // Inspecting `new_db.json`:
            // "stats": { "class_dc": 19 } -> It seems to be a raw number in this DB version? 
            // OR is it calculated? 
            // IF it is raw, I can just edit the number. IF it is calculated, I need to edit the 'proficiency' field.
            // The user request says "Change Class DC".
            // Let's assume for now we edit the RAW value for Class DC if no proficiency structure exists, OR if we find "proficiencies" object we use that.
            // Skills are in `character.skills`.

            const currentVal = isSkill ? character.skills[key] : character.stats.class_dc;

            // If it's a skill, values are 0,2,4,6,8 usually.

            content = (
                <>
                    <h2>Edit {modalData?.item?.name || "Proficiency"}</h2>
                    {isSkill ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {ARMOR_RANKS.map(r => (
                                <button key={r.value} className="btn-add-condition" style={{
                                    borderColor: currentVal === r.value ? 'var(--text-gold)' : '#555',
                                    color: currentVal === r.value ? 'var(--text-gold)' : '#ccc'
                                }} onClick={() => {
                                    updateCharacter(c => c.skills[key] = r.value);
                                    setModalMode(null);
                                }}>
                                    {r.label}
                                </button>
                            ))}
                        </div>
                    ) : (
                        // Class DC might just be a number edit if no prof structure
                        <div className="qty-control-box">
                            <button className="qty-btn" onClick={() => updateCharacter(c => c.stats.class_dc = (c.stats.class_dc || 10) - 1)}>-</button>
                            <span style={{ fontSize: '2em', width: 60, textAlign: 'center' }}>{currentVal}</span>
                            <button className="qty-btn" onClick={() => updateCharacter(c => c.stats.class_dc = (c.stats.class_dc || 10) + 1)}>+</button>
                        </div>
                    )}
                </>
            );
        } else if (modalMode === 'edit_speed') {
            content = (
                <>
                    <h2>Edit Speed</h2>
                    {Object.entries(character.stats.speed).map(([k, v]) => (
                        <div key={k} className="modal-form-group">
                            <label style={{ textTransform: 'capitalize' }}>{k}</label>
                            <div className="qty-control-box">
                                <button className="qty-btn" onClick={() => updateCharacter(c => c.stats.speed[k] = Math.max(0, (c.stats.speed[k] || 0) - 5))}>-5</button>
                                <span style={{ fontSize: '1.5em', width: 60, textAlign: 'center' }}>{v}</span>
                                <button className="qty-btn" onClick={() => updateCharacter(c => c.stats.speed[k] = (c.stats.speed[k] || 0) + 5)}>+5</button>
                            </div>
                        </div>
                    ))}
                </>
            );
        } else if (modalMode === 'edit_languages') {
            const [langs, setLangs] = useState(character.languages.join(', '));
            content = (
                <>
                    <h2>Edit Languages</h2>
                    <textarea
                        className="modal-input"
                        style={{ height: 150 }}
                        value={langs}
                        onChange={e => setLangs(e.target.value)}
                    />
                    <button className="set-btn" onClick={() => {
                        updateCharacter(c => c.languages = langs.split(',').map(s => s.trim()).filter(Boolean));
                        setModalMode(null);
                    }}>Save</button>
                </>
            );
        } else if (modalMode === 'edit_armor_prof') {
            const ARMOR_PROF_KEYS = ['Unarmored', 'Light', 'Medium', 'Heavy'];
            const ARMOR_RANKS = [
                { value: 0, label: 'Untrained (+0)' },
                { value: 2, label: 'Trained (+2)' },
                { value: 4, label: 'Expert (+4)' },
                { value: 6, label: 'Master (+6)' },
                { value: 8, label: 'Legendary (+8)' }
            ];
            content = (
                <>
                    <h2>Armor Proficiencies</h2>
                    <div className="prof-list" style={{ marginTop: 20 }}>
                        {ARMOR_PROF_KEYS.map(key => {
                            const rawVal = character?.stats?.proficiencies?.[key.toLowerCase()] || 0;
                            return (
                                <div className="prof-row" key={key}>
                                    <span className="prof-label">{key}</span>
                                    <select
                                        className="prof-select"
                                        value={rawVal}
                                        onChange={(e) => updateCharacter(c => {
                                            if (!c.stats) c.stats = {};
                                            if (!c.stats.proficiencies) c.stats.proficiencies = {};
                                            c.stats.proficiencies[key.toLowerCase()] = parseInt(e.target.value);
                                        })}
                                    >
                                        {ARMOR_RANKS.map(r => (
                                            <option key={r.value} value={r.value}>{r.label}</option>
                                        ))}
                                    </select>
                                </div>
                            );
                        })}
                    </div>
                </>
            );
        } else if (modalMode === 'edit_max_hp') {
            content = (
                <>
                    <h2>Edit Max HP</h2>
                    <div className="qty-control-box">
                        <button className="qty-btn" onClick={() => updateCharacter(c => c.stats.hp.max = Math.max(1, (c.stats.hp.max || 10) - 1))}>-</button>
                        <span style={{ fontSize: '2em', width: 80, textAlign: 'center' }}>{character.stats.hp.max}</span>
                        <button className="qty-btn" onClick={() => updateCharacter(c => c.stats.hp.max = (c.stats.hp.max || 10) + 1)}>+</button>
                    </div>
                </>
            );
        } else if (modalMode === 'edit_level') {
            content = (
                <>
                    <h2>Edit Level</h2>
                    <div className="qty-control-box">
                        <button className="qty-btn" onClick={() => updateCharacter(c => c.level = Math.max(1, (c.level || 1) - 1))}>-</button>
                        <span style={{ fontSize: '2em', width: 60, textAlign: 'center' }}>{character.level}</span>
                        <button className="qty-btn" onClick={() => updateCharacter(c => c.level = (c.level || 1) + 1)}>+</button>
                    </div>
                </>
            );

        } else if (modalMode === 'spell_stat_info') {
            const magic = character.magic || {};
            const attrName = magic.attribute || "Intelligence";
            const attrMod = parseInt(character.stats.attributes[(attrName || "").toLowerCase()]) || 0;
            const prof = parseFloat(magic.proficiency) || 0;
            const level = parseInt(character.level) || 0;
            const rankLabel = ARMOR_RANKS.find(r => r.value === prof)?.label.split(' ')[0] || 'Untrained';

            const atkBonus = Math.floor(attrMod + prof + (prof > 0 ? level : 0));
            const dcVal = 10 + atkBonus;

            content = (
                <>
                    <h2>Spell Statistics</h2>
                    <div style={{ textAlign: 'center', marginBottom: 20 }}>
                        <div style={{ fontSize: '2em', color: 'var(--text-gold)', fontWeight: 'bold' }}>DC {dcVal}</div>
                        <div style={{ fontSize: '1.5em', color: '#aaa' }}>Attack {atkBonus >= 0 ? '+' : ''}{atkBonus}</div>
                    </div>
                    <div style={{ background: '#222', padding: 15, borderRadius: 8, fontSize: '0.9em' }}>
                        <div style={{ marginBottom: 10 }}><strong>Calculation:</strong></div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                            <span>Base</span>
                            <span>10</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                            <span>Attribute ({attrName})</span>
                            <span>{attrMod >= 0 ? '+' : ''}{attrMod}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                            <span>Proficiency ({rankLabel})</span>
                            <span>{prof >= 0 ? '+' : ''}{prof}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #444', paddingTop: 5 }}>
                            <span>Level (if trained)</span>
                            <span>{prof > 0 ? `+${level}` : '0'}</span>
                        </div>
                    </div>
                </>
            );
        } else if (modalMode === 'edit_spell_proficiency') {
            const magic = character.magic || {};
            const currentAttr = magic.attribute || "Intelligence";
            const currentProf = magic.proficiency || 0;

            content = (
                <>
                    <h2>Edit Spell Proficiency</h2>
                    <div style={{ marginBottom: 20 }}>
                        <label style={{ display: 'block', marginBottom: 5, color: '#aaa' }}>Key Attribute</label>
                        <select
                            className="prof-select"
                            value={currentAttr}
                            onChange={(e) => updateCharacter(c => {
                                if (!c.magic) c.magic = {};
                                c.magic.attribute = e.target.value;
                            })}
                        >
                            {['Strength', 'Dexterity', 'Constitution', 'Intelligence', 'Wisdom', 'Charisma'].map(attr => (
                                <option key={attr} value={attr}>{attr}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: 5, color: '#aaa' }}>Proficiency Rank</label>
                        <select
                            className="prof-select"
                            value={currentProf}
                            onChange={(e) => updateCharacter(c => {
                                if (!c.magic) c.magic = {};
                                c.magic.proficiency = parseInt(e.target.value);
                            })}
                        >
                            {ARMOR_RANKS.map(r => (
                                <option key={r.value} value={r.value}>{r.label}</option>
                            ))}
                        </select>
                    </div>
                </>
            );
        } else if (modalMode === 'edit_spell_slots') {
            const item = modalData?.item || {};
            const levelKey = item.level || '1';
            const slotKey = levelKey + "_max";

            const SLOT_LEVELS = ['f', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];

            content = (
                <>
                    <h2>Edit Spell Slots</h2>
                    <div style={{ marginBottom: 20 }}>
                        <label style={{ display: 'block', marginBottom: 5, color: '#aaa' }}>Slot Level</label>
                        <select
                            className="prof-select"
                            value={levelKey}
                            onChange={(e) => setModalData({
                                ...modalData,
                                item: { ...item, level: e.target.value }
                            })}
                        >
                            <option value="f">Focus Points</option>
                            {SLOT_LEVELS.filter(l => l !== 'f').map(l => (
                                <option key={l} value={l}>Level {l}</option>
                            ))}
                        </select>
                    </div>

                    <div className="qty-control-box">
                        <button className="qty-btn" onClick={() => updateCharacter(c => {
                            if (!c.magic) c.magic = { slots: {} };
                            if (!c.magic.slots) c.magic.slots = {};
                            const cur = c.magic.slots[slotKey] || 0;
                            c.magic.slots[slotKey] = Math.max(0, cur - 1);
                        })}>-</button>
                        <span style={{ fontSize: '2em', width: 60, textAlign: 'center' }}>
                            {character?.magic?.slots?.[slotKey] || 0}
                        </span>
                        <button className="qty-btn" onClick={() => updateCharacter(c => {
                            if (!c.magic) c.magic = { slots: {} };
                            if (!c.magic.slots) c.magic.slots = {};
                            const cur = c.magic.slots[slotKey] || 0;
                            c.magic.slots[slotKey] = cur + 1;
                        })}>+</button>
                    </div>
                </>
            );
        } else if (modalMode === 'conditionInfo') {
            const condName = typeof modalData === 'string' ? modalData : modalData?.name;
            const entry = getConditionCatalogEntry(condName);
            const iconSrc = getConditionImgSrc(condName);
            const active = character.conditions.find(c => c.name === condName);
            const level = active ? active.level : 0;
            const valued = isConditionValued(condName);

            const adjustCondition = (delta) => {
                if (!condName) return;
                updateCharacter(c => {
                    const idx = c.conditions.findIndex(x => x.name === condName);
                    if (!valued) {
                        if (delta > 0) {
                            if (idx > -1) c.conditions[idx].level = 1;
                            else c.conditions.push({ name: condName, level: 1 });
                        } else if (idx > -1) {
                            c.conditions.splice(idx, 1);
                        }
                        return;
                    }

                    if (delta > 0) {
                        if (idx > -1) c.conditions[idx].level = (c.conditions[idx].level || 0) + 1;
                        else c.conditions.push({ name: condName, level: 1 });
                    } else if (idx > -1) {
                        const nextLevel = (c.conditions[idx].level || 0) - 1;
                        if (nextLevel <= 0) c.conditions.splice(idx, 1);
                        else c.conditions[idx].level = nextLevel;
                    }
                });
            };

            content = (
                <>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                        <button
                            type="button"
                            className="set-btn"
                            style={{
                                width: 'auto', padding: '8px 12px', marginTop: 0,
                                ...(modalHistory.length > 0 ? { background: '#c5a059', color: '#1a1a1d', borderColor: '#c5a059' } : {})
                            }}
                            onClick={(e) => {
                                if (modalHistory.length > 0) {
                                    e.stopPropagation();
                                    handleBack();
                                } else {
                                    setModalMode('condition');
                                    setModalData(null);
                                }
                            }}
                        >
                            ← Back
                        </button>
                        <h2 style={{ margin: 0, flex: 1, textAlign: 'center' }}>{condName}</h2>
                        <div style={{ width: 72 }} />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, marginTop: 12 }}>
                        {iconSrc ? (
                            <img src={iconSrc} alt="" style={{ width: 36, height: 36, objectFit: 'contain' }} />
                        ) : (
                            <span style={{ fontSize: '1.8em' }}>{getConditionIcon(condName) || "⚪"}</span>
                        )}

                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <button onClick={() => adjustCondition(-1)}>-</button>
                            <span style={{ minWidth: 24, textAlign: 'center' }}>{level}</span>
                            <button onClick={() => adjustCondition(1)}>+</button>
                        </div>
                    </div>

                    <div
                        className="formatted-content"
                        dangerouslySetInnerHTML={{ __html: formatText(entry?.description || "No description.") }}
                        style={{ marginTop: 12 }}
                    />
                </>
            );
        } else if (modalMode === 'edit_perception') {
            const currentVal = character.stats.perception || 0;
            content = (
                <>
                    <h2>Edit Perception</h2>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {ARMOR_RANKS.map(r => (
                            <button key={r.value} className="btn-add-condition" style={{
                                borderColor: currentVal === r.value ? 'var(--text-gold)' : '#555',
                                color: currentVal === r.value ? 'var(--text-gold)' : '#ccc'
                            }} onClick={() => {
                                updateCharacter(c => c.stats.perception = r.value);
                                setModalMode(null);
                            }}>
                                {r.label}
                            </button>
                        ))}
                    </div>
                </>
            );
        } else if (modalMode === 'formula_book') {
            const formulas = character.formulaBook || [];

            // Daily Crafting Logic
            const hasMunitionsCrafter = (character.feats || []).includes("Munitions Crafter");
            const hasAdvAlchemy = character.classes?.some(c => c.name.toLowerCase() === 'alchemist') || (character.feats || []).includes("Advanced Alchemy");
            const canDailyCraft = hasMunitionsCrafter || hasAdvAlchemy;

            // Max Batches (Stored in character or default)
            // Default: Alchemist = Level + Int? actually rules say 4 + Int usually, or just batches.
            // We follow user request: "make this maximum a value in the character sheet"
            // If undefined, default to 0 for now so they notice they need to set it, or maybe 4?
            // Let's rely on stored value `character.dailyCraftingMax`.
            const maxBatches = character.dailyCraftingMax || 5;
            const currentBatches = dailyPrepQueue.reduce((acc, i) => acc + (i.batches || 1), 0);

            content = (
                <>
                    <h2>Formula Book ({formulas.length})</h2>
                    {formulas.length === 0 && <div style={{ color: '#888', fontStyle: 'italic' }}>No known formulas. Buy them effectively from the shop.</div>}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 15, maxHeight: '40vh', overflowY: 'auto' }}>
                        {formulas.map(fName => {
                            const item = getShopIndexItemByName(fName) || { name: fName };
                            // Check if craftable via daily prep (Consumable? Alchemical?)
                            // Munitions Crafter: Alchemical Bombs/Ammu level <= level.
                            // Adv Alchemy: Alchemical Consumables level <= level.
                            // For simplicity, we enable "Prepare" for all if they have the feature, relying on user honesty/game rules, 
                            // OR we check traits if possible. Let's start with basic enabled.

                            return (
                                <div key={fName}
                                    style={{ background: '#333', padding: 8, borderRadius: 4, display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
                                    onClick={() => { setModalData(item); setModalMode('item'); }}
                                >
                                    {item.img ? (
                                        <img src={`ressources/${item.img}`} style={{ width: 32, height: 32, objectFit: 'contain' }} alt="" />
                                    ) : (
                                        <div style={{ width: 32, height: 32, background: '#444', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2em' }}>📜</div>
                                    )}
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: 'bold' }}>{item.name}</div>
                                        <div style={{ fontSize: '0.8em', color: '#aaa' }}>Level {item.level || '?'} • {item.price || '?'} gp</div>
                                    </div>

                                    {/* Prepare Button */}
                                    {canDailyCraft && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                const isAmmo = (item.type || '').toLowerCase() === 'ammunition' ||
                                                    (item.group || '').toLowerCase() === 'ammunition' ||
                                                    /arrow|bolt|round|cartridge|shot/i.test(item.name);
                                                const batchSize = isAmmo ? 4 : 1;

                                                // Add to queue logic
                                                setDailyPrepQueue(prev => {
                                                    const existing = prev.find(p => p.name === item.name);
                                                    if (existing) {
                                                        return prev.map(p => p.name === item.name ? { ...p, batches: p.batches + 1 } : p);
                                                    }
                                                    return [...prev, { ...item, batches: 1, batchSize }];
                                                });
                                            }}
                                            style={{
                                                background: '#673ab7',
                                                border: 'none',
                                                borderRadius: 4,
                                                padding: '4px 10px',
                                                cursor: 'pointer',
                                                color: '#fff',
                                                fontSize: '0.9em',
                                                display: 'flex', alignItems: 'center', gap: 5
                                            }}
                                            title="Prepare Batch (Use Daily Crafting)"
                                        >
                                            <span style={{ fontSize: '1.1em' }}>⚡</span>
                                            Prep +{((item.type || '').toLowerCase() === 'ammunition' || (item.group || '').toLowerCase() === 'ammunition' || /arrow|bolt|round|cartridge|shot/i.test(item.name)) ? 4 : 1}
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* Daily Preparation Section */}
                    {canDailyCraft && (
                        <div style={{ marginTop: 20, borderTop: '2px dashed #555', paddingTop: 15 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                                <h3 style={{ margin: 0, color: '#b39ddb' }}>Daily Preparation</h3>
                                <div
                                    style={{ background: '#222', padding: '4px 8px', borderRadius: 4, fontSize: '0.9em', cursor: 'pointer' }}
                                    onClick={() => {
                                        const newMax = prompt("Set Maximum Batches:", maxBatches);
                                        if (newMax !== null && !isNaN(newMax)) {
                                            updateCharacter(c => c.dailyCraftingMax = parseInt(newMax));
                                        }
                                    }}
                                    title="Click to edit Max Batches"
                                >
                                    <span style={{ color: currentBatches > maxBatches ? '#ff5252' : '#fff', fontWeight: 'bold' }}>{currentBatches}</span>
                                    <span style={{ color: '#888' }}> / {maxBatches} Batches</span>
                                </div>
                            </div>

                            {dailyPrepQueue.length === 0 ? (
                                <div style={{ color: '#666', fontStyle: 'italic', textAlign: 'center', padding: 10 }}>
                                    No items queued. Click "Prep" on formulas above.
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                                    {dailyPrepQueue.map((qItem, idx) => (
                                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#30204a', padding: '5px 8px', borderRadius: 4 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                {qItem.img && <img src={`ressources/${qItem.img}`} style={{ width: 24, height: 24 }} alt="" />}
                                                <div>
                                                    <div style={{ fontSize: '0.95em' }}>{qItem.name}</div>
                                                    <div style={{ fontSize: '0.75em', color: '#bbb' }}>{qItem.batches} batch(es) x {qItem.batchSize || 1} = <span style={{ color: '#fff' }}>{qItem.batches * (qItem.batchSize || 1)} items</span></div>
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', gap: 5 }}>
                                                <button
                                                    onClick={() => setDailyPrepQueue(prev => {
                                                        const p = prev[idx];
                                                        if (p.batches > 1) return prev.map((item, i) => i === idx ? { ...item, batches: item.batches - 1 } : item);
                                                        return prev.filter((_, i) => i !== idx);
                                                    })}
                                                    style={{ background: '#ff5252', border: 'none', color: '#fff', borderRadius: 3, width: 24, height: 24, cursor: 'pointer' }}
                                                >
                                                    -
                                                </button>
                                            </div>
                                        </div>
                                    ))}

                                    <button
                                        className="btn-buy"
                                        style={{ marginTop: 10, background: '#673ab7', width: '100%' }}
                                        onClick={() => {
                                            if (confirm(`Create ${currentBatches} batches of items?`)) {
                                                updateCharacter(c => {
                                                    dailyPrepQueue.forEach(qItem => {
                                                        const totalQty = qItem.batches * (qItem.batchSize || 1);
                                                        // Check for existing PREPARED stack? Usually separate.
                                                        // We just push new stack marked as prepared.
                                                        c.inventory.push({
                                                            ...qItem,
                                                            qty: totalQty,
                                                            prepared: true,
                                                            addedAt: Date.now()
                                                        });
                                                    });
                                                });
                                                setDailyPrepQueue([]);
                                                alert("Daily preparation complete! Items added to inventory.");
                                                setModalMode(null);
                                            }
                                        }}
                                    >
                                        Finish Preparation
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </>
            );
        } else if (modalMode === 'weapon_detail' && modalData) {
            console.log("Rendering Weapon Detail Modal (Distinct)", modalData);
            content = (
                <>
                    <h2>{modalData.title}</h2>
                    <div style={{ fontSize: '2em', textAlign: 'center', color: 'var(--text-gold)', margin: '10px 0' }}>
                        {modalData.total >= 0 ? '+' : ''}{modalData.total}
                    </div>
                    {/* DEBUG DATA ON SCREEN */}
                    <div style={{ fontSize: '0.7em', color: 'orange', background: '#333', padding: 5, marginBottom: 10, wordBreak: 'break-all' }}>
                        DEBUG: {JSON.stringify(modalData.breakdown)}
                    </div>

                    {modalData.breakdown && typeof modalData.breakdown === 'object' ? (
                        <div style={{ background: '#222', padding: 15, borderRadius: 8, fontSize: '0.9em' }}>
                            <div style={{ marginBottom: 10, color: '#aaa', textTransform: 'uppercase', fontSize: '0.8em', letterSpacing: 1 }}>Calculation</div>

                            {/* Attribute */}
                            {modalData.breakdown.attribute !== undefined && (
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                                    <span>Attribute {modalData.source?.attrName ? `(${modalData.source.attrName})` : ''}</span>
                                    <span>{modalData.breakdown.attribute >= 0 ? '+' : ''}{modalData.breakdown.attribute}</span>
                                </div>
                            )}

                            {/* Proficiency */}
                            {modalData.breakdown.proficiency !== undefined && (
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                                    <span>Proficiency {modalData.source?.profName ? `(${modalData.source.profName})` : ''}</span>
                                    <span>{modalData.breakdown.proficiency >= 0 ? '+' : ''}{modalData.breakdown.proficiency}</span>
                                </div>
                            )}

                            {/* Level */}
                            {modalData.breakdown.level !== undefined && (
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                                    <span>Level {modalData.source?.levelVal ? `(${modalData.source.levelVal})` : ''}</span>
                                    <span>{modalData.breakdown.level >= 0 ? '+' : ''}{modalData.breakdown.level}</span>
                                </div>
                            )}

                            {/* Item */}
                            {modalData.breakdown.item !== undefined && modalData.breakdown.item !== 0 && (
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, color: 'var(--text-gold)' }}>
                                    <span>Item Bonus</span>
                                    <span>{modalData.breakdown.item >= 0 ? '+' : ''}{modalData.breakdown.item}</span>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6', color: '#ccc' }}>
                            {modalData.breakdown}
                        </div>
                    )}
                </>
            );
        } else if (modalMode === 'detail' && modalData) {
            console.log("Rendering Detail/Weapon Modal", modalMode, modalData);
            content = (
                <>
                    <h2>{modalData.title}</h2>
                    <div style={{ fontSize: '2em', textAlign: 'center', color: 'var(--text-gold)', margin: '10px 0' }}>
                        {modalData.total >= 0 ? '+' : ''}{modalData.total}
                    </div>
                    {/* DEBUG DATA ON SCREEN */}
                    <div style={{ fontSize: '0.7em', color: 'orange', background: '#333', padding: 5, marginBottom: 10, wordBreak: 'break-all' }}>
                        DEBUG: {JSON.stringify(modalData.breakdown)}
                    </div>

                    {/* Explicit check for object type and existence of breakdown */}
                    {modalData.breakdown && typeof modalData.breakdown === 'object' ? (
                        <div style={{ background: '#222', padding: 15, borderRadius: 8, fontSize: '0.9em' }}>
                            <div style={{ marginBottom: 10, color: '#aaa', textTransform: 'uppercase', fontSize: '0.8em', letterSpacing: 1 }}>Calculation</div>

                            {/* Base 10 if applicable */}
                            {modalData.base === 10 && (
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                                    <span>Base</span>
                                    <span>10</span>
                                </div>
                            )}

                            {/* Attribute */}
                            {modalData.breakdown.attribute !== undefined && (
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                                    <span>Attribute {modalData.source?.attrName ? `(${modalData.source.attrName})` : ''}</span>
                                    <span>{modalData.breakdown.attribute >= 0 ? '+' : ''}{modalData.breakdown.attribute}</span>
                                </div>
                            )}

                            {/* Proficiency */}
                            {modalData.breakdown.proficiency !== undefined && (
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                                    <span>Proficiency {modalData.source?.profName ? `(${modalData.source.profName})` : ''}</span>
                                    <span>{modalData.breakdown.proficiency >= 0 ? '+' : ''}{modalData.breakdown.proficiency}</span>
                                </div>
                            )}

                            {/* Level */}
                            {modalData.breakdown.level !== undefined && (
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                                    <span>Level {modalData.source?.levelVal ? `(${modalData.source.levelVal})` : ''}</span>
                                    <span>{modalData.breakdown.level >= 0 ? '+' : ''}{modalData.breakdown.level}</span>
                                </div>
                            )}

                            {/* Item */}
                            {modalData.breakdown.item !== undefined && modalData.breakdown.item !== 0 && (
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, color: 'var(--text-gold)' }}>
                                    <span>Item Bonus</span>
                                    <span>{modalData.breakdown.item >= 0 ? '+' : ''}{modalData.breakdown.item}</span>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6', color: '#ccc' }}>
                            {modalData.breakdown}
                        </div>
                    )}
                </>
            );
        } else if (modalMode === 'item' && modalData) {
            const isSpell = modalData._entityType === 'spell' || (typeof modalData.casttime === 'string' && typeof modalData.tradition === 'string');
            const isAction = modalData._entityType === 'action' || (typeof modalData.subtype === 'string' && typeof modalData.type === 'string');

            // Explicit check first
            const isFeatFromCatalog = modalData._entityType === 'feat';

            const matchesShopItemProps = (
                modalData.price != null ||
                modalData.bulk != null ||
                modalData.rarity != null ||
                modalData.traits?.rarity != null ||
                Array.isArray(modalData?.traits?.value)
            );

            // If it identifies as a feat explicitly, it's not a shop item
            const isShopItem = !isSpell && !isAction && !isFeatFromCatalog && matchesShopItemProps;

            // Final feat check (explicit or fallback)
            const isFeat = isFeatFromCatalog || (!isShopItem && !isSpell && !isAction && typeof modalData.type === 'string');

            const titleText = modalData.name || modalData.title || 'Details';

            const itemTraits = Array.isArray(modalData?.traits?.value) ? modalData.traits.value : (Array.isArray(modalData.traits) ? modalData.traits : []);
            const rarity = modalData.rarity || modalData?.traits?.rarity || null;

            const bulk = modalData.bulk?.value ?? modalData.bulk;
            const damage = modalData.damage
                ? (typeof modalData.damage === 'string'
                    ? modalData.damage
                    : `${modalData.damage.dice}${modalData.damage.die} ${modalData.damage.damageType}`)
                : null;

            // Action specific data
            const actionCost = modalData.actionCost ? (modalData.actionType === 'reaction' ? 'Reaction' : modalData.actionType === 'free' ? 'Free Action' : modalData.actionType === 'passive' ? 'Passive' : `${modalData.actionCost} Action${modalData.actionCost > 1 ? 's' : ''}`) : null;

            const meta = [];
            if (isShopItem) {
                if (modalData.price != null) meta.push(['Price', `${modalData.price} gp`]);
                if (modalData.level != null) meta.push(['Level', modalData.level]);
                if (bulk != null) meta.push(['Bulk', bulk]);
                if (damage) meta.push(['Damage', damage]);
                if (modalData.range != null) meta.push(['Range', modalData.range]);
            } else if (isSpell) {
                if (modalData.level != null) meta.push(['Level', modalData.level]);
                if (modalData.tradition) meta.push(['Tradition', modalData.tradition]);
                if (modalData.casttime) meta.push(['Cast', modalData.casttime]);
                if (modalData.range) meta.push(['Range', modalData.range]);
                if (modalData.target) meta.push(['Target', modalData.target]);
                if (modalData.tags) meta.push(['Tags', modalData.tags]);
            } else if (isAction) {
                if (modalData.type) meta.push(['Type', modalData.type]);
                if (modalData.subtype) meta.push(['Subtype', modalData.subtype]);
                if (actionCost) meta.push(['Cost', actionCost]);
                if (modalData.category) meta.push(['Category', modalData.category]);
                if (modalData.skill) meta.push(['Skill', modalData.skill]);
                if (modalData.feat) meta.push(['Feat', modalData.feat]);
            } else if (isFeat) {
                if (modalData.type) meta.push(['Type', modalData.type]);
            }

            const tagBadges = typeof modalData.tags === 'string'
                ? modalData.tags.split(',').map(t => t.trim()).filter(Boolean)
                : [];

            const expectedSourceFile =
                modalData.sourceFile ||
                (modalData?.name ? getShopIndexItemByName(modalData.name)?.sourceFile : null);
            const isLoadingShopDetail = Boolean(isShopItem && expectedSourceFile && shopItemDetailLoading && !modalData.description);
            const shopDetailError = isShopItem && expectedSourceFile && shopItemDetailError ? shopItemDetailError : null;

            // Fix: Prioritize matching the specific equipped/unequipped state of the viewed item
            let inventoryMatch = isShopItem && modalData?.name
                ? character.inventory.find(i => i.name === modalData.name && !!i.equipped === !!modalData.equipped)
                : null;

            // Fallback: If exact state match fails (e.g. status changed), find any instance
            if (!inventoryMatch && isShopItem && modalData?.name) {
                inventoryMatch = character.inventory.find(i => i.name === modalData.name);
            }

            const canToggleEquip = Boolean(inventoryMatch && isEquipableInventoryItem(inventoryMatch));
            const isEquipped = Boolean(inventoryMatch?.equipped);

            const equipButton = canToggleEquip ? (
                <button
                    type="button"
                    onClick={() => toggleInventoryEquipped(inventoryMatch)}
                    style={{
                        background: 'var(--bg-dark)',
                        color: 'var(--text-gold)',
                        border: '1px solid var(--text-gold)',
                        borderRadius: 6,
                        padding: '6px 10px',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                        fontWeight: 'bold',
                        textTransform: 'uppercase',
                        fontSize: '0.75em',
                        whiteSpace: 'nowrap'
                    }}
                    title={isEquipped ? 'Unequip item' : 'Equip item'}
                >
                    {isEquipped ? 'Unequip' : 'Equip'}
                </button>
            ) : null;

            content = (
                <>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                        <h2 style={{ margin: 0, flex: 1 }} dangerouslySetInnerHTML={{ __html: formatText(String(titleText)) }} />
                        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                            {modalHistory.length > 0 && (
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleBack(); }}
                                    style={{
                                        background: '#c5a059', border: 'none', borderRadius: 4,
                                        padding: '6px 12px', cursor: 'pointer', fontWeight: 'bold', color: '#1a1a1d',
                                        fontSize: '0.8em', whiteSpace: 'nowrap', textTransform: 'uppercase'
                                    }}
                                >
                                    Back
                                </button>
                            )}
                            {equipButton}
                        </div>
                    </div>

                    {(isShopItem || isSpell || isAction || isFeat) && (
                        <div style={{ marginBottom: 10 }}>
                            {isShopItem && rarity && rarity !== 'common' && (
                                <span className="trait-badge" style={{ borderColor: 'var(--text-gold)', color: 'var(--text-gold)' }}>
                                    {rarity}
                                </span>
                            )}
                            {isShopItem && itemTraits.map(t => <span key={t} className="trait-badge">{t}</span>)}
                            {isSpell && modalData.tradition && <span className="trait-badge">{modalData.tradition}</span>}
                            {isSpell && tagBadges.map(t => <span key={t} className="trait-badge">{t}</span>)}
                            {isAction && itemTraits.map(t => <span key={t} className="trait-badge">{t}</span>)}
                            {isFeat && itemTraits.map(t => <span key={t} className="trait-badge">{t}</span>)}
                        </div>
                    )}

                    {meta.length > 0 && (
                        <div className="item-meta-row">
                            {meta.map(([label, value], idx) => (
                                <div key={`${label}-${idx}`}><strong>{label}:</strong> {value}</div>
                            ))}
                        </div>
                    )}

                    <div
                        className="formatted-content"
                        dangerouslySetInnerHTML={{
                            __html: formatText(
                                modalData.description ||
                                (isLoadingShopDetail ? 'Loading item details…' : shopDetailError ? `Failed to load item details: ${shopDetailError}` : 'No description.')
                            )
                        }}
                    />

                    {/* Blood Magic Display */}
                    {isSpell && modalData.Bloodmagic && (
                        <div style={{ marginTop: 20, borderTop: '1px solid #444', paddingTop: 10 }}>
                            <h3 style={{ color: '#8B0000', margin: '0 0 5px 0', fontFamily: 'Cinzel, serif' }}>Blood Magic</h3>

                            {!character.magic?.bloodmagic ? (
                                <div style={{ color: '#aaa', fontStyle: 'italic' }}>
                                    (Character has no active Blood Magic)
                                </div>
                            ) : !bloodMagicEffects.Effects[character.magic.bloodmagic] ? (
                                <div style={{ color: 'orange' }}>
                                    Effect "{character.magic.bloodmagic}" not found in library.
                                    (Available: {Object.keys(bloodMagicEffects.Effects || {}).join(', ')})
                                </div>
                            ) : (
                                <>
                                    <strong style={{ color: '#D22B2B', display: 'block', marginBottom: 5 }}>
                                        {character.magic.bloodmagic}
                                    </strong>
                                    <div
                                        className="formatted-content"
                                        dangerouslySetInnerHTML={{ __html: formatText(bloodMagicEffects.Effects[character.magic.bloodmagic].description || "") }}
                                    />
                                </>
                            )}
                        </div>
                    )}
                </>
            );
        }

        return (
            <div style={{
                position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 1000,
                display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 20
            }} onClick={close}>
                <div style={{
                    backgroundColor: '#2b2b2e', border: '2px solid #c5a059',
                    padding: '20px', borderRadius: '8px', maxWidth: '500px', width: '100%',
                    color: '#e0e0e0',
                    maxHeight: '85vh',
                    overflowY: 'auto',
                    display: 'flex',
                    flexDirection: 'column'
                }} onClick={e => { e.stopPropagation(); handleContentLinkClick(e); }}>
                    <style>{`
                        .formatted-content p { margin: 0.5em 0; }
                        .formatted-content ul, .formatted-content ol { margin: 0.5em 0; padding-left: 20px; }
                        .formatted-content { line-height: 1.6; }
                        .content-link { transition: opacity 0.2s; }
                        .gold-link { color: var(--text-gold); cursor: pointer; text-decoration: none; }
                        .gold-link:hover { text-decoration: underline; opacity: 1; }
                    `}</style>
                    {content}
                    <button onClick={close} style={{
                        marginTop: 20, width: '100%', padding: '10px', background: '#c5a059',
                        border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 'bold', color: '#1a1a1d',
                        flexShrink: 0
                    }}>Close</button>
                </div>
            </div>
        );
    };

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
            `}</style>
            <div className="header-bar">
                <div className="header-title">
                    <h1 {...pressEvents(null, 'level')}>{character.name}</h1>
                    <small>Level {character.level} | XP: {character.xp.current}</small>
                </div>
                <div className="header-controls">
                    <button className="btn-char-switch" onClick={() => {
                        setActiveCharIndex((prev) => (prev + 1) % db.characters.length);
                    }}>👥</button>
                    <div className="gold-display" onClick={() => setModalMode('gold')}>
                        <span>💰</span> {parseFloat(character.gold).toFixed(2)} <span className="gold-unit">gp</span>
                    </div>
                    <button className="btn-char-switch" onClick={() => window.location.search = '?admin=true'} title="GM Screen">GM</button>
                </div>
            </div>

            {/* TABS */}
            <div className="tabs">
                {['stats', 'actions', 'magic', 'feats', 'items'].map(tab => {
                    // Hide magic tab if character has no attribute set
                    // Hide magic tab if character has no attribute set
                    if (tab === 'magic') {
                        const magic = character.magic;
                        // Relaxed check: Only hide if BOTH attribute and proficiency are missing/null
                        const hasAttr = magic && magic.attribute;
                        const hasProf = magic && magic.proficiency;
                        if (!magic || (!hasAttr && !hasProf)) return null;
                    }
                    const hasLoot = tab === 'items' && db.lootBags?.some(b => !b.isLocked && b.items.some(i => !i.claimedBy));
                    return (
                        <button
                            key={tab}
                            className={`tab-btn ${activeTab === tab ? 'active' : ''}`}
                            onClick={() => setActiveTab(tab)}
                        >
                            {tab === 'magic' ? 'Magic' : tab.charAt(0).toUpperCase() + tab.slice(1)}
                            {hasLoot && <span style={{ color: '#d32f2f', marginLeft: 5, fontWeight: 'bold' }}>!</span>}
                        </button>
                    );
                })}
            </div>

            {/* VIEW CONTENT */}
            <div className="view-section">
                {activeTab === 'stats' && (
                    <>
                        {/* TOP SECTION: HP, Conditions, Defenses */}
                        {renderHealth()}
                        {renderConditions()}
                        {/* <div className="section-separator"></div> */}
                        {renderDefenses()}

                        <h3 style={{ borderBottom: '1px solid #5c4033', paddingBottom: 5, marginBottom: 15 }}>Attributes & Skills</h3>

                        {/* BOTTOM SECTION: Attributes & Skills */}
                        <div className="main-layout">
                            <div className="left-column">
                                {renderAttributes()}
                                {renderSpecialStats()}
                                {renderLanguages()}
                            </div>

                            <div className="right-column">
                                <div className="skills-container">
                                    {renderSkills()}
                                </div>
                            </div>
                        </div>
                    </>
                )}

                {activeTab === 'actions' && renderActions()}

                {activeTab === 'magic' && renderMagic()}

                {activeTab === 'feats' && renderFeats()}

                {activeTab === 'items' && (
                    <div>
                        {renderInventory()}
                    </div>
                )}

                {activeTab === 'shop' && (
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
                )}
            </div>

            {/* Item Actions Modal */}
            <ItemActionsModal
                mode={actionModal.mode}
                item={actionModal.item}
                db={db}
                activeCharIndex={activeCharIndex}
                onClose={() => setActionModal({ mode: null, item: null })}
                onOpenMode={(m, i) => setActionModal({ mode: m, item: i })}
                onBuy={executeBuy}
                onChangeQty={executeQty}
                onTransfer={executeTransfer}
                onUnstack={executeUnstack}
                onLoadSpecial={handleLoadSpecial}
                onUnloadAll={handleUnloadAll}
            />

            {/* Catalog Overlay */}
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

            {/* General Modals */}
            <EditModal />
        </div>
    );
}
