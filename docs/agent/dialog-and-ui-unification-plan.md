# Dialog And UI Unification

Status: complete

## Baseline

- Branch: `main`
- Baseline date: 2026-07-23
- `npm run check`: passed (253 tests, broad-write guard, lint, production build)
- `npm run smoke`: passed (25 Playwright tests)
- Existing untracked `todo.md` is unrelated and remains untouched.

## Current Surface Inventory

| Surface | Current implementation | Target |
| --- | --- | --- |
| Item, spell, action, feat, impulse details | `ItemDetailModal`, `ItemDetailContent`, `ContentPreviewCard` | Shared catalog detail viewmodel and content renderer |
| Creature ability and skill details | Separate fixed overlays | Shared dialog shell with focused content renderers |
| Deviant ability details | Nested in Pact offer flow | Extracted detail renderer |
| Conditions and stat details | Feature-specific custom overlays | Shared shell, retained domain behavior |
| Formula book and pickers | Feature-specific custom overlays | Shared workflow dialog composition |
| Player event popups | Popup queue and modal-layer overlays | Remain event popups |
| Actor Effects, filters, navigation | Drawers and bottom sheets | Remain drawers/sheets |
| GM catalog tables | Mostly shared table primitives | Finish Items adoption and add guard |
| Catalog editors | Shared save contract, duplicated shells | Shared editor shell and field primitives |

## Execution Checklist

### Phase 0 - Baseline And Tracking

- [x] Create this execution document.
- [x] Record dialog, table, editor, and overlay boundaries.
- [x] Record green unit/build/smoke baseline.
- [x] Add representative visual smoke artifacts for shared dialogs through Playwright attachments on short mobile viewports.

### Phase 1 - Shared Dialog Shell

- [x] Add `AppDialogShell` with sticky header/footer and a scroll-only body.
- [x] Register open dialogs with `ModalLayerProvider`.
- [x] Add footer-only Close, Escape handling, focus restoration, and protected backdrop behavior.
- [x] Add responsive size variants and safe-area footer padding.
- [x] Add thin `FormDialog` and `PickerDialog` compositions.

### Phase 2 - Catalog Details

- [x] Add a normalized catalog detail viewmodel.
- [x] Add shared header, trait, metadata, and rich-description primitives.
- [x] Reuse shared catalog content in Player details, Admin preview, and Item editor preview.
- [x] Move catalog inspection to canonical `catalog_detail` modal state.
- [x] Preserve reference history and inventory-specific action sections.

### Phase 3 - Specialized Information Dialogs

- [x] Migrate creature ability details.
- [x] Migrate creature skill details.
- [x] Extract and migrate Deviant Ability details.
- [x] Consolidate stat breakdown details.
- [x] Move Conditions onto the shared shell without changing ActorEffect behavior.

### Phase 4 - Workflow And Form Dialogs

- [x] Migrate Formula Book and selection dialogs.
- [x] Migrate AC, Shield, Magic, and simple Character forms.
- [x] Migrate Item Actions and Quick Sheet where the shared shell fits.
- [x] Keep popup queue, Actor Effects, filter, navigation, and map drawers specialized.

### Phase 5 - GM Tables

- [x] Move the primary Items table to `AdminTableSurface`.
- [x] Reuse table primitives for Trader/Loot where their interaction contract permits it.
- [x] Add a static guard for new sortable/filterable GM tables.
- [x] Document intentional specialized workspaces.

Trader and Loot remain compact drag-and-drop sidepanels inside Items. Their selection, drop targets, visibility controls, quantity editing, and loot-gold controls do not match the sortable catalog table contract. Lore, Campaign Changes, Members, Quests, Maps, and similar process-oriented views remain purpose-built workspaces.

### Phase 6 - Catalog Editors

- [x] Add `CatalogEditorShell`, `EditorSection`, and `EditorFieldRow`.
- [x] Migrate Spell, Feat, Impulse, and Action editors.
- [x] Migrate Item and Ability editor shells.
- [x] Migrate only the outer Creature editor shell.
- [x] Keep Lore, Quest, and Map editors specialized.

Ability authoring is an actual modal workflow and therefore uses the shared `FormDialog`; the larger catalog editors use `CatalogEditorShell`. All retain their domain-specific fields and validation.

### Final Acceptance

- [x] Catalog details expose the same core data in Player, Admin, and editor preview surfaces.
- [x] Dialog focus, background scroll lock, Escape, and reference Back navigation are verified.
- [x] No new hand-built fixed dialog backdrop is introduced.
- [x] `npm run check`, `npm run smoke`, and `git diff --check` pass.
- [ ] Functional changes are committed and pushed to `main`.

## Verification

- `npm run check`: passed with 260 tests, broad-write guard, lint, and production build.
- `npm run smoke`: passed with 26 Chromium tests, including short-mobile dialog focus and sticky-header/footer coverage.
- `git diff --check`: passed.
