# Player Knowledge Notes Overview

Status: implemented and verified

This document tracks the next Lore follow-up: one Player page for finding and
maintaining every note created by the assigned Actor. Party-shared notes remain
visible at their source entries; the first overview scope is deliberately the
Player's own notes.

## Product Contract

- [x] Add `knowledge.notes` as a Player Knowledge page with its own navigation icon.
- [x] Show all notes owned by the assigned Actor across Lore articles and visible creatures.
- [x] Keep the existing article/creature note editors as the canonical write surface.
- [x] Allow editing, deleting, and changing GM/Party sharing from the overview without duplicating persistence logic.
- [x] Resolve a note's current target first and use stored target metadata only as a fallback.
- [x] Preserve notes whose article was retracted or creature became hidden; mark the target unavailable instead of losing the note.

## Phase 0: Baseline And ViewModel

- [x] Record current own-note and Party-note behavior in a browser smoke.
- [x] Add a pure `buildKnowledgeNoteViewModels` selector.
- [x] Join notes with Player deliveries, Lore groups, visible creatures, and Actor metadata.
- [x] Return stable fields: note ID, content, target type/ID/title/category, sharing state, created/updated timestamps, target accessibility, and navigation command.
- [x] Extend new note writes with a small `targetSnapshot` (`title`, `category`, optional image) for orphan fallback; do not require a bulk migration for existing notes.

Success criteria:

- Every existing own note produces one deterministic row.
- Retracted or currently hidden targets remain represented without leaking inaccessible source data.
- The selector contains no React or Firestore dependencies.

## Phase 1: Search, Filters, And Sorting

- [x] Add full-text search over note content and resolved target title.
- [x] Add filters for target type (`Lore`, `Bestiary`), Lore category, sharing state (`Private`, `GM`, `Party`, `GM + Party`), and unavailable targets.
- [x] Add sorting by `Last edited` (default), `Created`, `Target title`, and `Category`.
- [x] Store filter/sort state in page-local state; do not persist it in Firestore.
- [x] Reset pagination or virtual window position whenever filters change.

Success criteria:

- A Player can isolate every sharing state and target family.
- Search and filters compose predictably and never hide a matching note because its target is unavailable.

## Phase 2: Responsive Notes Workspace

- [x] Build a dense desktop list plus reader/editor workspace using existing Knowledge styling.
- [x] Build a mobile list-to-detail flow that does not place an editor beneath an excessively long list.
- [x] Display target icon, title, category/group, edited date, a short note excerpt, and sharing badges.
- [x] Provide clear empty states for no notes and no filter matches.
- [x] Add `Open source` when the target is still accessible.
- [x] Reuse `KnowledgeNoteEditor` for editing and sharing controls; extract a shared editor body only if the overview needs a different shell.

Success criteria:

- Players can read and edit any own note without first remembering its source article.
- Mobile actions remain reachable with the fixed Player navigation and modal layers active.
- No second note-save implementation is introduced.

## Phase 3: Navigation And Attention

- [x] Add the Notes entry to the Knowledge drawer and desktop navigation.
- [x] Choose a Game Icons asset consistent with the existing Player navigation set.
- [x] Show the total own-note count as neutral metadata, not as an unread alert.
- [x] Preserve current Lore-release badges independently from note counts.
- [x] Support deep navigation from an overview row to its Lore article or Bestiary creature.

Success criteria:

- Notes are reachable in one navigation action from every Player page.
- Note counts cannot be confused with new Lore-release alerts.

## Phase 4: Tests And Acceptance

- [x] Unit-test target resolution, orphan fallback, search, filters, and sorting.
- [x] Test private, GM-shared, Party-shared, and dual-shared note viewmodels.
- [x] Add a Playwright flow that creates notes on an article and a creature, finds both in the overview, filters them, edits one, and opens its source.
- [x] Add mobile smoke coverage for list/detail transitions, textarea scrolling, and fixed navigation clearance.
- [x] Run `npm run check`, `npm run smoke`, and `git diff --check`.

Acceptance criteria:

- All notes created by the assigned Actor are visible in one sortable/filterable page.
- Existing contextual note editors and Party-note visibility continue to work.
- Notes survive inaccessible targets and remain editable/deletable by their owner.
- Other Players can never edit or delete Party-shared notes.

## Non-Goals

- A collaborative Party wiki or comments thread.
- GM editing of Player notes.
- Full note revision history.
- Showing all Party notes in the owner's overview during the first pass.
