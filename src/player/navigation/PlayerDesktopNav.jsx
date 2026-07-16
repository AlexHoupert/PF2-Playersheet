import {
    getCategoryIdForPlayerPage,
    getVisiblePlayerNavCategories,
} from './playerPageRegistry';
import PlayerSubpageCarousel from './PlayerSubpageCarousel';

export default function PlayerDesktopNav({
    activePageId,
    navigationContext,
    onSelectPage,
    alertsByPage = {},
    metadataByPage = {},
}) {
    const activeCategoryId = getCategoryIdForPlayerPage(activePageId);
    const visibleCategories = getVisiblePlayerNavCategories(navigationContext);
    return (
        <nav className="player-desktop-nav no-swipe" aria-label="Player page navigation">
            <div className="player-desktop-nav__categories">
                {visibleCategories.map(category => {
                    const count = category.pages.reduce((total, page) => total + Math.max(0, Number(alertsByPage?.[page.id] || 0)), 0);
                    return (
                    <button
                        key={category.id}
                        type="button"
                        className={`player-desktop-nav__category ${category.id === activeCategoryId ? 'active' : ''}`}
                        onClick={() => onSelectPage(category.pages[0])}
                    >
                        {category.label}
                        {count > 0 && <span className="player-nav-alert-dot" aria-label={`${count} unread updates`} />}
                    </button>
                    );
                })}
            </div>
            <PlayerSubpageCarousel
                activePageId={activePageId}
                navigationContext={navigationContext}
                alertsByPage={alertsByPage}
                metadataByPage={metadataByPage}
                onSelectPage={onSelectPage}
            />
        </nav>
    );
}
