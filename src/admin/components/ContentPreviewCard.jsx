import React from 'react';
import { Button } from '@/components/ui/button';
import CatalogDetailContent from '../../shared/components/catalog-detail/CatalogDetailContent';

export default function ContentPreviewCard({ item, entityType, isLoading = false, onEdit, onClose }) {
    if (!item) return null;

    return (
        <div className="flex h-full min-h-0 flex-col gap-3">
            {(onEdit || onClose) ? (
                <div className="flex shrink-0 flex-wrap gap-2 border-b border-border/70 pb-3">
                    {onEdit ? <Button type="button" size="sm" onClick={onEdit}>Edit</Button> : null}
                    {onClose ? <Button type="button" size="sm" variant="outline" onClick={onClose}>Close</Button> : null}
                </div>
            ) : null}
            <div className="min-h-0 flex-1 overflow-y-auto pt-1">
                <CatalogDetailContent entry={item} catalogType={entityType} isLoading={isLoading} />
            </div>
        </div>
    );
}
