# Smoke Results

Last updated: 2026-06-28.

## Scope

This file separates deterministic local browser smokes from manual Firebase-backed
production or preview smokes.

Automated smokes use the local Playwright E2E fixture and do not touch live
Firestore data. Manual smokes must be repeated against the deployed Firebase
environment before treating a build as production-verified.

## Automated Fixture Smokes

Command: `npx playwright test tests/e2e/playnight-smoke.spec.js --reporter=line --workers=1`

Result on 2026-06-28: `verified`.

| Flow | Result | Notes |
| --- | --- | --- |
| Auth gate without fixture bypass | verified | Confirms non-fixture route still renders the sign-in gate. |
| Player surface load | verified | Character, quests, loot, magic, spell override, and shop entry render. |
| Admin surface load | verified | Campaign, players, items, loot side list, quests, and encounter surfaces render. |
| Player HP, gold, condition edit plus reload | verified | Mutates local Actor-backed fixture state and verifies reload persistence. |
| GM custom item give to player plus reload | verified | Gives `Smoke Custom Charm`; player inventory displays it after reload. |
| Loot item claim and gold split plus reload | verified | Claims item, splits gold, and verifies player inventory/gold after reload. |
| Quest reward idempotency | verified | Objective reward applies once across repeated toggles/reload. |
| Encounter HP, initiative, condition effects | verified | Creature HP/initiative and player/creature effects persist across reload. |
| Spell catalog override in player add flow | verified | `Uplifting Overture` override appears as rank/level 0 in Add Spell. |

## Manual Firebase Smokes

| Flow | Result | Notes |
| --- | --- | --- |
| Legacy runtime is irrelevant / V2-only runtime confirmed | not tested | Needs deployed preview/production confirmation with real Firestore. |
| Inventory Item Row: icons, meta, actions | not tested | Automated fixture covers basic inventory visibility, not visual icon/meta review. |
| Shop Item Row: buy price, quantity, give/buy | not tested | Needs manual preview smoke. |
| Loot Item Row: claim, partial claim, gold split | not tested | Automated fixture covers single claim and split; partial claim still manual. |
| GM Items side lists: trader/lootbag selection, icons, actions | not tested | Automated fixture covers lootbag creation and item give only. |
| Production catalog edit and player visibility | not tested | Automated fixture covers override visibility; deployed Firestore write still manual. |

## Notes

- The automated fixture intentionally persists runtime mutations through
  `localStorage` under `pf2:e2e-runtime-db`.
- The fixture does not replace live Firestore smoke checks, because rules,
  auth, subscriptions, and multi-client timing are outside its scope.
