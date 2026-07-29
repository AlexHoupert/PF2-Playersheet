import React, { useCallback } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { ModalLayerMount } from '../../overlays/ModalLayerProvider';
import './AppDialogShell.css';

const SIZE_CLASSES = Object.freeze({
    sm: 'sm:h-[min(90svh,36rem)] sm:max-w-lg',
    md: 'sm:h-[min(90svh,44rem)] sm:max-w-2xl',
    lg: 'sm:h-[min(90svh,52rem)] sm:max-w-4xl',
    viewport: 'sm:h-[90svh] sm:max-w-[min(1100px,calc(100vw-2rem))]',
});

export default function AppDialogShell({
    open,
    onOpenChange,
    onRequestClose,
    layerId,
    title,
    description,
    backAction,
    trigger,
    children,
    footer,
    closeLabel = 'Close',
    showDefaultClose = true,
    preventOutsideClose = true,
    size = 'md',
    contentClassName,
    bodyClassName,
    headerClassName,
    footerClassName,
    contentProps,
}) {
    const requestClose = useCallback(async (reason) => {
        if (onRequestClose) {
            const allowed = await onRequestClose(reason);
            if (allowed === false) return;
        }
        onOpenChange?.(false);
    }, [onOpenChange, onRequestClose]);

    const handleOpenChange = useCallback((nextOpen) => {
        if (nextOpen) onOpenChange?.(true);
        else requestClose('dismiss');
    }, [onOpenChange, requestClose]);

    const handleEscape = useCallback((event) => {
        event.preventDefault();
        requestClose('escape');
    }, [requestClose]);

    const sizeClassName = SIZE_CLASSES[size] || SIZE_CLASSES.md;
    const {
        onPointerDownOutside: onContentPointerDownOutside,
        onInteractOutside: onContentInteractOutside,
        ...restContentProps
    } = contentProps || {};
    const resolvedFooter = typeof footer === 'function' ? footer({ requestClose }) : footer;

    return (
        <ModalLayerMount id={layerId} active={Boolean(open)}>
            <Dialog open={Boolean(open)} onOpenChange={handleOpenChange}>
                {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
                <DialogContent
                    showCloseButton={false}
                    data-app-dialog-shell
                    data-player-interaction-lock="true"
                    className={cn(
                        'grid h-[94svh] w-[96vw] max-w-[96vw] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0',
                        sizeClassName,
                        contentClassName
                    )}
                    onEscapeKeyDown={handleEscape}
                    onPointerDownOutside={(event) => {
                        if (preventOutsideClose) event.preventDefault();
                        onContentPointerDownOutside?.(event);
                    }}
                    onInteractOutside={(event) => {
                        if (preventOutsideClose) event.preventDefault();
                        onContentInteractOutside?.(event);
                    }}
                    {...restContentProps}
                >
                    <DialogHeader data-app-dialog-header className={cn('border-b border-border/70 p-4 text-left', headerClassName)}>
                        <div className="flex min-w-0 items-start gap-2">
                            {backAction ? (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon-sm"
                                    aria-label={backAction.label || 'Back'}
                                    title={backAction.label || 'Back'}
                                    onClick={backAction.onClick}
                                >
                                    <ArrowLeft />
                                </Button>
                            ) : null}
                            <div className="flex min-w-0 flex-1 flex-col gap-1">
                                <DialogTitle className="truncate text-lg text-primary">{title || 'Details'}</DialogTitle>
                                {description ? (
                                    <DialogDescription>{description}</DialogDescription>
                                ) : (
                                    <DialogDescription className="sr-only">{title || 'Dialog details'}</DialogDescription>
                                )}
                            </div>
                        </div>
                    </DialogHeader>

                    <div
                        data-app-dialog-body
                        className={cn(
                            'min-h-0 overflow-y-auto overscroll-contain p-4 [touch-action:pan-y]',
                            bodyClassName
                        )}
                    >
                        {children}
                    </div>

                    <DialogFooter data-app-dialog-footer className={cn('app-dialog-shell__footer m-0 rounded-none border-t border-border/70 bg-muted/50 p-4', footerClassName)}>
                        {resolvedFooter}
                        {showDefaultClose ? (
                            <Button type="button" variant="outline" onClick={() => requestClose('footer')}>
                                {closeLabel}
                            </Button>
                        ) : null}
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </ModalLayerMount>
    );
}

export { SIZE_CLASSES as APP_DIALOG_SIZE_CLASSES };
