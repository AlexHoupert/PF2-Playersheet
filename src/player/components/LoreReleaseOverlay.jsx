import { BookOpen, X } from "lucide-react";
import { Button } from "../../components/ui/button.jsx";
import { getLoreCategoryLabel } from "../../shared/lore/loreModel.js";
import OverlaySurface from "../../shared/overlays/OverlaySurface.jsx";

export default function LoreReleaseOverlay({ delivery, onDismiss, onOpen, pending = false }) {
  const snapshot = delivery?.snapshot || {};
  return (
    <OverlaySurface id={`lore-release-${delivery?.id || "current"}`} className="lore-release-popup" ariaLabelledBy="lore-release-title" onEscape={onDismiss}>
      <div className="lore-release-popup__icon"><BookOpen /></div>
      <span className="lore-release-popup__eyebrow">New knowledge · {getLoreCategoryLabel(snapshot.category)}</span>
      <h2 id="lore-release-title">{snapshot.title || "New lore entry"}</h2>
      <p>Your character has learned something new.</p>
      <div className="lore-release-popup__actions"><Button data-testid="lore-release-close" variant="outline" disabled={pending} onClick={onDismiss}><X />Close</Button><Button data-testid="lore-release-open" disabled={pending} onClick={onOpen}><BookOpen />{pending ? "Saving..." : "Open entry"}</Button></div>
    </OverlaySurface>
  );
}
