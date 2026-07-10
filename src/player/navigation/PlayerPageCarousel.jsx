import React from 'react';
import { Carousel, CarouselContent, CarouselItem } from '../../components/ui/carousel';
import {
    getCategoryIdForPlayerPage,
    getVisiblePlayerCategory,
} from './playerPageRegistry';
import PlayerPageRenderer from './PlayerPageRenderer';

export default function PlayerPageCarousel({
    activePageId,
    navigationContext,
    onSelectPageId,
    rendererProps,
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
                onSelectPageId?.(selectedPage.id);
            }
        };
        api.on('select', handleSelect);
        api.on('reInit', handleSelect);
        return () => {
            api.off('select', handleSelect);
            api.off('reInit', handleSelect);
        };
    }, [activePageId, api, onSelectPageId, pages]);

    if (!pages.length) {
        return (
            <PlayerPageRenderer
                {...rendererProps}
                activePageId={activePageId}
            />
        );
    }

    return (
        <Carousel
            key={categoryId}
            className="player-page-carousel"
            opts={{
                align: 'start',
                containScroll: false,
                dragFree: false,
                loop: pages.length > 1,
                skipSnaps: false,
                watchDrag: false,
            }}
            setApi={setApi}
        >
            <CarouselContent className="player-page-carousel__content">
                {pages.map((page, index) => {
                    const shouldRender = shouldRenderPage(index, activeIndex, pages.length);
                    return (
                        <CarouselItem key={page.id} className="player-page-carousel__item">
                            {shouldRender ? (
                                <PlayerPageRenderer
                                    {...rendererProps}
                                    activePageId={page.id}
                                />
                            ) : (
                                <div className="player-page-carousel__placeholder" aria-hidden="true" />
                            )}
                        </CarouselItem>
                    );
                })}
            </CarouselContent>
        </Carousel>
    );
}

function shouldRenderPage(index, activeIndex, length) {
    if (index === activeIndex) return true;
    if (length <= 3) return true;
    const forward = ((index - activeIndex) % length + length) % length;
    const backward = ((activeIndex - index) % length + length) % length;
    return Math.min(forward, backward) <= 1;
}
