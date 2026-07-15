import React from "react";
import { Eye, EyeOff, Save, Trash2 } from "lucide-react";
import { Button } from "../../components/ui/button.jsx";
import { Textarea } from "../../components/ui/textarea.jsx";

const NOTE_AUTOSAVE_MS = 700;

export default function KnowledgeNoteEditor({
  note = null,
  actorId,
  targetType,
  targetId,
  onSave,
  onDelete,
}) {
  const [content, setContent] = React.useState(note?.content || "");
  const [sharedWithGm, setSharedWithGm] = React.useState(Boolean(note?.sharedWithGm));
  const [status, setStatus] = React.useState("Saved");
  const noteRef = React.useRef(note);
  const saveRef = React.useRef(onSave);
  const deleteRef = React.useRef(onDelete);

  React.useEffect(() => { noteRef.current = note; }, [note]);
  React.useEffect(() => { saveRef.current = onSave; }, [onSave]);
  React.useEffect(() => { deleteRef.current = onDelete; }, [onDelete]);

  React.useEffect(() => {
    setContent(note?.content || "");
    setSharedWithGm(Boolean(note?.sharedWithGm));
    setStatus("Saved");
  }, [note?.id, note?.content, note?.sharedWithGm, targetId]);

  React.useEffect(() => {
    const persistedContent = noteRef.current?.content || "";
    const persistedSharedWithGm = Boolean(noteRef.current?.sharedWithGm);
    if (content === persistedContent && sharedWithGm === persistedSharedWithGm) return undefined;
    if (!actorId || !targetId || (!content.trim() && !noteRef.current)) return undefined;
    setStatus("Saving");
    const timer = window.setTimeout(async () => {
      try {
        await saveRef.current?.({
          ...noteRef.current,
          actorId,
          targetType,
          targetId,
          content,
          sharedWithGm,
        });
        setStatus("Saved");
      } catch {
        setStatus("Error");
      }
    }, NOTE_AUTOSAVE_MS);
    return () => window.clearTimeout(timer);
  }, [actorId, content, sharedWithGm, targetId, targetType]);

  const remove = async () => {
    if (noteRef.current?.id) await deleteRef.current?.(noteRef.current);
    setContent("");
    setSharedWithGm(false);
  };

  return (
    <section className="knowledge-note-editor">
      <div className="knowledge-note-editor__heading">
        <div><h3>Your notes</h3><small>{status}</small></div>
        {note?.id && <Button size="icon-xs" variant="ghost" title="Delete note" onClick={remove}><Trash2 /></Button>}
      </div>
      <Textarea data-testid="knowledge-note-content" value={content} onChange={(event) => setContent(event.target.value)} placeholder="Record what your character knows, suspects, or wants to investigate..." rows={6} />
      <label className="knowledge-note-editor__share">
        <input data-testid="knowledge-note-share" type="checkbox" checked={sharedWithGm} onChange={(event) => setSharedWithGm(event.target.checked)} />
        {sharedWithGm ? <Eye /> : <EyeOff />}
        <span><strong>Share with GM</strong><small>Your note stays read-only for the GM.</small></span>
      </label>
      <span className="knowledge-note-editor__autosave" data-testid="knowledge-note-status"><Save />{status}. Notes save automatically.</span>
    </section>
  );
}
