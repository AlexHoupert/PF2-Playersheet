import React from 'react';
import AdminContextMenu from './AdminContextMenu';
import { cn } from '@/lib/utils';

export default function AdminTableSurface({
    columns = [],
    rows = [],
    getRowKey = (_row, index) => index,
    getRowTestId,
    getCellTestId,
    actionTestIdPrefix,
    renderCell,
    sortConfig = {},
    onSort,
    onHeaderFilter,
    getRowActions,
    onRowClick,
    onRowDoubleClick,
    isRowSelected,
    rowClassName,
    getRowProps,
    getCellProps,
    onRowContextMenu,
    emptyLabel = 'No entries found.',
    tableTestId,
    className,
    ...surfaceProps
}) {
    return (
        <div data-admin-table-surface className={cn('min-h-0 flex-1 overflow-auto rounded-lg border border-border/70 bg-card', className)} {...surfaceProps}>
            <table data-testid={tableTestId} className="w-full border-collapse text-sm">
                <thead className="sticky top-0 z-10 bg-secondary text-secondary-foreground">
                    <tr>
                        {columns.map((column) => (
                            <HeaderCell
                                key={column.key}
                                column={column}
                                sortConfig={sortConfig}
                                onSort={onSort}
                                onHeaderFilter={onHeaderFilter}
                            />
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.length ? rows.map((row, index) => {
                        const rowKey = getRowKey(row, index);
                        const rowTestId = getRowTestId?.(row, index);
                        const selected = Boolean(isRowSelected?.(row, index));
                        const rowProps = getRowProps?.(row, index) || {};
                        const actions = getRowActions?.(row, index) || [];
                        const rowNode = (
                            <tr
                                key={rowKey}
                                data-testid={rowTestId}
                                data-state={selected ? 'selected' : undefined}
                                className={cn(
                                    'cursor-pointer bg-card transition-colors hover:bg-accent/55 data-[state=selected]:bg-blue-500/25',
                                    rowClassName?.(row, index)
                                )}
                                onClick={(event) => onRowClick?.(event, row, index)}
                                onDoubleClick={(event) => onRowDoubleClick?.(event, row, index)}
                                onContextMenu={(event) => onRowContextMenu?.(event, row, index)}
                                tabIndex={actions.length ? 0 : undefined}
                                {...rowProps}
                            >
                                {columns.map((column) => {
                                    const cellProps = getCellProps?.(row, column, index) || {};
                                    return (
                                        <td
                                            key={column.key}
                                            data-testid={getCellTestId?.(row, column, index)}
                                            data-priority={column.priority}
                                            className={cn('px-3 py-2 align-middle text-foreground', column.cellClassName)}
                                            {...cellProps}
                                        >
                                            {renderCell ? renderCell({ row, column, index }) : row?.[column.key]}
                                        </td>
                                    );
                                })}
                            </tr>
                        );

                        if (!actions.length) return rowNode;
                        return (
                            <AdminContextMenu key={rowKey} actions={actions} actionTestIdPrefix={actionTestIdPrefix}>
                                {rowNode}
                            </AdminContextMenu>
                        );
                    }) : (
                        <tr>
                            <td colSpan={Math.max(1, columns.length)} className="h-24 px-3 py-8 text-center text-muted-foreground">
                                {emptyLabel}
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );
}

function HeaderCell({ column, sortConfig, onSort, onHeaderFilter }) {
    const sortable = column.sortable !== false;
    const sorted = sortConfig?.key === column.key;
    const label = column.label || column.key;
    const th = (
        <th
            data-priority={column.priority}
            className={cn('px-3 py-2 text-left font-medium text-foreground', sortable && 'cursor-pointer select-none', column.headerClassName)}
            onClick={() => sortable && onSort?.(column.key)}
        >
            <span className="inline-flex items-center gap-1">
                {label}
                {sorted ? (sortConfig.direction === 'asc' ? '▲' : '▼') : null}
            </span>
        </th>
    );

    if (!onHeaderFilter || column.filterable === false) return th;

    return (
        <AdminContextMenu
            actions={[{
                id: 'filter-column',
                label: `Filter ${label}`,
                onSelect: () => onHeaderFilter(column),
            }]}
        >
            {th}
        </AdminContextMenu>
    );
}
