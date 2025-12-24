import React, { useState, useEffect } from 'react';
import RichTextEditor from '../../shared/components/RichTextEditor';
import MultiSelectDropdown from '../../shared/components/MultiSelectDropdown';
import { SHOP_INDEX_FILTER_OPTIONS } from '../../shared/catalog/shopIndex';

export default function ItemEditor({ initialItem, onSave, onCancel }) {
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
        damage: { dice: 1, die: 'd6', damageType: 'slashing' },
        range: '',
        description: '',
        sourceFile: null
    });

    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState(null);

    // Load initial data
    useEffect(() => {
        if (initialItem) {
            setFormData({
                name: initialItem.name || '',
                level: initialItem.level || 0,
                price: parseFloat(initialItem.price) || 0,
                type: initialItem.type || 'Weapon',
                category: initialItem.category || '',
                group: initialItem.group || '',
                rarity: initialItem.rarity || 'common',
                bulk: initialItem.bulk || '',
                usage: initialItem.usage || '',
                traits: initialItem.traits?.value || initialItem.traits || [],
                damage: initialItem.damage ? (typeof initialItem.damage === 'object' ? initialItem.damage : { dice: 1, die: 'd6', damageType: 'slashing' }) : { dice: 1, die: 'd6', damageType: 'slashing' },
                range: initialItem.range || '',
                description: initialItem.description || '',
                sourceFile: initialItem.sourceFile || null
            });
        }
    }, [initialItem]);

    const handleSave = async () => {
        if (!formData.name) return setError("Name is required");
        setIsSaving(true);
        setError(null);

        try {
            // Construct the PF2e Item JSON structure
            const itemJson = {
                name: formData.name,
                type: formData.type.toLowerCase(), // system uses lowercase types usually
                img: initialItem?.img || "systems/pf2e/icons/default-icons/mystery-man.svg",
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
                    // Add specific fields based on type if needed
                    damage: formData.damage,
                    range: formData.range,
                    category: formData.category,
                    group: formData.group
                }
            };

            // Determine Path
            let filePath = formData.sourceFile;
            let isNew = !filePath;

            if (isNew) {
                const safeName = formData.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
                const safeType = formData.type.toLowerCase();
                filePath = `ressources/equipment/${safeType}s/${safeName}.json`;
            }

            // Save File
            const endpoint = isNew ? '/api/files/create' : '/api/files/save';
            const payload = isNew
                ? { directory: `ressources/equipment/${formData.type.toLowerCase()}s`, filename: `${formData.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json`, content: itemJson }
                : { filePath: (filePath && !filePath.startsWith('ressources/')) ? `ressources/equipment/${filePath}` : filePath, content: itemJson };

            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await res.json();
            if (!data.success) throw new Error(data.error);

            // Rebuild Index
            await fetch('/api/admin/rebuild-index/shop', { method: 'POST' });

            onSave(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleChange = (field, val) => {
        setFormData(prev => ({ ...prev, [field]: val }));
    };

    return (
        <div className="editor-container" style={{ padding: 20, background: '#222', height: '100%', overflowY: 'auto' }}>
            <h2>{initialItem ? 'Edit Item' : 'Create Item'}</h2>

            {error && <div className="error-banner" style={{ background: '#d32f2f', color: '#fff', padding: 10, marginBottom: 10 }}>{error}</div>}

            <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10, marginBottom: 20 }}>
                <div className="form-group">
                    <label>Name</label>
                    <input className="modal-input" value={formData.name} onChange={e => handleChange('name', e.target.value)} />
                </div>
                <div className="form-group">
                    <label>Level</label>
                    <input type="number" className="modal-input" value={formData.level} onChange={e => handleChange('level', e.target.value)} />
                </div>
                <div className="form-group">
                    <label>Price (gp)</label>
                    <input type="number" className="modal-input" value={formData.price} onChange={e => handleChange('price', e.target.value)} />
                </div>
            </div>

            <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10, marginBottom: 20 }}>
                <div className="form-group">
                    <label>Type</label>
                    <select className="modal-input" value={formData.type} onChange={e => handleChange('type', e.target.value)}>
                        {SHOP_INDEX_FILTER_OPTIONS.types.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                </div>
                <div className="form-group">
                    <label>Category</label>
                    <select className="modal-input" value={formData.category} onChange={e => handleChange('category', e.target.value)}>
                        <option value="">-</option>
                        {SHOP_INDEX_FILTER_OPTIONS.categories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                </div>
                <div className="form-group">
                    <label>Rarity</label>
                    <select className="modal-input" value={formData.rarity} onChange={e => handleChange('rarity', e.target.value)}>
                        {SHOP_INDEX_FILTER_OPTIONS.rarities.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                </div>
            </div>

            <div className="form-group" style={{ marginBottom: 20 }}>
                <label>Traits</label>
                <MultiSelectDropdown
                    options={SHOP_INDEX_FILTER_OPTIONS.traits}
                    selected={formData.traits}
                    onChange={val => handleChange('traits', val)}
                />
            </div>

            <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10, marginBottom: 20 }}>
                <div className="form-group">
                    <label>Bulk</label>
                    <input className="modal-input" value={formData.bulk} onChange={e => handleChange('bulk', e.target.value)} />
                </div>
                <div className="form-group">
                    <label>Range</label>
                    <input className="modal-input" value={formData.range} onChange={e => handleChange('range', e.target.value)} />
                </div>
            </div>

            <div className="form-group" style={{ marginBottom: 20 }}>
                <label>Description</label>
                <RichTextEditor value={formData.description} onChange={val => handleChange('description', val)} style={{ height: 300 }} />
            </div>

            <div className="form-actions" style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', borderTop: '1px solid #444', paddingTop: 20 }}>
                <button className="set-btn" style={{ background: '#555' }} onClick={onCancel} disabled={isSaving}>Cancel</button>
                <button className="set-btn" onClick={handleSave} disabled={isSaving}>
                    {isSaving ? 'Saving...' : 'Save Item'}
                </button>
            </div>

            <style>{`
                .form-group label { display: block; color: #888; font-size: 0.8em; marginBottom: 4px; }
            `}</style>
        </div>
    );
}
