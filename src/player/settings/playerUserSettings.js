export const SKILL_PROFICIENCY_DISPLAY = Object.freeze({
    NONE: 'none',
    SHORT: 'short',
    FULL: 'full',
    STARS: 'stars',
});

const VALID_SKILL_DISPLAYS = new Set(Object.values(SKILL_PROFICIENCY_DISPLAY));

export const DEFAULT_PLAYER_USER_SETTINGS = Object.freeze({
    skillProficiencyDisplay: SKILL_PROFICIENCY_DISPLAY.NONE,
    loopPages: true,
});

export function normalizePlayerUserSettings(settings = {}) {
    const skillProficiencyDisplay = String(settings?.skillProficiencyDisplay || '').toLowerCase();
    return {
        skillProficiencyDisplay: VALID_SKILL_DISPLAYS.has(skillProficiencyDisplay)
            ? skillProficiencyDisplay
            : DEFAULT_PLAYER_USER_SETTINGS.skillProficiencyDisplay,
        loopPages: settings?.loopPages !== false,
    };
}
