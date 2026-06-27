# Post-Migration Hardening Roadmap

Last updated: 2026-06-27.

## Zweck

Diese Roadmap fasst die Massnahmen aus dem aktuellen Code-Review und dem Abgleich mit `docs/review nach migration.md` in umsetzbare Arbeitspakete zusammen. Sie ist bewusst als abhaktbare Checkliste geschrieben und kann ueber mehrere Paesse abgearbeitet werden.

Leitentscheidung:

- Erst robuste V2-/Actor-/Effect-Pfade stabilisieren.
- Dann grosse Dateien schneiden.
- Danach Reusable UI-Komponenten und Browser-Smokes ausbauen.
- Keine Wegwerf-Fixes, wenn ein sauberer Domain-/Actor-/Selector-Pfad bereits klar ist.

## Aktueller Ausgangspunkt

- `main` ist V2-first und der normale App-Entry nutzt keine Legacy-Projektion mehr, aber einige Compatibility-Viewmodels existieren noch.
- `npm run check` ist zuletzt gruen gelaufen: Tests, Broad-Write-Guard, Lint, Vite Build.
- `legacyProjection` ist aus dem normalen App-Entry entfernt; Legacy-Projektion bleibt in Normalizer-/Migrationstests und explizitem Helper-Code.
- `actorEffects` sind kanonische Runtime-Quelle fuer Conditions, Mutagene und stat-relevante Effekte.
- `itemIdentity.js` existiert, aber einige UI-/Combat-Hotspots nutzen noch lokale Matching-Regeln.
- `createDataActions.js` ist der groesste verbleibende Domain-Monolith.

## Gemeinsame Gates Fuer Jeden Pass

- [ ] `npm run check`
- [ ] `git diff --check`
- [ ] Keine neuen Treffer fuer verbotene Runtime-Muster:
  - [ ] `setDb(`
  - [ ] `writeLegacyDbDiffToV2`
  - [ ] `character.conditions`
  - [ ] `character.companion`
  - [ ] `currentMutagen`
  - [ ] runtime `db.characters`
  - [ ] unguarded `/api/files/save`
- [ ] Dokumentation aktualisiert, wenn ein Daten- oder Architekturvertrag geaendert wurde.
- [ ] Keine Live-Firestore-Migration ohne separate explizite Freigabe.

## Pass 0: Checkpoint Des Aktuellen Gruenen Stands

Ziel: Die letzte Hardening-Welle sichern, bevor neue Refactors beginnen.

- [x] `git status --short --branch` pruefen.
- [x] Sicherstellen, dass `docs/review nach migration.md` bewusst behandelt wird: bleibt als separates untracked Review-Dokument erhalten.
- [x] `npm run check` erneut ausfuehren.
- [x] `git diff --check` ausfuehren.
- [x] Commit erstellen, z. B. `harden actor rules rewards and identity`.
- [x] Push auf `origin/main`, falls Deployment/Preview gewuenscht ist.

Akzeptanz:

- [x] Arbeitsstand ist nachvollziehbar gesichert.
- [x] Neue Paesse starten nicht auf einem gemischten, uncommitted Review-/Hardening-Diff.

## Pass 1: Campaign XP Threshold Actor-Sync

Problem: `campaign.advancement.xpThreshold` existiert, aber die Admin-UI aendert den Wert derzeit ueber `campaign.updateCampaign` und mutiert dabei `campaign.characters`. In V2 persistiert das nicht zuverlaessig in PC-Actor-Dokumente.

Ziel: XP-Maximum ist ein Campaign-Setting, wird aber bei Aenderung sauber auf aktive PC-Actors synchronisiert.

- [x] Neue Domain-Action einfuehren: `dataActions.campaign.setXpThreshold(campaignId, threshold)`.
- [x] V2-Adapter nutzt eine gezielte Campaign+Actors-Transaktion, analog zu `setPartyXp`.
- [x] Legacy-Adapter nutzt den bestehenden Campaign-Reducer und synchronisiert `characters[].xp.max`.
- [x] Campaign-Reducer um pure Funktion erweitern, z. B. `setCampaignXpThresholdInCampaign(campaign, threshold)`.
- [x] Admin-Players-XP-Max-Input auf `setXpThreshold` umstellen.
- [x] Keine UI-Komponente darf direkt `campaign.characters` mutieren, um Actor-Daten zu synchronisieren.

Tests:

- [x] Reducer-Test: `setCampaignXpThresholdInCampaign(..., 1200)` setzt `campaign.advancement.xpThreshold = 1200`.
- [x] Reducer-Test: aktive Characters/Actors erhalten `xp.max = 1200`.
- [x] Reducer-Test: archivierte Characters/Actors werden nicht reaktiviert oder ungewollt veraendert.
- [x] V2-Adapter-Test: `campaign.setXpThreshold` ruft Campaign+Actor-Repo-Pfad auf, nicht nur `campaignRepo.updateCampaign`.
- [x] Static Regression Test: `AdminTabContent.jsx` enthaelt keine direkte `campaign.characters = ...` XP-Synchronisation mehr.

Akzeptanz:

- [x] Aenderung von XP-Max im GM Players Tab ueberlebt Reload.
- [x] Spieler-Actor zeigt danach das neue XP-Maximum.
- [x] `setPartyXp` und Quest-XP-Rewards nutzen weiterhin denselben Campaign-Threshold.

## Pass 2: V2-Only Runtime Cutover

Problem: `legacyProjection` und compatibility-shaped `db` sind noch Teil des normalen App-/Context-Vertrags. Das macht Rueckfaelle auf Legacy-Felder leicht.

Ziel: Normale Runtime liest aus V2-Viewmodels. Legacy-Projektion bleibt nur Import-/Backup-/Migrationstestmaterial.

- [x] `CampaignContext`-Public-Contract finalisieren:
  - [x] `activeCampaign`
  - [x] `campaigns`, `archivedCampaigns`
  - [x] `actors`, `pcActors`, `ownedActors`, `myActor`
  - [x] `quests`, `lootBags`, `encounters`, `maps`, `members`
  - [x] `shop`, `bestiary`, `lore`, `pacts`, `abilities`, `catalogOverrides`
  - [x] `dataActions`, `dbStatus`
- [ ] UI-Verbraucher von `db` auf gezielte Context-Viewmodels umstellen.
- [x] `App.jsx` soll im normalen Runtime-Pfad kein `legacyProjection` als `importDb` weiterreichen.
- [x] `useFirestoreV2Db` soll `composeLegacyDbFromV2Documents` nur noch fuer expliziten Import-/Backup-Pfad bauen, nicht bei jedem normalen Snapshot.
- [x] `runtimeDb.js` root-Fallbacks fuer `db.quests`/`db.lootBags` aus dem normalen UI-Vertrag entfernen oder klar als Import-Compatibility isolieren.
- [x] `legacyUserInfo`-Fallback im `CampaignContext` entfernen, sobald Members/assignedActorId fuer alle relevanten Flows V2-native gelesen werden.
- [x] Static Guards verschaerfen: Runtime-Views duerfen `legacyProjection`, root `db.quests`, root `db.lootBags`, root `db.characters` nicht neu verwenden.

Tests:

- [ ] Selector-Test: Player, GM, Party und Camp erhalten ihre Daten aus V2-Viewmodels ohne Legacy-Projektion.
- [x] Static Test: `App.jsx` enthaelt kein normales `importDb={legacyProjection}` mehr.
- [x] Static Test: `useFirestoreV2Db` importiert `composeLegacyDbFromV2Documents` nur noch in einem explizit benannten legacy/import helper oder gar nicht.
- [x] Regression: Catalog Overrides, Quests, LootBags, Shop und Bestiary bleiben sichtbar.

Akzeptanz:

- [x] Normale App-Routen funktionieren ohne Legacy-Master als Runtime-Quelle.
- [x] Legacy-Code ist fuer Entwickler sichtbar als Import-/Backup-Schicht markiert.

## Pass 3: Item Identity Hotspots Schliessen

Problem: `instanceId` ist kanonisch, aber wichtige UI-/Combat-Flows matchen Items weiter lokal per Name, `_index`, `addedAt` oder Equipped-Flag.

Ziel: Inventory-, Loot-, Shop-, Combat- und ActorSheet-Flows verwenden dieselben zentralen Identity-Resolver.

- [x] `itemIdentity.js` bei Bedarf erweitern:
  - [x] `findInventoryItemIndex`
  - [x] `findLootItemIndex`
  - [x] `resolveInventoryItemIdentity`
  - [x] `resolveLootItemIdentity`
  - [x] optional `sameInventoryItem`
  - [x] `findStackableInventoryItemIndex`
  - [x] `getItemIdentityKey`
- [x] `usePlayerInventoryActions` komplett auf Resolver umstellen:
  - [x] consume
  - [x] equip/toggle
  - [x] rune apply/remove
  - [x] weapon load/fire
  - [x] ammo matching
  - [x] formula/prepared item flows
- [x] `ActorSheetCard` lokale Inventory-Suchen ersetzen.
- [x] `ItemDetailModal` lokale Inventory-/Rune-Suchen ersetzen.
- [x] Alte shared Hooks `useCombatLogic` und `useInventoryLogic` entweder entfernen oder auf Resolver umstellen, falls sie noch genutzt werden.
- [x] `InventoryView` lokale Wand-/Loot-Matcher auf shared Resolver umstellen.
- [x] GM `ItemsView` Selection Keys fuer side/global items pruefen und dort, wo echte Inventory/Loot-Instanzen betroffen sind, `instanceId` bevorzugen.

Tests:

- [x] Doppelte gleichnamige Items koennen separat equipped/consumed/transferred werden.
- [x] Ammo mit gleichem Namen aber unterschiedlicher Instanz verhaelt sich deterministisch.
- [x] Rune apply/remove trifft das richtige Item.
- [x] Loot claim und partial claim bleiben stabil.
- [x] Static Test: keine neuen lokalen `findIndex(i => i.name === item.name...)` in migrierten Inventory-/Combat-Dateien.

Akzeptanz:

- [x] `instanceId` ist in Runtime-Flows der primaere Schluessel.
- [x] Fallback-Matching ist auf zentrale Resolver beschraenkt.

## Pass 4: `createDataActions.js` In Domain-Factories Schneiden

Problem: Eine 1800+ Zeilen Factory erschwert Review, Tests und neue Features. Der Code mischt Infrastruktur, Legacy-Adapter, V2-Adapter und Domain-Logik.

Ziel: `createDataActions.js` wird Aggregator; Domain-Actions sind einzeln testbar.

- [x] Gemeinsame Action-Infrastruktur extrahieren:
  - [x] `createDomainId`
  - [x] `nowIso`
  - [x] `updateDbLegacy`
  - [x] `updateCampaignLegacy`
  - [x] Actor/Character compatibility conversion helpers
  - [x] Repository/context object
- [ ] Domain-Factories anlegen:
  - [x] `createActorActions`
  - [x] `createEffectActions`
  - [ ] `createCampaignActions`
  - [ ] `createMemberActions`
  - [ ] `createInventoryActions`
  - [ ] `createLootActions`
  - [ ] `createQuestActions`
  - [ ] `createEncounterActions`
  - [ ] `createMapActions`
  - [ ] `createProgressActions`
  - [ ] `createCampingActions`
  - [x] `createCatalogActions`
  - [ ] `createGlobalContentActions`
- [ ] Public API stabil halten: `dataActions.actor.*`, `dataActions.quest.*`, usw. duerfen fuer UI-Code gleich bleiben.
- [ ] Legacy-Adapter nur dort behalten, wo Tests/Import-Compatibility ihn noch brauchen.
- [x] Nach jedem 2-3 Domain-Factory-Extraktionen `npm run check` laufen lassen.

Tests:

- [x] Bestehende `dataActionsLegacy.test.js` und `dataActionsV2Adapter.test.js` bleiben gruen.
- [ ] Neue Domain-Factory-Tests nur dort ergaenzen, wo Verhalten nicht schon abgedeckt ist.
- [ ] Static Test: `createDataActions.js` importiert Domain-Factories und enthaelt nicht mehr die grossen Domain-Funktionskoerper.

Akzeptanz:

- [ ] `createDataActions.js` ist ein Aggregator, kein God-Object.
- [ ] Neue Domain-Actions koennen ohne Bearbeiten einer 1800-Zeilen-Datei ergaenzt werden.

## Pass 5: Shared Reusables Fuer Catalog Details Und Item-Zeilen

Problem: Player und GM implementieren Catalog-Detail-Fetch, Content-Link-Navigation und Item-Zeilen mehrfach.

Ziel: Wiederkehrende Darstellung und Detail-Logik werden in gemeinsamen Komponenten/Hooks gebuendelt.

### 5A: Shared Catalog Detail Controller

- [ ] Shared Hook einfuehren, z. B. `useCatalogDetailController`.
- [ ] Hook kapselt:
  - [ ] SourceFile-Ermittlung fuer Item/Spell/Feat/Action/Impulse
  - [ ] Detail-Fetcher-Auswahl
  - [ ] Cache per SourceFile
  - [ ] Loading/Error-State
  - [ ] Content-Link-Click-Aufloesung
  - [ ] Modal-History optional fuer Player
- [ ] `AdminApp` und `usePlayerCatalogInspection` auf den Hook umstellen.
- [ ] ActorSheet/GM Players duerfen denselben Controller nutzen, statt Stub- oder Sonderlogik.

Tests:

- [ ] Unit-Test fuer SourceFile-Ermittlung je Entity-Typ.
- [ ] Unit-Test fuer Content-Link-Aufloesung.
- [ ] Static Test: Detail-Fetch-Branches sind nicht mehr doppelt in Admin und Player implementiert.

### 5B: Shared ItemRow / CatalogItemRow

- [ ] Gemeinsames Row-ViewModel definieren:
  - [ ] Icon
  - [ ] Name
  - [ ] Level/Rank
  - [ ] Type/Category
  - [ ] Traits
  - [ ] Qty/Price/Equipped/Prepared/Wand-Charges optional
  - [ ] Actions/ContextMenu capability flags
- [ ] `InventoryView` nutzt Shared Row fuer Inventory und Loot-Items.
- [ ] `ShopView` nutzt Shared Row fuer Kaufzeilen.
- [ ] GM `ItemsViewLayout` nutzt Shared Row fuer Catalog, Trader und Lootbag-Seitenlisten.
- [ ] Visuals nur angleichen, keine groessere UI-Neugestaltung in diesem Pass.

Tests:

- [ ] Snapshot- oder static test: relevante Views importieren Shared Row.
- [ ] Manual Smoke: Inventory, Shop, Loot, GM Items zeigen weiterhin korrekte Icons/Metas/Aktionen.

Akzeptanz:

- [ ] Ein Item-Anzeigefeld wird an einer Stelle gefixt und wirkt in allen relevanten Screens.

## Pass 6: Browser-Smokes Fuer Spielabend-Flows

Problem: Unit-/Reducer-/Static-Tests sind stark, aber es fehlt E2E-Sicherheit fuer echte Benutzerfluesse.

Ziel: Mindestens ein automatisierter Browser-Smoke deckt die wichtigsten Player-/GM-Flows ab.

- [ ] Playwright oder vergleichbares Browser-Test-Setup einfuehren.
- [ ] Testdatenstrategie festlegen:
  - [ ] bevorzugt lokale/emulierte Daten oder deterministic V2 fixture
  - [ ] keine Live-Produktionsdaten veraendern
- [ ] Smoke 1: App startet, Login-/Auth-Gate wird sinnvoll behandelt.
- [ ] Smoke 2: GM kann Campaign/Player View laden.
- [ ] Smoke 3: Player kann HP, Gold, Condition anzeigen/aendern.
- [ ] Smoke 4: GM gibt Custom Item an Player.
- [ ] Smoke 5: Lootbag create, item claim, gold split.
- [ ] Smoke 6: Quest Reward wird genau einmal angewendet.
- [ ] Smoke 7: Encounter HP/Initiative/Condition auf Player und Creature.
- [ ] Smoke 8: Spell/Item edit ueber Catalog Overrides sichtbar in Player Add-Flow.
- [ ] `npm run smoke` Script ergaenzen.
- [ ] Optional spaeter: `npm run check:e2e` getrennt von schnellem `npm run check`.

Akzeptanz:

- [ ] Kritische Spielabend-Flows koennen vor Deploy reproduzierbar geprueft werden.
- [ ] Regressionen wie "GM Item Give geht nicht" oder "Spell Override im Player Add Spell unsichtbar" fallen automatisiert auf.

## Pass 7: UI-Hardening Und Logging

Problem: Browser-native Dialoge und ungefilterte Logs bleiben UX- und Wartungsschulden.

Ziel: Kritische Dialoge sind kontrollierbar, stylbar und mobil robuster; Debug-Logs laufen nicht ungefiltert in Produktion.

- [ ] Gemeinsamen Notification/Error-Service oder Hook einfuehren, z. B. `useAppFeedback`.
- [ ] `runDataAction` Fehler nicht nur per `alert`, sondern ueber ein konsistentes UI anzeigen.
- [ ] Native Dialoge schrittweise ersetzen:
  - [ ] destructive GM-Aktionen
  - [ ] Migration/FirebaseMigrator Aktionen
  - [ ] Player Inventory/Loot prompts
  - [ ] FormulaBook Daily Prep
- [ ] `console.log` in Runtime durch `debugLog` hinter `import.meta.env.DEV` ersetzen.
- [ ] `console.warn` fuer echte Warnungen behalten, aber noisy Debug-Warnungen reduzieren.

Tests:

- [ ] Static Test: keine neuen `prompt(` in migrierten Runtime-Dateien.
- [ ] Static Test: keine neuen `console.log(` in Runtime-Dateien ausser explicit dev-guarded helper.

Akzeptanz:

- [ ] Kritische Nutzeraktionen koennen nicht mehr durch native Dialog-Eigenheiten kaputtgehen.
- [ ] Production-Konsole ist deutlich sauberer.

## Pass 8: Legacy-Isolation Finalisieren

Problem: Legacy-Code ist noch im normalen Quellbaum sichtbar und teilweise im Runtime-Vertrag erreichbar.

Ziel: Legacy existiert nur fuer Import, Backup, Migrationstests und historische Wiederherstellung.

- [ ] Legacy-Dateien mit klarem Import-/Backup-Banner versehen oder in `src/shared/db/legacy-import/` verschieben.
- [ ] `usePersistedDb` aus normalen Runtime-Imports entfernen.
- [ ] `composeLegacyDbFromV2Documents` in Legacy-/Migrationstest-Kontext isolieren.
- [ ] `V2_COLLECTIONS.characters` nur noch in Migration/Projection/Test erlauben.
- [ ] `src/shared/db/v2/normalizers.js` nach Entity-Typ schneiden, falls es sonst weiter ueber 700 Zeilen bleibt.
- [ ] Docs aktualisieren:
  - [ ] `data-and-persistence.md`
  - [ ] `architecture.md`
  - [ ] `migration-backlog.md`
  - [ ] `known-risks.md`
  - [ ] `v2-default-readiness.md`

Tests:

- [ ] Static Guard verbietet Runtime-Importe von Legacy-Hooks/Projection.
- [ ] Migrationstests beweisen weiter, dass alte Daten importierbar bleiben.

Akzeptanz:

- [ ] Ein neuer Entwickler kann klar erkennen: Runtime ist V2/Actor/Effect, Legacy ist nur Import/Backup.

## Abschlusskriterien Der Roadmap

- [ ] V2-only Runtime ohne normalen `legacyProjection`-Vertrag.
- [ ] Campaign XP Threshold synchronisiert Campaign und PC-Actors atomar.
- [ ] Inventory/Loot/Combat nutzen zentrale Item-Identity.
- [ ] `createDataActions.js` ist modularisiert.
- [ ] Catalog Detail und Item Row sind wiederverwendbare Shared-Bausteine.
- [ ] Kritische Spielabend-Flows haben Browser-Smoke-Abdeckung.
- [ ] Legacy-Code ist isoliert und durch Static Guards vom Runtime-Pfad getrennt.
- [ ] `npm run check` und `git diff --check` sind gruen.
