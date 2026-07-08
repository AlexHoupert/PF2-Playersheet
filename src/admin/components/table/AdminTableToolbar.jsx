import React from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import AdminActiveFilterChips from './AdminActiveFilterChips';
import AdminColumnMenu from './AdminColumnMenu';
import AdminFilterDrawer from './AdminFilterDrawer';
import {
    buildActiveFilterChips,
    countActiveFilters,
    removeFilterValue,
    resetFilterValues,
} from './adminTableFilters';

export default function AdminTableToolbar({
    search = '',
    onSearchChange,
    searchPlaceholder = 'Search...',
    searchTestId,
    filters = [],
    filterValues = {},
    onFilterValuesChange,
    filterOpen = false,
    onFilterOpenChange,
    focusFilterId = null,
    columns = [],
    visibleColumns = [],
    onVisibleColumnsChange,
    primaryActions,
    secondaryActions,
    leftControls,
    resultMeta,
    className = '',
}) {
    const activeCount = countActiveFilters(filters, filterValues);
    const chips = buildActiveFilterChips(filters, filterValues, (filterId) => {
        onFilterValuesChange?.(removeFilterValue(filters, filterValues, filterId));
    });

    return (
        <div
            data-admin-table-toolbar
            className={cn(
                'flex flex-col rounded-lg border border-border/70 bg-card px-3 py-2',
                chips.length ? 'gap-2' : 'gap-0',
                className
            )}
        >
            <div className="flex flex-wrap items-center gap-2">
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                    <Input
                        data-testid={searchTestId}
                        value={search}
                        onChange={(event) => onSearchChange?.(event.target.value)}
                        placeholder={searchPlaceholder}
                        className="h-10 min-w-[16rem] flex-1 basis-[22rem] lg:max-w-[42rem]"
                    />

                    {leftControls}

                    <div className="flex flex-wrap items-center gap-2">
                        {filters.length ? (
                            <Button type="button" variant="outline" size="sm" onClick={() => onFilterOpenChange?.(true)}>
                                <SlidersHorizontal data-icon="inline-start" />
                                Filters
                                {activeCount ? <span className="ml-1 rounded-full bg-primary/20 px-1.5 text-xs">{activeCount}</span> : null}
                            </Button>
                        ) : null}

                        {columns.length ? (
                            <AdminColumnMenu
                                columns={columns}
                                visibleColumns={visibleColumns}
                                onVisibleColumnsChange={onVisibleColumnsChange}
                            />
                        ) : null}

                        {secondaryActions}
                        {resultMeta ? (
                            <div className="inline-flex min-h-8 items-center rounded-lg border border-border/70 px-3 text-xs text-muted-foreground">
                                {resultMeta}
                            </div>
                        ) : null}
                    </div>
                </div>

                {primaryActions ? (
                    <div className="ml-auto flex flex-wrap items-center gap-2 justify-end">
                        {primaryActions}
                    </div>
                ) : null}
            </div>

            <AdminActiveFilterChips
                chips={chips}
                onClearAll={() => onFilterValuesChange?.(resetFilterValues(filters))}
            />

            <AdminFilterDrawer
                open={filterOpen}
                onOpenChange={onFilterOpenChange}
                filters={filters}
                values={filterValues}
                onApply={onFilterValuesChange}
                focusFilterId={focusFilterId}
            />
        </div>
    );
}
