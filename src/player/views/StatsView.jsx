import React from 'react';
import { HealthBar } from '../../shared/components/HealthBar';
import { ConditionList } from '../../shared/components/ConditionList';
import { DefensesSection } from '../sections/DefensesSection';
import { AttributesSection } from '../sections/AttributesSection';
import { SkillsSection } from '../sections/SkillsSection';

export function StatsView({ character, updateCharacter, onOpenModal, pressEvents }) {
    if (!character) return null;

    const hp = character.stats.hp.current;
    const maxHp = character.stats.hp.max;
    const tempHp = character.stats.hp.temp;

    return (
        <div className="stats-view">
            {/* TOP SECTION: HP, Conditions, Defenses */}
            <HealthBar
                hp={hp}
                maxHp={maxHp}
                tempHp={tempHp}
                onClick={() => onOpenModal('hp', null)}
                style={{ marginBottom: 10 }}
            />

            <ConditionList
                conditions={character.conditions}
                onConditionClick={(c) => {
                    onOpenModal('conditionInfo', c.name); // passing name or object? PlayerApp passed 'condition' mode and relied on selection?
                    // Revisit Modal Logic: PlayerApp setModalMode('condition') then inside generic modal rendered ConditionEditor.
                    // But if clicking a specific badge, we might want detail?
                    // PlayerApp line 1105: setModalMode('condition'); setCondTab('active');
                    // It opens the Editor.
                    onOpenModal('condition', null);
                }}
                onAddClick={() => onOpenModal('condition', null)}
            />

            <DefensesSection
                character={character}
                updateCharacter={updateCharacter}
                onOpenModal={onOpenModal}
                pressEvents={pressEvents}
            />

            <h3 style={{ borderBottom: '1px solid #5c4033', paddingBottom: 5, marginBottom: 15 }}>Attributes & Skills</h3>

            <div className="main-layout">
                <div className="left-column">
                    <AttributesSection
                        character={character}
                        onOpenModal={onOpenModal}
                        pressEvents={pressEvents}
                    />
                </div>

                <div className="right-column">
                    <div className="skills-container">
                        <SkillsSection
                            character={character}
                            onOpenModal={onOpenModal}
                            pressEvents={pressEvents}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
