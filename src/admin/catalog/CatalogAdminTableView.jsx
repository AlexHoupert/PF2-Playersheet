import React, { Suspense, useEffect, useMemo, useState } from 'react';
import MultiSelectDropdown from '../../shared/components/MultiSelectDropdown';
import BottomSheet from '../../shared/components/BottomSheet';
import ContentPreviewCard from '../components/ContentPreviewCard';
import { useWindowSize } from '../../shared/hooks/useWindowSize';
import { useCampaign } from '../../shared/context/CampaignContext';
import { useAppFeedback } from '../../shared/feedback/AppFeedback';
import { copyRef } from '../../shared/clipboard/refClipboard';
import { buildHideOverride, CATALOG_ENTRY_STATUS } from '../../shared/catalog/catalogEntryModel';
import { selectCatalogEntryStates } from '../../shared/db/selectors/catalogOverrideSelectors';
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

const DEFAULT_PAGE_SIZES = Object.freeze([25, 50, 100]);

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
    detailSourceFile = (entry) => entry?.sourceFile,
    searchPlaceholder = 'Search...',
    newLabel = '+ New Entry',
    itemsPerPageOptions = DEFAULT_PAGE_SIZES,
    defaultItemsPerPage = 50,
    renderCell = defaultRenderCell,
    prepareEditorItem = defaultPrepareEditorItem,
}) {
    const { isMobile } = useWindowSize();
    const { db, dataActions } = useCampaign();
    const { confirm, notifyError, notifySuccess } = useAppFeedback();

    const [itemsPerPage, setItemsPerPage] = useState(defaultItemsPerPage);
    const [visibleColumns, setVisibleColumns] = useState(defaultColumns.length ? defaultColumns : columns.map((column) => column.key));
    const [showColSelector, setShowColSelector] = useState(false);
    const [filterValues, setFilterValues] = useState(() => Object.fromEntries(filters.map((filter) => [filter.id, []])));
    const [loadedDetail, setLoadedDetail] = useState(null);

    const allEntryStates = useMemo(
        () => selectCatalogEntryStates(staticItems, db, catalogType),
        [catalogType, db, staticItems]
    );

    const domainFilteredStates = useMemo(() => {
        return allEntryStates.filter((state) => {
            const entry = getCatalogTableEntry(state);
            return filters.every((filter) => {
                const selected = filterValues[filter.id] || [];
                if (!selected.length) return true;
                if (filter.predicate) return filter.predicate(entry, selected, state);
                const value = entry?.[filter.field || filter.id];
                if (Array.isArray(value)) return filter.matchAll
                    ? selected.every((option) => value.includes(option))
                    : selected.some((option) => value.includes(option));
                return selected.includes(value);
            });
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

    const previewItem = table.previewEntry;

    useEffect(() => {
        const sourceFile = detailSourceFile(previewItem);
        if (!fetchDetailBySourceFile || !sourceFile) {
            setLoadedDetail(null);
            return;
        }
        let cancelled = false;
        setLoadedDetail(null);
        fetchDetailBySourceFile(sourceFile)
            .then((detail) => {
                if (!cancelled) setLoadedDetail(detail);
            })
            .catch((err) => {
                if (!cancelled) {
                    console.error(`Failed to load ${catalogType} detail`, err);
                    setLoadedDetail(null);
                }
            });
        return () => {
            cancelled = true;
        };
    }, [catalogType, detailSourceFile, fetchDetailBySourceFile, previewItem]);

    const setFilter = (filterId, next) => {
        setFilterValues((prev) => ({ ...prev, [filterId]: next }));
        table.setPage(1);
    };

    const handleSaveCatalogEntry = async (override) => {
        await dataActions.catalogOverride.saveCatalogOverride(override);
    };

    const handleDelete = async (entryOrState) => {
        const state = entryOrState?.status ? entryOrState : table.contextMenu?.state;
        const entry = getCatalogTableEntry(entryOrState) || getCatalogTableEntry(state);
        if (!entry) return;
        const isCustom = state?.status === CATALOG_ENTRY_STATUS.CUSTOM || (entry.isCustom && !entry.overrideSourceFile && !entry.sourceFile);
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
            if (isCustom && entry.catalogOverrideId) {
                await dataActions.catalogOverride.deleteCatalogOverride(entry.catalogOverrideId);
            } else {
                await dataActions.catalogOverride.saveCatalogOverride(buildHideOverride(catalogType, entry));
            }
            table.closeContextMenu();
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
        return null;
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
            item={loadedDetail || previewItem}
            entityType={entityType}
            onEdit={() => table.editEntry(previewItem)}
            onClose={() => table.closePreview()}
        />
    ) : null;

    return (
        <div className="admin-layout" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
            <div style={{ padding: 10, background: '#222', borderBottom: '1px solid #444', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <input
                    className="modal-input"
                    placeholder={searchPlaceholder}
                    value={table.search}
                    onChange={(event) => {
                        table.setSearch(event.target.value);
                        table.setPage(1);
                    }}
                    style={{ width: 200 }}
                />

                <button className="btn-add-condition" style={{ margin: 0, width: 'auto', background: '#4caf50' }} onClick={() => table.createEntry()}>
                    {newLabel}
                </button>

                {filters.map((filter) => (
                    <MultiSelectDropdown
                        key={filter.id}
                        label={filter.label}
                        options={filter.options || []}
                        selected={filterValues[filter.id] || []}
                        onChange={(next) => setFilter(filter.id, next)}
                    />
                ))}

                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                    {Object.entries(STATUS_LABELS).map(([status, label]) => (
                        <label key={status} style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#ccc', fontSize: '0.85rem' }}>
                            <input
                                type="checkbox"
                                checked={Boolean(table.statusFilters[status])}
                                onChange={(event) => table.setStatusFilter(status, event.target.checked)}
                            />
                            {label}
                        </label>
                    ))}
                </div>

                <div style={{ position: 'relative' }}>
                    <button className="btn-add-condition" style={{ margin: 0, width: 'auto' }} onClick={() => setShowColSelector(!showColSelector)}>
                        Columns
                    </button>
                    {showColSelector && (
                        <div style={{ position: 'absolute', top: '100%', left: 0, background: '#333', border: '1px solid #555', padding: 10, zIndex: 10, minWidth: 150 }}>
                            {columns.map((column) => (
                                <div key={column.key} style={{ display: 'flex', gap: 5, marginBottom: 5 }}>
                                    <input
                                        type="checkbox"
                                        checked={visibleColumns.includes(column.key)}
                                        onChange={() => {
                                            setVisibleColumns((prev) => prev.includes(column.key) ? prev.filter((key) => key !== column.key) : [...prev, column.key]);
                                        }}
                                    />
                                    <span>{column.label || column.key}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <select
                    className="modal-input"
                    style={{ width: 'auto' }}
                    value={itemsPerPage}
                    onChange={(event) => {
                        setItemsPerPage(Number(event.target.value));
                        table.setPage(1);
                    }}
                >
                    {itemsPerPageOptions.map((option) => (
                        <option key={option} value={option}>{option}</option>
                    ))}
                </select>
            </div>

            <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                <div style={{ flex: 1, overflow: 'auto', padding: 10 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9em' }}>
                        <thead>
                            <tr style={{ background: '#333', textAlign: 'left' }}>
                                {columns.filter((column) => visibleColumns.includes(column.key)).map((column) => (
                                    <th
                                        key={column.key}
                                        style={{ padding: 8, cursor: 'pointer', userSelect: 'none' }}
                                        onClick={() => table.setSort(column.key)}
                                    >
                                        {column.label || column.key} {table.sortConfig.key === column.key ? (table.sortConfig.direction === 'asc' ? '▲' : '▼') : ''}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {table.paginatedStates.map((state, idx) => {
                                const entry = getCatalogTableEntry(state);
                                return (
                                    <tr
                                        key={state.key || entry?.catalogEntryKey || entry?.id || entry?.name || idx}
                                        style={{
                                            borderBottom: '1px solid #444',
                                            background: previewItem?.catalogEntryKey === entry?.catalogEntryKey || previewItem?.name === entry?.name
                                                ? 'rgba(197,160,89,0.1)'
                                                : (idx % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent'),
                                            cursor: 'pointer',
                                            opacity: state.status === CATALOG_ENTRY_STATUS.DELETED ? 0.65 : 1,
                                        }}
                                        onClick={() => {
                                            table.selectEntry(state);
                                            if (!isMobile) table.preview(state);
                                        }}
                                        onDoubleClick={() => {
                                            if (isMobile) table.preview(state);
                                            else table.editEntry(state);
                                        }}
                                        onContextMenu={(event) => table.openContextMenu(event, state)}
                                    >
                                        {columns.filter((column) => visibleColumns.includes(column.key)).map((column) => (
                                            <td key={column.key} style={{ padding: 8 }}>
                                                {renderCell({ entry, state, column })}
                                            </td>
                                        ))}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>

                    <div style={{ marginTop: 10, display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'center' }}>
                        <button disabled={table.page === 1} onClick={() => table.setPage((page) => Math.max(1, page - 1))}>Prev</button>
                        <span>Page {table.page} of {table.totalPages}</span>
                        <button disabled={table.page === table.totalPages} onClick={() => table.setPage((page) => Math.min(table.totalPages, page + 1))}>Next</button>
                    </div>
                </div>

                {!isMobile && previewItem && (
                    <div style={{ width: 420, borderLeft: '1px solid #444', overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: 16 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                            <h4 style={{ margin: 0, color: '#aaa' }}>Preview</h4>
                            <button onClick={() => table.closePreview()} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer' }}>x</button>
                        </div>
                        {previewContent}
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

            {table.contextMenu && (
                <div
                    style={{
                        position: 'fixed',
                        top: table.contextMenu.y,
                        left: table.contextMenu.x,
                        background: '#2b2b2e',
                        border: '1px solid #c5a059',
                        borderRadius: 4,
                        zIndex: 2000,
                        minWidth: 170,
                        boxShadow: '0 2px 10px rgba(0,0,0,0.5)',
                    }}
                    onClick={(event) => event.stopPropagation()}
                >
                    {getStandardCatalogContextActions().map((action) => (
                        <div
                            key={action.id}
                            className="ctx-item"
                            style={{
                                padding: '8px 12px',
                                cursor: 'pointer',
                                color: action.danger ? '#ff8a80' : undefined,
                                borderBottom: action.id === 'preview' ? '1px solid #444' : undefined,
                            }}
                            onClick={() => handleContextAction(action, table.contextMenu.state)}
                        >
                            {action.label}
                        </div>
                    ))}
                    <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: -1 }} onClick={() => table.closeContextMenu()} />
                </div>
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
