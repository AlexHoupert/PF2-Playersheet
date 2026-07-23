import React, { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { buildCatalogDetailViewModel } from '../../catalog/catalogDetailViewModel';
import { parseFoundry } from '../../utils/foundryParser';

export default function CatalogDetailContent({
    entry,
    catalogType,
    actor,
    isLoading = false,
    loadError = null,
    showImage = true,
    compact = false,
    onContentLinkClick,
    beforeDescription,
    afterDescription,
    className,
}) {
    const viewModel = useMemo(
        () => buildCatalogDetailViewModel({ catalogType, entry }),
        [catalogType, entry]
    );

    if (!entry) return <div className="p-6 text-center text-muted-foreground">No entry selected.</div>;

    return (
        <article
            className={cn('flex min-w-0 flex-col gap-4 text-foreground', className)}
            data-catalog-detail-type={viewModel.catalogType}
            onClick={onContentLinkClick}
        >
            <EntityDetailHeader viewModel={viewModel} compact={compact} showImage={showImage} />
            <TraitBadgeList rarity={viewModel.rarity} traits={viewModel.traits} />
            <DetailMetaGrid items={viewModel.metadata} />
            {beforeDescription}
            <RichDescription
                description={viewModel.description}
                actor={actor}
                isLoading={isLoading}
                loadError={loadError}
            />
            {afterDescription}
        </article>
    );
}

export function EntityDetailHeader({ viewModel, compact = false, showImage = true }) {
    const [imageFailed, setImageFailed] = useState(false);
    return (
        <header className="flex min-w-0 items-start gap-3">
            {showImage && viewModel.image && !imageFailed ? (
                <img
                    src={viewModel.image}
                    alt=""
                    className={cn('size-12 shrink-0 rounded-md border border-border/70 bg-background object-contain', compact && 'size-10')}
                    onError={() => setImageFailed(true)}
                />
            ) : null}
            <div className="flex min-w-0 flex-1 items-start justify-between gap-3">
                <div className="min-w-0">
                    <h2 className={cn('font-heading text-xl text-primary', compact && 'text-base')}>{viewModel.name}</h2>
                    {viewModel.subtitle ? <p className="mt-1 text-sm text-muted-foreground">{viewModel.subtitle}</p> : null}
                </div>
                {viewModel.levelLabel ? <span className="shrink-0 font-medium text-primary">{viewModel.levelLabel}</span> : null}
            </div>
        </header>
    );
}

export function TraitBadgeList({ rarity, traits = [] }) {
    if ((!rarity || rarity === 'common') && !traits.length) return null;
    return (
        <div className="flex flex-wrap gap-2" aria-label="Traits">
            {rarity && rarity !== 'common' ? <Badge variant="outline" className="capitalize">{rarity}</Badge> : null}
            {traits.map((trait) => <Badge key={trait} variant="secondary">{trait}</Badge>)}
        </div>
    );
}

export function DetailMetaGrid({ items = [] }) {
    if (!items.length) return null;
    return (
        <dl className="grid grid-cols-[repeat(auto-fit,minmax(8rem,1fr))] gap-3 border-y border-border/70 py-3">
            {items.map((item) => (
                <div key={`${item.label}:${item.value}`} className="min-w-0">
                    <dt className="text-xs uppercase text-muted-foreground">{item.label}</dt>
                    <dd className={cn('mt-1 break-words font-medium', item.capitalize && 'capitalize')}>{item.value}</dd>
                </div>
            ))}
        </dl>
    );
}

export function RichDescription({ description, actor, isLoading = false, loadError = null }) {
    if (isLoading) return <p className="text-sm italic text-muted-foreground">Loading details...</p>;
    if (loadError) return <p role="alert" className="text-sm text-destructive">Failed to load: {String(loadError)}</p>;
    if (!description) return <p className="text-sm italic text-muted-foreground">No description available.</p>;
    return (
        <div
            className="formatted-content min-w-0 text-sm leading-6 [&_a]:text-primary [&_a]:underline [&_ol]:pl-5 [&_p]:my-2 [&_ul]:pl-5"
            dangerouslySetInnerHTML={{ __html: parseFoundry(description, { actor }) }}
        />
    );
}

