import React, { useEffect, useMemo, useState } from 'react';
import ActionEditor from './editors/ActionEditor';
import MultiSelectDropdown from '../shared/components/MultiSelectDropdown';
import { getAllActionIndexItems, ACTION_INDEX_FILTER_OPTIONS } from '../shared/catalog/actionIndex';

const uniqueTypes = ACTION_INDEX_FILTER_OPTIONS.types;
const uniqueSubtypes = ACTION_INDEX_FILTER_OPTIONS.subtypes;

export default function ActionsView({ onInspectItem }) {
    // Migrated to File-System. No more DB actions.

    const [itemSearch, setItemSearch] = useState('');
    const [filterType, setFilterType] = useState([]);
    const [filterSubtype, setFilterSubtype] = useState([]);
    const [filterCost, setFilterCost] = useState([]);
    const [itemPage, setItemPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(50);
    const [editingItem, setEditingItem] = useState(null);
    const [contextMenu, setContextMenu] = useState(null);

    // Source of Truth is now the Index directly
    // The server/script merges system and user actions into one index
    // However, we still need to distinguish "Custom" actions for UI (Edit/Delete vs Clone/View).
    // The index item has `sourceFile`. If it starts with `actions/`, it's likely custom if it's in our user folder.
    // Actually, `generate_action_index.js` scans `ressources/actions`. 
    // And system actions? `generate_action_index.js` ONLY scans `ressources/actions`??
    // Wait. `action_index.json` previously contained system actions.
    // Let's re-read `generate_action_index.js`.
    // It filters `fs.readdirSync(ACTIONS_DIR)`.
    // Does `ACTIONS_DIR` contain system actions?
    // If I overwrote the index logic to ONLY scan `ressources/actions`, I might have lost system actions if they weren't in that folder!
    // The previous index might have been static or generated from system compendiums.
    // `action_index.json` has `dict` and `items`.
    // If `ressources/actions` is empty (except for my new files), then the index will only have my files.
    // I need to ensure SYSTEM actions are preserved or also scanned.
    // Assuming for now the user has system actions in `ressources/actions` or I need to handle "System" vs "Custom".
    // "Custom" actions usually reside in `ressources/actions`. System might be elsewhere or pre-loaded.
    // But for the View, we just display what's in the index.

    // For "Is Custom": we can check if sourceFile starts with `actions/`.
    // System actions often come from `systems/pf2e/...` or similar if copied.
    // Let's assume anything in `ressources/actions` is editable.

    const allActions = getAllActionIndexItems();

    const filteredItems = useMemo(() => {
        const searchLower = itemSearch.trim().toLowerCase();
        return allActions.filter(i => {
            if (filterType.length && !filterType.includes(i.userType)) return false;
            if (filterSubtype.length && !filterSubtype.includes(i.userSubtype)) return false;
            if (filterCost.length && !filterCost.includes(i.typeCode)) return false;

            return i.name.toLowerCase().includes(searchLower);
        });
    }, [allActions, filterType, filterSubtype, filterCost, itemSearch]);

    const sortedItems = useMemo(() => {
        const items = [...filteredItems];
        items.sort((a, b) => a.name.localeCompare(b.name));
        return items;
    }, [filteredItems]);

    const totalPages = Math.max(1, Math.ceil(sortedItems.length / itemsPerPage));
    const paginatedItems = sortedItems.slice((itemPage - 1) * itemsPerPage, itemPage * itemsPerPage);

    // Context Menu Handler
    const handleContextMenu = (e, item) => {
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY, item });
    };

    const deleteAction = async (item) => {
        if (!window.confirm(`Delete action "${item.name}"?`)) return;

        try {
            const filePath = item.sourceFile.startsWith('ressources/') ? item.sourceFile : `ressources/${item.sourceFile}`;
            const res = await fetch('/api/files', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filePath })
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.error);

            // Rebuild
            await fetch('/api/admin/rebuild-index/actions', { method: 'POST' });

            // Reload page or force refresh context (simplest is reload for pure file-based systems without live socket)
            window.location.reload();
        } catch (err) {
            alert(`Error deleting action: ${err.message}`);
        }
    };

    if (editingItem) {
        return (
            <ActionEditor
                initialItem={editingItem}
                onSave={() => {
                    setEditingItem(null);
                    window.location.reload(); // Reload to fetch new index
                }}
                onCancel={() => setEditingItem(null)}
            />
        );
    }

    return (
        <div className="admin-layout" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
            {/* Header / Toolbar */}
            <div style={{ padding: 10, background: '#222', borderBottom: '1px solid #444', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <input
                    className="modal-input"
                    placeholder="Search Actions..."
                    value={itemSearch}
                    onChange={e => { setItemSearch(e.target.value); setItemPage(1); }}
                    style={{ width: 200 }}
                />

                <button className="btn-add-condition" style={{ margin: 0, background: '#4caf50' }} onClick={() => setEditingItem({})}>
                    + New Action
                </button>

                <MultiSelectDropdown
                    label="Type"
                    options={uniqueTypes}
                    selected={filterType}
                    onChange={setFilterType}
                />
                <MultiSelectDropdown
                    label="Subtype"
                    options={uniqueSubtypes}
                    selected={filterSubtype}
                    onChange={setFilterSubtype}
                />
                <MultiSelectDropdown
                    label="Cost"
                    options={['1', '2', '3', 'R', 'F', 'P']}
                    selected={filterCost}
                    onChange={setFilterCost}
                />
            </div>

            {/* Table */}
            <div style={{ flex: 1, overflow: 'auto', padding: 10 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9em' }}>
                    <thead>
                        <tr style={{ background: '#333', textAlign: 'left' }}>
                            <th style={{ padding: 8 }}>Name</th>
                            <th style={{ padding: 8 }}>Cost</th>
                            <th style={{ padding: 8 }}>Type</th>
                            <th style={{ padding: 8 }}>Subtype</th>
                            <th style={{ padding: 8 }}>Feat Prereq</th>
                            <th style={{ padding: 8 }}>Source</th>
                        </tr>
                    </thead>
                    <tbody>
                        {paginatedItems.map((item, idx) => (
                            <tr
                                key={item.name}
                                style={{
                                    borderBottom: '1px solid #444',
                                    background: (idx % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent'),
                                    cursor: 'pointer'
                                }}
                                onDoubleClick={() => setEditingItem(item)}
                                onContextMenu={(e) => handleContextMenu(e, item)}
                            >
                                <td style={{ padding: 8, color: (item.sourceFile && item.sourceFile.startsWith('actions/')) ? 'var(--text-gold)' : 'inherit' }}>
                                    {item.name}
                                </td>
                                <td style={{ padding: 8 }}>{item.typeCode || '-'}</td>
                                <td style={{ padding: 8 }}>{item.userType || item.type}</td>
                                <td style={{ padding: 8 }}>{item.userSubtype || item.subtype}</td>
                                <td style={{ padding: 8, color: '#aaa', fontStyle: 'italic' }}>{item.feat || '-'}</td>
                                <td style={{ padding: 8 }}>
                                    {(item.sourceFile && item.sourceFile.startsWith('actions/')) ? 'Custom' : 'System'}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <div style={{ marginTop: 10, display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'center' }}>
                    <button disabled={itemPage === 1} onClick={() => setItemPage(p => Math.max(1, p - 1))}>Prev</button>
                    <span>Page {itemPage} of {totalPages}</span>
                    <button disabled={itemPage === totalPages} onClick={() => setItemPage(p => Math.min(totalPages, p + 1))}>Next</button>
                </div>
            </div>

            {contextMenu && (
                <div
                    style={{
                        position: 'fixed', top: contextMenu.y, left: contextMenu.x,
                        background: '#2b2b2e', border: '1px solid #c5a059', borderRadius: 4, zIndex: 2000,
                        minWidth: 150, boxShadow: '0 2px 10px rgba(0,0,0,0.5)'
                    }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="ctx-item" style={{ padding: '8px 12px', cursor: 'pointer' }} onClick={() => { setEditingItem(contextMenu.item); setContextMenu(null); }}>
                        {contextMenu.item.sourceFile && contextMenu.item.sourceFile.startsWith('actions/') ? 'Edit Action' : 'Clone/Override Action'}
                    </div>
                    {contextMenu.item.sourceFile && contextMenu.item.sourceFile.startsWith('actions/') && (
                        <div className="ctx-item" style={{ padding: '8px 12px', cursor: 'pointer', color: '#ff5252' }} onClick={() => { deleteAction(contextMenu.item); setContextMenu(null); }}>
                            Delete Action
                        </div>
                    )}
                    <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: -1 }} onClick={() => setContextMenu(null)}></div>
                </div>
            )}
        </div>
    );
}
