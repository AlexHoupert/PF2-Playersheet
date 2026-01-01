import React, { useState, useMemo } from 'react';
import { getAllActionIndexItems } from '../../shared/catalog/actionIndex';
import { calculateStat, ACTION_ICONS, formatText } from '../../utils/rules';
import { LongPressable } from '../../shared/components/LongPressable';

export function ActionsView({ character, onOpenModal, onLongPress }) {
    const [activeTab, setActiveTab] = useState('Combat');

    // 1. Collect Actions: Index based only (File System) & Flatten
    const categorizedActions = useMemo(() => {
        const allActions = getAllActionIndexItems().map(a => ({
            ...a,
            type: a.userType || a.type || 'Other',
            subtype: a.userSubtype || a.subtype || 'General',
            isCustom: a.sourceFile?.startsWith('actions/') || false
        }));

        const knownFeats = new Set((character.feats || []).map(f => (typeof f === 'string' ? f : f.name)));
        const result = [];

        allActions.forEach(a => {
            if (a.feat && !knownFeats.has(a.feat)) return;

            const rawType = a.userType || a.type || "Other";
            const rawSub = a.userSubtype || a.subtype || "General";

            const types = Array.isArray(rawType) ? rawType : [rawType];
            const subtypes = Array.isArray(rawSub) ? rawSub : [rawSub];

            types.forEach((t, index) => {
                let mappedSub = subtypes[index] || subtypes[0] || "General";
                result.push({
                    ...a,
                    type: t,
                    subtype: mappedSub,
                    _entityType: 'action'
                });
            });
        });

        return result;
    }, [character.feats]);

    // Calculate available tabs
    const availableTabs = useMemo(() => {
        const allTypes = new Set(categorizedActions.map(a => a.type));
        const tabPriority = ['Combat', 'Movement', 'Skills', 'Other'];

        return Array.from(allTypes).sort((a, b) => {
            let ia = tabPriority.indexOf(a);
            let ib = tabPriority.indexOf(b);
            if (ia === -1) ia = 99;
            if (ib === -1) ib = 99;
            if (ia !== ib) return ia - ib;
            return a.localeCompare(b);
        });
    }, [categorizedActions]);

    // Filter and Group
    const groupedActions = useMemo(() => {
        const filtered = categorizedActions.filter(a => a.type === activeTab);
        const grouped = {};
        filtered.forEach(a => {
            const sub = a.subtype || "General";
            if (!grouped[sub]) grouped[sub] = [];
            grouped[sub].push(a);
        });
        return grouped;
    }, [categorizedActions, activeTab]);

    const subtypePriority = [
        'Attack', 'Defense', 'Social', 'Assist',
        'Ground', 'Jumping & Falling', 'Maneuver',
        'Cloak & Dagger', 'Other', 'Downtime'
    ];

    const sortedSubtypes = Object.keys(groupedActions).sort((a, b) => {
        let ia = subtypePriority.indexOf(a);
        let ib = subtypePriority.indexOf(b);
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
            {/* Tabs */}
            <div className="sub-tabs">
                {availableTabs.map(t => (
                    <button
                        key={t}
                        className={`sub-tab-btn ${activeTab === t ? 'active' : ''}`}
                        onClick={() => setActiveTab(t)}
                    >
                        {t === 'Other' ? 'Exploration' : t}
                    </button>
                ))}
            </div>

            {/* List */}
            {sortedSubtypes.map(sub => (
                <div key={sub}>
                    {sub !== "General" && sortedSubtypes.length > 1 && (
                        <div className="action-subtype-header">{sub}</div>
                    )}

                    {groupedActions[sub].sort((a, b) => {
                        let ia = actionPriority.indexOf(a.name);
                        let ib = actionPriority.indexOf(b.name);
                        if (ia === -1) ia = 999;
                        if (ib === -1) ib = 999;
                        if (ia === 999 && ib === 999) return a.name.localeCompare(b.name);
                        return ia - ib;
                    }).map(action => {
                        // Calculate Bonus Logic
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
                                const val = character.skills[s] || (s === 'Intimidation' ? character.skills['Intimidate'] : 0) || 0;
                                const calc = calculateStat(character, s, val);
                                if (calc && calc.total > best) {
                                    best = calc.total;
                                    bestLabel = s.replace(/_/g, ' '); // simple format if needed
                                }
                            });

                            if (best > -999) bonusVal = best;
                        }

                        // Icon Logic (Suffix)
                        let ActionIcon = null;
                        if (action.typeCode === '1') ActionIcon = ACTION_ICONS['[one-action]'];
                        else if (action.typeCode === '2') ActionIcon = ACTION_ICONS['[two-actions]'];
                        else if (action.typeCode === '3') ActionIcon = ACTION_ICONS['[three-actions]'];
                        else if (action.typeCode === 'R') ActionIcon = ACTION_ICONS['[reaction]'];
                        else if (action.typeCode === 'F') ActionIcon = ACTION_ICONS['[free-action]'];

                        return (
                            <LongPressable
                                className="item-row"
                                key={`${action.name}-${action.type}`}
                                onClick={() => onOpenModal('item', { ...action, _entityType: 'action' })}
                                onLongPress={() => onLongPress && onLongPress(action, 'action')}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                                    <div className="item-row-main" style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                                        <div className="item-name" style={{ color: '#e0e0e0' }} dangerouslySetInnerHTML={{ __html: formatText(action.name) }} />
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
                            </LongPressable>
                        );
                    })}
                </div>
            ))}
        </div>
    );
}
