# Migration Backlog

This file tracks remaining broad legacy writes after the Character/Inventory/Loot,
Campaign/Session, Quests/Rewards, Encounters, Maps, Progress, and Camping waves.
New work should prefer `dataActions` and domain reducers. Broad writes listed here
are compatibility debt, not patterns for new code.

## Guarded Migrated Domains

These UI files must not introduce direct `setDb` or `updateActiveCampaign` writes:

- `src/admin/ItemsView.jsx`
- `src/admin/EncounterView.jsx`
- `src/admin/QuestsView.jsx`
- `src/admin/MapAdminView.jsx`
- `src/admin/ProgressAdminView.jsx`
- `src/player/views/InventoryView.jsx`
- `src/player/views/ProgressView.jsx`
- `src/player/views/PlayerQuestsView.jsx`
- `src/player/views/MapsView.jsx`
- `src/camping/CampingAdminView.jsx`
- `src/camping/CampingView.jsx`
- `src/camping/CampScreen.jsx`

`scripts/check_broad_writes.js` enforces this list.

## Remaining Direct Writes By Domain

### Pacts

- `src/pacts/PactAdminView.jsx`
- `src/pacts/DeviantAbilitiesAdminView.jsx`
- `src/player/PlayerAppController.jsx` still uses `updateActiveCampaign` for player-side
  runtime skill repair before a dedicated character repair action exists.

Next action: add `dataActions.pact` with campaign-scoped V2 writes and a small
character repair action for one-off migrations.

### Bestiary

- `src/admin/BestiaryView.jsx` still manages custom creatures and catalog metadata
  through broad writes.

Completed in the stabilization wave: encounter creature reveal state now uses
`dataActions.bestiary.updateRevealState`.

Next action: add `dataActions.bestiary.saveCustomCreature/deleteCustomCreature`
and migrate `BestiaryView`.

### Lore

- `src/admin/LoreAdminView.jsx` still writes lore articles broadly.

Next action: migrate to a `globalContent` lore repository backed by
`loreArticles`.

### Abilities

- `src/admin/AbilitiesView.jsx` still writes ability and deviant ability catalogs
  broadly.

Next action: split global ability catalog writes from campaign-scoped character
ability assignments, then add targeted actions for each.

### Shop And Traders

Completed in the stabilization wave:

- `ItemsView` trader create/update/hide/inventory writes use `dataActions.shop`.
- Available items and formulas use `dataActions.shop`.
- GM custom items use `dataActions.globalContent.saveCustomItem/deleteCustomItem`.

Remaining:

- `ShopView` is read-only and still reads through the legacy projection.

### Global Custom Content

Completed in the stabilization wave:

- Player-created custom items use `dataActions.globalContent.saveCustomItem`.
- Player-created custom actions use `dataActions.globalContent.saveCustomAction`.

Remaining:

- Custom creatures and lore still need targeted actions.

### Player Runtime Fallbacks

- `src/player/PlayerAppController.jsx` clears legacy root `notificationQueue` entries through
  `setDb` when a notification is not campaign-scoped.
- `src/player/PlayerAppController.jsx` has a runtime skill-name repair path that still uses
  `updateActiveCampaign`.

These remain explicit compatibility fallbacks until root notifications and player
repair actions are fully migrated.
