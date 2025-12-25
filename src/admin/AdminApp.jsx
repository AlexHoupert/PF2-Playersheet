/* d:\Repositories\PF2-Playersheet-1\src\AdminApp.jsx */
import React, { useEffect, useRef, useState } from 'react';
import { calculateStat, formatText } from '../utils/rules';
// import dbData from '../data/new_db.json'; // Removed, passed via props
import { DB_STORAGE_KEY } from '../shared/db/usePersistedDb'; // Keep constant if needed
import { NEG_CONDS, POS_CONDS, VIS_CONDS, getConditionIcon } from '../shared/constants/conditions';
import { conditionsCatalog, getConditionCatalogEntry, getConditionImgSrc, isConditionValued } from '../shared/constants/conditionsCatalog';
import { fetchShopItemDetailBySourceFile, getShopIndexItemByName } from '../shared/catalog/shopIndex';
import { fetchSpellDetailBySourceFile, getSpellIndexItemByName } from '../shared/catalog/spellIndex';
import { fetchFeatDetailBySourceFile, getFeatIndexItemByName } from '../shared/catalog/featIndex';
import { deepClone } from '../shared/utils/deepClone';
import ItemsView from './ItemsView';
import SpellsView from './SpellsView';
import FeatsView from './FeatsView';
import ActionsView from './ActionsView';
import QuestsView from './QuestsView';
import FirebaseMigrator from './FirebaseMigrator';
import SessionManager from './views/SessionManager';
import { useCampaign } from '../shared/context/CampaignContext';
import '../App.css';

export default function AdminApp({ db, setDb }) {
    const { activeCampaign, updateActiveCampaign } = useCampaign();
    // const [db, setDb] = usePersistedDb(dbData); // LIFTED TO APP
    const [activeTab, setActiveTab] = useState('sessions'); // Default to sessions now

    // Modal State
    const [modalMode, setModalMode] = useState(null); // null, 'hp', 'condition', 'item', 'spell', 'feat'
    const [activeCharIndex, setActiveCharIndex] = useState(null);
    const [modalData, setModalData] = useState(null); // For passing extra data if needed
    const shopItemDetailCacheRef = useRef(new Map());
    const [shopItemDetailLoading, setShopItemDetailLoading] = useState(false);
    const [shopItemDetailError, setShopItemDetailError] = useState(null);

    // Card Modes for Right Side (per character)
    const [cardModes, setCardModes] = useState({}); // { [charIndex]: 'stats' | 'spells' | 'feats' | 'items' }

    useEffect(() => {
        if (modalMode !== 'item' && modalMode !== 'spell' && modalMode !== 'feat' || !modalData) {
            setShopItemDetailLoading(false);
            setShopItemDetailError(null);
            return;
        }

        const sourceFile =
            modalData.sourceFile ||
            (modalData?.name ? getShopIndexItemByName(modalData.name)?.sourceFile : null);

        if (!sourceFile) return;
        if (modalData.description && modalMode !== 'spell' && modalMode !== 'feat') return;

        const cached = shopItemDetailCacheRef.current.get(sourceFile);
        if (cached) {
            setModalData(prev => (prev && prev.name === modalData.name ? { ...cached, ...prev } : prev));
            return;
        }

        let cancelled = false;
        setShopItemDetailLoading(true);
        setShopItemDetailError(null);

        let fetcher = fetchShopItemDetailBySourceFile;
        if (modalMode === 'spell') fetcher = fetchSpellDetailBySourceFile;
        if (modalMode === 'feat') fetcher = fetchFeatDetailBySourceFile;

        fetcher(sourceFile)
            .then(detail => {
                shopItemDetailCacheRef.current.set(sourceFile, detail);
                if (cancelled) return;
                setModalData(prev => (prev && prev.name === modalData.name ? { ...detail, ...prev } : prev));
                setShopItemDetailLoading(false);
            })
            .catch(err => {
                if (cancelled) return;
                setShopItemDetailError(err?.message || String(err));
                setShopItemDetailLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [modalData, modalMode]);

    const updateCharacter = (index, fn) => {
        setDb(prev => {
            const next = { ...prev };
            if (activeCampaign) {
                const campId = activeCampaign.id;
                const nextChars = [...next.campaigns[campId].characters];
                if (!nextChars[index]) return prev;
                const charClone = deepClone(nextChars[index]);
                fn(charClone);
                nextChars[index] = charClone;
                next.campaigns[campId] = { ...next.campaigns[campId], characters: nextChars };
            } else {
                const nextChars = [...(next.characters || [])];
                if (!nextChars[index]) return prev;
                const charClone = deepClone(nextChars[index]);
                fn(charClone);
                nextChars[index] = charClone;
                next.characters = nextChars;
            }
            return next;
        });
    };

    const toggleCardMode = (index, mode) => {
        setCardModes(prev => ({ ...prev, [index]: mode }));
    };

    const resetData = () => {
        if (window.confirm("Reset all data to default? This cannot be undone.")) {
            localStorage.removeItem(DB_STORAGE_KEY);
            window.location.reload();
        }
    };

    // --- SYSTEM / REBUILD ---
    const [rebuildStatus, setRebuildStatus] = useState(null);
    const handleRebuild = async (type) => {
        setRebuildStatus({ type, status: 'running', message: `Rebuilding ${type} index...` });
        try {
            const res = await fetch(`/api/admin/rebuild-index/${type}`, { method: 'POST' });
            const data = await res.json();
            if (data.success) {
                setRebuildStatus({ type, status: 'success', message: `Success! ${data.message}` });
                // Clear after 3s
                setTimeout(() => setRebuildStatus(null), 3000);
            } else {
                setRebuildStatus({ type, status: 'error', message: `Error: ${data.error}` });
            }
        } catch (err) {
            setRebuildStatus({ type, status: 'error', message: `Network Error: ${err.message}` });
        }
    };

    // --- RENDER HELPERS ---

    const renderHealthBar = (char, index) => {
        const hp = char.stats.hp.current;
        const maxHp = char.stats.hp.max;
        const tempHp = char.stats.hp.temp;
        const pct = Math.min(100, Math.max(0, (hp / maxHp) * 100));

        let barColor = '#4caf50';
        if (pct < 25) barColor = '#d32f2f';
        else if (pct < 50) barColor = '#f57c00';

        return (
            <div className="health-section small-bar" onClick={() => { setActiveCharIndex(index); setModalMode('hp'); }}>
                <div className="bar-container" style={{ height: 20 }}>
                    <div className="bar-fill" style={{ width: `${pct}%`, backgroundColor: barColor }}></div>
                    <div className="bar-text" style={{ fontSize: '0.9em' }}>
                        {hp} / {maxHp} {tempHp > 0 && <span style={{ color: '#e3f2fd' }}>(+{tempHp})</span>}
                    </div>
                </div>
            </div>
        );
    };

    const renderConditionsBadges = (char, index) => {
        const activeConditions = char.conditions.filter(c => c.level > 0).slice(0, 4); // Limit to 4
        return (
            <div className="conditions-row" onClick={() => { setActiveCharIndex(index); setModalMode('condition'); }}>
                {activeConditions.map(c => {
                    const iconSrc = getConditionImgSrc(c.name);
                    return (
                        <div key={c.name} className="mini-badge" title={`${c.name} ${c.level}`}>
                            {iconSrc ? (
                                <img src={iconSrc} alt="" style={{ width: 16, height: 16, objectFit: 'contain', marginRight: 4 }} />
                            ) : (
                                <span style={{ marginRight: 4 }}>{getConditionIcon(c.name) || "🔴"}</span>
                            )}
                            <span className="mini-badge-val">{c.level}</span>
                        </div>
                    );
                })}
                {activeConditions.length === 0 && <span style={{ color: '#666', fontSize: '0.8em' }}>No Conditions</span>}
            </div>
        );
    };

    const renderDefenses = (char) => {
        const dexMod = Number(char?.stats?.attributes?.dexterity) || 0;
        const level = Math.max(0, Math.trunc(Number(char?.level) || 0));

        const getProfValue = (key) => {
            const profs = char?.proficiencies;
            if (profs && typeof profs === 'object' && !Array.isArray(profs)) {
                const val = profs[key] ?? profs[String(key).toLowerCase()];
                const num = Number(val);
                return Number.isFinite(num) ? num : 0;
            }
            if (Array.isArray(profs)) {
                const found = profs.find(p => String(p?.name || '').toLowerCase() === String(key).toLowerCase());
                const num = Number(found?.prof);
                return Number.isFinite(num) ? num : 0;
            }
            return 0;
        };

        const getArmorProfKey = (category) => {
            const cat = String(category || '').toLowerCase();
            if (cat.startsWith('light')) return 'Light';
            if (cat.startsWith('medium')) return 'Medium';
            if (cat.startsWith('heavy')) return 'Heavy';
            return 'Unarmored';
        };

        const inventory = Array.isArray(char?.inventory) ? char.inventory : [];
        const equippedArmorEntry = inventory.find(invItem => {
            if (!invItem?.equipped) return false;
            const fromIndex = invItem?.name ? getShopIndexItemByName(invItem.name) : null;
            const type = String(invItem?.type || fromIndex?.type || '').toLowerCase();
            return type === 'armor';
        });
        const equippedArmor = equippedArmorEntry?.name
            ? { ...(getShopIndexItemByName(equippedArmorEntry.name) || {}), ...equippedArmorEntry }
            : null;

        const armorCategory = equippedArmor?.category || null;
        const armorItemBonus = typeof equippedArmor?.acBonus === 'number' ? equippedArmor.acBonus : 0;
        const dexCap = equippedArmor?.dexCap;
        const dexUsed = typeof dexCap === 'number' ? Math.min(dexMod, dexCap) : dexMod;

        const profKey = equippedArmor ? getArmorProfKey(armorCategory) : 'Unarmored';
        const profRank = getProfValue(profKey);
        const profBonus = profRank > 0 ? profRank + level : 0;

        const baseAC = 10 + dexUsed + profBonus + armorItemBonus;

        const getCondLevel = (n) => {
            const c = (char.conditions || []).find(x => String(x?.name || '').toLowerCase() === String(n).toLowerCase());
            return c ? c.level : 0;
        };

        let statusPenalty = 0;
        const frightened = getCondLevel('frightened');
        const clumsy = getCondLevel('clumsy');
        const sickened = getCondLevel('sickened');
        if (frightened > 0) statusPenalty = Math.min(statusPenalty, -frightened);
        if (clumsy > 0) statusPenalty = Math.min(statusPenalty, -clumsy);
        if (sickened > 0) statusPenalty = Math.min(statusPenalty, -sickened);

        let circPenalty = 0;
        const offGuardSources = ['off-guard', 'prone', 'grabbed', 'restrained', 'paralyzed', 'unconscious', 'blinded'];
        const isOffGuard = (char.conditions || []).some(c => offGuardSources.includes(String(c?.name || '').toLowerCase()) && c.level > 0);
        if (isOffGuard) circPenalty = -2;

        const ac = baseAC + statusPenalty + circPenalty;
        return (
            <div className="admin-defenses">
                <div className="admin-def-box"><strong>AC</strong> {ac}</div>
                <div className="admin-def-box"><strong>Fort</strong> +{calculateStat(char, "Fortitude", char.stats.saves.fortitude).total}</div>
                <div className="admin-def-box"><strong>Ref</strong> +{calculateStat(char, "Reflex", char.stats.saves.reflex).total}</div>
                <div className="admin-def-box"><strong>Will</strong> +{calculateStat(char, "Will", char.stats.saves.will).total}</div>
            </div>
        );
    };

    // --- RIGHT SIDE CARD CONTENT ---

    const renderCardContent = (char, index) => {
        const mode = cardModes[index] || 'stats';

        if (mode === 'stats') {
            return (
                <div className="card-content-scroll" style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 10 }}>
                    <div className="left-column" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <div className="attributes-container compact" style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                            {Object.entries(char.stats.attributes).map(([key, val]) => (
                                <div className="attr-box small" key={key} style={{ padding: 2, border: '1px solid #444', borderRadius: 4, textAlign: 'center', background: '#222' }}>
                                    <div className="attr-val" style={{ fontWeight: 'bold', color: '#c5a059' }}>{val >= 0 ? `+${val}` : val}</div>
                                    <div className="attr-label" style={{ fontSize: '0.6em', color: '#888' }}>{key.substring(0, 3).toUpperCase()}</div>
                                </div>
                            ))}
                        </div>

                        {/* Special Stats */}
                        <div style={{ textAlign: 'center', fontSize: '0.8em' }}>
                            <div style={{ marginBottom: 5 }}>
                                <div style={{ fontWeight: 'bold', color: '#c5a059' }}>+{calculateStat(char, "Perception", char.stats.perception).total}</div>
                                <div style={{ fontSize: '0.7em', color: '#888' }}>PERC</div>
                            </div>
                            <div style={{ marginBottom: 5 }}>
                                <div style={{ fontWeight: 'bold', color: '#c5a059' }}>{char.stats.speed.land}</div>
                                <div style={{ fontSize: '0.7em', color: '#888' }}>SPD</div>
                            </div>
                            <div>
                                <div style={{ fontWeight: 'bold', color: '#c5a059' }}>{char.stats.class_dc}</div>
                                <div style={{ fontSize: '0.7em', color: '#888' }}>DC</div>
                            </div>
                        </div>

                        {/* Languages */}
                        <div style={{ fontSize: '0.7em', color: '#aaa', borderTop: '1px solid #444', paddingTop: 5 }}>
                            {char.languages.map(l => <div key={l}>{l}</div>)}
                        </div>
                    </div>

                    <div className="right-column">
                        <div className="skills-grid" style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            {Object.entries(char.skills).map(([name, val]) => {
                                if ((!val && val !== 0) && name.startsWith("Lore")) return null;
                                const calc = calculateStat(char, name, val);
                                const isTrained = val > 0;
                                return (
                                    <div key={name} className="skill-row-compact" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85em', padding: '2px 4px', background: isTrained ? 'rgba(197, 160, 89, 0.1)' : 'transparent' }}>
                                        <span style={{ color: isTrained ? '#c5a059' : '#aaa' }}>{name.replace('_', ' ')}</span>
                                        <span style={{ fontWeight: 'bold' }}>{calc.total >= 0 ? '+' : ''}{calc.total}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            );
        }
        if (mode === 'spells') {
            return (
                <div className="card-content-scroll">
                    {char.spells.list.map((s, i) => (
                        <div key={i} className="item-row compact">
                            <span>{s.name}</span>
                            <span style={{ color: '#888', fontSize: '0.8em' }}>Rank {s.level}</span>
                        </div>
                    ))}
                </div>
            );
        }
        if (mode === 'feats') {
            return (
                <div className="card-content-scroll">
                    {char.feats.map((f, i) => (
                        <div key={i} className="item-row compact">
                            <span>{f}</span>
                        </div>
                    ))}
                </div>
            );
        }
        if (mode === 'items') {
            return (
                <div className="card-content-scroll">
                    {char.inventory.map((item, i) => (
                        <div key={i} className="item-row compact">
                            <span>{item.name}</span>
                            <span>x{item.qty || 1}</span>
                        </div>
                    ))}
                </div>
            );
        }
    };

    // Modal internal state (lifted up for the render function)
    const [editVal, setEditVal] = useState("");
    const [condTab, setCondTab] = useState('active');

    // --- MODAL RENDERER ---
    const renderGMEditModal = () => {
        if (!modalMode) return null;
        const char = db.characters[activeCharIndex];
        const close = () => {
            setModalMode(null);
            setActiveCharIndex(null);
            setModalData(null);
        };

        const contentStyle = { lineHeight: '1.6', whiteSpace: 'pre-wrap', marginTop: 12 };
        const innerHtmlStyle = (html) => (
            <div
                className="formatted-content"
                dangerouslySetInnerHTML={{ __html: html }}
            />
        );

        let content = null;

        if (modalMode === 'hp') {
            content = (
                <>
                    <h3>{char.name} - HP</h3>
                    <div className="modal-form-group" style={{ textAlign: 'center' }}>
                        <div className="qty-control-box">
                            <button className="qty-btn" onClick={() => updateCharacter(activeCharIndex, c => c.stats.hp.current = Math.max(0, c.stats.hp.current - (parseInt(editVal) || 1)))}>-</button>
                            <input type="number" className="modal-input" style={{ width: 80, textAlign: 'center' }} value={editVal} onChange={e => setEditVal(e.target.value)} placeholder="1" />
                            <button className="qty-btn" onClick={() => updateCharacter(activeCharIndex, c => c.stats.hp.current = Math.min(c.stats.hp.max, c.stats.hp.current + (parseInt(editVal) || 1)))}>+</button>
                        </div>
                        <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                            <button className="set-btn" onClick={() => { updateCharacter(activeCharIndex, c => c.stats.hp.current = parseInt(editVal) || 0); setEditVal(""); }}>Set HP</button>
                            <button className="set-btn" onClick={() => { updateCharacter(activeCharIndex, c => c.stats.hp.temp = parseInt(editVal) || 0); setEditVal(""); }}>Set Temp</button>
                        </div>
                    </div>
                </>
            );
        } else if (modalMode === 'condition') {
            const allConditions = Object.keys(conditionsCatalog).sort();
            const activeConditions = char.conditions.filter(c => c.level > 0).map(c => c.name);

            const adjustCondition = (condName, delta) => {
                const valued = isConditionValued(condName);
                updateCharacter(activeCharIndex, c => {
                    const idx = c.conditions.findIndex(x => x.name === condName);
                    if (!valued) {
                        if (delta > 0) {
                            if (idx > -1) c.conditions[idx].level = 1;
                            else c.conditions.push({ name: condName, level: 1 });
                        } else if (idx > -1) {
                            c.conditions.splice(idx, 1);
                        }
                        return;
                    }

                    if (delta > 0) {
                        if (idx > -1) c.conditions[idx].level = (c.conditions[idx].level || 0) + 1;
                        else c.conditions.push({ name: condName, level: 1 });
                    } else if (idx > -1) {
                        const nextLevel = (c.conditions[idx].level || 0) - 1;
                        if (nextLevel <= 0) c.conditions.splice(idx, 1);
                        else c.conditions[idx].level = nextLevel;
                    }
                });
            };

            let listToRender = [];
            if (condTab === 'active') listToRender = activeConditions;
            else if (condTab === 'negative') listToRender = allConditions.filter(c => NEG_CONDS.includes(c.toLowerCase()));
            else if (condTab === 'positive') listToRender = allConditions.filter(c => POS_CONDS.includes(c.toLowerCase()));
            else if (condTab === 'visibility') listToRender = allConditions.filter(c => VIS_CONDS.includes(c.toLowerCase()));

            content = (
                <>
                    <h3>{char.name} - Conditions</h3>
                    <div className="modal-tabs">
                        {['active', 'negative', 'positive', 'visibility'].map(t => (
                            <div key={t} className={`modal-tab ${condTab === t ? 'active' : ''}`} onClick={() => setCondTab(t)}>{t.charAt(0).toUpperCase() + t.slice(1)}</div>
                        ))}
                    </div>
                    <div style={{ maxHeight: '40vh', overflowY: 'auto' }}>
                        {listToRender.map(condName => {
                            const active = char.conditions.find(c => c.name === condName);
                            const level = active ? active.level : 0;
                            const iconSrc = getConditionImgSrc(condName);
                            return (
                                <div key={condName} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px', borderBottom: '1px solid #333' }}>
                                    <button
                                        type="button"
                                        onClick={() => { setModalData(condName); setModalMode('conditionInfo'); }}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 8,
                                            background: 'transparent',
                                            border: 'none',
                                            color: 'inherit',
                                            padding: 0,
                                            cursor: 'pointer',
                                            font: 'inherit',
                                            textAlign: 'left'
                                        }}
                                        title="View description"
                                    >
                                        {iconSrc ? (
                                            <img src={iconSrc} alt="" style={{ width: 20, height: 20, objectFit: 'contain' }} />
                                        ) : (
                                            <span style={{ width: 20, display: 'inline-flex', justifyContent: 'center' }}>{getConditionIcon(condName) || "⚪"}</span>
                                        )}
                                        <span>{condName}</span>
                                    </button>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                        <button onClick={() => adjustCondition(condName, -1)}>-</button>
                                        <span style={{ width: 20, textAlign: 'center' }}>{level}</span>
                                        <button onClick={() => adjustCondition(condName, 1)}>+</button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </>
            );
        } else if (modalMode === 'conditionInfo') {
            const condName = typeof modalData === 'string' ? modalData : modalData?.name;
            const entry = getConditionCatalogEntry(condName);
            const iconSrc = getConditionImgSrc(condName);
            const active = char.conditions.find(c => c.name === condName);
            const level = active ? active.level : 0;
            const valued = isConditionValued(condName);

            const adjustCondition = (delta) => {
                if (!condName) return;
                updateCharacter(activeCharIndex, c => {
                    const idx = c.conditions.findIndex(x => x.name === condName);
                    if (!valued) {
                        if (delta > 0) {
                            if (idx > -1) c.conditions[idx].level = 1;
                            else c.conditions.push({ name: condName, level: 1 });
                        } else if (idx > -1) {
                            c.conditions.splice(idx, 1);
                        }
                        return;
                    }

                    if (delta > 0) {
                        if (idx > -1) c.conditions[idx].level = (c.conditions[idx].level || 0) + 1;
                        else c.conditions.push({ name: condName, level: 1 });
                    } else if (idx > -1) {
                        const nextLevel = (c.conditions[idx].level || 0) - 1;
                        if (nextLevel <= 0) c.conditions.splice(idx, 1);
                        else c.conditions[idx].level = nextLevel;
                    }
                });
            };

            content = (
                <>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                        <button
                            type="button"
                            className="set-btn"
                            style={{ width: 'auto', padding: '8px 12px', marginTop: 0 }}
                            onClick={() => { setModalMode('condition'); setModalData(null); }}
                        >
                            ← Back
                        </button>
                        <h3 style={{ margin: 0, flex: 1, textAlign: 'center' }}>{condName}</h3>
                        <div style={{ width: 72 }} />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, marginTop: 12 }}>
                        {iconSrc ? (
                            <img src={iconSrc} alt="" style={{ width: 36, height: 36, objectFit: 'contain' }} />
                        ) : (
                            <span style={{ fontSize: '1.8em' }}>{getConditionIcon(condName) || "⚪"}</span>
                        )}

                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <button onClick={() => adjustCondition(-1)}>-</button>
                            <span style={{ minWidth: 24, textAlign: 'center' }}>{level}</span>
                            <button onClick={() => adjustCondition(1)}>+</button>
                        </div>
                    </div>

                    {innerHtmlStyle(formatText(entry?.description || "No description."))}
                </>
            );
        } else if (modalMode === 'item' && modalData) {
            const traits = Array.isArray(modalData.traits) ? modalData.traits : (modalData.traits?.value || []);
            const rarity = (typeof modalData.rarity === 'string' ? modalData.rarity : modalData.rarity?.value) || "common";

            const renderVal = (v) => {
                if (!v && v !== 0) return "-";
                if (typeof v === 'object' && v !== null && 'value' in v) return v.value;
                if (typeof v === 'object') return JSON.stringify(v);
                return v;
            };

            const bulk = renderVal(modalData.bulk);
            const damage = modalData.damage ? (typeof modalData.damage === 'string' ? modalData.damage : `${modalData.damage.dice}${modalData.damage.die} ${modalData.damage.damageType}`) : null;
            const range = modalData.range ? `${renderVal(modalData.range)} ft` : null;

            const expectedSourceFile =
                modalData.sourceFile ||
                (modalData?.name ? getShopIndexItemByName(modalData.name)?.sourceFile : null);
            const isLoadingShopDetail = Boolean(expectedSourceFile && shopItemDetailLoading && !modalData.description);
            const shopDetailError = expectedSourceFile && shopItemDetailError ? shopItemDetailError : null;

            content = (
                <>
                    <h2 dangerouslySetInnerHTML={{ __html: formatText(modalData.name) }} />

                    <div style={{ marginBottom: 10 }}>
                        {rarity !== 'common' && <span className="trait-badge" style={{ borderColor: 'var(--text-gold)', color: 'var(--text-gold)' }}>{rarity}</span>}
                        {traits.map(t => <span key={typeof t === 'string' ? t : JSON.stringify(t)} className="trait-badge">{renderVal(t)}</span>)}
                    </div>

                    <div className="item-meta-row">
                        <div><strong>Price:</strong> {renderVal(modalData.price)} gp</div>
                        <div><strong>Level:</strong> {renderVal(modalData.level)}</div>
                        <div><strong>Bulk:</strong> {bulk}</div>
                        {damage && <div><strong>Damage:</strong> {damage}</div>}
                        {range && <div><strong>Range:</strong> {range}</div>}
                    </div>

                    {innerHtmlStyle(formatText(
                        (modalData.description && typeof modalData.description === 'object' ? modalData.description.value : modalData.description) ||
                        (isLoadingShopDetail
                            ? 'Loading item details…'
                            : shopDetailError
                                ? `Failed to load item details: ${shopDetailError}`
                                : 'No description.')
                    ))}
                </>
            );
        } else if (modalMode === 'spell' && modalData) {
            const traits = Array.isArray(modalData.traits) ? modalData.traits : (modalData.traits?.value || []);
            const rarity = (typeof modalData.rarity === 'string' ? modalData.rarity : modalData.rarity?.value) || 'common';
            const traditions = Array.isArray(modalData.traditions) ? modalData.traditions : (modalData.traditions?.value || []);

            const renderVal = (v) => {
                if (!v) return null;
                if (typeof v === 'string' || typeof v === 'number') return v;
                if (v.value) return v.value;
                return JSON.stringify(v);
            };

            content = (
                <>
                    <h2 dangerouslySetInnerHTML={{ __html: formatText(modalData.name) }} />

                    <div style={{ marginBottom: 10 }}>
                        {rarity !== 'common' && <span className="trait-badge" style={{ borderColor: 'var(--text-gold)', color: 'var(--text-gold)' }}>{rarity}</span>}
                        {traits.map(t => <span key={typeof t === 'string' ? t : JSON.stringify(t)} className="trait-badge">{renderVal(t)}</span>)}
                    </div>

                    <div className="item-meta-row">
                        <div><strong>Level:</strong> {renderVal(modalData.level)}</div>
                        {modalData.school && <div><strong>School:</strong> {renderVal(modalData.school)}</div>}
                        {traditions.length > 0 && <div><strong>Traditions:</strong> {traditions.map(t => renderVal(t)).join(', ')}</div>}
                        {modalData.cast && <div><strong>Cast:</strong> {renderVal(modalData.cast)}</div>}
                        {modalData.range && <div><strong>Range:</strong> {renderVal(modalData.range)}</div>}
                        {modalData.target && <div><strong>Target:</strong> {renderVal(modalData.target)}</div>}
                        {modalData.area && <div><strong>Area:</strong> {renderVal(modalData.area)}</div>}
                        {modalData.duration && <div><strong>Duration:</strong> {renderVal(modalData.duration)}</div>}
                    </div>

                    {innerHtmlStyle(formatText(modalData.description || 'Loading spell details...'))}
                </>
            );
        } else if (modalMode === 'feat' && modalData) {
            const traits = Array.isArray(modalData.traits) ? modalData.traits : (modalData.traits?.value || []);
            const rarity = (typeof modalData.rarity === 'string' ? modalData.rarity : modalData.rarity?.value) || 'common';

            const renderVal = (v) => {
                if (!v) return null;
                if (typeof v === 'string' || typeof v === 'number') return v;
                if (v.value) return v.value;
                return JSON.stringify(v);
            };

            content = (
                <>
                    <h2 dangerouslySetInnerHTML={{ __html: formatText(modalData.name) }} />

                    <div style={{ marginBottom: 10 }}>
                        {rarity !== 'common' && <span className="trait-badge" style={{ borderColor: 'var(--text-gold)', color: 'var(--text-gold)' }}>{rarity}</span>}
                        {traits.map(t => <span key={typeof t === 'string' ? t : JSON.stringify(t)} className="trait-badge">{renderVal(t)}</span>)}
                    </div>

                    <div className="item-meta-row">
                        <div><strong>Level:</strong> {renderVal(modalData.level)}</div>
                        {modalData.category && <div><strong>Category:</strong> {renderVal(modalData.category)}</div>}
                        {modalData.actionType && <div><strong>Action:</strong> {renderVal(modalData.actionType)}</div>}
                        {modalData.prerequisites && modalData.prerequisites.length > 0 && (
                            <div><strong>Prerequisites:</strong> {modalData.prerequisites.map(p => renderVal(p)).join(', ')}</div>
                        )}
                    </div>

                    {innerHtmlStyle(formatText(modalData.description || 'Loading feat details...'))}
                </>
            );
        }

        return (
            <div className="modal-overlay" onClick={close}>
                <div className="modal-content" onClick={e => e.stopPropagation()}>
                    <style>{`
                        .formatted-content p { margin: 0.5em 0; }
                        .formatted-content ul, .formatted-content ol { margin: 0.5em 0; padding-left: 20px; }
                    `}</style>
                    {content}
                    <button className="close-btn" onClick={close}>Close</button>
                </div>
            </div>
        );
    };

    return (
        <div className="app-container admin-theme">
            {/* HEADER */}
            <div className="header-bar">
                <div>
                    <h1>GM Screen</h1>
                </div>
                <div className="header-controls">
                    <button className={`nav-btn ${activeTab === 'sessions' ? 'active' : ''}`} onClick={() => setActiveTab('sessions')}>Sessions</button>
                    <button className={`nav-btn ${activeTab === 'players' ? 'active' : ''}`} onClick={() => setActiveTab('players')}>Players</button>
                    <button className={`btn-char-switch ${activeTab === 'items' ? 'active' : ''}`} onClick={() => setActiveTab('items')} title="Items & Loot">🎒</button>
                    <button className={`btn-char-switch ${activeTab === 'spells' ? 'active' : ''}`} onClick={() => setActiveTab('spells')} title="Spells">✨</button>
                    <button className={`btn-char-switch ${activeTab === 'feats' ? 'active' : ''}`} onClick={() => setActiveTab('feats')} title="Feats">🎓</button>
                    <button className={`btn-char-switch ${activeTab === 'quests' ? 'active' : ''}`} onClick={() => setActiveTab('quests')} title="Quests">📜</button>
                    <button className={`btn-char-switch ${activeTab === 'system' ? 'active' : ''}`} onClick={() => setActiveTab('system')} title="System">⚙️</button>
                    <div style={{ width: 20 }}></div>
                    <button className="btn-char-switch" onClick={() => window.location.search = ''} title="Player View">👤</button>
                </div>    <button className="btn-char-switch" onClick={resetData} title="Reset Data">↻</button>
            </div>


            {/* MAIN CONTENT */}
            {activeTab === 'sessions' && <SessionManager db={db} setDb={setDb} />}
            {
                activeTab === 'players' && (
                    <div className="admin-layout">
                        {/* LEFT SIDE: Party Overview */}
                        <div className="admin-panel admin-left">
                            <h3>Party Overview {activeCampaign ? `(${activeCampaign.name})` : '(Legacy)'}</h3>
                            {(!activeCampaign && (!db.characters || db.characters.length === 0)) && <div style={{ padding: 10, color: '#666' }}>No characters found.</div>}
                            {(activeCampaign ? activeCampaign.characters : db.characters)?.map((char, idx) => (
                                <div key={char.id} className="party-row">
                                    <div className="party-row-header">
                                        <span className="char-name">{char.name}</span>
                                        <input
                                            className="init-input"
                                            type="number"
                                            value={char.initiative}
                                            onChange={(e) => updateCharacter(idx, c => c.initiative = parseInt(e.target.value) || 0)}
                                            placeholder="Init"
                                        />
                                    </div>
                                    {renderHealthBar(char, idx)}
                                    {renderConditionsBadges(char, idx)}
                                    {renderDefenses(char)}
                                </div>
                            ))}
                        </div>

                        {/* RIGHT SIDE: Character Cards */}
                        <div className="admin-panel admin-right">
                            <div className="card-grid">
                                {(!activeCampaign?.characters || activeCampaign.characters.length === 0)
                                    ? <div style={{ color: '#888' }}>No characters in active campaign. Go to 'Sessions' to add one.</div>
                                    : activeCampaign.characters.map((char, index) => (
                                        <div key={char.id} className="char-card">
                                            <div className="char-header">
                                                <span>{char.name}</span>
                                                <div className="card-tabs">
                                                    {['stats', 'spells', 'feats', 'items'].map(m => (
                                                        <button
                                                            key={m}
                                                            onClick={() => toggleCardMode(index, m)}
                                                        >
                                                            {m.charAt(0).toUpperCase() + m.slice(1)}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                            <div className="char-card-body">
                                                {renderCardContent(char, idx)}
                                            </div>
                                        </div>
                                    ))}
                            </div>
                        </div>
                    </div>
                )
            }

            {
                activeTab === 'items' && (
                    <ItemsView
                        db={db}
                        setDb={setDb}
                        onInspectItem={(item) => {
                            setModalData(item);
                            setModalMode('item');
                        }}
                    />
                )
            }

            {
                activeTab === 'spells' && (
                    <SpellsView
                        db={db}
                        setDb={setDb}
                        onInspectItem={(item) => {
                            setModalData(item);
                            setModalMode('spell');
                        }}
                    />
                )
            }

            {
                activeTab === 'feats' && (
                    <FeatsView
                        db={db}
                        setDb={setDb}
                        onInspectItem={(item) => {
                            setModalData(item);
                            setModalMode('feat');
                        }}
                    />
                )
            }

            {
                activeTab === 'actions' && (
                    <ActionsView
                        db={db}
                        setDb={setDb}
                        onInspectItem={(item) => {
                            setModalData(item);
                            setModalMode('item');
                        }}
                    />
                )
            }

            {activeTab === 'quests' && <QuestsView db={db} setDb={setDb} />}
            {activeTab === 'loot' && <LootView db={db} setDb={setDb} />}

            {
                activeTab === 'system' && (
                    <div style={{ padding: 20, color: '#e0e0e0' }}>
                        <h2>System Maintenance</h2>
                        <FirebaseMigrator db={db} />

                        <div style={{ background: '#222', padding: 20, borderRadius: 8, border: '1px solid #444', maxWidth: 600, marginTop: 20 }}>
                            <h3>Rebuild Indexes</h3>
                            <p style={{ color: '#aaa', marginBottom: 20 }}>
                                Rebuild the search indexes for items, spells, and feats. Run this after manually editing JSON files.
                            </p>

                            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                                <button className="set-btn" onClick={() => handleRebuild('spells')}>Rebuild Spells</button>
                                <button className="set-btn" onClick={() => handleRebuild('items')}>Rebuild Items</button>
                                <button className="set-btn" onClick={() => handleRebuild('feats')}>Rebuild Feats</button>
                                <button className="set-btn" style={{ background: '#d32f2f' }} onClick={() => handleRebuild('all')}>Rebuild ALL</button>
                            </div>

                            {rebuildStatus && (
                                <div style={{
                                    marginTop: 20, padding: 10, borderRadius: 4,
                                    background: rebuildStatus.status === 'error' ? 'rgba(211, 47, 47, 0.2)' : 'rgba(76, 175, 80, 0.2)',
                                    border: `1px solid ${rebuildStatus.status === 'error' ? '#d32f2f' : '#4caf50'}`,
                                    color: rebuildStatus.status === 'error' ? '#ff8a80' : '#81c784'
                                }}>
                                    {rebuildStatus.status === 'running' && '⏳ '}
                                    {rebuildStatus.message}
                                </div>
                            )}
                        </div>

                        <div style={{ marginTop: 20 }}>
                            <button onClick={resetData} style={{ background: '#d32f2f', color: '#fff', border: 'none', padding: '10px 20px', cursor: 'pointer', borderRadius: 5 }}>
                                Reset All Local Data
                            </button>
                        </div>
                    </div>
                )
            }

            {renderGMEditModal()}
        </div >
    );
}
