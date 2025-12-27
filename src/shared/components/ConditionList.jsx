import React from 'react';
import { getConditionImgSrc } from '../constants/conditionsCatalog';
import { getConditionIcon, NEG_CONDS, POS_CONDS } from '../constants/conditions';

export function ConditionList({ conditions, onClick, onAdd }) {
    // Filter active conditions
    const active = conditions.filter(c => c.level > 0);

    return (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 10, justifyContent: 'center' }}>
            {active.map(c => {
                const img = getConditionImgSrc(c.name);
                const isNeg = NEG_CONDS.includes(c.name.toLowerCase());
                const isPos = POS_CONDS.includes(c.name.toLowerCase());
                let bg = '#222';
                if (isNeg) bg = '#5c1a1a';
                if (isPos) bg = '#1a5c1a';

                return (
                    <div key={c.name} style={{
                        background: bg, padding: '4px 8px', borderRadius: 15,
                        display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.9em',
                        border: '1px solid #555', cursor: 'pointer',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.5)'
                    }} onClick={onAdd}> {/* Clicking badge opens Manager (onAdd) */}
                        {img ? <img src={img} alt="" style={{ width: 20, height: 20, objectFit: 'contain' }} /> : <span>{getConditionIcon(c.name)}</span>}
                        <span style={{ color: '#e0e0e0', fontWeight: 'bold' }}>{c.name} {c.level > 1 ? c.level : ''}</span>
                    </div>
                );
            })}

            {active.length === 0 && (
                <button
                    className="btn-add-condition"
                    onClick={onAdd}
                    style={{
                        fontSize: '0.75em', padding: '4px 10px',
                        background: 'transparent', border: '1px dashed #666', color: '#aaa',
                        cursor: 'pointer', borderRadius: 15
                    }}
                >
                    + ADD CONDITION
                </button>
            )}
        </div>
    );
}
