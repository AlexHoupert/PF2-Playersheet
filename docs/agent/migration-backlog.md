# Migration Backlog

This file tracks remaining broad legacy writes after the Character/Inventory/Loot,
Campaign/Session, Quests/Rewards, Encounters, Maps, Progress, Camping, and
Global Admin Content waves.
New work should prefer `dataActions` and domain reducers. Broad writes listed here
are compatibility debt, not patterns for new code.

## Guarded Migrated Domains

These UI files must not introduce direct `setDb` or `updateActiveCampaign` writes:

- `src/admin/ItemsView.jsx`
- `src/admin/EncounterView.jsx`
- `src/admin/QuestsView.jsx`
- `src/admin/MapAdminView.jsx`
- `src/admin/ProgressAdminView.jsx`
- `src/admin/AbilitiesView.jsx`
- `src/admin/BestiaryView.jsx`
- `src/admin/LoreAdminView.jsx`
- `src/pacts/DeviantAbilitiesAdminView.jsx`
- `src/pacts/PactAdminView.jsx`
- `src/player/PlayerAppController.jsx`
- `src/player/views/InventoryView.jsx`
- `src/player/views/ProgressView.jsx`
- `src/player/views/PlayerQuestsView.jsx`
- `src/player/views/MapsView.jsx`
- `src/camping/CampingAdminView.jsx`
- `src/camping/CampingView.jsx`
- `src/camping/CampScreen.jsx`

`scripts/check_broad_writes.js` enforces this list.

## Remaining Direct Writes

Only these broad-write files are currently allowed by `scripts/check_broad_writes.js`:

- `src/admin/AdminApp.jsx`: legacy admin/player tab fallback for root characters when no campaign is active.
- `src/shared/context/CampaignContext.jsx`: deprecated compatibility escape hatch `updateActiveCampaign`.
- `src/shared/db/domain/createDataActions.js`: legacy adapter implementation that intentionally writes through `setDb`.

Any new broad write outside those files should be treated as a regression.

## Completed In Global Admin Content Wave

- Pacts and Deviant Abilities use `dataActions.pact`.
- Custom Abilities use `dataActions.globalContent`.
- Lore articles use `dataActions.globalContent` and the `loreArticles` collection.
- Bestiary custom creatures use the `customCreatures` collection through `dataActions.bestiary`.
- Bestiary metadata, reveal state, catalog initialization, group changes, and bestiary toggles use `global/config.bestiary.creatures` through `dataActions.bestiary`.
- Player root-notification clearing uses `dataActions.globalContent.clearRootNotification`.
- Player skill-name runtime repair uses `dataActions.character.updateCharacter`.

## Remaining By Domain

### Campaign Compatibility

- `CampaignContext.updateActiveCampaign` remains available but deprecated. Do not use it for new work.
- `AdminApp` still has a root-character fallback for the old campaignless admin/player mode.

### Shop And Traders

- `ItemsView` trader create/update/hide/inventory writes use `dataActions.shop`.
- Available items and formulas use `dataActions.shop`.
- GM custom items use `dataActions.globalContent.saveCustomItem/deleteCustomItem`.

Remaining:

- `ShopView` is read-only and still reads through the legacy projection.

### Legacy V2 Compatibility

- `useFirestoreV2Db` still contains broad legacy diff support for any future non-migrated path.
- `writeLegacyDbDiffToV2` must remain confined to the V2 compatibility layer.
