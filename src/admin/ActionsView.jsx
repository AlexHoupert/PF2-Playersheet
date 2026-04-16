import React, { useEffect, useMemo, useState } from 'react';
import ActionEditor from './editors/ActionEditor';
import MultiSelectDropdown from '../shared/components/MultiSelectDropdown';
import BottomSheet from '../shared/components/BottomSheet';
import ContentPreviewCard from './components/ContentPreviewCard';
import { useWindowSize } from '../shared/hooks/useWindowSize';
import { getAllActionIndexItems, ACTION_INDEX_FILTER_OPTIONS, fetchActionDetailBySourceFile } from '../shared/catalog/actionIndex';

const uniqueTypes = ACTION_INDEX_FILTER_OPTIONS.types;
const uniqueSubtypes = ACTION_INDEX_FILTER_OPTIONS.subtypes;

export default function ActionsView({ onInspectItem }) {
    const { isMobile } = useWindowSize();

    const [itemSearch, setItemSearch] = useState('');
    const [filterType, setFilterType] = useState([]);
    const [filterSubtype, setFilterSubtype] = useState([]);
    const [filterCost, setFilterCost] = useState([]);
    const [itemPage, setItemPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(50);
    const [editingItem, setEditingItem] = useState(null);
    const [contextMenu, setContextMenu] = useState(null);

    // Preview state
    const [previewItem, setPreviewItem] = useState(null);
    const [loadedDetail, setLoadedDetail] = useState(null);

    // Fetch full detail when preview item changes
    useEffect(() => {
        if (!previewItem?.sourceFile) { setLoadedDetail(null); return; }
        setLoadedDetail(null);
        fetchActionDetailBySourceFile(previewItem.sourceFile)
            .then(detail => setLoadedDetail(detail))
            .catch(err => console.error('Failed to load action detail', err));
    }, [previewItem?.sourceFile]);

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

    const handleRowClick = (item) => {
        if (!isMobile) {
            setPreviewItem(item);
        }
    };

    const handleRowDoubleClick = (item) => {
        if (isMobile) {
            setPreviewItem(item);
        } else {
            setEditingItem(item);
        }
    };

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
                    window.location.reload();
                }}
                onCancel={() => setEditingItem(null)}
            />
        );
    }

    // Preview content
    const previewContent = previewItem ? (
        <ContentPreviewCard
            item={loadedDetail || previewItem}
            entityType="action"
            onEdit={() => { setEditingItem(previewItem); setPreviewItem(null); }}
            onClose={() => setPreviewItem(null)}
        />
    ) : null;

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

            {/* Table + Side panel */}
            <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
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
                                        background: previewItem?.name === item.name
                                            ? 'rgba(197,160,89,0.1)'
                                            : (idx % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent'),
                                        cursor: 'pointer'
                                    }}
                                    onClick={() => handleRowClick(item)}
                                    onDoubleClick={() => handleRowDoubleClick(item)}
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

                {/* Desktop side preview panel */}
                {!isMobile && previewItem && (
                    <div style={{ width: 420, borderLeft: '1px solid #444', overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: 16 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                            <h4 style={{ margin: 0, color: '#aaa' }}>Preview</h4>
                            <button onClick={() => setPreviewItem(null)} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer' }}>✕</button>
                        </div>
                        {previewContent}
                    </div>
                )}
            </div>

            {/* Mobile preview BottomSheet */}
            {isMobile && (
                <BottomSheet
                    isOpen={!!previewItem}
                    onClose={() => setPreviewItem(null)}
                    title={previewItem?.name || 'Preview'}
                    height="85vh"
                >
                    {previewContent}
                </BottomSheet>
            )}

            {contextMenu && (
                <div
                    style={{
                        position: 'fixed', top: contextMenu.y, left: contextMenu.x,
                        background: '#2b2b2e', border: '1px solid #c5a059', borderRadius: 4, zIndex: 2000,
                        minWidth: 150, boxShadow: '0 2px 10px rgba(0,0,0,0.5)'
                    }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="ctx-item" style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #444' }} onClick={() => { setPreviewItem(contextMenu.item); setContextMenu(null); }}>
                        👁️ Preview
                    </div>
                    <div className="ctx-item" style={{ padding: '8px 12px', cursor: 'pointer' }} onClick={() => { setEditingItem(contextMenu.item); setContextMenu(null); }}>
                        {contextMenu.item.sourceFile && contextMenu.item.sourceFile.startsWith('actions/') ? '✏️ Edit Action' : '📋 Clone/Override Action'}
                    </div>
                    {contextMenu.item.sourceFile && contextMenu.item.sourceFile.startsWith('actions/') && (
                        <div className="ctx-item" style={{ padding: '8px 12px', cursor: 'pointer', color: '#ff5252' }} onClick={() => { deleteAction(contextMenu.item); setContextMenu(null); }}>
                            🗑️ Delete Action
                        </div>
                    )}
                    <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: -1 }} onClick={() => setContextMenu(null)}></div>
                </div>
            )}
        </div>
    );
}
