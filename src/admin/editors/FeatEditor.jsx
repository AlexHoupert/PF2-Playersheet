import React, { useState, useEffect } from 'react';
import RichTextEditor from '../../shared/components/RichTextEditor';
import MultiSelectDropdown from '../../shared/components/MultiSelectDropdown';
import { FEAT_INDEX_FILTER_OPTIONS } from '../../shared/catalog/featIndex';

export default function FeatEditor({ initialItem, onSave, onCancel }) {
    const [formData, setFormData] = useState({
        name: '',
        level: 1,
        type: 'Class',
        traits: [],
        rarity: 'common',
        actionType: '[one-action]',
        prerequisites: '',
        description: '',
        sourceFile: null
    });

    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (initialItem) {
            setFormData({
                name: initialItem.name || '',
                level: initialItem.level || 0,
                type: initialItem.type || 'Class',
                traits: initialItem.traits || [],
                rarity: initialItem.rarity || 'common',
                actionType: initialItem.actionType || '',
                prerequisites: initialItem.prerequisites ? (Array.isArray(initialItem.prerequisites) ? initialItem.prerequisites.join(', ') : initialItem.prerequisites) : '',
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
            const featJson = {
                name: formData.name,
                type: 'feat',
                img: initialItem?.img || "systems/pf2e/icons/default-icons/feat.svg",
                system: {
                    description: { value: formData.description },
                    level: { value: parseInt(formData.level) },
                    traits: {
                        value: formData.traits,
                        rarity: formData.rarity
                    },
                    actionType: { value: formData.actionType }, // Simplified
                    actions: { value: null }, // Often linked to actionType
                    prerequisites: { value: formData.prerequisites ? [formData.prerequisites] : [] },
                    category: formData.type.toLowerCase() // ancestry, class, etc
                }
            };

            // Determine Path
            let filePath = formData.sourceFile;
            let isNew = !filePath;

            if (isNew) {
                const safeName = formData.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
                filePath = `ressources/feats/${safeName}.json`;
            }

            // Save File
            const endpoint = isNew ? '/api/files/create' : '/api/files/save';
            const payload = isNew
                ? { directory: `ressources/feats`, filename: `${formData.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json`, content: featJson }
                : { filePath: (filePath && !filePath.startsWith('ressources/')) ? `ressources/${filePath}` : filePath, content: featJson };

            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await res.json();
            if (!data.success) throw new Error(data.error);

            // Rebuild Index
            await fetch('/api/admin/rebuild-index/feats', { method: 'POST' });

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
            <h2>{initialItem ? 'Edit Feat' : 'Create Feat'}</h2>

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
                    <label>Type</label>
                    <select className="modal-input" value={formData.type} onChange={e => handleChange('type', e.target.value)}>
                        {FEAT_INDEX_FILTER_OPTIONS.types.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                </div>
            </div>

            <div className="form-group" style={{ marginBottom: 20 }}>
                <label>Traits</label>
                <MultiSelectDropdown
                    options={FEAT_INDEX_FILTER_OPTIONS.traits}
                    selected={formData.traits}
                    onChange={val => handleChange('traits', val)}
                />
            </div>

            <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10, marginBottom: 20 }}>
                <div className="form-group">
                    <label>Action</label>
                    <input className="modal-input" value={formData.actionType} onChange={e => handleChange('actionType', e.target.value)} placeholder="[one-action]" />
                </div>
                <div className="form-group">
                    <label>Prerequisites</label>
                    <input className="modal-input" value={formData.prerequisites} onChange={e => handleChange('prerequisites', e.target.value)} />
                </div>
            </div>

            <div className="form-group" style={{ marginBottom: 20 }}>
                <label>Description</label>
                <RichTextEditor value={formData.description} onChange={val => handleChange('description', val)} style={{ height: 300 }} />
            </div>

            <div className="form-actions" style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', borderTop: '1px solid #444', paddingTop: 20 }}>
                <button className="set-btn" style={{ background: '#555' }} onClick={onCancel} disabled={isSaving}>Cancel</button>
                <button className="set-btn" onClick={handleSave} disabled={isSaving}>
                    {isSaving ? 'Saving...' : 'Save Feat'}
                </button>
            </div>
            <style>{`
                .form-group label { display: block; color: #888; font-size: 0.8em; marginBottom: 4px; }
            `}</style>
        </div>
    );
}
