import React, { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { cn } from '@/lib/utils';
import AdminTableSurface from './AdminTableSurface';
import { filterAndSortSubtableRows } from './adminSubtableModel';

export default function AdminSubtable({
    title,
    columns = [],
    rows = [],
    getRowKey,
    getRowTestId,
    getCellTestId,
    actionTestIdPrefix,
    renderCell,
    getRowActions,
    getRowProps,
    onRowClick,
    onRowDoubleClick,
    isRowSelected,
    search: controlledSearch,
    onSearchChange,
    searchPlaceholder = 'Search...',
    searchFields,
    sortConfig: controlledSort,
    onSort: controlledOnSort,
    actions,
    emptyLabel,
    className,
    tableTestId,
    onDrop,
    onDragOver,
}) {
    const [localSearch, setLocalSearch] = useState('');
    const [localSort, setLocalSort] = useState({ key: columns[0]?.key || '', direction: 'asc' });
    const search = controlledSearch ?? localSearch;
    const sortConfig = controlledSort ?? localSort;
    const setSearch = onSearchChange || setLocalSearch;
    const onSort = controlledOnSort || ((key) => setLocalSort((previous) => ({
        key,
        direction: previous.key === key && previous.direction === 'asc' ? 'desc' : 'asc',
    })));
    const visibleRows = useMemo(
        () => filterAndSortSubtableRows(rows, columns, search, sortConfig, searchFields),
        [columns, rows, search, searchFields, sortConfig]
    );

    return (
        <section
            className={cn('flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-border/70 bg-card', className)}
            onDrop={onDrop}
            onDragOver={onDragOver}
        >
            <div className="flex flex-wrap items-center gap-2 border-b border-border/70 bg-secondary/70 p-2">
                {title ? <h3 className="m-0 min-w-0 flex-1 truncate text-sm font-semibold text-primary">{title}</h3> : null}
                {actions}
            </div>
            <div className="border-b border-border/70 p-2">
                <InputGroup className="h-8">
                    <InputGroupAddon><Search /></InputGroupAddon>
                    <InputGroupInput
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder={searchPlaceholder}
                        aria-label={searchPlaceholder}
                    />
                </InputGroup>
            </div>
            <AdminTableSurface
                className="rounded-none border-0"
                columns={columns}
                rows={visibleRows}
                getRowKey={getRowKey}
                getRowTestId={getRowTestId}
                getCellTestId={getCellTestId}
                actionTestIdPrefix={actionTestIdPrefix}
                renderCell={renderCell}
                getRowActions={getRowActions}
                getRowProps={getRowProps}
                onRowClick={onRowClick}
                onRowDoubleClick={onRowDoubleClick}
                isRowSelected={isRowSelected}
                sortConfig={sortConfig}
                onSort={onSort}
                emptyLabel={emptyLabel}
                tableTestId={tableTestId}
            />
            <div className="border-t border-border/70 px-3 py-1.5 text-xs text-muted-foreground">
                {visibleRows.length}/{rows.length}
            </div>
        </section>
    );
}
