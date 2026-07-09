import React from 'react';
import { getPlayerSubpageCarouselItems } from './playerPageRegistry';
import { getPlayerNavIconSrc } from './playerNavIcons';

export default function PlayerSubpageCarousel({
    activePageId,
    hasLoot = false,
    onSelectPage,
}) {
    const items = getPlayerSubpageCarouselItems(activePageId);

    if (!items.length) return null;

    return (
        <div className="player-subpage-carousel-wrap" data-testid="player-subpage-carousel">
            <div className="player-subpage-carousel" aria-label="Current section pages">
                {items.map(({ page, offset, state }) => {
                    const active = offset === 0;
                    const hasPageLoot = page.alertKey === 'loot' && hasLoot;
                    return (
                        <button
                            key={page.id}
                            type="button"
                            className={`player-subpage-carousel__tab ${state} ${page.future ? 'future' : ''}`}
                            data-offset={offset}
                            style={{ gridColumn: String(offset + 3) }}
                            onClick={() => onSelectPage(page)}
                            aria-current={active ? 'page' : undefined}
                            data-testid={`player-carousel-page-${page.id}`}
                        >
                            <span className="player-subpage-carousel__icon-wrap">
                                <img
                                    src={getPlayerNavIconSrc(page.icon)}
                                    alt=""
                                    className="player-subpage-carousel__icon"
                                />
                            </span>
                            <span className="player-subpage-carousel__label">{page.label}</span>
                            {hasPageLoot && <span className="player-nav-alert-dot" aria-label="New loot" />}
                            {page.future && <span className="player-subpage-carousel__note">Soon</span>}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
