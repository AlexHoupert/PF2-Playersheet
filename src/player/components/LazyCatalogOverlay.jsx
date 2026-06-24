import React, { useEffect, useState } from 'react';
import ItemCatalog from '../ItemCatalog';
import { mergeCatalogIndexWithOverrides } from '../../shared/db/selectors/catalogOverrideSelectors';

const LOADERS = {
    feat: async () => {
        const mod = await import('../../shared/catalog/featIndex');
        return {
            title: 'Add Feat',
            items: mod.FEAT_INDEX_ITEMS,
            filterOptions: mod.FEAT_INDEX_FILTER_OPTIONS,
        };
    },
    impulse: async () => {
        const mod = await import('../../shared/catalog/impulseIndex');
        return {
            title: 'Add Impulse',
            items: mod.IMPULSE_INDEX_ITEMS,
            filterOptions: mod.IMPULSE_INDEX_FILTER_OPTIONS,
        };
    },
    spell: async () => {
        const mod = await import('../../shared/catalog/spellIndex');
        return {
            title: 'Add Spell',
            items: mod.SPELL_INDEX_ITEMS,
            filterOptions: mod.SPELL_INDEX_FILTER_OPTIONS,
        };
    },
};

export default function LazyCatalogOverlay({ mode, db, onSelect, onClose }) {
    const [state, setState] = useState({ loading: true, error: null, config: null });

    useEffect(() => {
        let cancelled = false;
        const loader = LOADERS[mode];
        if (!loader) {
            setState({ loading: false, error: `Unknown catalog mode: ${mode}`, config: null });
            return undefined;
        }

        setState({ loading: true, error: null, config: null });
        loader()
            .then((config) => {
                if (!cancelled) setState({ loading: false, error: null, config });
            })
            .catch((err) => {
                if (!cancelled) setState({ loading: false, error: err?.message || String(err), config: null });
            });

        return () => {
            cancelled = true;
        };
    }, [mode]);

    if (state.loading) {
        return (
            <div style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.85)',
                zIndex: 1200,
                color: '#ddd',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
            }}>
                Loading catalog...
            </div>
        );
    }

    if (state.error || !state.config) {
        return (
            <div style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.85)',
                zIndex: 1200,
                color: '#ddd',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 20,
            }}>
                <div style={{ maxWidth: 420, textAlign: 'center' }}>
                    <h2>Catalog could not be loaded</h2>
                    <p style={{ color: '#aaa' }}>{state.error}</p>
                    <button className="set-btn" onClick={onClose}>Close</button>
                </div>
            </div>
        );
    }

    return (
        <ItemCatalog
            title={state.config.title}
            items={mergeCatalogIndexWithOverrides(state.config.items, db, mode)}
            filterOptions={state.config.filterOptions}
            onSelect={onSelect}
            onClose={onClose}
        />
    );
}
