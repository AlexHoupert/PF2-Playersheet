import React, { useState, useEffect } from 'react';
import RichTextEditor from '../../shared/components/RichTextEditor';
import MultiSelectDropdown from '../../shared/components/MultiSelectDropdown';
import { SPELL_INDEX_FILTER_OPTIONS, fetchSpellDetailBySourceFile, normalizeSpellSourceFile } from '../../shared/catalog/spellIndex';
import { readJsonApiResponse } from '../../shared/utils/apiResponse';

export default function SpellEditor({ initialItem, onSave, onCancel }) {
    const [formData, setFormData] = useState({
        name: '',
        level: 1,
        traditions: [],
        traits: [],
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
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (initialItem) {
            setFormData({
                name: initialItem.name || '',
                level: initialItem.level || 0,
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

            // Fetch full details if sourceFile exists (index items lack description, target, etc.)
            if (initialItem.sourceFile) {
                setIsLoading(true);
                fetchSpellDetailBySourceFile(initialItem.sourceFile)
                    .then(details => {
                        setFormData(prev => ({
                            ...prev,
                            description: details.description || prev.description || '',
                            target: details.target || prev.target || '',
                            area: details.area || prev.area || '',
                            duration: details.duration || prev.duration || '',
                            defense: details.defense || prev.defense || '',
                            range: details.range || prev.range || '',
                            time: details.time || prev.time || '',
                        }));
                        setIsLoading(false);
                    })
                    .catch(err => {
                        console.error("Failed to load spell details", err);
                        setError("Failed to load spell details.");
                        setIsLoading(false);
                    });
            }
        }
    }, [initialItem]);

    const handleSave = async () => {
        if (!formData.name) return setError("Name is required");
        setIsSaving(true);
        setError(null);

        try {
            const spellJson = {
                name: formData.name,
                type: 'spell',
                img: initialItem?.img || "systems/pf2e/icons/default-icons/spell.svg",
                system: {
                    description: { value: formData.description },
                    level: { value: parseInt(formData.level) },
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
                filePath = `ressources/spells/${safeName}.json`;
            }

            // Save File
            const endpoint = isNew ? '/api/files/create' : '/api/files/save';
            const payload = isNew
                ? { directory: `ressources/spells`, filename: `${formData.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json`, content: spellJson }
                : { filePath: `ressources/${normalizeSpellSourceFile(filePath)}`, content: spellJson };

            if (import.meta.env.PROD) {
                throw new Error('Static spell files can only be edited in the local dev server. Deployed Vercel builds cannot write resource JSON files yet.');
            }

            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await readJsonApiResponse(res, 'Save spell');
            if (!data.success) throw new Error(data.error);

            // Rebuild Index
            await fetch('/api/admin/rebuild-index/spells', { method: 'POST' });

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
            <h2>{initialItem ? 'Edit Spell' : 'Create Spell'}</h2>

            {isLoading && <div style={{ color: '#c5a059', marginBottom: 10 }}>Loading spell details...</div>}
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
                <div className="form-group">
                    <label>Rarity</label>
                    <select className="modal-input" value={formData.rarity} onChange={e => handleChange('rarity', e.target.value)}>
                        {['common', 'uncommon', 'rare', 'unique'].map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                </div>
            </div>

            <div className="form-group" style={{ marginBottom: 20 }}>
                <label>Traditions</label>
                <MultiSelectDropdown
                    options={SPELL_INDEX_FILTER_OPTIONS.traditions}
                    selected={formData.traditions}
                    onChange={val => handleChange('traditions', val)}
                />
            </div>

            <div className="form-group" style={{ marginBottom: 20 }}>
                <label>Traits</label>
                <MultiSelectDropdown
                    options={SPELL_INDEX_FILTER_OPTIONS.traits}
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
                    <input className="modal-input" value={formData.defense} onChange={e => handleChange('defense', e.target.value)} placeholder="reflex" />
                </div>
            </div>

            <div className="form-group" style={{ marginBottom: 20 }}>
                <label>Description</label>
                <RichTextEditor value={formData.description} onChange={val => handleChange('description', val)} style={{ height: 300 }} />
            </div>

            <div className="form-actions" style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', borderTop: '1px solid #444', paddingTop: 20 }}>
                <button className="set-btn" style={{ background: '#555' }} onClick={onCancel} disabled={isSaving}>Cancel</button>
                <button className="set-btn" onClick={handleSave} disabled={isSaving}>
                    {isSaving ? 'Saving...' : 'Save Spell'}
                </button>
            </div>
            <style>{`
                .form-group label { display: block; color: #888; font-size: 0.8em; marginBottom: 4px; }
            `}</style>
        </div>
    );
}
