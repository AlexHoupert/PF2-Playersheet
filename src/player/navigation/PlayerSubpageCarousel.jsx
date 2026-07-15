import React from 'react';
import { Carousel, CarouselContent, CarouselItem } from '../../components/ui/carousel';
import {
    getCategoryIdForPlayerPage,
    getVisiblePlayerCategory,
} from './playerPageRegistry';
import { getPlayerNavIconSrc } from './playerNavIcons';

export default function PlayerSubpageCarousel({
    activePageId,
    navigationContext,
    alertsByPage = {},
    onSelectPage,
}) {
    const [api, setApi] = React.useState(null);
    const categoryId = getCategoryIdForPlayerPage(activePageId);
    const pages = getVisiblePlayerCategory(categoryId, navigationContext)?.pages || [];
    const activeIndex = Math.max(0, pages.findIndex((page) => page.id === activePageId));

    React.useEffect(() => {
        if (!api || activeIndex < 0) return;
        if (api.selectedScrollSnap() !== activeIndex) {
            api.scrollTo(activeIndex);
        }
    }, [activeIndex, api]);

    React.useEffect(() => {
        if (!api) return undefined;
        const handleSelect = () => {
            const selectedPage = pages[api.selectedScrollSnap()];
            if (selectedPage && selectedPage.id !== activePageId) {
                onSelectPage(selectedPage);
            }
        };
        api.on('select', handleSelect);
        api.on('reInit', handleSelect);
        return () => {
            api.off('select', handleSelect);
            api.off('reInit', handleSelect);
        };
    }, [activePageId, api, onSelectPage, pages]);

    if (!pages.length) return null;

    return (
        <div className="player-subpage-carousel-wrap" data-testid="player-subpage-carousel">
            <Carousel
                className="player-subpage-carousel"
                opts={{
                    align: 'center',
                    containScroll: false,
                    dragFree: false,
                    loop: pages.length > 1,
                    skipSnaps: false,
                }}
                setApi={setApi}
                aria-label="Current section pages"
            >
                <CarouselContent className="player-subpage-carousel__content">
                    {pages.map((page, index) => {
                        const active = page.id === activePageId;
                        const pageAlertCount = Math.max(0, Number(alertsByPage?.[page.id] || 0));
                        const state = getCarouselState(index, activeIndex, pages.length);
                        return (
                            <CarouselItem key={page.id} className="player-subpage-carousel__item">
                                <button
                                    type="button"
                                    className={`player-subpage-carousel__tab ${state} ${page.future ? 'future' : ''}`}
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
                                    {pageAlertCount > 0 && <span className="player-nav-alert-dot" aria-label={`${pageAlertCount} unread updates`} />}
                                    {page.future && <span className="player-subpage-carousel__note">Soon</span>}
                                </button>
                            </CarouselItem>
                        );
                    })}
                </CarouselContent>
            </Carousel>
        </div>
    );
}

function getCarouselState(index, activeIndex, length) {
    if (index === activeIndex) return 'active';
    const forward = ((index - activeIndex) % length + length) % length;
    const backward = ((activeIndex - index) % length + length) % length;
    const distance = Math.min(forward, backward);
    if (distance === 1) return 'neighbor';
    return 'edge';
}
