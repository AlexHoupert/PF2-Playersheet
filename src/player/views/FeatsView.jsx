import React from 'react';
import { getFeatIndexItemByName } from '../../shared/catalog/featIndex';

export function FeatsView({ character, onOpenModal, onOpenCatalog, pressEvents }) {
    const featsByType = {};

    character.feats.forEach(featName => {
        const featFromIndex = getFeatIndexItemByName(featName);
        if (featFromIndex) {
            const feat = { ...featFromIndex, _entityType: 'feat' };
            let rawType = feat.category || feat.type || 'General';
            // Capitalize first letter, lowercase rest for consistent keys
            let type = rawType.charAt(0).toUpperCase() + rawType.slice(1).toLowerCase();

            if (!featsByType[type]) featsByType[type] = [];
            featsByType[type].push(feat);
        }
    });

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
                        <div className="item-row" key={feat.name}
                            onClick={() => onOpenModal('item', feat)}
                            {...pressEvents?.(feat, 'feat')}
                        >
                            <span className="item-name">{feat.name}</span>
                        </div>
                    ))}
                </div>
            ))}
            <button
                className="btn-add-condition"
                style={{ marginTop: 20, width: '100%' }}
                onClick={onOpenCatalog}
            >
                + Add Feat
            </button>
        </div>
    );
}
