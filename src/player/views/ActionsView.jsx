import React, { useState } from 'react';
import { getAllActionIndexItems } from '../../shared/catalog/actionIndex';
import { calculateStat, formatText, ACTION_ICONS } from '../../shared/utils/rules';

export function ActionsView({ character, onOpenModal }) {
    const [activeTab, setActiveTab] = useState('Combat');

    // 1. Collect Actions
    const allActions = getAllActionIndexItems().map(a => ({
        ...a,
        type: a.userType || a.type || 'Other',
        subtype: a.userSubtype || a.subtype || 'General',
        isCustom: a.sourceFile?.startsWith('actions/') || false
    }));

    // 2. Feat Prerequisite Filtering
    const knownFeats = new Set((character.feats || []).map(f => (typeof f === 'string' ? f : f.name)));

    const categorized = [];
    allActions.forEach(a => {
        if (a.feat && !knownFeats.has(a.feat)) return;

        const rawType = a.userType || a.type || "Other";
        const rawSub = a.userSubtype || a.subtype || "General";

        const types = Array.isArray(rawType) ? rawType : [rawType];
        const subtypes = Array.isArray(rawSub) ? rawSub : [rawSub];

        types.forEach((t, index) => {
            let mappedSub = subtypes[index];
            if (!mappedSub) mappedSub = subtypes[0] || "General";

            categorized.push({
                ...a,
                type: t,
                subtype: mappedSub,
                _entityType: 'action'
            });
        });
    });

    // Filter by active tab
    const filteredActions = categorized.filter(a => a.type === activeTab);

    // Group by Subtype
    const grouped = {};
    filteredActions.forEach(a => {
        const sub = a.subtype || "General";
        if (!grouped[sub]) grouped[sub] = [];
        grouped[sub].push(a);
    });

    const subtypePriority = [
        'Attack', 'Defense', 'Social', 'Assist',
        'Ground', 'Jumping & Falling', 'Maneuver',
        'Cloak & Dagger', 'Other', 'Downtime'
    ];

    const sortedSubtypes = Object.keys(grouped).sort((a, b) => {
        let ia = subtypePriority.indexOf(a);
        let ib = subtypePriority.indexOf(b);
        if (ia === -1) ia = 99;
        if (ib === -1) ib = 99;
        if (ia !== ib) return ia - ib;
        return a.localeCompare(b);
    });

    // Calculate Available Tabs
    const allTypes = new Set();
    categorized.forEach(a => allTypes.add(a.type));

    const tabPriority = ['Combat', 'Movement', 'Skills', 'Other'];
    const availableTabs = Array.from(allTypes).sort((a, b) => {
        let ia = tabPriority.indexOf(a);
        let ib = tabPriority.indexOf(b);
        if (ia === -1) ia = 99;
        if (ib === -1) ib = 99;
        if (ia !== ib) return ia - ib;
        return a.localeCompare(b);
    });

    const actionPriority = [
        'Strike', 'Feint', 'Shove', 'Trip', 'Grapple', 'Escape', 'Raise a Shield', 'Take Cover',
        'Stride', 'Step', 'Leap', 'Long Jump', 'High Jump', 'Arrest a Fall', 'Grab an Edge',
        'Sense Motive', 'Make an Impression', 'Lie', 'Coerce', 'Impersonate',
        'Sneak', 'Hide', 'Steal', 'Pick a Lock', 'Palm an Object', 'Recall Knowledge', 'Seek', 'Treat Wounds'
    ];

    return (
        <div>
            <div className="sub-tabs">
                {availableTabs.map(t => (
                    <button key={t} className={`sub-tab-btn ${activeTab === t ? 'active' : ''}`} onClick={() => setActiveTab(t)}>
                        {t === 'Other' ? 'Exploration' : t}
                    </button>
                ))}
            </div>

            {sortedSubtypes.map(sub => (
                <div key={sub}>
                    {sub !== "General" && sortedSubtypes.length > 1 && <div className="action-subtype-header">{sub}</div>}
                    {grouped[sub].sort((a, b) => {
                        let ia = actionPriority.indexOf(a.name);
                        let ib = actionPriority.indexOf(b.name);
                        if (ia === -1) ia = 999;
                        if (ib === -1) ib = 999;
                        if (ia === 999 && ib === 999) return a.name.localeCompare(b.name);
                        return ia - ib;
                    }).map(action => {
                        let bonusVal = null;
                        let bestLabel = null;

                        const skillDef = action.skill;
                        if (skillDef) {
                            let skillsToCheck = Array.isArray(skillDef) ? skillDef : [skillDef];
                            let best = -999;

                            skillsToCheck.forEach(s => {
                                if (s === 'ToHit') return;

                                if (s === 'Perception') {
                                    const calc = calculateStat(character, "Perception", character.stats.perception);
                                    if (calc && calc.total > best) {
                                        best = calc.total;
                                        bestLabel = "Perception";
                                    }
                                    return;
                                }

                                const val = character.skills[s] || 0;
                                const calc = calculateStat(character, s, val);
                                if (calc && calc.total > best) {
                                    best = calc.total;
                                    bestLabel = s.replace(/_/g, ' ');
                                }
                            });

                            if (best > -999) bonusVal = best;
                        }

                        let ActionIcon = null;
                        if (action.typeCode === '1') ActionIcon = ACTION_ICONS['[one-action]'];
                        else if (action.typeCode === '2') ActionIcon = ACTION_ICONS['[two-actions]'];
                        else if (action.typeCode === '3') ActionIcon = ACTION_ICONS['[three-actions]'];
                        else if (action.typeCode === 'R') ActionIcon = ACTION_ICONS['[reaction]'];
                        else if (action.typeCode === 'F') ActionIcon = ACTION_ICONS['[free-action]'];

                        return (
                            <div className="item-row" key={`${action.name}-${action.type}`}
                                onClick={() => onOpenModal('item', action)}
                            >
                                <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
                                    <span className="item-name" dangerouslySetInnerHTML={{ __html: formatText(action.name) }} />
                                    {ActionIcon && (
                                        <span style={{ marginLeft: 6, display: 'flex', alignItems: 'center' }}
                                            title={action.typeCode === 'R' ? 'Reaction' : action.typeCode === 'F' ? 'Free Action' : `${action.typeCode} Action(s)`}
                                            dangerouslySetInnerHTML={{ __html: ActionIcon }}
                                        />
                                    )}
                                </div>

                                {bestLabel && (
                                    <span style={{ marginRight: 8, color: 'rgba(255,255,255,0.5)', fontSize: '0.75em', fontStyle: 'italic' }}>
                                        ({bestLabel})
                                    </span>
                                )}

                                {bonusVal !== null && (
                                    <div style={{ color: 'var(--text-gold)', fontWeight: 'bold', fontSize: '1.1em', minWidth: '1.5em', textAlign: 'right' }}>
                                        {bonusVal >= 0 ? '+' : ''}{bonusVal}
                                    </div>
                                )}
                                {skillDef === 'ToHit' && (
                                    <div style={{ color: '#888', fontSize: '0.8em', fontStyle: 'italic' }}>Attack</div>
                                )}
                            </div>
                        );
                    })}
                </div>
            ))}
            {filteredActions.length === 0 && <div style={{ color: '#666', fontStyle: 'italic' }}>No actions found.</div>}
        </div>
    );
}
