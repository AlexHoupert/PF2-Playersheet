import React, { useState, useEffect } from 'react';
import RichTextEditor from '../../shared/components/RichTextEditor';
import MultiSelectDropdown from '../../shared/components/MultiSelectDropdown';
import { FEAT_INDEX_FILTER_OPTIONS, fetchFeatDetailBySourceFile } from '../../shared/catalog/featIndex';
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

export default function FeatEditor({ initialItem: initialItemProp, initialPayload, baseEntry, editorMode, catalogType = 'feat', onSave, onCancel, onSaveToDb, onSaveCatalogEntry }) {
    const initialItem = getCatalogEditorInitialItem({ initialItem: initialItemProp, initialPayload, baseEntry });
    const saveCatalogEntry = onSaveCatalogEntry || onSaveToDb;
    const [formData, setFormData] = useState({
        name: '',
        level: 1,
        category: 'Class',
        traits: [],
        rarity: 'common',
        actionType: '[one-action]',
        prerequisites: '',
        description: '',
        sourceFile: null,
        effectDefinitions: []
    });

    const [isSaving, setIsSaving] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (initialItem) {
            // Map category. If missing, might be hidden in system.category
            const cat = initialItem.category || initialItem.system?.category || 'Class';
            const displayCat = cat.charAt(0).toUpperCase() + cat.slice(1);

            setFormData({
                name: initialItem.name || '',
                level: initialItem.level || 0,
                category: displayCat,
                traits: initialItem.traits || [],
                rarity: initialItem.rarity || 'common',
                actionType: initialItem.actionType || '',
                prerequisites: initialItem.prerequisites ? (Array.isArray(initialItem.prerequisites) ? initialItem.prerequisites.join(', ') : initialItem.prerequisites) : '',
                description: initialItem.description || '',
                sourceFile: initialItem.sourceFile || initialItem.overrideSourceFile || null,
                effectDefinitions: readCatalogEffectDefinitions(initialItem)
            });

            // Fetch full details if sourceFile exists (index items lack description)
            if (initialItem.sourceFile) {
                setIsLoading(true);
                fetchFeatDetailBySourceFile(initialItem.sourceFile)
                    .then(details => {
                        setFormData(prev => {
                            const merged = mergeCatalogDetailIntoEntry(details, prev);
                            return {
                                ...prev,
                                description: merged.description || prev.description || '',
                                prerequisites: merged.prerequisites
                                    ? (Array.isArray(merged.prerequisites) ? merged.prerequisites.join(', ') : merged.prerequisites)
                                    : prev.prerequisites || '',
                                actionType: merged.actionType || prev.actionType || '',
                            };
                        });
                        setIsLoading(false);
                    })
                    .catch(err => {
                        console.error("Failed to load feat details", err);
                        setError("Failed to load feat details.");
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
            const featJson = writeCatalogEffectDefinitions({
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
                    category: formData.category.toLowerCase() // ancestry, class, etc
                }
            }, formData.effectDefinitions);

            let filePath = formData.sourceFile;
            let isNew = !filePath;
            const safeName = formData.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
            const featOverride = buildFeatOverride(featJson, formData, initialItem, { editorMode, catalogType, baseEntry });

            if (saveCatalogEntry) {
                await saveCatalogEntry(featOverride);
                onSave({ success: true, message: 'Saved feat override to database', data: featOverride });
                return;
            }

            if (import.meta.env.PROD) {
                throw new Error('No database save handler is configured for deployed feat editing.');
            }

            if (isNew) {
                filePath = `ressources/feats/${safeName}.json`;
            }

            // Save File
            const endpoint = isNew ? '/api/files/create' : '/api/files/save';
            const payload = isNew
                ? { directory: `ressources/feats`, filename: `${safeName}.json`, content: featJson }
                : { filePath: (filePath && !filePath.startsWith('ressources/')) ? `ressources/${filePath}` : filePath, content: featJson };

            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await readJsonApiResponse(res, 'Save feat');
            if (!data.success) throw new Error(data.error);

            // Rebuild Index
            await fetch('/api/admin/rebuild-index/feats', { method: 'POST' });

            onSave(data);
        } catch (err) {
            if (saveCatalogEntry) {
                try {
                    const fallbackJson = {
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
                            actionType: { value: formData.actionType },
                            actions: { value: null },
                            prerequisites: { value: formData.prerequisites ? [formData.prerequisites] : [] },
                            category: formData.category.toLowerCase()
                        }
                    };
                    const fallbackOverride = buildFeatOverride(fallbackJson, formData, initialItem, { editorMode, catalogType, baseEntry });
                    await saveCatalogEntry(fallbackOverride);
                    onSave({ success: true, message: 'Saved feat override to database', data: fallbackOverride });
                    return;
                } catch (dbErr) {
                    setError(`Failed to save feat. Server: ${err.message}. DB: ${dbErr.message}`);
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

    const CATEGORY_OPTIONS = ['Ancestry', 'Class', 'General', 'Skill', 'Bonus'];

    return (
        <CatalogEditorShell title={initialItem ? 'Edit Feat' : 'Create Feat'} loadingMessage={isLoading ? 'Loading feat details...' : ''} error={error} pending={isSaving} saveLabel="Save Feat" onSave={handleSave} onCancel={onCancel}>

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
                    <label>Category</label>
                    <select className="modal-input" value={formData.category} onChange={e => handleChange('category', e.target.value)}>
                        {CATEGORY_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
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

            <EffectDefinitionEditor
                value={formData.effectDefinitions}
                onChange={value => handleChange('effectDefinitions', value)}
                sourceType="feat"
            />

            <style>{`
                .form-group label { display: block; color: #888; font-size: 0.8em; marginBottom: 4px; }
            `}</style>
        </CatalogEditorShell>
    );
}

export function buildFeatOverride(featJson, formData, initialItem, options = {}) {
    const safeId = buildCatalogSafeId(initialItem?.id || initialItem?._id || formData.name || 'feat');
    const recordWithEffects = writeCatalogEffectDefinitions(featJson, formData.effectDefinitions);
    return buildCatalogEditorOverride(options.catalogType || 'feat', {
        ...recordWithEffects,
        id: safeId,
        _id: safeId,
        level: parseInt(formData.level) || 0,
        category: formData.category,
        traits: formData.traits || [],
        rarity: formData.rarity || 'common',
        actionType: formData.actionType || '',
        prerequisites: formData.prerequisites
            ? formData.prerequisites.split(',').map((entry) => entry.trim()).filter(Boolean)
            : [],
        description: formData.description || '',
    }, {
        formData,
        initialItem,
        baseEntry: options.baseEntry,
        editorMode: options.editorMode,
        id: initialItem?.catalogOverrideId || `feat_${safeId}`,
        label: formData.name,
    });
}
