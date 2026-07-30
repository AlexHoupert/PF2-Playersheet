export function countUnlockedAwakeningPoints(unlockedAwakenings = {}) {
    return Object.values(unlockedAwakenings || {}).reduce(
        (total, value) => total + clampAwakeningLevel(value),
        0
    );
}

export function clampAwakeningLevel(value) {
    const number = Number(value);
    const normalized = Number.isFinite(number) ? Math.trunc(number) : 0;
    return Math.max(0, Math.min(2, normalized));
}
