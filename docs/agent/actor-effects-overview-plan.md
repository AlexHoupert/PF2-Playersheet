# Actor Effects Overview

Status: complete

## Phase 0: Baseline

- [x] Existing ActorEffect, derived Effect, source, and removal paths inventoried.
- [x] Baseline `npm run check` passed with 229 tests.
- [x] Desktop and mobile Status/Drawer surfaces captured and inspected locally with the deterministic V2 fixture.

## Phase 1: Explainable rules view model

- [x] Resolver reports applied and suppressed contributions without changing totals.
- [x] Selector registry includes stable display groups and ordering.
- [x] `buildActorEffectOverview` groups Effects by affected value and source.

## Phase 2: Effect presentation

- [x] Persisted item, spell, impulse, feat, affliction, condition, persistent-damage, and custom Effects share one presentation contract.
- [x] Temporary source names, actor attribution, duration, removability, and rules-first tones are normalized.
- [x] Derived passive Effects stay out of the compact chip row.

## Phase 3: Status surface

- [x] Add a `Conditions & Effects` section below the health bar.
- [x] Render closable Effect chips with distinct open and remove targets.
- [x] Keep `Add Condition` available whenever the sheet is editable.
- [x] Add the fixed-width overview tile that opens the drawer.

## Phase 4: Actor Effects drawer

- [x] Responsive right-side desktop and bottom mobile drawer.
- [x] `Effects` and `Sources` views.
- [x] `Temporary` default scope with `All active` toggle.
- [x] Suppressed contributions, typed totals, caps, durations, and source actors are visible.

## Phase 5: Shared integration and verification

- [x] Player Status uses the shared overview.
- [x] Shared GM Actor sheet uses the same overview and removal action.
- [x] Unit and static regression tests cover resolver, presentation, and UI contracts.
- [x] `npm run check`, focused/full smoke, `git diff --check`, commit, and push complete.

## Verification

- `npm run check`: passed with 237 unit/static tests.
- `npm run smoke`: passed with 20 Chromium flows.
- Focused Effect smoke covers drawer inspection, exact-ID removal, and reload persistence.
- Desktop right drawer and mobile bottom drawer were visually inspected; the central modal layer hides the fixed mobile navigation while open.

## Decisions

- Temporary scope means persisted, non-derived ActorEffects.
- All active additionally includes derived passive source Effects.
- Players can remove every persisted Effect targeting their own Actor.
- Derived Effects are read-only and must be changed through their source.
- Rules-first tones use harmful/persistent semantics first, then PF2 bonus type.
- No Firestore migration is required.
