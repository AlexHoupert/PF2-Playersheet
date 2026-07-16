import { MessageSquareText, Users } from "lucide-react";

export default function SharedKnowledgeNotes({ notes = [], actors = [] }) {
  if (!notes.length) return null;
  const actorNames = new Map((actors || []).map((actor) => [String(actor.id), actor.name]));

  return (
    <section className="party-knowledge-notes" data-testid="party-shared-notes">
      <header>
        <div><Users /><h3>Party notes</h3></div>
        <small>{notes.length} shared</small>
      </header>
      <div className="party-knowledge-notes__list">
        {notes.map((note) => (
          <article key={note.id} data-testid={`party-shared-note-${note.id}`}>
            <header>
              <strong>{actorNames.get(String(note.actorId)) || "Party member"}</strong>
              <small>{formatUpdatedAt(note.updatedAt)}</small>
            </header>
            <p><MessageSquareText />{note.content}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function formatUpdatedAt(value) {
  const timestamp = Date.parse(value || "");
  if (!Number.isFinite(timestamp)) return "Shared note";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(timestamp);
}
