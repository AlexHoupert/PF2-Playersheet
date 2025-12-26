import React, { useState, useEffect } from 'react';
import RichTextEditor from '../../shared/components/RichTextEditor';
import MultiSelectDropdown from '../../shared/components/MultiSelectDropdown';
// We can reuse spell options for things that overlap, or create new ones if needed.
// Impulses share many traits/traditions (Primal/Elemental) logic, though strictly they are "Kineticist" traits.
// For now, we'll import from spellIndex for reuse of Schools/Traditions lists if they apply, 
// or define custom ones. Impulse index might have generated options too.
import { IMPULSE_INDEX_FILTER_OPTIONS } from '../../shared/catalog/impulseIndex';

export default function ImpulseEditor({ initialItem, onSave, onCancel }) {
    const [formData, setFormData] = useState({
        name: '',
        level: 1,
        school: 'evocation', // Impulses don't technically have schools, but elements. Using school field for Element?
        traditions: [], // Usually Primal or None
        traits: [], // Fire, Water, Impulse, Kineticist, etc.
        rarity: 'common',
        time: '[two-actions]',
        range: '30 feet',
        target: '',
        area: '',
        duration: '',
        defense: '',
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
                school: initialItem.school || '', // Often unused for Impulses
                traditions: initialItem.traditions || [],
                traits: initialItem.traits || [],
                rarity: initialItem.rarity || 'common',
                time: initialItem.time || initialItem.cast || '',
                range: initialItem.range || '',
                target: initialItem.target || '',
                area: initialItem.area || '',
                duration: initialItem.duration || '',
                defense: initialItem.defense || '',
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
            const impulseJson = {
                name: formData.name,
                type: 'impulse', // Explicit type
                img: initialItem?.img || "systems/pf2e/icons/default-icons/spell.svg", // Default icon
                system: {
                    description: { value: formData.description },
                    level: { value: parseInt(formData.level) },
                    school: { value: formData.school },
                    traits: {
                        value: formData.traits,
                        rarity: formData.rarity,
                        traditions: formData.traditions
                    },
                    time: { value: formData.time },
                    range: { value: formData.range },
                    target: { value: formData.target },
                    area: { value: formData.area },
                    duration: { value: formData.duration },
                    defense: { save: { statistic: formData.defense } }
                }
            };

            // Determine Path
            let filePath = formData.sourceFile;
            let isNew = !filePath;

            if (isNew) {
                const safeName = formData.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
                filePath = `ressources/spells/impulses/${safeName}.json`;
            }

            // Save File
            const endpoint = isNew ? '/api/files/create' : '/api/files/save';
            const payload = isNew
                ? { directory: `ressources/spells/impulses`, filename: `${formData.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json`, content: impulseJson }
                : { filePath: (filePath && !filePath.startsWith('ressources/')) ? `ressources/${filePath}` : filePath, content: impulseJson };

            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await res.json();
            if (!data.success) throw new Error(data.error);

            // Rebuild Index
            await fetch('/api/admin/rebuild-index/impulses', { method: 'POST' });

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
            <h2>{initialItem ? 'Edit Impulse' : 'Create Impulse'}</h2>

            {error && <div className="error-banner" style={{ background: '#d32f2f', color: '#fff', padding: 10, marginBottom: 10 }}>{error}</div>}

            <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10, marginBottom: 20 }}>
                <div className="form-group">
                    <label>Name</label>
                    <input className="modal-input" value={formData.name} onChange={e => handleChange('name', e.target.value)} />
                </div>
                <div className="form-group">
                    <label>Rank (Level)</label>
                    <input type="number" className="modal-input" value={formData.level} onChange={e => handleChange('level', e.target.value)} />
                </div>
                {/* Impulses often don't use School, so generic input or reuse lists if needed */}
                <div className="form-group">
                    <label>Element / School</label>
                    <input className="modal-input" value={formData.school} onChange={e => handleChange('school', e.target.value)} placeholder="e.g. Fire" />
                </div>
            </div>

            <div className="form-group" style={{ marginBottom: 20 }}>
                <label>Traits</label>
                <MultiSelectDropdown
                    options={IMPULSE_INDEX_FILTER_OPTIONS.traits}
                    selected={formData.traits}
                    onChange={val => handleChange('traits', val)}
                />
            </div>

            <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10, marginBottom: 20 }}>
                <div className="form-group">
                    <label>Cast (Time)</label>
                    <input className="modal-input" value={formData.time} onChange={e => handleChange('time', e.target.value)} placeholder="[two-actions]" />
                </div>
                <div className="form-group">
                    <label>Range</label>
                    <input className="modal-input" value={formData.range} onChange={e => handleChange('range', e.target.value)} placeholder="30 feet" />
                </div>
                <div className="form-group">
                    <label>Target</label>
                    <input className="modal-input" value={formData.target} onChange={e => handleChange('target', e.target.value)} />
                </div>
            </div>
            <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10, marginBottom: 20 }}>
                <div className="form-group">
                    <label>Area</label>
                    <input className="modal-input" value={formData.area} onChange={e => handleChange('area', e.target.value)} />
                </div>
                <div className="form-group">
                    <label>Duration</label>
                    <input className="modal-input" value={formData.duration} onChange={e => handleChange('duration', e.target.value)} />
                </div>
                <div className="form-group">
                    <label>Defense/Save</label>
                    <input className="modal-input" value={formData.defense} onChange={e => handleChange('defense', e.target.value)} placeholder="Reflex" />
                </div>
            </div>

            <div className="form-group" style={{ marginBottom: 20 }}>
                <label>Description</label>
                <RichTextEditor value={formData.description} onChange={val => handleChange('description', val)} style={{ height: 300 }} />
            </div>

            <div className="form-actions" style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', borderTop: '1px solid #444', paddingTop: 20 }}>
                <button className="set-btn" style={{ background: '#555' }} onClick={onCancel} disabled={isSaving}>Cancel</button>
                <button className="set-btn" onClick={handleSave} disabled={isSaving}>
                    {isSaving ? 'Saving...' : 'Save Impulse'}
                </button>
            </div>
            <style>{`
                .form-group label { display: block; color: #888; font-size: 0.8em; marginBottom: 4px; }
            `}</style>
        </div>
    );
}
