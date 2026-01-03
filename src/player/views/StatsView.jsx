import React from 'react';
import { getCondLevel } from '../../utils/rules';
import { HealthBar } from '../../shared/components/HealthBar';
import { ConditionList } from '../../shared/components/ConditionList';
import { DefensesSection } from '../sections/DefensesSection';
import { AttributesSection } from '../sections/AttributesSection';
import { SkillsSection } from '../sections/SkillsSection';

export function StatsView({ character, updateCharacter, onOpenModal, onLongPress }) {
    if (!character) return null;

    const condDrained = getCondLevel('drained', character);
    // Drained reduces max HP by level * value
    const drainedPenalty = (condDrained || 0) * (character.level || 1);

    // Quicksilver Mutagen Penalty (2 * Level)
    const hasQuicksilver = character.conditions?.some(c => c.name.toLowerCase().includes('quicksilver mutagen'));
    const quicksilverPenalty = hasQuicksilver ? ((character.level || 1) * 2) : 0;

    const totalPenalty = drainedPenalty + quicksilverPenalty;

    // Original Max
    const baseMaxHP = character.stats.hp.max;
    // Effective Max for calculation (HealthBar will handle display)
    // const maxHP = Math.max(1, baseMaxHP - totalPenalty); // Refactored to pass base & penalty

    const hp = character.stats.hp.current;
    const tempHP = character.stats.hp.temp;

    return (
        <div>
            <div style={{ marginBottom: 15 }}>
                <HealthBar
                    current={hp}
                    max={baseMaxHP}
                    penalty={totalPenalty}
                    temp={tempHP}
                    onClick={() => onOpenModal('hp')}
                    onLongPress={onLongPress}
                />
            </div>

            <ConditionList
                conditions={character.conditions}
                onClick={(c) => onOpenModal('conditionInfo', c.name)}
                onAdd={() => onOpenModal('conditions', null)}
            />

            <DefensesSection
                character={character}
                updateCharacter={updateCharacter}
                onOpenModal={onOpenModal}
                onLongPress={onLongPress}
            />

            <h3 style={{ borderBottom: '1px solid #5c4033', paddingBottom: 5, marginBottom: 15 }}>Attributes & Skills</h3>

            <div className="main-layout">
                <div className="left-column">
                    <AttributesSection
                        character={character}
                        onOpenModal={onOpenModal}
                        onLongPress={onLongPress}
                    />
                </div>

                <div className="right-column">
                    <div className="skills-container">
                        <SkillsSection
                            character={character}
                            onOpenModal={onOpenModal}
                            onLongPress={onLongPress}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
