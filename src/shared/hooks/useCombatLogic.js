export function useCombatLogic({ character, updateCharacter }) {

    const loadWeapon = (weaponIndex, slotIndex, ammoItem) => {
        updateCharacter(c => {
            const w = c.inventory[weaponIndex];
            if (!w) return;

            // Deduct ammo
            const ammoIdx = c.inventory.findIndex(i => i.name === ammoItem.name);
            if (ammoIdx > -1) {
                if (c.inventory[ammoIdx].qty > 0) {
                    c.inventory[ammoIdx].qty--;
                    if (c.inventory[ammoIdx].qty === 0) {
                        c.inventory.splice(ammoIdx, 1);
                    }
                } else {
                    return; // No ammo
                }
            } else if (ammoItem.name !== "Rounds (universal)") {
                // Logic for universal rounds (infinite?) or error
            }

            // Load logic
            if (!w.loaded) w.loaded = [];
            w.loaded[slotIndex] = { name: ammoItem.name };
        });
    };

    const fireWeapon = (weapon, slotIndex) => {
        updateCharacter(c => {
            const w = c.inventory.find(i => i.name === weapon.name && i.instanceId === weapon.instanceId);
            if (w && w.loaded && w.loaded[slotIndex]) {
                w.loaded[slotIndex] = null;
            }
        });
    };

    return {
        loadWeapon,
        fireWeapon
    };
}
