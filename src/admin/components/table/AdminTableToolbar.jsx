import React from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
            className={`flex min-h-[4.5rem] flex-col gap-2 rounded-lg border border-border/70 bg-card px-3 py-2 ${className}`}
        >
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex min-w-0 flex-1 flex-col gap-2 lg:flex-row lg:items-center">
                    <Input
                        data-testid={searchTestId}
                        value={search}
                        onChange={(event) => onSearchChange?.(event.target.value)}
                        placeholder={searchPlaceholder}
                        className="h-10 w-full lg:max-w-xl"
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
                    <div className="flex flex-wrap items-center gap-2 lg:justify-end">
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
