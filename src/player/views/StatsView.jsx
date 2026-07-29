import React from 'react';
import { getCondLevel } from '../../utils/rules';
import { HealthBar } from '../../shared/components/HealthBar';
import { ActorEffectsSection } from '../../shared/components/ActorEffectsSection';
import { DefensesSection } from '../sections/DefensesSection';
import { AttributesSection } from '../sections/AttributesSection';
import { SkillsSection } from '../sections/SkillsSection';
import { buildActorRulesContext, buildActorStatsViewModel } from '../../shared/rules/actorRulesViewModel';
import { Button } from '@/components/ui/button';
import { ArrowDownAZ, ArrowDownWideNarrow } from 'lucide-react';
import { SKILL_SORT_MODE } from '../settings/playerUserSettings';

export function StatsView({
    character,
    campaign = null,
    conditions = [],
    displayEffects = [],
    rulesViewModel = null,
    characterActions,
    onOpenModal,
    onLongPress,
    onRemoveEffect,
    readOnly = false,
    userSettings = {},
    onChangeSkillSort,
}) {
    if (!character) return null;

    const actorRules = rulesViewModel || buildActorStatsViewModel(buildActorRulesContext({
        actor: character,
        effects: Array.isArray(conditions) ? conditions : [],
    }));
    const rulesCharacter = actorRules.character || character;
    const condDrained = getCondLevel('drained', rulesCharacter);
    // Drained reduces max HP by level * value
    const drainedPenalty = (condDrained || 0) * (character.level || 1);

    const totalPenalty = drainedPenalty;

    // Original Max
    const baseMaxHP = rulesCharacter.stats.hp.max;
    // Effective Max for calculation (HealthBar will handle display)
    // const maxHP = Math.max(1, baseMaxHP - totalPenalty); // Refactored to pass base & penalty

    const hp = rulesCharacter.stats.hp.current;
    const tempHP = rulesCharacter.stats.hp.temp;
    const skillSortMode = userSettings.skillSortMode || SKILL_SORT_MODE.ALPHABETICAL;
    const skillSortIsByValue = skillSortMode === SKILL_SORT_MODE.VALUE;
    const skillSortLabel = skillSortIsByValue
        ? 'Skills sorted by highest value. Sort alphabetically.'
        : 'Skills sorted alphabetically. Sort by highest value.';

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

            <ActorEffectsSection
                actorRules={actorRules}
                campaign={campaign}
                displayEffects={displayEffects}
                canManageEffects={!readOnly}
                onOpenEffect={(effect) => onOpenModal('conditionInfo', effect)}
                onAddCondition={() => onOpenModal('conditions', null)}
                onRemoveEffect={onRemoveEffect}
            />

            <DefensesSection
                character={rulesCharacter}
                rulesViewModel={actorRules}
                characterActions={characterActions}
                onOpenModal={onOpenModal}
                onLongPress={onLongPress}
            />

            <div className="player-skills-heading">
                <h3>Attributes & Skills</h3>
                {onChangeSkillSort && (
                    <Button
                        type="button"
                        variant="outline"
                        size="icon-sm"
                        className="player-skills-sort-button"
                        title={skillSortLabel}
                        aria-label={skillSortLabel}
                        data-testid="player-skill-sort"
                        onClick={() => onChangeSkillSort(
                            skillSortIsByValue ? SKILL_SORT_MODE.ALPHABETICAL : SKILL_SORT_MODE.VALUE
                        )}
                    >
                        {skillSortIsByValue ? <ArrowDownWideNarrow /> : <ArrowDownAZ />}
                    </Button>
                )}
            </div>

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
                            proficiencyDisplay={userSettings.skillProficiencyDisplay}
                            sortMode={skillSortMode}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
