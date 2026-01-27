import React, { useState, useMemo } from 'react';
import QuestCodexItem from './QuestCodexItem';

export default function QuestCodex({ quests = [], onToggleObjective }) {
    const [filter, setFilter] = useState('active'); // 'all', 'active', 'completed'
    const [search, setSearch] = useState('');

    // Filter Logic
    const filteredQuests = useMemo(() => {
        let q = quests.filter(q => !q.parentId); // Only top level

        // Status Filter
        if (filter === 'active') q = q.filter(x => x.status === 'Active');
        if (filter === 'completed') q = q.filter(x => x.status === 'Completed' || x.status === 'Failed');

        // Search Filter
        if (search) {
            const term = search.toLowerCase();
            q = q.filter(x => x.title.toLowerCase().includes(term) || (x.descriptionPublic?.toLowerCase().includes(term)));
        }

        return q;
    }, [quests, filter, search]);

    // Grouping
    const mainQuests = filteredQuests.filter(q => q.type === 'Main');
    const sideQuests = filteredQuests.filter(q => q.type !== 'Main');

    return (
        <div className="quest-list-container">
            {/* Tabs */}
            <div className="sub-tabs">
                <button className={`sub-tab-btn ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>All</button>
                <button className={`sub-tab-btn ${filter === 'active' ? 'active' : ''}`} onClick={() => setFilter('active')}>Active</button>
                <button className={`sub-tab-btn ${filter === 'completed' ? 'active' : ''}`} onClick={() => setFilter('completed')}>Completed</button>
            </div>

            {/* Search */}
            <div style={{ marginBottom: 15, display: 'flex', alignItems: 'center' }}>
                <span style={{ fontSize: '1.2em', marginRight: 10 }}>🔍</span>
                <input
                    className="modal-input"
                    type="text"
                    placeholder="Search quests..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    style={{ flex: 1, padding: '6px 10px', fontSize: '0.9em' }}
                />
            </div>

            {/* Main Quests */}
            {mainQuests.length > 0 && (
                <>
                    <h3 className="quest-section-header">Main Thread</h3>
                    {mainQuests.map(q => (
                        <QuestCodexItem key={q.id} quest={q} onToggleObjective={onToggleObjective} />
                    ))}
                </>
            )}

            {/* Side Quests */}
            {sideQuests.length > 0 && (
                <>
                    <h3 className="quest-section-header">Side Tales</h3>
                    {sideQuests.map(q => (
                        <QuestCodexItem key={q.id} quest={q} onToggleObjective={onToggleObjective} />
                    ))}
                </>
            )}

            {filteredQuests.length === 0 && (
                <div style={{ textAlign: 'center', padding: 40, color: '#666' }}>
                    No quests found.
                </div>
            )}
        </div>
    );
}
