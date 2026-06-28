import React, { useState, useMemo } from 'react';
import BottomSheet from '../shared/components/BottomSheet';
import { useWindowSize } from '../shared/hooks/useWindowSize';
import { useCampaign } from '../shared/context/CampaignContext';
import { useAppFeedback } from '../shared/feedback/AppFeedback';
import { selectLoreArticle, selectLoreArticles, selectLoreArticlesByCategory } from '../shared/db/selectors/loreSelectors';

const LORE_CATEGORIES = ['History', 'Locations', 'NPCs', 'Bestiary'];

export default function LoreAdminView({ db }) {
    const { dataActions } = useCampaign();
    const { confirm, notifyError } = useAppFeedback();
    const { isMobile } = useWindowSize();
    const [selectedCategory, setSelectedCategory] = useState('History');
    const [selectedArticleId, setSelectedArticleId] = useState(null);
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState({});

    const articles = selectLoreArticles(db);
    const runDataAction = (action) => {
        Promise.resolve(action).catch(err => {
            console.error(err);
            notifyError(err);
        });
    };

    // Toolbar button style
    const toolbarBtnStyle = {
        background: '#333',
        border: '1px solid #555',
        color: '#ccc',
        padding: '4px 10px',
        cursor: 'pointer',
        borderRadius: 3,
        fontSize: '0.9em',
        minWidth: 30
    };

    // Helper: Wrap selected text
    const wrapSelection = (before, after) => {
        const textarea = document.getElementById('lore-content-editor');
        if (!textarea) return;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const text = editForm.content || '';
        const selected = text.substring(start, end);
        const newText = text.substring(0, start) + before + selected + after + text.substring(end);
        setEditForm(f => ({ ...f, content: newText }));
        // Restore cursor position after React update
        setTimeout(() => {
            textarea.focus();
            textarea.setSelectionRange(start + before.length, end + before.length);
        }, 0);
    };

    // Helper: Insert at cursor
    const insertAtCursor = (insert) => {
        const textarea = document.getElementById('lore-content-editor');
        if (!textarea) return;
        const start = textarea.selectionStart;
        const text = editForm.content || '';
        const newText = text.substring(0, start) + insert + text.substring(start);
        setEditForm(f => ({ ...f, content: newText }));
        setTimeout(() => {
            textarea.focus();
            textarea.setSelectionRange(start + insert.length, start + insert.length);
        }, 0);
    };

    const filteredArticles = useMemo(() => {
        return selectLoreArticlesByCategory(db, selectedCategory);
    }, [db, selectedCategory]);

    const selectedArticle = useMemo(() => {
        return selectLoreArticle(db, selectedArticleId);
    }, [db, selectedArticleId]);

    // --- ACTIONS ---
    const handleCreate = () => {
        const newArticle = {
            id: crypto.randomUUID(),
            title: 'New Article',
            category: selectedCategory.toLowerCase(),
            group: 'General',
            content: '',
            image: null,
            tags: []
        };
        setEditForm(newArticle);
        setIsEditing(true);
    };

    const handleEdit = (article) => {
        setEditForm({ ...article, tags: article.tags || [] });
        setIsEditing(true);
    };

    const handleDelete = async (articleId) => {
        const confirmed = await confirm({
            title: 'Delete article',
            message: 'Delete this article?',
            confirmLabel: 'Delete',
            danger: true,
        });
        if (!confirmed) return;
        runDataAction(dataActions.globalContent.deleteLoreArticle(articleId));
        if (selectedArticleId === articleId) setSelectedArticleId(null);
    };

    const handleClone = (article) => {
        const cloned = {
            ...article,
            id: crypto.randomUUID(),
            title: article.title + ' (Copy)'
        };
        runDataAction(dataActions.globalContent.saveLoreArticle(cloned));
        setSelectedArticleId(cloned.id);
        setIsEditing(true);
        setEditForm(cloned);
    };

    // Context menu state
    const [contextMenu, setContextMenu] = useState(null);

    // Move article up or down in the list
    const moveArticle = (articleId, direction) => {
        const currentIdx = filteredArticles.findIndex(a => a.id === articleId);
        if (currentIdx === -1) return;

        const targetIdx = direction === 'up' ? currentIdx - 1 : currentIdx + 1;
        if (targetIdx < 0 || targetIdx >= filteredArticles.length) return;

        runDataAction(dataActions.globalContent.moveLoreArticle(articleId, direction));
    };

    const handleSave = () => {
        if (!editForm.title?.trim()) {
            notifyError('Title is required');
            return;
        }

        // Ensure category is lowercase
        const normalizedForm = {
            ...editForm,
            category: (editForm.category || selectedCategory).toLowerCase()
        };

        runDataAction(dataActions.globalContent.saveLoreArticle(normalizedForm));
        setIsEditing(false);
        setSelectedArticleId(normalizedForm.id);
    };

    const handleCancel = () => {
        setIsEditing(false);
        setEditForm({});
    };

    // --- RENDER ---
    return (
        <div style={{ display: 'flex', height: 'calc(100vh - 100px)', gap: isMobile ? 0 : 20, flexDirection: isMobile ? 'column' : 'row' }}>
            {/* LEFT: Category + Article List */}
            <div style={{ width: isMobile ? '100%' : '300px', background: 'rgba(0,0,0,0.3)', padding: 15, display: 'flex', flexDirection: 'column', flexShrink: 0, overflow: isMobile ? 'visible' : undefined }}>
                <h3 style={{ marginTop: 0 }}>Lore Wiki</h3>

                {/* Category Selector */}
                <select
                    value={selectedCategory}
                    onChange={(e) => { setSelectedCategory(e.target.value); setSelectedArticleId(null); }}
                    style={{
                        width: '100%',
                        padding: 10,
                        marginBottom: 15,
                        background: '#1a1a1d',
                        color: 'white',
                        border: '1px solid #555',
                        borderRadius: 4
                    }}
                >
                    {LORE_CATEGORIES.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                    ))}
                </select>

                {/* Article List */}
                <div style={{ flex: isMobile ? 'none' : 1, overflowY: 'auto', marginBottom: 10, maxHeight: isMobile ? 'calc(100dvh - 260px)' : undefined }}>
                    {filteredArticles.length === 0 && (
                        <p style={{ color: '#666', textAlign: 'center' }}>No articles yet.</p>
                    )}
                    {filteredArticles.map((article, idx) => (
                        <div
                            key={article.id}
                            onClick={() => { setSelectedArticleId(article.id); setIsEditing(false); setContextMenu(null); }}
                            onContextMenu={(e) => {
                                e.preventDefault();
                                setSelectedArticleId(article.id);
                                setContextMenu({ x: e.clientX, y: e.clientY, article });
                            }}
                            style={{
                                padding: '8px 12px',
                                background: selectedArticleId === article.id ? 'rgba(197, 160, 89, 0.2)' : 'transparent',
                                borderLeft: selectedArticleId === article.id ? '3px solid var(--text-gold)' : '3px solid transparent',
                                cursor: 'pointer',
                                marginBottom: 2,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8
                            }}
                        >
                            {/* Up/Down Arrows */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                <button
                                    onClick={(e) => { e.stopPropagation(); moveArticle(article.id, 'up'); }}
                                    disabled={idx === 0}
                                    style={{
                                        background: 'transparent',
                                        border: 'none',
                                        color: idx === 0 ? '#444' : '#888',
                                        cursor: idx === 0 ? 'default' : 'pointer',
                                        padding: '0 2px',
                                        fontSize: '0.7em',
                                        lineHeight: 1
                                    }}
                                    title="Move up"
                                >▲</button>
                                <button
                                    onClick={(e) => { e.stopPropagation(); moveArticle(article.id, 'down'); }}
                                    disabled={idx === filteredArticles.length - 1}
                                    style={{
                                        background: 'transparent',
                                        border: 'none',
                                        color: idx === filteredArticles.length - 1 ? '#444' : '#888',
                                        cursor: idx === filteredArticles.length - 1 ? 'default' : 'pointer',
                                        padding: '0 2px',
                                        fontSize: '0.7em',
                                        lineHeight: 1
                                    }}
                                    title="Move down"
                                >▼</button>
                            </div>

                            {/* Article Title & Group */}
                            <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 'bold', color: selectedArticleId === article.id ? 'var(--text-gold)' : '#ccc' }}>
                                    {article.title}
                                </div>
                                {article.group && article.group !== 'General' && (
                                    <div style={{ fontSize: '0.8em', color: '#666' }}>{article.group}</div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                <button
                    onClick={handleCreate}
                    className="btn-add-condition"
                    style={{ width: '100%' }}
                >
                    + New Article
                </button>
            </div>

            {/* RIGHT: Editor / Preview — hidden on mobile (uses BottomSheet instead) */}
            {!isMobile && <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px' }}>
                {isEditing ? (
                    <div style={{ background: '#1a1a1d', padding: 20, borderRadius: 8, border: '1px solid #444' }}>
                        <h2 style={{ marginTop: 0 }}>{editForm.id && articles.find(a => a.id === editForm.id) ? 'Edit Article' : 'New Article'}</h2>

                        {/* Title */}
                        <div style={{ marginBottom: 15 }}>
                            <label style={{ display: 'block', marginBottom: 5, color: '#aaa' }}>Title</label>
                            <input
                                type="text"
                                className="modal-input"
                                value={editForm.title || ''}
                                onChange={(e) => setEditForm(f => ({ ...f, title: e.target.value }))}
                            />
                        </div>

                        {/* Category */}
                        <div style={{ marginBottom: 15 }}>
                            <label style={{ display: 'block', marginBottom: 5, color: '#aaa' }}>Category</label>
                            <select
                                className="modal-input"
                                value={editForm.category || selectedCategory.toLowerCase()}
                                onChange={(e) => setEditForm(f => ({ ...f, category: e.target.value }))}
                            >
                                {LORE_CATEGORIES.map(cat => (
                                    <option key={cat} value={cat.toLowerCase()}>{cat}</option>
                                ))}
                            </select>
                        </div>

                        {/* Group */}
                        <div style={{ marginBottom: 15 }}>
                            <label style={{ display: 'block', marginBottom: 5, color: '#aaa' }}>Group (for tree structure)</label>
                            <input
                                type="text"
                                className="modal-input"
                                placeholder="e.g., Eras, Characters, Forests..."
                                value={editForm.group || ''}
                                onChange={(e) => setEditForm(f => ({ ...f, group: e.target.value }))}
                            />
                        </div>

                        {/* Image URL */}
                        <div style={{ marginBottom: 15 }}>
                            <label style={{ display: 'block', marginBottom: 5, color: '#aaa' }}>Image Path (optional)</label>
                            <input
                                type="text"
                                className="modal-input"
                                placeholder="ressources/images/..."
                                value={editForm.image || ''}
                                onChange={(e) => setEditForm(f => ({ ...f, image: e.target.value }))}
                            />
                        </div>

                        {/* Tags */}
                        <div style={{ marginBottom: 15 }}>
                            <label style={{ display: 'block', marginBottom: 5, color: '#aaa' }}>Tags (comma-separated)</label>
                            <input
                                type="text"
                                className="modal-input"
                                placeholder="king, legend, history"
                                value={(editForm.tags || []).join(', ')}
                                onChange={(e) => setEditForm(f => ({
                                    ...f,
                                    tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean)
                                }))}
                            />
                        </div>

                        {/* Infobox (Wikipedia-style data box) */}
                        <div style={{ marginBottom: 15 }}>
                            <label style={{ display: 'block', marginBottom: 5, color: '#aaa' }}>
                                Infobox (key:value pairs, one per line)
                            </label>
                            <textarea
                                className="modal-input"
                                rows={4}
                                placeholder="Region: Elfharrow&#10;Population: 31,716&#10;Founded: 842 AR&#10;Government: Merchant Republic"
                                value={editForm.infobox || ''}
                                onChange={(e) => setEditForm(f => ({ ...f, infobox: e.target.value }))}
                                style={{ fontFamily: 'monospace', resize: 'vertical', fontSize: '0.9em' }}
                            />
                        </div>

                        {/* Content with Toolbar */}
                        <div style={{ marginBottom: 15 }}>
                            <label style={{ display: 'block', marginBottom: 5, color: '#aaa' }}>
                                Content (Markdown-like: # headers, **bold**, *italics*, {'{{gold}}'}, [[Link]])
                            </label>

                            {/* Formatting Toolbar */}
                            <div style={{
                                display: 'flex',
                                gap: 5,
                                marginBottom: 8,
                                padding: '6px 8px',
                                background: '#222',
                                borderRadius: '4px 4px 0 0',
                                border: '1px solid #444',
                                borderBottom: 'none'
                            }}>
                                <button
                                    type="button"
                                    onClick={() => wrapSelection('**', '**')}
                                    style={toolbarBtnStyle}
                                    title="Bold"
                                >
                                    <strong>B</strong>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => wrapSelection('*', '*')}
                                    style={toolbarBtnStyle}
                                    title="Italics"
                                >
                                    <em>I</em>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => wrapSelection('{{', '}}')}
                                    style={{ ...toolbarBtnStyle, color: 'var(--text-gold)' }}
                                    title="Gold Text"
                                >
                                    G
                                </button>
                                <button
                                    type="button"
                                    onClick={() => insertAtCursor('\n---\n')}
                                    style={toolbarBtnStyle}
                                    title="Separator"
                                >
                                    ―
                                </button>
                                <button
                                    type="button"
                                    onClick={() => wrapSelection('[[', ']]')}
                                    style={toolbarBtnStyle}
                                    title="Link to Article"
                                >
                                    🔗
                                </button>
                            </div>

                            <textarea
                                id="lore-content-editor"
                                className="modal-input"
                                rows={12}
                                value={editForm.content || ''}
                                onChange={(e) => setEditForm(f => ({ ...f, content: e.target.value }))}
                                style={{
                                    fontFamily: 'monospace',
                                    resize: 'vertical',
                                    borderRadius: '0 0 4px 4px',
                                    marginTop: -1
                                }}
                            />
                        </div>

                        {/* Actions */}
                        <div style={{ display: 'flex', gap: 10 }}>
                            <button onClick={handleCancel} className="btn-add-condition" style={{ flex: 1 }}>Cancel</button>
                            <button
                                onClick={handleSave}
                                style={{
                                    flex: 1,
                                    padding: 10,
                                    background: 'var(--text-gold)',
                                    color: '#1a1a1d',
                                    border: 'none',
                                    fontWeight: 'bold',
                                    cursor: 'pointer',
                                    borderRadius: 4
                                }}
                            >
                                Save Article
                            </button>
                        </div>
                    </div>
                ) : selectedArticle ? (
                    <div style={{ background: '#1a1a1d', padding: 30, borderRadius: 8, border: '1px solid #444' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                            <h1 style={{ margin: 0, borderBottom: '2px solid var(--text-gold)', paddingBottom: 10 }}>
                                {selectedArticle.title}
                            </h1>
                            <div style={{ display: 'flex', gap: 10 }}>
                                <button onClick={() => handleEdit(selectedArticle)} className="btn-add-condition">Edit</button>
                                <button
                                    onClick={() => handleDelete(selectedArticle.id)}
                                    className="btn-add-condition"
                                    style={{ borderColor: '#d32f2f', color: '#ff8a80' }}
                                >
                                    Delete
                                </button>
                            </div>
                        </div>

                        {selectedArticle.group && (
                            <div style={{ color: '#888', marginBottom: 15 }}>
                                <strong>Group:</strong> {selectedArticle.group}
                            </div>
                        )}

                        {selectedArticle.image && (
                            <img
                                src={selectedArticle.image}
                                alt={selectedArticle.title}
                                style={{ maxWidth: '300px', marginBottom: 20, borderRadius: 4, border: '1px solid #444' }}
                            />
                        )}

                        <div style={{ color: '#ccc', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                            {selectedArticle.content || <em style={{ color: '#666' }}>No content yet.</em>}
                        </div>

                        {selectedArticle.tags?.length > 0 && (
                            <div style={{ marginTop: 30, paddingTop: 15, borderTop: '1px solid #333' }}>
                                {selectedArticle.tags.map(t => (
                                    <span key={t} style={{
                                        display: 'inline-block',
                                        marginRight: 8,
                                        padding: '2px 8px',
                                        background: '#333',
                                        borderRadius: 4,
                                        color: '#888',
                                        fontSize: '0.85em'
                                    }}>
                                        #{t}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                ) : (
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        height: '100%',
                        color: '#444',
                        flexDirection: 'column'
                    }}>
                        <div style={{ fontSize: '3em', opacity: 0.3 }}>📚</div>
                        <p>Select an article to preview or click "New Article" to create one.</p>
                    </div>
                )}
            </div>}

            {/* Mobile: article view / editor in BottomSheet */}
            {isMobile && (
                <BottomSheet
                    isOpen={isEditing || !!selectedArticle}
                    onClose={() => { if (isEditing) handleCancel(); else setSelectedArticleId(null); }}
                    title={isEditing ? (editForm.id && articles.find(a => a.id === editForm.id) ? 'Edit Article' : 'New Article') : selectedArticle?.title || ''}
                    height="90vh"
                >
                    <div style={{ overflowY: 'auto', height: '100%', padding: '0 16px 16px' }}>
                        {isEditing ? (
                            <div style={{ background: '#1a1a1d', padding: 20, borderRadius: 8, border: '1px solid #444' }}>
                                {/* Title */}
                                <div style={{ marginBottom: 15 }}>
                                    <label style={{ display: 'block', marginBottom: 5, color: '#aaa' }}>Title</label>
                                    <input type="text" className="modal-input" value={editForm.title || ''} onChange={(e) => setEditForm(f => ({ ...f, title: e.target.value }))} />
                                </div>
                                <div style={{ marginBottom: 15 }}>
                                    <label style={{ display: 'block', marginBottom: 5, color: '#aaa' }}>Category</label>
                                    <select className="modal-input" value={editForm.category || selectedCategory.toLowerCase()} onChange={(e) => setEditForm(f => ({ ...f, category: e.target.value }))}>
                                        {LORE_CATEGORIES.map(cat => <option key={cat} value={cat.toLowerCase()}>{cat}</option>)}
                                    </select>
                                </div>
                                <div style={{ marginBottom: 15 }}>
                                    <label style={{ display: 'block', marginBottom: 5, color: '#aaa' }}>Group</label>
                                    <input type="text" className="modal-input" placeholder="e.g., Eras, Characters..." value={editForm.group || ''} onChange={(e) => setEditForm(f => ({ ...f, group: e.target.value }))} />
                                </div>
                                <div style={{ marginBottom: 15 }}>
                                    <label style={{ display: 'block', marginBottom: 5, color: '#aaa' }}>Tags (comma-separated)</label>
                                    <input type="text" className="modal-input" placeholder="king, legend, history" value={(editForm.tags || []).join(', ')} onChange={(e) => setEditForm(f => ({ ...f, tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean) }))} />
                                </div>
                                <div style={{ marginBottom: 15 }}>
                                    <label style={{ display: 'block', marginBottom: 5, color: '#aaa' }}>Infobox (key:value pairs)</label>
                                    <textarea className="modal-input" rows={4} value={editForm.infobox || ''} onChange={(e) => setEditForm(f => ({ ...f, infobox: e.target.value }))} style={{ fontFamily: 'monospace', resize: 'vertical', fontSize: '0.9em' }} />
                                </div>
                                <div style={{ marginBottom: 15 }}>
                                    <label style={{ display: 'block', marginBottom: 5, color: '#aaa' }}>Content</label>
                                    <textarea id="lore-content-editor" className="modal-input" rows={14} value={editForm.content || ''} onChange={(e) => setEditForm(f => ({ ...f, content: e.target.value }))} style={{ fontFamily: 'monospace', resize: 'vertical' }} />
                                </div>
                                <div style={{ display: 'flex', gap: 10 }}>
                                    <button onClick={handleCancel} className="btn-add-condition" style={{ flex: 1 }}>Cancel</button>
                                    <button onClick={handleSave} style={{ flex: 1, padding: 10, background: 'var(--text-gold)', color: '#1a1a1d', border: 'none', fontWeight: 'bold', cursor: 'pointer', borderRadius: 4 }}>Save</button>
                                </div>
                            </div>
                        ) : selectedArticle ? (
                            <div style={{ background: '#1a1a1d', padding: 20, borderRadius: 8, border: '1px solid #444' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                                    <h2 style={{ margin: 0, color: '#f5deb3', fontSize: '1.3em' }}>{selectedArticle.title}</h2>
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        <button onClick={() => handleEdit(selectedArticle)} className="btn-add-condition">Edit</button>
                                        <button onClick={() => handleDelete(selectedArticle.id)} className="btn-add-condition" style={{ borderColor: '#d32f2f', color: '#ff8a80' }}>Del</button>
                                    </div>
                                </div>
                                {selectedArticle.group && <div style={{ color: '#888', marginBottom: 12, fontSize: '0.85em' }}>Group: {selectedArticle.group}</div>}
                                <div style={{ color: '#ccc', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{selectedArticle.content || <em style={{ color: '#666' }}>No content yet.</em>}</div>
                                {selectedArticle.tags?.length > 0 && (
                                    <div style={{ marginTop: 20, paddingTop: 12, borderTop: '1px solid #333' }}>
                                        {selectedArticle.tags.map(t => <span key={t} style={{ display: 'inline-block', marginRight: 8, padding: '2px 8px', background: '#333', borderRadius: 4, color: '#888', fontSize: '0.85em' }}>#{t}</span>)}
                                    </div>
                                )}
                            </div>
                        ) : null}
                    </div>
                </BottomSheet>
            )}

            {/* Context Menu */}
            {contextMenu && (
                <div
                    onClick={() => setContextMenu(null)}
                    style={{
                        position: 'fixed',
                        top: 0, left: 0, right: 0, bottom: 0,
                        zIndex: 9998
                    }}
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            position: 'fixed',
                            top: contextMenu.y,
                            left: contextMenu.x,
                            background: '#2a2a2e',
                            border: '1px solid var(--border-color)',
                            borderRadius: 4,
                            boxShadow: '0 4px 15px rgba(0,0,0,0.5)',
                            zIndex: 9999,
                            minWidth: 150
                        }}
                    >
                        <div
                            onClick={() => {
                                handleClone(contextMenu.article);
                                setContextMenu(null);
                            }}
                            style={{
                                padding: '10px 15px',
                                cursor: 'pointer',
                                borderBottom: '1px solid #444',
                                color: '#ccc'
                            }}
                            onMouseEnter={(e) => e.target.style.background = 'rgba(197,160,89,0.2)'}
                            onMouseLeave={(e) => e.target.style.background = 'transparent'}
                        >
                            📋 Clone Entry
                        </div>
                        <div
                            onClick={() => {
                                handleEdit(contextMenu.article);
                                setContextMenu(null);
                            }}
                            style={{
                                padding: '10px 15px',
                                cursor: 'pointer',
                                borderBottom: '1px solid #444',
                                color: '#ccc'
                            }}
                            onMouseEnter={(e) => e.target.style.background = 'rgba(197,160,89,0.2)'}
                            onMouseLeave={(e) => e.target.style.background = 'transparent'}
                        >
                            ✏️ Edit
                        </div>
                        <div
                            onClick={() => {
                                handleDelete(contextMenu.article.id);
                                setContextMenu(null);
                            }}
                            style={{
                                padding: '10px 15px',
                                cursor: 'pointer',
                                color: '#ff8a80'
                            }}
                            onMouseEnter={(e) => e.target.style.background = 'rgba(211,47,47,0.2)'}
                            onMouseLeave={(e) => e.target.style.background = 'transparent'}
                        >
                            🗑️ Delete
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
