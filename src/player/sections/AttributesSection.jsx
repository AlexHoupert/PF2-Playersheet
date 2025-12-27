import React from 'react';
import { calculateStat } from '../../utils/rules';
import { LongPressable } from '../../shared/components/LongPressable';

export function AttributesSection({ character, onOpenModal, onLongPress }) {

    const ATTR_ABBREV = {
        "strength": "STR", "dexterity": "DEX", "constitution": "CON",
        "intelligence": "INT", "wisdom": "WIS", "charisma": "CHA"
    };

    const renderAttributes = () => {
        const orderedKeys = ["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"];
        return (
            <div className="attributes-container">
                {orderedKeys.map(key => {
                    const val = character.stats.attributes[key] || 0;
                    return (
                        <LongPressable
                            className="attr-box"
                            key={key}
                            onLongPress={() => onLongPress && onLongPress({ key, label: ATTR_ABBREV[key] || key }, 'attribute')}
                        >
                            <div className="attr-val">{val >= 0 ? `+${val}` : val}</div>
                            <div className="attr-label">{ATTR_ABBREV[key] || key.substring(0, 3)}</div>
                        </LongPressable>
                    );
                })}
            </div>
        );
    };

    const renderSpecialStats = () => (
        <div className="special-stats-row">
            <div style={{ width: '100%', height: '1px', backgroundColor: '#5c4033', margin: '5px 0' }}></div>
            {/* Perception */}
            <div className="special-stat-group">
                <LongPressable className="eye-box"
                    onClick={() => {
                        const calc = calculateStat(character, "Perception", character.stats.perception);
                        onOpenModal('detail', { title: "Perception", ...calc });
                    }}
                    onLongPress={() => onLongPress && onLongPress(character.stats.perception, 'perception')}
                >
                    <div className="eye-content">
                        <span>+{calculateStat(character, "Perception", character.stats.perception).total}</span>
                        <span style={{ fontSize: '0.4em', textTransform: 'uppercase' }}>Perception</span>
                    </div>
                </LongPressable>
                <div className="senses-box">
                    {character.senses && character.senses.length ? character.senses.join(", ") : "Normal"}
                </div>
            </div>

            {/* Speed */}
            <div className="special-stat-group">
                <LongPressable className="circle-box"
                    onClick={() => {
                        onOpenModal('item', { title: "Speed", description: Object.entries(character.stats.speed || { land: 25 }).map(([k, v]) => `${k}: ${v} ft`).join('\n') });
                    }}
                    onLongPress={() => onLongPress && onLongPress(character.stats.speed, 'speed')}
                >
                    <div className="circle-content">
                        <span>{character.stats.speed?.land || 0}</span>
                        <span style={{ fontSize: '0.4em', textTransform: 'uppercase' }}>Speed</span>
                    </div>
                </LongPressable>
            </div>

            {/* Class DC */}
            <div className="special-stat-group">
                <LongPressable className="diamond-box" onLongPress={() => onLongPress && onLongPress(null, 'class_dc')}>
                    <div className="diamond-content">
                        <span>{character.stats.class_dc || 10}</span>
                        <span style={{ fontSize: '0.4em', textTransform: 'uppercase' }}>Class DC</span>
                    </div>
                </LongPressable>
            </div>
        </div>
    );

    const renderLanguages = () => (
        <LongPressable className="languages-box" onLongPress={() => onLongPress && onLongPress(null, 'language')}>
            <div className="lang-header">Languages</div>
            <div className="lang-list">
                {(character.languages || []).map(l => <div key={l} className="lang-item">{l}</div>)}
            </div>
        </LongPressable>
    );

    return (
        <>
            {renderAttributes()}
            {renderSpecialStats()}
            {renderLanguages()}
        </>
    );
}
