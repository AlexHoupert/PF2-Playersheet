# Lore System Overhaul

Status: complete (production migration verified; Rules Emulator execution remains a separate gate)

This document is the execution record for the campaign-scoped Lore overhaul. It is intentionally separate from the legacy top-level Lore recovery data. The approved production migration was completed on 2026-07-15; top-level source documents remain available for recovery.

## Phase 0: Baseline

- [x] Create this checked execution document.
- [x] Confirm the recovered source contains 16 Lore articles.
- [x] Record the current architecture: top-level `loreArticles`, global visibility, title-based links, no read state, no private notes.
- [x] Capture post-cutover GM, Player, mobile, and Bestiary screenshots during the final smoke pass.
- [x] Keep the top-level collection/global merge regression tests.

Baseline source: `recovery/recovered-lore-pacts-deviant-2026-07-06.json` (local recovery material, never committed). It contains 16 articles in History and Locations. Existing free-form group names are retained by migration. Legacy `[[Title]]` references are converted only when a title resolves uniquely.

## Phase 1: Data Model And Security

- [x] Add campaign-scoped `loreArticles`, `loreGroups`, `loreDeliveries`, and `knowledgeNotes` contracts.
- [x] Add actor-safe materialization for article and reveal-block audiences.
- [x] Add Firestore rules for GM drafts, actor deliveries, and owner-controlled notes.
- [x] Add required Firestore indexes/document query notes.

## Phase 2: Migration And Compatibility

- [x] Add a dry-run-first migration script with backup support.
- [x] Preserve article IDs and wrap legacy content in one normal body block.
- [x] Convert free group strings to stable nested group records.
- [x] Convert only unambiguous title links; report ambiguous/broken links.
- [x] Initialize published version 1 without historical notifications.
- [x] Keep top-level Lore documents as recovery data until separate cleanup approval.
- [x] Run the approved production migration with a backup and verify `16` articles, `5` groups, and `64` deliveries by reading Firestore back.

## Phase 3: Shared Lore Domain

- [x] Add `dataActions.lore` and a targeted Lore repository.
- [x] Add draft, group, publish, retract, archive, read, notification, and note actions.
- [x] Add shared renderer, reference resolver, backlinks, search, and link validation.
- [x] Keep content version and attention version independent.

## Phase 4: GM Workspace

- [x] Replace the old global list with campaign-scoped workspace/list/editor/preview components.
- [x] Add compact toolbar, filters, overview signals, and context actions.
- [x] Add nested group management.
- [x] Add autosave states and explicit publish.
- [x] Add structured infobox, links, audience, and reveal blocks.
- [x] Require confirmation before retract/archive of published content.

## Phase 5: Player Knowledge UX

- [x] Open Knowledge pages directly in their fixed category.
- [x] Add common search and category-specific list/reader metadata.
- [x] Add desktop index/reader and mobile list/reader behavior.
- [x] Keep Bestiary reveal-safe and technically separate.
- [x] Render inaccessible references as text, never as navigable leaks.

## Phase 6: Releases, Badges, And Notes

- [x] Add `LORE_RELEASE` to the central Player popup queue.
- [x] Add per-category and Knowledge-level unread alerts through `alertsByPage`.
- [x] Mark releases read when opened and notified when popup is dismissed.
- [x] Add autosaving private notes with optional GM sharing.
- [x] Add independent Party sharing and read-only Party-note presentation at Lore and Bestiary targets.
- [x] Let GMs inspect shared notes without edit rights.
- [x] Add the sortable/filterable own-notes overview tracked in `docs/agent/player-knowledge-notes-overview-plan.md`.

## Phase 7: Bestiary And Reference Integration

- [x] Include visible creatures in reference search.
- [x] Add Lore backlinks to GM creature detail.
- [x] Keep Bestiary publication/reveal authorization independent from Lore.
- [x] Reuse the Knowledge alert contract for optional Bestiary notifications.

## Phase 8: Verification And Rollout

- [x] Pure model, materialization, link, audience, notification, and note tests.
- [x] Action/repository adapter tests.
- [x] Firestore rule tests or documented emulator gate.
- [x] Component/static regression coverage.
- [x] Browser smoke for create, link, publish, popup, read, and shared note.
- [x] Mobile visual smoke for the GM workspace and Player reader; mutation coverage remains in the shared desktop fixture flow.
- [x] `npm run check` and `git diff --check` green.
- [x] Update durable agent documentation.
- [x] Commit and push completed implementation.

Verification details, the production migration result, and the deferred Rules Emulator gate are documented in `docs/agent/lore-migration-readiness.md`.

## Non-Goals

- Full article revision history.
- Giving companions their own Lore deliveries.
- Moving Creature source data into Lore.
- Deleting top-level recovery documents in this implementation.
- Deleting top-level recovery Lore after the migration; this still requires separate explicit approval.
