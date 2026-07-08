import React from 'react';
import { Columns3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export default function AdminColumnMenu({
    columns = [],
    visibleColumns = [],
    onVisibleColumnsChange,
    label = 'Columns',
}) {
    const toggle = (key) => {
        onVisibleColumnsChange?.((prev) => {
            const current = Array.isArray(prev) ? prev : visibleColumns;
            return current.includes(key)
                ? current.filter((existing) => existing !== key)
                : [...current, key];
        });
    };

    return (
        <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
                <Button type="button" variant="outline" size="sm">
                    <Columns3 data-icon="inline-start" />
                    {label}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 data-open:zoom-in-100 data-closed:zoom-out-100">
                <DropdownMenuLabel>Columns</DropdownMenuLabel>
                {columns.map((column) => (
                    <DropdownMenuCheckboxItem
                        key={column.key}
                        checked={visibleColumns.includes(column.key)}
                        onCheckedChange={() => toggle(column.key)}
                    >
                        {column.label || column.key}
                    </DropdownMenuCheckboxItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
