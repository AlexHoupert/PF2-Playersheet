# Catalog Admin Unification Plan

Status: in progress
Owner: Codex / project maintainers
Scope: Admin data tables for static and DB-backed catalog content
Last updated: 2026-07-03

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
- [ ] Phase 4: Tabellen schrittweise migrieren.
- [ ] Phase 5: Copy-Reference-System erweitern.
- [ ] Phase 6: Tests, Guards und Smokes ergaenzen.
- [ ] Phase 7: Doku und Backlog bereinigen.

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

- [ ] Kein Catalog-View hat eigene widerspruechliche Labels wie `Clone/Override`.
- [ ] Erfolgreicher DB-Save fuehrt nicht zu `window.location.reload()`.
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
- [ ] Action `Edit` und `Clone` sind in der Tabellen-UI eindeutig getrennt. Phase 4.2.

## Phase 4: Tabellen Migration

Ziel: Alle datenfuehrenden Catalog-Tabellen nutzen den gemeinsamen Contract.

### 4.1 Spells Als Referenz Fertigstellen

- [ ] Gemeinsamen Hook/Statusfilter verwenden.
- [ ] `Clone` ergaenzen.
- [ ] `Delete` als hide/custom-delete ergaenzen.
- [ ] `Copy Reference` ergaenzen.
- [ ] Reload-Fallback nach DB-Save entfernen.

Erfolgskriterien:

- [ ] Editierter Spell ist sofort sichtbar.
- [ ] Clone erzeugt zweite Custom-Zeile.
- [ ] Delete versteckt static spell und Deleted-Filter zeigt ihn.

### 4.2 Actions

- [ ] Altes `db.actions` in Compatibility-Selector kapseln.
- [ ] `Clone/Override` Label entfernen.
- [ ] Edit/Clone/Delete/Copy Reference standardisieren.
- [ ] Static Delete als `hide` umsetzen.
- [ ] File-Delete fuer Production entfernen.

Erfolgskriterien:

- [ ] Nutzer kann klar erkennen, ob er editiert oder klont.
- [ ] Static action delete erzeugt keinen File-API-Fehler.

### 4.3 Feats

- [ ] Gemeinsamen Hook/Statusfilter verwenden.
- [ ] Delete ergaenzen.
- [ ] Copy Reference ergaenzen.
- [ ] Reload-Fallback nach DB-Save entfernen.

Erfolgskriterien:

- [ ] Feat edit/clone/delete verhaelt sich wie Spell edit/clone/delete.

### 4.4 Impulses

- [ ] Gemeinsamen Hook/Statusfilter verwenden.
- [ ] Clone ergaenzen.
- [ ] Delete ergaenzen.
- [ ] Copy Reference ergaenzen.
- [ ] Reload-Fallback nach DB-Save entfernen.

Erfolgskriterien:

- [ ] Impulse-Tabelle hat dieselbe Aktionstiefe wie Spell/Feat.

### 4.5 Items

- [ ] Items von `shop.customItems + SHOP_INDEX_ITEMS` auf Catalog-Entry-Selector umstellen.
- [ ] `ItemEditor` Save-Logik fuer static edit auf `override` umstellen.
- [ ] `Clone` bleibt Custom-Kopie, aber explizit.
- [ ] `Delete` fuer Static als `hide` implementieren.
- [ ] Trader/Shop/Give/Loot verwenden effektive Catalog-Eintraege.
- [ ] Nach Save kein Reload und keine Kontextverluste.

Erfolgskriterien:

- [ ] Edit bestehender static items erzeugt keine Kopie.
- [ ] Geaenderte Item-Werte sind sofort sichtbar.
- [ ] Custom Item kann weiterhin Spielern gegeben werden.

### 4.6 Creatures / Bestiary

- [ ] Creature-Statblock-Edit auf `catalogOverrides` umstellen.
- [ ] Clone erzeugt `mode: "custom"`.
- [ ] Delete static creature erzeugt `mode: "hide"`.
- [ ] Delete custom creature entfernt Custom Override und zugehoerige Metadata.
- [ ] Reveal/Group/Bestiary-State bleibt in Bestiary-Metadata.
- [ ] Player-Bestiary respektiert weiterhin Reveal-State.

Erfolgskriterien:

- [ ] Static creature edit funktioniert in Production.
- [ ] Deleted creature verschwindet aus Default-Liste.
- [ ] Reveal/Group wird durch Content-Edit nicht ueberschrieben.

### 4.7 Abilities

- [ ] Ability-Liste auf Catalog-Entry-Statusmodell umstellen.
- [ ] Static Ability edit als `override` erlauben.
- [ ] Custom Ability edit bleibt `custom`.
- [ ] Delete static ability als `hide`.
- [ ] Give-to-Creature nutzt effektive Ability.
- [ ] Copy Reference bleibt erhalten.

Erfolgskriterien:

- [ ] Ability-Aktionen folgen denselben Labels und Regeln wie andere Tabellen.
- [ ] Custom-Abilities bleiben rueckwaertskompatibel lesbar.

## Phase 5: Copy Reference Vereinheitlichen

Ziel: Jede Catalog-Tabelle erzeugt stabile Referenzen, die in anderen Kontexten aufloesbar sind.

Arbeitsschritte:

- [ ] `refClipboard` auf generische Catalog-Refs erweitern.
- [ ] Neuer Ref-Shape:

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

- [ ] Resolver ergaenzen:
  - [ ] `resolveCatalogReference(ref, catalogStore)`
  - [ ] Fallback: sourceFile/baseId/id/name in dieser Reihenfolge.
- [ ] Copy Reference in allen Tabellen gleich anzeigen.
- [ ] Info-Modals nutzen Resolver statt eingebettete Vollkopien, wenn moeglich.

Erfolgskriterien:

- [ ] Referenz auf edited static entry oeffnet den effektiven Override.
- [ ] Referenz auf deleted entry zeigt sinnvolle Meldung oder Deleted-Status.
- [ ] Referenz auf custom entry ueberlebt Reload.

## Phase 6: Tests, Guards Und Smokes

Ziel: Die neue Semantik bleibt stabil.

Arbeitsschritte:

- [x] Unit-Tests fuer Catalog-Selectoren:
  - [x] original
  - [x] edited
  - [x] custom
  - [x] deleted
  - [x] duplicate names with different sourceFiles
- [ ] Unit-Tests fuer Override-Builder:
  - [x] shared editor contract
  - [x] item
  - [x] spell
  - [x] action
  - [x] feat
  - [x] impulse
  - [x] ability
  - [x] creature
- [ ] Static Guards:
  - [ ] Kein `Clone/Override` Label in Runtime-UI.
  - [ ] Kein Production-Save auf `/api/files/save`.
  - [ ] Kein `window.location.reload()` nach erfolgreichem DB-Catalog-Save.
  - [ ] Keine lokalen static+custom Merge-Regeln ausserhalb zentraler Catalog-Selectoren.
- [ ] Smoke-Tests:
  - [ ] Spell edit immediate refresh.
  - [ ] Item edit no duplicate.
  - [ ] Item clone creates custom copy.
  - [ ] Creature static edit works in production-like mode.
  - [ ] Action delete hides static action.
  - [ ] Deleted filter shows hidden original.
  - [ ] Copy Reference opens correct info modal.

Erfolgskriterien:

- [ ] `npm run check` ist gruen.
- [ ] `npm run smoke` ist gruen, sofern Smoke-Suite verfuegbar.
- [ ] `git diff --check` ist gruen.

## Phase 7: Doku Und Backlog Bereinigen

Ziel: Die Architekturentscheidung ist dauerhaft nachvollziehbar.

Arbeitsschritte:

- [ ] `docs/agent/catalog-pipeline.md` aktualisieren.
- [ ] `docs/agent/domain-actions.md` um Catalog-Override-High-Level-Actions ergaenzen.
- [ ] `docs/agent/migration-backlog.md` aktualisieren:
  - [ ] Items Catalog-Migration erledigt.
  - [ ] Actions Altpfad erledigt.
  - [ ] Creatures Production Edit erledigt.
  - [ ] Restliche Fallbacks benennen oder entfernen.
- [ ] `docs/agent/smoke-results.md` nach Production-Smoke aktualisieren.

Erfolgskriterien:

- [ ] Neue Entwickler koennen anhand der Doku nachvollziehen, warum static JSON nicht direkt editiert wird.
- [ ] Backlog enthaelt keine erledigten Catalog-Altlasten mehr.

## Abschlusskriterien

- [ ] Alle Catalog-Tabellen haben dieselben sichtbaren Aktionen: `Edit`, `Clone`, `Delete`, `Copy Reference`.
- [ ] Static `Edit` wird ueber `mode: "override"` gespeichert.
- [ ] Static `Delete` wird ueber `mode: "hide"` gespeichert.
- [ ] Custom `Delete` entfernt das Custom Override.
- [ ] Tabellen aktualisieren nach Save/Delete automatisch ohne Reload.
- [ ] Suche, Filter, Sortierung und Auswahl bleiben nach Mutation erhalten.
- [ ] Statusfilter fuer Original/Editiert/Custom/Geloescht existieren.
- [ ] Production-Editoren fuer Items, Spells, Actions, Feats, Impulses, Abilities und Creatures benoetigen keine File-API.
- [ ] Copy Reference funktioniert fuer alle Catalog-Typen konsistent.

## Nicht-Ziele Dieser Welle

- Keine vollstaendige Versionierung von Catalog-Eintraegen.
- Keine Live-Firestore-Datenmigration ohne separate Freigabe.
- Keine Entfernung alter static JSON-Dateien.
- Keine UI-Komplettneugestaltung der Tabellen.
- Keine Zusammenlegung von Bestiary-Reveal-Metadata mit Creature-Content-Overrides.
