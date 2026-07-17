import React, { useState } from 'react';
import BottomSheet from '../../shared/components/BottomSheet';
import { useWindowSize } from '../../shared/hooks/useWindowSize';
import { useCampaign } from '../../shared/context/CampaignContext';
import { canAccessAdminTab } from '../../shared/auth/campaignCapabilities';
import './Sidebar.css';

// Navigation Data Configuration
const NAV_GROUPS = [
    {
        label: 'Management',
        items: [
            { id: 'campaign_changes', label: 'Campaign Changes', icon: 'Changes' },
            { id: 'sessions', label: 'Sessions', icon: '📅' },
            { id: 'system',   label: 'System',   icon: '⚙️' },
            { id: 'players',  label: 'Players',  icon: '👥' }
        ]
    },
    {
        label: 'Resources',
        items: [
            { id: 'items', label: 'Items', icon: '🎒' },
            {
                id: 'magic', label: 'Magic', icon: '✨', children: [
                    { id: 'spells',            label: 'Spells',           icon: '📜' },
                    { id: 'impulses',          label: 'Impulses',         icon: '🌩️' },
                    { id: 'deviant_abilities', label: 'Deviant Abilities', icon: '🔮' }
                ]
            },
            { id: 'pacts', label: 'Pacts', icon: '🌀' },
            {
                id: 'bestiary', label: 'Bestiary', icon: '🐉', children: [
                    { id: 'bestiary_creatures', label: 'Creatures', icon: '👾' },
                    { id: 'bestiary_hazards',   label: 'Hazards',   icon: '⚠️' },
                    { id: 'bestiary_overview',  label: 'All',       icon: '📚' },
                    { id: 'encounters',         label: 'Encounters',icon: '⚔️' }
                ]
            },
            { id: 'actions',   label: 'Actions',   icon: '⚔️' },
            { id: 'feats',     label: 'Feats',     icon: '🏆' },
            { id: 'abilities', label: 'Abilities', icon: '⚡' }
        ]
    },
    {
        label: 'Story',
        items: [
            { id: 'lore',     label: 'Lore',     icon: '📖' },
            { id: 'quests',   label: 'Quests',   icon: '📜' },
            { id: 'maps',     label: 'Maps',     icon: '🗺️' },
            { id: 'progress', label: 'Progress', icon: '📊' },
            { id: 'camping',  label: 'Camping',  icon: '🏕️' }
        ]
    }
];

// Flat list of all items (including children) for lookup
const ALL_ITEMS = NAV_GROUPS.flatMap(g => g.items.flatMap(i => i.children ? [i, ...i.children] : [i]));

function findParent(id) {
    for (const g of NAV_GROUPS)
        for (const item of g.items)
            if (item.children?.some(c => c.id === id)) return item;
    return null;
}

// ── Bottom nav top-level items (one per group + one for Story) ───────────────
// We pick representative items to not crowd the bottom bar (max 5).
const BOTTOM_NAV_ITEMS = [
    { id: 'sessions', label: 'Manage',    icon: '📅', group: 'Management' },
    { id: 'items',    label: 'Items',     icon: '🎒', group: 'Resources'  },
    { id: 'bestiary', label: 'Bestiary',  icon: '🐉', group: 'Resources', hasChildren: true },
    { id: 'magic',    label: 'Magic',     icon: '✨', group: 'Resources', hasChildren: true },
    { id: 'lore',     label: 'Story',     icon: '📖', group: 'Story'      },
];

// ── Desktop Sidebar ──────────────────────────────────────────────────────────
function DesktopSidebar({ activeTab, onSelect, navGroups }) {
    const [collapsed, setCollapsed] = useState(false);
    const [openSubmenus, setOpenSubmenus] = useState({ magic: true, bestiary: true });

    const toggleSubmenu = (id) =>
        setOpenSubmenus(prev => ({ ...prev, [id]: !prev[id] }));

    const handleItemClick = (item) => {
        if (item.children) {
            if (collapsed) { setCollapsed(false); setOpenSubmenus(prev => ({ ...prev, [item.id]: true })); }
            else toggleSubmenu(item.id);
        } else {
            onSelect(item.id);
        }
    };

    return (
        <div className={`sidebar-container admin-sidebar-desktop ${collapsed ? 'collapsed' : 'expanded'}`}>
            <div className="sidebar-header">
                <button className="sidebar-toggle-btn" onClick={() => setCollapsed(!collapsed)}>
                    {collapsed ? '☰' : '⬅'}
                </button>
                <div className="sidebar-title">GM Screen</div>
            </div>

            <div className="sidebar-content">
                {navGroups.map((group, idx) => (
                    <div key={idx} className="sidebar-group">
                        <div className="sidebar-group-label">{group.label}</div>
                        <ul className="sidebar-menu">
                            {group.items.map(item => {
                                const isActive = activeTab === item.id;
                                const isChildActive = item.children?.some(c => c.id === activeTab);
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

// ── Mobile Bottom Nav ────────────────────────────────────────────────────────
function MobileBottomNav({ activeTab, onSelect, navGroups }) {
    const [sheetItem, setSheetItem] = useState(null); // nav item whose children to show

    const isTabActive = (navItem) => {
        if (navItem.id === activeTab) return true;
        // check if active tab is a child of this nav item's group
        const srcItem = navGroups.flatMap(g => g.items).find(i => i.id === navItem.id);
        return srcItem?.children?.some(c => c.id === activeTab) || false;
    };

    const handleNavTap = (navItem) => {
        const srcItem = navGroups.flatMap(g => g.items).find(i => i.id === navItem.id);
        if (srcItem?.children) {
            setSheetItem(srcItem);
        } else {
            onSelect(navItem.id);
        }
    };

    // Determine which bottom nav items to show — all groups as tabs + a "more" fallback
    const allowedIds = new Set(navGroups.flatMap(group => group.items).map(item => item.id));
    const bottomNavItems = BOTTOM_NAV_ITEMS.filter(item => allowedIds.has(item.id));
    const moreItems = navGroups.flatMap(g => g.items).filter(
        i => !bottomNavItems.some(b => b.id === i.id)
    );

    const selectAndClose = (id) => { onSelect(id); setSheetItem(null); };

    return (
        <>
            <nav className="bottom-nav">
                {bottomNavItems.map(navItem => (
                    <button
                        key={navItem.id}
                        className={`bottom-nav-item ${isTabActive(navItem) ? 'active' : ''} ${navItem.hasChildren ? 'has-children' : ''}`}
                        onClick={() => handleNavTap(navItem)}
                    >
                        <span className="bnav-icon">{navItem.icon}</span>
                        <span className="bnav-label">{navItem.label}</span>
                    </button>
                ))}
                {/* "More" tab for remaining items */}
                {moreItems.length > 0 && (
                    <button
                        className={`bottom-nav-item ${moreItems.some(i => i.id === activeTab || i.children?.some(c => c.id === activeTab)) ? 'active' : ''}`}
                        onClick={() => setSheetItem({ id: '__more__', label: 'More', children: moreItems })}
                    >
                        <span className="bnav-icon">☰</span>
                        <span className="bnav-label">More</span>
                    </button>
                )}
            </nav>

            {/* Child-item sheet */}
            <BottomSheet
                isOpen={!!sheetItem}
                onClose={() => setSheetItem(null)}
                title={sheetItem?.label}
                height="50vh"
            >
                <div style={{ padding: '8px 0' }}>
                    {sheetItem?.children?.map(child => (
                        <button
                            key={child.id}
                            onClick={() => selectAndClose(child.id)}
                            style={{
                                width: '100%', display: 'flex', alignItems: 'center', gap: 14,
                                padding: '13px 20px', background: activeTab === child.id ? 'rgba(201,168,108,0.12)' : 'transparent',
                                border: 'none', color: activeTab === child.id ? '#c9a86c' : '#ddd',
                                fontSize: '1em', cursor: 'pointer', textAlign: 'left',
                                borderBottom: '1px solid #222',
                            }}
                        >
                            <span style={{ fontSize: '1.3em' }}>{child.icon}</span>
                            {child.label}
                        </button>
                    ))}
                    <button
                        onClick={() => { window.location.search = ''; }}
                        style={{ width: '100%', padding: '13px 20px', background: 'none', border: 'none', color: '#888', fontSize: '0.9em', cursor: 'pointer', textAlign: 'left' }}
                    >
                        ← Exit to Player View
                    </button>
                </div>
            </BottomSheet>
        </>
    );
}

// ── Public export: picks desktop or mobile automatically ─────────────────────
export default function Sidebar({ activeTab, onSelect }) {
    const { isMobile } = useWindowSize();
    const { capabilities } = useCampaign();
    const navGroups = filterNavigation(capabilities);
    return isMobile
        ? <MobileBottomNav activeTab={activeTab} onSelect={onSelect} navGroups={navGroups} />
        : <DesktopSidebar activeTab={activeTab} onSelect={onSelect} navGroups={navGroups} />;
}

function filterNavigation(capabilities) {
    if (capabilities?.canAccessFullAdmin) return NAV_GROUPS;
    return NAV_GROUPS.map(group => ({
        ...group,
        items: group.items.map(item => {
            if (!item.children) return canAccessAdminTab(capabilities, item.id) ? item : null;
            const children = item.children.filter(child => canAccessAdminTab(capabilities, child.id));
            return children.length ? { ...item, children } : null;
        }).filter(Boolean),
    })).filter(group => group.items.length);
}
