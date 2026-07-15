import React from "react";
import { Badge } from "../../components/ui/badge.jsx";
import { getLoreCategoryLabel, parseLoreReference } from "./loreModel.js";
import "./lore.css";

export default function LoreArticleRenderer({
  article,
  resolveReference,
  onOpenReference,
  showMeta = true,
  emptyText = "No information has been published yet.",
}) {
  if (!article) return <div className="lore-empty-state">{emptyText}</div>;
  const blocks = Array.isArray(article.bodyBlocks) ? article.bodyBlocks : [];
  return (
    <article className="lore-reader lore-article-renderer">
      <header className="lore-reader__header">
        <div>
          {showMeta && <span className="lore-reader__eyebrow">{getLoreCategoryLabel(article.category)}</span>}
          <h1>{article.title}</h1>
        </div>
        {article.image && <img className="lore-reader__portrait" src={article.image} alt="" />}
      </header>

      <LoreCategoryMetadata
        article={article}
        resolveReference={resolveReference}
        onOpenReference={onOpenReference}
      />

      {article.infobox?.length > 0 && (
        <dl className="lore-reader__infobox">
          {article.infobox.map((row) => (
            <div key={row.id || row.label}>
              <dt>{row.label}</dt>
              <dd>{renderInline(row.value, resolveReference, onOpenReference)}</dd>
            </div>
          ))}
        </dl>
      )}

      <div className="lore-reader__body">
        {blocks.length === 0 && <div className="lore-empty-state">{emptyText}</div>}
        {blocks.map((block) => (
          <section
            key={block.id}
            className={`lore-reader__block ${block.type === "reveal" ? "lore-reader__block--reveal" : ""}`}
          >
            {block.type === "reveal" && <span className="lore-reader__reveal-label">Revealed knowledge</span>}
            {renderLoreMarkup(block.content, resolveReference, onOpenReference)}
          </section>
        ))}
      </div>

      {article.tags?.length > 0 && (
        <footer className="lore-reader__tags">
          {article.tags.map((tag) => <Badge key={tag} variant="outline">#{tag}</Badge>)}
        </footer>
      )}
    </article>
  );
}

function LoreCategoryMetadata({ article, resolveReference, onOpenReference }) {
  const data = article.categoryData || {};
  const rows = [];

  if (article.category === "history" && data.dateLabel) {
    rows.push({ label: "Date", value: data.dateLabel });
  }
  if (article.category === "locations") {
    if (data.region) rows.push({ label: "Region", value: data.region });
    if (data.parentLocationId) {
      rows.push({
        label: "Parent location",
        value: `[[lore:${data.parentLocationId}|Open location]]`,
      });
    }
  }
  if (article.category === "npcs") {
    if (data.role) rows.push({ label: "Role", value: data.role });
    if (data.status) rows.push({ label: "Status", value: data.status });
    if (data.faction) rows.push({ label: "Faction", value: data.faction });
    if (data.locationId) {
      rows.push({
        label: "Location",
        value: `[[lore:${data.locationId}|Open location]]`,
      });
    }
  }

  if (!rows.length) return null;
  return (
    <dl className="lore-reader__category-meta">
      {rows.map((row) => (
        <div key={row.label}>
          <dt>{row.label}</dt>
          <dd>{renderInline(row.value, resolveReference, onOpenReference)}</dd>
        </div>
      ))}
    </dl>
  );
}

export function renderLoreMarkup(content, resolveReference, onOpenReference) {
  const lines = String(content || "").split("\n");
  return lines.map((line, index) => {
    const key = `${index}-${line.slice(0, 20)}`;
    if (!line.trim()) return <div key={key} className="lore-reader__spacer" aria-hidden="true" />;
    if (line.trim() === "---") return <hr key={key} />;
    if (line.startsWith("## ")) return <h3 key={key}>{renderInline(line.slice(3), resolveReference, onOpenReference)}</h3>;
    if (line.startsWith("# ")) return <h2 key={key}>{renderInline(line.slice(2), resolveReference, onOpenReference)}</h2>;
    return <p key={key}>{renderInline(line, resolveReference, onOpenReference)}</p>;
  });
}

export function renderInline(content, resolveReference, onOpenReference) {
  const parts = String(content || "").split(/(\[\[[^\]]+\]\]|\*\*[^*]+\*\*|\*[^*]+\*|\{\{[^}]+\}\})/g);
  return parts.map((part, index) => {
    const key = `${index}-${part.slice(0, 10)}`;
    if (part.startsWith("[[") && part.endsWith("]]")) {
      const reference = parseLoreReference(part.slice(2, -2));
      const resolved = reference ? resolveReference?.(reference) : null;
      const accessible = Boolean(resolved?.accessible);
      return (
        <button
          key={key}
          type="button"
          className={`lore-reference ${accessible ? "" : "lore-reference--locked"}`}
          disabled={!accessible}
          title={accessible ? resolved.title || reference.label : "This information has not been revealed."}
          onClick={() => {
            if (!accessible) return;
            if (onOpenReference) onOpenReference(resolved, reference);
            else resolved?.onOpen?.();
          }}
        >
          {reference?.label || part.slice(2, -2)}
        </button>
      );
    }
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={key}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("*") && part.endsWith("*")) return <em key={key}>{part.slice(1, -1)}</em>;
    if (part.startsWith("{{") && part.endsWith("}}")) return <strong key={key} className="lore-gold-text">{part.slice(2, -2)}</strong>;
    return <React.Fragment key={key}>{part}</React.Fragment>;
  });
}
