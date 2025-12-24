import React, { useState, useEffect } from 'react';
import db from '../data/new_db.json';
import { SHOP_INDEX_ITEMS, fetchShopItemDetailBySourceFile } from '../shared/catalog/shopIndex';

export default function LootView() {
    const [lootBags, setLootBags] = useState(db.lootBags || []);
    const [selectedBagId, setSelectedBagId] = useState(null);
    const [saveStatus, setSaveStatus] = useState(null);
    const [filter, setFilter] = useState('');
    const [draggedItem, setDraggedItem] = useState(null);

    // --- INIT ---
    useEffect(() => {
        if (!db.lootBags) {
            db.lootBags = [];
            setLootBags([]);
        }
    }, []);

    // --- ACTIONS ---
    const saveLootBags = async (newBags) => {
        setSaveStatus('saving');
        try {
            setLootBags(newBags);
            db.lootBags = newBags;
            await fetch('/api/files/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filePath: 'src/data/new_db.json', content: db })
            });
            setSaveStatus('success');
            setTimeout(() => setSaveStatus(null), 2000);
        } catch (err) {
            console.error(err);
            setSaveStatus('error');
        }
    };

    const handleCreateBag = () => {
        const name = prompt("Enter Loot Bag Name (e.g., 'Dragon Hoard'):");
        if (!name) return;

        const newBag = {
            id: crypto.randomUUID(),
            name,
            items: [],
            isLocked: true // Default to locked so players can't see/loot immediately? Let's say false for now to make testing easier.
        };
        saveLootBags([...lootBags, newBag]);
        setSelectedBagId(newBag.id);
    };

    const handleDeleteBag = async (id) => {
        if (!window.confirm("Delete this loot bag?")) return;
        const newBags = lootBags.filter(b => b.id !== id);
        saveLootBags(newBags);
        if (selectedBagId === id) setSelectedBagId(null);
    };

    // --- DRAG & DROP ---
    const handleDragStart = (e, item) => {
        setDraggedItem(item);
        e.dataTransfer.setData('text/plain', JSON.stringify(item));
        e.dataTransfer.effectAllowed = 'copy';
    };

    const handleDrop = async (e, bagId) => {
        e.preventDefault();
        const bagIndex = lootBags.findIndex(b => b.id === bagId);
        if (bagIndex === -1) return;

        let itemToAdd = draggedItem;
        if (!itemToAdd) {
            try {
                itemToAdd = JSON.parse(e.dataTransfer.getData('text/plain'));
            } catch (err) { return; }
        }

        // Ideally fetch full details if we only have index data
        // For simplicity, we add what we have, but if sourceFile is present, we might want to fetch stats later.
        // Let's store a reference or minimal copy + UUID for the instance.

        const lootItem = {
            ...itemToAdd,
            instanceId: crypto.randomUUID(),
            addedAt: Date.now()
        };

        const newBags = [...lootBags];
        newBags[bagIndex].items.push(lootItem);
        saveLootBags(newBags);
        setDraggedItem(null);
    };

    const handleRemoveItem = (bagId, itemInstanceId) => {
        const bagIndex = lootBags.findIndex(b => b.id === bagId);
        if (bagIndex === -1) return;

        const newBags = [...lootBags];
        newBags[bagIndex].items = newBags[bagIndex].items.filter(i => i.instanceId !== itemInstanceId);
        saveLootBags(newBags);
    };

    // --- RENDER ---
    const filteredItems = SHOP_INDEX_ITEMS.filter(i => i.name.toLowerCase().includes(filter.toLowerCase())).slice(0, 50);

    return (
        <div className="loot-view" style={{ display: 'grid', gridTemplateColumns: '300px 1fr', height: '100%', gap: 20, padding: 20 }}>

            {/* LEFT: CATALOG */}
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', borderRight: '1px solid #444', paddingRight: 20 }}>
                <h3>Item Catalog</h3>
                <input
                    className="modal-input"
                    placeholder="Search items..."
                    value={filter}
                    onChange={e => setFilter(e.target.value)}
                    style={{ marginBottom: 10 }}
                />
                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {filteredItems.map((item, idx) => (
                        <div
                            key={item.sourceFile || idx}
                            draggable
                            onDragStart={(e) => handleDragStart(e, item)}
                            style={{
                                padding: '8px 10px',
                                background: '#333',
                                border: '1px solid #555',
                                borderRadius: 4,
                                cursor: 'grab',
                                userSelect: 'none'
                            }}
                        >
                            <div style={{ fontWeight: 'bold' }}>{item.name}</div>
                            <div style={{ fontSize: '0.8em', color: '#aaa', display: 'flex', justifyContent: 'space-between' }}>
                                <span>{item.type}</span>
                                <span>Level {item.level}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* RIGHT: LOOT BAGS */}
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                    <h2>Loot Bags</h2>
                    <div>
                        {saveStatus === 'success' && <span style={{ color: '#4caf50', marginRight: 10 }}>Saved!</span>}
                        <button className="set-btn" onClick={handleCreateBag}>+ Create Loot Bag</button>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20 }}>
                    {lootBags.map(bag => (
                        <div
                            key={bag.id}
                            onDragOver={e => e.preventDefault()}
                            onDrop={e => handleDrop(e, bag.id)}
                            style={{
                                background: '#222',
                                border: '1px solid #444',
                                borderRadius: 8,
                                padding: 15,
                                display: 'flex',
                                flexDirection: 'column'
                            }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, borderBottom: '1px solid #444', paddingBottom: 5 }}>
                                <h3 style={{ margin: 0 }}>💰 {bag.name}</h3>
                                <button className="icon-btn" onClick={() => handleDeleteBag(bag.id)} title="Delete Bag" style={{ color: '#d32f2f' }}>🗑️</button>
                            </div>

                            <div style={{ flex: 1, minHeight: 100, display: 'flex', flexDirection: 'column', gap: 5 }}>
                                {bag.items.length === 0 && <div style={{ color: '#666', fontStyle: 'italic', textAlign: 'center', marginTop: 20 }}>Drag items here</div>}
                                {bag.items.map((item, i) => (
                                    <div key={item.instanceId || i} style={{ display: 'flex', alignItems: 'center', background: '#333', padding: '5px 8px', borderRadius: 4 }}>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontWeight: 'bold' }}>{item.name}</div>
                                            <div style={{ fontSize: '0.7em', color: '#ccc' }}>Lvl {item.level} • {item.price} gp</div>
                                        </div>
                                        <button className="icon-btn" onClick={() => handleRemoveItem(bag.id, item.instanceId)}>✖</button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
