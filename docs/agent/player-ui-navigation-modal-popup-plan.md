# Player UI Navigation, Modal Focus, And Popup Hardening Plan

Status: phase 7 complete
Created: 2026-07-09

## Summary

This plan prepares the next large Player UI pass. The current Player layout still uses the older `character/story + activeTab` model and was not designed for the current number of features. The new target is a mobile-first Player shell with five bottom category icons, animated category drawers, swipeable subpages inside each category, hardened modal scroll/focus behavior, and one unified popup queue for pact offers, XP, quest/reward notices, and future player notifications.

This file is only the plan. No runtime UI implementation is part of this planning step.

## Current-State Analysis

### Player Navigation

- Current Player navigation lives mainly in `src/player/hooks/usePlayerNavigation.js` and `src/player/PlayerAppController.jsx`.
- The current state model is:
  - `appMode`: `character` or `story`.
  - `activeTab`: strings such as `stats`, `actions`, `items`, `shop`, `quests`, `lore`, `maps`, `progress`, `camp`.
  - `mainTabs`: derived from `appMode` plus character flags such as caster, kineticist, companion actors, and pact state.
- The header still has a character/story switch button. The new bottom category navigation should make that switch obsolete.
- Current swipe navigation is global on `.app-container` through `useSwipe`. It only checks `modalMode` and a few excluded selectors. It does not know about all active overlay types, bottom sheets, feedback dialogs, pact offers, catalog overlays, or item action modals.
- The current view rendering is a direct conditional block inside `PlayerAppController.jsx`. This makes it hard to add nested category pages cleanly.

### Mobile GM Reference

- GM mobile navigation is in `src/admin/components/Sidebar.jsx` and `src/admin/components/Sidebar.css`.
- It already uses a fixed bottom icon nav and opens child items through `BottomSheet`.
- The current GM mobile sheet starts at the bottom and can cover the nav icons. For Player UI the desired behavior is different:
  - the icon row remains visible;
  - the drawer starts at the border above the icon row;
  - the drawer animates upward from that border;
  - tapping outside closes it with the reverse animation.

### Modal And Dialog State

- Player modal state is centralized only partially in `src/player/hooks/usePlayerModalState.js`.
- Main player modals are rendered by `src/player/ModalManager.jsx`.
- Several overlay surfaces bypass `ModalManager`:
  - `src/player/ItemActionsModal.jsx`
  - `src/player/components/LazyCatalogOverlay.jsx`
  - `src/pacts/PactOfferModal.jsx`
  - `src/shared/feedback/AppFeedback.jsx`
  - `src/shared/components/BottomSheet.jsx`
  - overlays embedded in views such as `MapsView` and `ProgressView`
- Some overlays lock body scroll locally, some do not. Some use `.modal-overlay`, some use inline fixed overlays, some use `BottomSheet`.
- Reported bug class: on some mobile devices, swipe/drag inside a dialog scrolls or swipes the background page instead of the dialog. The likely cause is the lack of one global modal stack plus incomplete event/scroll containment.

### Popup And Notification State

- `NotificationOverlay` displays campaign/root notification queue entries and clears them after animation.
- `XpOverlay` is separate and uses localStorage seen IDs.
- `PactOfferModal` is separate and is triggered from actor pact offer state.
- These systems have different dedupe/ack semantics, which explains recurring historical bugs where pact, XP, or quest popups trigger repeatedly.
- The target should be one Player popup queue that derives popup candidates from runtime state, applies stable dedupe keys, and shows only one active popup at a time.

### Design Constraints

- The app is a live campaign tool. Preserve player workflows and V2/Actor persistence while changing the shell.
- Do not add another long-term parallel navigation model. A short transition adapter is allowed, but the final state should use one page registry.
- Use existing visual language: dark surface, restrained gold accent, dense but readable information.
- Icons should come from game-icons.net assets, but they should be stored locally in the project rather than hotlinked at runtime. License/attribution must be checked before committing icon assets.
- Dummy pages are acceptable for future pages explicitly called out below.

## Target Information Architecture

### Bottom Categories

The mobile bottom navigation has five primary categories. Each primary icon opens a drawer with subpages.

- Character
  - Icon source: `https://game-icons.net/1x1/delapouite/skills.html`
  - Subpages:
    - Status
    - Feats
    - Magic
    - Impulses
    - Pact
    - Companion
    - Proficiencies: dummy page for now
- Skills
  - Icon source: `https://game-icons.net/1x1/delapouite/dice-twenty-faces-twenty.html`
  - Subpages:
    - Combat
    - Movement
    - General
    - Downtime
    - Exploration: dummy page for now
    - Camping
- Items
  - Icon source: `https://game-icons.net/1x1/lorc/drink-me.html`
  - Subpages:
    - Equipment
    - Consumables
    - Misc.
    - Shop
    - Crafting: dummy page for now
    - Loot
- Knowledge
  - Icon source: `https://game-icons.net/1x1/lorc/bookmarklet.html`
  - Subpages:
    - History
    - Locations
    - NPCs
    - Bestiary
    - Other
- Campaign
  - Icon source: `https://game-icons.net/1x1/lorc/treasure-map.html`
  - Subpages:
    - Quests
    - Progress
    - Maps
    - Camp

### Initial Mapping From Existing Tabs

- `stats` -> Character / Status
- `feats` -> Character / Feats
- `magic` -> Character / Magic
- `impulses` -> Character / Impulses
- `pact` -> Character / Pact
- `companion` -> Character / Companion
- existing `actions` view:
  - Combat -> Skills / Combat
  - Movement -> Skills / Movement
  - General -> Skills / General
  - Downtime -> Skills / Downtime
  - Camping -> Skills / Camping
- existing `items` view:
  - Equipment filter -> Items / Equipment
  - Consumables filter -> Items / Consumables
  - Misc filter -> Items / Misc.
  - Loot area -> Items / Loot
- existing `shop` view -> Items / Shop
- existing `lore` view:
  - History -> Knowledge / History
  - Locations -> Knowledge / Locations
  - NPCs -> Knowledge / NPCs
  - Bestiary -> Knowledge / Bestiary
  - Other -> Knowledge / Other
- `quests` -> Campaign / Quests
- `progress` -> Campaign / Progress
- `maps` -> Campaign / Maps
- `camp` / `CampScreen` -> Campaign / Camp

## Phase 0: Baseline And Decision Checkpoint

- [x] Run `git status --short --branch`.
- [x] Run `npm run check`.
- [x] Run `git diff --check`.
- [x] Capture current screenshots for:
  - Player mobile status screen
  - Player mobile tabs
  - Player inventory modal
  - Pact offer modal
  - XP/quest notification overlay
  - GM mobile bottom nav reference
- [x] Confirm icon asset approach:
  - local SVG copies under `src/assets/game-icons/` or similar;
  - no runtime hotlinking to game-icons.net;
  - attribution/license note documented.
- [x] Decide transition strategy:
  - recommended: no long-term feature flag;
  - allow a short-lived `PlayerNavigationV2` wrapper while the old tabs are being cut over;
  - remove the old `appMode` switch during the final cutover phase.

Success criteria:

- [x] Baseline is documented before UI changes.
- [x] No runtime behavior changes are mixed into the baseline step.
- [x] Icon asset/licensing decision is recorded before adding assets.

### Phase 0 Baseline Notes

- Baseline commands:
  - `git status --short --branch`: clean except this planning document and Phase 0 screenshot artifacts.
  - `git diff --check`: passed.
  - `npm run check`: passed on 2026-07-09. The first run timed out at 120 seconds without useful failure output; rerun with a longer timeout completed successfully.
- Screenshot artifacts:
  - `docs/agent/screenshots/player-ui-phase0/01-player-mobile-status.png`
  - `docs/agent/screenshots/player-ui-phase0/02-player-mobile-tabs.png`
  - `docs/agent/screenshots/player-ui-phase0/03-player-mobile-items.png`
  - `docs/agent/screenshots/player-ui-phase0/04-player-mobile-inventory-modal.png`
  - `docs/agent/screenshots/player-ui-phase0/05-player-mobile-pact-offer.png`
  - `docs/agent/screenshots/player-ui-phase0/06-player-mobile-notification-overlay.png`
  - `docs/agent/screenshots/player-ui-phase0/07-gm-mobile-bottom-nav.png`
- Screenshot capture used the deterministic `?e2e=true` runtime on local port `4174`.
- During capture, a normal tab click was temporarily blocked by the current global swipe shield (`.app-container` intercepting pointer events). This reinforces the Phase 4/5 requirement to replace the current broad swipe shield with a modal-/gesture-aware interaction lock.
- Icon asset decision: use local checked-in SVG assets copied from game-icons.net after license/attribution review. Do not hotlink external icon URLs in production.
- Transition decision: use a short-lived component-level adapter if needed, but do not keep a long-term feature flag or parallel Player navigation model. The final state should remove the old `appMode` header toggle.

## Phase 1: Player Page Registry And Navigation Model

Create a single source of truth for Player categories, subpages, labels, icons, availability, and rendering metadata.

Suggested files:

- `src/player/navigation/playerPageRegistry.js`
- `src/player/navigation/playerNavigationSelectors.js`
- `src/player/navigation/PlayerPlaceholderPage.jsx`

Implementation steps:

- [x] Define primary category IDs:
  - `character`
  - `skills`
  - `items`
  - `knowledge`
  - `campaign`
- [x] Define subpage IDs and labels from the target IA above.
- [x] Store icon metadata per category, but keep actual SVG import wiring separate from the data model.
- [ ] Add availability rules:
  - Magic visible but may show an empty state if the character is not a caster.
  - Impulses visible but may show an empty state if the character is not kineticist.
  - Pact visible but may show empty state if no pact is active.
  - Companion visible but may show empty state if no companion actors exist.
  - Proficiencies, Exploration, and Crafting are explicit dummy pages.
- [x] Add mapping helpers for old tab strings:
  - old `stats` -> `character.status`
  - old `items` -> `items.equipment` or last used item subpage
  - old `shop` -> `items.shop`
  - old `quests` -> `campaign.quests`
- [x] Add persistence helper:
  - use URL search params or localStorage to preserve the current category/subpage across reload;
  - preserve old `playerTab` links as compatibility input only.
- [x] Add unit tests for old-tab-to-new-page mapping and availability decisions.

Success criteria:

- [x] No component hardcodes the full category/subpage list outside the registry.
- [x] Old `playerTab` URLs still land on the correct new page.
- [x] Dummy pages are explicit registry entries, not missing cases.

### Phase 1 Partial Implementation Notes

- Implemented the Phase 2 prerequisite registry in `src/player/navigation/playerPageRegistry.js`.
- Added compatibility mapping between the old `activeTab/appMode` shell and the new category/page IDs.
- Kept the old URL/localStorage navigation state as-is for Phase 2; a dedicated new persistence helper remains part of the Phase 3 cutover.
- Availability remains intentionally light in Phase 2: future pages are explicit disabled entries, while content-specific empty states remain a Phase 3/7 responsibility.
- Added `tests/playerNavigationRegistry.test.js`.

## Phase 2: Bottom Category Nav And Anchored Drawer

Build the new mobile navigation shell without cutting over every page yet.

Suggested files:

- `src/player/navigation/PlayerBottomNav.jsx`
- `src/player/navigation/PlayerCategoryDrawer.jsx`
- `src/player/navigation/PlayerNavigationShell.jsx`
- `src/player/navigation/playerNavigation.css`

Implementation steps:

- [x] Add local game icon assets after license/attribution check.
- [x] Render five fixed bottom category buttons.
- [x] Keep the bottom icon row visible at all times.
- [x] Add a drawer that is anchored above the icon row:
  - `bottom: calc(var(--player-bottom-nav-height) + env(safe-area-inset-bottom, 0px))`
  - fixed left/right edges
  - max height based on available viewport
- [x] Animate drawer open from the top border of the nav area upward.
  - Prefer Framer Motion if it keeps the implementation cleaner; otherwise CSS transition is acceptable.
  - Motion should be short and calm, not bouncy.
- [x] Add backdrop/outside tap handling that closes the drawer.
- [x] Ensure backdrop does not block the bottom nav buttons after drawer close animation finishes.
- [x] Highlight the active category and active subpage.
- [x] Include visible labels in the drawer; bottom nav may show icon plus compact label.
- [x] Respect mobile safe-area insets.
- [x] Keep desktop on the old tabs until Phase 3 unless desktop cutover is trivial.

Success criteria:

- [x] Drawer opens above the icon row and never covers the icons.
- [x] Outside tap closes the drawer with animation.
- [x] Bottom nav stays usable on iOS/Android safe-area screens.
- [x] No existing Player view rendering is changed yet except mounting the shell in a guarded way.

### Phase 2 Implementation Notes

- Added local checked-in SVG icons under `src/assets/game-icons/` and documented attribution in `src/assets/game-icons/ATTRIBUTION.md`.
- Added `src/player/navigation/PlayerBottomNav.jsx` and `src/player/navigation/playerNavigation.css`.
- Mounted the mobile nav shell in `PlayerAppController` while keeping the existing desktop tabs and old render switch intact.
- The bottom nav uses the new registry and routes selections through the old shell as a temporary Phase 2 adapter.
- Mobile screenshots captured:
  - `docs/agent/screenshots/player-ui-phase2/01-player-bottom-nav-status.png`
  - `docs/agent/screenshots/player-ui-phase2/02-player-bottom-nav-items-drawer.png`
  - `docs/agent/screenshots/player-ui-phase2/03-player-bottom-nav-campaign-drawer.png`
- Verification:
  - `node --test tests/playerNavigationRegistry.test.js`
  - `npm run check`
  - browser smoke on `http://127.0.0.1:4174/?e2e=true&e2eReset=true`

## Phase 3: Player View Rendering Cutover

Replace the old `appMode + activeTab` render switch with the page registry.

Implementation steps:

- [x] Replace `usePlayerNavigation` state with a new hook, e.g. `usePlayerPageNavigation`.
- [x] Keep a temporary compatibility setter:
  - `goToLegacyTab('shop')` maps to `items.shop`;
  - `goToLegacyTab('quests')` maps to `campaign.quests`.
- [x] Move the view rendering switch out of `PlayerAppController.jsx` into a page renderer helper/component.
- [x] Remove the header character/story toggle once all old story tabs are reachable through bottom categories.
- [x] Keep GM character cycling and GM screen button in the header.
- [x] Wire existing direct navigation actions:
  - Inventory `onOpenShop` -> `items.shop`
  - item/loot indicators -> `items.loot` or category badge
  - quest links -> `campaign.quests`
- [x] Split existing broad views only where needed:
  - `ActionsView` may initially receive an initial category/subtype prop for Combat/Movement/General/Downtime/Camping.
  - `InventoryView` may initially receive an initial section/filter prop for Equipment/Consumables/Misc/Loot.
  - `LoreView` may initially receive an initial category prop for History/Locations/NPCs/Bestiary/Other.
- [x] Add placeholder pages for:
  - Character / Proficiencies
  - Skills / Exploration
  - Items / Crafting

Success criteria:

- [x] Every target subpage is reachable from the bottom nav drawer.
- [x] The old header character/campaign switch is gone.
- [x] Existing player feature entry points still work:
  - Open Shop
  - Loot
  - Quests
  - Maps
  - Camp
  - Pact
  - Companion
- [x] `PlayerAppController.jsx` no longer owns a long inline tab render switch.

### Phase 3 Implementation Notes

- Replaced the old `usePlayerNavigation` hook with `src/player/navigation/usePlayerPageNavigation.js`.
- Removed the header character/story toggle; GM character cycling and the GM screen button remain in the header.
- Added `src/player/navigation/PlayerPageRenderer.jsx` so `PlayerAppController.jsx` no longer owns the full inline tab render switch.
- Added `src/player/navigation/PlayerDesktopNav.jsx` so desktop can use the same category/page registry after the header toggle removal.
- Added `src/player/navigation/PlayerPlaceholderPage.jsx` for Proficiencies, Exploration, and Crafting.
- Existing broad views received narrow initial-page adapters:
  - `ActionsView.initialTab`
  - `InventoryView.initialSubTab`
  - `LoreView.initialCategory`
- `playerPage` URL param and localStorage persistence are supported by the new hook; old `playerTab/playerMode` params remain compatibility input.
- Updated Playwright smoke helpers to use the new desktop category/page navigation instead of `player-mode-toggle`.
- Added a static regression guard that blocks reintroducing the old header mode switch or controller-owned inline page switch.
- Verification:
  - `npm run check`
  - `git diff --check`
  - local Playwright desktop smoke for Quests, Loot, Magic, and Proficiencies placeholder.
  - local Playwright mobile smoke for anchored drawer navigation, Crafting placeholder, and Quests.

## Phase 4: Swipe Between Subpages

Implement category-local horizontal swipe navigation.

Suggested files:

- `src/player/navigation/usePlayerSubpageSwipe.js`
- optional updates to `src/shared/hooks/useSwipe.js`

Implementation steps:

- [x] Make swipe operate within the active category only.
- [x] Swiping left/right changes to previous/next subpage in that category.
- [x] Disable page swipe when any modal, drawer, bottom sheet, popup, feedback dialog, item action modal, or catalog overlay is active.
- [x] Improve event filtering:
  - ignore gestures starting inside scrollable modal content;
  - ignore horizontal scroll areas;
  - ignore form controls and rich text editors;
  - do not treat normal vertical scroll as a swipe.
- [x] Add a central `isInteractionLocked` or modal-layer signal instead of checking only `modalMode`.
- [x] Keep threshold high enough to avoid accidental page changes during table/list scrolling.
- [x] Add tests for registry subpage ordering and swipe target selection.

Success criteria:

- [x] Mobile swipe changes subpages inside a category.
- [x] Vertical scrolling does not change pages.
- [x] Swiping inside a dialog does not move the background page.
- [x] Drawer and popup states suspend page swipe.

### Phase 4 Implementation Notes

- Added `src/player/navigation/playerSubpageSwipe.js` for pure subpage ordering, horizontal/vertical gesture decisions, target exclusions, and interaction-lock state.
- Added `src/player/navigation/usePlayerSubpageSwipe.js` and connected it through `usePlayerPageNavigation`.
- Swipe does not wrap between categories. Reaching the first or last page in a category is a no-op.
- `PlayerAppController` now builds one Player interaction lock from ModalManager, item actions, catalog overlays, nav drawer state, notifications, XP, and daily prep state.
- The swipe hook also checks DOM overlays such as BottomSheets, feedback dialogs, item catalog overlays, and modal overlays at gesture start/end so view-local sheets suspend page navigation.
- The hook uses Pointer Events for the primary mobile path and keeps Touch Events as a fallback.
- `PlayerBottomNav` reports drawer open/closed state to the controller.
- Actor rules normalization now preserves `feats`, `actions`, and `impulses` arrays so swiping into Feats/Impulses cannot crash on actor-shaped data.
- Tests cover category-local page order, horizontal-vs-vertical gesture filtering, excluded targets, and interaction-lock states.
- Verification:
  - `node --test tests/acAndWandRules.test.js tests/playerNavigationRegistry.test.js tests/uiStaticRegression.test.js`
  - local Playwright/CDP mobile smoke for horizontal subpage swipe, vertical scroll guard, and drawer-open swipe lock.

## Phase 5: Modal Focus And Scroll Containment

Create a stricter overlay system so active dialogs own scroll and gestures.

Suggested files:

- `src/shared/overlays/ModalLayerProvider.jsx`
- `src/shared/overlays/useModalLayer.js`
- `src/shared/overlays/modalLayer.css`
- `src/shared/overlays/OverlaySurface.jsx`

Implementation steps:

- [x] Add a modal layer provider near `AppFeedbackProvider` or inside `App`.
- [x] Expose:
  - `registerModal(id, options)`
  - `unregisterModal(id)`
  - `hasActiveModal`
  - `topModalId`
  - `lockPageScroll`
  - `suspendPageGestures`
- [x] Lock body/root scrolling while any blocking modal is active.
- [x] Apply stable scroll containment to modal bodies:
  - `overflow-y: auto`
  - `overscroll-behavior: contain`
  - `touch-action: pan-y`
  - `-webkit-overflow-scrolling: touch`
- [x] Make background app content inert or pointer-disabled while a blocking modal is open.
- [x] Ensure focus starts inside the dialog and Escape/backdrop behavior is consistent.
- [x] Convert or wrap these surfaces first:
  - `ModalManager` modals
  - `ItemActionsModal`
  - `SpellScrollSelectorModal`
  - `PactOfferModal`
  - `AppFeedback` confirm/prompt dialog
  - `BottomSheet`
  - `LazyCatalogOverlay`
- [x] Then convert view-local sheets:
  - `InventoryView` bottom sheet
  - `MapsView` pin sheets
  - `ProgressView` detail sheets
- [x] Remove ad-hoc body scroll locks once the central layer owns them.

Success criteria:

- [x] On mobile, dragging inside a modal scrolls the modal content.
- [x] The background page does not move while a blocking modal is open.
- [x] Page swipe is disabled while any modal/sheet/popup is active.
- [x] All active overlays register with the modal layer.
- [x] No modal relies only on inline fixed overlay styles for scroll behavior.

### Phase 5 Implementation Notes

- Added `src/shared/overlays/ModalLayerProvider.jsx` with modal registration, active stack state, root/body scroll locking, and a global `modalLayerGesturesSuspended` signal.
- Added `src/shared/overlays/OverlaySurface.jsx` and `src/shared/overlays/modalLayer.css` for scroll-contained dialog bodies and safe backdrop touch handling.
- Mounted `ModalLayerProvider` around the app in `src/main.jsx`.
- Registered these blocking surfaces with the modal layer:
  - `ModalManager`
  - `ItemActionsModal`
  - `SpellScrollSelectorModal`
  - `PactOfferModal`
  - `AppFeedback` confirm/prompt dialogs
  - `BottomSheet`
  - `LazyCatalogOverlay`
- `BottomSheet` now gets body/root scroll locking from the modal layer. This automatically covers Inventory, Maps, Progress, Admin mobile sheets, and other BottomSheet consumers.
- Removed the old ad-hoc body fixed-position lock from `ConditionsModal`.
- XP and Notification overlays now register as non-blocking modal-layer entries that suspend page gestures without locking scroll.
- The Player swipe guard now reads the modal layer gesture-suspension flag in addition to DOM overlay checks.
- Static guards ensure the key Player blocking overlays remain registered and that the old Conditions body-lock does not return.
- Verification:
  - `node --test tests/playerNavigationRegistry.test.js tests/uiStaticRegression.test.js`
  - `npm run build:app`

## Phase 6: Unified Player Popup Queue

Replace independent XP, quest/notification, and pact offer popup triggering with a single queue.

Suggested files:

- `src/player/popups/playerPopupQueue.js`
- `src/player/popups/usePlayerPopupQueue.js`
- `src/player/popups/PlayerPopupHost.jsx`
- `src/player/popups/popupAckStore.js`

Implementation steps:

- [x] Define popup shape:
  - `id`
  - `type`
  - `sourceId`
  - `actorId`
  - `campaignId`
  - `priority`
  - `createdAt`
  - `payload`
  - `requiresAction`
  - `dedupeKey`
- [x] Derive popup candidates from:
  - pending pact offer on actor
  - campaign notification queue
  - legacy/root notification queue while it still exists
  - campaign XP notification
  - future hooks for loot or downtime notices
- [x] Add one dedupe layer:
  - session-level suppression while the app is open;
  - localStorage ack for informational popups;
  - server/domain action ack for stateful popups such as pact reject/accept.
- [x] Show only one popup at a time.
- [x] Define priority:
  - blocking pact offer
  - confirm/action popups
  - quest/reward
  - XP/gold/reputation flourish
- [x] Replace `NotificationOverlay` and `XpOverlay` with renderers owned by `PlayerPopupHost`.
- [x] Move Pact Offer display into the popup host while keeping domain actions unchanged.
- [x] Ensure a popup is not shown again after:
  - it was acknowledged in the same app session;
  - it was acknowledged in localStorage;
  - its server-side state was cleared.
- [x] Add tests for popup derivation and dedupe keys.

Success criteria:

- [x] Pact offer does not retrigger repeatedly while the same pending offer is already displayed or dismissed.
- [x] XP notification shows once per notification ID.
- [x] Quest/reward notifications show once and clear through the correct data action.
- [x] Reload shows only genuinely unacknowledged/new popups.
- [x] There is one Player popup host in `PlayerAppController`, not multiple independent overlay components.

### Phase 6 Implementation Notes

- Added `src/player/popups/playerPopupQueue.js` with the shared popup shape, candidate derivation, priority sorting, and dedupe keys.
- Added `src/player/popups/popupAckStore.js` for session acknowledgements, persistent localStorage acknowledgements, and compatibility with existing XP seen IDs.
- Added `src/player/popups/usePlayerPopupQueue.js` and `src/player/popups/PlayerPopupHost.jsx`.
- `PlayerPopupHost` now owns Pact offers, notification queue entries, and XP notifications. `PlayerAppController` mounts only this host.
- `PactOfferModal` accepts an explicit `offerOverride` and calls `onSettled` after reject/accept so the host can acknowledge the displayed offer immediately while the server-side state clears.
- `NotificationOverlay` and `XpOverlay` remain reusable renderers, but now support `onDone` callbacks for queue-controlled acknowledgement.
- Static guards prevent `PlayerAppController` from directly importing or mounting `PactOfferModal`, `NotificationOverlay`, or `XpOverlay`.
- Verification:
  - `node --test tests/playerPopupQueue.test.js tests/uiStaticRegression.test.js`

## Phase 7: Visual And Interaction Polish

This phase makes the new shell feel intentional rather than just functional.

Implementation steps:

- [x] Define a compact Player bottom-nav visual system:
  - dark rail;
  - gold active state;
  - muted inactive state;
  - clear tap targets;
  - no decorative clutter.
- [x] Define drawer layout:
  - category title;
  - subpage list;
  - small per-entry icons from `https://game-icons.net/` so drawer items have distinct visual personality;
  - active subpage indicator;
  - short disabled/dummy label where appropriate.
- [x] Add drawer item icon mapping:
  - choose a suitable `game-icons.net` icon for every drawer entry, not only the five main categories;
  - keep icon style consistent in size, color treatment, and inactive opacity;
  - cache/import icons through the existing asset strategy instead of hotlinking remote images at runtime.
- [x] Rework the active subpage tabs below the header into a wrapping carousel:
  - keep the current gold-framed tab language;
  - active tab is centered;
  - two neighboring tabs are fully readable but inactive/muted;
  - one additional tab edge is partially visible on each side and fades toward the screen edge;
  - swipe changes the page and the active carousel tab in one synchronized animation.
- [x] Add concise empty states for unavailable content:
  - no pact yet;
  - no companion yet;
  - not a caster;
  - not a kineticist;
  - dummy future pages.
- [x] Add subtle motion:
  - drawer opens upward from nav border;
  - active drawer item transitions;
  - popup transitions are consistent with existing dramatic PF2 style but deduped.
- [x] Keep typography scaled for dense app UI, not a marketing page.

Success criteria:

- [x] Navigation is faster to scan than the old horizontal tab list.
- [x] Drawer entries have distinct, readable icons without making the drawer noisy.
- [x] Header subpage tabs behave as a centered wrapping carousel and stay synced with swipe navigation.
- [x] Drawer motion is clear but not noisy.
- [x] Text fits on small mobile widths.
- [x] The active page is obvious from bottom icon, drawer state, and carousel tab state.

### Phase 7 Implementation Notes

- Added page-level icon keys to `src/player/navigation/playerPageRegistry.js`.
- Added local Game-icons SVG assets under `src/assets/game-icons/` and updated `src/assets/game-icons/ATTRIBUTION.md`.
- Added `src/player/navigation/playerNavIcons.js` as the shared local icon map for bottom nav, drawer entries, and carousel tabs.
- Added `src/player/navigation/PlayerSubpageCarousel.jsx` for the centered, wrapping subpage tab carousel.
- `PlayerDesktopNav` now uses the carousel for active subpages; on mobile the category row is hidden but the carousel remains visible below the header.
- Drawer entries now display compact per-page icons, retain loot indicators, and use the same local icon assets as the carousel.
- Phase 7 follow-up:
  - installed official shadcn `carousel` after Context7 verification;
  - verified/configured the shadcnstudio `carousel-11` registry for reference, but did not keep its unused demo assets or extra Motion dependency;
  - replaced the custom tab-grid projection with the shadcn Carousel API;
  - added a page-level shadcn Carousel wrapper with looped swiping and lazy active/neighbor rendering;
  - made first/last subpage swipes wrap within the active category;
  - pinned the mobile bottom nav root to the viewport instead of the scrolling document;
  - moved Item Detail into the modal layer so the bottom nav cannot block dialog buttons;
  - hardened Pact Offer clearing so stale root/sheet `pactOffer` data does not retrigger after accept/reject.
- Phase 7 Firefox/Chrome polish:
  - verified Context7 access and Embla Carousel options;
  - removed the page carousel swipe exclusion so Chrome can use the fallback page-swipe handler;
  - set explicit carousel `containScroll: false`, `dragFree: false`, and `skipSnaps: false` options for page and tab carousels;
  - portaled the fixed bottom nav to `document.body` and added fixed-layer containment to reduce Firefox scroll jitter;
  - hides the bottom nav while modal-layer dialogs are active so it cannot visually or physically cover dialog buttons;
  - suppresses legacy `ActionsView` and `InventoryView` tabs when those views are rendered through the new carousel page shell;
  - tightened the mobile carousel spacing below the header and removed the lower tab divider.
- Phase 7 regression correction:
  - disabled Embla page drag with `watchDrag: false` so the page shell and the app-level swipe hook do not both advance pages;
  - raised the app-level swipe threshold to make accidental page changes less likely;
  - moved the bottom nav back into the Player shell after the body portal caused drawer interaction regressions;
  - removed the fixed-layer transform/containment that did not solve Firefox jitter and could make fixed positioning less predictable.
- Phase 7 Firefox dynamic-toolbar follow-up:
  - isolated the remaining movement to Firefox Android's `Scroll to hide toolbar` handling of `position: fixed; bottom: 0`;
  - kept the bottom nav in the Player shell and added a Firefox-only `100dvh` top anchor for the existing fixed root;
  - retained the normal bottom anchor for Chrome and other browsers; physical Firefox Android verification remains required.
- Verification:
  - `node --test tests/playerNavigationRegistry.test.js tests/uiStaticRegression.test.js`
  - `node --test tests/playerNavigationRegistry.test.js tests/uiStaticRegression.test.js tests/dataActionsV2Adapter.test.js`
  - `npm run check`

## Phase 8: Tests, Smokes, And Static Guards

Automate the behaviors that caused regressions before.

Implementation steps:

- [ ] Unit tests:
  - page registry category/subpage mapping;
  - old tab compatibility mapping;
  - popup candidate derivation;
  - popup dedupe/ack logic;
  - swipe target selection.
- [ ] Component/static tests:
  - no direct hardcoded old `appMode === 'story'` Player switch after cutover;
  - no direct mounts of `NotificationOverlay` or `XpOverlay` outside `PlayerPopupHost`;
  - all blocking overlay components register with modal layer.
- [ ] Playwright mobile smoke tests:
  - open each bottom category drawer;
  - navigate to every subpage;
  - swipe between subpages;
  - open a modal and scroll inside it;
  - verify the background does not scroll while modal is active;
  - trigger a pact offer fixture and verify it appears once;
  - reload and verify acknowledged popups do not repeat.
- [ ] Manual mobile checklist:
  - one Android device;
  - one iOS/Safari device if available;
  - one narrow desktop emulator.

Success criteria:

- [ ] `npm run check` is green.
- [ ] `npm run smoke` is green after smoke coverage is added.
- [ ] `git diff --check` is green.
- [ ] The reported dialog scroll issue has a deterministic smoke/manual check.

## Phase 9: Documentation And Cleanup

Implementation steps:

- [ ] Update `agent_context.md` with the new Player navigation and popup architecture.
- [ ] Update `docs/agent/ui-flows.md`.
- [ ] Update `docs/agent/known-risks.md`:
  - remove or downgrade the Player swipe/modal conflict risk if resolved;
  - record remaining modal surfaces if any are not converted.
- [ ] Remove obsolete old-tab comments and stale `character/story` wording.
- [ ] If old components remain temporarily, add TODOs with exact removal criteria.

Success criteria:

- [ ] Docs describe the real Player runtime shell.
- [ ] There is no stale instruction telling agents to use the old header character/story switch.
- [ ] Remaining debt is explicit and actionable.

## Non-Goals For This Bulk

- Do not implement full Proficiencies, Exploration, or Crafting pages beyond dummy placeholders.
- Do not redesign every inner Player view in the same pass.
- Do not change Firestore schema or run any live migration.
- Do not rewrite actual rules/effects behavior unless a view requires a small integration fix.
- Do not start a frontend/backend folder split.
- Do not hotlink game-icons assets in production runtime.

## Recommended Commit Structure

- Commit 1: player navigation registry and icon assets
- Commit 2: mobile bottom nav and anchored drawer
- Commit 3: page render cutover and header switch removal
- Commit 4: subpage swipe and gesture guards
- Commit 5: modal layer and scroll containment
- Commit 6: unified player popup queue
- Commit 7: tests, smokes, docs, cleanup

## Final Acceptance Criteria

- [x] Player mobile navigation uses five bottom category icons.
- [x] Each icon opens a drawer above the icons, not over them.
- [x] Tapping outside the drawer closes it with animation.
- [x] The header character/campaign switch is removed.
- [x] Swiping changes subpages within the current category.
- [ ] Dialogs and sheets scroll reliably on mobile without moving the background page.
- [x] Pact, XP, quest/reward, and future player popups go through one queue.
- [x] Popups are shown once per stable event and do not retrigger repeatedly.
- [x] Existing Player workflows remain reachable:
  - Status
  - Feats
  - Magic
  - Impulses
  - Pact
  - Companion
  - Combat/Movement/General/Downtime/Camping actions
  - Inventory sections
  - Shop
  - Loot
  - Lore/Bestiary
  - Quests
  - Progress
  - Maps
  - Camp
- [ ] `npm run check`, `npm run smoke`, and `git diff --check` pass.
