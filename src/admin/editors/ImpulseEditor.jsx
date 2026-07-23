import React, { useState, useEffect } from 'react';
import RichTextEditor from '../../shared/components/RichTextEditor';
import MultiSelectDropdown from '../../shared/components/MultiSelectDropdown';
// We can reuse spell options for things that overlap, or create new ones if needed.
// Impulses share many traits/traditions (Primal/Elemental) logic, though strictly they are "Kineticist" traits.
// For now, we'll import from spellIndex for reuse of Schools/Traditions lists if they apply, 
// or define custom ones. Impulse index might have generated options too.
import { IMPULSE_INDEX_FILTER_OPTIONS, fetchImpulseDetailBySourceFile } from '../../shared/catalog/impulseIndex';
import { readJsonApiResponse } from '../../shared/utils/apiResponse';
import { buildCatalogEditorOverride, buildCatalogSafeId, getCatalogEditorInitialItem } from '../../shared/catalog/catalogEditorContract';
import { mergeCatalogDetailIntoEntry } from '../../shared/catalog/catalogDetailMerge';
import EffectDefinitionEditor from './EffectDefinitionEditor';
import {
    readCatalogEffectDefinitions,
    validateCatalogEffectDefinitions,
    writeCatalogEffectDefinitions,
} from '../../shared/rules/catalogEffectDefinitions';
import CatalogEditorShell from '../components/editor/CatalogEditorShell';

export default function ImpulseEditor({ initialItem: initialItemProp, initialPayload, baseEntry, editorMode, catalogType = 'impulse', onSave, onCancel, onSaveToDb, onSaveCatalogEntry }) {
    const initialItem = getCatalogEditorInitialItem({ initialItem: initialItemProp, initialPayload, baseEntry });
    const saveCatalogEntry = onSaveCatalogEntry || onSaveToDb;
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
        sourceFile: null,
        effectDefinitions: []
    });

    const [isSaving, setIsSaving] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (initialItem) {
            setFormData({
                name: initialItem.name || '',
                level: initialItem.level || 0,
                school: initialItem.school || '',
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
                sourceFile: initialItem.sourceFile || initialItem.overrideSourceFile || null,
                effectDefinitions: readCatalogEffectDefinitions(initialItem)
            });

            // Fetch full details if sourceFile exists (index items lack description, target, etc.)
            if (initialItem.sourceFile) {
                setIsLoading(true);
                fetchImpulseDetailBySourceFile(initialItem.sourceFile)
                    .then(details => {
                        setFormData(prev => {
                            const merged = mergeCatalogDetailIntoEntry(details, prev);
                            return {
                                ...prev,
                                description: merged.description || prev.description || '',
                                target: merged.target || prev.target || '',
                                area: merged.area || prev.area || '',
                                duration: merged.duration || prev.duration || '',
                                defense: merged.defense || prev.defense || '',
                                range: merged.range || prev.range || '',
                                time: merged.time || prev.time || '',
                            };
                        });
                        setIsLoading(false);
                    })
                    .catch(err => {
                        console.error("Failed to load impulse details", err);
                        setError("Failed to load impulse details.");
                        setIsLoading(false);
                    });
            }
        }
    }, [initialItem]);

    const handleSave = async () => {
        if (!formData.name) return setError("Name is required");
        const effectValidation = validateCatalogEffectDefinitions(formData.effectDefinitions);
        if (!effectValidation.valid) return setError(effectValidation.errors.join('; '));
        setIsSaving(true);
        setError(null);

        try {
            const impulseJson = writeCatalogEffectDefinitions({
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
            }, formData.effectDefinitions);

            let filePath = formData.sourceFile;
            let isNew = !filePath;
            const safeName = formData.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
            const impulseOverride = buildImpulseOverride(impulseJson, formData, initialItem, { editorMode, catalogType, baseEntry });

            if (saveCatalogEntry) {
                await saveCatalogEntry(impulseOverride);
                onSave({ success: true, message: 'Saved impulse override to database', data: impulseOverride });
                return;
            }

            if (import.meta.env.PROD) {
                throw new Error('No database save handler is configured for deployed impulse editing.');
            }

            if (isNew) {
                filePath = `ressources/spells/impulses/${safeName}.json`;
            }

            // Save File
            const endpoint = isNew ? '/api/files/create' : '/api/files/save';
            const payload = isNew
                ? { directory: `ressources/spells/impulses`, filename: `${safeName}.json`, content: impulseJson }
                : { filePath: (filePath && !filePath.startsWith('ressources/')) ? `ressources/${filePath}` : filePath, content: impulseJson };

            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await readJsonApiResponse(res, 'Save impulse');
            if (!data.success) throw new Error(data.error);

            // Rebuild Index
            await fetch('/api/admin/rebuild-index/impulses', { method: 'POST' });

            onSave(data);
        } catch (err) {
            if (saveCatalogEntry) {
                try {
                    const fallbackJson = {
                        name: formData.name,
                        type: 'impulse',
                        img: initialItem?.img || "systems/pf2e/icons/default-icons/spell.svg",
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
                    const fallbackOverride = buildImpulseOverride(fallbackJson, formData, initialItem, { editorMode, catalogType, baseEntry });
                    await saveCatalogEntry(fallbackOverride);
                    onSave({ success: true, message: 'Saved impulse override to database', data: fallbackOverride });
                    return;
                } catch (dbErr) {
                    setError(`Failed to save impulse. Server: ${err.message}. DB: ${dbErr.message}`);
                    return;
                }
            }
            setError(err.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleChange = (field, val) => {
        setFormData(prev => ({ ...prev, [field]: val }));
    };

    return (
        <CatalogEditorShell title={initialItem ? 'Edit Impulse' : 'Create Impulse'} loadingMessage={isLoading ? 'Loading impulse details...' : ''} error={error} pending={isSaving} saveLabel="Save Impulse" onSave={handleSave} onCancel={onCancel}>

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

            <EffectDefinitionEditor
                value={formData.effectDefinitions}
                onChange={value => handleChange('effectDefinitions', value)}
                sourceType="impulse"
            />

            <style>{`
                .form-group label { display: block; color: #888; font-size: 0.8em; marginBottom: 4px; }
            `}</style>
        </CatalogEditorShell>
    );
}

export function buildImpulseOverride(impulseJson, formData, initialItem, options = {}) {
    const safeId = buildCatalogSafeId(initialItem?.id || initialItem?._id || formData.name || 'impulse');
    const recordWithEffects = writeCatalogEffectDefinitions(impulseJson, formData.effectDefinitions);
    return buildCatalogEditorOverride(options.catalogType || 'impulse', {
        ...recordWithEffects,
        id: safeId,
        _id: safeId,
        level: parseInt(formData.level) || 0,
        school: formData.school || '',
        traditions: formData.traditions || [],
        traits: formData.traits || [],
        rarity: formData.rarity || 'common',
        time: formData.time || '',
        range: formData.range || '',
        target: formData.target || '',
        area: formData.area || '',
        duration: formData.duration || '',
        defense: formData.defense || '',
        description: formData.description || '',
    }, {
        formData,
        initialItem,
        baseEntry: options.baseEntry,
        editorMode: options.editorMode,
        id: initialItem?.catalogOverrideId || `impulse_${safeId}`,
        label: formData.name,
    });
}
