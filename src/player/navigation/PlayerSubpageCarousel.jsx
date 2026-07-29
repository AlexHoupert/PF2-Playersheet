import React from 'react';
import { Check, GripVertical, X } from 'lucide-react';
import { Carousel, CarouselContent, CarouselItem } from '../../components/ui/carousel';
import {
    getCategoryIdForPlayerPage,
    getVisiblePlayerCategory,
} from './playerPageRegistry';
import { getPlayerNavIconSrc } from './playerNavIcons';

const REORDER_HOLD_MS = 2000;
const REORDER_MOVE_TOLERANCE = 12;

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
    const [reorderMode, setReorderMode] = React.useState(false);
    const [draftPageIds, setDraftPageIds] = React.useState([]);
    const [draggingPageId, setDraggingPageId] = React.useState(null);
    const [liveMessage, setLiveMessage] = React.useState('');
    const [commitPending, setCommitPending] = React.useState(false);
    const categoryId = getCategoryIdForPlayerPage(activePageId);
    const pages = getVisiblePlayerCategory(categoryId, navigationContext)?.pages || [];
    const pageIds = pages.map((page) => page.id);
    const pageOrderKey = pageIds.join('|');
    const pageById = React.useMemo(
        () => new Map(pages.map((page) => [page.id, page])),
        [pageOrderKey] // eslint-disable-line react-hooks/exhaustive-deps
    );
    const activeIndex = Math.max(0, pages.findIndex((page) => page.id === activePageId));
    const reorderEnabled = Boolean(onCommitPageOrder && pages.length > 1);
    const holdRef = React.useRef(null);
    const suppressClickRef = React.useRef(false);
    const draftPageIdsRef = React.useRef(pageIds);
    const dragRef = React.useRef(null);
    const centeringRef = React.useRef(false);
    const centeringFrameRef = React.useRef(null);

    const carouselOptions = React.useMemo(() => ({
        align: 'center',
        containScroll: false,
        dragFree: false,
        loop: loopPages && pages.length > 1,
        skipSnaps: false,
        dragThreshold: 10,
        watchDrag: true,
        watchSlides: true,
    }), [loopPages, pages.length]);

    const clearHold = React.useCallback(() => {
        if (holdRef.current?.timer) window.clearTimeout(holdRef.current.timer);
        holdRef.current = null;
    }, []);

    const closeReorderMode = React.useCallback(() => {
        setReorderMode(false);
        setDraggingPageId(null);
        dragRef.current = null;
        onReorderStateChange?.(false);
    }, [onReorderStateChange]);

    const centerActiveTab = React.useCallback((index) => {
        if (!api || index < 0) return;
        centeringRef.current = true;
        if (centeringFrameRef.current) window.cancelAnimationFrame(centeringFrameRef.current);
        api.scrollTo(index, true);
        centeringFrameRef.current = window.requestAnimationFrame(() => {
            centeringRef.current = false;
            centeringFrameRef.current = null;
        });
    }, [api]);

    React.useLayoutEffect(() => {
        centerActiveTab(activeIndex);
    }, [activeIndex, centerActiveTab, pageOrderKey]);

    React.useEffect(() => {
        if (!api) return undefined;
        const handleSelect = () => {
            if (centeringRef.current) return;
            const selectedPage = pages[api.selectedScrollSnap()];
            if (selectedPage && selectedPage.id !== activePageId) onSelectPage(selectedPage);
        };
        const handleReInit = () => {
            const nextActiveIndex = pages.findIndex((page) => page.id === activePageId);
            centerActiveTab(nextActiveIndex);
        };
        api.on('select', handleSelect);
        api.on('reInit', handleReInit);
        return () => {
            api.off('select', handleSelect);
            api.off('reInit', handleReInit);
        };
    }, [activePageId, api, centerActiveTab, onSelectPage, pageOrderKey]); // eslint-disable-line react-hooks/exhaustive-deps

    React.useEffect(() => {
        clearHold();
        draftPageIdsRef.current = pageIds;
        setDraftPageIds(pageIds);
        if (reorderMode) closeReorderMode();
    }, [categoryId, pageOrderKey]); // eslint-disable-line react-hooks/exhaustive-deps

    React.useEffect(() => {
        const handlePointerMove = (event) => {
            const hold = holdRef.current;
            if (!hold || event.pointerId !== hold.pointerId) return;
            const distance = Math.hypot(event.clientX - hold.startX, event.clientY - hold.startY);
            if (distance > REORDER_MOVE_TOLERANCE) clearHold();
        };
        const handlePointerEnd = (event) => {
            const hold = holdRef.current;
            if (!hold || event.pointerId !== hold.pointerId) return;
            clearHold();
            window.setTimeout(() => {
                suppressClickRef.current = false;
            }, 0);
        };
        window.addEventListener('pointermove', handlePointerMove, { passive: true });
        window.addEventListener('pointerup', handlePointerEnd, { passive: true });
        window.addEventListener('pointercancel', handlePointerEnd, { passive: true });
        return () => {
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', handlePointerEnd);
            window.removeEventListener('pointercancel', handlePointerEnd);
        };
    }, [clearHold]);

    React.useEffect(() => () => {
        clearHold();
        if (centeringFrameRef.current) window.cancelAnimationFrame(centeringFrameRef.current);
        onReorderStateChange?.(false);
    }, [clearHold, onReorderStateChange]);

    const beginHold = React.useCallback((pageId, event) => {
        if (!reorderEnabled || (event.pointerType === 'mouse' && event.button !== 0)) return;
        clearHold();
        holdRef.current = {
            pageId,
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            timer: window.setTimeout(() => {
                suppressClickRef.current = true;
                draftPageIdsRef.current = [...pageIds];
                setDraftPageIds(pageIds);
                setReorderMode(true);
                setLiveMessage('Reorder mode opened. Drag tabs into position, then confirm.');
                onReorderStateChange?.(true);
            }, REORDER_HOLD_MS),
        };
    }, [clearHold, onReorderStateChange, pageOrderKey, reorderEnabled]); // eslint-disable-line react-hooks/exhaustive-deps

    const selectPage = React.useCallback((event, page) => {
        if (suppressClickRef.current || reorderMode) {
            event.preventDefault();
            event.stopPropagation();
            return;
        }
        onSelectPage(page);
    }, [onSelectPage, reorderMode]);

    const moveDraftPage = React.useCallback((pageId, targetPageId) => {
        if (!pageId || !targetPageId || pageId === targetPageId) return;
        const currentOrder = [...draftPageIdsRef.current];
        const sourceIndex = currentOrder.indexOf(pageId);
        const targetIndex = currentOrder.indexOf(targetPageId);
        if (sourceIndex < 0 || targetIndex < 0) return;
        currentOrder.splice(sourceIndex, 1);
        currentOrder.splice(targetIndex, 0, pageId);
        draftPageIdsRef.current = currentOrder;
        setDraftPageIds(currentOrder);
    }, []);

    const beginDraftDrag = (pageId, event) => {
        if (event.pointerType === 'mouse' && event.button !== 0) return;
        event.preventDefault();
        event.currentTarget.setPointerCapture?.(event.pointerId);
        dragRef.current = { pageId, pointerId: event.pointerId };
        setDraggingPageId(pageId);
    };

    const continueDraftDrag = (event) => {
        const drag = dragRef.current;
        if (!drag || drag.pointerId !== event.pointerId) return;
        event.preventDefault();
        const target = document.elementsFromPoint(event.clientX, event.clientY)
            .map((element) => element.closest?.('[data-reorder-page-id]'))
            .find((element) => element?.dataset?.reorderPageId !== drag.pageId);
        if (target?.dataset?.reorderPageId) moveDraftPage(drag.pageId, target.dataset.reorderPageId);
    };

    const endDraftDrag = (event) => {
        const drag = dragRef.current;
        if (!drag || drag.pointerId !== event.pointerId) return;
        event.preventDefault();
        dragRef.current = null;
        setDraggingPageId(null);
        setLiveMessage(`${pageById.get(drag.pageId)?.label || 'Page'} moved. Confirm to save.`);
    };

    const moveDraftWithKeyboard = (pageId, direction) => {
        const currentOrder = [...draftPageIdsRef.current];
        const currentIndex = currentOrder.indexOf(pageId);
        const targetIndex = currentIndex + direction;
        if (currentIndex < 0 || targetIndex < 0 || targetIndex >= currentOrder.length) return;
        moveDraftPage(pageId, currentOrder[targetIndex]);
        setLiveMessage(`${pageById.get(pageId)?.label || 'Page'} moved to position ${targetIndex + 1}.`);
    };

    const commitDraftOrder = async () => {
        const nextOrder = [...draftPageIdsRef.current];
        if (nextOrder.join('|') === pageIds.join('|')) {
            closeReorderMode();
            setLiveMessage('Tab order unchanged.');
            return;
        }
        setCommitPending(true);
        try {
            await onCommitPageOrder?.(categoryId, nextOrder);
            closeReorderMode();
            setLiveMessage('Tab order saved.');
        } catch {
            setLiveMessage('Could not save the new tab order.');
        } finally {
            setCommitPending(false);
        }
    };

    const moveWithKeyboard = async (pageId, direction) => {
        if (!reorderEnabled) return;
        const currentIndex = pageIds.indexOf(pageId);
        if (currentIndex < 0) return;
        const proposedIndex = currentIndex + direction;
        if (!loopPages && (proposedIndex < 0 || proposedIndex >= pageIds.length)) return;
        const targetIndex = ((proposedIndex % pageIds.length) + pageIds.length) % pageIds.length;
        const nextOrder = [...pageIds];
        nextOrder.splice(currentIndex, 1);
        nextOrder.splice(targetIndex, 0, pageId);
        try {
            await onCommitPageOrder?.(categoryId, nextOrder);
            setLiveMessage(`${pageById.get(pageId)?.label || 'Page'} moved to position ${targetIndex + 1}.`);
        } catch {
            setLiveMessage('Could not save the new tab order.');
        }
    };

    if (!pages.length) return null;

    return (
        <div
            className={`player-subpage-carousel-wrap ${reorderMode ? 'is-reordering' : ''}`}
            data-testid="player-subpage-carousel"
            data-reordering={reorderMode ? 'true' : 'false'}
        >
            <Carousel
                className="player-subpage-carousel"
                opts={carouselOptions}
                setApi={setApi}
                aria-label="Current section pages"
            >
                <CarouselContent className="player-subpage-carousel__content">
                    {pages.map((page, index) => {
                        const active = page.id === activePageId;
                        const pageAlertCount = Math.max(0, Number(alertsByPage?.[page.id] || 0));
                        const pageMetadata = Object.prototype.hasOwnProperty.call(metadataByPage, page.id)
                            ? Math.max(0, Number(metadataByPage[page.id] || 0))
                            : null;
                        const state = getCarouselState(index, activeIndex, pages.length, loopPages);
                        return (
                            <CarouselItem key={page.id} className="player-subpage-carousel__item">
                                <button
                                    type="button"
                                    className={`player-subpage-carousel__tab ${state} ${page.future ? 'future' : ''}`}
                                    onPointerDown={(event) => beginHold(page.id, event)}
                                    onClick={(event) => selectPage(event, page)}
                                    onKeyDown={(event) => {
                                        if (!event.altKey || (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')) return;
                                        event.preventDefault();
                                        event.stopPropagation();
                                        moveWithKeyboard(page.id, event.key === 'ArrowLeft' ? -1 : 1);
                                    }}
                                    onContextMenu={(event) => { if (reorderEnabled) event.preventDefault(); }}
                                    aria-current={active ? 'page' : undefined}
                                    data-player-page-id={page.id}
                                    data-testid={`player-carousel-page-${page.id}`}
                                >
                                    <PlayerTabContent
                                        page={page}
                                        pageAlertCount={pageAlertCount}
                                        pageMetadata={pageMetadata}
                                    />
                                </button>
                            </CarouselItem>
                        );
                    })}
                </CarouselContent>
            </Carousel>

            {reorderMode && (
                <div
                    className="player-tab-reorder-panel"
                    data-testid="player-tab-reorder-panel"
                    aria-label="Reorder tabs"
                >
                    <div className="player-tab-reorder-panel__header">
                        <span>Drag tabs to reorder</span>
                        <div className="player-tab-reorder-panel__actions">
                            <button
                                type="button"
                                className="player-tab-reorder-panel__action"
                                onClick={closeReorderMode}
                                disabled={commitPending}
                                title="Cancel tab reordering"
                                aria-label="Cancel tab reordering"
                            >
                                <X aria-hidden="true" />
                            </button>
                            <button
                                type="button"
                                className="player-tab-reorder-panel__action primary"
                                onClick={commitDraftOrder}
                                disabled={commitPending}
                                title="Save tab order"
                                aria-label="Save tab order"
                            >
                                <Check aria-hidden="true" />
                            </button>
                        </div>
                    </div>
                    <div className="player-tab-reorder-panel__grid">
                        {draftPageIds.map((pageId) => {
                            const page = pageById.get(pageId);
                            if (!page) return null;
                            const dragging = draggingPageId === pageId;
                            return (
                                <button
                                    key={page.id}
                                    type="button"
                                    className={`player-tab-reorder-panel__item ${dragging ? 'is-dragging' : ''}`}
                                    data-reorder-page-id={page.id}
                                    aria-grabbed={dragging || undefined}
                                    onPointerDown={(event) => beginDraftDrag(page.id, event)}
                                    onPointerMove={continueDraftDrag}
                                    onPointerUp={endDraftDrag}
                                    onPointerCancel={endDraftDrag}
                                    onKeyDown={(event) => {
                                        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
                                        event.preventDefault();
                                        moveDraftWithKeyboard(page.id, event.key === 'ArrowLeft' ? -1 : 1);
                                    }}
                                >
                                    <GripVertical aria-hidden="true" />
                                    <img src={getPlayerNavIconSrc(page.icon)} alt="" draggable="false" />
                                    <span>{page.label}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            <span className="sr-only" aria-live="polite">{liveMessage}</span>
            {settingsError && <span className="player-nav-settings-error" role="status">{settingsError}</span>}
            {(settingsSaving || commitPending) && <span className="sr-only" role="status">Saving player settings.</span>}
        </div>
    );
}

function PlayerTabContent({ page, pageAlertCount, pageMetadata }) {
    return (
        <>
            <span className="player-subpage-carousel__icon-wrap">
                <img
                    src={getPlayerNavIconSrc(page.icon)}
                    alt=""
                    className="player-subpage-carousel__icon"
                    draggable="false"
                />
            </span>
            <span className="player-subpage-carousel__label">{page.label}</span>
            {pageAlertCount > 0 && <span className="player-nav-alert-dot" aria-label={`${pageAlertCount} unread updates`} />}
            {pageMetadata !== null && <span className="player-subpage-carousel__metadata" aria-label={`${pageMetadata} notes`}>{pageMetadata}</span>}
            {page.future && <span className="player-subpage-carousel__note">Soon</span>}
        </>
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
