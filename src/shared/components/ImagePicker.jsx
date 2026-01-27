/**
 * ImagePicker - Modal component for browsing and selecting image files
 * Allows navigation through folders and selecting image files
 */
import React, { useState, useEffect } from 'react';

// Common image extensions
const IMAGE_EXTENSIONS = ['.webp', '.png', '.jpg', '.jpeg', '.gif', '.svg'];

export default function ImagePicker({ isOpen, onClose, onSelect, initialPath = 'ressources' }) {
    const [currentPath, setCurrentPath] = useState(initialPath);
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [selectedItem, setSelectedItem] = useState(null);

    // Load directory contents
    useEffect(() => {
        if (!isOpen) return;

        const loadDirectory = async () => {
            setLoading(true);
            setError(null);
            setSelectedItem(null);

            try {
                const res = await fetch(`/api/files/list?directory=${encodeURIComponent(currentPath)}`);
                const data = await res.json();

                if (!data.success) {
                    throw new Error(data.error || 'Failed to load directory');
                }

                // Filter to only show directories and image files
                const filteredItems = data.items.filter(item => {
                    if (item.isDirectory) return true;
                    return IMAGE_EXTENSIONS.includes(item.extension);
                });

                setItems(filteredItems);
            } catch (err) {
                setError(err.message);
                setItems([]);
            } finally {
                setLoading(false);
            }
        };

        loadDirectory();
    }, [isOpen, currentPath]);

    // Navigate to parent directory
    const goUp = () => {
        const parts = currentPath.split('/').filter(Boolean);
        if (parts.length > 1) {
            parts.pop();
            setCurrentPath(parts.join('/'));
        }
    };

    // Navigate into a directory
    const navigateToFolder = (item) => {
        setCurrentPath(item.path);
    };

    // Select an image file
    const selectImage = (item) => {
        setSelectedItem(item);
    };

    // Confirm selection
    const confirmSelection = () => {
        if (selectedItem) {
            // Convert path to relative from ressources/
            const relativePath = selectedItem.path.replace(/^ressources\//, '');
            onSelect(relativePath);
            onClose();
        }
    };

    // Get image URL for preview
    const getImageUrl = (itemPath) => {
        const basePath = itemPath.replace(/^ressources\//, '');
        return `/api/static/${basePath}`;
    };

    if (!isOpen) return null;

    return (
        <div style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.8)',
            zIndex: 2000,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 20
        }} onClick={onClose}>
            <div style={{
                background: '#2a2a2a',
                borderRadius: 8,
                width: '90%',
                maxWidth: 800,
                maxHeight: '80vh',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                border: '2px solid #c5a059'
            }} onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div style={{
                    padding: '12px 16px',
                    borderBottom: '1px solid #444',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: '#222'
                }}>
                    <h3 style={{ margin: 0 }}>Select Image</h3>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: '#888',
                            fontSize: '1.5em',
                            cursor: 'pointer'
                        }}
                    >×</button>
                </div>

                {/* Breadcrumb / Path */}
                <div style={{
                    padding: '8px 16px',
                    background: '#1a1a1a',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    fontSize: '0.85em',
                    color: '#888'
                }}>
                    <button
                        onClick={goUp}
                        disabled={currentPath === 'ressources'}
                        style={{
                            padding: '4px 8px',
                            background: currentPath === 'ressources' ? '#333' : '#444',
                            border: 'none',
                            borderRadius: 4,
                            color: currentPath === 'ressources' ? '#666' : '#ccc',
                            cursor: currentPath === 'ressources' ? 'not-allowed' : 'pointer'
                        }}
                    >↑ Up</button>
                    <span style={{ color: '#c5a059' }}>📁</span>
                    <span style={{ color: '#ccc' }}>{currentPath}</span>
                </div>

                {/* Content */}
                <div style={{
                    flex: 1,
                    overflow: 'auto',
                    padding: 16
                }}>
                    {loading && (
                        <div style={{ textAlign: 'center', padding: 40, color: '#888' }}>
                            Loading...
                        </div>
                    )}

                    {error && (
                        <div style={{ textAlign: 'center', padding: 40, color: '#f44336' }}>
                            Error: {error}
                        </div>
                    )}

                    {!loading && !error && items.length === 0 && (
                        <div style={{ textAlign: 'center', padding: 40, color: '#666' }}>
                            No images found in this folder
                        </div>
                    )}

                    {!loading && !error && items.length > 0 && (
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
                            gap: 12
                        }}>
                            {items.map(item => (
                                <div
                                    key={item.path}
                                    onClick={() => item.isDirectory ? navigateToFolder(item) : selectImage(item)}
                                    onDoubleClick={() => item.isDirectory ? navigateToFolder(item) : confirmSelection()}
                                    style={{
                                        padding: 8,
                                        borderRadius: 6,
                                        background: selectedItem?.path === item.path ? '#3a3a5a' : '#333',
                                        border: selectedItem?.path === item.path ? '2px solid #c5a059' : '2px solid transparent',
                                        cursor: 'pointer',
                                        textAlign: 'center',
                                        transition: 'all 0.15s'
                                    }}
                                >
                                    {item.isDirectory ? (
                                        <div style={{
                                            fontSize: '2.5em',
                                            marginBottom: 4,
                                            color: '#c5a059'
                                        }}>📁</div>
                                    ) : (
                                        <div style={{
                                            width: '100%',
                                            height: 60,
                                            display: 'flex',
                                            justifyContent: 'center',
                                            alignItems: 'center',
                                            marginBottom: 4,
                                            background: '#111',
                                            borderRadius: 4
                                        }}>
                                            <img
                                                src={getImageUrl(item.path)}
                                                alt={item.name}
                                                style={{
                                                    maxWidth: '100%',
                                                    maxHeight: 60,
                                                    objectFit: 'contain'
                                                }}
                                                onError={e => {
                                                    e.target.style.display = 'none';
                                                    e.target.parentElement.innerHTML = '🖼️';
                                                }}
                                            />
                                        </div>
                                    )}
                                    <div style={{
                                        fontSize: '0.75em',
                                        color: '#ccc',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap'
                                    }}>
                                        {item.name}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer with selection preview */}
                <div style={{
                    padding: '12px 16px',
                    borderTop: '1px solid #444',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: '#222',
                    gap: 16
                }}>
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
                        {selectedItem && (
                            <>
                                <img
                                    src={getImageUrl(selectedItem.path)}
                                    alt=""
                                    style={{ width: 32, height: 32, objectFit: 'contain', background: '#111', borderRadius: 4 }}
                                />
                                <span style={{ fontSize: '0.85em', color: '#ccc' }}>
                                    {selectedItem.path.replace(/^ressources\//, '')}
                                </span>
                            </>
                        )}
                        {!selectedItem && (
                            <span style={{ fontSize: '0.85em', color: '#666', fontStyle: 'italic' }}>
                                Click an image to select, double-click to confirm
                            </span>
                        )}
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button
                            onClick={onClose}
                            style={{
                                padding: '8px 16px',
                                background: '#444',
                                border: 'none',
                                borderRadius: 4,
                                color: '#ccc',
                                cursor: 'pointer'
                            }}
                        >Cancel</button>
                        <button
                            onClick={confirmSelection}
                            disabled={!selectedItem}
                            style={{
                                padding: '8px 16px',
                                background: selectedItem ? '#c5a059' : '#555',
                                border: 'none',
                                borderRadius: 4,
                                color: selectedItem ? '#1a1a1d' : '#888',
                                cursor: selectedItem ? 'pointer' : 'not-allowed',
                                fontWeight: 'bold'
                            }}
                        >Select</button>
                    </div>
                </div>
            </div>
        </div>
    );
}
