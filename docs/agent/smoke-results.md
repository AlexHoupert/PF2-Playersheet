# Smoke Results

Last updated: 2026-07-08.

## Scope

This file separates deterministic local browser smokes from manual Firebase-backed
production or preview smokes.

Automated smokes use the local Playwright E2E fixture and do not touch live
Firestore data. Manual smokes must be repeated against the deployed Firebase
environment before treating a build as production-verified.

## Automated Fixture Smokes

Command: `npm run smoke`

Result on 2026-07-08: `verified`.

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
| Admin spell edit immediate refresh and Copy Reference | verified | Static spell edit writes an override, table context is retained, and Copy Reference resolves the effective entry. |
| Admin action hide/delete and Deleted filter | verified | Static action delete writes a hide override and the Deleted status filter reveals the hidden original. |
| Admin item edit/clone semantics | verified | Static item edit updates the effective row without a duplicate; clone creates a custom copy. |
| Admin creature production-style edit | verified | Creature editor writes a DB override in production-like mode instead of requiring file writes. |
| Encounter effect removal via closable badge | verified | Effect-backed combatant condition badges can be removed and re-added through the encounter UI. |

## Manual Firebase Smokes

| Flow | Result | Notes |
| --- | --- | --- |
| Legacy runtime is irrelevant / V2-only runtime confirmed | verified | 2026-07-02 production smoke reached V2 production, rendered Player and Admin/Sessions with real Firestore data, and confirmed Actor-backed Player edits plus GM item/loot/quest flows. |
| Inventory Item Row: icons, meta, actions | not tested | Automated fixture covers basic inventory visibility, not visual icon/meta review. |
| Shop Item Row: buy price, quantity, give/buy | not tested | Needs manual preview smoke. |
| Loot Item Row: claim, partial claim, gold split | partial | Production smoke verified isolated lootbag creation, item claim, and single-character gold split. Partial claim still manual. |
| GM Items side lists: trader/lootbag selection, icons, actions | verified | Production smoke verified selecting `Test V2`, creating lootbags, setting gold after commit, adding an item to a lootbag, and giving an item to player `test`. |
| Production catalog edit and player visibility | not tested | Automated fixture covers override visibility and table refresh; deployed Firestore catalog edit still manual. |

## Production Smoke Attempts

### 2026-07-02

- URL: `https://pf-2-playersheet.vercel.app/`
- Result: `partial`
- Zscaler warning page appeared in the smoke environment and was bypassed with its `Continue` button.
- Email/password login with the dedicated test user succeeded.
- Admin route `?admin=true` rendered the Sessions view with real campaigns and user assignments.
- Player route crashed after login with `TypeError: Cannot convert undefined or null to object` in the deployed bundle.
- Root cause identified locally: the Actor rules viewmodel used raw Actor documents for stat rendering, so minimally shaped PC Actors could reach `SkillsSection` without normalized `skills`/runtime defaults.
- Local fix: `buildActorStatsViewModel` now normalizes Actor data into the Character runtime shape before stat rendering; regression test added.
- Follow-up: deploy the local fix, then rerun the Firebase-backed Player/GM mutation smokes.

### 2026-07-02 After Actor Rules Fix Deployment

- Result: `partial`
- Player route for the test user now renders without the previous crash.
- Player HP and Gold edits were verified against real Firestore:
  - HP set to `14 / 15`
  - Gold set to `1.00 gp`
  - Values remained visible after reload.
- Player Condition edit was verified against real Firestore:
  - `Frightened` was added.
  - AC, saves, perception, and skills reflected the `-1` effect.
  - The effect remained visible after reload.
- Admin Sessions route rendered real campaigns and selected `Test V2`.
- GM Items side-list smoke:
  - Created `Codex Production Smoke Loot` in `Test V2`.
  - `Give to Player` submenu opened, but exposed no player target entries (`playerOptions=[]`), so giving an item to the test player remains failed/not verified.
- No browser console errors were observed in the verified Player and Admin smoke steps after deployment.

### 2026-07-02 After GM Item/Loot Fixes

- Result: `verified for targeted playnight flows`
- Deployed commits:
  - `8bdd44ea` fixed GM item player target derivation by passing explicit `pcActors`-derived targets into `ItemsViewLayout`.
  - `387f419b` fixed lootbag creation selection by returning the created lootbag ID from `dataActions.loot.createLootBag`.
  - `5128c1fd` changed GM lootbag gold editing to draft locally and commit on blur/Enter instead of writing on every keystroke.
- Production item give:
  - `Give to Player` submenu rendered target `test`.
  - `Healing Potion (Minor)` was given from GM Items.
  - Player `test` showed `Healing Potion (Minor)` in the Consumables tab after reload.
- Production loot claim/split:
  - Created isolated smoke lootbag `Codex Smoke Loot 1782999021038`.
  - Set gold to `2.01`.
  - Added `Antidote (Lesser)` to the lootbag.
  - Player claimed the item; the claim button disappeared.
  - Player split gold; the lootbag gold display disappeared for the single-character smoke party.
- Production quest reward:
  - Created isolated smoke quest `Codex Smoke Quest 1782999093482`.
  - Completed objective `Complete production smoke reward {xp:7}`.
  - Player `test` showed `XP: 7` after reload.
- Notes:
  - One local `npm run smoke` attempt saw the auth-gate test time out on a bare `/` navigation; the rerun passed. The fixture flows relevant to item give, loot claim/split, and quest rewards passed.
  - A Playwright-only context submenu click needed a large viewport/DOM click because the submenu can render outside a small headless viewport. Treat submenu positioning as optional UI polish, not a verified data-path failure.

## Notes

- The automated fixture intentionally persists runtime mutations through
  `localStorage` under `pf2:e2e-runtime-db`.
- The fixture does not replace live Firestore smoke checks, because rules,
  auth, subscriptions, and multi-client timing are outside its scope.
