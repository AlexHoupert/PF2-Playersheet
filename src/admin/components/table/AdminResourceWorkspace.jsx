import React, { useCallback, useMemo, useRef, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    ResizableHandle,
    ResizablePanel,
    ResizablePanelGroup,
} from '@/components/ui/resizable';
import { cn } from '@/lib/utils';
import BottomSheet from '../../../shared/components/BottomSheet';

const DEFAULT_HORIZONTAL = { main: 65, side: 35 };
const DEFAULT_VERTICAL = { upper: 38, lower: 62 };

export default function AdminResourceWorkspace({
    storageKey,
    main,
    upper,
    lower,
    isMobile = false,
    mobileMode = 'upper',
    onMobileModeChange,
    mobileOpen = false,
    onMobileOpenChange,
    upperLabel = 'Targets',
    lowerLabel = 'Contents',
    className,
}) {
    const horizontalRef = useRef(null);
    const verticalRef = useRef(null);
    const [layoutRevision, setLayoutRevision] = useState(0);
    const hasSide = Boolean(upper || lower);
    const horizontalStorageKey = `${storageKey}:horizontal`;
    const verticalStorageKey = `${storageKey}:vertical`;
    const horizontalLayout = useMemo(
        () => readStoredLayout(horizontalStorageKey, DEFAULT_HORIZONTAL),
        [horizontalStorageKey, layoutRevision]
    );
    const verticalLayout = useMemo(
        () => readStoredLayout(verticalStorageKey, DEFAULT_VERTICAL),
        [verticalStorageKey, layoutRevision]
    );

    const resetLayout = useCallback(() => {
        removeStoredLayout(horizontalStorageKey);
        removeStoredLayout(verticalStorageKey);
        horizontalRef.current?.setLayout(DEFAULT_HORIZONTAL);
        verticalRef.current?.setLayout(DEFAULT_VERTICAL);
        setLayoutRevision((value) => value + 1);
    }, [horizontalStorageKey, verticalStorageKey]);

    if (!hasSide) {
        return <div className={cn('min-h-0 flex-1', className)}>{main}</div>;
    }

    if (isMobile) {
        return (
            <>
                <div className={cn('min-h-0 flex-1', className)} data-admin-resource-workspace="mobile">{main}</div>
                <BottomSheet
                    isOpen={mobileOpen}
                    onClose={() => onMobileOpenChange?.(false)}
                    title={`${upperLabel} / ${lowerLabel}`}
                    height="90dvh"
                >
                    <div className="flex h-full min-h-0 flex-col gap-2">
                        <div className="flex items-center gap-2 rounded-lg border border-border/70 bg-card p-1">
                            <Button
                                type="button"
                                size="sm"
                                variant={mobileMode === 'upper' ? 'default' : 'ghost'}
                                onClick={() => onMobileModeChange?.('upper')}
                            >
                                {upperLabel}
                            </Button>
                            <Button
                                type="button"
                                size="sm"
                                variant={mobileMode === 'lower' ? 'default' : 'ghost'}
                                onClick={() => onMobileModeChange?.('lower')}
                            >
                                {lowerLabel}
                            </Button>
                        </div>
                        <div className="min-h-0 flex-1">
                            {mobileMode === 'lower' ? lower : upper}
                        </div>
                    </div>
                </BottomSheet>
            </>
        );
    }

    return (
        <div className={cn('relative min-h-0 flex-1', className)} data-admin-resource-workspace="desktop">
            <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="absolute top-2 right-2 z-20"
                onClick={resetLayout}
                aria-label="Reset workspace layout"
                title="Reset workspace layout"
            >
                <RotateCcw />
            </Button>
            <ResizablePanelGroup
                key={`horizontal-${layoutRevision}`}
                id={`${storageKey}-horizontal`}
                groupRef={horizontalRef}
                orientation="horizontal"
                defaultLayout={horizontalLayout}
                onLayoutChanged={(layout, meta) => meta.isUserInteraction && writeStoredLayout(horizontalStorageKey, layout)}
            >
                <ResizablePanel id="main" minSize="42%" defaultSize="65%" className="min-w-0 pr-1.5">
                    <div className="h-full min-h-0">{main}</div>
                </ResizablePanel>
                <ResizableHandle withHandle className="mx-1.5 bg-border/80" />
                <ResizablePanel id="side" minSize="24%" defaultSize="35%" className="min-w-0 pl-1.5">
                    <ResizablePanelGroup
                        key={`vertical-${layoutRevision}`}
                        id={`${storageKey}-vertical`}
                        groupRef={verticalRef}
                        orientation="vertical"
                        defaultLayout={verticalLayout}
                        onLayoutChanged={(layout, meta) => meta.isUserInteraction && writeStoredLayout(verticalStorageKey, layout)}
                    >
                        <ResizablePanel id="upper" minSize="22%" defaultSize="38%" className="min-h-0 pb-1.5">
                            <div className="h-full min-h-0">{upper}</div>
                        </ResizablePanel>
                        <ResizableHandle withHandle className="my-1.5 bg-border/80" />
                        <ResizablePanel id="lower" minSize="32%" defaultSize="62%" className="min-h-0 pt-1.5">
                            <div className="h-full min-h-0">{lower}</div>
                        </ResizablePanel>
                    </ResizablePanelGroup>
                </ResizablePanel>
            </ResizablePanelGroup>
        </div>
    );
}

export function readStoredLayout(key, fallback) {
    if (typeof window === 'undefined') return fallback;
    try {
        const parsed = JSON.parse(window.localStorage.getItem(key));
        if (!parsed || typeof parsed !== 'object') return fallback;
        const expectedKeys = Object.keys(fallback);
        if (!expectedKeys.every((id) => Number.isFinite(parsed[id]) && parsed[id] > 0)) return fallback;
        return parsed;
    } catch {
        return fallback;
    }
}

function writeStoredLayout(key, layout) {
    if (typeof window === 'undefined') return;
    try {
        window.localStorage.setItem(key, JSON.stringify(layout));
    } catch {
        // Local persistence is optional; resizing remains functional without it.
    }
}

function removeStoredLayout(key) {
    if (typeof window === 'undefined') return;
    try {
        window.localStorage.removeItem(key);
    } catch {
        // Ignore unavailable storage.
    }
}
