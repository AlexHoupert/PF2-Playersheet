import React from "react";
import { BookOpen, Search, Skull } from "lucide-react";
import { Button } from "../../components/ui/button.jsx";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../../components/ui/dialog.jsx";
import { Input } from "../../components/ui/input.jsx";
import { selectCustomCreatureList } from "../../shared/db/selectors/bestiarySelectors.js";

export default function LoreReferencePicker({ open, onOpenChange, articles = [], db, onSelect }) {
  const [query, setQuery] = React.useState("");
  const [creatures, setCreatures] = React.useState([]);

  React.useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    import("../../shared/catalog/creatureIndex.js").then((module) => {
      if (!cancelled) setCreatures(module.getAllCreatures());
    });
    return () => { cancelled = true; };
  }, [open]);

  const customCreatures = selectCustomCreatureList(db).map((entry) => entry.data || entry);
  const needle = query.trim().toLowerCase();
  const options = [
    ...articles.map((article) => ({ type: "lore", id: article.id, label: article.title, meta: article.category })),
    ...[...creatures, ...customCreatures].map((creature) => ({
      type: "creature",
      id: creature.id || creature._id,
      label: creature.name,
      meta: `Level ${creature.level ?? creature.system?.details?.level?.value ?? "?"}`,
    })),
  ]
    .filter((entry) => entry.id && entry.label)
    .filter((entry) => !needle || `${entry.label} ${entry.meta}`.toLowerCase().includes(needle))
    .slice(0, 100);

  const choose = (entry) => {
    onSelect?.(entry, `[[${entry.type}:${entry.id}|${entry.label}]]`);
    onOpenChange?.(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80dvh] max-w-xl overflow-hidden bg-[#18181a] text-white">
        <DialogHeader><DialogTitle>Insert knowledge reference</DialogTitle></DialogHeader>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search articles and creatures..." className="pl-8" />
        </div>
        <div className="max-h-[58dvh] overflow-y-auto border-t border-white/10 pt-2">
          {options.map((entry) => (
            <Button
              key={`${entry.type}:${entry.id}`}
              data-testid={`lore-reference-option-${entry.type}-${entry.id}`}
              type="button"
              variant="ghost"
              className="h-auto w-full justify-start gap-3 px-2 py-2 text-left"
              onClick={() => choose(entry)}
            >
              {entry.type === "creature" ? <Skull /> : <BookOpen />}
              <span className="min-w-0 flex-1">
                <span className="block truncate">{entry.label}</span>
                <span className="block truncate text-xs text-muted-foreground">{entry.meta}</span>
              </span>
            </Button>
          ))}
          {!options.length && <div className="p-5 text-center text-sm text-muted-foreground">No references found.</div>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
