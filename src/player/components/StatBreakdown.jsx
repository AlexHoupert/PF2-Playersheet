
import React from 'react';

/**
 * Reusable component for displaying a breakdown of stats (e.g. Attack Bonus, AC, Checks).
 * Styles match the "Spell Attack Breakdown" - dark box, flex rows, gold total.
 * 
 * @param {Object} props
 * @param {Array<{label: string, val: string|number}>} props.rows - Array of breakdown items.
 * @param {string|number} props.total - The final total value.
 * @param {string} [props.totalLabel="Total"] - Label for the bottom row.
 * @param {string} [props.title] - Optional title for the breakdown box (not the main modal title).
 */
export const StatBreakdown = ({ rows, total, totalLabel = "Total", title }) => {
    return (
        <div style={{ background: '#222', padding: 15, borderRadius: 8, fontSize: '0.9em' }}>
            {title && (
                <div style={{
                    marginBottom: 10, color: '#aaa', textTransform: 'uppercase',
                    fontSize: '0.8em', letterSpacing: 1, borderBottom: '1px solid #333', paddingBottom: 5
                }}>
                    {title}
                </div>
            )}

            {rows.map((r, i) => {
                if (!r || r.val === undefined || r.val === null) return null;
                return (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                        <span style={{ color: '#aaa' }}>{r.label}</span>
                        <span style={{ color: '#fff' }}>{r.val >= 0 && typeof r.val === 'number' ? `+${r.val}` : r.val}</span>
                    </div>
                );
            })}

            <div style={{
                borderTop: '1px solid #444', marginTop: 5, paddingTop: 5,
                display: 'flex', justifyContent: 'space-between', fontWeight: 'bold'
            }}>
                <span>{totalLabel}</span>
                <span style={{ color: 'var(--text-gold)' }}>
                    {total >= 0 && typeof total === 'number' ? `+${total}` : total}
                </span>
            </div>
        </div>
    );
};
