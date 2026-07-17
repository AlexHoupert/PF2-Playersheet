# Catalog Effects And Campaign Permissions

Status legend: `[ ]` planned, `[~]` in progress, `[x]` complete, `[-]` deferred by design.

## Objective

Replace source-specific runtime rule hardcodes with declarative catalog effect
definitions and introduce campaign-scoped catalog authoring, roles, audit events,
approval requests, and player contributions. Global catalogs remain admin-owned;
normal campaign work must not mutate them.

## Baseline

- [x] `npm run check` passes on `main` at `91f2020d`.
- [x] `npm run smoke` passes all 19 Chromium smoke tests.
- [x] Existing mutagen, Scaly Skin, daily preparation, catalog write, member role,
  actor effect, and editor paths inventoried.
- [x] No live migration or global catalog promotion is part of implementation.

## Phase 1: Roles And Capabilities

- [x] Add canonical campaign roles: `player`, `trusted_player`, `assistant_gm`,
  `spectator`, `gm`, and `admin`.
- [x] Add a pure capability selector and remove permission decisions based on
  `?admin=true`.
- [x] Add `dataActions.member.setRole` and a role selector in Sessions.
- [x] Restrict Assistant GM navigation to Items, Spells, Impulses, Feats,
  Actions, Lore, and Campaign Changes.
- [x] Make Spectator surfaces read-only and allow PC actor selection.
- [x] Harden Firestore rules around campaign membership and capabilities.

Success criteria:

- URL parameters select a surface but never grant privileges.
- Every runtime permission check consumes the shared capability model.
- Spectators cannot create, update, or delete campaign data.

## Phase 2: Campaign Catalog And Audit

- [x] Add campaign subcollections `catalogEntries`, `catalogChangeEvents`,
  `effectRequests`, and `loreContributions`.
- [x] Merge catalog data as static, global override, campaign entry.
- [x] Add targeted repositories/actions for campaign catalog writes and immutable
  audit events.
- [x] Store normal GM edits campaign-scoped by default.
- [x] Permit player-owned custom/fork entries without permitting base overrides.
- [x] Add Campaign Changes view with filtering and revert.
- [x] Mark player-authored rows with a `Player` badge.

Success criteria:

- Campaign edits are isolated between campaigns.
- Every catalog mutation has a before/after audit event and can be reverted.
- Only global admins can explicitly promote content globally.

## Phase 3: Effect Definition Contract

- [x] Define and validate `rules.effectDefinitions[]`.
- [x] Add safe value scaling, predicates, modifier and apply-action contracts.
- [x] Add selector registry for supported actor stats.
- [x] Reject arbitrary paths, executable code, unsupported selectors and invalid
  lifecycle combinations.

Success criteria:

- Effect definitions are serializable, validated and contain no executable code.
- Invalid rules cannot be saved through domain actions or editors.

## Phase 4: Shared Effect Editor

- [x] Build reusable `EffectDefinitionEditor`.
- [x] Integrate it into Item, Spell, Feat and Impulse editors.
- [x] Provide source-specific defaults, multiple definitions, validation errors,
  and a readable rule summary.

Success criteria:

- All four editors write the same rule shape.
- A GM can express passive, usable, targeting, duration, scaling and predicates
  without editing JSON.

## Phase 5: Effect Runtime

- [x] Derive passive source effects from equipped items and learned feats,
  spells, and impulses.
- [x] Combine persisted and derived effects in the Actor Rules ViewModel.
- [x] Add source-effect apply/remove and duration advancement actions.
- [x] Tick configured effects once at actor turn start/end.
- [x] Support manual out-of-encounter advancement.
- [x] Remove daily-preparation effects atomically during preparation.

Success criteria:

- Unequipping/removing a passive source removes its effect immediately.
- Activated effects persist and expire deterministically without duplicate ticks.
- Existing ActorEffect stacking remains authoritative.

## Phase 6: Targeting And GM Approval

- [x] Add target selector for self, party, guest actors, and active encounter
  combatants.
- [x] Apply self/party actor effects directly.
- [x] Create deduplicated `effectRequests` for creature targets.
- [x] Add GM approve/reject UI and atomically charge consumables on approval.
- [x] Keep Assistant GM approval read-only.

Success criteria:

- Creature effects cannot be applied without GM/admin approval.
- Repeated activation cannot create duplicate open requests or consume twice.

## Phase 7: Player Authoring And Role Surfaces

- [x] Enable Trusted Player creation/forking in existing player views.
- [x] Link a forked inventory instance or impulse reference to its campaign entry.
- [x] Add immediate, clearly labelled party-visible Lore contributions.
- [x] Allow GM archive/promote-to-official actions for contributions.
- [x] Complete Assistant GM and Spectator route behavior.

Success criteria:

- Trusted players can contribute without mutating static/global content.
- Main GM has audit, revert, archive, and official-promotion control.

## Phase 8: Existing Rules Migration

- [x] Seed declarative Quicksilver Mutagen definitions.
- [x] Seed Scaly Skin, Bless, and Metal Carapace definitions.
- [x] Add a dry-run/backfill script with report and backup support.
- [-] Keep live write behind explicit user approval. The live write has not been
  run; the offline planner currently reports 27 candidate writes.
- [x] Remove matching runtime hardcodes only after declarative regression tests
  pass.

Success criteria:

- Quicksilver, Scaly Skin, Bless, and Metal Carapace use the shared resolver.
- The backfill is idempotent, dry-run by default, and recoverable.

## Verification Gates

- [x] Reducer/resolver tests cover stacking, caps, set, predicates, scaling,
  apply-actions and passive derivation.
- [x] Lifecycle tests cover equip, consume, daily prep, turn ticks and manual
  advancement.
- [x] Repository tests cover catalog audit, request approval and idempotency.
- [~] Static security-contract tests cover role gates and scoped writes. A real
  Firestore Rules Emulator run remains an operational deployment gate.
- [x] UI/browser smokes cover editors, forks, audit/revert, targeting, approval,
  assistant and spectator behavior.
- [x] Final `npm run check`, `npm run smoke`, and `git diff --check` pass after
  the resumed implementation pass.

## Completion Notes

- Campaign catalog promotion is an explicit global-admin operation and now emits
  an immutable campaign audit event.
- Direct party effects write only targeted ActorEffect documents when no actor
  state changes; consumable costs and on-apply actor changes remain transactional.
- The seed/backfill command is `npm run backfill:catalog-effects`. It is dry-run
  by default and requires both `--write` and `--confirm-write` for persistence.
- The authenticated Firestore dry-run was not executed in the final local gate
  because no migration credentials were present. The command exited before any
  Firestore read or write; pure planner coverage remains green.

## Explicit Non-Goals

- [-] No arbitrary JavaScript or free actor data paths in catalog rules.
- [-] No real-time out-of-encounter clock in this wave.
- [-] No automatic global promotion.
- [-] No live Firestore backfill without a separate explicit instruction.
