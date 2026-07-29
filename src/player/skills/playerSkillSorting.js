export const PLAYER_SKILL_SORT_MODE = Object.freeze({
    ALPHABETICAL: 'alphabetical',
    VALUE: 'value',
});

export function sortPlayerSkillRows(rows = [], mode = PLAYER_SKILL_SORT_MODE.ALPHABETICAL) {
    return [...rows].sort((left, right) => {
        if (mode === PLAYER_SKILL_SORT_MODE.VALUE) {
            const valueDifference = toSortableValue(right?.calc?.total) - toSortableValue(left?.calc?.total);
            if (valueDifference !== 0) return valueDifference;
        }
        return String(left?.displayName || left?.name || '').localeCompare(
            String(right?.displayName || right?.name || ''),
            'en',
            { sensitivity: 'base' }
        );
    });
}

function toSortableValue(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
}
