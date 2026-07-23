import React from 'react';
import CatalogDetailContent from './catalog-detail/CatalogDetailContent';

export default function ItemDetailContent({
    item,
    isLoading = false,
    loadError = null,
    showImage = true,
    compact = false,
}) {
    return (
        <CatalogDetailContent
            entry={item}
            catalogType="item"
            isLoading={isLoading}
            loadError={loadError}
            showImage={showImage}
            compact={compact}
        />
    );
}
