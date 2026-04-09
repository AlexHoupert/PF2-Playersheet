/**
 * Bestiary Utilities
 * Helper functions for creature/hazard stat calculations, DC tables, and reveal mechanics
 * Tables from PF2e Gamemastery Guide
 */

// ============================================================================
// RECALL KNOWLEDGE DC TABLE
// ============================================================================
const DC_BY_LEVEL = {
    '-1': 13, 0: 14, 1: 15, 2: 16, 3: 18, 4: 19, 5: 20, 6: 22, 7: 23, 8: 24,
    9: 26, 10: 27, 11: 28, 12: 30, 13: 31, 14: 32, 15: 34, 16: 35, 17: 36,
    18: 38, 19: 39, 20: 40, 21: 42, 22: 44, 23: 46, 24: 48, 25: 50
};

const RARITY_DC_ADJUSTMENT = {
    common: 0,
    uncommon: 2,
    rare: 5,
    unique: 10
};

/**
 * Get Recall Knowledge DC for a creature
 * @param {number} level - Creature level
 * @param {string} rarity - common/uncommon/rare/unique
 * @returns {{ base: number, unspecific: number, specific: number }}
 */
export function getRecallKnowledgeDC(level, rarity = 'common') {
    const baseDC = DC_BY_LEVEL[level] || DC_BY_LEVEL[0];
    const adjustment = RARITY_DC_ADJUSTMENT[rarity] || 0;
    const adjustedDC = baseDC + adjustment;
    return {
        base: adjustedDC,
        unspecific: adjustedDC - 2,
        specific: adjustedDC - 5
    };
}

// ============================================================================
// HP THRESHOLDS BY LEVEL (Table 2-6)
// ============================================================================
// Format: [lowMax, moderateMax, highMax] - anything above highMax is extreme
const HP_THRESHOLDS = {
    '-1': [6, 8, 9],
    0: [13, 16, 20],
    1: [16, 21, 26],
    2: [25, 32, 40],
    3: [37, 48, 59],
    4: [48, 63, 78],
    5: [59, 78, 97],
    6: [67, 91, 115],
    7: [82, 111, 140],
    8: [97, 131, 165],
    9: [112, 151, 190],
    10: [127, 171, 215],
    11: [142, 191, 240],
    12: [157, 211, 265],
    13: [172, 231, 290],
    14: [187, 251, 315],
    15: [202, 271, 340],
    16: [217, 291, 365],
    17: [232, 311, 390],
    18: [247, 331, 415],
    19: [262, 351, 440],
    20: [277, 371, 465],
    21: [295, 395, 495],
    22: [317, 424, 532],
    23: [339, 454, 569],
    24: [367, 492, 617]
};

/**
 * Get HP rating for a creature
 * @param {number} hp - Current HP value
 * @param {number} level - Creature level
 * @returns {'low'|'moderate'|'high'}
 */
export function getHPRating(hp, level) {
    const thresholds = HP_THRESHOLDS[level] || HP_THRESHOLDS[0];
    if (hp <= thresholds[0]) return 'low';
    if (hp <= thresholds[1]) return 'moderate';
    return 'high';
}

// ============================================================================
// ABILITY MODIFIER THRESHOLDS BY LEVEL (Table 2-1)
// Format: { extreme, high, moderate, low } - exact values for each tier
// ============================================================================
const ABILITY_MODIFIER_BY_LEVEL = {
    '-1': { extreme: null, high: 3, moderate: 2, low: 0 },
    0: { extreme: null, high: 3, moderate: 2, low: 0 },
    1: { extreme: 5, high: 4, moderate: 3, low: 1 },
    2: { extreme: 5, high: 4, moderate: 3, low: 1 },
    3: { extreme: 5, high: 4, moderate: 3, low: 1 },
    4: { extreme: 6, high: 5, moderate: 3, low: 2 },
    5: { extreme: 6, high: 5, moderate: 4, low: 2 },
    6: { extreme: 7, high: 5, moderate: 4, low: 2 },
    7: { extreme: 7, high: 6, moderate: 4, low: 2 },
    8: { extreme: 7, high: 6, moderate: 4, low: 3 },
    9: { extreme: 7, high: 6, moderate: 4, low: 3 },
    10: { extreme: 8, high: 7, moderate: 5, low: 3 },
    11: { extreme: 8, high: 7, moderate: 5, low: 3 },
    12: { extreme: 8, high: 7, moderate: 5, low: 4 },
    13: { extreme: 9, high: 8, moderate: 5, low: 4 },
    14: { extreme: 9, high: 8, moderate: 5, low: 4 },
    15: { extreme: 9, high: 8, moderate: 6, low: 4 },
    16: { extreme: 10, high: 9, moderate: 6, low: 5 },
    17: { extreme: 10, high: 9, moderate: 6, low: 5 },
    18: { extreme: 10, high: 9, moderate: 6, low: 5 },
    19: { extreme: 11, high: 10, moderate: 6, low: 5 },
    20: { extreme: 11, high: 10, moderate: 7, low: 6 },
    21: { extreme: 11, high: 10, moderate: 7, low: 6 },
    22: { extreme: 11, high: 10, moderate: 8, low: 6 },
    23: { extreme: 11, high: 10, moderate: 8, low: 6 },
    24: { extreme: 13, high: 12, moderate: 9, low: 7 },
};

/**
 * Get ability modifier rating
 * @param {number} modifier - The ability modifier (not bonus)
 * @param {number} level - Creature level
 * @returns {'low'|'moderate'|'high'|'extreme'}
 */
export function getAbilityModRating(modifier, level) {
    const thresholds = ABILITY_MODIFIER_BY_LEVEL[level] || ABILITY_MODIFIER_BY_LEVEL[0];
    // Thresholds are MINIMUM values for each tier
    if (thresholds.extreme !== null && modifier >= thresholds.extreme) return 'extreme';
    if (modifier >= thresholds.high) return 'high';
    if (modifier >= thresholds.moderate) return 'moderate';
    return 'low';
}

// ============================================================================
// SKILL THRESHOLDS BY LEVEL (Table 2-3)
// Format: { extreme, high, moderate, lowMin, lowMax } - ranges
// ============================================================================
const SKILL_THRESHOLDS_BY_LEVEL = {
    '-1': { extreme: 8, high: 5, moderate: 4, lowMax: 1, lowMin: -1 },
    0: { extreme: 9, high: 6, moderate: 5, lowMax: 2, lowMin: 0 },
    1: { extreme: 10, high: 7, moderate: 6, lowMax: 3, lowMin: 1 },
    2: { extreme: 11, high: 8, moderate: 7, lowMax: 4, lowMin: 2 },
    3: { extreme: 13, high: 10, moderate: 9, lowMax: 5, lowMin: 3 },
    4: { extreme: 15, high: 12, moderate: 10, lowMax: 7, lowMin: 5 },
    5: { extreme: 16, high: 13, moderate: 12, lowMax: 8, lowMin: 6 },
    6: { extreme: 18, high: 15, moderate: 13, lowMax: 9, lowMin: 7 },
    7: { extreme: 20, high: 17, moderate: 15, lowMax: 11, lowMin: 9 },
    8: { extreme: 21, high: 18, moderate: 16, lowMax: 12, lowMin: 10 },
    9: { extreme: 23, high: 20, moderate: 18, lowMax: 13, lowMin: 11 },
    10: { extreme: 25, high: 22, moderate: 19, lowMax: 15, lowMin: 13 },
    11: { extreme: 26, high: 23, moderate: 21, lowMax: 16, lowMin: 14 },
    12: { extreme: 28, high: 25, moderate: 22, lowMax: 17, lowMin: 15 },
    13: { extreme: 30, high: 27, moderate: 24, lowMax: 19, lowMin: 17 },
    14: { extreme: 31, high: 28, moderate: 25, lowMax: 20, lowMin: 18 },
    15: { extreme: 33, high: 30, moderate: 27, lowMax: 21, lowMin: 19 },
    16: { extreme: 35, high: 32, moderate: 28, lowMax: 23, lowMin: 21 },
    17: { extreme: 36, high: 33, moderate: 30, lowMax: 24, lowMin: 22 },
    18: { extreme: 38, high: 35, moderate: 31, lowMax: 25, lowMin: 23 },
    19: { extreme: 40, high: 37, moderate: 33, lowMax: 27, lowMin: 25 },
    20: { extreme: 41, high: 38, moderate: 34, lowMax: 28, lowMin: 26 },
    21: { extreme: 43, high: 40, moderate: 36, lowMax: 29, lowMin: 27 },
    22: { extreme: 45, high: 42, moderate: 37, lowMax: 31, lowMin: 29 },
    23: { extreme: 46, high: 43, moderate: 38, lowMax: 32, lowMin: 30 },
    24: { extreme: 48, high: 45, moderate: 40, lowMax: 33, lowMin: 31 },
};

/**
 * Get skill rating
 * @param {number} bonus - The skill bonus
 * @param {number} level - Creature level
 * @returns {'low'|'moderate'|'high'|'extreme'}
 */
export function getSkillRating(bonus, level) {
    const thresholds = SKILL_THRESHOLDS_BY_LEVEL[level] || SKILL_THRESHOLDS_BY_LEVEL[0];
    // Thresholds are MINIMUM values for each tier
    if (bonus >= thresholds.extreme) return 'extreme';
    if (bonus >= thresholds.high) return 'high';
    if (bonus >= thresholds.moderate) return 'moderate';
    return 'low';
}

// ============================================================================
// PERCEPTION THRESHOLDS BY LEVEL (Table 2-2)
// Format: { extreme, high, moderate, low, terrible }
// ============================================================================
const PERCEPTION_THRESHOLDS_BY_LEVEL = {
    '-1': { extreme: 9, high: 8, moderate: 5, low: 2, terrible: 0 },
    0: { extreme: 10, high: 9, moderate: 6, low: 3, terrible: 1 },
    1: { extreme: 11, high: 10, moderate: 7, low: 4, terrible: 2 },
    2: { extreme: 12, high: 11, moderate: 8, low: 5, terrible: 3 },
    3: { extreme: 14, high: 12, moderate: 9, low: 6, terrible: 4 },
    4: { extreme: 15, high: 14, moderate: 11, low: 8, terrible: 6 },
    5: { extreme: 17, high: 15, moderate: 12, low: 9, terrible: 7 },
    6: { extreme: 18, high: 17, moderate: 14, low: 11, terrible: 8 },
    7: { extreme: 20, high: 18, moderate: 15, low: 12, terrible: 10 },
    8: { extreme: 21, high: 19, moderate: 16, low: 13, terrible: 11 },
    9: { extreme: 23, high: 21, moderate: 18, low: 15, terrible: 12 },
    10: { extreme: 24, high: 22, moderate: 19, low: 16, terrible: 14 },
    11: { extreme: 26, high: 24, moderate: 21, low: 18, terrible: 15 },
    12: { extreme: 27, high: 25, moderate: 22, low: 19, terrible: 16 },
    13: { extreme: 29, high: 26, moderate: 23, low: 20, terrible: 18 },
    14: { extreme: 30, high: 28, moderate: 25, low: 22, terrible: 19 },
    15: { extreme: 32, high: 29, moderate: 26, low: 23, terrible: 20 },
    16: { extreme: 33, high: 30, moderate: 28, low: 25, terrible: 22 },
    17: { extreme: 35, high: 32, moderate: 29, low: 26, terrible: 23 },
    18: { extreme: 36, high: 33, moderate: 30, low: 27, terrible: 24 },
    19: { extreme: 38, high: 35, moderate: 32, low: 29, terrible: 26 },
    20: { extreme: 39, high: 36, moderate: 33, low: 30, terrible: 27 },
    21: { extreme: 41, high: 38, moderate: 35, low: 32, terrible: 28 },
    22: { extreme: 43, high: 39, moderate: 36, low: 33, terrible: 30 },
    23: { extreme: 44, high: 40, moderate: 37, low: 34, terrible: 31 },
    24: { extreme: 46, high: 42, moderate: 38, low: 36, terrible: 32 },
};

/**
 * Get perception rating
 * @param {number} bonus - The perception bonus
 * @param {number} level - Creature level
 * @returns {'terrible'|'low'|'moderate'|'high'|'extreme'}
 */
export function getPerceptionRating(bonus, level) {
    const thresholds = PERCEPTION_THRESHOLDS_BY_LEVEL[level] || PERCEPTION_THRESHOLDS_BY_LEVEL[0];
    // Thresholds are MINIMUM values for each tier
    if (bonus >= thresholds.extreme) return 'extreme';
    if (bonus >= thresholds.high) return 'high';
    if (bonus >= thresholds.moderate) return 'moderate';
    if (bonus >= thresholds.low) return 'low';
    return 'terrible';
}

// ============================================================================
// AC THRESHOLDS BY LEVEL (Table 2-5)
// Format: { extreme, high, moderate, low }
// ============================================================================
const AC_THRESHOLDS_BY_LEVEL = {
    '-1': { extreme: 18, high: 15, moderate: 14, low: 12 },
    0: { extreme: 19, high: 16, moderate: 15, low: 13 },
    1: { extreme: 19, high: 16, moderate: 15, low: 13 },
    2: { extreme: 21, high: 18, moderate: 17, low: 15 },
    3: { extreme: 22, high: 19, moderate: 18, low: 16 },
    4: { extreme: 24, high: 21, moderate: 20, low: 18 },
    5: { extreme: 25, high: 22, moderate: 21, low: 19 },
    6: { extreme: 27, high: 24, moderate: 23, low: 21 },
    7: { extreme: 28, high: 25, moderate: 24, low: 22 },
    8: { extreme: 30, high: 27, moderate: 26, low: 24 },
    9: { extreme: 31, high: 28, moderate: 27, low: 25 },
    10: { extreme: 33, high: 30, moderate: 29, low: 27 },
    11: { extreme: 34, high: 31, moderate: 30, low: 28 },
    12: { extreme: 36, high: 33, moderate: 32, low: 30 },
    13: { extreme: 37, high: 34, moderate: 33, low: 31 },
    14: { extreme: 39, high: 36, moderate: 35, low: 33 },
    15: { extreme: 40, high: 37, moderate: 36, low: 34 },
    16: { extreme: 42, high: 39, moderate: 38, low: 36 },
    17: { extreme: 43, high: 40, moderate: 39, low: 37 },
    18: { extreme: 45, high: 42, moderate: 41, low: 39 },
    19: { extreme: 46, high: 43, moderate: 42, low: 40 },
    20: { extreme: 48, high: 45, moderate: 44, low: 42 },
    21: { extreme: 49, high: 46, moderate: 45, low: 43 },
    22: { extreme: 51, high: 48, moderate: 47, low: 45 },
    23: { extreme: 52, high: 49, moderate: 48, low: 46 },
    24: { extreme: 54, high: 51, moderate: 50, low: 48 },
};

/**
 * Get AC rating
 * @param {number} ac - The AC value
 * @param {number} level - Creature level
 * @returns {'low'|'moderate'|'high'|'extreme'}
 */
export function getACRating(ac, level) {
    const thresholds = AC_THRESHOLDS_BY_LEVEL[level] || AC_THRESHOLDS_BY_LEVEL[0];
    // Thresholds are MINIMUM values for each tier
    // So extreme=19 means 19+ is extreme, 16-18 is high, etc.
    if (ac >= thresholds.extreme) return 'extreme';
    if (ac >= thresholds.high) return 'high';
    if (ac >= thresholds.moderate) return 'moderate';
    return 'low';
}

/**
 * Get color for a rating
 * @param {'terrible'|'low'|'moderate'|'high'|'extreme'} rating
 * @returns {string} CSS color
 */
export function getRatingColor(rating) {
    switch (rating) {
        case 'terrible': return '#b71c1c'; // dark red
        case 'low': return '#e57373'; // red
        case 'moderate': return '#ccc'; // white/grey
        case 'high': return '#81c784'; // green
        case 'extreme': return '#ffd54f'; // gold
        default: return '#ccc';
    }
}

// ============================================================================
// SAVE RANKING
// ============================================================================
/**
 * Get save rankings (lowest/middle/highest)
 * @param {{ fortitude: number, reflex: number, will: number }} saves
 * @returns {{ fortitude: string, reflex: string, will: string }}
 */
export function getSaveRanking(saves) {
    const { fortitude, reflex, will } = saves;
    const values = [
        { name: 'fortitude', value: fortitude },
        { name: 'reflex', value: reflex },
        { name: 'will', value: will }
    ].sort((a, b) => a.value - b.value);

    const rankings = {};
    // Handle ties
    if (values[0].value === values[1].value && values[1].value === values[2].value) {
        // All equal
        rankings[values[0].name] = 'middle';
        rankings[values[1].name] = 'middle';
        rankings[values[2].name] = 'middle';
    } else if (values[0].value === values[1].value) {
        // Two lowest are equal
        rankings[values[0].name] = 'lowest';
        rankings[values[1].name] = 'lowest';
        rankings[values[2].name] = 'highest';
    } else if (values[1].value === values[2].value) {
        // Two highest are equal
        rankings[values[0].name] = 'lowest';
        rankings[values[1].name] = 'highest';
        rankings[values[2].name] = 'highest';
    } else {
        // All different
        rankings[values[0].name] = 'lowest';
        rankings[values[1].name] = 'middle';
        rankings[values[2].name] = 'highest';
    }

    return rankings;
}

// ============================================================================
// MAP (MULTIPLE ATTACK PENALTY) CALCULATION
// ============================================================================
/**
 * Calculate MAP penalties based on traits
 * @param {number} bonus - Attack bonus
 * @param {string[]} traits - Attack traits
 * @returns {string} Formatted MAP string like "[+7/+2]" or "[+8/+4]"
 */
export function calculateMAP(bonus, traits = []) {
    const isAgile = traits.includes('agile');
    const penalty1 = isAgile ? 4 : 5;
    const penalty2 = isAgile ? 8 : 10;

    const map1 = bonus - penalty1;
    const map2 = bonus - penalty2;

    return `[${map1 >= 0 ? '+' : ''}${map1}/${map2 >= 0 ? '+' : ''}${map2}]`;
}

// ============================================================================
// ACTION TYPE ICONS
// ============================================================================
export const ACTION_ICONS = {
    1: '◆',
    2: '◆◆',
    3: '◆◆◆',
    reaction: '⟲',
    passive: '⊛',
    free: '◇'
};

/**
 * Get action icon for display
 * @param {object} item - Ability/action item from creature data
 * @returns {string} Icon string
 */
export function getActionIcon(item) {
    if (item.type === 'melee' || item.type === 'ranged') {
        return ACTION_ICONS[1]; // Attacks are 1 action by default
    }

    const actionType = item.system?.actionType?.value;
    const actionCount = item.system?.actions?.value;

    if (actionType === 'passive') return ACTION_ICONS.passive;
    if (actionType === 'reaction') return ACTION_ICONS.reaction;
    if (actionType === 'free') return ACTION_ICONS.free;
    if (actionCount && ACTION_ICONS[actionCount]) return ACTION_ICONS[actionCount];

    return ACTION_ICONS[1];
}

/**
 * Get sort priority for grouping abilities
 * Lower = shown first
 */
export function getAbilitySortPriority(item) {
    if (item.type === 'melee') return 0;
    if (item.type === 'ranged') return 1;

    const actionType = item.system?.actionType?.value;
    const actionCount = item.system?.actions?.value;

    if (actionType === 'action') {
        return 10 + (actionCount || 1);
    }
    if (actionType === 'reaction') return 20;
    if (actionType === 'passive') return 30;
    if (actionType === 'free') return 5;

    return 40;
}

// ============================================================================
// SIZE MAPPING
// ============================================================================
export const SIZE_MAP = {
    tiny: 'Tiny',
    sm: 'Small',
    med: 'Medium',
    lg: 'Large',
    huge: 'Huge',
    grg: 'Gargantuan'
};

export function formatSize(sizeCode) {
    return SIZE_MAP[sizeCode] || sizeCode;
}

// ============================================================================
// FALSE DATA GENERATION
// ============================================================================
const RATING_OPTIONS = ['low', 'moderate', 'high'];
const RANKING_OPTIONS = ['lowest', 'middle', 'highest'];

/**
 * Generate random false data for "reveal false" mode
 * @param {object} trueData - The actual creature data
 * @param {number} level - Creature level
 * @returns {object} Object with randomized false values
 */

// Common damage types for generating false weaknesses
const COMMON_DAMAGE_TYPES = [
    'fire', 'cold', 'electricity', 'acid', 'sonic', 'force', 'positive', 'negative',
    'mental', 'poison', 'bleed', 'piercing', 'slashing', 'bludgeoning',
    'good', 'evil', 'chaotic', 'lawful', 'silver', 'cold-iron', 'adamantine'
];

export function generateFalseData(trueData, level) {
    const trueHPRating = getHPRating(trueData.hp || 0, level);
    const falsHPOptions = RATING_OPTIONS.filter(r => r !== trueHPRating);

    const trueSaveRankings = getSaveRanking({
        fortitude: trueData.fortitude || 0,
        reflex: trueData.reflex || 0,
        will: trueData.will || 0
    });

    // Generate false save rankings (swap them around)
    const falseSaveRankings = {};
    const shuffled = [...RANKING_OPTIONS].sort(() => Math.random() - 0.5);
    ['fortitude', 'reflex', 'will'].forEach((save, i) => {
        // Pick a different ranking if possible
        let newRanking = shuffled[i];
        if (newRanking === trueSaveRankings[save]) {
            newRanking = RANKING_OPTIONS.find(r => r !== trueSaveRankings[save]) || newRanking;
        }
        falseSaveRankings[save] = newRanking;
    });

    // Generate false AC and Perception ratings
    const trueACRating = getACRating(trueData.ac || 10, level);
    const falseACOptions = RATING_OPTIONS.filter(r => r !== trueACRating);

    const truePerceptionRating = getPerceptionRating(trueData.perception || 0, level);
    const falsePerceptionOptions = RATING_OPTIONS.filter(r => r !== truePerceptionRating);

    // Generate false weaknesses (1-2 random types different from real ones)
    const trueWeaknesses = (trueData.weaknesses || []).map(w => w.type || w);
    const availableTypes = COMMON_DAMAGE_TYPES.filter(t => !trueWeaknesses.includes(t));
    const numFalseWeaknesses = Math.floor(Math.random() * 2) + 1; // 1-2 weaknesses
    const falseWeaknesses = [];
    for (let i = 0; i < numFalseWeaknesses && availableTypes.length > 0; i++) {
        const idx = Math.floor(Math.random() * availableTypes.length);
        falseWeaknesses.push({
            type: availableTypes.splice(idx, 1)[0],
            value: Math.max(5, Math.floor(Math.random() * 10) + level) // Random value based on level
        });
    }

    return {
        hp: falsHPOptions[Math.floor(Math.random() * falsHPOptions.length)],
        saves: falseSaveRankings,
        ac: falseACOptions[Math.floor(Math.random() * falseACOptions.length)],
        perception: falsePerceptionOptions[Math.floor(Math.random() * falsePerceptionOptions.length)],
        weaknesses: falseWeaknesses,
    };
}

// ============================================================================
// RARITY COLORS
// ============================================================================
export const RARITY_COLORS = {
    common: '#4a4a4a',
    uncommon: '#c19a3e', // gold/yellow
    rare: '#5c8bc4', // blue
    unique: '#9b59b6' // purple
};

export function getRarityColor(rarity) {
    return RARITY_COLORS[rarity] || RARITY_COLORS.common;
}
