import {
  createMapRecord,
  deleteMapPinInCampaign,
  reorderMapsInCampaign,
  restoreMapInCampaign,
  setMapImageUrlInCampaign,
  setMapScaleInCampaign,
  softDeleteMapInCampaign,
  updateMapInCampaign,
  upsertMapInCampaign,
  upsertMapPinInCampaign,
} from "./mapReducers.js";

export function createMapActions(actionContext) {
  const { actor, createDomainId, db, firestore, nowIso, repos, updateCampaignLegacy, useFirestoreV2 } = actionContext;

  return {
    createMap(campaignId, nameOrMap) {
      const campaignMaps = db?.campaigns?.[campaignId]?.maps || [];
      const maxOrder = Math.max(0, ...campaignMaps.map((map) => Number(map?.order) || 0));
      const map = createMapRecord(nameOrMap, {
        createId: () => createDomainId("map"),
        order: maxOrder + 1000,
      });

      if (useFirestoreV2) {
        return repos.mapRepo.createMap(firestore, campaignId, map).then(() => map.id);
      }
      return updateCampaignLegacy(campaignId, (campaign) =>
        upsertMapInCampaign(campaign, map, { createId: () => createDomainId("map") })
      ).then(() => map.id);
    },
    updateMap(campaignId, mapId, updater) {
      if (useFirestoreV2) {
        return repos.mapRepo.updateMap(firestore, campaignId, mapId, (map) =>
          updateMapInCampaign({ maps: [{ ...map, id: map.id || mapId }] }, mapId, updater).maps[0]
        );
      }
      return updateCampaignLegacy(campaignId, (campaign) => updateMapInCampaign(campaign, mapId, updater));
    },
    softDeleteMap(campaignId, mapId) {
      const options = { now: nowIso(), actorEmail: actor };
      if (useFirestoreV2) {
        return repos.mapRepo.updateMap(firestore, campaignId, mapId, (map) =>
          softDeleteMapInCampaign({ maps: [{ ...map, id: map.id || mapId }] }, mapId, options).maps[0]
        );
      }
      return updateCampaignLegacy(campaignId, (campaign) => softDeleteMapInCampaign(campaign, mapId, options));
    },
    restoreMap(campaignId, mapId) {
      const options = { now: nowIso(), actorEmail: actor };
      if (useFirestoreV2) {
        return repos.mapRepo.updateMap(firestore, campaignId, mapId, (map) =>
          restoreMapInCampaign({ maps: [{ ...map, id: map.id || mapId }] }, mapId, options).maps[0]
        );
      }
      return updateCampaignLegacy(campaignId, (campaign) => restoreMapInCampaign(campaign, mapId, options));
    },
    reorderMaps(campaignId, orderedIds) {
      if (useFirestoreV2) {
        return repos.mapRepo.updateMaps(firestore, campaignId, orderedIds, (mapsById) => {
          const nextCampaign = reorderMapsInCampaign(
            { maps: orderedIds.map((id) => ({ ...mapsById[id], id: mapsById[id]?.id || id })) },
            orderedIds
          );
          return Object.fromEntries(nextCampaign.maps.map((map) => [map.id, map]));
        });
      }
      return updateCampaignLegacy(campaignId, (campaign) => reorderMapsInCampaign(campaign, orderedIds));
    },
    setImageUrl(campaignId, mapId, imageUrl) {
      if (useFirestoreV2) {
        return repos.mapRepo.updateMap(firestore, campaignId, mapId, (map) =>
          setMapImageUrlInCampaign({ maps: [{ ...map, id: map.id || mapId }] }, mapId, imageUrl).maps[0]
        );
      }
      return updateCampaignLegacy(campaignId, (campaign) => setMapImageUrlInCampaign(campaign, mapId, imageUrl));
    },
    upsertPin(campaignId, mapId, pin) {
      const options = { createId: () => createDomainId("pin") };
      if (useFirestoreV2) {
        return repos.mapRepo.updateMap(firestore, campaignId, mapId, (map) =>
          upsertMapPinInCampaign({ maps: [{ ...map, id: map.id || mapId }] }, mapId, pin, options).maps[0]
        );
      }
      return updateCampaignLegacy(campaignId, (campaign) => upsertMapPinInCampaign(campaign, mapId, pin, options));
    },
    deletePin(campaignId, mapId, pinId) {
      if (useFirestoreV2) {
        return repos.mapRepo.updateMap(firestore, campaignId, mapId, (map) =>
          deleteMapPinInCampaign({ maps: [{ ...map, id: map.id || mapId }] }, mapId, pinId).maps[0]
        );
      }
      return updateCampaignLegacy(campaignId, (campaign) => deleteMapPinInCampaign(campaign, mapId, pinId));
    },
    setScale(campaignId, mapId, scale) {
      if (useFirestoreV2) {
        return repos.mapRepo.updateMap(firestore, campaignId, mapId, (map) =>
          setMapScaleInCampaign({ maps: [{ ...map, id: map.id || mapId }] }, mapId, scale).maps[0]
        );
      }
      return updateCampaignLegacy(campaignId, (campaign) => setMapScaleInCampaign(campaign, mapId, scale));
    },
  };
}
