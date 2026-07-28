import React, { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import ItemEditor from '../editors/ItemEditor';
import ItemRow from '../../shared/components/ItemRow';
import SpellScrollSelectorModal from '../../player/modals/SpellScrollSelectorModal';
import { deepClone } from '../../shared/utils/deepClone';
import { getItemIdentityKey } from '../../shared/utils/itemIdentity';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    AdminPagination,
    AdminResourceWorkspace,
    AdminSubtable,
    AdminTableSurface,
    AdminTableToolbar,
} from '../components/table';

const toTestId = (value) => String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

export default function ItemsViewLayout({
    activeCampaign,
    activeFilters,
    activeLoot,
    activeTrader,
    applySideFilters,
    campaignLootBags,
    COLUMNS_CONFIG,
    dataActions,
    db,
    editingItem,
    executeItemAction,
    filterOptions,
    filteredSideItems,
    focusScope,
    handleCreateLoot,
    handleCreateTrader,
    handleDeleteSideTarget,
    handleDoubleClick,
    handleDragStart,
    handleDrop,
    handleEditSideTarget,
    handleSelect,
    handleShowSideTargetInMain,
    handleSideSelect,
    handleSideSort,
    handleSort,
    isMobile,
    itemsPerPage,
    mobileSideOpen,
    mobileWorkspaceMode,
    onInspectItem,
    onLootGoldCommit,
    onLootGoldDraftChange,
    page,
    paginatedItems,
    pendingSpellAction,
    playerTargets = [],
    lootGoldDrafts = {},
    performAction,
    runDataAction,
    scrollbarStyles,
    search,
    selectedItems,
    selectedLootId,
    selectedSideItems,
    selectedTraderId,
    setActiveFilters,
    setApplySideFilters,
    setEditingItem,
    setItemsPerPage,
    setMobileSideOpen,
    setMobileWorkspaceMode,
    setPage,
    setPendingSpellAction,
    setSearch,
    setSelectedLootId,
    setSelectedSideItems,
    setSelectedTraderId,
    setSideMode,
    setVisibleColumns,
    shopState,
    sideMode,
    sideSortConfig,
    sortConfig,
    sortedGlobalItems,
    totalPages,
    visibleColumns,
    clearFocusScope,
}) {
    const [filterOpen, setFilterOpen] = useState(false);
    const [focusedFilterId, setFocusedFilterId] = useState(null);
    const tableColumns = useMemo(() => ['Available', 'Formula', ...visibleColumns], [visibleColumns]);
    const itemColumns = useMemo(
        () => Object.entries(COLUMNS_CONFIG).map(([key, config]) => ({ key, label: config.label || key })),
        [COLUMNS_CONFIG]
    );
    const itemTableColumns = useMemo(() => tableColumns.map((key) => ({
        key,
        label: key === 'Available' ? 'Av' : key === 'Formula' ? 'Fm' : COLUMNS_CONFIG[key]?.label || key,
        sortable: key !== 'Available' && key !== 'Formula',
        filterable: key !== 'Available' && key !== 'Formula',
        priority: { category: 3, group: 3, rarity: 2, traits: 2, damage: 2, range: 2, bulk: 3 }[key],
    })), [COLUMNS_CONFIG, tableColumns]);
    const itemFilters = useMemo(
        () => buildItemFilterDefinitions(filterOptions, COLUMNS_CONFIG),
        [COLUMNS_CONFIG, filterOptions]
    );
    const availableItems = shopState?.availableItems || [];
    const availableFormulas = shopState?.availableFormulas || [];
    const traders = shopState?.traders || [];
    const sameId = (left, right) => left != null && right != null && String(left) === String(right);
    const isSelected = (item) => selectedItems.some((selected) => selected.name === item.name);
    const isSideSelected = (item) => selectedSideItems.some(
        (selected) => getItemIdentityKey(selected) === getItemIdentityKey(item)
    );

    const makeContext = (item, source) => ({ item, source });
    const getMainActions = (item) => [
        {
            id: availableItems.includes(item.name) ? 'make-unavailable' : 'make-available',
            label: availableItems.includes(item.name) ? 'Make Unavailable' : 'Make Available',
            onSelect: () => performAction(availableItems.includes(item.name) ? 'makeUnavailable' : 'makeAvailable', null, makeContext(item, 'global')),
        },
        {
            id: availableFormulas.includes(item.name) ? 'remove-formula' : 'add-formula',
            label: availableFormulas.includes(item.name) ? 'Remove Formula' : 'Add Formula',
            onSelect: () => performAction(availableFormulas.includes(item.name) ? 'removeFormula' : 'addFormula', null, makeContext(item, 'global')),
        },
        { id: 'edit', label: 'Edit Item', separatorBefore: true, onSelect: () => performAction('edit', null, makeContext(item, 'global')) },
        { id: 'clone', label: 'Clone Item', onSelect: () => performAction('clone', null, makeContext(item, 'global')) },
        { id: 'delete', label: 'Delete Item', danger: true, onSelect: () => performAction('delete', null, makeContext(item, 'global')) },
        { id: 'copy-reference', label: 'Copy Reference', onSelect: () => performAction('copyReference', null, makeContext(item, 'global')) },
        {
            id: 'assign-trader',
            label: 'Assign to Trader',
            separatorBefore: true,
            children: traders.map((trader) => ({
                id: `trader-${trader.id}`,
                label: trader.name,
                onSelect: () => performAction('addToTrader', trader.id, makeContext(item, 'global')),
            })),
        },
        {
            id: 'add-loot',
            label: 'Add to Loot Bag',
            children: campaignLootBags.map((bag) => ({
                id: `loot-${bag.id}`,
                label: bag.name,
                onSelect: () => performAction('addToLoot', bag.id, makeContext(item, 'global')),
            })),
        },
        {
            id: 'give-to-player',
            label: 'Give to Player',
            children: playerTargets.map((player) => ({
                id: `give-player-${player.id}`,
                label: player.name,
                onSelect: () => performAction('giveToPlayer', player.id, makeContext(item, 'global')),
            })),
        },
        {
            id: 'give-formula',
            label: 'Give Formula to Player',
            children: playerTargets.map((player) => ({
                id: `formula-player-${player.id}`,
                label: player.name,
                onSelect: () => performAction('giveFormulaToPlayer', player.id, makeContext(item, 'global')),
            })),
        },
    ];

    const mainTable = (
        <PanelCard onDrop={(event) => handleDrop(event, 'global')} onDragOver={(event) => event.preventDefault()}>
            <AdminTableSurface
                className="items-view-scroll rounded-none border-0"
                columns={itemTableColumns}
                rows={paginatedItems}
                getRowKey={(item, index) => item.instanceId || `${item.name}-${index}`}
                getRowTestId={(item, index) => `gm-item-row-${toTestId(item.name || item.instanceId || index)}`}
                actionTestIdPrefix="gm-items"
                sortConfig={sortConfig}
                onSort={handleSort}
                onHeaderFilter={(column) => {
                    if (itemFilters.some((filter) => filter.id === column.key)) {
                        setFocusedFilterId(column.key);
                        setFilterOpen(true);
                    }
                }}
                onRowClick={(event, item, index) => handleSelect(event, item, index)}
                onRowDoubleClick={(_event, item) => handleDoubleClick(item)}
                isRowSelected={isSelected}
                getRowActions={getMainActions}
                getRowProps={(item) => ({
                    draggable: true,
                    onDragStart: (event) => handleDragStart(event, item, 'global'),
                })}
                renderCell={({ row: item, column }) => renderMainCell({
                    item,
                    column,
                    availableItems,
                    availableFormulas,
                    executeItemAction,
                })}
                emptyLabel="No items match the current filters."
                tableTestId="gm-items-table"
            />
            <AdminPagination
                page={page}
                totalPages={totalPages}
                total={sortedGlobalItems.length}
                pageSize={itemsPerPage}
                pageSizeOptions={[25, 50, 100]}
                onPageChange={setPage}
                onPageSizeChange={(nextSize) => { setItemsPerPage(nextSize); setPage(1); }}
                label="items"
            />
        </PanelCard>
    );

    const upperRows = sideMode === 'trader' ? traders : campaignLootBags;
    const upperColumns = sideMode === 'trader'
        ? [
            { key: 'name', label: 'Name' },
            { key: 'category', label: 'Category' },
            { key: 'hidden', label: 'Hidden', sortValue: (row) => Number(Boolean(row.hidden)) },
            { key: 'inventory', label: 'Items', sortValue: (row) => row.inventory?.length || 0 },
        ]
        : [
            { key: 'name', label: 'Name' },
            { key: 'goldValue', label: 'Gold' },
            { key: 'isLocked', label: 'Hidden', sortValue: (row) => Number(Boolean(row.isLocked)) },
            { key: 'items', label: 'Items', sortValue: (row) => row.items?.length || 0 },
        ];
    const upperTable = (
        <AdminSubtable
            title={sideMode === 'trader' ? 'Traders' : 'Loot Bags'}
            rows={upperRows}
            columns={upperColumns}
            getRowKey={(entry) => entry.id}
            getRowTestId={(entry) => `gm-items-${sideMode}-target-row-${toTestId(entry.id || entry.name)}`}
            actionTestIdPrefix={`gm-items-${sideMode}-target-action`}
            tableTestId={`gm-items-${sideMode}-targets`}
            searchPlaceholder={sideMode === 'trader' ? 'Search traders...' : 'Search loot bags...'}
            actions={(
                <Button
                    data-testid={sideMode === 'trader' ? 'gm-items-create-trader' : 'gm-items-create-loot'}
                    type="button"
                    size="sm"
                    onClick={sideMode === 'trader' ? handleCreateTrader : handleCreateLoot}
                >
                    + New
                </Button>
            )}
            isRowSelected={(entry) => sideMode === 'trader'
                ? sameId(selectedTraderId, entry.id)
                : sameId(selectedLootId, entry.id)}
            onRowClick={(_event, entry) => {
                if (sideMode === 'trader') {
                    setSelectedTraderId(entry.id);
                    setSelectedLootId(null);
                } else {
                    setSelectedLootId(entry.id);
                    setSelectedTraderId(null);
                }
                setSelectedSideItems([]);
                setMobileWorkspaceMode('lower');
            }}
            getRowProps={(entry) => ({
                onDrop: (event) => handleDrop(event, sideMode, entry.id),
                onDragOver: (event) => event.preventDefault(),
            })}
            getRowActions={(entry) => [
                { id: 'delete', label: 'Delete', danger: true, onSelect: () => handleDeleteSideTarget(entry) },
                { id: 'edit', label: 'Edit', onSelect: () => handleEditSideTarget(entry) },
                { id: 'show-main', label: 'Show in Main table', onSelect: () => handleShowSideTargetInMain(entry) },
            ]}
            renderCell={({ row, column }) => renderUpperCell({ row, column, sideMode, dataActions, activeCampaign, runDataAction })}
            emptyLabel={sideMode === 'trader' ? 'No traders found.' : 'No loot bags found.'}
        />
    );

    const lowerColumns = [
        ...(sideMode === 'trader' ? [
            { key: 'available', label: 'Av', sortable: false },
            { key: 'formula', label: 'Fm', sortable: false },
        ] : []),
        { key: 'name', label: 'Name' },
        { key: 'level', label: 'Level' },
        { key: 'type', label: 'Type' },
        ...(sideMode === 'loot' ? [{ key: 'qty', label: 'Qty' }] : []),
    ];
    const lowerTable = (
        <AdminSubtable
            title={activeTrader?.name || activeLoot?.name || (sideMode === 'trader' ? 'Select a trader' : 'Select a loot bag')}
            rows={filteredSideItems}
            columns={lowerColumns}
            getRowKey={(item, index) => getItemIdentityKey(item) || `${item.name}-${index}`}
            getRowTestId={(item, index) => `gm-items-${sideMode}-content-row-${toTestId(getItemIdentityKey(item) || item.name || index)}`}
            actionTestIdPrefix={`gm-items-${sideMode}-content-action`}
            tableTestId={`gm-items-${sideMode}-contents`}
            searchPlaceholder="Search contained items..."
            sortConfig={sideSortConfig}
            onSort={handleSideSort}
            isRowSelected={isSideSelected}
            onRowClick={(event, item, index) => handleSideSelect(event, item, index)}
            onRowDoubleClick={(_event, item) => handleDoubleClick(item)}
            onDrop={(event) => {
                const targetId = sideMode === 'trader' ? selectedTraderId : selectedLootId;
                if (targetId) handleDrop(event, sideMode, targetId);
            }}
            onDragOver={(event) => event.preventDefault()}
            getRowProps={(item) => ({
                draggable: true,
                onDragStart: (event) => handleDragStart(event, item, sideMode),
            })}
            getRowActions={(item) => [
                { id: 'view-detail', label: 'View Detail', onSelect: () => onInspectItem?.(item) },
                { id: 'customize', label: 'Customize', onSelect: () => performAction('customizeOccurrence', null, makeContext(item, sideMode)) },
                { id: 'remove', label: 'Remove', danger: true, onSelect: () => performAction('removeFromSide', null, makeContext(item, sideMode)) },
            ]}
            actions={<SideControls
                activeCampaign={activeCampaign}
                activeLoot={activeLoot}
                activeTrader={activeTrader}
                applySideFilters={applySideFilters}
                dataActions={dataActions}
                lootGoldDrafts={lootGoldDrafts}
                onLootGoldCommit={onLootGoldCommit}
                onLootGoldDraftChange={onLootGoldDraftChange}
                runDataAction={runDataAction}
                setApplySideFilters={setApplySideFilters}
                sideMode={sideMode}
            />}
            renderCell={({ row: item, column }) => renderLowerCell({
                item,
                column,
                sideMode,
                activeCampaign,
                activeLoot,
                activeTrader,
                availableItems,
                availableFormulas,
                dataActions,
                executeItemAction,
                runDataAction,
            })}
            emptyLabel="No items in the selected target."
        />
    );

    const occurrenceContext = editingItem?._occurrenceContext;
    return (
        <>
            <style>{scrollbarStyles}</style>
            <div className="flex h-full min-h-0 flex-col gap-2 overflow-hidden">
                <AdminTableToolbar
                    search={search}
                    onSearchChange={(value) => { setSearch(value); setPage(1); }}
                    searchPlaceholder="Search items..."
                    filters={itemFilters}
                    filterValues={activeFilters}
                    onFilterValuesChange={(next) => { setActiveFilters(next); setPage(1); }}
                    filterOpen={filterOpen}
                    onFilterOpenChange={setFilterOpen}
                    focusFilterId={focusedFilterId}
                    columns={itemColumns}
                    visibleColumns={visibleColumns}
                    onVisibleColumnsChange={setVisibleColumns}
                    leftControls={(
                        <div className="inline-flex overflow-hidden rounded-lg border border-border/70">
                            <Button data-testid="gm-items-side-items" type="button" size="sm" variant={sideMode === 'none' ? 'default' : 'outline'} onClick={() => { setSideMode('none'); setSelectedSideItems([]); }}>Items</Button>
                            <Button data-testid="gm-items-side-trader" type="button" size="sm" variant={sideMode === 'trader' ? 'default' : 'outline'} onClick={() => { setSideMode('trader'); setSelectedLootId(null); setSelectedSideItems([]); setMobileWorkspaceMode('upper'); if (isMobile) setMobileSideOpen(true); }}>Trader</Button>
                            <Button data-testid="gm-items-side-loot" type="button" size="sm" variant={sideMode === 'loot' ? 'default' : 'outline'} onClick={() => { setSideMode('loot'); setSelectedTraderId(null); setSelectedSideItems([]); setMobileWorkspaceMode('upper'); if (isMobile) setMobileSideOpen(true); }}>Loot</Button>
                        </div>
                    )}
                    secondaryActions={focusScope ? (
                        <Badge variant="outline" className="gap-1">
                            Scope: {focusScope.label}
                            <button type="button" onClick={clearFocusScope} aria-label="Clear table scope"><X /></button>
                        </Badge>
                    ) : null}
                    resultMeta={`${sortedGlobalItems.length} items`}
                    primaryActions={<Button type="button" size="sm" onClick={() => performAction('newItem')}>+ Item</Button>}
                />

                <AdminResourceWorkspace
                    storageKey={`gm-items-${sideMode === 'none' ? 'main' : sideMode}`}
                    main={mainTable}
                    upper={sideMode !== 'none' ? upperTable : null}
                    lower={sideMode !== 'none' ? lowerTable : null}
                    isMobile={isMobile}
                    mobileOpen={mobileSideOpen && sideMode !== 'none'}
                    onMobileOpenChange={setMobileSideOpen}
                    mobileMode={mobileWorkspaceMode}
                    onMobileModeChange={setMobileWorkspaceMode}
                    upperLabel={sideMode === 'trader' ? 'Traders' : 'Loot Bags'}
                    lowerLabel="Contents"
                />
            </div>

            {editingItem && (
                <div className="fixed inset-0 flex items-center justify-center bg-black/70 p-5" style={{ zIndex: 3000 }}>
                    <div className="items-view-scroll max-h-[calc(100dvh-2.5rem)] overflow-auto rounded-lg">
                        <ItemEditor
                            catalogType="item"
                            editorMode={editingItem.editorMode || (editingItem.sourceFile || editingItem.catalogOverrideId ? 'edit' : 'create')}
                            baseEntry={editingItem.editorMode === 'create' ? null : editingItem}
                            initialItem={editingItem.editorMode === 'create' || Object.keys(editingItem).length === 0 ? null : editingItem}
                            onSave={() => setEditingItem(null)}
                            onCancel={() => setEditingItem(null)}
                            onSaveCatalogEntry={occurrenceContext ? undefined : (override) => dataActions.catalog.saveCatalogOverride(override)}
                            onSaveToDb={occurrenceContext ? (itemPayload) => {
                                if (occurrenceContext.source === 'loot') {
                                    return dataActions.loot.updateItem(activeCampaign.id, occurrenceContext.targetId, occurrenceContext.item, itemPayload);
                                }
                                return dataActions.shop.updateTraderItem(occurrenceContext.targetId, occurrenceContext.item, itemPayload);
                            } : undefined}
                            dbOnly
                        />
                    </div>
                </div>
            )}

            {pendingSpellAction && (
                <SpellScrollSelectorModal
                    rank={pendingSpellAction.rank}
                    type={pendingSpellAction.type}
                    db={db}
                    ignoreAvailability
                    onCancel={() => setPendingSpellAction(null)}
                    onSelect={(spell) => {
                        const { action, arg, baseItem, type, rank } = pendingSpellAction;
                        const newItem = { ...baseItem, system: baseItem.system ? deepClone(baseItem.system) : {} };
                        newItem.system.originalName = baseItem.name;
                        newItem.name = `${type === 'scroll' ? 'Scroll' : 'Wand'} of ${spell.name} (Rank ${rank})`;
                        newItem.system.spell = spell;
                        if (type === 'wand') newItem.system.wand = { charges: 1, max: 1 };
                        executeItemAction(action, arg, [newItem]);
                        setPendingSpellAction(null);
                    }}
                />
            )}
        </>
    );
}

function PanelCard({ children, ...props }) {
    return <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-border/70 bg-card" {...props}>{children}</section>;
}

function renderMainCell({ item, column, availableItems, availableFormulas, executeItemAction }) {
    if (column.key === 'Available' || column.key === 'Formula') {
        const list = column.key === 'Available' ? availableItems : availableFormulas;
        const checked = list.includes(item.name);
        const action = column.key === 'Available'
            ? (checked ? 'makeUnavailable' : 'makeAvailable')
            : (checked ? 'removeFormula' : 'addFormula');
        return <input type="checkbox" checked={checked} aria-label={`${action}: ${item.name}`} onChange={() => executeItemAction(action, null, [item])} onClick={(event) => event.stopPropagation()} />;
    }
    if (column.key === 'traits') return Array.isArray(item.traits?.value) ? item.traits.value.join(', ') : String(item.traits || '');
    return item[column.key] ?? '-';
}

function renderUpperCell({ row, column, sideMode, dataActions, activeCampaign, runDataAction }) {
    if (column.key === 'inventory') return row.inventory?.length || 0;
    if (column.key === 'items') return row.items?.length || 0;
    if (column.key === 'hidden') {
        return <input type="checkbox" checked={Boolean(row.hidden)} onChange={() => runDataAction(dataActions.shop.setTraderHidden(row.id, !row.hidden))} onClick={(event) => event.stopPropagation()} />;
    }
    if (column.key === 'isLocked') {
        return <input type="checkbox" checked={Boolean(row.isLocked)} onChange={() => activeCampaign && runDataAction(dataActions.loot.updateLootBag(activeCampaign.id, row.id, (bag) => ({ ...bag, isLocked: !bag.isLocked })))} onClick={(event) => event.stopPropagation()} />;
    }
    if (column.key === 'goldValue' && sideMode === 'loot') return `${Number(row.goldValue || 0).toFixed(2)} gp`;
    return row[column.key] ?? '-';
}

function renderLowerCell({ item, column, sideMode, activeCampaign, activeLoot, activeTrader, availableItems, availableFormulas, dataActions, executeItemAction, runDataAction }) {
    if (column.key === 'name') return <ItemRow item={item} className="items-view-inline-row" />;
    if (column.key === 'available' || column.key === 'formula') {
        const list = column.key === 'available' ? availableItems : availableFormulas;
        const checked = list.includes(item.name);
        const action = column.key === 'available'
            ? (checked ? 'makeUnavailable' : 'makeAvailable')
            : (checked ? 'removeFormula' : 'addFormula');
        return <input type="checkbox" checked={checked} onChange={() => executeItemAction(action, null, [item])} onClick={(event) => event.stopPropagation()} />;
    }
    if (column.key === 'qty' && sideMode === 'loot') {
        return <InlineQuantity
            value={item.qty || 1}
            onCommit={(qty) => activeCampaign && activeLoot && runDataAction(dataActions.loot.setItemQuantity(activeCampaign.id, activeLoot.id, [item], qty))}
        />;
    }
    if (column.key === 'type') return item.type || 'Unknown';
    if (column.key === 'level') return item.level || 0;
    return item[column.key] ?? '-';
}

function InlineQuantity({ value, onCommit }) {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(String(value));
    const commit = () => {
        const next = Math.max(1, Math.floor(Number(draft) || 1));
        setDraft(String(next));
        setEditing(false);
        if (next !== Number(value)) onCommit(next);
    };
    if (!editing) return <button type="button" className="min-w-8 rounded px-1 text-left hover:bg-accent" onClick={(event) => { event.stopPropagation(); setDraft(String(value)); setEditing(true); }}>{value}</button>;
    return <input
        autoFocus
        type="number"
        min="1"
        className="h-7 w-16 rounded border border-input bg-background px-2"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
            event.stopPropagation();
            if (event.key === 'Enter') commit();
            if (event.key === 'Escape') { setDraft(String(value)); setEditing(false); }
        }}
    />;
}

function SideControls({ activeCampaign, activeLoot, activeTrader, applySideFilters, dataActions, lootGoldDrafts, onLootGoldCommit, onLootGoldDraftChange, runDataAction, setApplySideFilters, sideMode }) {
    return (
        <div className="flex flex-wrap items-center gap-2">
            {sideMode === 'loot' && activeLoot ? (
                <>
                    <input
                        type="number"
                        className="h-8 w-24 rounded border border-input bg-background px-2 text-sm"
                        aria-label="Loot gold"
                        value={lootGoldDrafts[activeLoot.id] ?? activeLoot.goldValue ?? 0}
                        onChange={(event) => onLootGoldDraftChange(activeLoot.id, event.target.value)}
                        onBlur={() => onLootGoldCommit(activeLoot.id)}
                        onKeyDown={(event) => event.key === 'Enter' && onLootGoldCommit(activeLoot.id)}
                    />
                    <Button type="button" variant="outline" size="sm" onClick={() => activeCampaign && runDataAction(dataActions.loot.updateLootBag(activeCampaign.id, activeLoot.id, (bag) => ({ ...bag, isLocked: !bag.isLocked })))}>
                        {activeLoot.isLocked ? 'Hidden' : 'Visible'}
                    </Button>
                </>
            ) : null}
            {sideMode === 'trader' && activeTrader ? (
                <Button type="button" variant="outline" size="sm" onClick={() => runDataAction(dataActions.shop.setTraderHidden(activeTrader.id, !activeTrader.hidden))}>
                    {activeTrader.hidden ? 'Hidden' : 'Visible'}
                </Button>
            ) : null}
            <label className="flex items-center gap-1 text-xs text-muted-foreground">
                <input type="checkbox" checked={applySideFilters} onChange={() => setApplySideFilters((value) => !value)} />
                Main filters
            </label>
        </div>
    );
}

function buildItemFilterDefinitions(filterOptions = {}, columnsConfig = {}) {
    return Object.entries(filterOptions).map(([id, options]) => {
        const label = id === 'Available' ? 'Available'
            : id === 'Formula' ? 'Formula'
                : columnsConfig[id]?.label || id;
        if (options === true) return { id, label, type: 'boolean', defaultValue: null };
        return {
            id,
            label,
            type: 'multi',
            defaultValue: [],
            options: (options || []).map((option) => ({ value: option, label: String(option) })),
        };
    });
}
