import React from 'react';
import { getShopIndexItemByName } from '../../shared/catalog/shopIndex';

export function FormulaBookModal({
    character,
    updateCharacter,
    dailyPrepQueue,
    setDailyPrepQueue,
    setModalData,
    setModalMode,
    onClose
}) {
    const formulas = character.formulaBook || [];

    // Daily Crafting Logic
    const hasMunitionsCrafter = (character.feats || []).includes("Munitions Crafter");
    const hasAdvAlchemy = character.classes?.some(c => c.name.toLowerCase() === 'alchemist') || (character.feats || []).includes("Advanced Alchemy");
    const canDailyCraft = hasMunitionsCrafter || hasAdvAlchemy;

    // Max Batches (Stored in character or default)
    const maxBatches = character.dailyCraftingMax || 5;
    const currentBatches = dailyPrepQueue.reduce((acc, i) => acc + (i.batches || 1), 0);

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 1000,
            display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 20
        }} onClick={onClose}>
            <div style={{
                backgroundColor: '#2b2b2e', border: '2px solid #c5a059',
                padding: '20px', borderRadius: '8px', maxWidth: '500px', width: '100%',
                color: '#e0e0e0',
                maxHeight: '85vh',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column'
            }} onClick={e => e.stopPropagation()}>

                <h2>Formula Book ({formulas.length})</h2>
                {formulas.length === 0 && <div style={{ color: '#888', fontStyle: 'italic' }}>No known formulas. Buy them effectively from the shop.</div>}

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 15, maxHeight: '40vh', overflowY: 'auto' }}>
                    {formulas.map(fName => {
                        const item = getShopIndexItemByName(fName) || { name: fName };

                        return (
                            <div key={fName}
                                style={{ background: '#333', padding: 8, borderRadius: 4, display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
                                onClick={() => { setModalData(item); setModalMode('item'); }}
                            >
                                {item.img ? (
                                    <img src={`ressources/${item.img}`} style={{ width: 32, height: 32, objectFit: 'contain' }} alt="" />
                                ) : (
                                    <div style={{ width: 32, height: 32, background: '#444', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2em' }}>📜</div>
                                )}
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 'bold' }}>{item.name}</div>
                                    <div style={{ fontSize: '0.8em', color: '#aaa' }}>Level {item.level || '?'} • {item.price || '?'} gp</div>
                                </div>

                                {/* Prepare Button */}
                                {canDailyCraft && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            const isAmmo = (item.type || '').toLowerCase() === 'ammunition' ||
                                                (item.group || '').toLowerCase() === 'ammunition' ||
                                                /arrow|bolt|round|cartridge|shot/i.test(item.name);
                                            const batchSize = isAmmo ? 4 : 1;

                                            // Add to queue logic
                                            setDailyPrepQueue(prev => {
                                                const existing = prev.find(p => p.name === item.name);
                                                if (existing) {
                                                    return prev.map(p => p.name === item.name ? { ...p, batches: p.batches + 1 } : p);
                                                }
                                                return [...prev, { ...item, batches: 1, batchSize }];
                                            });
                                        }}
                                        style={{
                                            background: '#673ab7',
                                            border: 'none',
                                            borderRadius: 4,
                                            padding: '4px 10px',
                                            cursor: 'pointer',
                                            color: '#fff',
                                            fontSize: '0.9em',
                                            display: 'flex', alignItems: 'center', gap: 5
                                        }}
                                        title="Prepare Batch (Use Daily Crafting)"
                                    >
                                        <span style={{ fontSize: '1.1em' }}>⚡</span>
                                        Prep +{((item.type || '').toLowerCase() === 'ammunition' || (item.group || '').toLowerCase() === 'ammunition' || /arrow|bolt|round|cartridge|shot/i.test(item.name)) ? 4 : 1}
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Daily Preparation Section */}
                {canDailyCraft && (
                    <div style={{ marginTop: 20, borderTop: '2px dashed #555', paddingTop: 15 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                            <h3 style={{ margin: 0, color: '#b39ddb' }}>Daily Preparation</h3>
                            <div
                                style={{ background: '#222', padding: '4px 8px', borderRadius: 4, fontSize: '0.9em', cursor: 'pointer' }}
                                onClick={() => {
                                    const newMax = prompt("Set Maximum Batches:", maxBatches);
                                    if (newMax !== null && !isNaN(newMax)) {
                                        updateCharacter(c => c.dailyCraftingMax = parseInt(newMax));
                                    }
                                }}
                                title="Click to edit Max Batches"
                            >
                                <span style={{ color: currentBatches > maxBatches ? '#ff5252' : '#fff', fontWeight: 'bold' }}>{currentBatches}</span>
                                <span style={{ color: '#888' }}> / {maxBatches} Batches</span>
                            </div>
                        </div>

                        {dailyPrepQueue.length === 0 ? (
                            <div style={{ color: '#666', fontStyle: 'italic', textAlign: 'center', padding: 10 }}>
                                No items queued. Click "Prep" on formulas above.
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                                {dailyPrepQueue.map((qItem, idx) => (
                                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#30204a', padding: '5px 8px', borderRadius: 4 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            {qItem.img && <img src={`ressources/${qItem.img}`} style={{ width: 24, height: 24 }} alt="" />}
                                            <div>
                                                <div style={{ fontSize: '0.95em' }}>{qItem.name}</div>
                                                <div style={{ fontSize: '0.75em', color: '#bbb' }}>{qItem.batches} batch(es) x {qItem.batchSize || 1} = <span style={{ color: '#fff' }}>{qItem.batches * (qItem.batchSize || 1)} items</span></div>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', gap: 5 }}>
                                            <button
                                                onClick={() => setDailyPrepQueue(prev => {
                                                    const p = prev[idx];
                                                    if (p.batches > 1) return prev.map((item, i) => i === idx ? { ...item, batches: item.batches - 1 } : item);
                                                    return prev.filter((_, i) => i !== idx);
                                                })}
                                                style={{ background: '#ff5252', border: 'none', color: '#fff', borderRadius: 3, width: 24, height: 24, cursor: 'pointer' }}
                                            >
                                                -
                                            </button>
                                        </div>
                                    </div>
                                ))}

                                <button
                                    className="btn-buy"
                                    style={{ marginTop: 10, background: '#673ab7', width: '100%' }}
                                    onClick={() => {
                                        if (confirm(`Create ${currentBatches} batches of items?`)) {
                                            updateCharacter(c => {
                                                dailyPrepQueue.forEach(qItem => {
                                                    const totalQty = qItem.batches * (qItem.batchSize || 1);
                                                    c.inventory.push({
                                                        ...qItem,
                                                        qty: totalQty,
                                                        prepared: true,
                                                        addedAt: Date.now()
                                                    });
                                                });
                                            });
                                            setDailyPrepQueue([]);
                                            alert("Daily preparation complete! Items added to inventory.");
                                            setModalMode(null);
                                        }
                                    }}
                                >
                                    Finish Preparation
                                </button>
                            </div>
                        )}
                    </div>
                )}

                <button onClick={onClose} style={{
                    marginTop: 20, width: '100%', padding: '10px', background: '#c5a059',
                    border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 'bold', color: '#1a1a1d',
                    flexShrink: 0
                }}>Close</button>
            </div>
        </div>
    );
}
