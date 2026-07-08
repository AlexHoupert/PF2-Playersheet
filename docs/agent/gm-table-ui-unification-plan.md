# GM Table UI Unification Plan

## Summary

Goal: unify the GM catalog/admin table UI around the EASY2-inspired toolbar, filter drawer, active filter chips, columns menu, stable pagination, quiet row styling, and viewport-safe context menus.

Default scope for this wave is **Catalog first**: Spells, Actions, Feats, Impulses, Items, Creatures, Abilities, and Deviant Abilities. Other GM lists are tracked as follow-up.

## Progress

### Phase 0: Plan and shadcn basis

- [x] Create this checklist.
- [x] Confirm shadcn project context.
- [x] Fetch current shadcn docs through Context7/shadcn CLI.
- [x] Install missing shadcn components: drawer, checkbox, dropdown-menu, pagination, separator, field.
- [x] Remove or integrate the generated pagination example file.
- [x] Full check after component installation.

### Phase 1: Shared GM table primitives

- [x] Add shared toolbar with compact search, filter button, columns button, and right-aligned actions.
- [x] Add filter drawer with two-column filter list/options layout.
- [x] Add active filter chips with inline close buttons.
- [x] Add column visibility menu.
- [x] Add advanced pagination with first/prev/number/ellipsis/next/last and page-size select.
- [x] Add viewport-safe shadcn context menu wrapper.
- [x] Add quiet shared table styling.

### Phase 2: CatalogAdminTableView cutover

- [x] Move Spells, Actions, Feats, and Impulses onto the shared toolbar/filter/table/pagination/context menu surface.
- [x] Replace inline status checkboxes and filter MultiSelects with drawer filters.
- [x] Header right-click opens the matching filter.
- [x] Search/filter/page-size changes reset page to 1.
- [x] Row selection uses the new blue selection state instead of gold/brown.

### Phase 3: Items cutover

- [x] Move GM Items toolbar to shared toolbar.
- [x] Move GM Items filter UI to shared drawer and chips.
- [x] Move GM Items pagination to shared pagination.
- [x] Update main item table row styling.
- [x] Replace manually positioned item context menu with viewport-safe menu.
- [ ] Keep Trader/Loot side flows functional.

### Phase 4: Bestiary, Abilities, Deviant Abilities

- [x] Move Bestiary to shared toolbar/filter/table/pagination/context menu.
- [x] Keep Bestiary reveal/group/metadata actions intact.
- [x] Move Abilities to shared table UI.
- [x] Move Deviant Abilities to shared table UI while keeping Pact-domain persistence.

### Phase 5: Follow-up GM tables

- [x] Inventory remaining GM tables/lists.
- [x] Migrate real tables or explicitly mark them as intentionally different.

Follow-up inventory:

- `AdminTabContent` still has the compact user table; this is a player-management table, not a catalog table.
- `ItemsViewLayout` still has domain-specific item/side-panel tables for Items, Trader, and Loot. Toolbar, filters, pagination, and clamped context placement are unified; a later ItemTable/SideTable extraction should handle the remaining repeated table markup.
- Map upload hidden file input is not a table UI and remains intentionally different.

### Phase 6: Verification

- [x] Static tests for filter chips, pagination, and context menu guard.
- [x] Fix post-cutover polish: Catalog toolbar stays above Spells/Feats/Impulses tables, filter drawer uses dark admin colors, and shared table context menus no longer use a visible zoom animation.
- [x] Compact toolbars without active filter chips and prevent Filter/Columns/ContextMenu overlays from shifting the admin layout.
- [ ] Targeted smoke tests for catalog, items, bestiary, abilities, and deviant abilities.
- [x] `npm run check`
- [ ] `npm run smoke` if E2E selectors were touched.
- [x] `git diff --check`

## Acceptance Criteria

- [x] Catalog-first GM tables share one toolbar/filter/table/pagination/context-menu surface.
- [x] Active filters are visible as closable badges.
- [x] Filter count appears in the Filter button.
- [x] Header right-click opens filtering for that column.
- [x] Pagination supports first/last and ellipsis and resets to page 1 when filters change.
- [x] Context menus remain inside the viewport near the bottom of the screen.
- [x] Table rows use a calm single dark background, no zebra rows, and a readable blue selected state.
