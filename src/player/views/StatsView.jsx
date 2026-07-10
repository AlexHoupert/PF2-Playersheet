import React from 'react';
import { getCondLevel } from '../../utils/rules';
import { HealthBar } from '../../shared/components/HealthBar';
import { ConditionList } from '../../shared/components/ConditionList';
import { DefensesSection } from '../sections/DefensesSection';
import { AttributesSection } from '../sections/AttributesSection';
import { SkillsSection } from '../sections/SkillsSection';
import { buildActorRulesContext, buildActorStatsViewModel } from '../../shared/rules/actorRulesViewModel';

export function StatsView({ character, conditions = [], displayEffects = [], rulesViewModel = null, characterActions, onOpenModal, onLongPress, readOnly = false }) {
    if (!character) return null;

    const actorRules = rulesViewModel || buildActorStatsViewModel(buildActorRulesContext({
        actor: character,
        effects: Array.isArray(conditions) ? conditions : [],
    }));
    const rulesCharacter = actorRules.character || character;
    const condDrained = getCondLevel('drained', rulesCharacter);
    // Drained reduces max HP by level * value
    const drainedPenalty = (condDrained || 0) * (character.level || 1);

    // Quicksilver Mutagen Penalty (2 * Level)
    const hasQuicksilver = (actorRules.effects || []).some(effect => String(effect?.label || effect?.name || '').toLowerCase().includes('quicksilver mutagen'));
    const quicksilverPenalty = hasQuicksilver ? ((character.level || 1) * 2) : 0;

    const totalPenalty = drainedPenalty + quicksilverPenalty;

    // Original Max
    const baseMaxHP = rulesCharacter.stats.hp.max;
    // Effective Max for calculation (HealthBar will handle display)
    // const maxHP = Math.max(1, baseMaxHP - totalPenalty); // Refactored to pass base & penalty

    const hp = rulesCharacter.stats.hp.current;
    const tempHP = rulesCharacter.stats.hp.temp;

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
                conditions={displayEffects}
                onClick={(effect) => onOpenModal('conditionInfo', effect)}
                onAdd={() => onOpenModal('conditions', null)}
                readOnly={readOnly}
            />

            <DefensesSection
                character={rulesCharacter}
                rulesViewModel={actorRules}
                characterActions={characterActions}
                onOpenModal={onOpenModal}
                onLongPress={onLongPress}
            />

            <h3 style={{ borderBottom: '1px solid #5c4033', paddingBottom: 5, marginBottom: 15 }}>Attributes & Skills</h3>

            <div className="main-layout">
                <div className="left-column">
                    <AttributesSection
                        character={rulesCharacter}
                        onOpenModal={onOpenModal}
                        onLongPress={onLongPress}
                    />
                </div>

                <div className="right-column">
                    <div className="skills-container">
                        <SkillsSection
                            character={rulesCharacter}
                            onOpenModal={onOpenModal}
                            onLongPress={onLongPress}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
