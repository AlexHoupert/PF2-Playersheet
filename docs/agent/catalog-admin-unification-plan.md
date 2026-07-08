# Catalog Admin Unification Plan

Status: in progress
Owner: Codex / project maintainers
Scope: Admin data tables for static and DB-backed catalog content
Last updated: 2026-07-08

## Ziel

Alle datenfuehrenden Admin-Tabellen sollen dieselbe Interaktionslogik verwenden:

- `Edit` aendert den bestehenden effektiven Eintrag.
- `Clone` erzeugt eine neue Custom-Kopie.
- `Delete` entfernt den Eintrag aus der sichtbaren Standardliste.
- `Copy Reference` erzeugt eine stabile Referenz fuer Info-Modals und andere Kontexte.
- Aenderungen aktualisieren Tabellen sofort, ohne Page Reload und ohne Verlust von Suche, Filter, Sortierung oder Auswahl.

Statische JSON-Daten bleiben read-only. Runtime-Aenderungen laufen ueber Firestore `catalogOverrides`:

- Static edit: `mode: "override"`
- Static delete: `mode: "hide"`
- New/clone custom: `mode: "custom"`
- Custom delete: Override-Dokument entfernen

## Arbeitsstand

- [x] Plan-Datei angelegt.
- [x] Phase 1: Catalog-Vertrag und Statusmodell bauen.
- [x] Phase 2: Gemeinsamen Catalog-Controller und UI-Kontrakt einfuehren.
- [x] Phase 3: Editor-Save-Vertrag vereinheitlichen.
- [x] Phase 4: Tabellen schrittweise migrieren.
- [x] Phase 5: Copy-Reference-System erweitern.
- [x] Phase 6: Tests, Guards und Smokes ergaenzen.
- [x] Phase 7: Doku und Backlog bereinigen.

## Ausgangslage

### Items

Aktuell:

- Quelle: `SHOP_INDEX_ITEMS` plus `shop.customItems`.
- Save-Pfad: `globalContent.saveCustomItem`.
- Production-Save im `ItemEditor` erzeugt immer ein `isCustom`-Item.
- Folge: `Edit` eines statischen Items erzeugt faktisch eine Kopie.
- Refresh ist nicht konsistent; neue/geaenderte Eintraege erscheinen teils erst nach Reload.

Ziel:

- Items lesen static index plus `catalogOverrides`.
- `Edit` auf static item speichert `mode: "override"`.
- `Clone` speichert `mode: "custom"`.
- `Delete` auf static item speichert `mode: "hide"`.
- Trader, Shop, Give-to-Player und Loot nutzen denselben effektiven Catalog-Eintrag.

### Spells

Aktuell:

- Quelle: `SPELL_INDEX_ITEMS` plus `catalogOverrides`.
- Static edit speichert bereits `mode: "override"`.
- Tabellenrefresh funktioniert weitgehend sofort.
- Es fehlen einheitliche Aktionen: `Clone`, `Delete`, `Copy Reference`, Statusfilter.
- Es existieren noch Dev-/File-API-Pfade und Reload-Fallbacks.

Ziel:

- Spells dienen als Referenzimplementierung fuer alle Catalog-Tabellen.
- Kein Production-Save benoetigt `/api/files/*`.
- Kein erfolgreicher DB-Save triggert `window.location.reload()`.

### Actions

Aktuell:

- Quelle: static action index plus `catalogOverrides` plus altes `db.actions`.
- Kontextmenue verwendet unklare Aktion `Clone/Override`.
- Delete alter/static Actions laeuft teilweise ueber File-API oder loescht nur Override.

Ziel:

- Explizite Aktionen: `Edit`, `Clone`, `Delete`, `Copy Reference`.
- Alte `db.actions` werden nur noch in einem Compatibility-Selector gelesen.
- Neue Writes laufen ausschliesslich ueber `catalogOverrides`.

### Feats

Aktuell:

- Quelle: `FEAT_INDEX_ITEMS` plus `catalogOverrides`.
- `Edit` und `Clone` existieren.
- `Delete`, `Copy Reference` und Statusfilter fehlen.

Ziel:

- Gleicher Tabellen-/Editor-Vertrag wie Spells.

### Impulses

Aktuell:

- Quelle: `IMPULSE_INDEX_ITEMS` plus `catalogOverrides`.
- `Edit` existiert.
- `Clone`, `Delete`, `Copy Reference` und Statusfilter fehlen.

Ziel:

- Gleicher Tabellen-/Editor-Vertrag wie Spells.

### Abilities

Aktuell:

- Quelle: statischer Ability-Index plus `abilities.custom`.
- Edit/Delete ist nur fuer Custom-Abilities sichtbar.
- Save laeuft ueber `globalContent.saveCustomAbility`, intern in V2 bereits als custom catalog override.

Ziel:

- Static Abilities koennen per `override/hide` angepasst werden.
- Custom-Abilities bleiben `mode: "custom"`.
- Give-to-Creature bleibt erhalten, nutzt aber den effektiven Catalog-Eintrag.

### Creatures / Bestiary

Aktuell:

- Quelle: statischer Creature-Index plus `customCreatures` und Bestiary-Metadata.
- Static edit in Production ist blockiert.
- Clone erzeugt Custom Creature.
- Delete loescht Custom Creature oder Metadata, aber versteckt statische Eintraege nicht einheitlich.

Ziel:

- Creature stat blocks werden ueber `catalogOverrides` editierbar.
- Bestiary-Metadata bleibt getrennt:
  - reveal state
  - group
  - bestiary/published state
  - false data
- Static creature delete speichert `mode: "hide"`.
- Custom creature delete entfernt den Custom Override und zugehoerige Metadata.

## Phase 1: Catalog-Vertrag Und Statusmodell

Ziel: Eine zentrale, getestete Interpretation von static entries plus overrides.

Arbeitsschritte:

- [x] Neue Datei anlegen: `src/shared/catalog/catalogEntryModel.js`.
- [x] Stable-key Helper implementieren:
  - [x] `getCatalogEntryKey(entry, catalogType)`
  - [x] Prioritaet: `sourceFile`, `overrideSourceFile`, `id`, `_id`, normalisierter Name.
  - [x] Keine neue Tabelle darf lokal nur per Name matchen, wenn stabilere Keys existieren.
- [x] Statusmodell implementieren:
  - [x] `original`
  - [x] `edited`
  - [x] `custom`
  - [x] `deleted`
- [x] Builder implementieren:
  - [x] `buildEditOverride(catalogType, baseEntry, payload)`
  - [x] `buildCloneOverride(catalogType, sourceEntry, payload)`
  - [x] `buildHideOverride(catalogType, baseEntry)`
- [x] Selector erweitern oder neu bauen:
  - [x] `selectCatalogEntryStates({ staticItems, db, catalogType })`
  - [x] `selectVisibleCatalogEntries(...)`
  - [x] `selectDeletedCatalogEntries(...)`
- [x] Bestehendes `mergeCatalogIndexWithOverrides` als Compatibility-Wrapper erhalten.

Erfolgskriterien:

- [x] Static Override ersetzt genau einen passenden Originaleintrag.
- [x] Hide Override entfernt den Eintrag aus der Default-Liste.
- [x] Deleted-Filter kann den versteckten Originaleintrag anzeigen.
- [x] Custom-Eintraege werden nie mit statischen Eintraegen verschmolzen, ausser sie referenzieren bewusst ein `baseId`.
- [x] Tests decken gleiche Namen mit unterschiedlichen `sourceFile`s ab.

## Phase 2: Gemeinsamer Catalog-Controller Und UI-Kontrakt

Ziel: Tabellenverhalten wird zentral statt pro View neu implementiert.

Arbeitsschritte:

- [x] Neuen Hook anlegen: `src/admin/catalog/useCatalogAdminTable.js`.
- [x] Hook-State standardisieren:
  - [x] search
  - [x] filters
  - [x] sort
  - [x] page
  - [x] selected row(s)
  - [x] preview item
  - [x] editing item
  - [x] context menu
- [x] Standardaktionen bereitstellen:
  - [x] `editEntry(entry)`
  - [x] `cloneEntry(entry)`
  - [x] `deleteEntry(entry)`
  - [x] `copyEntryReference(entry)`
  - [x] `previewEntry(entry)`
- [x] Statusfilter standardisieren:
  - [x] Show original
  - [x] Show edited
  - [x] Show custom
  - [x] Show deleted
- [x] Standard-Kontextmenue definieren:
  - [x] `Edit`
  - [x] `Clone`
  - [x] `Delete`
  - [x] `Copy Reference`
  - [x] optional `Preview`
- [x] Nach Save/Deletion Kontext erhalten:
  - [x] Suche bleibt erhalten.
  - [x] Filter bleiben erhalten.
  - [x] Sortierung bleibt erhalten.
  - [x] Seite bleibt erhalten, sofern noch gueltig.
  - [x] Geaenderter Eintrag wird wieder selektiert, sofern sichtbar.

Erfolgskriterien:

- [x] Kein Catalog-View hat eigene widerspruechliche Labels wie `Clone/Override`.
- [x] Erfolgreicher DB-Save fuehrt nicht zu `window.location.reload()`.
- [x] Der Catalog-Controller stellt dieselbe Statusfilter-Semantik zentral bereit; Tabellen-Cutover folgt in Phase 4.

## Phase 3: Editor-Save-Vertrag Vereinheitlichen

Ziel: Editoren erzeugen nicht mehr eigenmaechtig Custom-Kopien, wenn der Nutzer `Edit` gewaehlt hat.

Arbeitsschritte:

- [x] Einheitliche Editor-Props einfuehren:
  - [x] `catalogType`
  - [x] `editorMode: "create" | "edit" | "clone"`
  - [x] `baseEntry`
  - [x] `initialPayload`
  - [x] `onSaveCatalogEntry`
- [x] Bestehende Editor-Builder auf zentrale Builder umstellen:
  - [x] ItemEditor
  - [x] SpellEditor
  - [x] ActionEditor
  - [x] FeatEditor
  - [x] ImpulseEditor
  - [x] CreatureEditor
  - [x] Ability editor/modal
- [x] Save-Regeln erzwingen:
  - [x] `edit` + static source => `mode: "override"`
  - [x] `edit` + custom source => `mode: "custom"` update
  - [x] `clone` => `mode: "custom"` mit neuer ID
  - [x] `create` => `mode: "custom"`
- [x] Production-Pfade bereinigen:
  - [x] `/api/files/save` nur noch hinter explizitem Local-Dev-Pfad.
  - [x] Production zeigt keine File-API-Fehler fuer editierbare Catalog-Eintraege, wenn die View `onSaveCatalogEntry` verdrahtet hat.

Erfolgskriterien:

- [x] Item `Edit` kann ueber den Editor-Contract als Override speichern; vollstaendige Tabellen-Deduplizierung folgt in Phase 4.5.
- [x] Creature `Edit` funktioniert in Production als DB Override.
- [x] Spell-Verhalten bleibt unveraendert gut.
- [x] Action `Edit` und `Clone` sind in der Tabellen-UI eindeutig getrennt.

## Phase 4: Tabellen Migration

Ziel: Alle datenfuehrenden Catalog-Tabellen nutzen den gemeinsamen Contract.

### 4.1 Spells Als Referenz Fertigstellen

- [x] Gemeinsamen Hook/Statusfilter verwenden.
- [x] `Clone` ergaenzen.
- [x] `Delete` als hide/custom-delete ergaenzen.
- [x] `Copy Reference` ergaenzen.
- [x] Reload-Fallback nach DB-Save entfernen.

Erfolgskriterien:

- [x] Editierter Spell ist sofort sichtbar.
- [x] Clone erzeugt zweite Custom-Zeile.
- [x] Delete versteckt static spell und Deleted-Filter zeigt ihn.

### 4.2 Actions

- [x] Altes `db.actions` in Compatibility-Selector kapseln.
- [x] `Clone/Override` Label entfernen.
- [x] Edit/Clone/Delete/Copy Reference standardisieren.
- [x] Static Delete als `hide` umsetzen.
- [x] File-Delete fuer Production entfernen.

Erfolgskriterien:

- [x] Nutzer kann klar erkennen, ob er editiert oder klont.
- [x] Static action delete erzeugt keinen File-API-Fehler.

### 4.3 Feats

- [x] Gemeinsamen Hook/Statusfilter verwenden.
- [x] Delete ergaenzen.
- [x] Copy Reference ergaenzen.
- [x] Reload-Fallback nach DB-Save entfernen.

Erfolgskriterien:

- [x] Feat edit/clone/delete verhaelt sich wie Spell edit/clone/delete.

### 4.4 Impulses

- [x] Gemeinsamen Hook/Statusfilter verwenden.
- [x] Clone ergaenzen.
- [x] Delete ergaenzen.
- [x] Copy Reference ergaenzen.
- [x] Reload-Fallback nach DB-Save entfernen.

Erfolgskriterien:

- [x] Impulse-Tabelle hat dieselbe Aktionstiefe wie Spell/Feat.

### 4.5 Items

- [x] Items von `shop.customItems + SHOP_INDEX_ITEMS` auf Catalog-Entry-Selector umstellen.
- [x] `ItemEditor` Save-Logik fuer static edit auf `override` umstellen.
- [x] `Clone` bleibt Custom-Kopie, aber explizit.
- [x] `Delete` fuer Static als `hide` implementieren.
- [x] Trader/Shop/Give/Loot verwenden effektive Catalog-Eintraege.
- [x] Nach Save kein Reload und keine Kontextverluste.

Erfolgskriterien:

- [x] Edit bestehender static items erzeugt keine Kopie.
- [x] Geaenderte Item-Werte sind sofort sichtbar.
- [x] Custom Item kann weiterhin Spielern gegeben werden.

### 4.6 Creatures / Bestiary

- [x] Creature-Statblock-Edit auf `catalogOverrides` umstellen.
- [x] Clone erzeugt `mode: "custom"`.
- [x] Delete static creature erzeugt `mode: "hide"`.
- [x] Delete custom creature entfernt Custom Override und zugehoerige Metadata.
- [x] Reveal/Group/Bestiary-State bleibt in Bestiary-Metadata.
- [x] Player-Bestiary respektiert weiterhin Reveal-State.

Erfolgskriterien:

- [x] Static creature edit funktioniert in Production.
- [x] Deleted creature verschwindet aus Default-Liste.
- [x] Reveal/Group wird durch Content-Edit nicht ueberschrieben.

### 4.7 Abilities

- [x] Ability-Liste auf Catalog-Entry-Statusmodell umstellen.
- [x] Static Ability edit als `override` erlauben.
- [x] Custom Ability edit bleibt `custom`.
- [x] Delete static ability als `hide`.
- [x] Give-to-Creature nutzt effektive Ability.
- [x] Copy Reference bleibt erhalten.

Erfolgskriterien:

- [x] Ability-Aktionen folgen denselben Labels und Regeln wie andere Tabellen.
- [x] Custom-Abilities bleiben rueckwaertskompatibel lesbar.

## Phase 5: Copy Reference Vereinheitlichen

Ziel: Jede Catalog-Tabelle erzeugt stabile Referenzen, die in anderen Kontexten aufloesbar sind.

Arbeitsschritte:

- [x] `refClipboard` auf generische Catalog-Refs erweitern.
- [x] Neuer Ref-Shape:

```js
{
  refType: "catalog",
  catalogType,
  id,
  baseId,
  sourceFile,
  label
}
```

- [x] Resolver ergaenzen:
  - [x] `resolveCatalogReference(ref, catalogStore)`
  - [x] Fallback: sourceFile/baseId/id/name in dieser Reihenfolge.
- [x] Copy Reference in allen Tabellen gleich anzeigen.
- [x] Info-Modals nutzen Resolver statt eingebettete Vollkopien, wenn moeglich.

Erfolgskriterien:

- [x] Referenz auf edited static entry oeffnet den effektiven Override.
- [x] Referenz auf deleted entry zeigt sinnvolle Meldung oder Deleted-Status.
- [x] Referenz auf custom entry ueberlebt Reload.

## Phase 6: Tests, Guards Und Smokes

Ziel: Die neue Semantik bleibt stabil.

Arbeitsschritte:

- [x] Unit-Tests fuer Catalog-Selectoren:
  - [x] original
  - [x] edited
  - [x] custom
  - [x] deleted
  - [x] duplicate names with different sourceFiles
- [x] Unit-Tests fuer Override-Builder:
  - [x] shared editor contract
  - [x] item
  - [x] spell
  - [x] action
  - [x] feat
  - [x] impulse
  - [x] ability
  - [x] creature
- [x] Static Guards:
  - [x] Kein `Clone/Override` Label in Runtime-UI.
  - [x] Kein Production-Save auf `/api/files/save`.
  - [x] Kein `window.location.reload()` nach erfolgreichem DB-Catalog-Save.
  - [x] Keine lokalen static+custom Merge-Regeln ausserhalb zentraler Catalog-Selectoren.
- [x] Smoke-/Regression-Tests:
  - [x] Spell edit immediate refresh.
  - [x] Item edit no duplicate.
  - [x] Item clone creates custom copy.
  - [x] Creature static edit works in production-like mode.
  - [x] Action delete hides static action.
  - [x] Deleted filter shows hidden original.
  - [x] Copy Reference action and resolver coverage.

Erfolgskriterien:

- [x] `npm run check` ist gruen.
- [x] `npm run smoke` ist gruen, sofern Smoke-Suite verfuegbar.
- [x] `git diff --check` ist gruen.

## Phase 7: Doku Und Backlog Bereinigen

Ziel: Die Architekturentscheidung ist dauerhaft nachvollziehbar.

Arbeitsschritte:

- [x] `docs/agent/catalog-pipeline.md` aktualisieren.
- [x] `docs/agent/domain-actions.md` um Catalog-Override-High-Level-Actions ergaenzen.
- [x] `docs/agent/migration-backlog.md` aktualisieren:
  - [x] Items Catalog-Migration erledigt.
  - [x] Actions Altpfad erledigt.
  - [x] Creatures Production Edit erledigt.
  - [x] Restliche Fallbacks benennen oder entfernen.
- [x] `docs/agent/smoke-results.md` aktualisieren. Automatisierte Fixture-Smokes sind dokumentiert; deployed Firestore Catalog-Smoke bleibt separat als manuelle Matrix-Zeile markiert.

Erfolgskriterien:

- [x] Neue Entwickler koennen anhand der Doku nachvollziehen, warum static JSON nicht direkt editiert wird.
- [x] Backlog enthaelt keine erledigten Catalog-Altlasten mehr.

## Abschlusskriterien

- [x] Alle Catalog-Tabellen haben dieselben sichtbaren Aktionen: `Edit`, `Clone`, `Delete`, `Copy Reference`.
- [x] Static `Edit` wird ueber `mode: "override"` gespeichert.
- [x] Static `Delete` wird ueber `mode: "hide"` gespeichert.
- [x] Custom `Delete` entfernt das Custom Override.
- [x] Tabellen aktualisieren nach Save/Delete automatisch ohne Reload.
- [x] Suche, Filter, Sortierung und Auswahl bleiben nach Mutation erhalten.
- [x] Statusfilter fuer Original/Editiert/Custom/Geloescht existieren.
- [x] Production-Editoren fuer Items, Spells, Actions, Feats, Impulses, Abilities und Creatures benoetigen keine File-API.
- [x] Copy Reference funktioniert fuer alle Catalog-Typen konsistent.
- [x] Compact row data and fetched catalog details are merged centrally so empty row fields do not hide static descriptions.
- [x] Creature full-data merge follows the same rule while Bestiary metadata remains separate.
- [x] Deviant Abilities remain Pact-domain content but expose explicit Edit, Clone, Delete, and Copy Reference admin actions.

## Nicht-Ziele Dieser Welle

- Keine vollstaendige Versionierung von Catalog-Eintraegen.
- Keine Live-Firestore-Datenmigration ohne separate Freigabe.
- Keine Entfernung alter static JSON-Dateien.
- Keine UI-Komplettneugestaltung der Tabellen.
- Keine Zusammenlegung von Bestiary-Reveal-Metadata mit Creature-Content-Overrides.
