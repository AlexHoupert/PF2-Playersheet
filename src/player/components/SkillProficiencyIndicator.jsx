import React from 'react';
import { Star } from 'lucide-react';
import { PROF_NAMES } from '../../utils/rules';
import { SKILL_PROFICIENCY_DISPLAY } from '../settings/playerUserSettings';

const SHORT_NAMES = Object.freeze({ 0: 'U', 2: 'T', 4: 'E', 6: 'M', 8: 'L' });

export default function SkillProficiencyIndicator({ rank, displayMode }) {
    const normalizedRank = normalizeRank(rank);
    if (displayMode === SKILL_PROFICIENCY_DISPLAY.NONE) return null;

    const label = PROF_NAMES[normalizedRank] || PROF_NAMES[0];
    if (displayMode === SKILL_PROFICIENCY_DISPLAY.STARS) {
        const filled = normalizedRank / 2;
        return (
            <span className="inline-flex shrink-0 gap-0.5" aria-label={label} title={label}>
                {[1, 2, 3, 4].map(index => (
                    <Star
                        key={index}
                        className={`size-3 ${index <= filled ? 'fill-primary text-primary' : 'text-muted-foreground/50'}`}
                        aria-hidden="true"
                    />
                ))}
            </span>
        );
    }

    return (
        <span className="shrink-0 text-xs text-muted-foreground" title={label}>
            {displayMode === SKILL_PROFICIENCY_DISPLAY.SHORT ? SHORT_NAMES[normalizedRank] : label}
        </span>
    );
}

function normalizeRank(value) {
    const rank = Number(value) || 0;
    return [0, 2, 4, 6, 8].includes(rank) ? rank : 0;
}
