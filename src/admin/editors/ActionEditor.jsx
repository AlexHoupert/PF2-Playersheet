import React, { useState, useEffect } from 'react';
import RichTextEditor from '../../shared/components/RichTextEditor';
import MultiSelectDropdown from '../../shared/components/MultiSelectDropdown';
import { ACTION_INDEX_FILTER_OPTIONS, fetchActionDetailBySourceFile } from '../../shared/catalog/actionIndex';

export default function ActionEditor({ initialItem, onSave, onCancel }) {
    const [formData, setFormData] = useState({
        name: '',
        userType: 'Combat',
        userSubtype: 'General',
        typeCode: '1',
        skill: '',
        feat: '',
        traits: [],
        description: '',
        sourceFile: null // Track source file for edits
    });

    const [isSaving, setIsSaving] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (initialItem) {
            // Initial load from index (missing description)
            setFormData({
                name: initialItem.name || '',
                userType: initialItem.userType || initialItem.type || 'Combat',
                userSubtype: initialItem.userSubtype || initialItem.subtype || 'General',
                typeCode: initialItem.typeCode || '1',
                skill: initialItem.skill || '',
                feat: initialItem.feat || '',
                traits: initialItem.traits || [],
                description: '', // Will be fetched
                sourceFile: initialItem.sourceFile || null
            });

            // Fetch full details if sourceFile exists
            if (initialItem.sourceFile) {
                setIsLoading(true);
                fetchActionDetailBySourceFile(initialItem.sourceFile)
                    .then(details => {
                        setFormData(prev => ({
                            ...prev,
                            description: details.description || '',
                            // Ensure we capture specific fields that might be more detailed in file
                            feat: details.feat || details.classification?.feat || initialItem.feat || '',
                            skill: details.skill || initialItem.skill || '',
                        }));
                        setIsLoading(false);
                    })
                    .catch(err => {
                        console.error("Failed to load details", err);
                        setError("Failed to load action details.");
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
            // Map TypeCode to PF2e system fields
            let actionType = 'passive';
            let actions = null;

            if (formData.typeCode === 'R') actionType = 'reaction';
            else if (formData.typeCode === 'F') actionType = 'free';
            else if (formData.typeCode === 'P') actionType = 'passive';
            else {
                actionType = 'action';
                actions = parseInt(formData.typeCode) || 1;
            }

            const actionJson = {
                name: formData.name,
                type: 'action',
                img: initialItem?.img || "systems/pf2e/icons/default-icons/action.svg",
                system: {
                    description: { value: formData.description },
                    actionType: { value: actionType },
                    actions: { value: actions },
                    category: 'interaction', // Default internal category
                    traits: {
                        value: formData.traits,
                        rarity: "common"
                    },
                    classification: {
                        type: formData.userType,
                        subtype: formData.userSubtype,
                        skill: formData.skill
                    },
                    // We can store feat prereq in rules or description, 
                    // or just piggyback on a custom field if we update the generator. 
                    // For now, let's put it in description metadata or rules for future proofing.
                    // Actually, the generator relies on `cls.feat` if we add it there.
                    // Let's add it to classification for now, assuming we updated generator?
                    // Wait, I strictly checked generator and it didn't look for `cls.feat`. 
                    // It looked for `feat`? No.
                    // I need to update the generator to read `feat` if I want it indexed!
                    // Let's stick it in 'classification' and update the generator next.
                }
            };

            // NOTE: I am adding 'feat' to classification to persist it.
            // I WILL NEED TO UPDATE `generate_action_index.js` TO READ THIS.
            actionJson.system.classification.feat = formData.feat;

            // Determine Path
            let filePath = formData.sourceFile;
            let isNew = !filePath;
            const safeName = formData.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();

            if (isNew) {
                // Check if it's a "custom" action that was previously in DB but now migrating?
                // No, we treat all new saves as files now.
                filePath = `ressources/actions/${safeName}.json`;
            }

            // API Call
            const endpoint = isNew ? '/api/files/create' : '/api/files/save';
            const payload = isNew
                ? { directory: `ressources/actions`, filename: `${safeName}.json`, content: actionJson }
                : { filePath: (filePath.startsWith('ressources/') ? filePath : `ressources/${filePath}`), content: actionJson };

            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await res.json();
            if (!data.success) throw new Error(data.error);

            // Trigger Rebuild
            await fetch('/api/admin/rebuild-index/actions', { method: 'POST' });

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

    const typeOptions = ['Combat', 'Movement', 'Skills', 'Other'];
    const subtypeOptions = ['Attack', 'Defense', 'Social', 'Assist', 'Ground', 'Jumping & Falling', 'Maneuver', 'Cloak & Dagger', 'Other', 'Downtime'];
    const costOptions = [
        { val: '1', label: '[one-action] Single Action' },
        { val: '2', label: '[two-actions] Two Actions' },
        { val: '3', label: '[three-actions] Three Actions' },
        { val: 'R', label: '[reaction] Reaction' },
        { val: 'F', label: '[free-action] Free Action' },
        { val: 'P', label: '[passive] Passive' }
    ];

    const skillOptions = [
        'Acrobatics', 'Arcana', 'Athletics', 'Crafting', 'Deception',
        'Diplomacy', 'Intimidation', 'Medicine', 'Nature', 'Occultism',
        'Performance', 'Religion', 'Society', 'Stealth', 'Survival', 'Thievery',
        'Perception', 'Lore'
    ];

    return (
        <div className="editor-container" style={{ padding: 20, background: '#222', height: '100%', overflowY: 'auto' }}>
            <h2>{initialItem?.id || initialItem?.sourceFile ? 'Edit Action' : 'Create Action'}</h2>

            {error && <div className="error-banner" style={{ background: '#d32f2f', color: '#fff', padding: 10, marginBottom: 10 }}>{error}</div>}

            <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10, marginBottom: 20 }}>
                <div className="form-group">
                    <label>Name</label>
                    <input className="modal-input" value={formData.name} onChange={e => handleChange('name', e.target.value)} />
                </div>
                <div className="form-group">
                    <label>Action Cost</label>
                    <select className="modal-input" value={formData.typeCode} onChange={e => handleChange('typeCode', e.target.value)}>
                        {costOptions.map(o => <option key={o.val} value={o.val}>{o.label}</option>)}
                    </select>
                </div>
                <div className="form-group">
                    <label>Category (Tab)</label>
                    <select className="modal-input" value={formData.userType} onChange={e => handleChange('userType', e.target.value)}>
                        {typeOptions.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                </div>
                <div className="form-group">
                    <label>Subtype (Section)</label>
                    <select className="modal-input" value={formData.userSubtype} onChange={e => handleChange('userSubtype', e.target.value)}>
                        {subtypeOptions.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                </div>
            </div>

            <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10, marginBottom: 20 }}>
                <div className="form-group">
                    <label>Associated Skill (Optional)</label>
                    <select className="modal-input" value={formData.skill} onChange={e => handleChange('skill', e.target.value)}>
                        <option value="">-- None --</option>
                        {skillOptions.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                </div>
                <div className="form-group">
                    <label>Prerequisite Feat (Optional)</label>
                    <input className="modal-input" placeholder="Exact Feat Name" value={formData.feat} onChange={e => handleChange('feat', e.target.value)} />
                </div>
            </div>

            <div className="form-group" style={{ marginBottom: 20 }}>
                <label>Traits</label>
                <MultiSelectDropdown
                    options={ACTION_INDEX_FILTER_OPTIONS?.traits || []} // Fallback if undefined initially
                    selected={formData.traits}
                    onChange={val => handleChange('traits', val)}
                />
            </div>

            <div className="form-group" style={{ marginBottom: 20 }}>
                <label>Description</label>
                <RichTextEditor value={formData.description} onChange={val => handleChange('description', val)} style={{ height: 300 }} />
            </div>

            <div className="form-actions" style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', borderTop: '1px solid #444', paddingTop: 20 }}>
                <button className="set-btn" style={{ background: '#555' }} onClick={onCancel} disabled={isSaving}>Cancel</button>
                <button className="set-btn" onClick={handleSave} disabled={isSaving}>
                    {isSaving ? 'Saving...' : 'Save Action'}
                </button>
            </div>
            <style>{`
                .form-group label { display: block; color: #888; font-size: 0.8em; marginBottom: 4px; }
            `}</style>
        </div>
    );
}
