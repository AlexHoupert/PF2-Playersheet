import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const readSource = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('the shared dialog shell owns accessibility, modal-layer, and scroll behavior', () => {
    const source = readSource('src/shared/components/dialogs/AppDialogShell.jsx');

    assert.match(source, /<ModalLayerMount/);
    assert.match(source, /<Dialog open=/);
    assert.match(source, /grid-rows-\[auto_minmax\(0,1fr\)_auto\]/);
    assert.match(source, /onPointerDownOutside/);
    assert.match(source, /pb-\[max\(1rem,env\(safe-area-inset-bottom\)\)\]/);
    assert.doesNotMatch(source, /position:\s*['"]fixed/);
});

test('migrated player dialogs do not recreate fixed-position backdrops', () => {
    const migratedFiles = [
        'src/player/QuickSheetModal.jsx',
        'src/player/modals/ACModals.jsx',
        'src/player/modals/ConditionsModal.jsx',
        'src/player/modals/FormulaBookModal.jsx',
        'src/player/modals/ItemDetailModal.jsx',
        'src/player/modals/MagicModals.jsx',
        'src/player/modals/SimpleModals.jsx',
        'src/player/modals/SpellScrollSelectorModal.jsx',
        'src/player/modals/StatBreakdownModal.jsx',
        'src/shared/components/AbilityPicker.jsx',
        'src/shared/components/CreatureAbilityModal.jsx',
        'src/shared/components/CreatureSkillDetailDialog.jsx',
    ];

    for (const path of migratedFiles) {
        assert.doesNotMatch(readSource(path), /position:\s*['"]fixed/, path);
    }
});

test('sortable catalog tables use the shared admin table primitives', () => {
    const expectedPrimitives = new Map([
        ['src/admin/ActionsView.jsx', 'CatalogAdminTableView'],
        ['src/admin/SpellsView.jsx', 'CatalogAdminTableView'],
        ['src/admin/FeatsView.jsx', 'CatalogAdminTableView'],
        ['src/admin/ImpulsesView.jsx', 'CatalogAdminTableView'],
        ['src/admin/AbilitiesView.jsx', 'AdminTableSurface'],
        ['src/admin/BestiaryView.jsx', 'AdminTableSurface'],
        ['src/pacts/DeviantAbilitiesAdminView.jsx', 'AdminTableSurface'],
        ['src/admin/items/ItemsViewLayout.jsx', 'AdminTableSurface'],
    ]);

    for (const [path, primitive] of expectedPrimitives) {
        assert.match(readSource(path), new RegExp(primitive), `${path} must use ${primitive}`);
    }
});

test('catalog editors use a shared shell or the shared form-dialog composition', () => {
    const shellEditors = [
        'src/admin/editors/ActionEditor.jsx',
        'src/admin/editors/CreatureEditor.jsx',
        'src/admin/editors/FeatEditor.jsx',
        'src/admin/editors/ImpulseEditor.jsx',
        'src/admin/editors/ItemEditor.jsx',
        'src/admin/editors/SpellEditor.jsx',
    ];

    for (const path of shellEditors) {
        assert.match(readSource(path), /CatalogEditorShell/, path);
    }
    assert.match(readSource('src/admin/AbilitiesView.jsx'), /FormDialog/);
});

test('player catalog editors keep one scroll owner and render attach controls in the editor header', () => {
    const hostSource = readSource('src/player/components/PlayerCatalogEditorHost.jsx');
    const shellSource = readSource('src/admin/components/editor/CatalogEditorShell.jsx');
    const imagePickerSource = readSource('src/shared/components/ImagePicker.jsx');

    assert.match(hostSource, /contentBodyStyle=\{\{ height: '100%', overflow: 'hidden' \}\}/);
    assert.match(hostSource, /headerAction=/);
    assert.match(shellSource, /data-testid="catalog-editor-body"/);
    assert.match(shellSource, /\[touch-action:pan-y\]/);
    assert.match(imagePickerSource, /initialPath = 'ressources\/icons'/);
});
