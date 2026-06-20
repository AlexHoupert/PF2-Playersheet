# UI Flows

Last updated: 2026-06-16.

## Authentication And Routing

All screens are behind Firebase Auth via `AuthProvider`. Once signed in, `App.jsx` chooses a route from query params:

- default: player app
- `?admin=true`: GM/admin app
- `?party=true`: read-only party encounter display
- `?camp=true`: camp overview
- the `v2-convergence` branch starts the normalized Firestore V2 runtime directly

`CampaignProvider` is active for all routes and marks admin, party, and camp routes as GM-capable context.

## Player App

File: `src/player/PlayerApp.jsx`

Primary responsibilities:

- Select assigned PC actor through actor-first character selectors.
- Let GMs cycle characters in preview mode.
- Maintain active tab and mode.
- Run small runtime migrations/defaults for older character shapes.
- Mutate character inventory, gold, spells, feats, impulses, formulas, conditions, equipment, weapons, ammo, loot, and custom actions.
- Drive shared modals and catalog overlays.
- Resolve content links emitted by `parseFoundry`.
- Show notifications and XP overlay.

Player display is split into:

- `src/player/views/StatsView.jsx`
- `src/player/views/ActionsView.jsx`
- `src/player/views/InventoryView.jsx`
- `src/player/views/MagicView.jsx`
- `src/player/views/FeatsView.jsx`
- `src/player/views/ImpulsesView.jsx`
- `src/player/views/PlayerQuestsView.jsx`
- `src/player/views/LoreView.jsx`
- `src/player/views/MapsView.jsx`
- `src/player/views/ProgressView.jsx`
- `src/player/views/CompanionTab.jsx`

Character mode tabs are built dynamically in `PlayerApp`. Story mode uses quest/lore/map/progress/camp style tabs.

## Inventory And Shop Flow

Important files:

- `src/player/views/InventoryView.jsx`
- `src/player/ShopView.jsx`
- `src/player/ItemCatalog.jsx`
- `src/player/ItemActionsModal.jsx`
- `src/player/modals/ItemDetailModal.jsx`
- `src/shared/utils/inventoryUtils.js`
- `src/shared/utils/combatUtils.js`
- `src/utils/rules/runes.js`

Key concepts:

- Inventory items can be catalog-derived, custom, minimal `{ name, qty }`, or augmented runtime objects.
- Stackability is centralized in `shouldStack`.
- Equipment toggling merges catalog metadata when possible.
- Weapons can have loaded ammo slots based on traits/capacity.
- Scroll and wand purchases open spell selection before adding/buying.
- Loot claiming updates both character inventory and campaign loot bag state.
- Formula buying writes to `character.formulaBook`.

Risks:

- Several handlers assume `activeCampaign.id` and `next.campaigns[campaignId]` exist.
- Root `db.characters` is now reserved for legacy import/migration views, not normal player/admin runtime work.
- Item identity can be name-based, index-based, or `instanceId`-based depending on path.

## GM/Admin App

File: `src/admin/AdminApp.jsx`

Navigation:

- `src/admin/components/Sidebar.jsx` defines desktop and mobile navigation groups.
- `src/admin/components/Breadcrumbs.jsx` maps active tabs to labels.
- Desktop uses collapsible sidebar.
- Mobile uses bottom navigation plus `BottomSheet` for child menus.

Admin tabs:

- `sessions`: `SessionManager`
- `players`: player cards and user assignment management
- `items`: `ItemsView`
- `spells`: `SpellsView`
- `impulses`: `ImpulsesView`
- `feats`: `FeatsView`
- `actions`: `ActionsView`
- `abilities`: `AbilitiesView`
- `quests`: `QuestsView`
- `lore`: `LoreAdminView`
- `maps`: `MapAdminView`
- `progress`: `ProgressAdminView`
- `camping`: `CampingAdminView`
- `deviant_abilities`: `DeviantAbilitiesAdminView`
- `pacts`: `PactAdminView`
- `bestiary`, `bestiary_overview`, `bestiary_creatures`, `bestiary_hazards`: `BestiaryView`
- `encounters`: `EncounterView`
- `system`: `FirebaseMigrator`, rebuild control, reset

Admin uses the same `ModalManager` as the player app for detail previews.

## Session And User Flow

File: `src/admin/views/SessionManager.jsx`

Responsibilities:

- Create/delete/select campaigns.
- Create skeleton characters inside active campaign.
- Import legacy root characters into active campaign.
- Assign user email to campaign/character.
- Display registered DB users.

Skeleton character shape here is important. If character schema evolves, update this creation path and `migrateDb`.

## Bestiary And Encounter Flow

Important files:

- `src/admin/BestiaryView.jsx`
- `src/admin/EncounterView.jsx`
- `src/admin/components/InitiativeCard.jsx`
- `src/shared/components/CreatureCard.jsx`
- `src/player/PartyScreen.jsx`

GM path:

- Browse/filter creatures and hazards from creature index.
- Load full creature data lazily.
- Manage custom creature metadata/reveal state.
- Build encounters and initiative combatants.
- Mark active encounter and selected entity.
- Control combatant visibility for party display.

Party path:

- `PartyScreen` reads active encounter from active campaign.
- Shows only visible combatants.
- Rotates initiative so current turn is at top.
- Shows selected visible entity details, respecting creature reveal state.

## Camping Flow

Important files:

- `src/camping/campingData.js`
- `src/camping/CampingAdminView.jsx`
- `src/camping/CampingView.jsx`
- `src/camping/CampScreen.jsx`

Data lives under `activeCampaign.camping`.

Admin can configure activities/DCs and assignments. Players can assign themselves to activities and enter roll results. Camp overview displays assignments, DCs, outcomes, and generated effect text.

## Pacts And Deviant Abilities

Important files:

- `src/pacts/pactsData.js`
- `src/pacts/PactView.jsx`
- `src/pacts/PactAdminView.jsx`
- `src/pacts/DeviantAbilitiesAdminView.jsx`

Data:

- Pacts live in `db.pacts`.
- Deviant abilities live in `db.abilities.deviant`.
- Character pact assignment lives on `character.pact`.

Player view resolves the assigned pact and selected abilities, then displays awakenings and backlash reference.

## Content Rendering

File: `src/shared/utils/foundryParser.js`

Used for PF2e descriptions from resources and custom content.

It handles:

- Foundry `@UUID` links into `.content-link` spans.
- `@Check`, `@Damage`, `@Template`, inline roll syntax.
- Action glyphs.
- GM hidden text markers.
- Basic markdown-like syntax.

Because output is rendered with `dangerouslySetInnerHTML`, keep content-source trust assumptions in mind. Do not feed arbitrary user HTML into it without review.

## Responsive Behavior

Key shared hooks/components:

- `src/shared/hooks/useWindowSize.js`
- `src/shared/hooks/useSwipe.js`
- `src/shared/components/BottomSheet.jsx`

Player app uses swipe handlers across tabs. Admin sidebar switches to mobile bottom nav below the configured breakpoint.
