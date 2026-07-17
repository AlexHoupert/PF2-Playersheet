import React from "react";
import {
  ArrowLeft,
  BookOpenText,
  ExternalLink,
  FileQuestion,
  Search,
  Shield,
  StickyNote,
} from "lucide-react";
import { Badge } from "../../components/ui/badge.jsx";
import { Button } from "../../components/ui/button.jsx";
import { Input } from "../../components/ui/input.jsx";
import { buildBestiaryCreatureEntries, selectVisibleCreatureFields } from "../../shared/bestiary/creaturePresentation.js";
import { selectBestiaryCreatureMetadata } from "../../shared/db/selectors/bestiarySelectors.js";
import { selectCatalogEntryStates } from "../../shared/db/selectors/catalogOverrideSelectors.js";
import { LORE_CATEGORIES } from "../../shared/lore/loreModel.js";
import {
  buildKnowledgeNoteViewModels,
  filterKnowledgeNoteViewModels,
} from "../../shared/lore/loreSelectors.js";
import KnowledgeNoteEditor from "./KnowledgeNoteEditor.jsx";

const DEFAULT_FILTERS = Object.freeze({
  query: "",
  targetType: "all",
  category: "all",
  sharing: "all",
  availability: "all",
  sortBy: "updated-desc",
});

export default function PlayerKnowledgeNotesOverview({
  active = true,
  db,
  loreStore,
  campaignId,
  actorId,
  dataActions,
  actors = [],
  onNavigateArticle,
  onNavigateCreature,
  readOnly = false,
}) {
  const [filters, setFilters] = React.useState(DEFAULT_FILTERS);
  const [selectedId, setSelectedId] = React.useState(null);
  const [catalogCreatures, setCatalogCreatures] = React.useState([]);
  const listRef = React.useRef(null);

  React.useEffect(() => {
    if (!active) return undefined;
    let cancelled = false;
    import("../../shared/catalog/creatureIndex.js").then((module) => {
      if (!cancelled) setCatalogCreatures(module.getAllCreatures());
    });
    return () => { cancelled = true; };
  }, [active]);

  const visibleCreatures = React.useMemo(() => {
    if (!active || !catalogCreatures.length) return [];
    return buildBestiaryCreatureEntries({
      entryStates: selectCatalogEntryStates(catalogCreatures, db, "creature"),
      metadata: selectBestiaryCreatureMetadata(db),
      includeUnpublished: false,
    }).map((creature) => {
      const visible = selectVisibleCreatureFields(creature, "player");
      return {
        id: creature.id,
        name: visible.name,
        image: creature.data?.img || creature.img || null,
      };
    });
  }, [active, catalogCreatures, db]);

  const notes = React.useMemo(() => buildKnowledgeNoteViewModels({
    notes: (loreStore.notes || []).filter((note) => String(note.actorId) === String(actorId)),
    deliveries: loreStore.deliveries || [],
    groups: loreStore.groups || [],
    visibleCreatures,
    actors,
  }), [actorId, actors, loreStore.deliveries, loreStore.groups, loreStore.notes, visibleCreatures]);

  const filteredNotes = React.useMemo(
    () => filterKnowledgeNoteViewModels(notes, filters),
    [filters, notes]
  );
  const selectedNote = notes.find((note) => note.id === selectedId) || null;

  React.useEffect(() => {
    listRef.current?.scrollTo?.({ top: 0 });
    setSelectedId((current) => current && !filteredNotes.some((note) => note.id === current) ? null : current);
  }, [filteredNotes]);

  React.useEffect(() => {
    if (selectedId && !notes.some((note) => note.id === selectedId)) setSelectedId(null);
  }, [notes, selectedId]);

  const updateFilter = (key, value) => setFilters((current) => ({ ...current, [key]: value }));
  const openSource = () => {
    const command = selectedNote?.navigationCommand;
    if (!command) return;
    if (command.type === "creature") onNavigateCreature?.(command.targetId);
    else onNavigateArticle?.(command.category, command.targetId);
  };

  return (
    <div
      className={`player-knowledge-library player-knowledge-notes ${selectedNote ? "reading" : ""}`}
      data-testid="player-knowledge-notes"
    >
      <aside className="player-knowledge-index player-knowledge-notes__index">
        <header>
          <div>
            <span className="player-knowledge-eyebrow">Knowledge</span>
            <h2>Notes</h2>
          </div>
          <Badge variant="outline" data-testid="knowledge-notes-total">{notes.length}</Badge>
        </header>

        <div className="player-knowledge-notes__filters">
          <div className="player-knowledge-search">
            <Search />
            <Input
              value={filters.query}
              onChange={(event) => updateFilter("query", event.target.value)}
              placeholder="Search notes and sources..."
              data-testid="knowledge-notes-search"
            />
          </div>
          <div className="player-knowledge-notes__filter-grid">
            <FilterSelect label="Target" value={filters.targetType} onChange={(value) => updateFilter("targetType", value)} testId="knowledge-notes-target-filter">
              <option value="all">All targets</option>
              <option value="loreArticle">Lore</option>
              <option value="creature">Bestiary</option>
            </FilterSelect>
            <FilterSelect label="Category" value={filters.category} onChange={(value) => updateFilter("category", value)} testId="knowledge-notes-category-filter">
              <option value="all">All categories</option>
              {LORE_CATEGORIES.map((category) => <option key={category.id} value={category.id}>{category.label}</option>)}
            </FilterSelect>
            <FilterSelect label="Sharing" value={filters.sharing} onChange={(value) => updateFilter("sharing", value)} testId="knowledge-notes-sharing-filter">
              <option value="all">All sharing</option>
              <option value="private">Private</option>
              <option value="gm">GM</option>
              <option value="party">Party</option>
              <option value="gm-party">GM + Party</option>
            </FilterSelect>
            <FilterSelect label="Availability" value={filters.availability} onChange={(value) => updateFilter("availability", value)} testId="knowledge-notes-availability-filter">
              <option value="all">All availability</option>
              <option value="available">Available</option>
              <option value="unavailable">Unavailable</option>
            </FilterSelect>
            <FilterSelect label="Sort" value={filters.sortBy} onChange={(value) => updateFilter("sortBy", value)} testId="knowledge-notes-sort">
              <option value="updated-desc">Last edited</option>
              <option value="created-desc">Created</option>
              <option value="title-asc">Target title</option>
              <option value="category-asc">Category</option>
            </FilterSelect>
          </div>
        </div>

        <div className="player-knowledge-list player-knowledge-notes__list" ref={listRef}>
          {filteredNotes.map((note) => (
            <button
              key={note.id}
              type="button"
              className={note.id === selectedId ? "active" : ""}
              onClick={() => setSelectedId(note.id)}
              data-testid={`knowledge-note-row-${note.id}`}
            >
              <span className="player-knowledge-notes__row-heading">
                <TargetIcon targetType={note.targetType} />
                <span className="player-knowledge-list__title">{note.targetTitle}</span>
                {!note.targetAccessible && <FileQuestion aria-label="Source unavailable" />}
              </span>
              <span className="player-knowledge-notes__excerpt">{note.excerpt || "Empty note"}</span>
              <span className="player-knowledge-notes__row-meta">
                <small>{note.groupLabel || note.categoryLabel} · {formatNoteDate(note.updatedAt)}</small>
                <SharingBadges note={note} />
              </span>
            </button>
          ))}
          {!notes.length && (
            <div className="player-knowledge-notes__empty" data-testid="knowledge-notes-empty">
              <StickyNote />
              <strong>No notes yet</strong>
              <p>Create a note while reading a Lore or Bestiary entry. It will appear here automatically.</p>
            </div>
          )}
          {notes.length > 0 && !filteredNotes.length && (
            <div className="player-knowledge-notes__empty" data-testid="knowledge-notes-no-match">
              <Search />
              <strong>No matching notes</strong>
              <p>Adjust the search or filters to see more of your notes.</p>
              <Button variant="outline" size="sm" onClick={() => setFilters(DEFAULT_FILTERS)}>Reset filters</Button>
            </div>
          )}
        </div>
      </aside>

      <main className="player-knowledge-reader player-knowledge-notes__reader" data-testid="knowledge-notes-reader">
        {selectedNote ? (
          <>
            <Button className="player-knowledge-mobile-back" variant="outline" onClick={() => setSelectedId(null)}>
              <ArrowLeft />Back to notes
            </Button>
            <header className="player-knowledge-notes__reader-header">
              <div className="player-knowledge-notes__reader-title">
                <TargetIcon targetType={selectedNote.targetType} />
                <div>
                  <span className="player-knowledge-eyebrow">{selectedNote.categoryLabel}{selectedNote.groupLabel ? ` · ${selectedNote.groupLabel}` : ""}</span>
                  <h2>{selectedNote.targetTitle}</h2>
                </div>
              </div>
              <Button
                variant="outline"
                onClick={openSource}
                disabled={!selectedNote.targetAccessible}
                data-testid="knowledge-note-open-source"
              >
                {selectedNote.targetAccessible ? <><ExternalLink />Open source</> : <><FileQuestion />Source unavailable</>}
              </Button>
            </header>
            <div className="player-knowledge-notes__reader-meta">
              <SharingBadges note={selectedNote} />
              <span>Created {formatNoteDate(selectedNote.createdAt)} · Edited {formatNoteDate(selectedNote.updatedAt)}</span>
            </div>
            <KnowledgeNoteEditor
              readOnly={readOnly}
              note={selectedNote.note}
              actorId={actorId}
              targetType={selectedNote.targetType}
              targetId={selectedNote.targetId}
              targetSnapshot={{
                title: selectedNote.targetTitle,
                category: selectedNote.category,
                image: selectedNote.targetImage,
              }}
              onSave={(next) => dataActions.lore.saveNote(campaignId, next)}
              onDelete={async (current) => {
                await dataActions.lore.deleteNote(campaignId, current.id);
                setSelectedId(null);
              }}
            />
          </>
        ) : (
          <div className="player-knowledge-reader__empty">
            <StickyNote />
            <p>Select a note to read or edit.</p>
          </div>
        )}
      </main>
    </div>
  );
}

function FilterSelect({ label, value, onChange, testId, children }) {
  return (
    <label>
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} data-testid={testId}>
        {children}
      </select>
    </label>
  );
}

function TargetIcon({ targetType }) {
  return targetType === "creature" ? <Shield aria-hidden="true" /> : <BookOpenText aria-hidden="true" />;
}

function SharingBadges({ note }) {
  if (!note.sharedWithGm && !note.sharedWithParty) {
    return <span className="player-knowledge-notes__badges"><Badge variant="outline">Private</Badge></span>;
  }
  return (
    <span className="player-knowledge-notes__badges">
      {note.sharedWithGm && <Badge variant="outline">GM</Badge>}
      {note.sharedWithParty && <Badge variant="secondary">Party</Badge>}
    </span>
  );
}

function formatNoteDate(value) {
  const timestamp = Date.parse(value || "");
  if (!Number.isFinite(timestamp)) return "Unknown date";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(timestamp);
}
