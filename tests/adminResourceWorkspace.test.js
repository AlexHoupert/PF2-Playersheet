import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
    matchesKeyedNumberRange,
    matchesNumberRange,
} from '../src/admin/components/table/adminTableFilters.js';
import { filterAndSortSubtableRows } from '../src/admin/components/table/adminSubtableModel.js';

const readSource = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('admin number range filters support direct and typed creature values', () => {
    assert.equal(matchesNumberRange(12, { min: 10, max: 14 }), true);
    assert.equal(matchesNumberRange(9, { min: 10 }), false);
    assert.equal(matchesKeyedNumberRange([
        { type: 'fire', value: 5 },
        { type: 'cold', value: 10 },
    ], { key: 'cold', min: 8 }), true);
    assert.equal(matchesKeyedNumberRange([{ key: 'stealth', bonus: 12 }], { key: 'arcana', min: 10 }), false);
});

test('admin subtables search and sort their own rows deterministically', () => {
    const columns = [
        { key: 'name', label: 'Name' },
        { key: 'count', label: 'Count' },
    ];
    const rows = [
        { id: 'a', name: 'Second Encounter', count: 2 },
        { id: 'b', name: 'First Encounter', count: 12 },
    ];

    assert.deepEqual(
        filterAndSortSubtableRows(rows, columns, 'encounter', { key: 'count', direction: 'desc' }).map(row => row.id),
        ['b', 'a']
    );
    assert.deepEqual(
        filterAndSortSubtableRows(rows, columns, 'first', { key: 'name', direction: 'asc' }).map(row => row.id),
        ['b']
    );
});

test('resource workspaces and nested context actions use shared collision-safe primitives', () => {
    const workspace = readSource('src/admin/components/table/AdminResourceWorkspace.jsx');
    const contextMenu = readSource('src/admin/components/table/AdminContextMenu.jsx');
    const items = readSource('src/admin/items/ItemsViewLayout.jsx');
    const bestiary = readSource('src/admin/BestiaryView.jsx');

    assert.match(workspace, /ResizablePanelGroup/);
    assert.match(workspace, /localStorage/);
    assert.match(workspace, /Reset workspace layout/);
    assert.match(contextMenu, /ContextMenuSubContent/);
    assert.match(contextMenu, /avoidCollisions/);
    assert.match(contextMenu, /collisionPadding/);
    assert.match(items, /AdminResourceWorkspace/);
    assert.match(bestiary, /AdminResourceWorkspace/);
    assert.match(bestiary, /Add to Encounter/);
});
