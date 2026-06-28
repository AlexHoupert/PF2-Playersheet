import { useEffect, useRef } from 'react';
import { getShopIndexItemByName } from '../../shared/catalog/shopIndex';
import { shouldStack } from '../../shared/utils/inventoryUtils';
import { getWeaponCapacity, isEquipableInventoryItem } from '../../shared/utils/combatUtils';
import { findInventoryItemIndex, findStackableInventoryItemIndex, resolveInventoryItemIdentity } from '../../shared/utils/itemIdentity';
import { consumeWandCharge, isWandItem, rechargeWand } from '../../shared/utils/wandUtils';
import { createMutagenEffectInput } from '../../utils/rules/mutagens';
import { useAppFeedback } from '../../shared/feedback/AppFeedback';

export function usePlayerInventoryActions({
    activeCampaign,
    activeCharIndex,
    character,
    characters,
    dataActions,
    runDataAction,
    setActionModal,
    setCatalogMode,
    setDailyPrepQueue,
    setModalData,
    setModalMode,
    updateCharacter,
}) {
    const { confirm, notifyError } = useAppFeedback();
    const tapRef = useRef({ id: null, time: 0 });
    const tapTimeout = useRef(null);
    const longPressTimer = useRef(null);

    useEffect(() => () => {
        if (tapTimeout.current) clearTimeout(tapTimeout.current);
        if (longPressTimer.current) clearTimeout(longPressTimer.current);
    }, []);

    const handleConsumeItem = (item) => {
        const name = item.name;
        const lowerName = String(name || '').toLowerCase();
        const level = parseInt(item.level) || 1;
        const createsMutagenEffect = lowerName.includes("mutagen");
        if (isWandItem(item)) {
            updateCharacter(c => {
                const invIdx = findInventoryItemIndex(c.inventory, item);
                if (invIdx > -1) consumeWandCharge(c.inventory[invIdx]);
            });
            return;
        }

        updateCharacter(c => {
            const invIdx = findInventoryItemIndex(c.inventory, item);

            if (invIdx > -1) {
                const invItem = c.inventory[invIdx];
                if (invItem && invItem.qty > 0) {
                    invItem.qty--;
                    if (invItem.qty === 0) c.inventory.splice(invIdx, 1);

                    if (lowerName.includes("mutagen")) {
                        if (lowerName.includes("juggernaut")) {
                            let thp = 5;
                            if (level >= 17) thp = 40;
                            else if (level >= 11) thp = 30;
                            else if (level >= 3) thp = 10;
                            c.stats.hp.temp = Math.max(c.stats.hp.temp || 0, thp);
                        }
                        if (lowerName.includes("quicksilver")) {
                            const charLevel = parseInt(c.level) || 1;
                            const dmg = charLevel * 2;
                            c.stats.hp.current = Math.max(0, (c.stats.hp.current || 0) - dmg);
                        }
                    }
                }
            }
        });

        if (createsMutagenEffect && activeCampaign?.id && character?.id && dataActions?.effect?.createEffect) {
            runDataAction(dataActions.effect.createEffect(activeCampaign.id, character.id, createMutagenEffectInput(item, character.id)));
        }
    };

    const handleItemClick = (item) => {
        const now = Date.now();
        const isSame = tapRef.current.id === item.name;
        const isDouble = isSame && (now - tapRef.current.time < 300);

        if (tapTimeout.current) clearTimeout(tapTimeout.current);

        if (isDouble && isWandItem(item)) {
            handleConsumeItem(item);
            tapRef.current = { id: null, time: 0 };
        } else if (isDouble && (item.type === 'Consumable' || item.consumable)) {
            handleConsumeItem(item);
            tapRef.current = { id: null, time: 0 };
        } else {
            tapRef.current = { id: item.name, time: now };
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

    const itemPressEvents = (item) => {
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

    const pressEvents = (item, type) => ({
        onContextMenu: (e) => {
            e.preventDefault();
            e.stopPropagation();
            handleLongPress(item, type);
        }
    });

    const isBasicAmmo = (item) =>
        /^(arrows?|bolts?|rounds?\s*\()/i.test(item?.name || '') ||
        ((item?.type || '').toLowerCase() === 'ammunition' && /\b(arrow|bolt|round)\b/i.test(item?.name || ''));

    const performDailyPrep = () => {
        const feats = character.feats || [];
        const hasQuickAlchemy = feats.includes("Quick Alchemy");
        const slotKeys = ['f', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];

        updateCharacter(c => {
            if (c.magic?.slots) {
                slotKeys.forEach(k => {
                    const max = c.magic.slots[k + "_max"] || 0;
                    if (max > 0) c.magic.slots[k + "_curr"] = max;
                });
            }

            let highestSlotLevel = 0;
            if (c.magic?.slots) {
                for (let i = 10; i >= 1; i--) {
                    if ((c.magic.slots[`${i}_max`] || 0) > 0) { highestSlotLevel = i; break; }
                }
            }
            (c.inventory || []).forEach(item => {
                if (isWandItem(item)) {
                    rechargeWand(item);
                }
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

            c.inventory = (c.inventory || []).filter(i => !i.prepared);

            if (hasQuickAlchemy) {
                const vialBase = getShopIndexItemByName('Versatile Vial') || { name: 'Versatile Vial' };
                c.inventory.push({ ...vialBase, qty: 4, prepared: true, addedAt: Date.now() });
            }
        });

        setDailyPrepQueue([]);
        setModalMode(null);
    };

    const executeBuy = (item, qty) => {
        updateCharacter(c => {
            const cost = (item.price || 0) * qty;
            if (c.gold >= cost) {
                c.gold -= cost;
                const receivedQty = isBasicAmmo(item) ? qty * 10 : qty;
                const stackable = shouldStack(item);
                const existingIndex = stackable ? findStackableInventoryItemIndex(c.inventory, item) : -1;
                const existing = existingIndex >= 0 ? c.inventory[existingIndex] : null;
                if (existing) existing.qty = (existing.qty || 1) + receivedQty;
                else c.inventory.push({ ...item, qty: receivedQty });
            } else {
                notifyError("Not enough gold!", { title: "Purchase failed" });
            }
        });
        setActionModal({ mode: null, item: null });
    };

    const executeQty = (item, qty) => {
        updateCharacter(c => {
            const idx = findInventoryItemIndex(c.inventory, item);

            if (idx > -1) {
                if (qty <= 0) c.inventory.splice(idx, 1);
                else c.inventory[idx].qty = qty;
            }
        });
        setActionModal({ mode: null, item: null });
    };

    const executeUnstack = (item) => {
        updateCharacter(c => {
            const { item: target } = resolveInventoryItemIdentity(c.inventory, item);
            if (target && (target.qty || 1) > 1) {
                const qty = target.qty;
                target.qty = 1;
                for (let k = 1; k < qty; k++) c.inventory.push({ ...target, qty: 1 });
            }
        });
        setActionModal({ mode: null, item: null });
    };

    const loadWeapon = (weaponIndex, slotIndex, ammoItem = null) => {
        updateCharacter(c => {
            const w = c.inventory[weaponIndex];
            if (!w) return;
            if (!w.loaded) w.loaded = [];

            const tags = (w.tags || []).map(t => t.toLowerCase());
            const traits = (w.traits?.value || []).map(t => t.toLowerCase());
            const allTags = [...tags, ...traits];

            let requiredKeyword = null;
            if (allTags.includes('crossbow') || w.name.toLowerCase().includes('crossbow')) requiredKeyword = 'bolt';
            else if (allTags.includes('bow') || w.name.toLowerCase().includes('bow') || allTags.includes('shortbow') || allTags.includes('longbow')) requiredKeyword = 'arrow';
            else if (allTags.includes('firearm') || w.name.toLowerCase().includes('gun') || w.name.toLowerCase().includes('pistol') || w.name.toLowerCase().includes('musket')) requiredKeyword = 'round';

            let ammoToLoad = ammoItem;
            if (!ammoToLoad) {
                if (requiredKeyword) {
                    ammoToLoad = c.inventory.find(i =>
                        i.qty > 0 &&
                        (i.category === 'ammo' || i.type === 'ammunition' || (i.traits?.value || []).includes('ammunition') || i.name.toLowerCase().includes('ammo')) &&
                        i.name.toLowerCase().includes(requiredKeyword)
                    );
                }
                if (!ammoToLoad && !requiredKeyword) {
                    const universal = c.inventory.find(i => i.name.toLowerCase() === "rounds (universal)" && i.qty > 0);
                    if (universal) ammoToLoad = universal;
                    else {
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
                notifyError(requiredKeyword ? `No ammunition found. Required: ${requiredKeyword}s` : "No ammunition found.", { title: "Load failed" });
                return;
            }

            const ammoIdx = findInventoryItemIndex(c.inventory, ammoToLoad);
            if (ammoIdx > -1) {
                const invAmmo = c.inventory[ammoIdx];
                invAmmo.qty--;
                if (invAmmo.qty <= 0) c.inventory.splice(ammoIdx, 1);

                const isStandard = requiredKeyword
                    ? ammoToLoad.name.toLowerCase().includes(requiredKeyword)
                    : /^(rounds \(universal\)|rounds?|bolts?|arrows?)/i.test(ammoToLoad.name);

                w.loaded[slotIndex] = {
                    name: ammoToLoad.name,
                    id: ammoToLoad.instanceId || "std",
                    isSpecial: !isStandard
                };
            } else {
                notifyError("Ammo not found in inventory.", { title: "Load failed" });
            }
        });
    };

    const fireWeapon = (weaponIndex, slotIndex) => {
        updateCharacter(c => {
            const w = c.inventory[weaponIndex];
            if (!w || !w.loaded || !w.loaded[slotIndex]) return;
            w.loaded[slotIndex] = null;
        });
    };

    const handleUnloadAll = (weaponOrIndex) => {
        if (!character) return;
        let weaponIndex = weaponOrIndex;
        if (typeof weaponOrIndex === 'object') {
            weaponIndex = findInventoryItemIndex(character.inventory, weaponOrIndex);
        }

        updateCharacter(c => {
            const w = c.inventory[weaponIndex];
            if (!w || !w.loaded) return;

            w.loaded.forEach(ammoData => {
                if (!ammoData) return;
                const existingIndex = findStackableInventoryItemIndex(c.inventory, { instanceId: ammoData.id, name: ammoData.name });
                const existingStack = existingIndex >= 0 ? c.inventory[existingIndex] : null;
                if (existingStack) existingStack.qty = (existingStack.qty || 0) + 1;
                else c.inventory.push({ name: ammoData.name, qty: 1, type: 'consumable', category: 'ammo' });
            });
            w.loaded = [];
        });
        setActionModal({ mode: null, item: null });
    };

    const handleLoadSpecial = (weaponOrIndex, ammoItem) => {
        const char = character;
        if (!char) return;

        let weaponIndex = weaponOrIndex;
        if (typeof weaponOrIndex === 'object') {
            weaponIndex = findInventoryItemIndex(char.inventory, weaponOrIndex);
        }

        const weapon = char.inventory[weaponIndex];
        if (!weapon) return;

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

        if (emptySlot === -1) notifyError("Weapon is full.", { title: "Load failed" });
        else loadWeapon(weaponIndex, emptySlot, ammoItem);

        setActionModal({ mode: null, item: null });
    };

    const executeTransfer = (item, targetIdx, qty) => {
        const targetInd = parseInt(targetIdx);
        if (isNaN(targetInd)) return;

        const sender = characters[activeCharIndex];
        const recipient = characters[targetInd];
        if (!activeCampaign?.id || !sender?.id || !recipient?.id) return;
        runDataAction(dataActions.inventory.transferItem(activeCampaign.id, sender.id, recipient.id, item, qty));

        setActionModal({ mode: null, item: null });
    };

    const addToCharacter = (item, type) => {
        updateCharacter(c => {
            const newItem = { name: item.name };
            if (type === 'feat') {
                if (!c.feats.includes(item.name)) c.feats.push(item.name);
            } else if (type === 'spell') {
                if (!c.magic) c.magic = { list: [] };
                if (!c.magic.list) c.magic.list = [];
                const numericLevel = Number(item.level);
                const level = Number.isFinite(numericLevel) ? String(numericLevel) : "1";
                newItem.level = level;
                c.magic.list.push(newItem);
            } else if (type === 'impulse') {
                if (!c.impulses) c.impulses = [];
                if (!c.impulses.find(i => i.name === newItem.name)) c.impulses.push({ ...item });
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
            if (idx > -1) c.magic.list[idx].Bloodmagic = !c.magic.list[idx].Bloodmagic;
        });
        setModalMode(null);
    };

    const handleBuyFormula = async (item, price) => {
        const confirmed = await confirm({
            title: "Buy formula",
            message: `Buy Formula for ${item.name} (${price} gp)?`,
            confirmLabel: "Buy",
        });
        if (!confirmed) return;

        updateCharacter(c => {
            const currentGold = parseFloat(c.gold || 0);
            if (currentGold < price) {
                notifyError("Not enough gold.", { title: "Purchase failed" });
                return;
            }
            if (!c.formulaBook) c.formulaBook = [];
            if (c.formulaBook.includes(item.name)) {
                notifyError("You already know this formula.", { title: "Purchase failed" });
                return;
            }

            c.gold = (currentGold - price).toFixed(2);
            c.formulaBook.push(item.name);
        });
    };

    const buyFromCatalog = (item) => {
        if (character.gold < item.price) {
            notifyError("Not enough gold.", { title: "Purchase failed" });
            return;
        }

        updateCharacter(c => {
            c.gold = parseFloat((c.gold - item.price).toFixed(2));
            const stackable = shouldStack(item);
            const existingIndex = stackable ? findStackableInventoryItemIndex(c.inventory, item) : -1;
            const existing = existingIndex >= 0 ? c.inventory[existingIndex] : null;
            if (existing) {
                existing.qty = (existing.qty || 1) + 1;
                Object.assign(existing, item, { qty: existing.qty });
            } else {
                c.inventory.push({ ...item, qty: 1 });
            }
        });
    };

    const inspectInventoryItem = (item) => {
        let fromIndex = item?.name ? getShopIndexItemByName(item.name) : null;
        if (!fromIndex && item.system?.originalName) {
            fromIndex = getShopIndexItemByName(item.system.originalName);
        }
        const merged = fromIndex ? { ...fromIndex, ...item, qty: item.qty || 1 } : { ...item };
        if (item._index !== undefined) merged._index = item._index;
        setModalData(merged);
        setModalMode('item');
    };

    const toggleInventoryEquipped = async (targetItem) => {
        const itemName = targetItem?.name || targetItem;
        if (!itemName) return;

        let shieldFetchData = null;
        const char = character;
        if (!char) return;

        const itemToToggle = resolveInventoryItemIdentity(
            char.inventory,
            typeof targetItem === 'object' ? targetItem : { name: itemName }
        ).item;

        if (itemToToggle) {
            const fromIndex = itemToToggle?.name ? getShopIndexItemByName(itemToToggle.name) : null;
            const type = String(itemToToggle?.type || fromIndex?.type || '').toLowerCase();

            if (type === 'shield' && !itemToToggle.equipped && (!itemToToggle.system || !itemToToggle.system.hardness)) {
                const sourceFile = itemToToggle.sourceFile || fromIndex?.sourceFile;
                if (sourceFile) {
                    try {
                        const res = await fetch(`/api/static/equipment/${sourceFile}`);
                        if (res.ok) shieldFetchData = await res.json();
                    } catch (e) {
                        console.error("Failed to fetch shield data", e);
                    }
                }
            }
        }

        updateCharacter(c => {
            const idx = findInventoryItemIndex(
                c.inventory,
                typeof targetItem === 'object' ? targetItem : { name: itemName }
            );

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
                    c.stats.ac.armor_equipped = c.inventory.some(invItem => {
                        const invIndex = invItem?.name ? getShopIndexItemByName(invItem.name) : null;
                        const invType = String(invItem?.type || invIndex?.type || '').toLowerCase();
                        return invType === 'armor' && Boolean(invItem?.equipped);
                    });
                }
                return;
            }

            if (type === 'shield') {
                const nextEquipped = !Boolean(current.equipped);
                if (!c.stats) c.stats = {};
                if (!c.stats.ac) c.stats.ac = {};

                if (nextEquipped) {
                    c.inventory.forEach(invItem => {
                        const invIndex = invItem?.name ? getShopIndexItemByName(invItem.name) : null;
                        const invType = String(invItem?.type || invIndex?.type || '').toLowerCase();
                        if (invType === 'shield') invItem.equipped = false;
                    });
                    current.equipped = true;

                    if (shieldFetchData) current.system = { ...(current.system || {}), ...shieldFetchData.system };

                    const itemMax = (current.system?.hp?.max) || (fromIndex?.system?.hp?.max) || 20;
                    const itemVal = (current.system?.hp?.value) || (fromIndex?.system?.hp?.value) || itemMax;
                    c.stats.ac.shield_hp = itemVal;
                } else {
                    current.equipped = false;
                }
                return;
            }

            if (shouldStack(current)) {
                if (!current.equipped && (current.qty || 1) > 1) {
                    current.qty -= 1;
                    c.inventory.push({ ...current, qty: 1, equipped: true });
                    return;
                }

                if (current.equipped) {
                    const stackTargetIndex = findStackableInventoryItemIndex(c.inventory, current, {
                        excludeIndex: idx,
                        equipped: false,
                        prepared: Boolean(current.prepared),
                    });
                    const stackTarget = stackTargetIndex >= 0 ? c.inventory[stackTargetIndex] : null;
                    if (stackTarget) {
                        stackTarget.qty = (stackTarget.qty || 1) + (current.qty || 1);
                        c.inventory.splice(idx, 1);
                        return;
                    }
                }
            }

            current.equipped = !current.equipped;
        });
    };

    return {
        addToCharacter,
        buyFromCatalog,
        executeBuy,
        executeQty,
        executeTransfer,
        executeUnstack,
        fireWeapon,
        handleBuyFormula,
        handleConsumeItem,
        handleItemClick,
        handleItemLongPressAction,
        handleLoadSpecial,
        handleLongPress,
        handleUnloadAll,
        inspectInventoryItem,
        itemPressEvents,
        loadWeapon,
        performDailyPrep,
        pressEvents,
        removeFromCharacter,
        toggleBloodmagic,
        toggleInventoryEquipped,
    };
}
