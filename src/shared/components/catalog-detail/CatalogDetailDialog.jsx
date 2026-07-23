import React from 'react';
import AppDialogShell from '../dialogs/AppDialogShell';
import CatalogDetailContent from './CatalogDetailContent';

export default function CatalogDetailDialog({
    open,
    onOpenChange,
    entry,
    catalogType,
    actor,
    isLoading,
    loadError,
    onContentLinkClick,
    onBack,
    hasHistory = false,
    footer,
    children,
}) {
    const id = entry?.instanceId || entry?.id || entry?._id || entry?.sourceFile || entry?.name || 'unknown';
    return (
        <AppDialogShell
            open={open}
            onOpenChange={onOpenChange}
            layerId={`catalog-detail-${catalogType || entry?._entityType || 'entry'}-${id}`}
            title={entry?.name || 'Catalog details'}
            description="Catalog entry details"
            size="viewport"
            backAction={hasHistory && onBack ? { onClick: onBack, label: 'Back to previous detail' } : null}
            footer={footer}
        >
            <CatalogDetailContent
                entry={entry}
                catalogType={catalogType}
                actor={actor}
                isLoading={isLoading}
                loadError={loadError}
                onContentLinkClick={onContentLinkClick}
                afterDescription={children}
            />
        </AppDialogShell>
    );
}

