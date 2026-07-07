import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    CATALOG_ENTRY_STATUS,
    getCatalogEntryBaseId,
    getCatalogEntryKey,
} from '../../shared/catalog/catalogEntryModel.js';
import { createCatalogReference } from '../../shared/clipboard/refClipboard.js';

export const DEFAULT_CATALOG_STATUS_FILTERS = Object.freeze({
    [CATALOG_ENTRY_STATUS.ORIGINAL]: true,
    [CATALOG_ENTRY_STATUS.EDITED]: true,
    [CATALOG_ENTRY_STATUS.CUSTOM]: true,
    [CATALOG_ENTRY_STATUS.DELETED]: false,
});

export const DEFAULT_CATALOG_SORT = Object.freeze({ key: 'name', direction: 'asc' });

export const STANDARD_CATALOG_CONTEXT_ACTIONS = Object.freeze([
    { id: 'preview', label: 'Preview' },
    { id: 'edit', label: 'Edit' },
    { id: 'clone', label: 'Clone' },
    { id: 'delete', label: 'Delete', danger: true },
    { id: 'copyReference', label: 'Copy Reference' },
]);

const DEFAULT_SEARCH_KEYS = Object.freeze([
    'name',
    'id',
    '_id',
    'sourceFile',
    'overrideSourceFile',
    'baseId',
    'type',
    'rarity',
    'category',
    'group',
    'traits',
]);

export function useCatalogAdminTable({
    entryStates = [],
    searchKeys = DEFAULT_SEARCH_KEYS,
    initialSearch = '',
    initialStatusFilters = DEFAULT_CATALOG_STATUS_FILTERS,
    initialSort = DEFAULT_CATALOG_SORT,
    initialPage = 1,
    itemsPerPage = 100,
    onCopyReference = null,
} = {}) {
    const [search, setSearch] = useState(initialSearch);
    const [statusFilters, setStatusFilters] = useState(() => ({ ...DEFAULT_CATALOG_STATUS_FILTERS, ...initialStatusFilters }));
    const [sortConfig, setSortConfig] = useState(() => ({ ...DEFAULT_CATALOG_SORT, ...initialSort }));
    const [page, setPage] = useState(initialPage);
    const [selectedKeys, setSelectedKeys] = useState([]);
    const [previewEntry, setPreviewEntry] = useState(null);
    const [editingEntry, setEditingEntry] = useState(null);
    const [editorMode, setEditorMode] = useState(null);
    const [pendingDeleteEntry, setPendingDeleteEntry] = useState(null);
    const [contextMenu, setContextMenu] = useState(null);

    const filteredStates = useMemo(
        () => filterCatalogEntryStates(entryStates, { search, statusFilters, searchKeys }),
        [entryStates, search, searchKeys, statusFilters]
    );
    const sortedStates = useMemo(
        () => sortCatalogEntryStates(filteredStates, sortConfig),
        [filteredStates, sortConfig]
    );
    const totalPages = Math.max(1, Math.ceil(sortedStates.length / Math.max(1, itemsPerPage)));
    const currentPage = Math.min(Math.max(1, page), totalPages);
    const paginatedStates = useMemo(
        () => paginateCatalogEntryStates(sortedStates, { page: currentPage, itemsPerPage }),
        [currentPage, itemsPerPage, sortedStates]
    );

    useEffect(() => {
        if (page !== currentPage) setPage(currentPage);
    }, [currentPage, page]);

    const selectedStates = useMemo(() => {
        const selected = new Set(selectedKeys);
        return sortedStates.filter((state) => selected.has(getCatalogTableStateKey(state)));
    }, [selectedKeys, sortedStates]);

    const setStatusFilter = useCallback((status, enabled) => {
        setStatusFilters((prev) => ({ ...prev, [status]: Boolean(enabled) }));
        setPage(1);
    }, []);

    const toggleStatusFilter = useCallback((status) => {
        setStatusFilters((prev) => ({ ...prev, [status]: !prev[status] }));
        setPage(1);
    }, []);

    const setSort = useCallback((key) => {
        setSortConfig((prev) => {
            if (prev.key === key) {
                return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
            }
            return { key, direction: 'asc' };
        });
    }, []);

    const selectEntry = useCallback((entryOrState, options = {}) => {
        const key = getCatalogTableStateKey(entryOrState);
        if (!key) return;
        setSelectedKeys((prev) => {
            if (options.append) {
                return prev.includes(key) ? prev.filter((existing) => existing !== key) : [...prev, key];
            }
            return [key];
        });
    }, []);

    const clearSelection = useCallback(() => setSelectedKeys([]), []);

    const openContextMenu = useCallback((eventOrPosition, entryOrState) => {
        if (eventOrPosition?.preventDefault) eventOrPosition.preventDefault();
        const x = eventOrPosition?.clientX ?? eventOrPosition?.x ?? 0;
        const y = eventOrPosition?.clientY ?? eventOrPosition?.y ?? 0;
        selectEntry(entryOrState);
        setContextMenu({ x, y, entry: getCatalogTableEntry(entryOrState), state: normalizeCatalogTableState(entryOrState) });
    }, [selectEntry]);

    const closeContextMenu = useCallback(() => setContextMenu(null), []);

    const preview = useCallback((entryOrState) => {
        const entry = getCatalogTableEntry(entryOrState);
        setPreviewEntry(entry);
        setEditingEntry(null);
        setEditorMode(null);
        closeContextMenu();
        return createCatalogActionResult('preview', entryOrState);
    }, [closeContextMenu]);

    const createEntry = useCallback(() => {
        setEditingEntry(null);
        setEditorMode('create');
        setPreviewEntry(null);
        closeContextMenu();
        return createCatalogActionResult('create', null);
    }, [closeContextMenu]);

    const editEntry = useCallback((entryOrState) => {
        const entry = getCatalogTableEntry(entryOrState);
        setEditingEntry(entry);
        setEditorMode('edit');
        setPreviewEntry(null);
        closeContextMenu();
        return createCatalogActionResult('edit', entryOrState);
    }, [closeContextMenu]);

    const cloneEntry = useCallback((entryOrState) => {
        const entry = getCatalogTableEntry(entryOrState);
        setEditingEntry(entry);
        setEditorMode('clone');
        setPreviewEntry(null);
        closeContextMenu();
        return createCatalogActionResult('clone', entryOrState);
    }, [closeContextMenu]);

    const deleteEntry = useCallback((entryOrState) => {
        const entry = getCatalogTableEntry(entryOrState);
        setPendingDeleteEntry(entry);
        closeContextMenu();
        return createCatalogActionResult('delete', entryOrState);
    }, [closeContextMenu]);

    const copyEntryReference = useCallback((entryOrState) => {
        const ref = createCatalogEntryReference(entryOrState);
        if (onCopyReference) onCopyReference(ref, entryOrState);
        closeContextMenu();
        return createCatalogActionResult('copyReference', entryOrState, { ref });
    }, [closeContextMenu, onCopyReference]);

    const closeEditor = useCallback(() => {
        setEditingEntry(null);
        setEditorMode(null);
    }, []);

    const closePreview = useCallback(() => setPreviewEntry(null), []);
    const clearPendingDelete = useCallback(() => setPendingDeleteEntry(null), []);

    return {
        search,
        setSearch,
        statusFilters,
        setStatusFilters,
        setStatusFilter,
        toggleStatusFilter,
        sortConfig,
        setSortConfig,
        setSort,
        page: currentPage,
        setPage,
        itemsPerPage,
        totalPages,
        entryStates,
        filteredStates,
        sortedStates,
        paginatedStates,
        visibleEntries: sortedStates.map(getCatalogTableEntry).filter(Boolean),
        paginatedEntries: paginatedStates.map(getCatalogTableEntry).filter(Boolean),
        selectedKeys,
        selectedStates,
        selectedEntries: selectedStates.map(getCatalogTableEntry).filter(Boolean),
        selectEntry,
        clearSelection,
        previewEntry,
        editingEntry,
        editorMode,
        pendingDeleteEntry,
        contextMenu,
        openContextMenu,
        closeContextMenu,
        previewEntryAction: preview,
        preview,
        createEntry,
        editEntry,
        cloneEntry,
        deleteEntry,
        copyEntryReference,
        closeEditor,
        closePreview,
        clearPendingDelete,
        contextActions: STANDARD_CATALOG_CONTEXT_ACTIONS,
    };
}

export function filterCatalogEntryStates(entryStates = [], {
    search = '',
    statusFilters = DEFAULT_CATALOG_STATUS_FILTERS,
    searchKeys = DEFAULT_SEARCH_KEYS,
} = {}) {
    const searchText = String(search || '').trim().toLowerCase();
    return (entryStates || []).filter((stateLike) => {
        const state = normalizeCatalogTableState(stateLike);
        const status = state?.status || getCatalogTableEntry(state)?.catalogEntryStatus || CATALOG_ENTRY_STATUS.ORIGINAL;
        if (!statusFilters[status]) return false;
        if (!searchText) return true;
        const entry = getCatalogTableEntry(state);
        return searchKeys.some((key) => catalogValueIncludes(entry?.[key], searchText));
    });
}

export function sortCatalogEntryStates(entryStates = [], sortConfig = DEFAULT_CATALOG_SORT) {
    const key = sortConfig?.key || 'name';
    const direction = sortConfig?.direction === 'desc' ? -1 : 1;
    return [...(entryStates || [])].sort((left, right) => {
        const leftEntry = getCatalogTableEntry(left);
        const rightEntry = getCatalogTableEntry(right);
        const leftValue = normalizeSortValue(leftEntry?.[key]);
        const rightValue = normalizeSortValue(rightEntry?.[key]);
        if (leftValue < rightValue) return -1 * direction;
        if (leftValue > rightValue) return 1 * direction;
        return String(leftEntry?.name || '').localeCompare(String(rightEntry?.name || ''));
    });
}

export function paginateCatalogEntryStates(entryStates = [], { page = 1, itemsPerPage = 100 } = {}) {
    const size = Math.max(1, Number(itemsPerPage) || 100);
    const currentPage = Math.max(1, Number(page) || 1);
    const start = (currentPage - 1) * size;
    return (entryStates || []).slice(start, start + size);
}

export function createCatalogEntryReference(entryOrState) {
    const entry = getCatalogTableEntry(entryOrState) || {};
    const state = normalizeCatalogTableState(entryOrState);
    return createCatalogReference(entry.catalogType || state?.catalogType, {
        ...entry,
        baseId: getCatalogEntryBaseId(entry) || state?.baseId || null,
        catalogOverrideId: entry.catalogOverrideId || state?.overrideId || null,
        catalogEntryStatus: state?.status || entry.catalogEntryStatus || null,
    });
}

export function createCatalogActionResult(action, entryOrState, extra = {}) {
    return {
        action,
        entry: getCatalogTableEntry(entryOrState),
        state: normalizeCatalogTableState(entryOrState),
        ...extra,
    };
}

export function getStandardCatalogContextActions({ includePreview = true } = {}) {
    return STANDARD_CATALOG_CONTEXT_ACTIONS.filter((action) => includePreview || action.id !== 'preview');
}

export function getCatalogTableStateKey(entryOrState) {
    const state = normalizeCatalogTableState(entryOrState);
    const entry = getCatalogTableEntry(entryOrState);
    return state?.key || entry?.catalogEntryKey || getCatalogEntryKey(entry, entry?.catalogType || state?.catalogType || 'catalog');
}

export function getCatalogTableEntry(entryOrState) {
    if (!entryOrState) return null;
    return entryOrState.effective || entryOrState.entry || entryOrState;
}

export function normalizeCatalogTableState(entryOrState) {
    if (!entryOrState) return null;
    if (entryOrState.entry || entryOrState.effective || entryOrState.status) return entryOrState;
    const entry = getCatalogTableEntry(entryOrState);
    return {
        status: entry?.catalogEntryStatus || CATALOG_ENTRY_STATUS.ORIGINAL,
        catalogType: entry?.catalogType || null,
        key: entry?.catalogEntryKey || getCatalogEntryKey(entry, entry?.catalogType || 'catalog'),
        entry,
        effective: entry,
        original: null,
        override: null,
        overrideId: entry?.catalogOverrideId || null,
        baseId: getCatalogEntryBaseId(entry),
    };
}

function catalogValueIncludes(value, searchText) {
    if (Array.isArray(value)) {
        return value.some((item) => catalogValueIncludes(item, searchText));
    }
    if (value && typeof value === 'object') {
        return Object.values(value).some((item) => catalogValueIncludes(item, searchText));
    }
    return String(value || '').toLowerCase().includes(searchText);
}

function normalizeSortValue(value) {
    if (Array.isArray(value)) return value.join(', ').toLowerCase();
    if (value && typeof value === 'object') return JSON.stringify(value).toLowerCase();
    if (typeof value === 'number') return value;
    const number = Number(value);
    if (value !== '' && Number.isFinite(number)) return number;
    return String(value || '').toLowerCase();
}
