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

## Refinement: Compact Drawer and Rule Hierarchies

- [x] Mobile drawer opens from the left at `min(90vw, 420px)` and uses the full dynamic viewport height.
- [x] Passive Effects use one `Include passive effects` switch instead of scope tabs.
- [x] The overview button is the real Drawer trigger; focus enters the Drawer and returns to the trigger without an `aria-hidden` warning.
- [x] Effect and Source rows are closed, independently expandable shadcn Accordions.
- [x] Persistent Damage renders once per effective damage type as its formula, never as its average roll.
- [x] Manual Encounter Effects no longer attribute the target Actor as their source.
- [x] Actor attribution is limited to external `cast`, `activate`, and `consume` sources.
- [x] Prone and Grabbed expose rule trees consumed by both the resolver and Source hierarchy.
- [x] Attack selectors distinguish all/Strength/Dexterity/Melee/Ranged dimensions while preserving legacy aliases.
- [x] Spell and Impulse attack modifiers are resolved independently from their DC modifiers.
- [x] AC Dexterity Cap remains effective in rules but is excluded from the Drawer.

### Refinement Verification

- Focused unit/static suite: passed with 59 tests.
- Focused Chromium smoke: Drawer focus, focus return, no `aria-hidden` warning, and mobile left-side geometry passed.
- Full `npm run check`: passed with 241 unit/static tests, Broad-Write-Guard, lint, and production build.
- Full `npm run smoke`: passed with 21 Chromium flows, including desktop/mobile Drawer screenshots.
