import React, { useEffect, useMemo, useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Drawer,
    DrawerClose,
    DrawerContent,
    DrawerDescription,
    DrawerFooter,
    DrawerHeader,
    DrawerTitle,
} from '@/components/ui/drawer';
import {
    Field,
    FieldContent,
    FieldDescription,
    FieldGroup,
    FieldLabel,
    FieldTitle,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
    cloneFilterValue,
    countActiveFilters,
    isFilterValueActive,
    normalizeFilterValues,
    optionLabel,
    optionValue,
    removeFilterValue,
    resetFilterValues,
} from './adminTableFilters';

export default function AdminFilterDrawer({
    open,
    onOpenChange,
    filters = [],
    values = {},
    onApply,
    focusFilterId = null,
}) {
    const [draft, setDraft] = useState(() => normalizeFilterValues(filters, values));
    const firstFilterId = filters[0]?.id || '';
    const [activeFilterId, setActiveFilterId] = useState(focusFilterId || firstFilterId);

    useEffect(() => {
        if (!open) return;
        setDraft(normalizeFilterValues(filters, values));
        setActiveFilterId(focusFilterId || firstFilterId);
    }, [filters, firstFilterId, focusFilterId, open, values]);

    useEffect(() => {
        if (!filters.some((filter) => filter.id === activeFilterId)) {
            setActiveFilterId(firstFilterId);
        }
    }, [activeFilterId, filters, firstFilterId]);

    const activeFilter = filters.find((filter) => filter.id === activeFilterId) || filters[0];
    const activeCount = useMemo(() => countActiveFilters(filters, draft), [draft, filters]);

    const setFilterValue = (filterId, nextValue) => {
        setDraft((prev) => ({ ...prev, [filterId]: cloneFilterValue(nextValue) }));
    };

    const clearFilter = (filterId) => {
        setDraft((prev) => removeFilterValue(filters, prev, filterId));
    };

    const apply = () => {
        onApply?.(draft);
        onOpenChange?.(false);
    };

    const resetAll = () => setDraft(resetFilterValues(filters));

    return (
        <Drawer
            open={open}
            onOpenChange={onOpenChange}
            direction="right"
            modal={false}
            shouldScaleBackground={false}
            noBodyStyles
        >
            <DrawerContent className="!w-[min(56rem,calc(100vw-2rem))] !max-w-[56rem] border-border/70 bg-card text-card-foreground">
                <DrawerHeader className="border-b border-border/70 bg-background/80">
                    <DrawerTitle className="flex items-center gap-2">
                        <SlidersHorizontal data-icon="inline-start" />
                        Filters{activeCount ? ` (${activeCount})` : ''}
                    </DrawerTitle>
                    <DrawerDescription>
                        Choose a filter on the left and set its options on the right.
                    </DrawerDescription>
                </DrawerHeader>

                <div className="grid min-h-[24rem] flex-1 overflow-hidden md:grid-cols-[minmax(13rem,1fr)_minmax(0,2fr)]">
                    <div className="flex min-h-0 flex-col gap-1 overflow-auto border-b border-border/70 bg-background/70 p-3 text-foreground md:border-b-0 md:border-r">
                        {filters.map((filter) => {
                            const selected = filter.id === activeFilter?.id;
                            const count = isFilterValueActive(draft[filter.id], filter.defaultValue) ? 1 : 0;
                            return (
                                <button
                                    key={filter.id}
                                    type="button"
                                    className={cn(
                                        'flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors',
                                        selected
                                            ? 'bg-primary/15 text-foreground ring-1 ring-primary/40'
                                            : 'text-muted-foreground hover:bg-accent/70 hover:text-accent-foreground'
                                    )}
                                    onClick={() => setActiveFilterId(filter.id)}
                                >
                                    <span className="min-w-0 flex-1 truncate">{filter.label}</span>
                                    {count ? <Badge variant="secondary">{count}</Badge> : null}
                                </button>
                            );
                        })}
                    </div>

                    <div className="min-h-0 overflow-auto bg-card p-4 text-card-foreground">
                        {activeFilter ? (
                            <FieldGroup className="gap-4">
                                <Field>
                                    <FieldTitle>{activeFilter.label}</FieldTitle>
                                    {activeFilter.description ? (
                                        <FieldDescription>{activeFilter.description}</FieldDescription>
                                    ) : null}
                                </Field>
                                <FilterEditor
                                    filter={activeFilter}
                                    value={draft[activeFilter.id]}
                                    onChange={(next) => setFilterValue(activeFilter.id, next)}
                                    onClear={() => clearFilter(activeFilter.id)}
                                />
                                <div className="flex justify-end">
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => clearFilter(activeFilter.id)}
                                        disabled={!isFilterValueActive(draft[activeFilter.id], activeFilter.defaultValue)}
                                    >
                                        Reset filter
                                    </Button>
                                </div>
                            </FieldGroup>
                        ) : (
                            <p className="text-sm text-muted-foreground">No filters available.</p>
                        )}
                    </div>
                </div>

                <DrawerFooter className="border-t border-border/70 bg-background/80">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-2">
                            <Button type="button" size="sm" onClick={apply}>Apply</Button>
                            <DrawerClose asChild>
                                <Button type="button" variant="outline" size="sm">Cancel</Button>
                            </DrawerClose>
                        </div>
                        <Button type="button" variant="ghost" size="sm" onClick={resetAll}>
                            Reset all
                        </Button>
                    </div>
                </DrawerFooter>
            </DrawerContent>
        </Drawer>
    );
}

function FilterEditor({ filter, value, onChange, onClear }) {
    if (filter.type === 'boolean') {
        return (
            <FieldGroup className="gap-2">
                {[
                    { label: 'Any', value: filter.defaultValue },
                    { label: 'Yes', value: true },
                    { label: 'No', value: false },
                ].map((option) => (
            <Field key={option.label} orientation="horizontal" className="rounded-md px-2 py-1 hover:bg-accent/50">
                        <Checkbox
                            checked={value === option.value}
                            onCheckedChange={() => onChange(option.value)}
                        />
                        <FieldContent>
                            <FieldLabel>{option.label}</FieldLabel>
                        </FieldContent>
                    </Field>
                ))}
            </FieldGroup>
        );
    }

    if (filter.type === 'text') {
        return (
            <Field>
                <FieldLabel>{filter.label}</FieldLabel>
                <Input
                    placeholder={filter.placeholder || `Filter ${filter.label}...`}
                    value={value || ''}
                    onChange={(event) => {
                        const next = event.target.value;
                        if (next) onChange(next);
                        else onClear();
                    }}
                />
            </Field>
        );
    }

    const selected = Array.isArray(value) ? value : [];
    return (
        <FieldGroup className="max-h-[22rem] gap-1 overflow-auto rounded-md border border-border/70 bg-background/60 p-2">
            {(filter.options || []).map((option) => {
                const raw = optionValue(option);
                const checked = selected.includes(raw);
                const testId = option && typeof option === 'object' ? option.testId : undefined;
                return (
                    <Field
                        key={String(raw)}
                        orientation="horizontal"
                        className={cn('rounded-md px-2 py-1 hover:bg-accent/50', checked && 'bg-primary/15 text-foreground')}
                    >
                        <Checkbox
                            data-testid={testId}
                            checked={checked}
                            onCheckedChange={(nextChecked) => {
                                const next = nextChecked
                                    ? [...selected, raw]
                                    : selected.filter((item) => item !== raw);
                                onChange(next);
                            }}
                        />
                        <FieldContent>
                            <FieldLabel>{optionLabel(filter, raw)}</FieldLabel>
                        </FieldContent>
                    </Field>
                );
            })}
        </FieldGroup>
    );
}
