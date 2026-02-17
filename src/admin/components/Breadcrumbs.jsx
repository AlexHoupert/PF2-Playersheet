import React from 'react';

const BREADCRUMB_MAP = {
    'sessions': ['Management', 'Sessions'],
    'players': ['Management', 'Players'],
    'system': ['Management', 'System'],
    'items': ['Resources', 'Items'],
    'magic': ['Resources', 'Magic'],
    'spells': ['Resources', 'Magic', 'Spells'],
    'impulses': ['Resources', 'Magic', 'Impulses'],
    'bestiary': ['Resources', 'Bestiary'],
    'bestiary_overview': ['Resources', 'Bestiary', 'Overview'],
    'bestiary_creatures': ['Resources', 'Bestiary', 'Creatures'],
    'bestiary_hazards': ['Resources', 'Bestiary', 'Hazards'],
    'encounters': ['Resources', 'Bestiary', 'Encounters'],
    'actions': ['Resources', 'Actions'],
    'feats': ['Resources', 'Feats'],
    'lore': ['Story', 'Lore'],
    'quests': ['Story', 'Quests']
};

export default function Breadcrumbs({ activeTab }) {
    const path = BREADCRUMB_MAP[activeTab] || [activeTab];

    return (
        <div className="admin-breadcrumbs" style={{
            padding: '10px 20px',
            color: '#888',
            fontSize: '0.9rem',
            borderBottom: '1px solid #333',
            background: '#111',
            display: 'flex',
            alignItems: 'center',
            gap: 5
        }}>
            {path.map((part, index) => (
                <React.Fragment key={index}>
                    <span style={{
                        color: index === path.length - 1 ? '#c5a059' : 'inherit',
                        fontWeight: index === path.length - 1 ? 'bold' : 'normal'
                    }}>
                        {part}
                    </span>
                    {index < path.length - 1 && <span style={{ opacity: 0.5 }}>/</span>}
                </React.Fragment>
            ))}
        </div>
    );
}
