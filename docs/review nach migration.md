# Code Review: PF2-Playersheet — Vollbericht

**Datum:** 2026-06-27  
**Branch:** main  
**Fokus:** V2-Migrationsstatus · Monster-Files · Code-Duplikationen · Systemstabilität

---

## 1. V2-Migration: Verbleibende Schritte

**Status:** V2 ist aktiver Runtime-Standard, aber ca. 8 offene Punkte blockieren den sauberen Abschluss.

| Priorität | Task | Betroffene Datei(en) |
|-----------|------|----------------------|
| 🔴 HOCH | 11 manuelle Smoke-Tests vor Deployment | `docs/agent/v2-default-readiness.md` |
| 🔴 HOCH | Legacy `characters`-Collection isolieren (Import-only) | `src/shared/db/v2/normalizers.js`, `src/shared/db/domain/campaignReducers.js` |
| 🟡 MITTEL | Shop auf V2-Selektoren umstellen (nutzt noch `legacyProjection`) | `src/player/views/InventoryView.jsx`, `src/admin/ItemsView.jsx` |
| 🟡 MITTEL | `createDataActions.js` Domain-Split (derzeit aufgeschoben) | `src/shared/db/domain/createDataActions.js` |
| 🟡 MITTEL | UI-lokale Item-Matcher auf `itemIdentity.js` migrieren | `src/shared/utils/itemIdentity.js` |
| 🟢 NIEDRIG | NPC Actors in Encounters vollständig migrieren | Encounter-Module |
| 🟢 NIEDRIG | Shared `ItemRow` extrahieren (Inventory, Shop, Loot, GM) | Verteilte View-Dateien |
| 🟢 NIEDRIG | Browser-`alert`/`confirm`/`prompt` durch Modals ersetzen | Projektweite Verbreitung |

### Strukturelle Anmerkungen

- `mode = "legacy"` ist noch Default-Parameter in `src/shared/db/domain/createDataActions.js` (Z. 162) — historisch korrekt für Legacy-Tests, aber irreführend für neue Entwickler
- `src/todo.md` ist leer — alle offenen Punkte sind nur in `docs/agent/` dokumentiert, nicht im Sourcecode. Erhöhtes Risiko, dass aufgeschobene Aufgaben verloren gehen
- `src/App.jsx` gibt noch `legacyProjection` als `importDb` weiter; Cleanup steht aus, sobald alle Screens auf native V2-Selektoren umgestellt sind

### Dateien mit noch aktiven Legacy-Strukturen

| Datei | Art der Legacy-Nutzung |
|-------|----------------------|
| `src/shared/db/usePersistedDb.js` | Vollständige Legacy-Implementierung (nur noch Import/Backup) |
| `src/shared/db/domain/createDataActions.js` | `updateDbLegacy`, `updateCampaignLegacy`, `updateCharacterLegacy`, `updateActorLegacy` — einziger erlaubter breiter Write-Pfad |
| `src/shared/db/v2/normalizers.js` | `composeLegacyDbFromV2Documents`, `actorToLegacyCharacter`, `selectLegacyCampaignTarget` für Import/Tests |
| `src/shared/db/v2/useFirestoreV2Db.js` | Hält `legacyProjection` und `updateLegacyProjection` als transitionale Brücke |
| `src/shared/context/CampaignContext.jsx` | Empfängt noch `importDb` (legacyProjection) als Prop, pflegt `legacyUserInfo`-Fallback |
| `src/utils/rules.js` (Z. 88–89) | Liest noch `character["conditions"]` als Legacy-Fallback |

---

## 2. Monster-Files — Dringender Refactoring-Bedarf

### Übersicht nach Zeilenzahl

| Datei | Zeilen | Kern-Problem |
|-------|--------|--------------|
| `src/shared/db/domain/createDataActions.js` | **1819** | God-Object: alle Domänen + Legacy/V2-Bifurkation in einer Datei |
| `src/admin/ProgressAdminView.jsx` | 939 | UI-Atoms + Domain-Sektionen + Sub-Tab-Routing vermischt |
| `src/shared/db/v2/normalizers.js` | 780 | Monolithisch: alle Entities ohne Aufteilung nach Entity-Typ |
| `src/player/components/CompanionTab.jsx` | 775 | 4 logische Einheiten in einer Datei |
| `src/shared/components/SimpleModals.jsx` | 768 | Viele nicht verwandte Modals zusammengefasst |
| `src/player/hooks/usePlayerInventoryActions.js` | 584 | Tap-Logik + Mutagen + Shield-Fetch + Trade + Formel-Kauf — alles ein Hook |
| `src/player/PlayerAppController.jsx` | 546 | Inline-CSS + Scroll-Regex-Parsing + Hook-Koordination + 12 Views |

### Detailanalyse

#### `createDataActions.js` (1819 Zeilen) — Dringendster Fall

Mega-Factory-Objekt, das **alle** Datenoperationen des Systems vereint: Actors, Effects, Loot, Encounter, Quests, Maps, Progress, Camping, GlobalContent — plus die gesamte Abstraktion zwischen Legacy und Firestore-V2. Die `useFirestoreV2 ? ... : ...`-Bifurkation verdoppelt dabei faktisch jeden Funktionskörper. Jede neue Feature-Domäne wächst die Datei weiter.

**Empfehlung:** Eine Domänen-Factory pro Bereich (`createActorActions`, `createLootActions`, `createEncounterActions`, etc.) hinter einem einheitlichen Repository-Interface.

#### `ProgressAdminView.jsx` (939 Zeilen)

Enthält eine eigene Mini-UI-Bibliothek (`SectionHeader`, `Field`, `Input`, `Textarea`, `Card`, `Toggle`, `DeleteBtn`, `ArchivedEntries` — alle lokal definiert), Domain-spezifische Sub-Components (`ReputationAdmin`, `CalciferAdmin`, `MaterialsAdmin`) und Router-Logik für Sub-Tabs.

**Empfehlung:** Lokale UI-Atome in `src/shared/components/ui/` verschieben; Domain-Sektionen in separate Dateien (`ReputationAdmin.jsx`, etc.) auslagern.

#### `CompanionTab.jsx` (775 Zeilen)

Vermischt: Sub-UI-Atome (`TraitPill`, `ActionCost`, `AttackRow`, `AbilityRow`, `FamiliarAbilityPill`), ein vollständiges `CompanionEditPanel` mit eigenem Formular-State, Domain-Logik zur Umwandlung (`actorToCompanionForm`/`companionFormToActorInput`), Condition-Management und das eigentliche View-Rendering. Mindestens 4 logische Einheiten in einer Datei.

**Empfehlung:** `CompanionEditPanel` in eigene Datei; `actorToCompanionForm`/`companionFormToActorInput` in `src/shared/utils/companionUtils.js`.

#### `usePlayerInventoryActions.js` (584 Zeilen)

Kombiniert Tap/Double-Tap/LongPress-Interaktionslogik, Item-Consume-Logik inkl. spielspezifischer Mutagen-Sonderbehandlung, Shield-Fetch per API, Inventory-Toggle-Logik mit Rüstungsexklusivität, Kaufe-aus-Katalog-Flow, Formel-Kauf und Waffen-Laden.

**Empfehlung:** Aufteilen in `useItemPressEvents` (Input-Logik), `useItemConsume` (Mutagen/Consume), `useEquipToggle` (Shield/Armor-Logik).

#### `PlayerAppController.jsx` (546 Zeilen)

Enthält `<style>` mit ~70 Zeilen hardcoded CSS im JSX, Scroll/Wand-Regex-Parsing direkt im Render-Callback und koordiniert 5 verschiedene Hooks plus 12 View-Komponenten.

**Empfehlung:** Inline-`<style>` in separate CSS-Datei; Scroll/Wand-Regex in Utility-Funktion auslagern.

---

## 3. Code-Duplikationen — Reusable-Kandidaten

| Prio | Duplikation | Betroffene Dateien | Risiko |
|------|-------------|-------------------|--------|
| 🔴 1 | `cloneValue`/`deepClone` — **4 Implementierungen** | `characterShape.js`, `inventoryReducers.js`, `normalizers.js`, `deepClone.js` | `characterShape.js` nutzt nie `structuredClone` — bleibt still fehlerhaft bei nicht-serialisierbaren Werten |
| 🔴 2 | `shouldStack` vs. `shouldStackItem` — fast-identische Logik | `inventoryUtils.js` vs. `inventoryReducers.js:137` | Bug bei neuen Ammo-Typen muss in **beiden** Stellen gefixt werden |
| 🟡 3 | Scroll/Wand-Item-Erstellung — **wortidentisch kopiert** | `PlayerAppController.jsx:524`, `ItemsViewLayout.jsx:591` | Divergenz bei Wand-Initialisierung |
| 🟡 4 | Custom-Item-Flattening (`system.*` → Flachstruktur) | `InventoryView.jsx:63`, `ShopView.jsx:64`, `ItemsView.jsx:113` | ShopView/ItemsView fehlen Felder (`description`, `range`, `damage`) |
| 🟢 5 | Roher `localStorage`-Zugriff (umgeht `useLocalStorageJson`) | `XpOverlay.jsx`, `ItemsView.jsx:81` | Kein Cross-Tab-Sync, kein Fehlerumgang |

### Duplikations-Details

#### `cloneValue`/`deepClone` (4 Implementierungen)

```
src/shared/utils/deepClone.js                      → zentral via structuredClone
src/shared/db/domain/inventoryReducers.js:5-11     → eigene cloneValue()-Kopie (identisch)
src/shared/db/domain/characterShape.js:1-5         → weitere cloneValue()-Kopie (nie structuredClone)
src/shared/db/v2/normalizers.js:836-839            → cloneJson() via JSON.parse/stringify
```

**Lösung:** Alle auf `import { deepClone } from '../../shared/utils/deepClone.js'` umstellen.

#### `shouldStack` vs. `shouldStackItem`

`shouldStack` (in `inventoryUtils.js`) kennt den `shopIndex` und prüft Traits über Index-Daten. `shouldStackItem` (in `inventoryReducers.js`) ist eine private Kopie ohne `shopIndex`. Beide implementieren dieselbe Kernlogik (Bombs, Ammunition, Consumables).

**Lösung:** `shouldStackItem` entfernen, `shouldStack` aus `inventoryUtils.js` importieren.

#### Scroll/Wand-Item-Erstellung

Der Block `newItem.system = deepClone(...)`, `newItem.system.originalName`, `newItem.name = "Scroll/Wand of ..."`, `newItem.system.spell = spell`, `newItem.system.wand = {charges:1, max:1}` ist wortidentisch in `PlayerAppController.jsx:524` und `ItemsViewLayout.jsx:591` kopiert.

**Lösung:** `buildScrollOrWandItem(baseItem, spell, type, rank)` in `src/shared/utils/wandUtils.js` extrahieren.

#### Custom-Item-Flattening

`InventoryView.jsx` hat die vollständigste Version; `ShopView.jsx` und `ItemsView.jsx` fehlen Felder wie `description`, `range`, `damage`. Führt zu inkonsistenter Item-Darstellung je nach Kontext.

**Lösung:** `flattenCustomItem(customItem)` in `src/shared/utils/inventoryUtils.js` extrahieren.

---

## 4. Systemstabilität — Kritische Risiken

### 🔴 Risiko 1: Datenverlust bei Firebase-Schreibfehlern

**Datei:** `src/shared/db/usePersistedDb.js`

Schlägt `setDoc` fehl, gibt es nur ein `console.error`. Der lokale State ist bereits überschrieben — der nächste Remote-Snapshot überschreibt die lokale Änderung ohne Nutzer-Benachrichtigung. In Multi-Player-Sessions datenverlustbehaftet. Kein Retry, kein UI-Feedback, keine Fehler-Differenzierung.

### 🔴 Risiko 2: Runtime-Crash bei Legacy-Charakteren

**Datei:** `src/player/PlayerAppController.jsx` (Z. 266, 289)

`character.xp.current` und `parseFloat(character.gold)` werden ohne optionales Chaining verwendet. Charaktere, die den V2-Normalisierungspfad noch nicht durchlaufen haben, triggern einen `TypeError` der den gesamten Player-Screen unbrauchbar macht.

```js
// Gefährlich:
character.xp.current
parseFloat(character.gold).toFixed(2)

// Sollte sein:
character.xp?.current ?? 0
parseFloat(character.gold ?? 0).toFixed(2)
```

### 🔴 Risiko 3: Kein einziger Test für `actorReducers.js`

**Datei:** `src/shared/db/domain/actorReducers.js`

`createActorRecord`, `applyActorUpdate`, `createActorEffectRecord`, `createCatalogOverrideRecord` sind kritische Bausteine für das V2-System (Conditions, Encounter-Combatants, Companions) — ohne einen einzigen Test. Regressionen korrumpieren Session-State ohne sofortige Sichtbarkeit.

### 🟡 Risiko 4: Conditions erreichen `DefensesSection` nicht

**Datei:** `src/player/views/DefensesSection.jsx`

`DefensesSection` ruft `useCharacterStats(character)` auf, aber der `character` dort hat kein `character.conditions` aus actorEffects befüllt. Aktive Conditions (z.B. Frightened → -AC) werden in Saves/AC-Berechnungen innerhalb `DefensesSection` möglicherweise ignoriert. Der korrekte Conditions-Pfad läuft über Prop-Injection in `PlayerAppController` → `StatsView`, nicht über `DefensesSection` direkt.

**Entscheidung nötig:** Prop-Injection erweitern oder `useCharacterStats` Context-aware machen (siehe Abschnitt 5).

### 🟡 Risiko 5: Mutagen-Hybridmodell — stille Diskrepanz

**Dateien:** `src/utils/rules.js`, `src/utils/rules/mutagens.js`

Mutagene werden als `actorEffect`-Einträge in Firestore gespeichert (für Anzeige/Tracking), aber die Stat-Berechnung in `rules.js` ignoriert deren gespeicherte Modifier-Felder und liest stattdessen `getMutagenEffects(character.currentMutagen)` aus einer hardcodierten Lookup-Tabelle. Wenn ein actorEffect andere Werte hat als die Tabelle → stille Diskrepanz ohne Fehler.

Zusätzlich: bekannter AC-Stacking-Bug (`useCharacterStats.js:92-98`): Item-AC durch Mutagen kann mit Rüstungs-Item-Bonus stacken, obwohl PF2e-Regeln "maximum of the two" vorschreiben.

### 🟡 Weitere Risiken

- **`applyRewards` in `questReducers.js`:** `rewards.items` wird nie verarbeitet. Quest-Item-Belohnungen landen beim Einlösen einfach nirgends — toter Code-Pfad.
- **XP-Maximum `xp.max: 1000`** ist hardcodiert statt kampagnenspezifisch konfigurierbar (z.B. 1200 für aktuelle Kampagne)
- **Gold-Split:** `Math.floor(total / players)` — Rest-Copper geht verloren statt dokumentiert oder zugeteilt zu werden
- **Fehlerbehandlung in `runDataAction`:** Alle Inventory-, Quest-, Loot- und Transfer-Aktionen landen bei `alert()`. Kein Retry, kein differenziertes UI-Feedback
- **V2 Firestore-Subscription:** Snapshot-Fehler in `useFirestoreV2Db.js` werden nur geloggt, nicht dem Nutzer angezeigt
- **Quest-Hilfsfunktionen ohne Tests:** `revealQuestSecretInCampaign` (String-Parsing mit `||secret||`-Syntax) ist regressionsanfällig ohne Testabdeckung
- **78+ `console.log`-Statements** ohne `import.meta.env.DEV`-Guard landen in Produktion

---

## 5. Offene Entscheidungen

### Entscheidung A: DefensesSection — Conditions-Datenpfad

**Problem:** `DefensesSection.jsx` ruft `useCharacterStats(character)` auf, ohne aktive Conditions einzuspeisen. AC/Save-Berechnungen dort ignorieren Frightened, Clumsy etc.

**Option 1: Prop-Injection erweitern**
`PlayerAppController` gibt `conditions={characterConditions}` bereits an `StatsView` weiter. `DefensesSection` bekommt denselben Prop.
- Pro: Konsistent mit bestehendem Muster; `useCharacterStats` bleibt ein reiner Funktor
- Contra: Mehr Props, potenzielle Prop-Drilling-Kette

**Option 2: `useCharacterStats` Context-aware machen**
Hook liest `conditions` direkt aus `CampaignContext` via `selectConditionViewModels`.
- Pro: Keine Prop-Änderungen; Hook ist autark
- Contra: Hook greift auf globalen Context zu → schwieriger zu testen und wiederzuverwenden

---

### Entscheidung B: Mutagen-Hybridmodell konsolidieren

**Option 1: Mutagene vollständig auf actorEffects umstellen**
`getMutagenEffects()` entfernen. Mutagen-actorEffects speichern ihre Modifier wie andere actorEffects. `getConditionEffects()` iteriert alle gleichartig. AC-Stacking-Fix ist natürlicher Teil der Änderung.
- Pro: Ein einheitliches System; zukünftige Mutagene brauchen keine Codeänderung
- Contra: Bestehende Mutagen-actorEffects in Firestore müssen migriert werden

**Option 2: Hybridmodell beibehalten, AC-Bug fixen**
`getMutagenEffects()` bleibt. Nur `useCharacterStats.js:92-98` korrigieren (`Math.max` statt Addition).
- Pro: Minimaler Eingriff; keine Datenmigration
- Contra: Zwei parallele Effekt-Systeme bleiben bestehen

---

## 6. Empfohlene Reihenfolge

```
SOFORT (Bugs die User treffen)
  1. character.xp?.current und character.gold?? absichern
     → PlayerAppController.jsx:266, 289

  2. deepClone-Duplikationen konsolidieren
     → characterShape.js, normalizers.js auf deepClone.js umstellen

SPRINT (Stabilität & Testabdeckung)
  3. actorReducers.js Tests schreiben
  4. Firebase-Schreibfehler mit User-Feedback absichern
     → usePersistedDb.js
  5. shouldStackItem entfernen → shouldStack aus inventoryUtils verwenden
  6. buildScrollOrWandItem extrahieren
     → PlayerAppController.jsx:524 + ItemsViewLayout.jsx:591
  7. rewards.items in applyRewards implementieren
     → questReducers.js

MILESTONE (Architektur)
  8. createDataActions.js in Domänen-Factories aufteilen
  9. usePlayerInventoryActions.js in 3 Hooks aufteilen
 10. Shop auf V2-Selektoren umstellen (legacyProjection entfernen)
 11. Legacy characters-Collection isolieren (Import-only)
 12. Entscheidung A + B umsetzen (DefensesSection Conditions / Mutagen)
```

---

## 7. Technische Schulden (kein Sofort-Handlungsbedarf)

| Schuld | Dateien | Empfehlung |
|--------|---------|------------|
| 97 Browser-`alert`/`confirm`/`prompt` | `FirebaseMigrator.jsx` (9×), `usePlayerInventoryActions.js` (8×), `ProgressAdminView.jsx` (7×) | Beim nächsten Anfassen durch shadcn/ui Dialog ersetzen |
| Inline-Styles vs. Tailwind-Mischung | `SimpleModals.jsx`, ältere Komponenten | Beim Anfassen auf Tailwind migrieren |
| `async/await` vs. `.then()/.catch()` gemischt | Projektweite Verbreitung | Neue Schreibweise = `async/await` |
| Kein ESLint/Biome-Skript | `package.json` | `npm run lint` als `npm run check`-Schritt ergänzen |
| `?db=v2` Query-Parameter-Weiche | `App.jsx` | Toter Code — entfernen |
| Item-Identität inkonsistent (name / _index / instanceId / addedAt) | Inventory, Loot, Transfer-Flows | Einheitliche Primärschlüssel-Konvention definieren und durchsetzen |
