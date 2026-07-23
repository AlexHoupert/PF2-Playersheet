import React, { useState, useEffect } from 'react';
import RichTextEditor from '../../shared/components/RichTextEditor';
import MultiSelectDropdown from '../../shared/components/MultiSelectDropdown';
import { ACTION_INDEX_FILTER_OPTIONS, fetchActionDetailBySourceFile } from '../../shared/catalog/actionIndex';
import { readJsonApiResponse } from '../../shared/utils/apiResponse';
import { buildCatalogEditorOverride, buildCatalogSafeId, getCatalogEditorInitialItem } from '../../shared/catalog/catalogEditorContract';
import { mergeCatalogDetailIntoEntry } from '../../shared/catalog/catalogDetailMerge';
import CatalogEditorShell from '../components/editor/CatalogEditorShell';

export default function ActionEditor({ initialItem: initialItemProp, initialPayload, baseEntry, editorMode, catalogType = 'action', headerAction, onSave, onCancel, onSaveToDb, onSaveCatalogEntry, dbOnly = false }) {
    const initialItem = getCatalogEditorInitialItem({ initialItem: initialItemProp, initialPayload, baseEntry });
    const saveCatalogEntry = onSaveCatalogEntry || onSaveToDb;
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
            const sys = initialItem.system || {};
            const cls = sys.classification || {};
            // Initial load from index (missing description)
            setFormData({
                name: initialItem.name || '',
                userType: cls.type || initialItem.userType || (initialItem.type !== 'action' ? initialItem.type : '') || 'Combat',
                userSubtype: cls.subtype || initialItem.userSubtype || initialItem.subtype || 'General',
                typeCode: initialItem.typeCode || actionTypeToCode(sys.actionType?.value, sys.actions?.value),
                skill: cls.skill || initialItem.skill || '',
                feat: cls.feat || initialItem.feat || '',
                traits: sys.traits?.value || initialItem.traits || [],
                description: sys.description?.value || initialItem.description || '',
                sourceFile: initialItem.sourceFile || initialItem.overrideSourceFile || null
            });

            // Fetch full details if sourceFile exists
            if (initialItem.sourceFile) {
                setIsLoading(true);
                fetchActionDetailBySourceFile(initialItem.sourceFile)
                    .then(details => {
                        setFormData(prev => {
                            const merged = mergeCatalogDetailIntoEntry(details, prev);
                            return {
                                ...prev,
                                description: merged.description || prev.description || '',
                                // Ensure we capture specific fields that might be more detailed in file.
                                feat: merged.feat || merged.classification?.feat || prev.feat || initialItem.feat || '',
                                skill: merged.skill || prev.skill || initialItem.skill || '',
                            };
                        });
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
            const dbAction = buildDbAction(actionJson, {
                id: initialItem?.id || safeName,
                sourceFile: null,
                isCustom: true,
            });
            const actionOverride = buildActionOverride(dbAction, initialItem, { editorMode, catalogType, baseEntry });

            if ((dbOnly || saveCatalogEntry || import.meta.env.PROD) && saveCatalogEntry) {
                await saveCatalogEntry(actionOverride);
                onSave({ success: true, message: 'Saved to Database', data: actionOverride });
                return;
            }

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

            const data = await readJsonApiResponse(res, 'Save action');
            if (!data.success) throw new Error(data.error);

            // Trigger Rebuild
            await fetch('/api/admin/rebuild-index/actions', { method: 'POST' });

            onSave(data);
        } catch (err) {
            if (saveCatalogEntry && !dbOnly) {
                try {
                    const safeName = formData.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
                    const fallbackAction = buildDbAction({
                        name: formData.name,
                        type: 'action',
                        img: initialItem?.img || "systems/pf2e/icons/default-icons/action.svg",
                        system: {
                            description: { value: formData.description },
                            actionType: { value: formData.typeCode === 'R' ? 'reaction' : formData.typeCode === 'F' ? 'free' : formData.typeCode === 'P' ? 'passive' : 'action' },
                            actions: { value: ['R', 'F', 'P'].includes(formData.typeCode) ? null : parseInt(formData.typeCode) || 1 },
                            traits: { value: formData.traits, rarity: "common" },
                            classification: {
                                type: formData.userType,
                                subtype: formData.userSubtype,
                                skill: formData.skill,
                                feat: formData.feat,
                            },
                        },
                    }, { id: initialItem?.id || safeName, sourceFile: null, isCustom: true });
                    const fallbackOverride = buildActionOverride(fallbackAction, initialItem, { editorMode, catalogType, baseEntry });
                    await saveCatalogEntry(fallbackOverride);
                    onSave({ success: true, message: 'Saved to Database', data: fallbackOverride });
                    return;
                } catch (dbErr) {
                    setError(`Failed to save action. Server: ${err.message}. DB: ${dbErr.message}`);
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
        <CatalogEditorShell title={initialItem?.id || initialItem?.sourceFile ? 'Edit Action' : 'Create Action'} headerAction={headerAction} loadingMessage={isLoading ? 'Loading action details...' : ''} error={error} pending={isSaving} saveLabel="Save Action" onSave={handleSave} onCancel={onCancel}>

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

            <style>{`
                .form-group label { display: block; color: #888; font-size: 0.8em; marginBottom: 4px; }
            `}</style>
        </CatalogEditorShell>
    );
}

function actionTypeToCode(actionType, actionCount) {
    if (actionType === 'reaction') return 'R';
    if (actionType === 'free') return 'F';
    if (actionType === 'passive') return 'P';
    return String(actionCount || 1);
}

function buildDbAction(actionJson, options = {}) {
    const sys = actionJson.system || {};
    const cls = sys.classification || {};
    const actionType = sys.actionType?.value || 'passive';
    const actionCount = sys.actions?.value;
    const id = options.id || actionJson.id || actionJson.name?.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    return {
        ...actionJson,
        id,
        isCustom: options.isCustom ?? true,
        sourceFile: options.sourceFile || null,
        typeCode: actionTypeToCode(actionType, actionCount),
        userType: cls.type || 'Other',
        userSubtype: cls.subtype || 'General',
        skill: cls.skill || '',
        feat: cls.feat || '',
        traits: sys.traits?.value || [],
        description: sys.description?.value || '',
    };
}

export function buildActionOverride(actionRecord, initialItem, options = {}) {
    const safeId = buildCatalogSafeId(initialItem?.id || initialItem?._id || actionRecord?.id || actionRecord?.name || 'action');
    return buildCatalogEditorOverride(options.catalogType || 'action', {
        ...actionRecord,
        id: safeId,
        _id: safeId,
    }, {
        initialItem,
        baseEntry: options.baseEntry,
        editorMode: options.editorMode,
        id: initialItem?.catalogOverrideId || `action_${safeId}`,
        label: actionRecord?.name || safeId,
    });
}
