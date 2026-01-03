import React, { useState, useEffect } from 'react';
import {
    NEG_CONDS, POS_CONDS, VIS_CONDS, BINARY_CONDS, getConditionIcon
} from '../../shared/constants/conditions';
import { getConditionImgSrc, isConditionValued, getConditionCatalogEntry } from '../../shared/constants/conditionsCatalog';
import { formatText } from '../../utils/rules'; // Ensure rules util is imported

/**
 * @typedef {Object} Condition
 * @property {string} name - The name of the condition (e.g., 'Frightened').
 * @property {number} [level] - The magnitude/value of the condition (if applicable).
 */

/**
 * @typedef {Object} Character
 * @property {Condition[]} conditions - List of active conditions on the character.
 * @property {string} name - Character name.
 * @property {Object} [magic] - Magic related properties.
 */

/**
 * Modal component for managing character conditions.
 * Displays a categorized list of conditions and allows adding/removing/incrementing them.
 * Also handles displaying detailed information about a selected condition.
 * 
 * @param {Object} props
 * @param {Character} props.character - The character object.
 * @param {Function} props.updateCharacter - State setter for character.
 * @param {Function} props.onClose - Handler to close the modal.
 * @param {string} [props.initialCondition] - Name of a condition to show details for immediately.
 * @param {Object[]} [props.modalHistory] - History stack for back navigation support (optional).
 * @param {Function} [props.onBack] - Handler for back navigation (optional).
 */
export function ConditionsModal({
    character,
    updateCharacter,
    onClose,
    initialCondition = null,
    modalHistory = [],
    onBack,
    onContentLinkClick
}) {
    // --- STATE ---

    // Internal state to track which condition is being viewed (if any).
    // If initialCondition is provided, start with that.
    const [selectedCondition, setSelectedCondition] = useState(initialCondition);

    // Tab state for the list view
    const safeConds = character?.conditions || [];
    const hasActive = safeConds.some(c => {
        const name = (typeof c === 'string') ? c : c?.name;
        const level = (typeof c === 'string') ? 1 : (c?.level || 0);
        return isConditionValued(name) ? level > 0 : true;
    });
    const [activeTab, setActiveTab] = useState(hasActive ? 'ACTIVE' : 'NEGATIVE');

    // --- EFFECT ---

    // If props change to force a view, update state.
    useEffect(() => {
        if (initialCondition) {
            setSelectedCondition(initialCondition);
        }
    }, [initialCondition]);

    // Lock background scroll while this modal is open (prevents the page behind from scrolling on mobile).
    useEffect(() => {
        const body = document.body;
        const html = document.documentElement;

        const prevBodyOverflow = body.style.overflow;
        const prevBodyPosition = body.style.position;
        const prevBodyTop = body.style.top;
        const prevBodyWidth = body.style.width;
        const prevHtmlOverflow = html.style.overflow;

        const scrollY = window.scrollY || 0;

        html.style.overflow = 'hidden';
        body.style.overflow = 'hidden';
        body.style.position = 'fixed';
        body.style.top = `-${scrollY}px`;
        body.style.width = '100%';

        return () => {
            html.style.overflow = prevHtmlOverflow;
            body.style.overflow = prevBodyOverflow;
            body.style.position = prevBodyPosition;
            body.style.top = prevBodyTop;
            body.style.width = prevBodyWidth;
            window.scrollTo(0, scrollY);
        };
    }, []);


    // --- HELPERS ---

    const TABS = ['ACTIVE', 'NEGATIVE', 'POSITIVE', 'VISIBILITY'];
    const DISPLAY_TABS = hasActive ? TABS : TABS.filter(t => t !== 'ACTIVE');

    /**
     * Helper to retrieve the list of conditions for the current tab.
     * @param {string} tab - Tab name.
     * @returns {string[]} List of condition names.
     */
    const getListForTab = (tab) => {
        if (tab === 'ACTIVE') {
            return safeConds
                .filter(c => (c.level > 0))
                .map(c => c.name);
        }
        if (tab === 'NEGATIVE') return NEG_CONDS;
        if (tab === 'POSITIVE') return POS_CONDS;
        if (tab === 'VISIBILITY') return VIS_CONDS;
        // Binary/Other fallback
        return BINARY_CONDS;
    };

    /**
     * Adds, removes, or modifies the level of a condition.
     * @param {string} condName - Name of the condition.
     * @param {number} delta - +1 to add/increment, -1 to remove/decrement.
     */
    const adjustCondition = (condName, delta) => {
        if (!condName) return;
        const targetKey = String(condName).toLowerCase();
        const canonicalName = getConditionCatalogEntry(condName)?.name || condName;

        updateCharacter(c => {
            if (!c.conditions) c.conditions = [];
            const idx = c.conditions.findIndex(x => {
                const name = (typeof x === 'string') ? x : x?.name;
                return String(name || '').toLowerCase() === targetKey;
            });
            const valued = isConditionValued(condName);

            if (idx > -1 && typeof c.conditions[idx] === 'string') {
                c.conditions[idx] = { name: c.conditions[idx], level: 1 };
            }
            if (idx > -1 && c.conditions[idx] && typeof c.conditions[idx] === 'object') {
                c.conditions[idx].name = canonicalName;
            }

            const isDrained = targetKey === 'drained';
            const prevDrained = isDrained && idx > -1 ? (parseInt(c.conditions[idx].level) || 0) : 0;

            if (!valued) {
                // Binary conditions (toggle)
                if (delta > 0) {
                    if (idx === -1) c.conditions.push({ name: canonicalName, level: 1 });
                } else {
                    if (idx > -1) c.conditions.splice(idx, 1);
                }
                return;
            }

            // Valued conditions (Frightened 1, 2, etc.)
            if (delta > 0) {
                if (idx > -1) c.conditions[idx].level = (c.conditions[idx].level || 0) + 1;
                else c.conditions.push({ name: canonicalName, level: 1 });
            } else if (idx > -1) {
                const nextLevel = (c.conditions[idx].level || 0) - 1;
                if (nextLevel <= 0) c.conditions.splice(idx, 1);
                else c.conditions[idx].level = nextLevel;
            }

            // Drained: lose HP equal to (level * increase), without counting as damage.
            if (isDrained && delta > 0) {
                const newIdx = c.conditions.findIndex(x => {
                    const name = (typeof x === 'string') ? x : x?.name;
                    return String(name || '').toLowerCase() === targetKey;
                });
                const nextDrained = newIdx > -1 ? (parseInt(c.conditions[newIdx].level) || 0) : 0;
                const diff = Math.max(0, nextDrained - prevDrained);
                if (diff > 0) {
                    const charLevel = Math.max(1, parseInt(c.level) || 1);
                    const hpLoss = charLevel * diff;
                    if (!c.stats) c.stats = {};
                    if (!c.stats.hp) c.stats.hp = { current: 0, max: 0, temp: 0 };
                    const currentHp = parseInt(c.stats.hp.current) || 0;
                    c.stats.hp.current = Math.max(0, currentHp - hpLoss);
                }
            }
        });
    };


    // --- RENDERERS ---

    /**
     * Renders the Detail View for a specific condition.
     */
    const renderDetailView = () => {
        const condName = selectedCondition;
        const entry = getConditionCatalogEntry(condName);
        const iconSrc = getConditionImgSrc(condName);
        const active = safeConds.find(c => String((typeof c === 'string') ? c : c?.name || '').toLowerCase() === String(condName).toLowerCase());
        const level = (active && typeof active === 'object') ? active.level : (active ? 1 : 0);
        const displayName = entry?.name || condName;

        return (
            <div style={{ padding: '0 20px 20px 20px', display: 'flex', flexDirection: 'column', height: '100%' }}>
                {/* Header / Nav */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 15 }}>
                    <button
                        type="button"
                        style={{
                            width: 'auto', padding: '8px 12px', marginTop: 0,
                            background: '#333', color: '#ccc', border: '1px solid #555', borderRadius: 4, cursor: 'pointer',
                            // If we have history (from another modal), use back logic. 
                            // If we just drilled down from list, go back to list.
                        }}
                        onClick={(e) => {
                            e.stopPropagation();
                            if (initialCondition && onBack) {
                                // If specifically opened as "Condition Info" from somewhere else (like chat link)
                                onBack();
                            } else {
                                // Go back to list
                                setSelectedCondition(null);
                            }
                        }}
                    >
                        ← Back
                    </button>
                    <h2 style={{ margin: 0, flex: 1, textAlign: 'center' }}>{displayName}</h2>
                    <div style={{ width: 72 }} /> {/* Spacer for centering */}
                </div>

                {/* Controls */}
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                    {iconSrc ? (
                        <img src={iconSrc} alt="" style={{ width: 48, height: 48, objectFit: 'contain' }} />
                    ) : (
                        <span style={{ fontSize: '2em' }}>{getConditionIcon(condName) || "⚪"}</span>
                    )}

                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <button onClick={() => adjustCondition(condName, -1)} style={{ width: 32, height: 32, cursor: 'pointer' }}>-</button>
                        <span style={{ minWidth: 24, textAlign: 'center', fontSize: '1.2em', fontWeight: 'bold' }}>{level}</span>
                        <button onClick={() => adjustCondition(condName, 1)} style={{ width: 32, height: 32, cursor: 'pointer' }}>+</button>
                    </div>
                </div>

                {/* Description Content */}
                <div
                    className="formatted-content"
                    dangerouslySetInnerHTML={{ __html: formatText(entry?.description || "No description.", { actor: character }) }}
                    style={{ flex: 1, overflowY: 'auto', overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch' }}
                />
            </div>
        );
    };

    /**
     * Renders the List/Grid View of available conditions.
     */
    const renderListView = () => {
        const rawList = Array.isArray(getListForTab(activeTab)) ? [...getListForTab(activeTab)] : [];

        const getDisplayName = (name) => {
            const entry = getConditionCatalogEntry(name);
            return entry?.name || String(name || '');
        };

        let sortedList = rawList.sort((a, b) => getDisplayName(a).localeCompare(getDisplayName(b)));

        if (activeTab === 'NEGATIVE') {
            const NEGATIVE_GROUPS = [
                {
                    title: 'Control & Positioning',
                    items: ['off-guard', 'prone', 'grabbed', 'restrained', 'immobilized', 'stunned', 'paralyzed', 'petrified']
                },
                {
                    title: 'Lowered Abilities',
                    items: ['frightened', 'clumsy', 'drained', 'enfeebled', 'stupefied', 'sickened', 'fatigued', 'encumbered', 'slowed']
                },
                { title: 'Senses', items: ['blinded', 'dazzled', 'deafened'] },
                { title: 'Mental', items: ['confused', 'controlled', 'fascinated','fleeing'] },
                {
                    title: 'Death and Injury',
                    items: ['doomed', 'dying', 'unconscious', 'wounded', 'persistent damage']
                }
            ];

            const allKeys = new Set(rawList.map(x => String(x).toLowerCase()));
            const included = new Set();
            const grouped = [];

            NEGATIVE_GROUPS.forEach(group => {
                const present = group.items.filter(k => allKeys.has(k));
                if (present.length === 0) return;
                grouped.push(`__group:${group.title}`);
                present.forEach(k => {
                    grouped.push(k);
                    included.add(k);
                });
            });

            const other = rawList
                .filter(k => !included.has(String(k).toLowerCase()))
                .sort((a, b) => getDisplayName(a).localeCompare(getDisplayName(b)));

            if (other.length > 0) {
                grouped.push(`__group:Other`);
                grouped.push(...other);
            }

            sortedList = grouped;
        }

        return (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <div style={{ padding: '20px 20px 0 20px' }}>
                    <h2 style={{ textAlign: 'center', marginBottom: 15, marginTop: 0 }}>Conditions</h2>

                    <div style={{ display: 'flex', gap: 5, marginBottom: 10, flexWrap: 'nowrap', overflowX: 'auto', paddingBottom: 5 }}>
                        {DISPLAY_TABS.map(tab => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                style={{
                                    padding: '6px 10px', fontSize: '0.8em', flexShrink: 0,
                                    background: activeTab === tab ? '#c5a059' : '#333',
                                    color: activeTab === tab ? '#1a1a1d' : '#ccc',
                                    border: activeTab === tab ? '1px solid #c5a059' : '1px solid #444',
                                    cursor: 'pointer', fontFamily: 'Cinzel, serif',
                                    textTransform: 'uppercase'
                                }}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>
                </div>

                {/* LIST */}
                <div style={{ overflowY: 'auto', flex: 1, padding: '0 20px 20px 20px', overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch' }}>
                    {sortedList.length === 0 && (
                        <div style={{ textAlign: 'center', color: '#888', marginTop: 20 }}>
                            No conditions found.
                        </div>
                    )}

                    {sortedList.map((condName, idx) => {
                        if (typeof condName === 'string' && condName.startsWith('__group:')) {
                            const title = condName.slice('__group:'.length);
                            return (
                                <div key={condName} style={{ marginTop: idx === 0 ? 0 : 12 }}>
                                    <div style={{
                                        fontSize: '0.75em',
                                        color: '#aaa',
                                        textTransform: 'uppercase',
                                        letterSpacing: 1,
                                        borderBottom: '1px solid #333',
                                        padding: '6px 0 4px 0'
                                    }}>
                                        {title}
                                    </div>
                                </div>
                            );
                        }

                        const activeEntry = safeConds.find(c => String((typeof c === 'string') ? c : c?.name || '').toLowerCase() === String(condName).toLowerCase());
                        const isActive = !!activeEntry;
                        const level = (activeEntry && typeof activeEntry === 'object') ? activeEntry.level : (activeEntry ? 1 : 0);
                        const iconSrc = getConditionImgSrc(condName);
                        const emojiIcon = getConditionIcon(condName);

                        return (
                            <div key={condName} style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                borderBottom: '1px solid #444',
                                padding: '8px 5px',
                                background: isActive && activeTab !== 'ACTIVE' ? 'rgba(197, 160, 89, 0.05)' : 'transparent'
                            }}>
                                <div
                                    style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', flex: 1 }}
                                    onClick={() => setSelectedCondition(condName)}
                                >
                                    {iconSrc ? (
                                        <img src={iconSrc} alt="" style={{ width: 32, height: 32, objectFit: 'contain' }} />
                                    ) : (
                                        <div style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5em' }}>
                                            {emojiIcon || '⚪'}
                                        </div>
                                    )}
                                    <span style={{
                                        fontWeight: isActive ? 'bold' : 'normal',
                                        color: isActive ? '#c5a059' : '#e0e0e0',
                                        fontSize: '1em'
                                    }}>
                                        {getDisplayName(condName)}
                                    </span>
                                </div>

                                {/* Quick Adjustment Controls in List */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <button
                                        onClick={() => adjustCondition(condName, -1)}
                                        style={{
                                            background: '#1a1a1d', border: '1px solid #c5a059', color: '#c5a059',
                                            width: 32, height: 32, borderRadius: 4, cursor: 'pointer', fontSize: '1.2em',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                                        }}
                                    >
                                        -
                                    </button>

                                    <span style={{ width: 25, textAlign: 'center', fontWeight: 'bold', fontSize: '1.1em', color: '#fff' }}>
                                        {level}
                                    </span>

                                    <button
                                        onClick={() => adjustCondition(condName, 1)}
                                        style={{
                                            background: '#1a1a1d', border: '1px solid #c5a059', color: '#c5a059',
                                            width: 32, height: 32, borderRadius: 4, cursor: 'pointer', fontSize: '1.2em',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                                        }}
                                    >
                                        +
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    // --- WRAPPER RENDER ---

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 11000,
            display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 20,
            overscrollBehavior: 'none'
        }} onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
        }}>
            <div style={{
                backgroundColor: '#2b2b2e', border: '2px solid #c5a059',
                borderRadius: '8px', maxWidth: '500px', width: '100%',
                color: '#e0e0e0',
                display: 'flex',
                flexDirection: 'column',
                maxHeight: '90vh',
                height: '80vh', // Fixed height for consistency
                position: 'relative'
            }} onClick={e => {
                e.stopPropagation();
                if (onContentLinkClick) onContentLinkClick(e);
            }}>

                <style>{`
                    .formatted-content p { margin: 0.5em 0; }
                    .formatted-content ul, .formatted-content ol { margin: 0.5em 0; padding-left: 20px; }
                    .formatted-content { line-height: 1.6; }
                    .content-link { transition: opacity 0.2s; }
                    .gold-link { color: var(--text-gold); cursor: pointer; text-decoration: none; }
                    .gold-link:hover { text-decoration: underline; opacity: 1; }
                `}</style>

                {selectedCondition ? renderDetailView() : renderListView()}

                {/* Close Button (Global for this modal) */}
                <div style={{ padding: 20, borderTop: '1px solid #444', flexShrink: 0 }}>
                    <button onClick={onClose} style={{
                        width: '100%', padding: '10px', background: '#c5a059',
                        border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 'bold', color: '#1a1a1d',
                        fontSize: '0.9em'
                    }}>Close</button>
                </div>
            </div>
        </div>
    );
}
