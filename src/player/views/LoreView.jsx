import PlayerBestiaryLibrary from "../lore/PlayerBestiaryLibrary.jsx";
import PlayerLoreLibrary from "../lore/PlayerLoreLibrary.jsx";
import "../lore/playerLore.css";

export default function LoreView({
  db,
  initialCategory = "history",
  loreStore,
  campaignId,
  actorId,
  dataActions,
  actors = [],
  initialArticleId = null,
  initialCreatureId = null,
  onNavigateArticle,
  onNavigateCreature,
}) {
  const category = String(initialCategory || "history").toLowerCase();
  if (category === "bestiary") {
    return <PlayerBestiaryLibrary db={db} loreStore={loreStore} campaignId={campaignId} actorId={actorId} dataActions={dataActions} actors={actors} initialCreatureId={initialCreatureId} />;
  }
  return <PlayerLoreLibrary db={db} category={category} loreStore={loreStore} campaignId={campaignId} actorId={actorId} dataActions={dataActions} actors={actors} initialArticleId={initialArticleId} onNavigateArticle={onNavigateArticle} onNavigateCreature={onNavigateCreature} />;
}
