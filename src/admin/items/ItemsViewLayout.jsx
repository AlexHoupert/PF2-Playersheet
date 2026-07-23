import React, { useMemo, useState } from 'react';
import ItemEditor from '../editors/ItemEditor';
import BottomSheet from '../../shared/components/BottomSheet';
import ItemRow from '../../shared/components/ItemRow';
import { SHOP_CATEGORIES } from '../../shared/constants/shop';
import SpellScrollSelectorModal from '../../player/modals/SpellScrollSelectorModal';
import { deepClone } from '../../shared/utils/deepClone';
import { getItemIdentityKey } from '../../shared/utils/itemIdentity';
import { Button } from '@/components/ui/button';
import { AdminPagination, AdminTableSurface, AdminTableToolbar } from '../components/table';

const Card = ({ children, style, className, ...rest }) => (
    <div className={className} style={{
        background: '#1a1a1a',
        borderRadius: 8,
        border: '1px solid #333',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        ...style
    }} {...rest}>
        {children}
    </div>
);

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
    closeContextMenu,
    contextMenu,
    contextSubMenu,
    COLUMNS_CONFIG,
    dataActions,
    db,
    editingItem,
    executeItemAction,
    filterOptions,
    filteredSideItems,
    handleContextMenu,
    handleCreateLoot,
    handleCreateTrader,
    handleDoubleClick,
    handleDragStart,
    handleDrop,
    handleSelect,
    handleSideSelect,
    handleSideSort,
    handleSort,
    isMobile,
    itemsPerPage,
    mobileSideOpen,
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
    setContextSubMenu,
    setEditingItem,
    setItemsPerPage,
    setMobileSideOpen,
    setPage,
    setPendingSpellAction,
    setSearch,
    setSelectedLootId,
    setSelectedSideItems,
    setSelectedTraderId,
    setShowColSelector,
    setSideMode,
    setSidePage,
    setVisibleColumns,
    showColSelector,
    shopState,
    sideLists,
    sideMode,
    sidePage,
    sideSortConfig,
    sortConfig,
    sortedGlobalItems,
    totalPages,
    visibleColumns,}) {
    const tableColumns = useMemo(
        () => ['Available', 'Formula', ...visibleColumns],
        [visibleColumns]
    );
    const availableItems = shopState?.availableItems || [];
    const availableFormulas = shopState?.availableFormulas || [];
    const traders = shopState?.traders || [];
    const sameId = (a, b) => a != null && b != null && String(a) === String(b);
    const isSelected = (item) => selectedItems.some(i => i.name === item.name);
    const isSideSelected = (item) => selectedSideItems.some(i => getItemIdentityKey(i) === getItemIdentityKey(item));
    const [filterOpen, setFilterOpen] = useState(false);
    const [focusedFilterId, setFocusedFilterId] = useState(null);
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
    const contextMenuPlacement = contextMenu ? getClampedContextMenuPlacement(contextMenu) : null;
    const submenuPlacementStyle = contextMenuPlacement?.openLeft
        ? { right: '100%', left: 'auto' }
        : { left: '100%' };

    // Context menu item component
    const CtxItem = ({ icon, label, onClick, danger, hasSubmenu, onMouseEnter, testId }) => (
        <div
            data-testid={testId}
            onClick={onClick}
            onMouseEnter={onMouseEnter}
            style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '6px 12px', cursor: 'pointer',
                color: danger ? '#e57373' : '#ddd', background: 'transparent', transition: 'background 0.15s'
            }}
            onMouseOver={(e) => e.currentTarget.style.background = '#333'}
            onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
        >
            <span style={{ width: 18, textAlign: 'center', opacity: 0.7 }}>{icon}</span>
            <span style={{ flex: 1 }}>{label}</span>
            {hasSubmenu && <span style={{ opacity: 0.5 }}>▶</span>}
        </div>
    );

    const CtxDivider = () => <div style={{ height: 1, background: '#444', margin: '4px 0' }} />;

    // Grid layout: mobile always single column; desktop splits when side panel open
    const gridTemplate = (!isMobile && sideMode !== 'none')
        ? 'auto 1fr / 3fr 2fr'
        : 'auto 1fr / 1fr';

    return (
        <>
            <style>{scrollbarStyles}</style>
            <div style={{ display: 'grid', gridTemplate, gap: 10, height: '100%', overflow: 'hidden' }}>
                {/* TOOLBAR CARD - spans full width */}
                <Card style={{ gridColumn: '1 / -1' }}>
                    <AdminTableToolbar
                        search={search}
                        onSearchChange={(value) => {
                            setSearch(value);
                            setPage(1);
                        }}
                        searchPlaceholder="Search items..."
                        filters={itemFilters}
                        filterValues={activeFilters}
                        onFilterValuesChange={(next) => {
                            setActiveFilters(next);
                            setPage(1);
                        }}
                        filterOpen={filterOpen}
                        onFilterOpenChange={setFilterOpen}
                        focusFilterId={focusedFilterId}
                        columns={itemColumns}
                        visibleColumns={visibleColumns}
                        onVisibleColumnsChange={setVisibleColumns}
                        leftControls={
                            <div className="inline-flex overflow-hidden rounded-lg border border-border/70">
                                <Button data-testid="gm-items-side-items" type="button" size="sm" variant={sideMode === 'none' ? 'default' : 'outline'} onClick={() => { setSideMode('none'); setSelectedSideItems([]); }}>Items</Button>
                                <Button data-testid="gm-items-side-trader" type="button" size="sm" variant={sideMode === 'trader' ? 'default' : 'outline'} onClick={() => { setSideMode('trader'); setSelectedLootId(null); setSelectedSideItems([]); if (isMobile) setMobileSideOpen(true); }}>Trader</Button>
                                <Button data-testid="gm-items-side-loot" type="button" size="sm" variant={sideMode === 'loot' ? 'default' : 'outline'} onClick={() => { setSideMode('loot'); setSelectedTraderId(null); setSelectedSideItems([]); if (isMobile) setMobileSideOpen(true); }}>Loot</Button>
                            </div>
                        }
                        resultMeta={`${sortedGlobalItems.length} items`}
                        primaryActions={(
                            <Button type="button" size="sm" onClick={() => performAction('newItem')}>
                                + Item
                            </Button>
                        )}
                    />
                </Card>

                {/* MAIN TABLE CARD */}
                <Card style={{ minHeight: 0 }} onDrop={e => handleDrop(e, 'global')} onDragOver={e => e.preventDefault()}>
                    <AdminTableSurface
                        className="items-view-scroll rounded-none border-0"
                        columns={itemTableColumns}
                        rows={paginatedItems}
                        getRowKey={(item, index) => item.instanceId || `${item.name}-${index}`}
                        getRowTestId={(item, index) => `gm-item-row-${toTestId(item.name || item.instanceId || index)}`}
                        sortConfig={sortConfig}
                        onSort={handleSort}
                        onRowClick={(event, item, index) => handleSelect(event, item, index)}
                        onRowDoubleClick={(_event, item) => handleDoubleClick(item)}
                        onRowContextMenu={(event, item) => handleContextMenu(event, item, 'global')}
                        isRowSelected={isSelected}
                        getRowProps={(item) => ({
                            draggable: true,
                            onDragStart: (event) => handleDragStart(event, item, 'global'),
                        })}
                        renderCell={({ row: item, column }) => {
                            if (column.key === 'Available') {
                                const checked = availableItems.includes(item.name);
                                return (
                                    <input
                                        type="checkbox"
                                        checked={checked}
                                        aria-label={`${checked ? 'Make unavailable' : 'Make available'}: ${item.name}`}
                                        onChange={(event) => {
                                            event.stopPropagation();
                                            performAction(checked ? 'makeUnavailable' : 'makeAvailable');
                                        }}
                                        onClick={(event) => event.stopPropagation()}
                                    />
                                );
                            }
                            if (column.key === 'Formula') {
                                const checked = availableFormulas.includes(item.name);
                                return (
                                    <input
                                        type="checkbox"
                                        checked={checked}
                                        aria-label={`${checked ? 'Remove formula' : 'Add formula'}: ${item.name}`}
                                        onChange={(event) => {
                                            event.stopPropagation();
                                            performAction(checked ? 'removeFormula' : 'addFormula');
                                        }}
                                        onClick={(event) => event.stopPropagation()}
                                    />
                                );
                            }
                            return item[column.key];
                        }}
                        emptyLabel="No items match the current filters."
                        tableTestId="gm-items-table"
                    />
                    {/* Pagination */}
                    <AdminPagination
                        page={page}
                        totalPages={totalPages}
                        total={sortedGlobalItems.length}
                        pageSize={itemsPerPage}
                        pageSizeOptions={[25, 50, 100]}
                        onPageChange={setPage}
                        onPageSizeChange={(nextSize) => {
                            setItemsPerPage(nextSize);
                            setPage(1);
                        }}
                        label="items"
                    />
                    {/* Legacy inline pagination retired after shared AdminPagination cutover.
                        <button disabled={page === 1} onClick={() => setPage(p => p - 1)}>◀</button>
                        <span style={{ fontSize: '0.85em' }}>Page {page} / {totalPages}</span>
                        <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>▶</button>
                        <select value={itemsPerPage} onChange={e => { setItemsPerPage(Number(e.target.value)); setPage(1); }} style={{ marginLeft: 10 }}>
                            <option value={25}>25</option>
                            <option value={50}>50</option>
                            <option value={100}>100</option>
                        </select>
                    </div> */}
                </Card>

                {/* SIDE PANEL (Trader/Loot List + Inventory) — desktop only inline */}
                {!isMobile && sideMode !== 'none' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minHeight: 0 }}>
                        {/* TRADERS/LOOT LIST */}
                        <Card style={{ flex: '0 0 auto', maxHeight: '35%' }}>
                            <div style={{ padding: 8, borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#222' }}>
                                <span style={{ color: '#c5a059', fontWeight: 'bold' }}>{sideMode === 'trader' ? 'Traders' : 'Loot Bags'}</span>
                                <button
                                    data-testid={sideMode === 'trader' ? 'gm-items-create-trader' : 'gm-items-create-loot'}
                                    style={{ fontSize: '0.75em', background: '#333', border: '1px solid #555', padding: '3px 8px', cursor: 'pointer' }}
                                    onClick={sideMode === 'trader' ? handleCreateTrader : handleCreateLoot}
                                >
                                    + New
                                </button>
                            </div>
                            <div className="items-view-scroll" style={{ flex: 1, overflow: 'auto' }}>
                                {sideMode === 'trader' ? (
                                    /* TRADER TABLE */
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85em' }}>
                                        <thead style={{ position: 'sticky', top: 0, background: '#222', zIndex: 5 }}>
                                            <tr>
                                                <th style={{ padding: '4px 8px', textAlign: 'left', color: '#aaa', borderBottom: '1px solid #444' }}>Name</th>
                                                <th style={{ padding: '4px 8px', textAlign: 'left', color: '#aaa', borderBottom: '1px solid #444' }}>Category</th>
                                                <th style={{ padding: '4px 8px', textAlign: 'center', color: '#aaa', borderBottom: '1px solid #444' }}>Hidden</th>
                                                <th style={{ padding: '4px 8px', textAlign: 'right', color: '#aaa', borderBottom: '1px solid #444' }}>Items</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {sideLists.sliced.map(entry => (
                                                <tr
                                                    key={entry.id}
                                                    onClick={() => { setSelectedTraderId(entry.id); setSelectedLootId(null); setSelectedSideItems([]); }}
                                                    onDrop={e => handleDrop(e, 'trader', entry.id)}
                                                    onDragOver={e => e.preventDefault()}
                                                    style={{
                                                        cursor: 'pointer',
                                                        borderBottom: '1px solid #333',
                                                        background: sameId(selectedTraderId, entry.id) ? '#333' : 'transparent',
                                                        opacity: entry.hidden ? 0.6 : 1
                                                    }}
                                                >
                                                    <td style={{ padding: '5px 8px', color: '#ddd' }}>{entry.name}</td>
                                                    <td style={{ padding: '5px 8px', color: '#888', fontSize: '0.9em' }}>{entry.category || 'General'}</td>
                                                    <td style={{ padding: '5px 8px', textAlign: 'center' }}>
                                                        <input
                                                            type="checkbox"
                                                            checked={!!entry.hidden}
                                                            onClick={e => e.stopPropagation()}
                                                            onChange={e => {
                                                                e.stopPropagation();
                                                                runDataAction(dataActions.shop.setTraderHidden(entry.id, !entry.hidden));
                                                            }}
                                                            title={entry.hidden ? 'Hidden from players' : 'Visible to players'}
                                                        />
                                                    </td>
                                                    <td style={{ padding: '5px 8px', textAlign: 'right', color: '#888' }}>{entry.inventory.length}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                ) : (
                                    /* LOOT BAG LIST (keep existing div layout) */
                                    sideLists.sliced.map(entry => (
                                        <div
                                            key={entry.id}
                                            data-testid={`gm-lootbag-row-${entry.id}`}
                                            onClick={() => { setSelectedLootId(entry.id); setSelectedTraderId(null); setSelectedSideItems([]); }}
                                            onDrop={e => handleDrop(e, 'loot', entry.id)}
                                            onDragOver={e => e.preventDefault()}
                                            style={{
                                                padding: '6px 10px', cursor: 'pointer', borderBottom: '1px solid #333',
                                                background: sameId(selectedLootId, entry.id) ? '#333' : 'transparent',
                                                display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                                            }}
                                        >
                                            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                <span style={{ fontSize: '0.85em', opacity: entry.isLocked ? 0.4 : 1 }} title={entry.isLocked ? 'Hidden from players' : 'Visible to players'}>
                                                    {entry.isLocked ? '🚫' : '👁️'}
                                                </span>
                                                {entry.name}
                                            </span>
                                            <span style={{ color: '#888' }}>({entry.items.length})</span>
                                        </div>
                                    ))
                                )}
                            </div>
                            {sideLists.total > 1 && (
                                <div style={{ padding: 4, borderTop: '1px solid #333', display: 'flex', justifyContent: 'center', gap: 5 }}>
                                    <button disabled={sidePage === 1} onClick={() => setSidePage(p => p - 1)}>◀</button>
                                    <span style={{ fontSize: '0.75em' }}>{sideLists.current} / {sideLists.total}</span>
                                    <button disabled={sidePage === sideLists.total} onClick={() => setSidePage(p => p + 1)}>▶</button>
                                </div>
                            )}
                        </Card>

                        {/* INVENTORY TABLE */}
                        <Card style={{ flex: 1, minHeight: 0 }}>
                            <div style={{ padding: 8, borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#222' }}>
                                <span style={{ color: '#c5a059', fontWeight: 'bold' }}>
                                    {sideMode === 'trader' && (activeTrader ? activeTrader.name : 'Select Trader')}
                                    {sideMode === 'loot' && (activeLoot ? activeLoot.name : 'Select Loot')}
                                </span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    {sideMode === 'loot' && activeLoot && (
                                        <button
                                            style={{ fontSize: '0.75em', background: activeLoot.isLocked ? '#443322' : '#334433', border: '1px solid #555', padding: '3px 8px', cursor: 'pointer', borderRadius: 4, color: activeLoot.isLocked ? '#c88' : '#8c8' }}
                                            onClick={() => {
                                                if (!activeCampaign) return;
                                                runDataAction(dataActions.loot.updateLootBag(activeCampaign.id, activeLoot.id, bag => ({
                                                    ...bag,
                                                    isLocked: !bag.isLocked
                                                })));
                                            }}
                                        >
                                            {activeLoot.isLocked ? '🚫 Hidden' : '👁️ Visible'}
                                        </button>
                                    )}
                                    {sideMode === 'trader' && activeTrader && (
                                        <select
                                            value={activeTrader.category || 'General'}
                                            onChange={e => {
                                                runDataAction(dataActions.shop.updateTrader(activeTrader.id, {
                                                    category: e.target.value,
                                                }));
                                            }}
                                            style={{ fontSize: '0.75em', background: '#333', border: '1px solid #555', color: '#ddd', padding: '2px 6px', borderRadius: 4 }}
                                        >
                                            <option value="General">General</option>
                                            {SHOP_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                    )}
                                    <label style={{ display: 'flex', gap: 5, fontSize: '0.8em', cursor: 'pointer' }}>
                                        <input type="checkbox" checked={applySideFilters} onChange={() => setApplySideFilters(p => !p)} /> Filter
                                    </label>
                                </div>
                            </div>
                            {sideMode === 'loot' && activeLoot && (
                                <div style={{ padding: 5, borderBottom: '1px solid #333', display: 'flex', alignItems: 'center', gap: 5 }}>
                                    <span style={{ color: '#ffd700', fontSize: '0.8em' }}>Gold:</span>
                                    <input type="number" className="modal-input" style={{ width: 80, padding: 2 }} value={lootGoldDrafts[activeLoot.id] ?? activeLoot.goldValue ?? 0}
                                        onChange={e => {
                                            onLootGoldDraftChange?.(activeLoot.id, e.target.value);
                                        }}
                                        onBlur={() => onLootGoldCommit?.(activeLoot.id)}
                                        onKeyDown={e => {
                                            if (e.key === 'Enter') {
                                                e.currentTarget.blur();
                                            }
                                        }}
                                    />
                                </div>
                            )}
                            <div className="items-view-scroll" style={{ flex: 1, overflow: 'auto' }}>
                                <table style={{ width: '100%', fontSize: '0.85em', borderCollapse: 'collapse' }}>
                                    <thead style={{ position: 'sticky', top: 0, background: '#222' }}>
                                        <tr>
                                            {sideMode === 'trader' && <th style={{ padding: 4 }}>Av</th>}
                                            {sideMode === 'trader' && <th style={{ padding: 4 }}>Fm</th>}
                                            <th style={{ padding: 4, textAlign: 'left', cursor: 'pointer' }} onClick={() => handleSideSort('name')}>Name{sideSortConfig.key === 'name' && (sideSortConfig.direction === 'asc' ? ' ▲' : ' ▼')}</th>
                                            <th style={{ padding: 4, cursor: 'pointer' }} onClick={() => handleSideSort('level')}>Lvl{sideSortConfig.key === 'level' && (sideSortConfig.direction === 'asc' ? ' ▲' : ' ▼')}</th>
                                            <th style={{ padding: 4, cursor: 'pointer' }} onClick={() => handleSideSort('type')}>Type{sideSortConfig.key === 'type' && (sideSortConfig.direction === 'asc' ? ' ▲' : ' ▼')}</th>
                                            {sideMode === 'loot' && <th style={{ padding: 4 }}>Qty</th>}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredSideItems.map((item, idx) => (
                                            <tr
                                                key={item.instanceId || idx}
                                                draggable
                                                onDragStart={e => handleDragStart(e, item, sideMode)}
                                                onContextMenu={e => handleContextMenu(e, item, sideMode)}
                                                onClick={e => handleSideSelect(e, item, idx)}
                                                onDoubleClick={() => handleDoubleClick(item)}
                                                style={{
                                                    borderBottom: '1px solid #333',
                                                    background: isSideSelected(item) ? 'rgba(197, 160, 89, 0.25)' : (idx % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent'),
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                {sideMode === 'trader' && <td style={{ padding: 4 }}><input type="checkbox" checked={availableItems.includes(item.name)} onChange={e => { e.stopPropagation(); performAction(availableItems.includes(item.name) ? 'makeUnavailable' : 'makeAvailable'); }} onClick={e => e.stopPropagation()} /></td>}
                                                {sideMode === 'trader' && <td style={{ padding: 4 }}><input type="checkbox" checked={availableFormulas.includes(item.name)} onChange={e => { e.stopPropagation(); performAction(availableFormulas.includes(item.name) ? 'removeFormula' : 'addFormula'); }} onClick={e => e.stopPropagation()} /></td>}
                                                <td style={{ padding: 4 }}>
                                                    <ItemRow item={item} className="items-view-inline-row" />
                                                </td>
                                                <td style={{ padding: 4 }}>{item.level || 0}</td>
                                                <td style={{ padding: 4 }}>{item.type}</td>
                                                {sideMode === 'loot' && <td style={{ padding: 4 }}>{item.qty || 1}</td>}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </Card>
                    </div>
                )}

                {/* ITEM EDITOR MODAL */}
                {editingItem && (
                    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000, padding: 20 }}>
                        <div className="items-view-scroll" style={{ maxHeight: 'calc(100vh - 40px)', overflow: 'auto', borderRadius: 8 }}>
                            <ItemEditor
                                catalogType="item"
                                editorMode={editingItem.editorMode || (editingItem.sourceFile || editingItem.catalogOverrideId ? 'edit' : 'create')}
                                baseEntry={editingItem.editorMode === 'create' ? null : editingItem}
                                initialItem={editingItem.editorMode === 'create' || Object.keys(editingItem).length === 0 ? null : editingItem}
                                onSave={() => setEditingItem(null)}
                                onCancel={() => setEditingItem(null)}
                                onSaveCatalogEntry={(override) => {
                                    return dataActions.catalog.saveCatalogOverride(override);
                                }}
                                dbOnly
                            />
                        </div>
                    </div>
                )}

                {/* CONTEXT MENU */}
                {contextMenu && (
                    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 2000 }} onClick={closeContextMenu} onContextMenu={e => { e.preventDefault(); closeContextMenu(); }}>
                        <div data-testid="gm-items-context-menu" style={{ position: 'absolute', top: contextMenuPlacement.top, left: contextMenuPlacement.left, background: '#1a1a1a', border: '1px solid #444', borderRadius: 6, minWidth: 180, boxShadow: '0 8px 24px rgba(0,0,0,0.6)', overflow: 'visible' }} onClick={e => e.stopPropagation()}>
                            {/* Side panel context menu */}
                            {(contextMenu.source === 'trader' || contextMenu.source === 'loot') ? (
                                <>
                                    <CtxItem icon="🔍" label="View Details" onClick={() => { if (onInspectItem) onInspectItem(contextMenu.item); closeContextMenu(); }} />
                                    <CtxDivider />
                                    <CtxItem icon="🗑️" label="Remove Item" onClick={() => performAction('removeFromSide')} danger />
                                    {contextMenu.source === 'loot' && (
                                        <CtxItem icon="🔢" label="Set Amount" onClick={() => performAction('setAmount')} />
                                    )}
                                </>
                            ) : (
                                /* Main table context menu */
                                <>
                                    {availableItems.includes(contextMenu.item.name)
                                        ? <CtxItem icon="✓" label="Make Unavailable" onClick={() => performAction('makeUnavailable')} />
                                        : <CtxItem icon="+" label="Make Available" onClick={() => performAction('makeAvailable')} />
                                    }
                                    {availableFormulas.includes(contextMenu.item.name)
                                        ? <CtxItem icon="📖" label="Remove Formula" onClick={() => performAction('removeFormula')} />
                                        : <CtxItem icon="📜" label="Add Formula" onClick={() => performAction('addFormula')} />
                                    }
                                    <CtxDivider />
                                    <CtxItem icon="✏️" label="Edit Item" onClick={() => performAction('edit')} />
                                    <CtxItem icon="📋" label="Clone Item" onClick={() => performAction('clone')} />
                                    <CtxItem icon="🗑️" label="Delete Item" onClick={() => performAction('delete')} danger />
                                    <CtxItem icon="🔗" label="Copy Reference" onClick={() => performAction('copyReference')} />
                                    <CtxDivider />
                                    <div style={{ position: 'relative' }} onMouseEnter={() => setContextSubMenu('trader')} onMouseLeave={() => contextSubMenu === 'trader' && setContextSubMenu(null)}>
                                        <CtxItem icon="🏪" label="Assign to Trader" hasSubmenu />
                                        {contextSubMenu === 'trader' && (
                                            <div style={{ position: 'absolute', ...submenuPlacementStyle, top: 0, background: '#1a1a1a', border: '1px solid #444', borderRadius: 6, minWidth: 140, boxShadow: '0 8px 24px rgba(0,0,0,0.6)' }}>
                                                {traders.map(t => <CtxItem key={t.id} label={t.name} onClick={() => performAction('addToTrader', t.id)} />)}
                                            </div>
                                        )}
                                    </div>
                                    <div style={{ position: 'relative' }} onMouseEnter={() => setContextSubMenu('loot')} onMouseLeave={() => contextSubMenu === 'loot' && setContextSubMenu(null)}>
                                        <CtxItem icon="💰" label="Add to Loot Bag" hasSubmenu />
                                        {contextSubMenu === 'loot' && (
                                            <div style={{ position: 'absolute', ...submenuPlacementStyle, top: 0, background: '#1a1a1a', border: '1px solid #444', borderRadius: 6, minWidth: 140, boxShadow: '0 8px 24px rgba(0,0,0,0.6)' }}>
                                                {campaignLootBags.map(b => <CtxItem key={b.id} label={b.name} onClick={() => performAction('addToLoot', b.id)} />)}
                                            </div>
                                        )}
                                    </div>
                                    <div style={{ position: 'relative' }} onMouseEnter={() => setContextSubMenu('player')} onMouseLeave={() => contextSubMenu === 'player' && setContextSubMenu(null)}>
                                        <CtxItem icon="🎁" label="Give to Player" hasSubmenu testId="gm-items-give-to-player" />
                                        {contextSubMenu === 'player' && (
                                            <div style={{ position: 'absolute', ...submenuPlacementStyle, top: 0, background: '#1a1a1a', border: '1px solid #444', borderRadius: 6, minWidth: 140, boxShadow: '0 8px 24px rgba(0,0,0,0.6)' }}>
                                                {playerTargets.map(p => <CtxItem key={p.id} label={p.name} testId={`gm-items-give-player-${p.id}`} onClick={() => performAction('giveToPlayer', p.id)} />)}
                                            </div>
                                        )}
                                    </div>
                                    <div style={{ position: 'relative' }} onMouseEnter={() => setContextSubMenu('formula')} onMouseLeave={() => contextSubMenu === 'formula' && setContextSubMenu(null)}>
                                        <CtxItem icon="📜" label="Give Formula to Player" hasSubmenu />
                                        {contextSubMenu === 'formula' && (
                                            <div style={{ position: 'absolute', ...submenuPlacementStyle, top: 0, background: '#1a1a1a', border: '1px solid #444', borderRadius: 6, minWidth: 140, boxShadow: '0 8px 24px rgba(0,0,0,0.6)' }}>
                                                {playerTargets.map(p => <CtxItem key={p.id} label={p.name} onClick={() => performAction('giveFormulaToPlayer', p.id)} />)}
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* MOBILE SIDE PANEL (Trader / Loot) in BottomSheet */}
            {isMobile && sideMode !== 'none' && (
                <BottomSheet
                    isOpen={mobileSideOpen}
                    onClose={() => setMobileSideOpen(false)}
                    title={sideMode === 'trader' ? 'Traders' : 'Loot Bags'}
                    height="85vh"
                >
                    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
                        {/* List of traders / loot bags */}
                        <div style={{ flex: '0 0 auto', maxHeight: '35%', overflow: 'auto', borderBottom: '1px solid #444' }}>
                            <div style={{ padding: '6px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#1a1a1a' }}>
                                <span style={{ color: '#c5a059', fontWeight: 'bold', fontSize: '0.9em' }}>{sideMode === 'trader' ? 'Select Trader' : 'Select Loot Bag'}</span>
                                <button style={{ fontSize: '0.75em', background: '#333', border: '1px solid #555', padding: '3px 8px', cursor: 'pointer', color: '#ddd', borderRadius: 4 }} onClick={sideMode === 'trader' ? handleCreateTrader : handleCreateLoot}>+ New</button>
                            </div>
                            {sideMode === 'trader'
                                ? sideLists.sliced.map(entry => (
                                    <div key={entry.id} onClick={() => { setSelectedTraderId(entry.id); setSelectedLootId(null); setSelectedSideItems([]); }}
                                        style={{ padding: '10px 16px', cursor: 'pointer', borderBottom: '1px solid #333', background: sameId(selectedTraderId, entry.id) ? '#333' : 'transparent', display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: 44 }}>
                                        <span style={{ color: '#ddd' }}>{entry.name}</span>
                                        <span style={{ color: '#888', fontSize: '0.85em' }}>{entry.category || 'General'} · {entry.inventory.length} items</span>
                                    </div>
                                ))
                                : sideLists.sliced.map(entry => (
                                    <div key={entry.id} onClick={() => { setSelectedLootId(entry.id); setSelectedTraderId(null); setSelectedSideItems([]); }}
                                        style={{ padding: '10px 16px', cursor: 'pointer', borderBottom: '1px solid #333', background: sameId(selectedLootId, entry.id) ? '#333' : 'transparent', display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: 44 }}>
                                        <span style={{ color: '#ddd' }}>{entry.name}</span>
                                        <span style={{ color: '#888', fontSize: '0.85em' }}>{entry.items.length} items</span>
                                    </div>
                                ))
                            }
                        </div>
                        {/* Inventory of selected trader/loot */}
                        <div style={{ flex: 1, overflow: 'auto' }}>
                            {sideMode === 'trader' && activeTrader && (
                                <div style={{ padding: '6px 16px', background: '#1a1a1a', borderBottom: '1px solid #333', color: '#c5a059', fontWeight: 'bold', fontSize: '0.9em' }}>{activeTrader.name}</div>
                            )}
                            {sideMode === 'loot' && activeLoot && (
                                <div style={{ padding: '6px 16px', background: '#1a1a1a', borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ color: '#c5a059', fontWeight: 'bold', fontSize: '0.9em' }}>{activeLoot.name}</span>
                                    <span style={{ color: '#ffd700', fontSize: '0.8em' }}>Gold: {activeLoot.goldValue || 0}</span>
                                </div>
                            )}
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9em' }}>
                                <tbody>
                                    {filteredSideItems.map((item, idx) => (
                                        <tr key={item.instanceId || idx}
                                            onContextMenu={e => handleContextMenu(e, item, sideMode)}
                                            onClick={e => handleSideSelect(e, item, idx)}
                                            style={{ borderBottom: '1px solid #333', background: isSideSelected(item) ? 'rgba(197,160,89,0.25)' : 'transparent', cursor: 'pointer', minHeight: 44 }}>
                                            <td style={{ padding: '10px 16px', color: '#ddd' }}>
                                                <ItemRow item={item} className="items-view-inline-row" />
                                            </td>
                                            <td style={{ padding: '10px 8px', color: '#888', fontSize: '0.85em' }}>Lv{item.level || 0}</td>
                                            {sideMode === 'loot' && <td style={{ padding: '10px 8px', color: '#888' }}>×{item.qty || 1}</td>}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </BottomSheet>
            )}

            {/* Spell Scroll/Wand Selector for GM actions */}
            {pendingSpellAction && (
                <SpellScrollSelectorModal
                    rank={pendingSpellAction.rank}
                    type={pendingSpellAction.type}
                    db={db}
                    ignoreAvailability={true}
                    onCancel={() => setPendingSpellAction(null)}
                    onSelect={(spell) => {
                        const { action, arg, baseItem, type, rank } = pendingSpellAction;
                        const newItem = { ...baseItem };
                        newItem.system = baseItem.system ? deepClone(baseItem.system) : {};
                        newItem.system.originalName = baseItem.name;
                        newItem.name = `${type === 'scroll' ? 'Scroll' : 'Wand'} of ${spell.name} (Rank ${rank})`;
                        newItem.system.spell = spell;
                        if (type === 'wand') {
                            newItem.system.wand = { charges: 1, max: 1 };
                        }
                        executeItemAction(action, arg, [newItem]);
                        setPendingSpellAction(null);
                    }}
                />
            )}
        </>
    );
}

function buildItemFilterDefinitions(filterOptions = {}, columnsConfig = {}) {
    return Object.entries(filterOptions).map(([id, options]) => {
        const label = id === 'Available' ? 'Available'
            : id === 'Formula' ? 'Formula'
                : columnsConfig[id]?.label || id;
        if (options === true) {
            return {
                id,
                label,
                type: 'boolean',
                defaultValue: null,
            };
        }
        return {
            id,
            label,
            type: 'multi',
            defaultValue: [],
            options: (options || []).map((option) => ({
                value: option,
                label: String(option),
            })),
        };
    });
}

function getClampedContextMenuPlacement(contextMenu) {
    const fallback = { top: contextMenu?.y || 0, left: contextMenu?.x || 0, openLeft: false };
    if (!contextMenu || typeof window === 'undefined') return fallback;
    const margin = 8;
    const estimatedWidth = 230;
    const estimatedHeight = contextMenu.source === 'global' ? 430 : 150;
    const viewportWidth = window.innerWidth || estimatedWidth + margin * 2;
    const viewportHeight = window.innerHeight || estimatedHeight + margin * 2;
    const left = Math.max(margin, Math.min(contextMenu.x, viewportWidth - estimatedWidth - margin));
    const top = Math.max(margin, Math.min(contextMenu.y, viewportHeight - estimatedHeight - margin));
    return {
        left,
        top,
        openLeft: contextMenu.x + estimatedWidth + 180 > viewportWidth,
    };
}
