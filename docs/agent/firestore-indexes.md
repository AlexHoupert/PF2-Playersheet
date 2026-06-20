# Firestore Index Notes

Last updated: 2026-06-20.

The current V2 runtime subscribes to campaign documents and known campaign subcollections, then composes viewmodels client-side. No composite Firestore indexes are required by the current repository code.

Fields that must remain query-ready if future server-side filtering is introduced:

- `campaigns/{campaignId}/actors.ownerActorId`
- `campaigns/{campaignId}/actors.controllerUserEmail`
- `campaigns/{campaignId}/actors.kind`
- `campaigns/{campaignId}/actorEffects.targetActorId`
- `campaigns/{campaignId}/actorEffects.category`
- `catalogOverrides.catalogType`
- `catalogOverrides.baseId`

Add `firestore.indexes.json` only when a concrete query requires a composite index. Until then, Firestore's automatic single-field indexes are enough for the current subscription model.
