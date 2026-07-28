import React from 'react';
import { calculateStat } from '../../utils/rules';
import { LongPressable } from '../../shared/components/LongPressable';
import SkillProficiencyIndicator from '../components/SkillProficiencyIndicator';

export function SkillsSection({ character, onOpenModal, onLongPress, proficiencyDisplay = 'none' }) {
    const skillAbility = {
        acrobatics: 'Dex',
        arcana: 'Int',
        athletics: 'Str',
        crafting: 'Int',
        deception: 'Cha',
        diplomacy: 'Cha',
        intimidation: 'Cha',
        medicine: 'Wis',
        nature: 'Wis',
        occultism: 'Int',
        performance: 'Cha',
        perform: 'Cha',
        religion: 'Wis',
        society: 'Int',
        stealth: 'Dex',
        survival: 'Wis',
        thievery: 'Dex',
        intimidate: 'Cha'
    };

    const renderSkills = () => {
        return Object.entries(character.skills).sort().map(([name, val]) => {
            // Legacy check: some old dbs might have null values, ignore unless explicitly 0
            if (!val && val !== 0) return null;

            // Hide legacy Lore_1, Lore_2, etc. (User request)
            if (name.match(/^Lore_\d+$/)) return null;

            const calc = calculateStat(character, name, val);
            const isTrained = val > 0;

            // Dynamic Lore Detection
            let ability = skillAbility[name.toLowerCase()];
            // If not in map, check if it looks like a Lore skill
            if (!ability && name.toLowerCase().includes('lore')) {
                ability = 'Int';
            }

            const rawName = name.replace('_', ' ');
            let displayName = rawName.charAt(0).toUpperCase() + rawName.slice(1);

            // Adjust specific names if needed (though map handles keys)
            if (displayName === 'Intimidate') displayName = 'Intimidation';
            if (displayName === 'Perform') displayName = 'Performance';

            const label = ability ? `${displayName} (${ability})` : displayName;

            return (
                <LongPressable className="item-row" key={name}
                    onClick={() => onOpenModal('detail', { title: name.replace('_', ' '), ...calc })}
                    onLongPress={() => onLongPress && onLongPress({ key: name, name: label }, 'skill')}
                    style={{ marginBottom: '4px' }}
                >
                    <span className="item-name" style={{ color: isTrained ? 'var(--text-gold)' : '#ccc' }}>
                        {label} {calc.penalty < 0 && <span className="stat-penalty-sub">({calc.penalty})</span>}
                        {calc.bonus > 0 && <span className="stat-bonus-sub">(+{calc.bonus})</span>}
                    </span>
                    <SkillProficiencyIndicator rank={val} displayMode={proficiencyDisplay} />
                    <span className={`skill-val ${calc.penalty < 0 ? 'stat-penalty' : (calc.bonus > 0 ? 'stat-bonus' : '')}`} style={{ color: isTrained && calc.penalty >= 0 && calc.bonus === 0 ? 'var(--text-gold)' : '' }}>
                        {calc.total >= 0 ? '+' : ''}{calc.total}
                    </span>
                </LongPressable>
            );
        });
    };

    return (
        <div>
            {renderSkills()}

            <div style={{ marginTop: 15, display: 'flex', justifyContent: 'center' }}>
                <button
                    className="btn-add-condition"
                    onClick={() => onOpenModal('add_lore')}
                    style={{ margin: 0, width: 'auto', padding: '6px 16px' }}
                >
                    + Add Lore
                </button>
            </div>
        </div>
    );
}
