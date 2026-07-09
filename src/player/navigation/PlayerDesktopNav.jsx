import React from 'react';
import {
    getCategoryIdForPlayerPage,
    PLAYER_NAV_CATEGORIES,
} from './playerPageRegistry';
import PlayerSubpageCarousel from './PlayerSubpageCarousel';

export default function PlayerDesktopNav({
    activePageId,
    onSelectPage,
    hasLoot = false,
}) {
    const activeCategoryId = getCategoryIdForPlayerPage(activePageId);
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
            <PlayerSubpageCarousel
                activePageId={activePageId}
                hasLoot={hasLoot}
                onSelectPage={onSelectPage}
            />
        </nav>
    );
}
