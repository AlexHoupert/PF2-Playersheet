/**
 * CreatureEditor - Comprehensive editor for creating/editing creature JSON files
 * Features: Editable fields for all stats, attacks, abilities, defenses + live CreatureCard preview
 */
import React, { useState, useEffect, useMemo } from 'react';
import RichTextEditor from '../../shared/components/RichTextEditor';
import MultiSelectDropdown from '../../shared/components/MultiSelectDropdown';
import CreatureCard from '../../shared/components/CreatureCard';
import { useWindowSize } from '../../shared/hooks/useWindowSize';
import { deepClone } from '../../shared/utils/deepClone';
import { CREATURE_INDEX_FILTER_OPTIONS } from '../../shared/catalog/creatureIndex';
import { mergeCreatureDetailIntoEntry } from '../../shared/catalog/catalogDetailMerge';
import {
    buildCatalogEditorOverride,
    buildCatalogSafeId,
    getCatalogEditorInitialItem,
    isStaticCatalogEdit,
} from '../../shared/catalog/catalogEditorContract';

const AbilityPicker = React.lazy(() => import('../../shared/components/AbilityPicker'));

// Common damage types
const DAMAGE_TYPES = [
    'bludgeoning', 'piercing', 'slashing', 'fire', 'cold', 'electricity', 'acid',
    'sonic', 'force', 'positive', 'negative', 'mental', 'poison', 'bleed',
    'good', 'evil', 'chaotic', 'lawful', 'silver', 'cold-iron', 'adamantine', 'vitality', 'void'
];

// Types valid for resistances and weaknesses (damage types + special categories)
const DEFENSE_TYPES = [
    ...DAMAGE_TYPES,
    'all', 'physical', 'non-magical', 'unarmed', 'area-damage', 'critical-hits',
    'precision', 'splash-damage', 'off-guard',
].sort();

// Immunity types include damage types + conditions
const IMMUNITY_TYPES = [
    ...DAMAGE_TYPES,
    // Conditions
    'blinded', 'clumsy', 'confused', 'controlled', 'dazzled', 'deafened', 'doomed',
    'drained', 'dying', 'encumbered', 'enfeebled', 'fascinated', 'fatigued', 'fleeing',
    'frightened', 'grabbed', 'immobilized', 'invisible', 'paralyzed', 'petrified',
    'prone', 'quickened', 'restrained', 'sickened', 'slowed', 'stunned', 'stupefied',
    'unconscious', 'wounded',
    // Common immunities
    'sleep', 'disease', 'death-effects', 'fear', 'healing', 'necromancy', 'nonlethal',
    'object-immunities', 'precision', 'swarm-mind', 'visual', 'critical-hits', 'grab',
    'off-guard', 'trip'
].sort();

const SKILL_LIST = [
    'acrobatics', 'arcana', 'athletics', 'crafting', 'deception', 'diplomacy',
    'intimidation', 'lore', 'medicine', 'nature', 'occultism', 'performance',
    'religion', 'society', 'stealth', 'survival', 'thievery'
];

export default function CreatureEditor({ initialCreature: initialCreatureProp, initialPayload, baseEntry, editorMode, catalogType = 'creature', onSave, onCancel, onSaveToDb, onSaveCatalogEntry, customAbilities = [] }) {
    const initialCreature = getCatalogEditorInitialItem({ initialItem: initialCreatureProp, initialPayload, baseEntry });
    const { isMobile } = useWindowSize();

    // Form state - basic info
    const [name, setName] = useState('');
    const [unknownName, setUnknownName] = useState('???');
    const [level, setLevel] = useState(0);
    const [type, setType] = useState('npc');
    const [rarity, setRarity] = useState('common');
    const [size, setSize] = useState('med');
    const [traits, setTraits] = useState([]);

    // Combat stats
    const [hp, setHp] = useState(10);
    const [ac, setAc] = useState(15);
    const [fortitude, setFortitude] = useState(5);
    const [reflex, setReflex] = useState(5);
    const [will, setWill] = useState(5);
    const [perception, setPerception] = useState(5);
    const [speed, setSpeed] = useState(25);

    // Defenses (arrays of {type, value?})
    const [immunities, setImmunities] = useState([]);
    const [resistances, setResistances] = useState([]);
    const [weaknesses, setWeaknesses] = useState([]);

    // Skills (object {skillName: base} )
    const [skills, setSkills] = useState({});

    // Items (attacks + abilities) - keep as array of items
    const [items, setItems] = useState([]);

    // Description
    const [description, setDescription] = useState('');

    // Raw JSON for items (so user can edit if needed)
    const [rawItemsJson, setRawItemsJson] = useState('');
    const [jsonError, setJsonError] = useState('');

    // Source
    const [sourceFile, setSourceFile] = useState(null);

    // Save state
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState(null);

    // Ability picker
    const [pickerOpen, setPickerOpen] = useState(false);
    const [pickerDefaultType, setPickerDefaultType] = useState(null);

    // Collapse states for sections
    const [expandedSections, setExpandedSections] = useState({
        attacks: true,
        passiveAbilities: true,
        activeAbilities: true,
        defenses: true,
        skills: false,
        json: false
    });

    // Load initial data
    useEffect(() => {
        if (initialCreature?.data) {
            const mergedCreature = mergeCreatureDetailIntoEntry(initialCreature.data, initialCreature);
            const data = mergedCreature.data;
            const sys = data.system || {};

            setName(data.name || '');
            setUnknownName(data.unknownName || '???');
            setLevel(sys.details?.level?.value ?? 0);
            setType(data.type === 'hazard' ? 'hazard' : 'npc');
            setRarity(sys.traits?.rarity || 'common');
            setSize(sys.traits?.size?.value || 'med');
            setTraits(sys.traits?.value || []);

            setHp(sys.attributes?.hp?.max ?? 10);
            setAc(sys.attributes?.ac?.value ?? 15);
            setFortitude(sys.saves?.fortitude?.value ?? 5);
            setReflex(sys.saves?.reflex?.value ?? 5);
            setWill(sys.saves?.will?.value ?? 5);
            setPerception(sys.perception?.mod ?? 5);
            setSpeed(sys.attributes?.speed?.value ?? 25);

            setImmunities(sys.attributes?.immunities || []);
            setResistances(sys.attributes?.resistances || []);
            setWeaknesses(sys.attributes?.weaknesses || []);

            setSkills(sys.skills || {});
            const itemsCopy = deepClone(data.items || []);
            setItems(itemsCopy);
            setRawItemsJson(JSON.stringify(itemsCopy, null, 2));

            setDescription(sys.details?.publicNotes || sys.description?.value || '');
            setSourceFile(mergedCreature.sourceFile || mergedCreature.overrideSourceFile || null);
        }
    }, [initialCreature]);

    // Build creature JSON from form data
    const buildCreatureJson = () => {
        return {
            _id: initialCreature?.id || `custom-${Date.now()}`,
            name,
            unknownName,
            type,
            img: initialCreature?.data?.img || "systems/pf2e/icons/default-icons/npc.svg",
            system: {
                details: {
                    level: { value: parseInt(level) },
                    publicNotes: description
                },
                traits: {
                    value: traits,
                    rarity,
                    size: { value: size }
                },
                attributes: {
                    hp: { max: parseInt(hp), value: parseInt(hp) },
                    ac: { value: parseInt(ac) },
                    speed: { value: parseInt(speed) },
                    immunities,
                    resistances,
                    weaknesses
                },
                saves: {
                    fortitude: { value: parseInt(fortitude) },
                    reflex: { value: parseInt(reflex) },
                    will: { value: parseInt(will) }
                },
                perception: { mod: parseInt(perception) },
                skills
            },
            items
        };
    };

    // Live preview creature object
    const previewCreature = useMemo(() => ({
        id: initialCreature?.id || 'preview',
        type,
        data: buildCreatureJson()
    }), [name, unknownName, level, type, rarity, size, traits, hp, ac, fortitude, reflex, will, perception, speed, immunities, resistances, weaknesses, skills, items, description]);

    const handleSave = async () => {
        if (!name) return setError("Name is required");
        setIsSaving(true);
        setError(null);

        try {
            const creatureJson = buildCreatureJson();
            const creatureOverride = buildCreatureOverride(creatureJson, { sourceFile, name }, initialCreature, { editorMode, catalogType, baseEntry });

            // Determine Path
            let filePath = sourceFile;
            let isNew = !filePath || filePath.includes('custom/');

            if (!filePath) {
                const safeName = name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
                filePath = `ressources/bestiary/custom/${safeName}.json`;
            }
            if (onSaveCatalogEntry) {
                await onSaveCatalogEntry(creatureOverride);
                onSave({ success: true, message: 'Saved creature override to Database', data: creatureOverride });
                return;
            }

            if (import.meta.env.PROD && !onSaveToDb) {
                throw new Error('No database save handler is configured for deployed creature editing.');
            }

            // Save File
            const endpoint = isNew && !sourceFile ? '/api/files/create' : '/api/files/save';
            const payload = isNew && !sourceFile
                ? { directory: 'ressources/bestiary/custom', filename: `${name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json`, content: creatureJson }
                : { filePath: filePath.startsWith('ressources/') ? filePath : `ressources/${filePath}`, content: creatureJson };

            try {
                const res = await fetch(endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (!res.ok) {
                    throw new Error(`Server responded with ${res.status}`);
                }

                const data = await res.json();
                if (!data.success) throw new Error(data.error);

                // Rebuild Creature Index
                await fetch('/api/admin/rebuild-index/creatures', { method: 'POST' });

                onSave(data);
            } catch (apiErr) {
                console.warn("API Save failed, attempting DB fallback:", apiErr);
                // Fallback to DB if provided
                if (onSaveToDb || onSaveCatalogEntry) {
                    const dbCreature = {
                        ...creatureJson,
                        sourceFile: null,
                        isCustom: true
                    };
                    try {
                        if (onSaveCatalogEntry && isStaticCatalogEdit({ editorMode, initialItem: initialCreature, formData: { sourceFile }, baseEntry })) {
                            await onSaveCatalogEntry(creatureOverride);
                            onSave({ success: true, message: 'Saved creature override to Database', data: creatureOverride });
                        } else {
                            await onSaveToDb(dbCreature);
                            onSave({ success: true, message: 'Saved to Database', data: dbCreature });
                        }
                    } catch (dbErr) {
                        console.error("DB Fallback failed:", dbErr);
                        throw new Error(`Failed to save to Server AND Database. Server: ${apiErr.message}. DB: ${dbErr.message}`);
                    }
                } else {
                    throw apiErr;
                }
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setIsSaving(false);
        }
    };

    // Defense array helpers
    const addDefense = (type, setter) => {
        setter(prev => [...prev, { type: 'fire', value: type !== 'immunities' ? 5 : undefined }]);
    };
    const removeDefense = (index, setter) => {
        setter(prev => prev.filter((_, i) => i !== index));
    };
    const updateDefense = (index, field, value, setter) => {
        setter(prev => prev.map((d, i) => i === index ? { ...d, [field]: value } : d));
    };

    // Skill helpers
    const addSkill = () => {
        const unused = SKILL_LIST.find(s => !(s in skills));
        if (unused) setSkills(prev => ({ ...prev, [unused]: { base: 0 } }));
    };
    const removeSkill = (skillName) => {
        setSkills(prev => {
            const next = { ...prev };
            delete next[skillName];
            return next;
        });
    };
    const updateSkillValue = (skillName, value) => {
        setSkills(prev => ({ ...prev, [skillName]: { base: parseInt(value) || 0 } }));
    };

    // Attack/Item helpers
    const attacks = items.filter(i => i.type === 'melee' || i.type === 'ranged');
    const passiveAbilities = items.filter(i => i.type === 'action' && i.system?.actionType?.value === 'passive');
    const activeAbilities = items.filter(i => i.type === 'action' && i.system?.actionType?.value !== 'passive');
    const otherItems = items.filter(i => !['melee', 'ranged', 'action'].includes(i.type));

    const updateItem = (itemId, updates) => {
        setItems(prev => prev.map(item => item._id === itemId ? { ...item, ...updates } : item));
    };

    const updateItemSystem = (itemId, path, value) => {
        setItems(prev => prev.map(item => {
            if (item._id !== itemId) return item;
            // Deep-clone system so nested shared references (from cloned creatures) are not mutated
            const newItem = { ...item, system: deepClone(item.system || {}) };
            // Handle nested path like 'bonus.value' or 'damageRolls.roll0.damage'
            const parts = path.split('.');
            let obj = newItem.system;
            for (let i = 0; i < parts.length - 1; i++) {
                if (!obj[parts[i]]) obj[parts[i]] = {};
                obj = obj[parts[i]];
            }
            obj[parts[parts.length - 1]] = value;
            return newItem;
        }));
    };

    const addAttack = () => {
        const newId = `attack-${Date.now()}`;
        setItems(prev => [...prev, {
            _id: newId,
            name: 'New Attack',
            type: 'melee',
            img: 'systems/pf2e/icons/default-icons/melee.svg',
            system: {
                bonus: { value: 10 },
                damageRolls: { '0': { damage: '1d6', damageType: 'slashing' } },
                traits: { value: [] },
                range: { increment: null }
            }
        }]);
    };

    const updateRange = (itemId, value) => {
        setItems(prev => prev.map(item => {
            if (item._id !== itemId) return item;

            const val = parseInt(value);
            const increment = isNaN(val) ? null : val;
            const newType = (increment && increment > 0) ? 'ranged' : 'melee';

            // Preserve existing range object if it exists
            const existingRange = (item.system?.range && typeof item.system.range === 'object')
                ? item.system.range
                : {};

            return {
                ...item,
                type: newType,
                system: {
                    ...item.system,
                    range: {
                        ...existingRange,
                        increment: increment
                    }
                }
            };
        }));
    };

    const updateDamageRoll = (itemId, rollKey, field, value) => {
        setItems(prev => prev.map(item => {
            if (item._id !== itemId) return item;
            const currentRolls = item.system?.damageRolls || {};
            const updatedRoll = { ...(currentRolls[rollKey] || {}), [field]: value };

            return {
                ...item,
                system: {
                    ...item.system,
                    damageRolls: {
                        ...currentRolls,
                        [rollKey]: updatedRoll
                    }
                }
            };
        }));
    };

    const addDamageRoll = (itemId) => {
        setItems(prev => prev.map(item => {
            if (item._id !== itemId) return item;
            const currentRolls = item.system?.damageRolls || {};
            // Find next available key
            const keys = Object.keys(currentRolls).map(k => parseInt(k)).filter(n => !isNaN(n));
            const nextKey = keys.length > 0 ? (Math.max(...keys) + 1).toString() : '0';

            return {
                ...item,
                system: {
                    ...item.system,
                    damageRolls: {
                        ...currentRolls,
                        [nextKey]: { damage: '1d4', damageType: 'fire' }
                    }
                }
            };
        }));
    };

    const removeDamageRoll = (itemId, rollKey) => {
        setItems(prev => prev.map(item => {
            if (item._id !== itemId) return item;
            const currentRolls = { ...(item.system?.damageRolls || {}) };
            delete currentRolls[rollKey];

            // If empty, maybe keep one? Or allow empty? 
            // Usually attacks have at least one damage, but maybe not (e.g. grab)

            return {
                ...item,
                system: {
                    ...item.system,
                    damageRolls: currentRolls
                }
            };
        }));
    };


    const addAbilityFromLibrary = (item) => {
        setItems(prev => [...prev, item]);
    };

    const openPicker = (isPassive) => {
        setPickerDefaultType(isPassive ? 'P' : null);
        setPickerOpen(true);
    };

    const addAbility = (isPassive = false) => {
        const newId = `ability-${Date.now()}`;
        setItems(prev => [...prev, {
            _id: newId,
            name: 'New Ability',
            type: 'action',
            img: isPassive ? 'systems/pf2e/icons/actions/Passive.webp' : 'systems/pf2e/icons/actions/OneAction.webp',
            system: {
                actionType: { value: isPassive ? 'passive' : 'action' },
                actions: { value: isPassive ? null : 1 },
                description: { value: '' },
                traits: { value: [] }
            }
        }]);
    };

    const removeItem = (itemId) => {
        setItems(prev => prev.filter(i => i._id !== itemId));
    };

    // Apply raw JSON to items
    const applyRawJson = () => {
        try {
            const parsed = JSON.parse(rawItemsJson);
            setItems(parsed);
            setJsonError('');
        } catch (e) {
            setJsonError('Invalid JSON: ' + e.message);
        }
    };

    const toggleSection = (section) => {
        setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
    };

    const sizeOptions = ['tiny', 'sm', 'med', 'lg', 'huge', 'grg'];
    const rarityOptions = ['common', 'uncommon', 'rare', 'unique'];
    const labelStyle = { display: 'block', color: '#888', fontSize: '0.8em', marginBottom: 4 };
    const sectionHeaderStyle = { color: '#c5a059', marginBottom: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 };

    return (
        <>
        <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
            {/* Left: Editor Form */}
            <div style={{ flex: 1, padding: 20, background: '#222', overflowY: 'auto' }}>
                <h2>{initialCreature?.id ? 'Edit Creature' : 'Create Creature'}</h2>

                {error && <div style={{ background: '#d32f2f', color: '#fff', padding: 10, marginBottom: 10 }}>{error}</div>}

                {/* Basic Info */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10, marginBottom: 20 }}>
                    <div>
                        <label style={labelStyle}>Name</label>
                        <input className="modal-input" value={name} onChange={e => setName(e.target.value)} style={{ width: '100%' }} />
                    </div>
                    <div>
                        <label style={labelStyle}>Unknown Name (shown to players)</label>
                        <input className="modal-input" value={unknownName} onChange={e => setUnknownName(e.target.value)} style={{ width: '100%' }} placeholder="???" />
                    </div>
                    <div>
                        <label style={labelStyle}>Level</label>
                        <input type="number" className="modal-input" value={level} onChange={e => setLevel(e.target.value)} style={{ width: '100%' }} />
                    </div>
                    <div>
                        <label style={labelStyle}>Type</label>
                        <select className="modal-input" value={type} onChange={e => setType(e.target.value)} style={{ width: '100%' }}>
                            <option value="npc">Creature</option>
                            <option value="hazard">Hazard</option>
                        </select>
                    </div>
                    <div>
                        <label style={labelStyle}>Rarity</label>
                        <select className="modal-input" value={rarity} onChange={e => setRarity(e.target.value)} style={{ width: '100%' }}>
                            {rarityOptions.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                    </div>
                    <div>
                        <label style={labelStyle}>Size</label>
                        <select className="modal-input" value={size} onChange={e => setSize(e.target.value)} style={{ width: '100%' }}>
                            {sizeOptions.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>
                </div>

                {/* Traits */}
                <div style={{ marginBottom: 20 }}>
                    <label style={labelStyle}>Traits</label>
                    <MultiSelectDropdown
                        options={CREATURE_INDEX_FILTER_OPTIONS.traits || []}
                        selected={traits}
                        onChange={setTraits}
                    />
                </div>

                {/* Combat Stats */}
                <h4 style={{ color: '#c5a059', marginBottom: 10 }}>Combat Stats</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: 10, marginBottom: 20 }}>
                    <div><label style={labelStyle}>HP</label><input type="number" className="modal-input" value={hp} onChange={e => setHp(e.target.value)} style={{ width: '100%' }} /></div>
                    <div><label style={labelStyle}>AC</label><input type="number" className="modal-input" value={ac} onChange={e => setAc(e.target.value)} style={{ width: '100%' }} /></div>
                    <div><label style={labelStyle}>Fort</label><input type="number" className="modal-input" value={fortitude} onChange={e => setFortitude(e.target.value)} style={{ width: '100%' }} /></div>
                    <div><label style={labelStyle}>Ref</label><input type="number" className="modal-input" value={reflex} onChange={e => setReflex(e.target.value)} style={{ width: '100%' }} /></div>
                    <div><label style={labelStyle}>Will</label><input type="number" className="modal-input" value={will} onChange={e => setWill(e.target.value)} style={{ width: '100%' }} /></div>
                    <div><label style={labelStyle}>Perc</label><input type="number" className="modal-input" value={perception} onChange={e => setPerception(e.target.value)} style={{ width: '100%' }} /></div>
                    <div><label style={labelStyle}>Speed</label><input type="number" className="modal-input" value={speed} onChange={e => setSpeed(e.target.value)} style={{ width: '100%' }} /></div>
                </div>

                {/* Defenses Section */}
                <h4 style={sectionHeaderStyle} onClick={() => toggleSection('defenses')}>
                    {expandedSections.defenses ? '▼' : '▶'} Defenses (Immunities, Resistances, Weaknesses)
                </h4>
                {expandedSections.defenses && (
                    <div style={{ marginBottom: 20, padding: 10, background: '#2a2a2a', borderRadius: 4 }}>
                        {/* Immunities */}
                        <div style={{ marginBottom: 10 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                                <label style={labelStyle}>Immunities</label>
                                <button className="set-btn" style={{ padding: '2px 8px', fontSize: '0.8em' }} onClick={() => addDefense('immunities', setImmunities)}>+ Add</button>
                            </div>
                            {immunities.map((imm, idx) => (
                                <div key={idx} style={{ display: 'flex', gap: 5, marginBottom: 5 }}>
                                    <select className="modal-input" value={imm.type} onChange={e => updateDefense(idx, 'type', e.target.value, setImmunities)} style={{ flex: 1 }}>
                                        {IMMUNITY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                    <button onClick={() => removeDefense(idx, setImmunities)} style={{ background: '#d32f2f', color: '#fff', border: 'none', padding: '0 8px', cursor: 'pointer' }}>×</button>
                                </div>
                            ))}
                        </div>

                        {/* Resistances */}
                        <div style={{ marginBottom: 10 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                                <label style={labelStyle}>Resistances</label>
                                <button className="set-btn" style={{ padding: '2px 8px', fontSize: '0.8em' }} onClick={() => addDefense('resistances', setResistances)}>+ Add</button>
                            </div>
                            {resistances.map((res, idx) => (
                                <div key={idx} style={{ display: 'flex', gap: 5, marginBottom: 5 }}>
                                    <select className="modal-input" value={res.type} onChange={e => updateDefense(idx, 'type', e.target.value, setResistances)} style={{ flex: 1 }}>
                                        {DEFENSE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                    <input type="number" className="modal-input" value={res.value || 0} onChange={e => updateDefense(idx, 'value', parseInt(e.target.value), setResistances)} style={{ width: 60 }} placeholder="Value" />
                                    <button onClick={() => removeDefense(idx, setResistances)} style={{ background: '#d32f2f', color: '#fff', border: 'none', padding: '0 8px', cursor: 'pointer' }}>×</button>
                                </div>
                            ))}
                        </div>

                        {/* Weaknesses */}
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                                <label style={labelStyle}>Weaknesses</label>
                                <button className="set-btn" style={{ padding: '2px 8px', fontSize: '0.8em' }} onClick={() => addDefense('weaknesses', setWeaknesses)}>+ Add</button>
                            </div>
                            {weaknesses.map((weak, idx) => (
                                <div key={idx} style={{ display: 'flex', gap: 5, marginBottom: 5 }}>
                                    <select className="modal-input" value={weak.type} onChange={e => updateDefense(idx, 'type', e.target.value, setWeaknesses)} style={{ flex: 1 }}>
                                        {DEFENSE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                    <input type="number" className="modal-input" value={weak.value || 0} onChange={e => updateDefense(idx, 'value', parseInt(e.target.value), setWeaknesses)} style={{ width: 60 }} placeholder="Value" />
                                    <button onClick={() => removeDefense(idx, setWeaknesses)} style={{ background: '#d32f2f', color: '#fff', border: 'none', padding: '0 8px', cursor: 'pointer' }}>×</button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Skills Section */}
                <h4 style={sectionHeaderStyle} onClick={() => toggleSection('skills')}>
                    {expandedSections.skills ? '▼' : '▶'} Skills ({Object.keys(skills).length})
                </h4>
                {expandedSections.skills && (
                    <div style={{ marginBottom: 20, padding: 10, background: '#2a2a2a', borderRadius: 4 }}>
                        <button className="set-btn" style={{ marginBottom: 10, padding: '4px 10px', fontSize: '0.8em' }} onClick={addSkill}>+ Add Skill</button>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
                            {Object.entries(skills).map(([skillName, skillData]) => (
                                <div key={skillName} style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                                    <select className="modal-input" value={skillName} onChange={e => {
                                        const newName = e.target.value;
                                        setSkills(prev => {
                                            const next = { ...prev };
                                            next[newName] = next[skillName];
                                            delete next[skillName];
                                            return next;
                                        });
                                    }} style={{ flex: 1 }}>
                                        {SKILL_LIST.map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                    <input type="number" className="modal-input" value={skillData?.base ?? 0} onChange={e => updateSkillValue(skillName, e.target.value)} style={{ width: 60 }} />
                                    <button onClick={() => removeSkill(skillName)} style={{ background: '#d32f2f', color: '#fff', border: 'none', padding: '0 8px', cursor: 'pointer' }}>×</button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Attacks Section */}
                <h4 style={sectionHeaderStyle} onClick={() => toggleSection('attacks')}>
                    {expandedSections.attacks ? '▼' : '▶'} Attacks ({attacks.length})
                </h4>
                {expandedSections.attacks && (
                    <div style={{ marginBottom: 20, padding: 10, background: '#2a2a2a', borderRadius: 4 }}>
                        <button className="set-btn" style={{ marginBottom: 10, padding: '4px 10px', fontSize: '0.8em' }} onClick={addAttack}>+ Add Attack</button>
                        {attacks.map(attack => (
                            <div key={attack._id} style={{ marginBottom: 10, padding: 10, background: '#333', borderRadius: 4 }}>
                                <div style={{ display: 'flex', gap: 10, marginBottom: 5 }}>
                                    <input className="modal-input" value={attack.name} onChange={e => updateItem(attack._id, { name: e.target.value })} placeholder="Name" style={{ flex: 1 }} />
                                    <div style={{ display: 'flex', alignItems: 'center', color: '#888', fontSize: '0.8em', background: '#222', padding: '0 8px', borderRadius: 4 }}>
                                        {attack.type === 'ranged' ? 'Ranged' : 'Melee'}
                                    </div>
                                    <input type="number" className="modal-input" value={attack.system?.bonus?.value ?? 0} onChange={e => updateItemSystem(attack._id, 'bonus.value', parseInt(e.target.value))} placeholder="Bonus" style={{ width: 70 }} />
                                    <button onClick={() => removeItem(attack._id)} style={{ background: '#d32f2f', color: '#fff', border: 'none', padding: '0 10px', cursor: 'pointer' }}>×</button>
                                </div>

                                <div style={{ marginBottom: 5, display: 'flex', gap: 10 }}>
                                    <input
                                        type="number"
                                        className="modal-input"
                                        value={attack.system?.range?.increment ?? attack.system?.range?.value ?? (typeof attack.system?.range === 'number' ? attack.system.range : '')}
                                        onChange={e => updateRange(attack._id, e.target.value)}
                                        placeholder="Range Increment (ft)"
                                        style={{ flex: 1 }}
                                    />
                                    <input
                                        type="text"
                                        className="modal-input"
                                        value={Array.isArray(attack.system?.traits?.value) ? attack.system.traits.value.join(', ') : ''}
                                        onChange={e => updateItemSystem(attack._id, 'traits.value', e.target.value.split(',').map(t => t.trim()).filter(Boolean))}
                                        placeholder="Traits (comma-separated)"
                                        style={{ flex: 1 }}
                                    />
                                </div>
                                <div style={{ marginBottom: 5 }}>
                                    <input
                                        type="text"
                                        className="modal-input"
                                        value={Array.isArray(attack.system?.attackEffects?.value) ? attack.system.attackEffects.value.join(', ') : ''}
                                        onChange={e => updateItemSystem(attack._id, 'attackEffects.value', e.target.value.split(',').map(t => t.trim()).filter(Boolean))}
                                        placeholder="Bonus effects (e.g. grab, push, trip)"
                                        style={{ width: '100%', fontSize: '0.85em' }}
                                    />
                                </div>

                                <div style={{ background: '#222', padding: 5, borderRadius: 4 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                                        <label style={{ color: '#888', fontSize: '0.8em' }}>Damage Rolls</label>
                                        <button className="set-btn" style={{ padding: '2px 6px', fontSize: '0.7em' }} onClick={() => addDamageRoll(attack._id)}>+</button>
                                    </div>
                                    {Object.entries(attack.system?.damageRolls || {}).map(([key, roll]) => (
                                        <div key={key} style={{ display: 'flex', gap: 5, marginBottom: 5 }}>
                                            <input className="modal-input" value={roll.damage} onChange={e => updateDamageRoll(attack._id, key, 'damage', e.target.value)} placeholder="1d6" style={{ width: 80 }} />
                                            <select className="modal-input" value={roll.damageType} onChange={e => updateDamageRoll(attack._id, key, 'damageType', e.target.value)} style={{ flex: 1 }}>
                                                {DAMAGE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                            </select>
                                            <button onClick={() => removeDamageRoll(attack._id, key)} style={{ background: '#444', color: '#aaa', border: 'none', padding: '0 6px', cursor: 'pointer' }}>×</button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Passive Abilities Section */}
                <h4 style={sectionHeaderStyle} onClick={() => toggleSection('passiveAbilities')}>
                    {expandedSections.passiveAbilities ? '▼' : '▶'} Passive Abilities ({passiveAbilities.length})
                </h4>
                {expandedSections.passiveAbilities && (
                    <div style={{ marginBottom: 20, padding: 10, background: '#2a2a2a', borderRadius: 4 }}>
                        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                            <button className="set-btn" style={{ padding: '4px 10px', fontSize: '0.8em' }} onClick={() => addAbility(true)}>+ Add Passive</button>
                            <button className="set-btn" style={{ padding: '4px 10px', fontSize: '0.8em', background: '#3a3a2a', borderColor: '#c9a86c' }} onClick={() => openPicker(true)}>📚 From Library</button>
                        </div>
                        {passiveAbilities.map(ability => (
                            <div key={ability._id} style={{ marginBottom: 10, padding: 10, background: '#333', borderRadius: 4 }}>
                                <div style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
                                    <input className="modal-input" value={ability.name} onChange={e => updateItem(ability._id, { name: e.target.value })} placeholder="Name" style={{ flex: 1 }} />
                                    <button onClick={() => removeItem(ability._id)} style={{ background: '#d32f2f', color: '#fff', border: 'none', padding: '0 10px', cursor: 'pointer' }}>×</button>
                                </div>
                                <textarea
                                    className="modal-input"
                                    value={ability.system?.description?.value || ''}
                                    onChange={e => updateItemSystem(ability._id, 'description.value', e.target.value)}
                                    placeholder="Description (HTML allowed)..."
                                    style={{ width: '100%', minHeight: 60, fontSize: '0.85em', resize: 'vertical' }}
                                />
                            </div>
                        ))}
                    </div>
                )}

                {/* Active Abilities Section */}
                <h4 style={sectionHeaderStyle} onClick={() => toggleSection('activeAbilities')}>
                    {expandedSections.activeAbilities ? '▼' : '▶'} Active Abilities ({activeAbilities.length})
                </h4>
                {expandedSections.activeAbilities && (
                    <div style={{ marginBottom: 20, padding: 10, background: '#2a2a2a', borderRadius: 4 }}>
                        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                            <button className="set-btn" style={{ padding: '4px 10px', fontSize: '0.8em' }} onClick={() => addAbility(false)}>+ Add Active</button>
                            <button className="set-btn" style={{ padding: '4px 10px', fontSize: '0.8em', background: '#3a3a2a', borderColor: '#c9a86c' }} onClick={() => openPicker(false)}>📚 From Library</button>
                        </div>
                        {activeAbilities.map(ability => (
                            <div key={ability._id} style={{ marginBottom: 10, padding: 10, background: '#333', borderRadius: 4 }}>
                                <div style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
                                    <input className="modal-input" value={ability.name} onChange={e => updateItem(ability._id, { name: e.target.value })} placeholder="Name" style={{ flex: 1 }} />
                                    <select className="modal-input" value={ability.system?.actionType?.value || 'action'} onChange={e => updateItemSystem(ability._id, 'actionType.value', e.target.value)} style={{ width: 100 }}>
                                        <option value="action">Action</option>
                                        <option value="reaction">Reaction</option>
                                        <option value="free">Free</option>
                                    </select>
                                    {ability.system?.actionType?.value === 'action' && (
                                        <input type="number" className="modal-input" min="1" max="3" value={ability.system?.actions?.value ?? 1} onChange={e => updateItemSystem(ability._id, 'actions.value', parseInt(e.target.value))} style={{ width: 60 }} title="Actions" />
                                    )}
                                    <button onClick={() => removeItem(ability._id)} style={{ background: '#d32f2f', color: '#fff', border: 'none', padding: '0 10px', cursor: 'pointer' }}>×</button>
                                </div>
                                <textarea
                                    className="modal-input"
                                    value={ability.system?.description?.value || ''}
                                    onChange={e => updateItemSystem(ability._id, 'description.value', e.target.value)}
                                    placeholder="Description (HTML allowed)..."
                                    style={{ width: '100%', minHeight: 60, fontSize: '0.85em', resize: 'vertical' }}
                                />
                            </div>
                        ))}
                    </div>
                )}

                {/* Raw JSON Section */}
                <h4 style={sectionHeaderStyle} onClick={() => toggleSection('json')}>
                    {expandedSections.json ? '▼' : '▶'} Raw Items JSON ({items.length} items)
                </h4>
                {expandedSections.json && (
                    <div style={{ marginBottom: 20 }}>
                        <textarea
                            className="modal-input"
                            value={rawItemsJson}
                            onChange={e => setRawItemsJson(e.target.value)}
                            style={{ width: '100%', height: 300, fontFamily: 'monospace', fontSize: '0.75em' }}
                        />
                        {jsonError && <div style={{ color: '#e57373', marginTop: 5, fontSize: '0.8em' }}>{jsonError}</div>}
                        <button className="set-btn" style={{ marginTop: 10 }} onClick={applyRawJson}>Apply JSON Changes</button>
                    </div>
                )}

                {/* Description */}
                <div style={{ marginBottom: 20 }}>
                    <label style={labelStyle}>Description / Notes</label>
                    <RichTextEditor value={description} onChange={setDescription} style={{ height: 150 }} />
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', borderTop: '1px solid #444', paddingTop: 20 }}>
                    <button className="set-btn" style={{ background: '#555' }} onClick={onCancel} disabled={isSaving}>Cancel</button>
                    <button className="set-btn" onClick={handleSave} disabled={isSaving}>
                        {isSaving ? 'Saving...' : 'Save Creature'}
                    </button>
                </div>
            </div>

            {/* Right: Live Preview — hidden on mobile */}
            {!isMobile && <div style={{ width: 400, minWidth: 350, borderLeft: '1px solid #444', overflowY: 'auto', padding: 16, background: '#1a1a1a' }}>
                <h4 style={{ marginTop: 0, color: '#aaa', marginBottom: 10 }}>Live Preview (GM View)</h4>
                <CreatureCard
                    creature={previewCreature}
                    isGM={true}
                    revealState={{}}
                    falseData={{}}
                    onAbilityClick={() => { }}
                />
            </div>}
        </div>

        {pickerOpen && (
            <React.Suspense fallback={null}>
                <AbilityPicker
                    defaultTypeFilter={pickerDefaultType}
                    onSelect={addAbilityFromLibrary}
                    onClose={() => setPickerOpen(false)}
                    customAbilities={customAbilities}
                />
            </React.Suspense>
        )}
        </>
    );
}

export function buildCreatureOverride(creatureJson, formData, initialCreature, options = {}) {
    const safeId = buildCatalogSafeId(initialCreature?.id || initialCreature?._id || creatureJson?._id || creatureJson?.name || 'creature');
    return buildCatalogEditorOverride(options.catalogType || 'creature', {
        ...creatureJson,
        id: safeId,
        _id: safeId,
    }, {
        formData,
        initialItem: initialCreature,
        baseEntry: options.baseEntry,
        editorMode: options.editorMode,
        id: initialCreature?.catalogOverrideId || `creature_${safeId}`,
        label: creatureJson?.name || formData?.name || safeId,
    });
}
