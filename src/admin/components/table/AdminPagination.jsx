import React, { useMemo } from 'react';
import { ChevronsLeft, ChevronsRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Pagination,
    PaginationContent,
    PaginationEllipsis,
    PaginationItem,
    PaginationLink,
    PaginationNext,
    PaginationPrevious,
} from '@/components/ui/pagination';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

export default function AdminPagination({
    page = 1,
    totalPages = 1,
    total = 0,
    pageSize = 50,
    pageSizeOptions = [25, 50, 100],
    onPageChange,
    onPageSizeChange,
    label = 'entries',
}) {
    const safeTotalPages = Math.max(1, Number(totalPages) || 1);
    const safePage = Math.min(Math.max(1, Number(page) || 1), safeTotalPages);
    const pages = useMemo(() => getVisiblePages(safePage, safeTotalPages), [safePage, safeTotalPages]);
    const canPrevious = safePage > 1;
    const canNext = safePage < safeTotalPages;

    const goToPage = (event, nextPage) => {
        event?.preventDefault?.();
        const bounded = Math.min(Math.max(1, nextPage), safeTotalPages);
        if (bounded !== safePage) onPageChange?.(bounded);
    };

    return (
        <div className="flex flex-col gap-2 border-t border-border/70 bg-card px-3 py-2 text-sm text-muted-foreground lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-1">
                <span className="font-medium text-foreground">{total}</span>
                <span>{label}</span>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3">
                <div className="flex items-center gap-2">
                    <span className="hidden text-sm font-medium text-foreground md:inline">Rows</span>
                    <Select value={String(pageSize)} onValueChange={(raw) => onPageSizeChange?.(Number(raw))}>
                        <SelectTrigger className="h-8 w-[5rem]">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent align="end">
                            {pageSizeOptions.map((option) => (
                                <SelectItem key={option} value={String(option)}>{option}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <Pagination className="mx-0 w-auto">
                    <PaginationContent>
                        <PaginationItem>
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                disabled={!canPrevious}
                                onClick={(event) => goToPage(event, 1)}
                                aria-label="Go to first page"
                            >
                                <ChevronsLeft />
                            </Button>
                        </PaginationItem>
                        <PaginationItem>
                            <PaginationPrevious
                                href="#"
                                text="Prev"
                                aria-disabled={!canPrevious}
                                className={!canPrevious ? 'pointer-events-none opacity-50' : ''}
                                onClick={(event) => goToPage(event, safePage - 1)}
                            />
                        </PaginationItem>
                        {pages.map((item, index) => (
                            item === 'ellipsis' ? (
                                <PaginationItem key={`ellipsis-${index}`}>
                                    <PaginationEllipsis />
                                </PaginationItem>
                            ) : (
                                <PaginationItem key={item}>
                                    <PaginationLink
                                        href="#"
                                        isActive={item === safePage}
                                        onClick={(event) => goToPage(event, item)}
                                    >
                                        {item}
                                    </PaginationLink>
                                </PaginationItem>
                            )
                        ))}
                        <PaginationItem>
                            <PaginationNext
                                href="#"
                                text="Next"
                                aria-disabled={!canNext}
                                className={!canNext ? 'pointer-events-none opacity-50' : ''}
                                onClick={(event) => goToPage(event, safePage + 1)}
                            />
                        </PaginationItem>
                        <PaginationItem>
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                disabled={!canNext}
                                onClick={(event) => goToPage(event, safeTotalPages)}
                                aria-label="Go to last page"
                            >
                                <ChevronsRight />
                            </Button>
                        </PaginationItem>
                    </PaginationContent>
                </Pagination>
            </div>
        </div>
    );
}

export function getVisiblePages(page, totalPages) {
    if (totalPages <= 7) {
        return Array.from({ length: totalPages }, (_, index) => index + 1);
    }

    if (page <= 4) return [1, 2, 3, 4, 5, 'ellipsis', totalPages];
    if (page >= totalPages - 3) {
        return [1, 'ellipsis', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    }
    return [1, 'ellipsis', page - 1, page, page + 1, 'ellipsis', totalPages];
}
