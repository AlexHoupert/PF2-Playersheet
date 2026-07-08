import React from 'react';
import { X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function AdminActiveFilterChips({
    chips = [],
    onClearAll,
    clearLabel = 'Clear all',
    className,
}) {
    if (!chips.length) return null;

    return (
        <div className={cn('flex min-w-0 flex-wrap items-center gap-1.5', className)}>
            <span className="shrink-0 text-xs font-medium text-muted-foreground">Active filters</span>
            {chips.map((chip) => (
                <Badge
                    key={chip.key}
                    variant="outline"
                    className="max-w-[18rem] gap-1.5 rounded-full border-primary/30 bg-primary/10 px-2.5 py-1 text-foreground shadow-none"
                >
                    <span className="truncate">{chip.label}</span>
                    <button
                        type="button"
                        className="-mr-1 inline-flex size-4 shrink-0 items-center justify-center rounded-full text-muted-foreground transition hover:bg-background/80 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        aria-label={`Remove filter ${chip.label}`}
                        onClick={chip.onRemove}
                    >
                        <X aria-hidden="true" />
                    </button>
                </Badge>
            ))}
            {onClearAll && chips.length > 1 ? (
                <Button type="button" variant="ghost" size="sm" className="h-7 px-1 text-xs" onClick={onClearAll}>
                    {clearLabel}
                </Button>
            ) : null}
        </div>
    );
}
