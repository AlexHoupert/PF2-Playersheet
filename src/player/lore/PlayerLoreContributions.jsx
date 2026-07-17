import React from "react";
import { Edit3, FilePlus2, NotebookPen } from "lucide-react";
import { Badge } from "../../components/ui/badge.jsx";
import { Button } from "../../components/ui/button.jsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog.jsx";
import { Input } from "../../components/ui/input.jsx";
import { Textarea } from "../../components/ui/textarea.jsx";
import { getLoreCategoryLabel, LORE_CATEGORIES } from "../../shared/lore/loreModel.js";

export default function PlayerLoreContributions({
  actorId,
  canAuthor = false,
  category,
  contributions = [],
  onOpen,
  onSave,
}) {
  const [editing, setEditing] = React.useState(null);
  const visible = contributions
    .filter(entry => entry.status === "active" && entry.category === category)
    .sort((left, right) => String(right.updatedAt || "").localeCompare(String(left.updatedAt || "")));

  return (
    <section className="player-lore-contributions">
      <header>
        <span><NotebookPen />Party contributions</span>
        {canAuthor && (
          <Button size="sm" variant="outline" onClick={() => setEditing(createEmptyContribution(category, actorId))}>
            <FilePlus2 />Add
          </Button>
        )}
      </header>
      {visible.map(contribution => (
        <button key={contribution.id} type="button" onClick={() => onOpen?.(contribution)}>
          <span><strong>{contribution.title}</strong><Badge variant="outline">Player</Badge></span>
          <small>{contribution.createdByActorId === actorId ? "Your contribution" : "Shared by the party"}</small>
          {canAuthor && contribution.createdByActorId === actorId && (
            <span
              role="button"
              tabIndex={0}
              className="player-lore-contributions__edit"
              onClick={(event) => { event.stopPropagation(); setEditing(contribution); }}
              onKeyDown={(event) => { if (event.key === "Enter") setEditing(contribution); }}
            ><Edit3 />Edit</span>
          )}
        </button>
      ))}
      {!visible.length && canAuthor && <small className="player-lore-contributions__empty">No player contributions in this category.</small>}

      <ContributionEditor
        contribution={editing}
        onClose={() => setEditing(null)}
        onSave={async value => {
          await onSave?.(value);
          setEditing(null);
        }}
      />
    </section>
  );
}

function ContributionEditor({ contribution, onClose, onSave }) {
  const [draft, setDraft] = React.useState(contribution);
  const [saving, setSaving] = React.useState(false);
  React.useEffect(() => setDraft(contribution), [contribution]);
  if (!draft) return null;

  const save = async () => {
    if (!draft.title?.trim() || !draft.content?.trim()) return;
    setSaving(true);
    try {
      await onSave(draft);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={Boolean(contribution)} onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{draft.id ? "Edit party contribution" : "New party contribution"}</DialogTitle>
          <DialogDescription>This is visible to the whole party and remains separate from official GM lore.</DialogDescription>
        </DialogHeader>
        <label>Title<Input value={draft.title} onChange={event => setDraft(current => ({ ...current, title: event.target.value }))} /></label>
        <label>Category
          <select value={draft.category} onChange={event => setDraft(current => ({ ...current, category: event.target.value }))}>
            {LORE_CATEGORIES.filter(entry => entry.id !== "bestiary").map(entry => <option key={entry.id} value={entry.id}>{entry.label}</option>)}
          </select>
        </label>
        <label>Notes<Textarea rows={10} value={draft.content} onChange={event => setDraft(current => ({ ...current, content: event.target.value }))} /></label>
        <label>Tags<Input value={(draft.tags || []).join(", ")} onChange={event => setDraft(current => ({ ...current, tags: event.target.value.split(",").map(value => value.trim()).filter(Boolean) }))} placeholder="clue, faction, open question" /></label>
        <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button disabled={saving || !draft.title?.trim() || !draft.content?.trim()} onClick={save}>{saving ? "Saving..." : "Share with party"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function createEmptyContribution(category, actorId) {
  return {
    category: category === "bestiary" ? "other" : category,
    content: "",
    createdByActorId: actorId,
    tags: [],
    title: "",
  };
}

export function buildContributionArticle(contribution) {
  return {
    articleId: contribution.id,
    title: contribution.title,
    category: contribution.category,
    tags: contribution.tags || [],
    bodyBlocks: [{ id: `${contribution.id}-content`, type: "content", content: contribution.content }],
    infobox: [{ id: "source", label: "Source", value: `Player contribution · ${getLoreCategoryLabel(contribution.category)}` }],
  };
}
