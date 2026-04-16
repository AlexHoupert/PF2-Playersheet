import React, { useState } from 'react';
import { useCampaign } from '../shared/context/CampaignContext';
import { getMergedActivities, DEFAULT_CAMPING_ACTIVITIES, DC_TYPE_LABELS } from './campingData';
import RichTextEditor from '../shared/components/RichTextEditor';

const EMPTY_ACTIVITY = {
    id: '',
    name: '',
    skills: [],
    requirements: '',
    dcType: 'zone',
    customDC: null,
    effectCrit: '',
    effectSuccess: '',
    effectCritFail: '',
    description: ''
};

function generateId(name) {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') + '_' + Date.now();
}

export default function CampingAdminView() {
    const { activeCampaign, updateActiveCampaign } = useCampaign();
    const camping = activeCampaign?.camping || {};
    const activities = getMergedActivities(camping.activities || []);

    const [editing, setEditing] = useState(null); // activity being edited
    const [isNew, setIsNew] = useState(false);

    const updateCampingField = (field, value) => {
        updateActiveCampaign(c => ({ ...c, camping: { ...c.camping, [field]: value } }));
    };

    const openEdit = (act) => {
        setEditing({ ...act, skills: [...(act.skills || [])] });
        setIsNew(false);
    };

    const openNew = () => {
        setEditing({ ...EMPTY_ACTIVITY, id: '' });
        setIsNew(true);
    };

    const saveActivity = () => {
        if (!editing?.name?.trim()) return;
        const id = editing.id || generateId(editing.name);
        const toSave = { ...editing, id };

        const current = camping.activities || [];
        const exists = current.findIndex(a => a.id === id);
        const updated = exists >= 0
            ? current.map(a => a.id === id ? toSave : a)
            : [...current, toSave];

        updateCampingField('activities', updated);
        setEditing(null);
    };

    const deleteActivity = (id) => {
        if (!confirm('Delete this activity?')) return;
        const updated = (camping.activities || []).filter(a => a.id !== id);
        updateCampingField('activities', updated);
        if (editing?.id === id) setEditing(null);
    };

    const resetToDefault = (id) => {
        if (!confirm('Reset this activity to its default values?')) return;
        const updated = (camping.activities || []).filter(a => a.id !== id);
        updateCampingField('activities', updated);
        if (editing?.id === id) setEditing(null);
    };

    const isCustom = (id) => !DEFAULT_CAMPING_ACTIVITIES.find(d => d.id === id);

    const setSkills = (val) => {
        setEditing(prev => ({ ...prev, skills: val.split(',').map(s => s.trim()).filter(Boolean) }));
    };

    return (
        <div style={{ display: 'flex', height: '100%', gap: 0, overflow: 'hidden' }}>
            {/* Left Panel - DC Settings + Activity List */}
            <div style={{
                width: editing ? '340px' : '100%', flexShrink: 0,
                overflowY: 'auto', padding: '20px', borderRight: editing ? '1px solid #333' : 'none'
            }}>
                <h2 style={{ margin: '0 0 16px 0', fontFamily: 'Cinzel, serif', color: '#c5a059' }}>
                    Camping System
                </h2>

                {/* DC Settings */}
                <div style={{ background: '#1a1a1d', border: '1px solid #333', borderRadius: 6, padding: 14, marginBottom: 20 }}>
                    <div style={{ fontSize: '0.75em', color: '#888', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
                        DC Settings
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                        {[
                            { key: 'zoneDC', label: 'Zone DC' },
                            { key: 'encounterDC', label: 'Encounter DC' },
                            { key: 'foragingDC', label: 'Foraging DC' }
                        ].map(({ key, label }) => (
                            <div key={key}>
                                <div style={{ fontSize: '0.75em', color: '#888', marginBottom: 4 }}>{label}</div>
                                <input
                                    type="number"
                                    value={camping[key] ?? ''}
                                    onChange={e => updateCampingField(key, e.target.value === '' ? null : parseInt(e.target.value))}
                                    placeholder="15"
                                    style={{
                                        width: '100%', padding: '6px 8px', background: '#111',
                                        border: '1px solid #444', color: '#fff', borderRadius: 4,
                                        fontSize: '1em', boxSizing: 'border-box'
                                    }}
                                />
                            </div>
                        ))}
                    </div>
                </div>

                {/* Add New */}
                <button
                    onClick={openNew}
                    style={{
                        width: '100%', padding: '8px', marginBottom: 12,
                        background: '#1a2a1a', border: '1px solid #4caf50', color: '#81c784',
                        borderRadius: 4, cursor: 'pointer', fontWeight: 'bold'
                    }}
                >
                    + New Activity
                </button>

                {/* Activity Table */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {activities.map(act => {
                        const custom = isCustom(act.id);
                        const overridden = !custom && (camping.activities || []).find(a => a.id === act.id);
                        const isEditing = editing?.id === act.id;
                        return (
                            <div
                                key={act.id}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 8,
                                    padding: '8px 10px', borderRadius: 4,
                                    background: isEditing ? '#2a2040' : '#1a1a1d',
                                    border: isEditing ? '1px solid #673ab7' : '1px solid #2a2a2a',
                                    cursor: 'pointer'
                                }}
                                onClick={() => openEdit(act)}
                            >
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 'bold', color: '#e0e0e0', fontSize: '0.9em' }}>
                                        {act.name}
                                        {custom && <span style={{ marginLeft: 6, fontSize: '0.7em', color: '#c5a059', background: '#2a2000', padding: '1px 5px', borderRadius: 10 }}>custom</span>}
                                        {overridden && !custom && <span style={{ marginLeft: 6, fontSize: '0.7em', color: '#7986cb', background: '#1a1a30', padding: '1px 5px', borderRadius: 10 }}>modified</span>}
                                    </div>
                                    <div style={{ fontSize: '0.75em', color: '#666', marginTop: 1 }}>
                                        {act.skills.join(' / ')} • {DC_TYPE_LABELS[act.dcType] || 'Zone DC'}
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: 4 }}>
                                    {overridden && !custom && (
                                        <button
                                            onClick={e => { e.stopPropagation(); resetToDefault(act.id); }}
                                            style={{ padding: '2px 7px', background: 'none', border: '1px solid #555', color: '#888', borderRadius: 3, cursor: 'pointer', fontSize: '0.75em' }}
                                            title="Reset to default"
                                        >↺</button>
                                    )}
                                    {custom && (
                                        <button
                                            onClick={e => { e.stopPropagation(); deleteActivity(act.id); }}
                                            style={{ padding: '2px 7px', background: 'none', border: '1px solid #e53935', color: '#ef9a9a', borderRadius: 3, cursor: 'pointer', fontSize: '0.75em' }}
                                            title="Delete"
                                        >✕</button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Right Panel - Editor */}
            {editing && (
                <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                        <h3 style={{ margin: 0, fontFamily: 'Cinzel, serif', color: '#c5a059' }}>
                            {isNew ? 'New Activity' : `Edit: ${editing.name}`}
                        </h3>
                        <button onClick={() => setEditing(null)} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '1.2em' }}>✕</button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        {/* Name */}
                        <Field label="Name">
                            <input
                                type="text"
                                value={editing.name}
                                onChange={e => setEditing(prev => ({ ...prev, name: e.target.value }))}
                                style={inputStyle}
                            />
                        </Field>

                        {/* Skills */}
                        <Field label="Skills (comma-separated)">
                            <input
                                type="text"
                                value={editing.skills.join(', ')}
                                onChange={e => setSkills(e.target.value)}
                                placeholder="Survival, Nature"
                                style={inputStyle}
                            />
                        </Field>

                        {/* Requirements */}
                        <Field label="Requirements">
                            <input
                                type="text"
                                value={editing.requirements || ''}
                                onChange={e => setEditing(prev => ({ ...prev, requirements: e.target.value }))}
                                placeholder="Trained in Survival"
                                style={inputStyle}
                            />
                        </Field>

                        {/* DC Type */}
                        <Field label="Affected by DC">
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                {Object.entries(DC_TYPE_LABELS).map(([key, label]) => (
                                    <button
                                        key={key}
                                        onClick={() => setEditing(prev => ({ ...prev, dcType: key }))}
                                        style={{
                                            padding: '5px 12px', borderRadius: 4, cursor: 'pointer',
                                            background: editing.dcType === key ? '#673ab7' : '#1a1a1d',
                                            border: `1px solid ${editing.dcType === key ? '#673ab7' : '#444'}`,
                                            color: editing.dcType === key ? '#fff' : '#aaa',
                                            fontSize: '0.85em'
                                        }}
                                    >
                                        {label}
                                    </button>
                                ))}
                            </div>
                            {editing.dcType === 'custom' && (
                                <input
                                    type="number"
                                    value={editing.customDC ?? ''}
                                    onChange={e => setEditing(prev => ({ ...prev, customDC: e.target.value === '' ? null : parseInt(e.target.value) }))}
                                    placeholder="Custom DC value"
                                    style={{ ...inputStyle, marginTop: 6 }}
                                />
                            )}
                        </Field>

                        {/* Effect fields */}
                        <Field label="Effect — Critical Success">
                            <RichTextEditor
                                value={editing.effectCrit}
                                onChange={v => setEditing(prev => ({ ...prev, effectCrit: v }))}
                                placeholder="What happens on a critical success..."
                                style={{ minHeight: 80, background: '#111', border: '1px solid #2a4a2a' }}
                            />
                        </Field>

                        <Field label="Effect — Success">
                            <RichTextEditor
                                value={editing.effectSuccess}
                                onChange={v => setEditing(prev => ({ ...prev, effectSuccess: v }))}
                                placeholder="What happens on a success..."
                                style={{ minHeight: 80, background: '#111', border: '1px solid #2a3a1a' }}
                            />
                        </Field>

                        <Field label="Effect — Failure">
                            <RichTextEditor
                                value={editing.effectCritFail}
                                onChange={v => setEditing(prev => ({ ...prev, effectCritFail: v }))}
                                placeholder="What happens on a failure..."
                                style={{ minHeight: 80, background: '#111', border: '1px solid #3a1a1a' }}
                            />
                        </Field>

                        {/* Description */}
                        <Field label="Description">
                            <RichTextEditor
                                value={editing.description}
                                onChange={v => setEditing(prev => ({ ...prev, description: v }))}
                                placeholder="Activity description..."
                                style={{ minHeight: 120, background: '#111' }}
                            />
                        </Field>

                        {/* Actions */}
                        <div style={{ display: 'flex', gap: 8, paddingTop: 4 }}>
                            <button
                                onClick={saveActivity}
                                disabled={!editing.name?.trim()}
                                style={{
                                    flex: 1, padding: 10, background: '#c5a059', border: 'none',
                                    color: '#1a1a1d', borderRadius: 4, cursor: 'pointer',
                                    fontWeight: 'bold', opacity: editing.name?.trim() ? 1 : 0.5
                                }}
                            >
                                Save
                            </button>
                            <button
                                onClick={() => setEditing(null)}
                                style={{
                                    padding: '10px 20px', background: '#333', border: '1px solid #555',
                                    color: '#ccc', borderRadius: 4, cursor: 'pointer'
                                }}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function Field({ label, children }) {
    return (
        <div>
            <div style={{ fontSize: '0.78em', color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 5 }}>
                {label}
            </div>
            {children}
        </div>
    );
}

const inputStyle = {
    width: '100%', padding: '7px 10px', background: '#111',
    border: '1px solid #444', color: '#fff', borderRadius: 4,
    fontSize: '0.95em', boxSizing: 'border-box'
};
