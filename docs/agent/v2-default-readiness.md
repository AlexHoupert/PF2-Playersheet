# V2 Default Readiness

Last updated: 2026-06-20.

## Purpose

This checklist tracks what must be true before the `v2-convergence` branch is deployable as the main runtime.

Current branch decision: `src/App.jsx` starts Firestore V2 directly. Legacy remains only an import/backup source and the compatibility projection remains a temporary bridge.

## Readiness Summary

Status meanings:

- Ready by tests/code: covered by domain actions, reducers, selectors, adapter tests, migration tests, or broad-write guard.
- Needs manual smoke: implementation exists, but browser/Firebase behavior still needs an end-to-end pass.
- Not in scope: intentionally deferred.

## Core App

| Flow | Status | Notes |
| --- | --- | --- |
| Auth/Login | Needs manual smoke | Firebase Auth is still the entry gate. V2 does not alter auth, but deployed auth config must be verified in the target environment. |
| Route mode selection | Ready by tests/code | `src/App.jsx` starts `useFirestoreV2Db` directly on the convergence branch. |
| V2 projection cache | Ready by tests/code | `useFirestoreV2Db` caches the legacy projection under `pf2e-data-v2-projection` while the UI still transitions. |
| V2-native view model | Ready by tests/code | `composeV2ViewModelFromDocuments` groups campaigns, actors, actor effects, effect templates, catalog overrides, and global content. |
| DB status object | Ready by tests/code | `CampaignContext` exposes `dbStatus`, including the current V2 view model for debug/transition work. |

## Campaign And Session

| Flow | Status | Notes |
| --- | --- | --- |
| Campaign create/select | Ready by tests/code | Uses `dataActions.campaign`; selected campaign remains local in `gm_selected_campaign`. |
| Campaign archive/restore | Ready by tests/code | Soft delete only; document is retained with `deletedAt`. |
| Character create/import | Ready by tests/code | Uses `dataActions.character`; character shape and inventory identities are normalized and mirrored into `actors(kind="pc")`. |
| Character archive/restore | Ready by tests/code | Soft delete only; member assignments are cleared on archive and not restored automatically; PC actor docs mirror archive/restore. |
| User assign/revoke | Ready by tests/code | Email keys are normalized; V2 uses campaign member docs with `assignedActorId`. |
| Party XP set/add | Ready by tests/code | V2 adapter updates campaign and known character documents transactionally. |
| Reload persistence in `?db=v2` | Needs manual smoke | Covered structurally by subscriptions/projection; still needs a browser check against real Firestore. |

## Player Flows

| Flow | Status | Notes |
| --- | --- | --- |
| Character stats/runtime shape | Ready by tests/code | Old skill names and missing runtime defaults are normalized by `characterShape.js` on load/create/update. |
| Inventory consume/qty/buy/formula/equip/rune/load/fire/transfer | Ready by tests/code | Routed through character/inventory actions and targeted V2 character writes. |
| Loot claim/gold claim/split | Ready by tests/code | Uses loot actions and V2 transactions. |
| Quests/rewards | Ready by tests/code | Campaign-scoped quests and notifications; rewards are idempotent and not rolled back automatically. |
| Maps | Ready by tests/code | Map data is campaign-scoped and archived through domain actions. |
| Progress | Ready by tests/code | Player reads active-only reducer output. |
| Camping | Ready by tests/code | Settings, custom activities, assignments, rolls, and unassign are domain-action backed. |
| Pacts/deviant abilities | Ready by tests/code | Reads use selectors; admin writes use pact actions. |
| Conditions/effects foundation | Ready by tests/code | Conditions can be stored as `actorEffects`; the legacy projection overlays character conditions from actor effects. Full condition/effect UI migration is not complete. |
| Root notification fallback clear | Ready by tests/code | Uses `dataActions.globalContent.clearRootNotification`. |

## GM/Admin Flows

| Flow | Status | Notes |
| --- | --- | --- |
| Players tab character edits | Ready by tests/code | Campaign-scoped only; campaignless root-character fallback has been removed. |
| Items/custom items/formulas | Ready by tests/code | Uses shop/global content actions and selector-backed reads; custom content now also writes catalog overrides. |
| Traders/shop availability | Ready by tests/code | Uses `dataActions.shop`; V2 writes `global/config.shop`. |
| Loot bag management | Ready by tests/code | Uses loot actions; V2 writes campaign-scoped loot bag documents. |
| Bestiary metadata/reveal/custom creatures | Ready by tests/code | Uses bestiary actions; V2 writes `global/config.bestiary.creatures` and `customCreatures`. |
| Lore | Ready by tests/code | Uses global content actions and `loreArticles`. |
| Abilities/custom/deviant | Ready by tests/code | Uses global content and pact actions; V2 stores ability catalogs in `global/config`. |
| Spell editing | Ready by tests/code | Deployed spell editing writes `catalogOverrides`; local dev can still use file APIs. |
| Encounters | Ready by tests/code | Uses encounter actions and campaign-scoped encounter documents. |
| Maps/progress/camping admin | Ready by tests/code | Uses domain actions and soft-delete metadata. |
| Firebase migration UI | Needs manual smoke | Dry-run/write tooling remains admin-only and must not be run without explicit approval. |
| Catalog rebuild tools | Not in scope | Dev-server admin APIs are independent from V2 storage mode. |

## Firestore Rules Audit

Rules file: `firestore.rules`.

Verified against current V2 repositories and action paths:

- `campaigns/{campaignId}`: readable by campaign members or global admins; create requires global admin; update/delete requires campaign GM or global admin.
- `campaigns/{campaignId}/members/{email}`: readable by campaign GM, assigned email, or global admin; writes require campaign GM or global admin.
- `campaigns/{campaignId}/characters/{characterId}`: readable by campaign members/global admins; update allowed for campaign GM, assigned character owner, or global admin.
- `campaigns/{campaignId}/actors/{actorId}`: readable by campaign members/global admins; update allowed for campaign GM, assigned actor owner, or global admin.
- `campaigns/{campaignId}/actorEffects/{effectId}`: readable by campaign members/global admins; create/update/delete allowed for campaign GM, global admin, or the assigned target actor owner.
- `campaigns/{campaignId}/effectTemplates/{templateId}`: readable by campaign members/global admins; writes require campaign GM or global admin.
- `campaigns/{campaignId}/quests/{questId}`: campaign member/global admin read; campaign GM/global admin write.
- `campaigns/{campaignId}/lootBags/{lootBagId}`: campaign member/global admin read; member/global admin update; create/delete require campaign GM/global admin.
- `campaigns/{campaignId}/encounters/{encounterId}` and `maps/{mapId}`: campaign member/global admin read; campaign GM/global admin write.
- `global/{documentId}`: signed-in read; global admin write.
- `customItems/{documentId}`, `customCreatures/{documentId}`, `customActions/{documentId}`, `catalogOverrides/{documentId}`, `loreArticles/{documentId}`: signed-in read; global admin write.
- `migrationBackups/{documentId}` and subdocuments: global admin read/write.

The convergence branch added explicit rules for actors, actor effects, effect templates, and catalog overrides. Before deployment, confirm the deployed Firebase project has these rules or stricter compatible equivalents.

Known operational caveat:

- Legacy `data/master` is not covered by these rules. If legacy Firestore writes are still required in production, deployed rules may differ from this repo file or must be audited separately before relying on legacy cloud persistence.

## Required Manual Smoke Before Default Switch

Run these in a Firebase-backed environment on the `v2-convergence` branch:

1. Login as GM/global admin, create a campaign, select it, reload, and verify selection/data persist.
2. Create/import a character, assign a user, reload as player, and verify the player sees only the assigned active character.
3. Archive/restore campaign and character; verify archived records are hidden from normal lists and restored data is intact.
4. Player inventory: buy, consume, quantity change, equip/unequip, rune apply/remove, weapon load/fire, transfer, formula purchase; reload after each group.
5. Loot: claim item, claim gold, split gold; verify duplicate claim is prevented from a second client.
6. Quests/rewards: toggle objective rewards and quest completion; reload and verify rewards are not duplicated.
7. Encounters: create, activate, add all players, add creature, update initiative/HP/turns/conditions; reload and verify state.
8. Maps/progress/camping: edit one representative item in each domain, archive/restore where supported, reload.
9. Global admin content: custom item/action/ability, pact/deviant ability, trader, bestiary metadata/custom creature, lore article; reload and verify selectors show persisted data.
10. Confirm `npm run check` is green on the commit intended for the switch.

## Deployment Gate

Do not deploy the convergence branch as the main production path until:

- All required manual smoke items are marked completed for the target Firebase project.
- The deployed Firestore rules match the repository rules or are stricter in a compatible way.
- The team accepts that the legacy projection and broad V2 diff still exist as temporary bridges, or those bridges have been removed.
- A rollback path is documented: redeploy the last known-good legacy deployment or keep a tagged production release before the V2 convergence branch.
