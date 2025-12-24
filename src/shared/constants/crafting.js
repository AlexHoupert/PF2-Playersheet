export const FORMULA_PRICES = {
    0: 0.5,
    1: 1,
    2: 2,
    3: 3,
    4: 5,
    5: 8,
    6: 13,
    7: 18,
    8: 25,
    9: 35,
    10: 50,
    11: 70,
    12: 100,
    13: 150,
    14: 225,
    15: 325,
    16: 500,
    17: 750,
    18: 1200,
    19: 2000,
    20: 3500
};

export const getFormulaPrice = (level) => {
    // Treat invalid levels as 0 or handle error. Formulas usually match item level.
    const lvl = Math.max(0, parseInt(level) || 0);
    return FORMULA_PRICES[lvl] || FORMULA_PRICES[20]; // Cap at 20 or return max?
};
