import React from 'react';
import { calculateStat } from '../../shared/utils/rules';

export function AttributesSection({ character, onOpenModal, pressEvents }) {

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
                        <div className="attr-box" key={key} {...pressEvents?.({ key, label: ATTR_ABBREV[key] || key }, 'attribute')}>
                            <div className="attr-val">{val >= 0 ? `+${val}` : val}</div>
                            <div className="attr-label">{ATTR_ABBREV[key] || key.substring(0, 3)}</div>
                        </div>
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
                <div className="eye-box"
                    onClick={() => {
                        const calc = calculateStat(character, "Perception", character.stats.perception);
                        onOpenModal('detail', { title: "Perception", ...calc });
                    }}
                    {...pressEvents?.(character.stats.perception, 'perception')}
                >
                    <div className="eye-content">
                        <span>+{calculateStat(character, "Perception", character.stats.perception).total}</span>
                        <span style={{ fontSize: '0.4em', textTransform: 'uppercase' }}>Perception</span>
                    </div>
                </div>
                <div className="senses-box">
                    {character.senses.length ? character.senses.join(", ") : "Normal"}
                </div>
            </div>

            {/* Speed */}
            <div className="special-stat-group">
                <div className="circle-box"
                    onClick={() => {
                        onOpenModal('item', { title: "Speed", description: Object.entries(character.stats.speed).map(([k, v]) => `${k}: ${v} ft`).join('\n') });
                    }}
                    {...pressEvents?.(character.stats.speed, 'speed')}
                >
                    <div className="circle-content">
                        <span>{character.stats.speed.land}</span>
                        <span style={{ fontSize: '0.4em', textTransform: 'uppercase' }}>Speed</span>
                    </div>
                </div>
            </div>

            {/* Class DC */}
            <div className="special-stat-group">
                <div className="diamond-box" {...pressEvents?.(null, 'class_dc')}>
                    <div className="diamond-content">
                        <span>{character.stats.class_dc}</span>
                        <span style={{ fontSize: '0.4em', textTransform: 'uppercase' }}>Class DC</span>
                    </div>
                </div>
            </div>
        </div>
    );

    const renderLanguages = () => (
        <div className="languages-box" {...pressEvents?.(null, 'language')}>
            <div className="lang-header">Languages</div>
            <div className="lang-list">
                {character.languages.map(l => <div key={l} className="lang-item">{l}</div>)}
            </div>
        </div>
    );

    return (
        <>
            {renderAttributes()}
            {renderSpecialStats()}
            {renderLanguages()}
        </>
    );
}
