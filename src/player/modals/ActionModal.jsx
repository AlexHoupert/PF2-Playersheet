import React, { useState } from 'react';

export function ActionModal({ updateCharacter, setModalMode }) {
    const [newAction, setNewAction] = useState({ name: '', type: 'Combat', subtype: 'Basic', skill: '', feat: '', description: '' });

    const saveNewAction = () => {
        if (!newAction.name) return;
        updateCharacter(c => {
            if (!c.actions) c.actions = [];
            c.actions.push({ ...newAction, source: 'custom' });
        });
        setModalMode(null);
    };

    return (
        <>
            <h2>Create New Action</h2>
            <div className="modal-form-group">
                <label>Name</label>
                <input className="modal-input" value={newAction.name} onChange={e => setNewAction({ ...newAction, name: e.target.value })} placeholder="Action Name" />
            </div>
            <div className="modal-form-group">
                <label>Type (comma separated)</label>
                <input className="modal-input" value={newAction.type} onChange={e => setNewAction({ ...newAction, type: e.target.value })} placeholder="Combat, Movement" />
            </div>
            <div className="modal-form-group">
                <label>Subtype</label>
                <input className="modal-input" value={newAction.subtype} onChange={e => setNewAction({ ...newAction, subtype: e.target.value })} placeholder="Basic, Skill, Class..." />
            </div>
            <div className="modal-form-group">
                <label>Skill (optional)</label>
                <input className="modal-input" value={newAction.skill} onChange={e => setNewAction({ ...newAction, skill: e.target.value })} placeholder="Athletics" />
            </div>
            <div className="modal-form-group">
                <label>Feat (optional)</label>
                <input className="modal-input" value={newAction.feat} onChange={e => setNewAction({ ...newAction, feat: e.target.value })} placeholder="Feat Name" />
            </div>
            <div className="modal-form-group">
                <label>Description</label>
                <textarea className="modal-input" style={{ height: 100, fontFamily: 'inherit', resize: 'vertical' }} value={newAction.description} onChange={e => setNewAction({ ...newAction, description: e.target.value })} placeholder="Action description..." />
            </div>
            <button className="set-btn" onClick={saveNewAction}>Save Action</button>
        </>
    );
}
