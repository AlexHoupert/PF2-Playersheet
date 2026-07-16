import React from "react";
import { ArrowLeft, BookOpen, CalendarDays, MapPin, Search, Tag, UserRound } from "lucide-react";
import { Badge } from "../../components/ui/badge.jsx";
import { Button } from "../../components/ui/button.jsx";
import { Input } from "../../components/ui/input.jsx";
import { selectPlayerVisibleCreatureIds } from "../../shared/db/selectors/bestiarySelectors.js";
import LoreArticleRenderer from "../../shared/lore/LoreArticleRenderer.jsx";
import { getLoreCategoryLabel } from "../../shared/lore/loreModel.js";
import {
  searchLoreDeliveries,
  selectLoreDeliveryByArticleId,
  selectOwnKnowledgeNote,
  selectPartyKnowledgeNotes,
} from "../../shared/lore/loreSelectors.js";
import KnowledgeNoteEditor from "./KnowledgeNoteEditor.jsx";
import SharedKnowledgeNotes from "./SharedKnowledgeNotes.jsx";

export default function PlayerLoreLibrary({
  db,
  category,
  loreStore,
  campaignId,
  actorId,
  dataActions,
  actors = [],
  initialArticleId = null,
  onNavigateArticle,
  onNavigateCreature,
}) {
  const [query, setQuery] = React.useState("");
  const [groupId, setGroupId] = React.useState("all");
  const [selectedId, setSelectedId] = React.useState(initialArticleId);
  const deliveries = loreStore.deliveries || [];
  const groups = loreStore.groups || [];

  React.useEffect(() => {
    if (initialArticleId) setSelectedId(initialArticleId);
  }, [initialArticleId]);

  const visibleDeliveries = React.useMemo(() => searchLoreDeliveries(deliveries, groups, query, category)
    .filter((delivery) => groupId === "all" || delivery.snapshot.groupId === groupId)
    .sort((left, right) => sortCategoryDeliveries(category, left, right)), [category, deliveries, groupId, groups, query]);
  const selectedDeliveryCandidate = selectLoreDeliveryByArticleId(deliveries, selectedId);
  const selectedDelivery = selectedDeliveryCandidate?.snapshot?.category === category
    ? selectedDeliveryCandidate
    : null;
  const selectedSnapshot = selectedDelivery?.snapshot || null;
  const note = selectOwnKnowledgeNote(loreStore.notes, actorId, "loreArticle", selectedSnapshot?.articleId);
  const partyNotes = selectPartyKnowledgeNotes(loreStore.partyNotes, actorId, "loreArticle", selectedSnapshot?.articleId);
  const categoryGroups = groups.filter((group) => group.category === category && !group.archivedAt);
  const visibleCreatureIds = React.useMemo(() => selectPlayerVisibleCreatureIds(db), [db]);

  const openDelivery = React.useCallback(async (delivery) => {
    if (!delivery) return;
    setSelectedId(delivery.articleId);
    if (!delivery.legacyFallback && Number(delivery.attentionVersion || 0) > Number(delivery.readVersion || 0)) {
      await dataActions.lore.markDeliveryRead(campaignId, delivery.id);
    }
  }, [campaignId, dataActions]);

  React.useEffect(() => {
    if (!initialArticleId) return;
    const delivery = selectLoreDeliveryByArticleId(deliveries, initialArticleId);
    if (delivery?.snapshot?.category === category) openDelivery(delivery).catch(() => {});
  }, [category, deliveries, initialArticleId, openDelivery]);

  const resolveReference = (reference) => {
    if (reference.type === "lore") {
      const target = selectLoreDeliveryByArticleId(deliveries, reference.id);
      return {
        accessible: Boolean(target),
        label: reference.label,
        onOpen: target ? () => onNavigateArticle?.(target.snapshot.category, target.articleId) : null,
      };
    }
    if (reference.type === "creature") {
      const accessible = visibleCreatureIds.has(String(reference.id));
      return {
        accessible,
        label: reference.label,
        onOpen: accessible ? () => onNavigateCreature?.(reference.id) : null,
      };
    }
    return { accessible: false, label: reference.label };
  };

  return (
    <div className={`player-knowledge-library ${selectedSnapshot ? "reading" : ""}`} data-testid={`player-lore-${category}`}>
      <aside className="player-knowledge-index">
        <header><div><span className="player-knowledge-eyebrow">Knowledge</span><h2>{getLoreCategoryLabel(category)}</h2></div><Badge variant="outline">{visibleDeliveries.length}</Badge></header>
        <div className="player-knowledge-search"><Search /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${getLoreCategoryLabel(category)}...`} /></div>
        {categoryGroups.length > 0 && <select value={groupId} onChange={(event) => setGroupId(event.target.value)}><option value="all">All groups</option>{categoryGroups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select>}
        <div className="player-knowledge-list">
          {visibleDeliveries.map((delivery) => <button key={delivery.id} type="button" data-testid={`player-lore-entry-${delivery.articleId}`} className={delivery.articleId === selectedId ? "active" : ""} onClick={() => openDelivery(delivery)}><span className="player-knowledge-list__title">{delivery.snapshot.title}</span><ArticleListMeta snapshot={delivery.snapshot} groups={groups} />{Number(delivery.attentionVersion || 0) > Number(delivery.readVersion || 0) && <span className="player-knowledge-unread" aria-label="Unread release">!</span>}</button>)}
          {!visibleDeliveries.length && <p className="player-knowledge-empty">No released entries match your search.</p>}
        </div>
      </aside>
      <main className="player-knowledge-reader" data-testid={`player-lore-reader-${category}`}>
        {selectedSnapshot ? <><Button className="player-knowledge-mobile-back" variant="outline" onClick={() => setSelectedId(null)}><ArrowLeft />Back to index</Button><LoreArticleRenderer article={selectedSnapshot} resolveReference={resolveReference} /><KnowledgeNoteEditor note={note} actorId={actorId} targetType="loreArticle" targetId={selectedSnapshot.articleId} onSave={(next) => dataActions.lore.saveNote(campaignId, next)} onDelete={(current) => dataActions.lore.deleteNote(campaignId, current.id)} /><SharedKnowledgeNotes notes={partyNotes} actors={actors} /></> : <div className="player-knowledge-reader__empty"><BookOpen /><p>Select an entry to read.</p></div>}
      </main>
    </div>
  );
}

function ArticleListMeta({ snapshot, groups }) {
  const group = groups.find((entry) => entry.id === snapshot.groupId);
  const data = snapshot.categoryData || {};
  if (snapshot.category === "history" && data.dateLabel) return <small><CalendarDays />{data.dateLabel}</small>;
  if (snapshot.category === "locations" && (data.region || group)) return <small><MapPin />{data.region || group?.name}</small>;
  if (snapshot.category === "npcs" && (data.role || data.faction)) return <small><UserRound />{[data.role, data.faction].filter(Boolean).join(" · ")}</small>;
  if ((snapshot.tags || []).length) return <small><Tag />{snapshot.tags.slice(0, 2).join(", ")}</small>;
  return group ? <small>{group.name}</small> : null;
}

function sortCategoryDeliveries(category, left, right) {
  if (category === "history") {
    const leftKey = String(left.snapshot.categoryData?.sortKey || "");
    const rightKey = String(right.snapshot.categoryData?.sortKey || "");
    if (leftKey || rightKey) return leftKey.localeCompare(rightKey);
  }
  return String(left.snapshot.title || "").localeCompare(String(right.snapshot.title || ""));
}
