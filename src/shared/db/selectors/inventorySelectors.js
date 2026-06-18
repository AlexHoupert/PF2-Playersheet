export function selectInventory(character) {
    return Array.isArray(character?.inventory) ? character.inventory : [];
}

export function selectFormulaBook(character) {
    return Array.isArray(character?.formulaBook) ? character.formulaBook : [];
}
