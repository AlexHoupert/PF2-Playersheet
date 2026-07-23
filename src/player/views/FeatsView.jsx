import React from 'react';
import { getFeatIndexItemByName } from '../../shared/catalog/featIndex';
import { LongPressable } from '../../shared/components/LongPressable';

export const FeatsView = ({
    character,
    setModalData,
    setModalMode,
    setCatalogMode,
    onLongPress,
    readOnly = false,
    canAuthorCatalog = false,
    onAuthorCatalogEntry,
}) => {



    const featsByType = {};

    (character.feats || []).forEach(featRecord => {
        const featName = typeof featRecord === 'string' ? featRecord : featRecord?.name;
        const featFromIndex = getFeatIndexItemByName(featName);
        if (featFromIndex || featRecord?.name) {
            const feat = { ...(featFromIndex || {}), ...(typeof featRecord === 'object' ? featRecord : {}), name: featName, _entityType: 'feat' };
            let rawType = feat.category || feat.type || 'General';
            // Capitalize first letter, lowercase rest for consistent keys
            let type = rawType.charAt(0).toUpperCase() + rawType.slice(1).toLowerCase();

            if (!featsByType[type]) featsByType[type] = [];
            featsByType[type].push(feat);
        }
    });

    // Forced Order: Ancestry, Class, General, Skill, Bonus, everything else
    const order = ['Ancestry', 'Class', 'General', 'Skill', 'Bonus'];
    const sortedKeys = Object.keys(featsByType).sort((a, b) => {
        const ia = order.indexOf(a);
        const ib = order.indexOf(b);
        if (ia !== -1 && ib !== -1) return ia - ib;
        if (ia !== -1) return -1;
        if (ib !== -1) return 1;
        return a.localeCompare(b);
    });

    return (
        <div>
            {sortedKeys.map(type => (
                <div key={type} style={{ marginBottom: 20 }}>
                    <h3 style={{ borderBottom: '1px solid #5c4033', paddingBottom: 5 }}>{type}</h3>
                    {featsByType[type].map((feat, i) => (
                        <LongPressable
                            className="item-row"
                            key={feat.catalogEntryId || feat.catalogOverrideId || feat.name}
                            onLongPress={() => { if (!readOnly) onLongPress(feat, 'feat'); }}
                            onClick={() => { setModalData({ ...feat, _entityType: 'feat' }); setModalMode('catalog_detail'); }}
                        >
                            <span className="item-name">{feat.name}</span>
                        </LongPressable>
                    ))}
                </div>
            ))}
            {!readOnly && <button
                className="btn-add-condition"
                style={{ marginTop: 20, width: '100%' }}
                onClick={() => setCatalogMode('feat')}
            >
                + Add Feat
            </button>}
            {canAuthorCatalog && (
                <button
                    className="btn-add-condition"
                    style={{ marginTop: 10, width: '100%' }}
                    onClick={() => onAuthorCatalogEntry?.('feat')}
                >
                    Create Feat
                </button>
            )}
        </div>
    );
};
