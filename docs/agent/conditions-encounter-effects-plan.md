# Conditions And Encounter Effects Hardening

Status: implementation in progress. This document is the execution record for the shared V2 `actorEffects` display contract.

## Phase 1: Shared Effect Presentation

- [x] Add a pure presentation selector for `condition`, `damage_effect`, `affliction`, and `custom` effects.
- [x] Define stable presentation fields: ID, label, category, value, hidden state, description, and variant.
- [x] Keep rules-only effects such as feat, item, and mutagen effects out of conditions chips.
- [x] Treat `hidden: false` as the default and filter only hidden effects for Party readers.
- [x] Add dedicated descriptions for persistent damage, afflictions, and custom conditions.

Success criteria:

- [x] Player, GM, and Party code reuse the same presentation selector.
- [x] Non-display effects cannot appear as Conditions chips.

## Phase 2: Player Conditions Dialog And Mobile Layout

- [x] Replace the fixed legacy conditions modal with a modal-layer-friendly surface that is bottom-aligned on narrow viewports.
- [x] Use dynamic viewport height, safe-area padding, a scrollable body, and a reachable fixed footer.
- [x] Add live search below condition tabs, including the Active tab.
- [x] Make the Active tab show displayable standard conditions, persistent damage, afflictions, and custom badges.
- [x] Let players remove persistent damage, afflictions, and custom conditions from their own sheet.
- [x] Make health-bar chips open the exact active effect by ID.
- [x] Remove the generic `Persistent Damage` and `Fast Healing` picker entries.

Success criteria:

- [ ] Verify Conditions dialog scrolling and Close reachability on short physical mobile devices.
- [x] Supported effect categories appear beneath the health bar and open their exact details.

## Phase 3: Encounter And Party Effect Visibility

- [x] Pass presentation effects to GM initiative cards.
- [x] Pass non-hidden presentation effects to Party initiative cards.
- [x] Add `Share with party` controls to condition, persistent damage, and custom condition encounter dialogs.
- [x] Keep the future Affliction dialog explicit and reserve the same visibility control.
- [x] Respect Creature save reveal state in Party compact cards.
- [x] Use configured false save rankings without falling back to real values.

Success criteria:

- [x] Party cards show non-hidden standard, persistent, affliction, and custom effects.
- [x] Unrevealed creature saves do not leak into Party cards.

## Phase 4: Defeated Combatants And Turn Order

- [x] Normalize encounters around `currentTurnCombatantId` and retain `currentTurnIndex` only for old encounter compatibility.
- [x] Add shared ordered-turn helpers for reducers and encounter readers.
- [x] Add GM `Set Defeated` for creature combatants.
- [x] Preserve defeated cards in GM view while dimming and labeling them.
- [x] Hide defeated combatants from the Party list.
- [x] Skip defeated combatants on End Turn and restore them when HP becomes positive.

Success criteria:

- [x] End Turn cannot land on a defeated combatant.
- [x] HP edits above zero restore normal initiative participation.

## Phase 5: One-Time Legacy Cleanup

- [x] Add a dry-run-by-default cleanup script: `npm run cleanup:legacy-conditions`.
- [x] Add matching pure cleanup-plan tests and exact case-insensitive matching rules.
- [x] Back up matching records to `migrationBackups/{backupId}/campaigns/{campaignId}` in explicit `--write` mode.
- [x] Restrict deletion to legacy standard-condition records named `Persistent Damage` or `Fast Healing` and matching legacy combatant badge values.
- [ ] Run the dry-run against the target Firestore project and inspect `recovery/legacy-condition-cleanup-report.json`.
- [ ] Run `npm run cleanup:legacy-conditions -- --write` only after the dry-run is approved.

Local status on 2026-07-10: the script starts and its Node Firebase import is verified, but this checkout has no `VITE_FIREBASE_API_KEY` / `VITE_FIREBASE_PROJECT_ID` values. No Firestore read or write was attempted. Supply target-project configuration before the dry-run.

Success criteria:

- [ ] Stored legacy generic Persistent Damage and Fast Healing records are removed via the audited write run.
- [x] New persistent damage remains exclusively `actorEffects(category="damage_effect")`.

## Phase 6: Verification And Documentation

- [x] Add unit coverage for effect presentation and turn order.
- [x] Add reducer coverage for Set Defeated and HP-based revival.
- [x] Add cleanup-plan coverage for exact-match removal and idempotency.
- [x] Add deterministic browser smoke coverage for Player effect removal, Party visibility, and defeated filtering.
- [x] Run `npm run check` (tests, guards, lint, and production build on 2026-07-10).
- [x] Run the local smoke suite (`13/13` Playwright fixture tests on 2026-07-10).
- [ ] Run the manual mobile acceptance matrix, including short-viewport Conditions dialog scrolling.

## Commands

```powershell
npm test
npm run check:broad-writes
npm run lint
npm run build:app
npm run smoke
npm run cleanup:legacy-conditions
```

The cleanup script only reads Firestore until `--write` is supplied. Its write mode creates a Firestore backup before deleting legacy records.
