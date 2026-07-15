import React from "react";
import {
  Archive,
  Bell,
  BookOpen,
  Copy,
  Edit3,
  Eye,
  FolderInput,
  FolderTree,
  Link2Off,
  MoreHorizontal,
  Plus,
  RotateCcw,
  Search,
  Send,
} from "lucide-react";
import { Badge } from "../../components/ui/badge.jsx";
import { Button } from "../../components/ui/button.jsx";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "../../components/ui/context-menu.jsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog.jsx";
import { Input } from "../../components/ui/input.jsx";
import { copyRef } from "../../shared/clipboard/refClipboard.js";
import { selectCustomCreatures } from "../../shared/db/selectors/bestiarySelectors.js";
import {
  createLoreArticleDraft,
  getLoreCategoryLabel,
  LORE_CATEGORIES,
  normalizeLoreArticle,
} from "../../shared/lore/loreModel.js";
import {
  selectLoreBacklinks,
  searchLoreArticles,
  validateLoreLinks,
} from "../../shared/lore/loreSelectors.js";
import LoreArticleEditor from "./LoreArticleEditor.jsx";
import LoreGroupDrawer from "./LoreGroupDrawer.jsx";
import LoreArticleRenderer from "../../shared/lore/LoreArticleRenderer.jsx";
import "./loreAdmin.css";

const AUTOSAVE_DELAY_MS = 850;

export default function LoreAdminWorkspace({
  campaignId,
  db,
  loreStore,
  pcActors = [],
  dataActions,
  confirm,
  notifyError,
  notifySuccess,
}) {
  const [query, setQuery] = React.useState("");
  const [category, setCategory] = React.useState("all");
  const [groupId, setGroupId] = React.useState("all");
  const [status, setStatus] = React.useState("all");
  const [audience, setAudience] = React.useState("all");
  const [tag, setTag] = React.useState("all");
  const [showArchived, setShowArchived] = React.useState(false);
  const [onlyChanged, setOnlyChanged] = React.useState(false);
  const [onlyBroken, setOnlyBroken] = React.useState(false);
  const [onlyUngrouped, setOnlyUngrouped] = React.useState(false);
  const [selectedId, setSelectedId] = React.useState(null);
  const [mode, setMode] = React.useState("preview");
  const [draft, setDraft] = React.useState(null);
  const [dirty, setDirty] = React.useState(false);
  const [saveStatus, setSaveStatus] = React.useState("Saved");
  const [groupDrawerOpen, setGroupDrawerOpen] = React.useState(false);
  const [publishOpen, setPublishOpen] = React.useState(false);
  const [moveTarget, setMoveTarget] = React.useState(null);
  const [moveGroupId, setMoveGroupId] = React.useState("");
  const [notifyPlayers, setNotifyPlayers] = React.useState(true);
  const adoptedLegacyIds = React.useRef(new Set());
  const [catalogCreatureIds, setCatalogCreatureIds] = React.useState([]);

  const articles = loreStore.articles || [];
  const groups = loreStore.groups || [];
  const tags = React.useMemo(() => [...new Set(articles.flatMap((article) => article.tags || []))]
    .sort((left, right) => left.localeCompare(right)), [articles]);
  const selectedArticle = articles.find((article) => article.id === selectedId) || null;
  React.useEffect(() => {
    let cancelled = false;
    import("../../shared/catalog/creatureIndex.js").then((module) => {
      if (!cancelled) setCatalogCreatureIds(module.getAllCreatures().map((entry) => entry.id));
    });
    return () => { cancelled = true; };
  }, []);
  const availableCreatureIds = React.useMemo(() => [
    ...catalogCreatureIds,
    ...Object.keys(selectCustomCreatures(db)),
  ], [catalogCreatureIds, db]);
  const linkIssuesById = React.useMemo(() => new Map(articles.map((article) => [
    article.id,
    validateLoreLinks(article, articles.map((entry) => entry.id), availableCreatureIds),
  ])), [articles, availableCreatureIds]);
  const changedIds = React.useMemo(() => new Set(articles.filter(hasUnpublishedChanges).map((article) => article.id)), [articles]);

  React.useEffect(() => {
    if (selectedId && articles.some((article) => article.id === selectedId)) return;
    const first = articles.find((article) => !article.deletedAt) || articles[0] || null;
    setSelectedId(first?.id || null);
  }, [articles, selectedId]);

  React.useEffect(() => {
    if (!selectedArticle || dirty) return;
    setDraft(normalizeLoreArticle(selectedArticle));
  }, [dirty, selectedArticle]);

  const filteredArticles = React.useMemo(() => {
    return searchLoreArticles(articles, query, groups)
      .filter((article) => showArchived ? Boolean(article.deletedAt) : !article.deletedAt)
      .filter((article) => category === "all" || article.category === category)
      .filter((article) => groupId === "all" || article.groupId === groupId)
      .filter((article) => status === "all" || article.publication.status === status)
      .filter((article) => audience === "all" || article.publication.audience.mode === audience)
      .filter((article) => tag === "all" || (article.tags || []).includes(tag))
      .filter((article) => !onlyChanged || changedIds.has(article.id))
      .filter((article) => !onlyBroken || (linkIssuesById.get(article.id) || []).some((issue) => !issue.valid))
      .filter((article) => !onlyUngrouped || !article.groupId)
      .sort((left, right) => String(right.updatedAt || "").localeCompare(String(left.updatedAt || "")) || left.title.localeCompare(right.title));
  }, [articles, audience, category, changedIds, groupId, groups, linkIssuesById, onlyBroken, onlyChanged, onlyUngrouped, query, showArchived, status, tag]);

  const saveArticleRecord = React.useCallback(async (article) => {
    if (article.legacyFallback && !adoptedLegacyIds.current.has(article.id)) {
      adoptedLegacyIds.current.add(article.id);
      await dataActions.lore.createDraft(campaignId, stripLegacyMarker(article));
      return;
    }
    await dataActions.lore.saveDraft(campaignId, article.id, stripLegacyMarker(article));
  }, [campaignId, dataActions]);

  const persistDraft = React.useCallback(async (article = draft) => {
    if (!campaignId || !article?.id) return null;
    setSaveStatus("Saving");
    try {
      await saveArticleRecord(article);
      setDirty(false);
      setSaveStatus("Saved");
      return article;
    } catch (error) {
      setSaveStatus("Error");
      notifyError(error);
      throw error;
    }
  }, [campaignId, draft, notifyError, saveArticleRecord]);

  React.useEffect(() => {
    if (!dirty || !draft?.id || mode !== "edit") return undefined;
    setSaveStatus("Saving");
    const timer = window.setTimeout(() => {
      persistDraft(draft).catch(() => {});
    }, AUTOSAVE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [dirty, draft, mode, persistDraft]);

  const updateDraft = (next) => {
    setDraft(normalizeLoreArticle(next));
    setDirty(true);
  };

  const createArticle = async () => {
    const article = createLoreArticleDraft({ category: category === "all" ? "history" : category }, {
      createId: () => `lore_${crypto.randomUUID()}`,
    });
    try {
      const id = await dataActions.lore.createDraft(campaignId, article);
      setSelectedId(id || article.id);
      setDraft(article);
      setDirty(false);
      setMode("edit");
      notifySuccess("Draft created");
    } catch (error) {
      notifyError(error);
    }
  };

  const editArticle = (article) => {
    setSelectedId(article.id);
    setDraft(normalizeLoreArticle(article));
    setDirty(false);
    setMode("edit");
  };

  const cloneArticle = async (article) => {
    try {
      const id = await dataActions.lore.cloneArticle(campaignId, article);
      setSelectedId(id);
      setMode("edit");
      notifySuccess("Article cloned");
    } catch (error) {
      notifyError(error);
    }
  };

  const publish = async () => {
    if (!draft) return;
    try {
      await persistDraft(draft);
      await dataActions.lore.publishArticle(campaignId, draft.id, {
        audience: draft.publication.audience,
        notify: notifyPlayers,
      });
      setPublishOpen(false);
      setMode("preview");
      notifySuccess(notifyPlayers ? "Published and players notified" : "Published silently");
    } catch {
      // persistDraft reports the actionable error.
    }
  };

  const retract = async (article = draft || selectedArticle) => {
    if (!article) return;
    try {
      await dataActions.lore.retractArticle(campaignId, article.id);
      notifySuccess("Player deliveries revoked");
    } catch (error) {
      notifyError(error);
    }
  };

  const archive = async (article = draft || selectedArticle) => {
    if (!article) return;
    const approved = await confirm({
      title: "Archive lore article",
      message: article.publication.status === "published"
        ? "Archive this article and revoke every Player delivery?"
        : "Archive this lore article?",
      confirmLabel: "Archive",
      danger: true,
    });
    if (!approved) return;
    try {
      await dataActions.lore.archiveArticle(campaignId, article.id);
      setMode("preview");
      notifySuccess("Article archived");
    } catch (error) {
      notifyError(error);
    }
  };

  const restore = async (article = draft || selectedArticle) => {
    if (!article) return;
    try {
      await dataActions.lore.restoreArticle(campaignId, article.id);
      notifySuccess("Article restored");
    } catch (error) {
      notifyError(error);
    }
  };

  const openMove = (article) => {
    setMoveTarget(article);
    setMoveGroupId(article.groupId || "");
  };

  const moveArticle = async () => {
    if (!moveTarget) return;
    try {
      await saveArticleRecord({ ...moveTarget, groupId: moveGroupId || null });
      setMoveTarget(null);
      notifySuccess("Article moved");
    } catch (error) {
      notifyError(error);
    }
  };

  const copyReference = (article) => {
    copyRef("lore", { ...article, name: article.title });
    notifySuccess("Lore reference copied");
  };

  const currentForDisplay = mode === "edit" ? draft : selectedArticle;
  const backlinks = currentForDisplay ? selectLoreBacklinks(articles, "lore", currentForDisplay.id) : [];
  const sharedNotes = (loreStore.sharedNotes || []).filter((note) => note.targetType === "loreArticle" && note.targetId === currentForDisplay?.id);
  const linkIssues = currentForDisplay ? linkIssuesById.get(currentForDisplay.id) || [] : [];
  const statusCounts = buildStatusCounts(articles, changedIds, linkIssuesById, loreStore.deliveries);

  return (
    <div className="lore-admin-workspace" data-testid="lore-admin-workspace">
      <header className="lore-admin-toolbar">
        <div className="lore-admin-search"><Search /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search title, text, tags, groups..." /></div>
        <Button variant="outline" onClick={() => setGroupDrawerOpen(true)}><FolderTree />Groups</Button>
        <Button data-testid="lore-new-article" onClick={createArticle}><Plus />New article</Button>
      </header>

      <div className="lore-admin-filters">
        <select value={category} onChange={(event) => setCategory(event.target.value)}><option value="all">All categories</option>{LORE_CATEGORIES.map((entry) => <option key={entry.id} value={entry.id}>{entry.label}</option>)}</select>
        <select value={groupId} onChange={(event) => setGroupId(event.target.value)}><option value="all">All groups</option>{groups.filter((group) => !group.archivedAt).map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select>
        <select value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">All states</option><option value="draft">Draft</option><option value="published">Published</option><option value="retracted">Retracted</option></select>
        <select value={audience} onChange={(event) => setAudience(event.target.value)}><option value="all">All audiences</option><option value="party">Whole party</option><option value="actors">Selected PCs</option></select>
        <select value={tag} onChange={(event) => setTag(event.target.value)}><option value="all">All tags</option>{tags.map((entry) => <option key={entry} value={entry}>{entry}</option>)}</select>
        <FilterToggle active={onlyChanged} onClick={() => setOnlyChanged((value) => !value)}>Changed</FilterToggle>
        <FilterToggle active={onlyBroken} onClick={() => setOnlyBroken((value) => !value)}>Broken links</FilterToggle>
        <FilterToggle active={onlyUngrouped} onClick={() => setOnlyUngrouped((value) => !value)}>Ungrouped</FilterToggle>
        <FilterToggle active={showArchived} onClick={() => setShowArchived((value) => !value)}>Archived</FilterToggle>
      </div>

      <div className="lore-admin-summary" aria-label="Lore status summary">
        <span><BookOpen />{statusCounts.total} articles</span>
        <span><Edit3 />{statusCounts.changed} changed</span>
        <span><Link2Off />{statusCounts.broken} with broken links</span>
        <span><Bell />{statusCounts.unreadDeliveries} unread releases</span>
        {loreStore.source !== "firestore" && <Badge variant="outline">{loreStore.source === "mixed" ? "Migration in progress" : "Recovery data"}</Badge>}
      </div>

      <main className={`lore-admin-main lore-admin-main--${mode}`}>
        <section className="lore-admin-table-panel">
          <div className="lore-admin-table-header"><span>Article</span><span>Status</span><span>Updated</span><span /></div>
          <div className="lore-admin-table-body">
            {filteredArticles.map((article) => (
              <ArticleContextMenu key={article.id} article={article} onPreview={() => { setSelectedId(article.id); setMode("preview"); }} onEdit={() => editArticle(article)} onClone={() => cloneArticle(article)} onPublish={() => { editArticle(article); setPublishOpen(true); }} onRetract={() => retract(article)} onMove={() => openMove(article)} onArchive={() => archive(article)} onRestore={() => restore(article)} onCopy={() => copyReference(article)}>
                <button type="button" data-testid={`lore-admin-row-${article.id}`} className={`lore-admin-row ${selectedId === article.id ? "selected" : ""}`} onClick={() => { setSelectedId(article.id); setMode("preview"); }} onDoubleClick={() => editArticle(article)}>
                  <span className="lore-admin-row__title"><strong>{article.title}</strong><small>{getLoreCategoryLabel(article.category)} · {groups.find((group) => group.id === article.groupId)?.name || "Ungrouped"}</small></span>
                  <span className="lore-admin-row__badges"><Badge variant={article.deletedAt ? "destructive" : "outline"}>{article.deletedAt ? "Archived" : article.publication.status}</Badge>{changedIds.has(article.id) && <Badge>Changed</Badge>}{(linkIssuesById.get(article.id) || []).some((entry) => !entry.valid) && <Badge variant="destructive">Broken link</Badge>}</span>
                  <span>{formatDate(article.updatedAt)}</span>
                  <MoreHorizontal />
                </button>
              </ArticleContextMenu>
            ))}
            {!filteredArticles.length && <div className="lore-admin-empty">No articles match the current filters.</div>}
          </div>
        </section>

        <section className="lore-admin-detail-panel">
          {mode === "edit" ? (
            <LoreArticleEditor
              draft={draft}
              onChange={updateDraft}
              articles={articles}
              groups={groups}
              pcActors={pcActors}
              db={db}
              saveStatus={saveStatus}
              linkIssues={linkIssues}
              backlinks={backlinks}
              sharedNotes={sharedNotes}
              onSaveNow={() => persistDraft()}
              onPublish={() => setPublishOpen(true)}
              onRetract={() => retract()}
              onArchive={() => archive()}
              onRestore={() => restore()}
            />
          ) : currentForDisplay ? (
            <div className="lore-admin-preview">
              <div className="lore-admin-preview__actions"><Button variant="outline" onClick={() => editArticle(currentForDisplay)}><Edit3 />Edit</Button><Button variant="outline" onClick={() => copyReference(currentForDisplay)}><Copy />Copy reference</Button>{currentForDisplay.publication.status !== "published" && <Button onClick={() => { editArticle(currentForDisplay); setPublishOpen(true); }}><Send />Publish</Button>}</div>
              <LoreArticleRenderer article={currentForDisplay} resolveReference={(reference) => resolveAdminReference(reference, articles, availableCreatureIds, (articleId) => { setSelectedId(articleId); setMode("preview"); })} />
              <ConnectionSummary backlinks={backlinks} linkIssues={linkIssues} sharedNotes={sharedNotes} />
            </div>
          ) : <div className="lore-admin-empty">Create or select an article.</div>}
        </section>
      </main>

      <LoreGroupDrawer open={groupDrawerOpen} onOpenChange={setGroupDrawerOpen} groups={groups} onSave={(group) => dataActions.lore.saveGroup(campaignId, group)} onArchive={(group) => dataActions.lore.archiveGroup(campaignId, group.id)} onMerge={(group, targetId) => dataActions.lore.mergeGroup(campaignId, group.id, targetId)} />

      <Dialog open={publishOpen} onOpenChange={setPublishOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Publish {draft?.title || "article"}</DialogTitle><DialogDescription>Publishing materializes a reveal-safe version for the selected audience.</DialogDescription></DialogHeader>
          <label className="lore-publish-notify"><input data-testid="lore-publish-notify" type="checkbox" checked={notifyPlayers} onChange={(event) => setNotifyPlayers(event.target.checked)} /><span><strong>Notify players</strong><small>Create a one-time popup and Knowledge badge for this version.</small></span></label>
          <DialogFooter><Button variant="outline" onClick={() => setPublishOpen(false)}>Cancel</Button><Button data-testid="lore-publish-confirm" onClick={publish}><Send />Publish</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(moveTarget)} onOpenChange={(open) => { if (!open) setMoveTarget(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Move {moveTarget?.title || "article"}</DialogTitle><DialogDescription>Select a group in the article's current category.</DialogDescription></DialogHeader>
          <label>Group
            <select value={moveGroupId} onChange={(event) => setMoveGroupId(event.target.value)}>
              <option value="">Ungrouped</option>
              {groups.filter((group) => group.category === moveTarget?.category && !group.archivedAt).map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
            </select>
          </label>
          <DialogFooter><Button variant="outline" onClick={() => setMoveTarget(null)}>Cancel</Button><Button onClick={moveArticle}><FolderInput />Move</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ArticleContextMenu({ article, children, onPreview, onEdit, onClone, onPublish, onRetract, onMove, onArchive, onRestore, onCopy }) {
  return <ContextMenu><ContextMenuTrigger asChild>{children}</ContextMenuTrigger><ContextMenuContent><ContextMenuItem onSelect={onPreview}><Eye />Preview</ContextMenuItem><ContextMenuItem onSelect={onEdit}><Edit3 />Edit</ContextMenuItem><ContextMenuItem onSelect={onClone}><Copy />Clone</ContextMenuItem><ContextMenuItem onSelect={onMove}><FolderInput />Move</ContextMenuItem><ContextMenuSeparator />{article.publication.status === "published" ? <ContextMenuItem onSelect={onRetract}><RotateCcw />Retract</ContextMenuItem> : <ContextMenuItem onSelect={onPublish}><Send />Publish</ContextMenuItem>}<ContextMenuItem onSelect={onCopy}><BookOpen />Copy reference</ContextMenuItem><ContextMenuSeparator />{article.deletedAt ? <ContextMenuItem onSelect={onRestore}><RotateCcw />Restore</ContextMenuItem> : <ContextMenuItem variant="destructive" onSelect={onArchive}><Archive />Archive</ContextMenuItem>}</ContextMenuContent></ContextMenu>;
}

function FilterToggle({ active, children, onClick }) {
  return <button type="button" className={`lore-filter-toggle ${active ? "active" : ""}`} onClick={onClick}>{children}</button>;
}

function ConnectionSummary({ backlinks, linkIssues, sharedNotes }) {
  return <aside className="lore-connection-summary"><h3>Connections</h3><p><strong>Backlinks:</strong> {backlinks.length ? backlinks.map((entry) => entry.title).join(", ") : "None"}</p><p><strong>Link checks:</strong> {linkIssues.length ? linkIssues.map((entry) => `${entry.label}${entry.valid ? "" : " (broken)"}`).join(", ") : "No links"}</p><div><strong>Shared player notes</strong>{sharedNotes.length ? sharedNotes.map((note) => <blockquote key={note.id}>{note.content}</blockquote>) : <p>None</p>}</div></aside>;
}

function hasUnpublishedChanges(article) {
  if (!article?.publishedSnapshot) return article?.publication?.version > 0 || article?.publication?.status === "draft";
  const current = normalizeLoreArticle(article);
  const comparable = {
    title: current.title, category: current.category, groupId: current.groupId, tags: current.tags,
    image: current.image, bodyBlocks: current.bodyBlocks, infobox: current.infobox,
    categoryData: current.categoryData, links: current.links,
  };
  return JSON.stringify(comparable) !== JSON.stringify(current.publishedSnapshot);
}

function buildStatusCounts(articles, changedIds, linkIssuesById, deliveries = []) {
  return {
    total: articles.filter((article) => !article.deletedAt).length,
    changed: changedIds.size,
    broken: articles.filter((article) => (linkIssuesById.get(article.id) || []).some((entry) => !entry.valid)).length,
    unreadDeliveries: deliveries.filter((delivery) => !delivery.revokedAt && Number(delivery.attentionVersion || 0) > Number(delivery.readVersion || 0)).length,
  };
}

function resolveAdminReference(reference, articles, availableCreatureIds, onOpenArticle) {
  if (reference.type === "lore") {
    const article = articles.find((entry) => entry.id === reference.id);
    return article ? { accessible: true, label: reference.label || article.title, onOpen: () => onOpenArticle(article.id) } : { accessible: false, label: reference.label };
  }
  if (reference.type === "creature") {
    const exists = availableCreatureIds.includes(reference.id);
    return { accessible: exists, label: reference.label };
  }
  return { accessible: false, label: reference.label };
}

function stripLegacyMarker(article) {
  const next = { ...normalizeLoreArticle(article) };
  delete next.legacyFallback;
  return next;
}

function formatDate(value) {
  const date = value ? new Date(value) : null;
  return date && Number.isFinite(date.getTime()) ? date.toLocaleDateString() : "—";
}
