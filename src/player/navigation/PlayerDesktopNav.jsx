import React, { useMemo } from 'react';
import {
    getCategoryIdForPlayerPage,
    PLAYER_NAV_CATEGORIES,
} from './playerPageRegistry';

export default function PlayerDesktopNav({
    activePageId,
    onSelectPage,
    hasLoot = false,
}) {
    const activeCategoryId = getCategoryIdForPlayerPage(activePageId);
    const activeCategory = useMemo(() => {
        return PLAYER_NAV_CATEGORIES.find(category => category.id === activeCategoryId) || PLAYER_NAV_CATEGORIES[0];
    }, [activeCategoryId]);

    return (
        <nav className="player-desktop-nav no-swipe" aria-label="Player page navigation">
            <div className="player-desktop-nav__categories">
                {PLAYER_NAV_CATEGORIES.map(category => (
                    <button
                        key={category.id}
                        type="button"
                        className={`player-desktop-nav__category ${category.id === activeCategoryId ? 'active' : ''}`}
                        onClick={() => onSelectPage(category.pages[0])}
                    >
                        {category.label}
                        {category.id === 'items' && hasLoot && <span className="player-nav-alert-dot" aria-label="New loot" />}
                    </button>
                ))}
            </div>
            <div className="player-desktop-nav__pages">
                {activeCategory.pages.map(page => {
                    const active = page.id === activePageId;
                    const hasPageLoot = page.alertKey === 'loot' && hasLoot;
                    return (
                        <button
                            key={page.id}
                            type="button"
                            className={`player-desktop-nav__page ${active ? 'active' : ''} ${page.future ? 'future' : ''}`}
                            onClick={() => onSelectPage(page)}
                            data-testid={`player-desktop-page-${page.id}`}
                        >
                            <span>{page.label}</span>
                            {hasPageLoot && <span className="player-nav-alert-dot" aria-label="New loot" />}
                            {page.future && <span className="player-desktop-nav__page-note">Soon</span>}
                        </button>
                    );
                })}
            </div>
        </nav>
    );
}
