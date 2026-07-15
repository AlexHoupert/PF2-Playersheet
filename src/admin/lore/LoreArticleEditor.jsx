import React from "react";
import { Archive, Eye, Link2, Plus, RotateCcw, Save, Send, Trash2 } from "lucide-react";
import { Badge } from "../../components/ui/badge.jsx";
import { Button } from "../../components/ui/button.jsx";
import { Input } from "../../components/ui/input.jsx";
import { Textarea } from "../../components/ui/textarea.jsx";
import { LORE_CATEGORIES, LORE_AUDIENCE_MODES } from "../../shared/lore/loreModel.js";
import LoreReferencePicker from "./LoreReferencePicker.jsx";

export default function LoreArticleEditor({
  draft,
  onChange,
  articles,
  groups,
  pcActors,
  db,
  saveStatus,
  linkIssues = [],
  backlinks = [],
  sharedNotes = [],
  onSaveNow,
  onPublish,
  onRetract,
  onArchive,
  onRestore,
}) {
  const [referencePickerOpen, setReferencePickerOpen] = React.useState(false);
  const [activeBlockId, setActiveBlockId] = React.useState(draft?.bodyBlocks?.[0]?.id || null);
  if (!draft) return <div className="lore-admin-empty">Select an article or create a new one.</div>;

  const setField = (field, value) => onChange?.({ ...draft, [field]: value });
  const updatePublication = (patch) => setField("publication", { ...draft.publication, ...patch });
  const updateBlock = (blockId, patch) => setField("bodyBlocks", draft.bodyBlocks.map((block) => block.id === blockId ? { ...block, ...patch } : block));
  const addBlock = (type) => {
    const id = `block_${crypto.randomUUID()}`;
    const block = {
      id,
      type,
      content: "",
      audience: type === "reveal" ? { mode: "party", actorIds: [] } : { mode: "inherit", actorIds: [] },
    };
    setField("bodyBlocks", [...draft.bodyBlocks, block]);
    setActiveBlockId(id);
  };
  const removeBlock = (blockId) => {
    if (draft.bodyBlocks.length <= 1) return;
    setField("bodyBlocks", draft.bodyBlocks.filter((block) => block.id !== blockId));
  };
  const insertReference = (_entry, markup) => {
    const blockId = activeBlockId || draft.bodyBlocks[0]?.id;
    if (!blockId) return;
    const block = draft.bodyBlocks.find((entry) => entry.id === blockId);
    updateBlock(blockId, { content: `${block?.content || ""}${block?.content ? " " : ""}${markup}` });
  };

  return (
    <div className="lore-editor">
      <div className="lore-editor__sticky-header">
        <div>
          <span className="lore-editor__status-label">{draft.publication.status} v{draft.publication.version}</span>
          <span className={`lore-save-state lore-save-state--${saveStatus.toLowerCase()}`}>{saveStatus}</span>
        </div>
        <div className="lore-editor__header-actions">
          <Button data-testid="lore-save-now" variant="outline" onClick={onSaveNow}><Save />Save now</Button>
          {draft.publication.status === "published" && <Button variant="outline" onClick={onRetract}><RotateCcw />Retract</Button>}
          {!draft.deletedAt && <Button variant="destructive" onClick={onArchive}><Archive />Archive</Button>}
          {draft.deletedAt && <Button variant="outline" onClick={onRestore}><RotateCcw />Restore</Button>}
          <Button data-testid="lore-open-publish" onClick={onPublish}><Send />Publish</Button>
        </div>
      </div>

      <section className="lore-editor__grid">
        <label>Title<Input data-testid="lore-title-input" value={draft.title} onChange={(event) => setField("title", event.target.value)} /></label>
        <label>Category
          <select value={draft.category} onChange={(event) => setField("category", event.target.value)}>
            {LORE_CATEGORIES.map((category) => <option key={category.id} value={category.id}>{category.label}</option>)}
          </select>
        </label>
        <label>Group
          <select value={draft.groupId || ""} onChange={(event) => setField("groupId", event.target.value || null)}>
            <option value="">Ungrouped</option>
            {groups.filter((group) => group.category === draft.category && !group.archivedAt).map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
          </select>
        </label>
        <label>Image path<Input value={draft.image || ""} onChange={(event) => setField("image", event.target.value || null)} /></label>
        <label className="lore-editor__span">Tags<Input value={(draft.tags || []).join(", ")} onChange={(event) => setField("tags", event.target.value.split(",").map((tag) => tag.trim()).filter(Boolean))} /></label>
      </section>

      <section className="lore-editor__section">
        <div className="lore-editor__section-heading">
          <div><h3>Audience</h3><p>The outer audience controls who receives a materialized article delivery.</p></div>
        </div>
        <div className="lore-editor__audience-row">
          <label><input type="radio" checked={draft.publication.audience.mode === "party"} onChange={() => updatePublication({ audience: { mode: "party", actorIds: [] } })} /> Whole party</label>
          <label><input type="radio" checked={draft.publication.audience.mode === "actors"} onChange={() => updatePublication({ audience: { mode: "actors", actorIds: [] } })} /> Selected PCs</label>
        </div>
        {draft.publication.audience.mode === "actors" && (
          <div className="lore-editor__actor-grid">
            {pcActors.map((actor) => (
              <label key={actor.id}>
                <input
                  type="checkbox"
                  checked={draft.publication.audience.actorIds.includes(actor.id)}
                  onChange={(event) => {
                    const current = new Set(draft.publication.audience.actorIds);
                    if (event.target.checked) current.add(actor.id); else current.delete(actor.id);
                    updatePublication({ audience: { mode: "actors", actorIds: [...current] } });
                  }}
                />
                {actor.name}
              </label>
            ))}
          </div>
        )}
      </section>

      <section className="lore-editor__section">
        <div className="lore-editor__section-heading">
          <div><h3>Article blocks</h3><p>Reveal blocks are filtered before Player documents are written.</p></div>
          <div>
            <Button data-testid="lore-insert-link" variant="outline" onClick={() => setReferencePickerOpen(true)}><Link2 />Insert link</Button>
            <Button variant="outline" onClick={() => addBlock("content")}><Plus />Text</Button>
            <Button variant="outline" onClick={() => addBlock("reveal")}><Eye />Reveal</Button>
          </div>
        </div>
        <div className="lore-block-list">
          {draft.bodyBlocks.map((block, index) => (
            <div key={block.id} className={`lore-block-editor ${block.type === "reveal" ? "lore-block-editor--reveal" : ""}`} onFocus={() => setActiveBlockId(block.id)}>
              <div className="lore-block-editor__header">
                <span>{block.type === "reveal" ? "Reveal block" : `Text block ${index + 1}`}</span>
                {block.type === "reveal" && (
                  <select value={block.audience?.mode || "party"} onChange={(event) => updateBlock(block.id, { audience: { mode: event.target.value, actorIds: [] } })}>
                    <option value={LORE_AUDIENCE_MODES.INHERIT}>Inherit article audience</option>
                    <option value={LORE_AUDIENCE_MODES.PARTY}>All article recipients</option>
                    <option value={LORE_AUDIENCE_MODES.ACTORS}>Selected PCs only</option>
                    <option value={LORE_AUDIENCE_MODES.GM}>GM only</option>
                  </select>
                )}
                <Button size="icon-xs" variant="ghost" disabled={draft.bodyBlocks.length <= 1} onClick={() => removeBlock(block.id)} title="Remove block"><Trash2 /></Button>
              </div>
              {block.type === "reveal" && block.audience?.mode === "actors" && (
                <div className="lore-editor__actor-grid">
                  {pcActors.map((actor) => (
                    <label key={actor.id}>
                      <input type="checkbox" checked={(block.audience.actorIds || []).includes(actor.id)} onChange={(event) => {
                        const ids = new Set(block.audience.actorIds || []);
                        if (event.target.checked) ids.add(actor.id); else ids.delete(actor.id);
                        updateBlock(block.id, { audience: { mode: "actors", actorIds: [...ids] } });
                      }} />
                      {actor.name}
                    </label>
                  ))}
                </div>
              )}
              <Textarea data-testid={`lore-block-content-${block.id}`} rows={8} value={block.content} onChange={(event) => updateBlock(block.id, { content: event.target.value })} placeholder="# Heading&#10;Write knowledge here. Use [[lore:id|Label]] for references." />
            </div>
          ))}
        </div>
      </section>

      <section className="lore-editor__section">
        <div className="lore-editor__section-heading">
          <div><h3>Infobox</h3><p>Compact structured facts displayed beside the article.</p></div>
          <Button variant="outline" onClick={() => setField("infobox", [...draft.infobox, { id: `infobox_${crypto.randomUUID()}`, label: "", value: "" }])}><Plus />Row</Button>
        </div>
        {draft.infobox.map((row) => (
          <div className="lore-infobox-editor-row" key={row.id}>
            <Input placeholder="Label" value={row.label} onChange={(event) => setField("infobox", draft.infobox.map((entry) => entry.id === row.id ? { ...entry, label: event.target.value } : entry))} />
            <Input placeholder="Value" value={row.value} onChange={(event) => setField("infobox", draft.infobox.map((entry) => entry.id === row.id ? { ...entry, value: event.target.value } : entry))} />
            <Button size="icon" variant="ghost" onClick={() => setField("infobox", draft.infobox.filter((entry) => entry.id !== row.id))}><Trash2 /></Button>
          </div>
        ))}
      </section>

      <CategoryFields draft={draft} onChange={setField} />

      <section className="lore-editor__section lore-editor__diagnostics">
        <h3>Connections</h3>
        <div><strong>Backlinks</strong>{backlinks.length ? backlinks.map((entry) => <Badge key={entry.id} variant="outline">{entry.title}</Badge>) : <span>None</span>}</div>
        <div><strong>Link checks</strong>{linkIssues.length ? linkIssues.map((entry) => <Badge key={`${entry.type}:${entry.id}`} variant={entry.valid ? "outline" : "destructive"}>{entry.label}</Badge>) : <span>No links</span>}</div>
        <div><strong>Shared notes</strong>{sharedNotes.length ? sharedNotes.map((note) => <blockquote key={note.id}>{note.content}</blockquote>) : <span>None</span>}</div>
      </section>

      <LoreReferencePicker open={referencePickerOpen} onOpenChange={setReferencePickerOpen} articles={articles} db={db} onSelect={insertReference} />
    </div>
  );
}

function CategoryFields({ draft, onChange }) {
  const data = draft.categoryData || {};
  const setData = (key, value) => onChange("categoryData", { ...data, [key]: value });
  if (draft.category === "history") {
    return <section className="lore-editor__section"><h3>History metadata</h3><div className="lore-editor__grid"><label>Date label<Input value={data.dateLabel || ""} onChange={(event) => setData("dateLabel", event.target.value)} /></label><label>Timeline sort key<Input value={data.sortKey || ""} onChange={(event) => setData("sortKey", event.target.value)} /></label></div></section>;
  }
  if (draft.category === "locations") {
    return <section className="lore-editor__section"><h3>Location metadata</h3><div className="lore-editor__grid"><label>Region<Input value={data.region || ""} onChange={(event) => setData("region", event.target.value)} /></label><label>Parent location reference<Input value={data.parentLocationId || ""} onChange={(event) => setData("parentLocationId", event.target.value)} /></label><label>Map ID<Input value={data.mapId || ""} onChange={(event) => setData("mapId", event.target.value)} /></label><label>Pin ID<Input value={data.pinId || ""} onChange={(event) => setData("pinId", event.target.value)} /></label></div></section>;
  }
  if (draft.category === "npcs") {
    return <section className="lore-editor__section"><h3>NPC metadata</h3><div className="lore-editor__grid"><label>Role<Input value={data.role || ""} onChange={(event) => setData("role", event.target.value)} /></label><label>Status<Input value={data.status || ""} onChange={(event) => setData("status", event.target.value)} /></label><label>Faction<Input value={data.faction || ""} onChange={(event) => setData("faction", event.target.value)} /></label><label>Location reference<Input value={data.locationId || ""} onChange={(event) => setData("locationId", event.target.value)} /></label></div></section>;
  }
  return null;
}
