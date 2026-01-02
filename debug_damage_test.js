
// debug_damage_test.js
import { calculateWeaponDamage } from './src/utils/rules/damage.js';

// Mock Data
const acidFlask = {
    name: "Acid Flask (Lesser)",
    type: "weapon",
    system: {
        damage: {
            damageType: "acid",
            dice: 1,
            die: "",
            persistent: {
                faces: 6,
                number: 1,
                type: "acid"
            }
        },
        splashDamage: {
            value: 1
        },
        group: "bomb",
        traits: { value: ["bomb", "splash", "acid"] }
    }
};

const character = {
    stats: { attributes: { strength: 2 } },
    feats: [],
    level: 1
};

console.log("--- Testing Acid Flask Damage ---");
const result = calculateWeaponDamage(acidFlask, character);

console.log("Normal Text:", result.normal.text);
console.log("Special Parts:", JSON.stringify(result.normal.special, null, 2));
console.log("All Parts:", JSON.stringify(result.normal.parts, null, 2));
