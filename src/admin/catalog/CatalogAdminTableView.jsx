import React, { Suspense, useEffect, useMemo, useState } from 'react';
import BottomSheet from '../../shared/components/BottomSheet';
import ContentPreviewCard from '../components/ContentPreviewCard';
import { useWindowSize } from '../../shared/hooks/useWindowSize';
import { useCampaign } from '../../shared/context/CampaignContext';
import { useAppFeedback } from '../../shared/feedback/AppFeedback';
import { copyRef } from '../../shared/clipboard/refClipboard';
import { buildHideOverride, CATALOG_ENTRY_STATUS } from '../../shared/catalog/catalogEntryModel';
import { mergeCatalogDetailIntoEntry } from '../../shared/catalog/catalogDetailMerge';
import { selectCatalogEntryStates } from '../../shared/db/selectors/catalogOverrideSelectors';
import { Button } from '@/components/ui/button';
import {
    AdminPagination,
    AdminTableSurface,
    AdminTableToolbar,
    optionValue,
} from '../components/table';
import {
    getCatalogTableEntry,
    getStandardCatalogContextActions,
    useCatalogAdminTable,
} from './useCatalogAdminTable';

const STATUS_LABELS = Object.freeze({
    [CATALOG_ENTRY_STATUS.ORIGINAL]: 'Original',
    [CATALOG_ENTRY_STATUS.EDITED]: 'Edited',
    [CATALOG_ENTRY_STATUS.CUSTOM]: 'Custom',
    [CATALOG_ENTRY_STATUS.DELETED]: 'Deleted',
});

const CATALOG_STATUS_FILTER_ID = 'catalogStatus';
const DEFAULT_PAGE_SIZES = Object.freeze([25, 50, 100]);
const DEFAULT_VISIBLE_STATUSES = Object.freeze([
    CATALOG_ENTRY_STATUS.ORIGINAL,
    CATALOG_ENTRY_STATUS.EDITED,
    CATALOG_ENTRY_STATUS.CUSTOM,
]);
const DEFAULT_DETAIL_SOURCE_FILE = (entry) => entry?.sourceFile;

const CATALOG_STATUS_OPTIONS = Object.values(CATALOG_ENTRY_STATUS).map((status) => ({
    value: status,
    label: STATUS_LABELS[status] || status,
}));

export default function CatalogAdminTableView({
    catalogType,
    entityType = catalogType,
    title,
    staticItems = [],
    columns = [],
    defaultColumns = [],
    filters = [],
    EditorComponent,
    fetchDetailBySourceFile = null,
    detailSourceFile = DEFAULT_DETAIL_SOURCE_FILE,
    searchPlaceholder = 'Search...',
    newLabel = '+ New Entry',
    itemsPerPageOptions = DEFAULT_PAGE_SIZES,
    defaultItemsPerPage = 50,
    renderCell = defaultRenderCell,
    prepareEditorItem = defaultPrepareEditorItem,
}) {
    const { isMobile } = useWindowSize();
    const { capabilities, db, dataActions } = useCampaign();
    const { confirm, notifyError, notifySuccess } = useAppFeedback();

    const [itemsPerPage, setItemsPerPage] = useState(defaultItemsPerPage);
    const [visibleColumns, setVisibleColumns] = useState(defaultColumns.length ? defaultColumns : columns.map((column) => column.key));
    const [filterOpen, setFilterOpen] = useState(false);
    const [focusedFilterId, setFocusedFilterId] = useState(null);
    const [filterValues, setFilterValues] = useState(() => createDefaultDomainFilterValues(filters));
    const [loadedDetail, setLoadedDetail] = useState(null);
    const [detailLoading, setDetailLoading] = useState(false);

    const allEntryStates = useMemo(
        () => selectCatalogEntryStates(staticItems, db, catalogType),
        [catalogType, db, staticItems]
    );

    const filterDefinitions = useMemo(
        () => [
            ...filters.map((filter) => normalizeFilterDefinition(filter)),
            {
                id: CATALOG_STATUS_FILTER_ID,
                label: 'Catalog Status',
                type: 'multi',
                options: CATALOG_STATUS_OPTIONS.map((option) => ({
                    ...option,
                    testId: `catalog-status-${catalogType}-${option.value}`,
                })),
                defaultValue: DEFAULT_VISIBLE_STATUSES,
                valueLabel: (value) => Array.isArray(value)
                    ? value.map((status) => STATUS_LABELS[status] || status).join(', ')
                    : STATUS_LABELS[value] || value,
            },
        ],
        [catalogType, filters]
    );

    const domainFilteredStates = useMemo(() => {
        return allEntryStates.filter((state) => {
            const entry = getCatalogTableEntry(state);
            return filters.every((filter) => matchesDomainFilter(entry, state, filter, filterValues[filter.id]));
        });
    }, [allEntryStates, filters, filterValues]);

    const table = useCatalogAdminTable({
        entryStates: domainFilteredStates,
        itemsPerPage,
        searchKeys: ['name', 'id', '_id', 'sourceFile', 'overrideSourceFile', 'baseId', ...columns.map((column) => column.key)],
        onCopyReference: (ref, entryOrState) => {
            const entry = getCatalogTableEntry(entryOrState);
            copyRef(catalogType, { ...(entry || {}), catalogRef: ref });
            notifySuccess(`Reference copied: ${ref.label || entry?.name || title || catalogType}`);
        },
    });

    const statusValue = useMemo(
        () => Object.values(CATALOG_ENTRY_STATUS).filter((status) => table.statusFilters[status]),
        [table.statusFilters]
    );

    const toolbarFilterValues = useMemo(
        () => ({ ...filterValues, [CATALOG_STATUS_FILTER_ID]: statusValue }),
        [filterValues, statusValue]
    );

    const displayedColumns = useMemo(() => {
        return columns
            .filter((column) => visibleColumns.includes(column.key))
            .map((column) => ({
                ...column,
                filterable: Boolean(resolveFilterForColumn(column, filterDefinitions)),
            }));
    }, [columns, filterDefinitions, visibleColumns]);

    const previewItem = table.previewEntry;
    const previewSourceFile = previewItem ? detailSourceFile(previewItem) : null;

    useEffect(() => {
        const sourceFile = previewSourceFile;
        if (!fetchDetailBySourceFile || !sourceFile) {
            setLoadedDetail(null);
            setDetailLoading(false);
            return;
        }
        let cancelled = false;
        setLoadedDetail(null);
        setDetailLoading(true);
        fetchDetailBySourceFile(sourceFile)
            .then((detail) => {
                if (!cancelled) setLoadedDetail(detail);
            })
            .catch((err) => {
                if (!cancelled) {
                    console.error(`Failed to load ${catalogType} detail`, err);
                    setLoadedDetail(null);
                }
            })
            .finally(() => {
                if (!cancelled) setDetailLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [catalogType, fetchDetailBySourceFile, previewSourceFile]);

    const handleFilterValuesChange = (nextValues) => {
        const selectedStatuses = Array.isArray(nextValues?.[CATALOG_STATUS_FILTER_ID])
            ? nextValues[CATALOG_STATUS_FILTER_ID]
            : DEFAULT_VISIBLE_STATUSES;
        table.setStatusFilters(
            Object.fromEntries(
                Object.values(CATALOG_ENTRY_STATUS).map((status) => [status, selectedStatuses.includes(status)])
            )
        );
        setFilterValues(createDomainFilterValues(filters, nextValues || {}));
        table.setPage(1);
    };

    const handleHeaderFilter = (column) => {
        const filter = resolveFilterForColumn(column, filterDefinitions);
        if (!filter) return;
        setFocusedFilterId(filter.id);
        setFilterOpen(true);
    };

    const handleSaveCatalogEntry = async (override) => {
        await dataActions.catalog.saveCatalogOverride(override);
    };

    const handleDelete = async (entryOrState) => {
        const state = entryOrState?.status ? entryOrState : null;
        const entry = getCatalogTableEntry(entryOrState) || getCatalogTableEntry(state);
        if (!entry) return;
        const isCustom = state?.status === CATALOG_ENTRY_STATUS.CUSTOM || (entry.isCustom && !entry.overrideSourceFile && !entry.sourceFile);
        const isCampaignEntry = Boolean(entry.campaignId);
        const overrideId = entry.catalogOverrideId || state?.overrideId;
        const confirmed = await confirm({
            title: `Delete ${title || catalogType}`,
            message: isCustom
                ? `Delete custom ${catalogType} "${entry.name}"?`
                : `Hide static ${catalogType} "${entry.name}" from default catalog lists?`,
            confirmLabel: 'Delete',
            danger: true,
        });
        if (!confirmed) return;
        try {
            if (isCustom && isCampaignEntry && overrideId) {
                await dataActions.catalog.deleteCatalogOverride(overrideId);
            } else {
                await dataActions.catalog.saveCatalogOverride(buildHideOverride(catalogType, entry));
            }
            notifySuccess(isCustom ? `${entry.name} deleted.` : `${entry.name} hidden.`);
        } catch (err) {
            console.error(err);
            notifyError(err);
        }
    };

    const handleContextAction = (action, state) => {
        if (action.id === 'preview') return table.preview(state);
        if (action.id === 'edit') return table.editEntry(state);
        if (action.id === 'clone') return table.cloneEntry(state);
        if (action.id === 'delete') return handleDelete(state);
        if (action.id === 'copyReference') return table.copyEntryReference(state);
        if (action.id === 'promoteGlobal') return handlePromoteGlobal(state);
        return null;
    };

    const handlePromoteGlobal = async (entryOrState) => {
        const entry = getCatalogTableEntry(entryOrState);
        if (!entry?.campaignId || !capabilities?.canPromoteGlobalCatalog) return;
        const accepted = await confirm({
            title: 'Promote to global catalog',
            message: `Make "${entry.name || entry.label}" available outside this campaign?`,
            confirmLabel: 'Promote',
        });
        if (!accepted) return;
        try {
            await dataActions.catalog.promoteToGlobalCatalog(entry);
            notifySuccess(`${entry.name || entry.label} promoted to the global catalog.`);
        } catch (error) {
            notifyError(error);
        }
    };

    const editorMode = table.editorMode;
    if (editorMode && EditorComponent) {
        const editorInitialItem = prepareEditorItem(table.editingEntry, editorMode);
        return (
            <Suspense fallback={null}>
                <EditorComponent
                    catalogType={catalogType}
                    editorMode={editorMode}
                    baseEntry={table.editingEntry || null}
                    initialItem={editorMode === 'create' ? null : editorInitialItem}
                    onSave={() => table.closeEditor()}
                    onCancel={() => table.closeEditor()}
                    onSaveCatalogEntry={handleSaveCatalogEntry}
                    onSaveToDb={handleSaveCatalogEntry}
                    dbOnly
                />
            </Suspense>
        );
    }

    const previewContent = previewItem ? (
        <ContentPreviewCard
            item={loadedDetail ? mergeCatalogDetailIntoEntry(loadedDetail, previewItem) : previewItem}
            entityType={entityType}
            isLoading={detailLoading}
            onEdit={() => table.editEntry(previewItem)}
            onClose={() => table.closePreview()}
        />
    ) : null;

    return (
        <div
            className="flex h-[calc(100vh-100px)] min-h-0 flex-col gap-3 overflow-hidden p-2"
            data-testid={`catalog-admin-${catalogType}`}
        >
            <AdminTableToolbar
                search={table.search}
                searchTestId={`catalog-search-${catalogType}`}
                onSearchChange={(value) => {
                    table.setSearch(value);
                    table.setPage(1);
                }}
                searchPlaceholder={searchPlaceholder}
                filters={filterDefinitions}
                filterValues={toolbarFilterValues}
                onFilterValuesChange={handleFilterValuesChange}
                filterOpen={filterOpen}
                onFilterOpenChange={setFilterOpen}
                focusFilterId={focusedFilterId}
                columns={columns}
                visibleColumns={visibleColumns}
                onVisibleColumnsChange={setVisibleColumns}
                resultMeta={`${table.sortedStates.length}/${domainFilteredStates.length} ${title || catalogType}${table.sortedStates.length === 1 ? '' : 's'}`}
                primaryActions={(
                    <Button type="button" size="sm" onClick={() => table.createEntry()}>
                        {newLabel}
                    </Button>
                )}
            />

            <div className="flex min-h-0 flex-1 overflow-hidden">
                <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
                    <AdminTableSurface
                        tableTestId={`catalog-table-${catalogType}`}
                        columns={displayedColumns}
                        rows={table.paginatedStates}
                        sortConfig={table.sortConfig}
                        onSort={table.setSort}
                        onHeaderFilter={handleHeaderFilter}
                        actionTestIdPrefix={`catalog-action-${catalogType}`}
                        getRowKey={(state, index) => getStateRowKey(state, index)}
                        getRowTestId={(state, index) => `catalog-row-${catalogType}-${getStateTestId(state, index)}`}
                        getCellTestId={(state, column, index) => `catalog-cell-${catalogType}-${getStateTestId(state, index)}-${column.key}`}
                        getRowActions={(state) => {
                            const entry = getCatalogTableEntry(state);
                            const actions = [...getStandardCatalogContextActions()];
                            if (capabilities?.canPromoteGlobalCatalog && entry?.campaignId) {
                                actions.push({ id: 'promoteGlobal', label: 'Promote to Global' });
                            }
                            return actions.map((action) => ({
                                ...action,
                                onSelect: () => handleContextAction(action, state),
                            }));
                        }}
                        isRowSelected={(state) => isSameCatalogEntry(previewItem, getCatalogTableEntry(state))}
                        rowClassName={(state) => getCatalogTableEntry(state)?.catalogEntryStatus === CATALOG_ENTRY_STATUS.DELETED ? 'opacity-[0.65]' : ''}
                        onRowClick={(_event, state) => {
                            table.selectEntry(state);
                            if (!isMobile) table.preview(state);
                        }}
                        onRowDoubleClick={(_event, state) => {
                            if (isMobile) table.preview(state);
                            else table.editEntry(state);
                        }}
                        renderCell={({ row: state, column }) => {
                            const entry = getCatalogTableEntry(state);
                            const content = renderCell({ entry, state, column });
                            const isPrimaryColumn = column.key === 'name' || column.key === displayedColumns[0]?.key;
                            if (!entry?.isPlayerAuthored || !isPrimaryColumn) return content;
                            return (
                                <span className="inline-flex items-center gap-2">
                                    <span>{content}</span>
                                    <span className="rounded border border-emerald-500/50 bg-emerald-500/10 px-1.5 py-0.5 text-[0.68rem] font-semibold uppercase text-emerald-300">Player</span>
                                </span>
                            );
                        }}
                    />
                    <AdminPagination
                        page={table.page}
                        totalPages={table.totalPages}
                        total={table.sortedStates.length}
                        pageSize={itemsPerPage}
                        pageSizeOptions={itemsPerPageOptions}
                        onPageChange={table.setPage}
                        onPageSizeChange={(nextSize) => {
                            setItemsPerPage(nextSize);
                            table.setPage(1);
                        }}
                        label={`${title || catalogType}${table.sortedStates.length === 1 ? '' : 's'}`}
                    />
                </div>

                {!isMobile && previewItem && (
                    <div className="ml-3 flex w-[26rem] min-w-[26rem] flex-col overflow-hidden rounded-lg border border-border/70 bg-card p-4">
                        <div className="mb-2 flex items-center justify-between">
                            <h4 className="m-0 text-sm font-medium text-muted-foreground">Preview</h4>
                            <Button type="button" variant="ghost" size="sm" onClick={() => table.closePreview()}>Close</Button>
                        </div>
                        <div className="min-h-0 overflow-auto">
                            {previewContent}
                        </div>
                    </div>
                )}
            </div>

            {isMobile && (
                <BottomSheet
                    isOpen={!!previewItem}
                    onClose={() => table.closePreview()}
                    title={previewItem?.name || 'Preview'}
                    height="85vh"
                >
                    {previewContent}
                </BottomSheet>
            )}
        </div>
    );
}

function defaultRenderCell({ entry, column }) {
    const value = entry?.[column.key];
    if (Array.isArray(value)) return value.length ? value.join(', ') : '-';
    if (value === true) return 'Yes';
    if (value === false) return 'No';
    return value ?? '-';
}

function defaultPrepareEditorItem(entry, editorMode) {
    if (editorMode !== 'clone' || !entry) return entry;
    return {
        ...entry,
        id: null,
        _id: null,
        catalogOverrideId: null,
        isCustom: true,
        name: `${entry.name || 'Entry'} (Copy)`,
    };
}

function createDefaultDomainFilterValues(filters) {
    return Object.fromEntries(filters.map((filter) => [filter.id, cloneDefaultFilterValue(filter)]));
}

function createDomainFilterValues(filters, values) {
    return Object.fromEntries(filters.map((filter) => [filter.id, values[filter.id] ?? cloneDefaultFilterValue(filter)]));
}

function cloneDefaultFilterValue(filter) {
    if (filter.defaultValue !== undefined) {
        return Array.isArray(filter.defaultValue) ? [...filter.defaultValue] : filter.defaultValue;
    }
    return filter.type === 'boolean' ? null : [];
}

function normalizeFilterDefinition(filter) {
    return {
        ...filter,
        type: filter.type || 'multi',
        defaultValue: filter.defaultValue ?? (filter.type === 'boolean' ? null : []),
    };
}

function matchesDomainFilter(entry, state, filter, rawSelected) {
    if (filter.type === 'text') {
        const value = String(rawSelected || '').trim().toLowerCase();
        if (!value) return true;
        const target = getFilterValue(entry, filter);
        return String(target || '').toLowerCase().includes(value);
    }
    if (filter.type === 'boolean') {
        if (rawSelected !== true && rawSelected !== false) return true;
        const target = Boolean(getFilterValue(entry, filter));
        return target === rawSelected;
    }
    const selected = Array.isArray(rawSelected) ? rawSelected : [];
    if (!selected.length) return true;
    if (filter.predicate) return filter.predicate(entry, selected, state);
    const value = getFilterValue(entry, filter);
    if (Array.isArray(value)) {
        return filter.matchAll
            ? selected.every((option) => value.includes(option))
            : selected.some((option) => value.includes(option));
    }
    return selected.includes(value);
}

function getFilterValue(entry, filter) {
    return filter.valueGetter ? filter.valueGetter(entry) : entry?.[filter.field || filter.id];
}

function resolveFilterForColumn(column, filters) {
    return filters.find((filter) => (
        filter.columnKey === column.key
        || filter.field === column.key
        || filter.id === column.key
        || (filter.options || []).some((option) => optionValue(option) === column.key)
    ));
}

function getStateRowKey(state, index) {
    const entry = getCatalogTableEntry(state);
    return state?.key || entry?.catalogEntryKey || entry?.sourceFile || entry?.overrideSourceFile || entry?.id || entry?._id || entry?.name || index;
}

function getStateTestId(state, index) {
    const entry = getCatalogTableEntry(state);
    return toTestId(state?.key || entry?.catalogEntryKey || entry?.sourceFile || entry?.overrideSourceFile || entry?.id || entry?._id || entry?.name || index);
}

function isSameCatalogEntry(left, right) {
    if (!left || !right) return false;
    const leftKey = left.catalogEntryKey || left.sourceFile || left.overrideSourceFile || left.id || left._id || left.name;
    const rightKey = right.catalogEntryKey || right.sourceFile || right.overrideSourceFile || right.id || right._id || right.name;
    return leftKey && rightKey && leftKey === rightKey;
}

function toTestId(value) {
    return String(value || 'entry')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'entry';
}
