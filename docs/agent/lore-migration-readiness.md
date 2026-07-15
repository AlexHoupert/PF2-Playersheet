# Lore Migration Readiness

Last updated: 2026-07-15.

## Current State

The runtime implementation is campaign-scoped and uses `loreArticles`,
`loreGroups`, `loreDeliveries`, and `knowledgeNotes` below each campaign.
Top-level `loreArticles` remain a read-only recovery fallback until the real
campaign data has been migrated and verified.

The production migration for `War of the Elements` was completed and verified
on 2026-07-15. Top-level source documents were retained; no cleanup or physical
deletion was performed.

## Local Migration Dry-run

Command:

```powershell
node scripts/migrate_lore_to_campaign.js `
  --campaign dry-run-lore-review `
  --actor e2e_actor_nimwe `
  --report-out recovery/lore-campaign-migration-report.json `
  --docs-out recovery/lore-campaign-migration-docs.json
```

Result:

| Metric | Count |
| --- | ---: |
| Source articles | 16 |
| Campaign articles | 16 |
| Generated groups | 5 |
| Player deliveries | 16 |
| Converted links | 22 |
| Ambiguous links | 0 |
| Broken or unresolved links | 14 |

The 14 unresolved links are intentionally not guessed by the migration. They
must be resolved in the GM link diagnostics after the campaign write. Initial
deliveries use version 1 with `attentionVersion: 0`, so restored articles do
not generate historical release popups.

The generated report and document preview live below ignored `recovery/` and
must not be committed.

## Production Migration Result

Target:

- Firebase project: `pathfinder-companion-4290f`
- Campaign: `campaign_1766691475810` (`War of the Elements`)
- Active PC recipients: Nozzik, Nimwe, Zath, and Kairos

The reviewed production dry-run found an empty campaign Lore target and
produced 16 articles, 5 groups, and 64 deliveries. The explicit write pass then
created the same records. A direct read-back returned:

| Collection | Count |
| --- | ---: |
| `loreArticles` | 16 |
| `loreGroups` | 5 |
| `loreDeliveries` | 64 |
| `knowledgeNotes` | 0 |

Backup:

- Document: `migrationBackups/lore-campaign-2026-07-15T13-32-43-274Z`
- Source articles stored: 16
- `sourceRetained`: `true`
- Converted links: 22
- Unresolved links: 14

Initial deliveries use version 1 with `attentionVersion: 0`, so the restoration
does not create 16 historical release notifications for every Player. The 14
unresolved links remain a GM content-cleanup task and were not guessed by the
migration.

The write was guarded by all of the following:

1. Explicit user approval for the target campaign and Firebase project.
2. A reviewed `--from-firestore` dry-run against that project.
3. Confirmation that active PC Actors are the intended delivery recipients.
4. Explicit `--write --confirm-write` flags.
5. Verification of the created `migrationBackups` document before any later
   cleanup of top-level Lore documents.

The write pass retains top-level source documents and is designed to be
recoverable. Physical deletion is a separate maintenance task.

Read-only verification can be repeated with:

```powershell
node scripts/verify_lore_campaign_migration.js `
  --campaign campaign_1766691475810
```

## Firestore Rules Emulator Gate

The repository does not currently install `@firebase/rules-unit-testing`, so
the Lore rules are documented as a mandatory emulator gate rather than claimed
as emulator-verified. The application queries already include the constraints
required by the rules:

- Player deliveries: `where("actorId", "==", assignedActorId)`.
- Player notes: `where("actorId", "==", assignedActorId)`.
- GM shared notes: `where("sharedWithGm", "==", true)`.

Before production rules deployment, an emulator suite must assert:

- Campaign GM can read and write article drafts and groups.
- Player cannot read campaign `loreArticles` drafts.
- Player can read only deliveries for the assigned Actor.
- Player can update only read/notification fields on an owned delivery.
- Player can create, update, and delete only notes for the assigned Actor.
- Player cannot change a note's Actor, target type, or target ID.
- GM can read a note only when `sharedWithGm` is true and cannot edit it.
- Unauthenticated and unrelated campaign users are rejected.

Firebase's rules model evaluates queries against their potential result set,
not only returned documents. Keep these query constraints aligned with
`firestore.rules` when store hooks change.

## Automated Verification

- Unit and adapter coverage: Lore normalization, reveal materialization,
  audience changes, notification versions, migration reports, links,
  backlinks, search, notes, V2 repository routing, selectors, and runtime
  composition.
- Browser mutation flow: GM creates and links an article, publishes with a
  notification, Player opens the one-time release, reads the article, writes a
  note, shares it, and GM sees the read-only shared note.
- Visual artifacts: GM desktop workspace, Player desktop reader, Player
  Bestiary reader, and Player mobile reader under ignored `test-results/`.

Automated fixture tests do not replace a Firebase-backed production smoke for
rules, authentication, subscriptions, and multi-client timing.
