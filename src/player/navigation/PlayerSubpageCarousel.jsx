import React from 'react';
import { Reorder, useDragControls, useReducedMotion } from 'framer-motion';
import { Carousel, CarouselContent, CarouselItem } from '../../components/ui/carousel';
import {
    getCategoryIdForPlayerPage,
    getVisiblePlayerCategory,
} from './playerPageRegistry';
import { getPlayerNavIconSrc } from './playerNavIcons';

const REORDER_HOLD_MS = 500;
const REORDER_MOVE_TOLERANCE = 9;

export default function PlayerSubpageCarousel({
    activePageId,
    navigationContext,
    alertsByPage = {},
    metadataByPage = {},
    loopPages = true,
    onSelectPage,
    onCommitPageOrder,
    onReorderStateChange,
    settingsError = null,
    settingsSaving = false,
}) {
    const [api, setApi] = React.useState(null);
    const categoryId = getCategoryIdForPlayerPage(activePageId);
    const pages = getVisiblePlayerCategory(categoryId, navigationContext)?.pages || [];
    const canonicalPageIds = pages.map((page) => page.id);
    const canonicalOrderKey = canonicalPageIds.join('|');
    const [orderedPageIds, setOrderedPageIds] = React.useState(canonicalPageIds);
    const [draggingPageId, setDraggingPageId] = React.useState(null);
    const [liveMessage, setLiveMessage] = React.useState('');
    const orderedPageIdsRef = React.useRef(canonicalPageIds);
    const initialOrderRef = React.useRef(canonicalPageIds);
    const reorderingRef = React.useRef(false);
    const pageById = React.useMemo(
        () => new Map(pages.map((page) => [page.id, page])),
        [canonicalOrderKey] // eslint-disable-line react-hooks/exhaustive-deps
    );
    const displayPages = orderedPageIds.map((pageId) => pageById.get(pageId)).filter(Boolean);
    const activeIndex = Math.max(0, displayPages.findIndex((page) => page.id === activePageId));
    const reorderEnabled = Boolean(onCommitPageOrder && displayPages.length > 1);

    orderedPageIdsRef.current = orderedPageIds;

    const reinitializeCarousel = React.useCallback(() => {
        if (!api) return;
        window.requestAnimationFrame(() => {
            api.reInit();
            const nextActiveIndex = orderedPageIdsRef.current.indexOf(activePageId);
            if (nextActiveIndex >= 0) api.scrollTo(nextActiveIndex, true);
        });
    }, [activePageId, api]);

    React.useEffect(() => {
        if (reorderingRef.current) return;
        orderedPageIdsRef.current = canonicalPageIds;
        setOrderedPageIds(canonicalPageIds);
    }, [canonicalOrderKey]); // eslint-disable-line react-hooks/exhaustive-deps

    React.useEffect(() => {
        if (!api || activeIndex < 0 || reorderingRef.current) return;
        if (api.selectedScrollSnap() !== activeIndex) api.scrollTo(activeIndex);
    }, [activeIndex, api]);

    React.useEffect(() => {
        if (!api) return undefined;
        const handleSelect = () => {
            if (reorderingRef.current) return;
            const selectedPage = displayPages[api.selectedScrollSnap()];
            if (selectedPage && selectedPage.id !== activePageId) onSelectPage(selectedPage);
        };
        api.on('select', handleSelect);
        api.on('reInit', handleSelect);
        return () => {
            api.off('select', handleSelect);
            api.off('reInit', handleSelect);
        };
    }, [activePageId, api, displayPages, onSelectPage]);

    React.useEffect(() => () => onReorderStateChange?.(false), [onReorderStateChange]);

    const startReorder = React.useCallback((pageId) => {
        initialOrderRef.current = [...orderedPageIdsRef.current];
        reorderingRef.current = true;
        setDraggingPageId(pageId);
        setLiveMessage(`Reordering ${pageById.get(pageId)?.label || 'page'}.`);
        onReorderStateChange?.(true);
    }, [onReorderStateChange, pageById]);

    const updateReorder = React.useCallback((nextOrder) => {
        const validIds = nextOrder.filter((pageId) => pageById.has(pageId));
        orderedPageIdsRef.current = validIds;
        setOrderedPageIds(validIds);
    }, [pageById]);

    const finishReorder = React.useCallback(async (pageId) => {
        const previousOrder = initialOrderRef.current;
        const nextOrder = orderedPageIdsRef.current;
        reorderingRef.current = false;
        setDraggingPageId(null);
        onReorderStateChange?.(false);

        if (previousOrder.join('|') === nextOrder.join('|')) {
            setLiveMessage(`${pageById.get(pageId)?.label || 'Page'} order unchanged.`);
            reinitializeCarousel();
            return;
        }

        try {
            await onCommitPageOrder?.(categoryId, nextOrder);
            const position = nextOrder.indexOf(pageId) + 1;
            setLiveMessage(`${pageById.get(pageId)?.label || 'Page'} moved to position ${position}.`);
        } catch {
            orderedPageIdsRef.current = previousOrder;
            setOrderedPageIds(previousOrder);
            setLiveMessage('Could not save the new page order. The previous order was restored.');
        } finally {
            reinitializeCarousel();
        }
    }, [categoryId, onCommitPageOrder, onReorderStateChange, pageById, reinitializeCarousel]);

    const moveWithKeyboard = React.useCallback(async (pageId, direction) => {
        const previousOrder = [...orderedPageIdsRef.current];
        const currentIndex = previousOrder.indexOf(pageId);
        if (currentIndex === -1 || previousOrder.length <= 1) return;
        const proposedIndex = currentIndex + direction;
        if (!loopPages && (proposedIndex < 0 || proposedIndex >= previousOrder.length)) return;
        const targetIndex = ((proposedIndex % previousOrder.length) + previousOrder.length) % previousOrder.length;
        const nextOrder = [...previousOrder];
        nextOrder.splice(currentIndex, 1);
        nextOrder.splice(targetIndex, 0, pageId);
        orderedPageIdsRef.current = nextOrder;
        setOrderedPageIds(nextOrder);

        try {
            await onCommitPageOrder?.(categoryId, nextOrder);
            setLiveMessage(`${pageById.get(pageId)?.label || 'Page'} moved to position ${targetIndex + 1}.`);
        } catch {
            orderedPageIdsRef.current = previousOrder;
            setOrderedPageIds(previousOrder);
            setLiveMessage('Could not save the new page order. The previous order was restored.');
        } finally {
            reinitializeCarousel();
        }
    }, [categoryId, loopPages, onCommitPageOrder, pageById, reinitializeCarousel]);

    if (!displayPages.length) return null;

    return (
        <div className="player-subpage-carousel-wrap" data-testid="player-subpage-carousel">
            <Carousel
                className="player-subpage-carousel"
                opts={{
                    align: 'center',
                    containScroll: false,
                    dragFree: false,
                    loop: loopPages && displayPages.length > 1,
                    skipSnaps: false,
                    watchDrag: false,
                }}
                setApi={setApi}
                aria-label="Current section pages"
            >
                <CarouselContent
                    trackComponent={Reorder.Group}
                    as="div"
                    axis="x"
                    values={orderedPageIds}
                    onReorder={updateReorder}
                    className="player-subpage-carousel__content"
                >
                    {displayPages.map((page, index) => {
                        const active = page.id === activePageId;
                        const pageAlertCount = Math.max(0, Number(alertsByPage?.[page.id] || 0));
                        const pageMetadata = Object.prototype.hasOwnProperty.call(metadataByPage, page.id)
                            ? Math.max(0, Number(metadataByPage[page.id] || 0))
                            : null;
                        const state = getCarouselState(index, activeIndex, displayPages.length, loopPages);
                        return (
                            <ReorderablePlayerTab
                                key={page.id}
                                page={page}
                                state={state}
                                active={active}
                                dragging={draggingPageId === page.id}
                                reorderEnabled={reorderEnabled}
                                pageAlertCount={pageAlertCount}
                                pageMetadata={pageMetadata}
                                onSelectPage={onSelectPage}
                                onStartReorder={startReorder}
                                onFinishReorder={finishReorder}
                                onMoveWithKeyboard={moveWithKeyboard}
                            />
                        );
                    })}
                </CarouselContent>
            </Carousel>
            <span className="sr-only" aria-live="polite">{liveMessage}</span>
            {settingsError && <span className="player-nav-settings-error" role="status">{settingsError}</span>}
            {settingsSaving && <span className="sr-only" role="status">Saving player settings.</span>}
        </div>
    );
}

function ReorderablePlayerTab({
    page,
    state,
    active,
    dragging,
    reorderEnabled,
    pageAlertCount,
    pageMetadata,
    onSelectPage,
    onStartReorder,
    onFinishReorder,
    onMoveWithKeyboard,
}) {
    const dragControls = useDragControls();
    const prefersReducedMotion = useReducedMotion();
    const holdTimerRef = React.useRef(null);
    const startPointRef = React.useRef(null);
    const dragStartedRef = React.useRef(false);
    const suppressClickRef = React.useRef(false);

    const clearHoldTimer = React.useCallback(() => {
        if (holdTimerRef.current) window.clearTimeout(holdTimerRef.current);
        holdTimerRef.current = null;
    }, []);

    React.useEffect(() => clearHoldTimer, [clearHoldTimer]);

    const handlePointerDown = (event) => {
        if (!reorderEnabled || (event.pointerType === 'mouse' && event.button !== 0)) return;
        clearHoldTimer();
        dragStartedRef.current = false;
        startPointRef.current = { x: event.clientX, y: event.clientY };
        const pointerEvent = event.nativeEvent;
        holdTimerRef.current = window.setTimeout(() => {
            dragStartedRef.current = true;
            suppressClickRef.current = true;
            onStartReorder(page.id);
            dragControls.start(pointerEvent, { snapToCursor: false });
        }, REORDER_HOLD_MS);
    };

    const handlePointerMove = (event) => {
        if (!startPointRef.current || dragStartedRef.current) return;
        const distance = Math.hypot(
            event.clientX - startPointRef.current.x,
            event.clientY - startPointRef.current.y
        );
        if (distance > REORDER_MOVE_TOLERANCE) clearHoldTimer();
    };

    const handlePointerEnd = () => {
        startPointRef.current = null;
        if (!dragStartedRef.current) clearHoldTimer();
    };

    const handleDragEnd = () => {
        dragStartedRef.current = false;
        startPointRef.current = null;
        clearHoldTimer();
        onFinishReorder(page.id);
        window.setTimeout(() => {
            suppressClickRef.current = false;
        }, 0);
    };

    const handleClick = (event) => {
        if (suppressClickRef.current || dragging) {
            event.preventDefault();
            event.stopPropagation();
            return;
        }
        onSelectPage(page);
    };

    const handleKeyDown = (event) => {
        if (!reorderEnabled || !event.altKey) return;
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
        event.preventDefault();
        event.stopPropagation();
        onMoveWithKeyboard(page.id, event.key === 'ArrowLeft' ? -1 : 1);
    };

    return (
        <CarouselItem
            as={Reorder.Item}
            itemAs="div"
            value={page.id}
            layout
            drag="x"
            dragControls={dragControls}
            dragListener={false}
            dragMomentum={false}
            dragElastic={0.08}
            onDragEnd={handleDragEnd}
            animate={dragging
                ? { scale: 1.06, rotate: prefersReducedMotion ? 0 : [0, -0.8, 0.8, 0] }
                : { scale: 1, rotate: 0 }}
            transition={{ layout: { duration: 0.18 }, duration: 0.22 }}
            className={`player-subpage-carousel__item ${dragging ? 'is-reordering' : ''}`}
            style={{ zIndex: dragging ? 4 : 1 }}
        >
            <button
                type="button"
                className={`player-subpage-carousel__tab ${state} ${page.future ? 'future' : ''}`}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerEnd}
                onPointerCancel={handlePointerEnd}
                onClick={handleClick}
                onKeyDown={handleKeyDown}
                onContextMenu={(event) => {
                    if (dragging || dragStartedRef.current) event.preventDefault();
                }}
                aria-current={active ? 'page' : undefined}
                aria-grabbed={dragging || undefined}
                data-reorder-tab="true"
                data-testid={`player-carousel-page-${page.id}`}
            >
                <span className="player-subpage-carousel__icon-wrap">
                    <img src={getPlayerNavIconSrc(page.icon)} alt="" className="player-subpage-carousel__icon" />
                </span>
                <span className="player-subpage-carousel__label">{page.label}</span>
                {pageAlertCount > 0 && <span className="player-nav-alert-dot" aria-label={`${pageAlertCount} unread updates`} />}
                {pageMetadata !== null && <span className="player-subpage-carousel__metadata" aria-label={`${pageMetadata} notes`}>{pageMetadata}</span>}
                {page.future && <span className="player-subpage-carousel__note">Soon</span>}
            </button>
        </CarouselItem>
    );
}

function getCarouselState(index, activeIndex, length, loopPages = true) {
    if (index === activeIndex) return 'active';
    if (!loopPages) return Math.abs(index - activeIndex) === 1 ? 'neighbor' : 'edge';
    const forward = ((index - activeIndex) % length + length) % length;
    const backward = ((activeIndex - index) % length + length) % length;
    const distance = Math.min(forward, backward);
    if (distance === 1) return 'neighbor';
    return 'edge';
}
