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
    emptyLabel = 'No entries found.',
    tableTestId,
}) {
    return (
        <div data-admin-table-surface className="min-h-0 flex-1 overflow-auto rounded-lg border border-border/70 bg-card">
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
                            >
                                {columns.map((column) => (
                                    <td
                                        key={column.key}
                                        data-testid={getCellTestId?.(row, column, index)}
                                        className={cn('px-3 py-2 align-middle text-foreground', column.cellClassName)}
                                    >
                                        {renderCell ? renderCell({ row, column, index }) : row?.[column.key]}
                                    </td>
                                ))}
                            </tr>
                        );

                        const actions = getRowActions?.(row, index) || [];
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
            className={cn('px-3 py-2 text-left font-medium text-foreground', sortable && 'cursor-pointer select-none')}
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
