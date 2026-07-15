# Firestore Index Notes

Last updated: 2026-07-15.

The current V2 runtime subscribes to campaign documents and known campaign subcollections, then composes viewmodels client-side. No composite Firestore indexes are required by the current repository code.

Fields that must remain query-ready if future server-side filtering is introduced:

- `campaigns/{campaignId}/actors.ownerActorId`
- `campaigns/{campaignId}/actors.controllerUserEmail`
- `campaigns/{campaignId}/actors.kind`
- `campaigns/{campaignId}/actorEffects.targetActorId`
- `campaigns/{campaignId}/actorEffects.category`
- `catalogOverrides.catalogType`
- `catalogOverrides.baseId`
- `campaigns/{campaignId}/loreDeliveries.actorId`
- `campaigns/{campaignId}/loreDeliveries.articleId`
- `campaigns/{campaignId}/knowledgeNotes.actorId`
- `campaigns/{campaignId}/knowledgeNotes.sharedWithGm`
- `campaigns/{campaignId}/loreArticles.groupId`
- `campaigns/{campaignId}/loreGroups.parentId`

`firestore.indexes.json` is deployed with the project and currently contains no composite indexes. Firestore's automatic single-field indexes cover the Lore equality queries. Add a composite index only when a concrete combined query requires one; do not add speculative indexes to hide a client-side data-flow issue.
