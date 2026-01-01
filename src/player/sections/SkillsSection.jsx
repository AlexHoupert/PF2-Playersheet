import React from 'react';
import { calculateStat } from '../../utils/rules';
import { LongPressable } from '../../shared/components/LongPressable';

export function SkillsSection({ character, onOpenModal, onLongPress }) {
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
        religion: 'Wis',
        society: 'Int',
        stealth: 'Dex',
        survival: 'Wis',
        thievery: 'Dex',
        intimidate: 'Cha'
    };

    const renderSkills = () => {
        return Object.entries(character.skills).sort().map(([name, val]) => {
            if ((!val && val !== 0) && name.startsWith("Lore")) return null;

            const calc = calculateStat(character, name, val);
            const isTrained = val > 0;
            const baseSkill = name.split('_')[0].toLowerCase();
            const ability = baseSkill === 'lore' ? 'Int' : skillAbility[baseSkill];
            const rawName = name.replace('_', ' ');
            let displayName = rawName.charAt(0).toUpperCase() + rawName.slice(1);
            if (displayName === 'Intimidate') displayName = 'Intimidation';
            const label = ability ? `${displayName} (${ability})` : displayName;

            return (
                <LongPressable className="item-row" key={name}
                    onClick={() => onOpenModal('detail', { title: name.replace('_', ' '), ...calc })}
                    onLongPress={() => onLongPress && onLongPress({ key: name, name: label }, 'skill')}
                    style={{ marginBottom: '4px' }}
                >
                    <span className="item-name" style={{ color: isTrained ? 'var(--text-gold)' : '#ccc' }}>
                        {label} {calc.penalty < 0 && <span className="stat-penalty-sub">({calc.penalty})</span>}
                    </span>
                    <span className={`skill-val ${calc.penalty < 0 ? 'stat-penalty' : ''}`} style={{ color: isTrained && calc.penalty >= 0 ? 'var(--text-gold)' : '' }}>
                        {calc.total >= 0 ? '+' : ''}{calc.total}
                    </span>
                </LongPressable>
            );
        });
    };

    return (
        <div>
            {renderSkills()}
        </div>
    );
}
