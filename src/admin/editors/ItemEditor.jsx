import React, { useState, useEffect } from 'react';
import RichTextEditor from '../../shared/components/RichTextEditor';
import MultiSelectDropdown from '../../shared/components/MultiSelectDropdown';
import ItemDetailContent from '../../shared/components/ItemDetailContent';
import ImagePicker from '../../shared/components/ImagePicker';
import { useWindowSize } from '../../shared/hooks/useWindowSize';
import { SHOP_INDEX_FILTER_OPTIONS } from '../../shared/catalog/shopIndex';

export default function ItemEditor({ initialItem, onSave, onCancel, onSaveToDb, dbOnly = false }) {
    const [formData, setFormData] = useState({
        name: '',
        level: 0,
        price: 0,
        type: 'Weapon',
        category: '',
        group: '',
        rarity: 'common',
        bulk: '',
        usage: '',
        traits: [],
        damages: [], // Array of damage entries
        range: '',
        description: '',
        sourceFile: null,
        img: null
    });

    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState(null);
    const [showImagePicker, setShowImagePicker] = useState(false);

    // Load initial data
    useEffect(() => {
        if (initialItem) {
            // Parse damage - handle both single object and array formats
            // Parse damage - handle both single object and array formats
            let damages = [];
            const itemDamage = initialItem.system?.damage || initialItem.damage;
            if (itemDamage) {
                if (Array.isArray(itemDamage)) {
                    damages = itemDamage;
                } else if (typeof itemDamage === 'object') {
                    damages = [itemDamage];
                }
            }

            setFormData({
                name: initialItem.name || '',
                level: initialItem.level || initialItem.system?.level?.value || 0,
                price: parseFloat(initialItem.price) || initialItem.system?.price?.value?.gp || 0,
                type: initialItem.type || 'Weapon',
                category: initialItem.category || initialItem.system?.category || '',
                group: initialItem.group || initialItem.system?.group || '',
                rarity: initialItem.rarity || initialItem.system?.traits?.rarity || 'common',
                bulk: initialItem.bulk || initialItem.system?.bulk?.value || '',
                usage: initialItem.usage || initialItem.system?.usage?.value || '',
                traits: initialItem.traits?.value || initialItem.system?.traits?.value || initialItem.traits || [],
                damages: damages,
                range: initialItem.range || initialItem.system?.range || '',
                description: initialItem.system?.description?.value || initialItem.description?.value || initialItem.description || '',
                sourceFile: initialItem.sourceFile || null,
                img: initialItem.img || null
            });
        }
    }, [initialItem]);

    const handleSave = async () => {
        if (!formData.name) return setError("Name is required");
        setIsSaving(true);
        setError(null);

        try {
            // Construct the PF2e Item JSON structure
            // For damage, use first entry as primary and store extras
            const primaryDamage = formData.damages[0];
            const extraDamages = formData.damages.slice(1);

            const itemJson = {
                name: formData.name,
                type: formData.type.toLowerCase(), // system uses lowercase types usually
                img: formData.img || initialItem?.img || "systems/pf2e/icons/default-icons/mystery-man.svg",
                system: {
                    description: { value: formData.description },
                    level: { value: parseInt(formData.level) },
                    price: { value: { gp: parseFloat(formData.price) } },
                    traits: {
                        value: formData.traits,
                        rarity: formData.rarity
                    },
                    bulk: { value: formData.bulk },
                    usage: { value: formData.usage },
                    // Primary damage
                    damage: primaryDamage,
                    // Extra damage entries (custom field for multi-damage)
                    extraDamage: extraDamages.length > 0 ? extraDamages : undefined,
                    range: parseInt(formData.range) || null,
                    category: formData.category,
                    group: formData.group
                }
            };

            // If dbOnly, skip the file API entirely and go straight to DB
            if (dbOnly) {
                if (!onSaveToDb) { setError("No save handler provided."); setIsSaving(false); return; }
                const safeId = itemJson.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
                const hasDamage = formData.damages && formData.damages.length > 0 && formData.damages.some(d => d.dice > 0);
                const dbItem = {
                    ...itemJson, _id: safeId, sourceFile: null, isCustom: true,
                    system: { ...itemJson.system, level: { value: parseInt(formData.level) }, price: { value: { gp: parseFloat(formData.price) } }, damage: hasDamage ? itemJson.system.damage : null }
                };
                try { await onSaveToDb(dbItem); onSave({ success: true, data: dbItem }); }
                catch (err) { setError(err.message); }
                finally { setIsSaving(false); }
                return;
            }

            // Determine Path
            let filePath = formData.sourceFile;
            let isNew = !filePath;

            if (!filePath) {
                // New item - create in custom folder
                const safeName = formData.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
                filePath = `ressources/equipment/custom/${safeName}.json`;
            } else {
                // Existing item - ensure path includes ressources/equipment/ prefix
                if (!filePath.startsWith('ressources/')) {
                    filePath = `ressources/equipment/${filePath}`;
                }
            }

            // Save File
            const endpoint = isNew ? '/api/files/create' : '/api/files/save';
            const payload = isNew
                ? { directory: 'ressources/equipment/custom', filename: `${formData.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json`, content: itemJson }
                : { filePath, content: itemJson };

            try {
                const res = await fetch(endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (!res.ok) {
                    // Start of fallback trigger - throw to enter catch block
                    throw new Error(`Server responded with ${res.status}`);
                }

                const data = await res.json();
                if (!data.success) throw new Error(data.error);

                // Rebuild Index
                await fetch('/api/admin/rebuild-index/shop', { method: 'POST' });

                onSave(data);
            } catch (apiErr) {
                console.warn("API Save failed, attempting DB fallback:", apiErr);
                if (onSaveToDb) {
                    // Add an ID if not present (simulate FS process)
                    const safeId = itemJson.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
                    const hasDamage = formData.damages && formData.damages.length > 0 && formData.damages.some(d => d.dice > 0);

                    const dbItem = {
                        ...itemJson,
                        _id: safeId,
                        sourceFile: null,
                        isCustom: true,
                        // Ensure system data structure is complete
                        system: {
                            ...itemJson.system,
                            // Ensure these are present for display
                            level: { value: parseInt(formData.level) },
                            price: { value: { gp: parseFloat(formData.price) } },
                            // Fix: Explicitly clear damage if removed in editor
                            damage: hasDamage ? itemJson.system.damage : null,
                        }
                    };

                    try {
                        await onSaveToDb(dbItem);
                        onSave({ success: true, message: 'Saved to Database', data: dbItem });
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

    const handleChange = (field, val) => {
        setFormData(prev => ({ ...prev, [field]: val }));
    };

    // Damage entry management
    const updateDamage = (index, field, value) => {
        setFormData(prev => {
            const newDamages = [...prev.damages];
            newDamages[index] = { ...newDamages[index], [field]: value };
            return { ...prev, damages: newDamages };
        });
    };

    const addDamage = () => {
        setFormData(prev => ({
            ...prev,
            damages: [...prev.damages, { dice: 1, die: 'd6', damageType: 'fire' }]
        }));
    };

    const removeDamage = (index) => {
        setFormData(prev => ({
            ...prev,
            damages: prev.damages.filter((_, i) => i !== index)
        }));
    };

    const DAMAGE_TYPES = ['slashing', 'piercing', 'bludgeoning', 'fire', 'cold', 'electricity', 'acid', 'sonic', 'force', 'void', 'vitality', 'poison', 'mental', 'bleed', 'spirit', 'untyped'];
    const DIE_OPTIONS = ['d4', 'd6', 'd8', 'd10', 'd12'];

    const { isMobile } = useWindowSize();
    const [showPreview, setShowPreview] = useState(false);

    const labelStyle = { display: 'block', color: '#888', fontSize: '0.8em', marginBottom: 4 };

    return (
        <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', height: '100%', overflow: 'hidden' }}>
            {/* Left: Editor Form */}
            <div className="editor-container" style={{ flex: 1, padding: 20, background: '#222', overflowY: 'auto', minHeight: 0 }}>
                <h2>{initialItem?.name ? 'Edit Item' : 'Create Item'}</h2>

                {error && <div style={{ background: '#d32f2f', color: '#fff', padding: 10, marginBottom: 10, borderRadius: 4 }}>{error}</div>}

                {/* Basic Info Grid */}
                <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10, marginBottom: 20 }}>
                    <div className="form-group" style={{ gridColumn: 'span 2' }}>
                        <label style={labelStyle}>Name</label>
                        <input className="modal-input" value={formData.name} onChange={e => handleChange('name', e.target.value)} style={{ width: '100%' }} />
                    </div>
                    <div className="form-group">
                        <label style={labelStyle}>Level</label>
                        <input type="number" className="modal-input" value={formData.level} onChange={e => handleChange('level', e.target.value)} style={{ width: '100%' }} />
                    </div>
                    <div className="form-group">
                        <label style={labelStyle}>Price (GP)</label>
                        <input type="number" className="modal-input" value={formData.price} onChange={e => handleChange('price', e.target.value)} style={{ width: '100%' }} />
                    </div>
                    <div className="form-group">
                        <label style={labelStyle}>Type</label>
                        <select className="modal-input" value={formData.type} onChange={e => handleChange('type', e.target.value)} style={{ width: '100%' }}>
                            {SHOP_INDEX_FILTER_OPTIONS.types.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                    </div>
                    <div className="form-group">
                        <label style={labelStyle}>Rarity</label>
                        <select className="modal-input" value={formData.rarity} onChange={e => handleChange('rarity', e.target.value)} style={{ width: '100%' }}>
                            {SHOP_INDEX_FILTER_OPTIONS.rarities.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                    </div>
                    <div className="form-group">
                        <label style={labelStyle}>Category</label>
                        <input className="modal-input" value={formData.category} onChange={e => handleChange('category', e.target.value)} placeholder="e.g. simple, martial" style={{ width: '100%' }} />
                    </div>
                    <div className="form-group">
                        <label style={labelStyle}>Group</label>
                        <input className="modal-input" value={formData.group} onChange={e => handleChange('group', e.target.value)} placeholder="e.g. Sword, Bomb" style={{ width: '100%' }} />
                    </div>
                </div>

                {/* Image/Icon Field */}
                <div className="form-group" style={{ marginBottom: 20 }}>
                    <label style={labelStyle}>Icon Image Path</label>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                        <input
                            className="modal-input"
                            value={formData.img || ''}
                            onChange={e => handleChange('img', e.target.value)}
                            placeholder="e.g. icons/equipment/weapons/longsword.webp"
                            style={{ flex: 1 }}
                        />
                        <button
                            type="button"
                            onClick={() => setShowImagePicker(true)}
                            style={{
                                padding: '8px 12px',
                                background: '#444',
                                border: 'none',
                                borderRadius: 4,
                                color: '#ccc',
                                cursor: 'pointer',
                                whiteSpace: 'nowrap'
                            }}
                        >Browse...</button>
                        {formData.img && (
                            <img
                                src={(() => {
                                    const baseUrl = import.meta.env.PROD ? '' : '/api/static';
                                    const cleanPath = (formData.img || '').replace('systems/pf2e/', '').replace(/^\//, '');
                                    return `${baseUrl}/${cleanPath}`;
                                })()}
                                alt="Preview"
                                style={{
                                    width: 40,
                                    height: 40,
                                    borderRadius: 4,
                                    objectFit: 'contain',
                                    background: '#111',
                                    border: '1px solid #444'
                                }}
                                onError={e => e.target.style.display = 'none'}
                            />
                        )}
                    </div>
                    <div style={{ fontSize: '0.7em', color: '#666', marginTop: 4 }}>
                        Path relative to ressources/ folder, or click Browse to select
                    </div>
                </div>

                <div className="form-group" style={{ marginBottom: 20 }}>
                    <label style={labelStyle}>Traits</label>
                    <MultiSelectDropdown
                        options={SHOP_INDEX_FILTER_OPTIONS.traits}
                        selected={formData.traits}
                        onChange={val => handleChange('traits', val)}
                    />
                </div>

                {/* Damage Editor */}
                <div className="form-group" style={{ marginBottom: 20 }}>
                    <label style={labelStyle}>Damage</label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {formData.damages.map((dmg, idx) => (
                            <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center', background: '#1a1a1a', padding: 8, borderRadius: 4 }}>
                                <input
                                    type="number"
                                    min="1"
                                    max="20"
                                    value={dmg.dice || 1}
                                    onChange={e => updateDamage(idx, 'dice', parseInt(e.target.value) || 1)}
                                    className="modal-input"
                                    style={{ width: 50, textAlign: 'center' }}
                                    title="Number of dice"
                                />
                                <select
                                    value={dmg.die || 'd6'}
                                    onChange={e => updateDamage(idx, 'die', e.target.value)}
                                    className="modal-input"
                                    style={{ width: 60 }}
                                >
                                    {DIE_OPTIONS.map(d => <option key={d} value={d}>{d}</option>)}
                                </select>
                                <select
                                    value={dmg.damageType || 'slashing'}
                                    onChange={e => updateDamage(idx, 'damageType', e.target.value)}
                                    className="modal-input"
                                    style={{ flex: 1, minWidth: 100 }}
                                >
                                    {DAMAGE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                                <button
                                    type="button"
                                    onClick={() => removeDamage(idx)}
                                    style={{
                                        padding: '4px 8px',
                                        background: '#c44',
                                        border: 'none',
                                        borderRadius: 4,
                                        color: '#fff',
                                        cursor: 'pointer',
                                        fontSize: '1em'
                                    }}
                                    title="Remove damage entry"
                                >×</button>
                            </div>
                        ))}
                        <button
                            type="button"
                            onClick={addDamage}
                            style={{
                                padding: '6px 12px',
                                background: '#3a5',
                                border: 'none',
                                borderRadius: 4,
                                color: '#fff',
                                cursor: 'pointer',
                                alignSelf: 'flex-start',
                                marginTop: 4
                            }}
                        >+ Add Damage</button>
                    </div>
                </div>

                <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10, marginBottom: 20 }}>
                    <div className="form-group">
                        <label style={labelStyle}>Bulk</label>
                        <input className="modal-input" value={formData.bulk} onChange={e => handleChange('bulk', e.target.value)} style={{ width: '100%' }} />
                    </div>
                    <div className="form-group">
                        <label style={labelStyle}>Range (ft)</label>
                        <input type="number" className="modal-input" value={formData.range} onChange={e => handleChange('range', e.target.value)} placeholder="0 = melee" style={{ width: '100%' }} />
                    </div>
                </div>

                <div className="form-group" style={{ marginBottom: 20 }}>
                    <label style={labelStyle}>Description</label>
                    <RichTextEditor value={formData.description} onChange={val => handleChange('description', val)} style={{ height: 300 }} />
                </div>

                <div className="form-actions" style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', borderTop: '1px solid #444', paddingTop: 20 }}>
                    <button className="set-btn" style={{ background: '#555' }} onClick={onCancel} disabled={isSaving}>Cancel</button>
                    <button className="set-btn" onClick={handleSave} disabled={isSaving}>
                        {isSaving ? 'Saving...' : 'Save Item'}
                    </button>
                </div>
            </div>

            {/* Right: Live Preview */}
            <div style={{
                width: isMobile ? '100%' : 380,
                minWidth: isMobile ? 'unset' : 320,
                borderLeft: isMobile ? 'none' : '1px solid #444',
                borderTop: isMobile ? '1px solid #444' : 'none',
                overflowY: 'auto',
                background: '#1a1a1a',
                flexShrink: 0,
            }}>
                <div
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', cursor: isMobile ? 'pointer' : 'default' }}
                    onClick={isMobile ? () => setShowPreview(p => !p) : undefined}
                >
                    <h4 style={{ margin: 0, color: '#aaa' }}>Live Preview</h4>
                    {isMobile && <span style={{ color: '#666', fontSize: '0.85em' }}>{showPreview ? '▲ hide' : '▼ show'}</span>}
                </div>
                {(!isMobile || showPreview) && (
                <div style={{ padding: '0 16px 16px' }}>
                <div style={{ background: '#2a2a2a', borderRadius: 8, padding: 16 }}>
                    <ItemDetailContent
                        item={{
                            name: formData.name || 'Unnamed Item',
                            type: formData.type,
                            level: parseInt(formData.level) || 0,
                            price: parseFloat(formData.price) || 0,
                            bulk: formData.bulk,
                            rarity: formData.rarity,
                            traits: { value: formData.traits },
                            range: parseInt(formData.range) || null,
                            damage: formData.damages[0],
                            extraDamage: formData.damages.slice(1),
                            category: formData.category,
                            group: formData.group,
                            description: formData.description,
                            img: formData.img
                        }}
                        showImage={true}
                        compact={false}
                    />
                </div>
                </div>
                )}
            </div>

            {/* Image Picker Modal */}
            <ImagePicker
                isOpen={showImagePicker}
                onClose={() => setShowImagePicker(false)}
                onSelect={(path) => handleChange('img', path)}
                initialPath="ressources"
            />
        </div>
    );
}
