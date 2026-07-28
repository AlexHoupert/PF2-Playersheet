# GM Resource Workspace And Creature Expansion

Status: complete
Started: 2026-07-28

## Baseline

- [x] Existing architecture and risk documentation reviewed.
- [x] `npm run check` passes before implementation.
- [x] `npm run smoke` passes before implementation (28 tests).
- [x] Existing untracked `todo.md` identified and excluded from this work.
- [x] Desktop and mobile workspace screenshots captured after the shared layout is available.

## Phase 1: Shared Resizable Workspace

- [x] Install the local shadcn `Resizable` component.
- [x] Add `AdminResourceWorkspace` with persisted desktop panel sizes.
- [x] Add nested horizontal and vertical resize handles with usable minimum sizes.
- [x] Add a mobile upper/lower subtable drilldown.
- [x] Keep each table body independently scrollable.
- [x] Add a reset-layout action.

Acceptance: Items and Creatures use the same workspace primitive without local split-layout code.

## Phase 2: Shared Subtables And Context Menus

- [x] Add searchable, sortable `AdminSubtable` on top of `AdminTableSurface`.
- [x] Extend `AdminContextMenu` with nested actions.
- [x] Configure root and submenu collision handling at all viewport edges.
- [x] Remove the hand-built Items context menu.
- [x] Keep row actions keyboard accessible as an alternative to drag and drop.

Acceptance: Main menus and submenus remain fully usable near every viewport edge.

## Phase 3: Items, Trader And Loot

- [x] Move Items to `AdminResourceWorkspace`.
- [x] Unify and add search/sort to Trader and Loot subtables.
- [x] Add the agreed upper and lower row action sets.
- [x] Support drop onto an upper target row and the selected lower list.
- [x] Add inline Loot quantity editing.
- [x] Add Trader and Loot editors for their scoped fields.
- [x] Add Loot soft delete.
- [x] Add removable `Show in Main table` focus scope.
- [x] Make Customize affect only the selected occurrence.

Acceptance: Existing Item assignment, Trader, Loot, quantity, and Catalog workflows remain functional.

## Phase 4: Creature Index And Facets

- [x] Add pure `buildCreatureTableSummary` shared by build and runtime entries.
- [x] Upgrade the compact Creature index to version 2.
- [x] Include defenses, movement, perception, size, skills, traits, flags, and spellcasting modes.
- [x] Add optional sortable Creature columns.
- [x] Add number-range, keyed-number-range, and Boolean filters.
- [x] Keep static, override, clone, and custom Creature summaries equivalent.
- [x] Rebuild `src/data/creature_index.json` from source data.

Acceptance: Table filters never require loading all Creature detail files at runtime.

## Phase 5: Encounter Subtables In Creatures

- [x] Add `Creatures` / `Encounters` modes to Bestiary.
- [x] Show active Encounters above selected Encounter Creature combatants.
- [x] Add Encounter and Combatant context actions.
- [x] Add Creature drop onto Encounter row and selected combatant list.
- [x] Add unique Creature focus scope with instance counts.
- [x] Keep the full Encounter screen live and functional through shared actions.

Acceptance: A GM can assemble and maintain an Encounter from the Creature workspace.

## Phase 6: Encounter-local Customize

- [x] Open Creature editor with the selected combatant context.
- [x] Save a linked-only Campaign Creature fork.
- [x] Repoint only the selected combatant.
- [x] Hide linked-only forks from ordinary Catalog lists while retaining resolvability.
- [x] Preserve unreferenced forks as later cleanup candidates.

Acceptance: Customizing one combatant does not alter its source Creature or sibling combatants.

## Phase 7: Creature Spellcasting

- [x] Add pure spellcasting parse and serialization helpers.
- [x] Add Prepared, Spontaneous, Innate, and Focus editor modes.
- [x] Search and attach effective Catalog Spells with snapshots.
- [x] Preserve unknown Foundry fields and stable IDs.
- [x] Group CreatureCard spells by entry and rank.
- [x] Open shared Spell details from CreatureCard.
- [x] Preserve existing player reveal restrictions.

Acceptance: Existing and newly authored spellcasting survives edit, save, reload, and preview.

## Verification

- [x] Unit tests cover summary/index/filter/spellcasting behavior.
- [x] Domain tests cover Loot and Encounter mutations.
- [x] Component/static tests cover workspace, subtables, and nested context actions.
- [x] Playwright covers resizing, DnD, quantity edit, Encounter assembly, customize, scope, collision, and spellcasting.
- [x] `npm test` passes.
- [x] `npm run check:broad-writes` passes.
- [x] `npm run build:creatures` passes.
- [x] `npm run build:app` passes.
- [x] `npm run smoke` passes.
- [x] `git diff --check` passes.
- [x] Durable architectural facts are reflected in agent documentation.
