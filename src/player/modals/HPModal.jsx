import React, { useState } from 'react';

export function HPModal({ character, updateCharacter }) {
    const [editVal, setEditVal] = useState("");
    const [showTempHp, setShowTempHp] = useState(false);

    return (
        <>
            <h2>Manage Hit Points</h2>
            <p style={{ textAlign: 'center', color: '#888' }}>
                Current HP: <span style={{ color: 'var(--text-gold)', fontWeight: 'bold' }}>{character.stats.hp.current}</span>
                &nbsp; | &nbsp;
                <span
                    onClick={() => setShowTempHp(!showTempHp)}
                    style={{ cursor: 'pointer', textDecoration: 'underline', textDecorationStyle: 'dotted', textUnderlineOffset: 4, color: '#888' }}
                >
                    Temp: <span style={{ color: 'var(--accent-blue)', fontWeight: 'bold' }}>{character.stats.hp.temp}</span>
                </span>
            </p>

            <div className="modal-form-group" style={{ textAlign: 'center' }}>
                <label>Hit Points</label>
                <div className="qty-control-box">
                    <button className="qty-btn" onClick={() => updateCharacter(c => c.stats.hp.current = Math.max(0, c.stats.hp.current - (parseInt(editVal) || 0)))}>-</button>
                    <input type="number" className="modal-input" style={{ width: 100, textAlign: 'center' }} value={editVal} onChange={e => setEditVal(e.target.value)} placeholder="0" />
                    <button className="qty-btn" onClick={() => updateCharacter(c => c.stats.hp.current = Math.max(0, c.stats.hp.current + (parseInt(editVal) || 0)))}>+</button>
                </div>
                <div style={{ marginTop: 10 }}>
                    <button className="set-btn" onClick={() => { updateCharacter(c => c.stats.hp.current = parseInt(editVal) || 0); setEditVal(""); }}>Set HP</button>
                </div>
            </div>

            {showTempHp && (
                <div className="modal-form-group" style={{ textAlign: 'center', marginTop: 20, borderTop: '1px solid #444', paddingTop: 20 }}>
                    <label style={{ color: 'var(--accent-blue)' }}>Temp HP</label>
                    <div className="qty-control-box">
                        <button className="qty-btn" onClick={() => updateCharacter(c => c.stats.hp.temp = Math.max(0, c.stats.hp.temp - (parseInt(editVal) || 0)))}>-</button>
                        <input type="number" className="modal-input" style={{ width: 100, textAlign: 'center' }} value={editVal} onChange={e => setEditVal(e.target.value)} placeholder="0" />
                        <button className="qty-btn" onClick={() => updateCharacter(c => c.stats.hp.temp = c.stats.hp.temp + (parseInt(editVal) || 0))}>+</button>
                    </div>
                    <button className="set-btn" onClick={() => { updateCharacter(c => c.stats.hp.temp = parseInt(editVal) || 0); setEditVal(""); }}>Set Temp to Value</button>
                </div>
            )}
        </>
    );
}
