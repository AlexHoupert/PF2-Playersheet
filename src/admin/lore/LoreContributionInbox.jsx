import { Archive, ArrowUpRight, NotebookPen } from "lucide-react";
import { Badge } from "../../components/ui/badge.jsx";
import { Button } from "../../components/ui/button.jsx";
import { getLoreCategoryLabel } from "../../shared/lore/loreModel.js";

export default function LoreContributionInbox({ contributions = [], actors = [], onArchive, onPromote }) {
  const active = contributions
    .filter(entry => entry.status === "active")
    .sort((left, right) => String(right.updatedAt || "").localeCompare(String(left.updatedAt || "")));
  if (!active.length) return null;
  return (
    <section className="lore-contribution-inbox" data-testid="lore-contribution-inbox">
      <header><span><NotebookPen />Player contributions</span><Badge variant="outline">{active.length}</Badge></header>
      <div>
        {active.map(contribution => (
          <article key={contribution.id}>
            <div>
              <strong>{contribution.title}</strong>
              <small>{getActorName(actors, contribution.createdByActorId)} · {getLoreCategoryLabel(contribution.category)}</small>
              <p>{contribution.content}</p>
            </div>
            <div className="lore-contribution-inbox__actions">
              <Button size="sm" variant="outline" onClick={() => onArchive(contribution)}><Archive />Archive</Button>
              <Button size="sm" onClick={() => onPromote(contribution)}><ArrowUpRight />Promote to official</Button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function getActorName(actors, actorId) {
  const actor = actors.find(entry => String(entry.id) === String(actorId));
  return actor?.name || actor?.sheet?.name || "Player";
}
