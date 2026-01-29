import React, { useState } from 'react';
import './Sidebar.css';

// Navigation Data Configuration
const NAV_GROUPS = [
    {
        label: 'Management',
        items: [
            { id: 'sessions', label: 'Sessions', icon: '📅' },
            { id: 'system', label: 'System', icon: '⚙️' },
            { id: 'players', label: 'Players', icon: '👥' }
        ]
    },
    {
        label: 'Resources',
        items: [
            { id: 'items', label: 'Items', icon: '🎒' },
            {
                id: 'magic', label: 'Magic', icon: '✨', children: [
                    { id: 'spells', label: 'Spells', icon: '📜' },
                    { id: 'impulses', label: 'Impulses', icon: '🌩️' }
                ]
            },
            {
                id: 'bestiary', label: 'Bestiary', icon: '🐉', children: [
                    { id: 'bestiary_creatures', label: 'Creatures', icon: '👾' },
                    { id: 'bestiary_hazards', label: 'Hazards', icon: '⚠️' },
                    { id: 'bestiary_overview', label: 'All', icon: '📚' } // Added overview for full list
                ]
            },
            { id: 'actions', label: 'Actions', icon: '⚔️' },
            { id: 'feats', label: 'Feats', icon: '🏆' }
        ]
    },
    {
        label: 'Story',
        items: [
            { id: 'lore', label: 'Lore', icon: '📖' },
            { id: 'quests', label: 'Quests', icon: '🗺️' }
        ]
    }
];

export default function Sidebar({ activeTab, onSelect }) {
    const [collapsed, setCollapsed] = useState(false);
    const [openSubmenus, setOpenSubmenus] = useState({
        magic: true,
        bestiary: true,
    });

    const toggleSubmenu = (id) => {
        setOpenSubmenus(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const isGroupActive = (item) => {
        if (item.id === activeTab) return true;
        if (item.children) {
            return item.children.some(child => child.id === activeTab);
        }
        return false;
    };

    const handleItemClick = (item) => {
        if (item.children) {
            if (collapsed) {
                setCollapsed(false);
                setOpenSubmenus(prev => ({ ...prev, [item.id]: true }));
            } else {
                toggleSubmenu(item.id);
            }
        } else {
            onSelect(item.id);
        }
    };

    return (
        <div className={`sidebar-container ${collapsed ? 'collapsed' : 'expanded'}`}>
            <div className="sidebar-header">
                <button className="sidebar-toggle-btn" onClick={() => setCollapsed(!collapsed)}>
                    {collapsed ? '☰' : '⬅'}
                </button>
                <div className="sidebar-title">GM Screen</div>
            </div>

            <div className="sidebar-content">
                {NAV_GROUPS.map((group, groupIdx) => (
                    <div key={groupIdx} className="sidebar-group">
                        <div className="sidebar-group-label">{group.label}</div>
                        <ul className="sidebar-menu">
                            {group.items.map(item => {
                                const isActive = activeTab === item.id;
                                const isChildActive = item.children && item.children.some(c => c.id === activeTab);
                                const isOpen = openSubmenus[item.id];

                                return (
                                    <li key={item.id} className="sidebar-item">
                                        <button
                                            className={`sidebar-btn ${isActive || isChildActive ? 'active' : ''} ${isOpen ? 'open' : ''}`}
                                            onClick={() => handleItemClick(item)}
                                            title={item.label}
                                        >
                                            <span className="sidebar-icon">{item.icon}</span>
                                            <span className="sidebar-label">{item.label}</span>
                                            {item.children && <span className="sidebar-chevron">▶</span>}
                                        </button>

                                        {/* Submenu */}
                                        {item.children && isOpen && (
                                            <ul className="sidebar-submenu">
                                                {item.children.map(child => (
                                                    <li key={child.id} className="sidebar-submenu-item">
                                                        <button
                                                            className={`sidebar-btn ${activeTab === child.id ? 'active' : ''}`}
                                                            onClick={() => onSelect(child.id)}
                                                            title={child.label}
                                                        >
                                                            <span className="sidebar-icon">{child.icon}</span>
                                                            <span className="sidebar-label">{child.label}</span>
                                                        </button>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                ))}
            </div>

            <div className="sidebar-footer">
                <div className="user-info">
                    <div className="footer-avatar">GM</div>
                    <div className="footer-text" style={{ display: collapsed ? 'none' : 'flex' }}>
                        <span className="footer-name">Game Master</span>
                        <span className="footer-role">Admin</span>
                    </div>
                </div>
                {!collapsed && (
                    <div style={{ marginTop: 10 }}>
                        <button className="nav-btn" onClick={() => window.location.search = ''} style={{ width: '100%', textAlign: 'center' }}>
                            Exit to Player View
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
