import {
    DEFAULT_PLAYER_PAGE_ORDER,
    normalizePlayerPageOrder,
} from '../navigation/playerPageRegistry.js';

export const SKILL_PROFICIENCY_DISPLAY = Object.freeze({
    NONE: 'none',
    SHORT: 'short',
    FULL: 'full',
    STARS: 'stars',
});

const VALID_SKILL_DISPLAYS = new Set(Object.values(SKILL_PROFICIENCY_DISPLAY));

export const SKILL_SORT_MODE = Object.freeze({
    ALPHABETICAL: 'alphabetical',
    VALUE: 'value',
});

const VALID_SKILL_SORT_MODES = new Set(Object.values(SKILL_SORT_MODE));

export const DEFAULT_PLAYER_USER_SETTINGS = Object.freeze({
    skillProficiencyDisplay: SKILL_PROFICIENCY_DISPLAY.NONE,
    skillSortMode: SKILL_SORT_MODE.ALPHABETICAL,
    loopPages: true,
    pageOrderByCategory: DEFAULT_PLAYER_PAGE_ORDER,
});

export function normalizePlayerUserSettings(settings = {}) {
    const skillProficiencyDisplay = String(settings?.skillProficiencyDisplay || '').toLowerCase();
    const skillSortMode = String(settings?.skillSortMode || '').toLowerCase();
    return {
        skillProficiencyDisplay: VALID_SKILL_DISPLAYS.has(skillProficiencyDisplay)
            ? skillProficiencyDisplay
            : DEFAULT_PLAYER_USER_SETTINGS.skillProficiencyDisplay,
        skillSortMode: VALID_SKILL_SORT_MODES.has(skillSortMode)
            ? skillSortMode
            : DEFAULT_PLAYER_USER_SETTINGS.skillSortMode,
        loopPages: settings?.loopPages !== false,
        pageOrderByCategory: normalizePlayerPageOrder(settings?.pageOrderByCategory),
    };
}
