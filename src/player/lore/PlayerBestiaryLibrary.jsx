import React from "react";
import { ArrowLeft, Search, ShieldQuestion } from "lucide-react";
import { Badge } from "../../components/ui/badge.jsx";
import { Button } from "../../components/ui/button.jsx";
import { Input } from "../../components/ui/input.jsx";
import { buildBestiaryCreatureEntries, selectVisibleCreatureFields } from "../../shared/bestiary/creaturePresentation.js";
import CreatureAbilityModal from "../../shared/components/CreatureAbilityModal.jsx";
import CreatureCard from "../../shared/components/CreatureCard.jsx";
import CreatureSkillDetailDialog from "../../shared/components/CreatureSkillDetailDialog.jsx";
import { selectCatalogEntryStates } from "../../shared/db/selectors/catalogOverrideSelectors.js";
import { selectBestiaryCreatureMetadata, selectCustomCreatureData } from "../../shared/db/selectors/bestiarySelectors.js";
import { selectOwnKnowledgeNote, selectPartyKnowledgeNotes } from "../../shared/lore/loreSelectors.js";
import KnowledgeNoteEditor from "./KnowledgeNoteEditor.jsx";
import SharedKnowledgeNotes from "./SharedKnowledgeNotes.jsx";

export default function PlayerBestiaryLibrary({
  db,
  loreStore,
  campaignId,
  actorId,
  dataActions,
  actors = [],
  initialCreatureId = null,
}) {
  const [query, setQuery] = React.useState("");
  const [selectedId, setSelectedId] = React.useState(initialCreatureId);
  const [catalogCreatures, setCatalogCreatures] = React.useState([]);
  const [loadedCreatureData, setLoadedCreatureData] = React.useState(null);
  const [selectedAbility, setSelectedAbility] = React.useState(null);
  const [selectedSkill, setSelectedSkill] = React.useState(null);

  React.useEffect(() => {
    let cancelled = false;
    import("../../shared/catalog/creatureIndex.js").then((module) => {
      if (!cancelled) setCatalogCreatures(module.getAllCreatures());
    });
    return () => { cancelled = true; };
  }, []);

  React.useEffect(() => {
    if (initialCreatureId) setSelectedId(initialCreatureId);
  }, [initialCreatureId]);

  const creatures = React.useMemo(() => buildBestiaryCreatureEntries({
    entryStates: selectCatalogEntryStates(catalogCreatures, db, "creature"),
    metadata: selectBestiaryCreatureMetadata(db),
    includeUnpublished: false,
  }), [catalogCreatures, db]);
  const visibleCreatures = React.useMemo(() => creatures
    .map((creature) => ({ creature, visible: selectVisibleCreatureFields(creature, "player") }))
    .filter(({ visible }) => [visible.name, visible.group, visible.level].join(" ").toLowerCase().includes(query.trim().toLowerCase()))
    .sort((left, right) => String(left.visible.name).localeCompare(String(right.visible.name))), [creatures, query]);
  const selectedCreature = creatures.find((creature) => creature.id === selectedId) || null;

  React.useEffect(() => {
    if (!selectedCreature) {
      setLoadedCreatureData(null);
      return undefined;
    }
    if (selectedCreature.data) {
      setLoadedCreatureData(selectedCreature.data);
      return undefined;
    }
    const customData = selectCustomCreatureData(db, selectedCreature.id);
    if (customData) {
      setLoadedCreatureData(customData);
      return undefined;
    }
    let cancelled = false;
    import("../../shared/catalog/creatureIndex.js")
      .then((module) => module.fetchCreatureData(selectedCreature.id))
      .then((data) => { if (!cancelled) setLoadedCreatureData(data || null); });
    return () => { cancelled = true; };
  }, [db, selectedCreature]);

  const note = selectOwnKnowledgeNote(loreStore.notes, actorId, "creature", selectedCreature?.id);
  const partyNotes = selectPartyKnowledgeNotes(loreStore.partyNotes, actorId, "creature", selectedCreature?.id);

  return (
    <div className={`player-knowledge-library player-bestiary-library ${selectedCreature ? "reading" : ""}`}>
      <aside className="player-knowledge-index">
        <header><div><span className="player-knowledge-eyebrow">Knowledge</span><h2>Bestiary</h2></div><Badge variant="outline">{visibleCreatures.length}</Badge></header>
        <div className="player-knowledge-search"><Search /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search discovered creatures..." /></div>
        <div className="player-knowledge-list">
          {visibleCreatures.map(({ creature, visible }) => <button key={creature.id} type="button" className={creature.id === selectedId ? "active" : ""} onClick={() => setSelectedId(creature.id)}><span className="player-knowledge-list__title">{visible.name}</span><small>{visible.levelVisible ? `Level ${visible.level}` : "Level unknown"}{visible.group ? ` · ${visible.group}` : ""}</small></button>)}
          {!visibleCreatures.length && <p className="player-knowledge-empty">No discovered creatures match your search.</p>}
        </div>
      </aside>
      <main className="player-knowledge-reader">
        {selectedCreature ? <><Button className="player-knowledge-mobile-back" variant="outline" onClick={() => setSelectedId(null)}><ArrowLeft />Back to index</Button>{loadedCreatureData ? <CreatureCard creature={{ ...selectedCreature, data: loadedCreatureData }} isGM={false} revealState={selectedCreature.revealState} falseData={selectedCreature.falseData} onAbilityClick={setSelectedAbility} onSkillClick={setSelectedSkill} /> : <div className="player-knowledge-reader__empty"><ShieldQuestion /><p>Loading creature details...</p></div>}<KnowledgeNoteEditor note={note} actorId={actorId} targetType="creature" targetId={selectedCreature.id} onSave={(next) => dataActions.lore.saveNote(campaignId, next)} onDelete={(current) => dataActions.lore.deleteNote(campaignId, current.id)} /><SharedKnowledgeNotes notes={partyNotes} actors={actors} /></> : <div className="player-knowledge-reader__empty"><ShieldQuestion /><p>Select a discovered creature.</p></div>}
      </main>
      {selectedAbility && <CreatureAbilityModal ability={selectedAbility} onClose={() => setSelectedAbility(null)} />}
      {selectedSkill && <CreatureSkillDetailDialog skill={selectedSkill} onClose={() => setSelectedSkill(null)} />}
    </div>
  );
}
