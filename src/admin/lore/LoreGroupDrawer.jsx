import React from "react";
import { Archive, FolderPlus, GitMerge, Pencil, Save } from "lucide-react";
import { Button } from "../../components/ui/button.jsx";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "../../components/ui/drawer.jsx";
import { Input } from "../../components/ui/input.jsx";
import { LORE_CATEGORIES, normalizeLoreGroup } from "../../shared/lore/loreModel.js";
import { buildLoreGroupTree } from "../../shared/lore/loreSelectors.js";

export default function LoreGroupDrawer({
  open,
  onOpenChange,
  groups = [],
  onSave,
  onArchive,
  onMerge,
}) {
  const [draft, setDraft] = React.useState(() => createEmptyGroup());
  const [mergeTargetId, setMergeTargetId] = React.useState("");
  const tree = React.useMemo(() => LORE_CATEGORIES.flatMap((category) => (
    flattenTree(buildLoreGroupTree(groups, category.id), 0)
  )), [groups]);

  const edit = (group) => {
    setDraft(normalizeLoreGroup(group));
    setMergeTargetId("");
  };

  const save = async () => {
    if (!draft.name.trim()) return;
    await onSave?.(draft);
    setDraft(createEmptyGroup(draft.category));
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="right">
      <DrawerContent className="lore-group-drawer">
        <DrawerHeader>
          <DrawerTitle>Knowledge groups</DrawerTitle>
          <DrawerDescription>Create nested groups without changing the fixed Knowledge categories.</DrawerDescription>
        </DrawerHeader>

        <div className="lore-group-drawer__body">
          <section className="lore-group-form">
            <label>Name<Input value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} /></label>
            <label>Category
              <select value={draft.category} onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value, parentId: null }))}>
                {LORE_CATEGORIES.map((category) => <option key={category.id} value={category.id}>{category.label}</option>)}
              </select>
            </label>
            <label>Parent
              <select value={draft.parentId || ""} onChange={(event) => setDraft((current) => ({ ...current, parentId: event.target.value || null }))}>
                <option value="">No parent</option>
                {groups.filter((group) => group.category === draft.category && group.id !== draft.id && !group.archivedAt).map((group) => (
                  <option key={group.id} value={group.id}>{group.name}</option>
                ))}
              </select>
            </label>
            <label>Order<Input type="number" value={draft.sortOrder || 0} onChange={(event) => setDraft((current) => ({ ...current, sortOrder: Number(event.target.value) || 0 }))} /></label>
            <div className="lore-group-form__actions">
              <Button variant="outline" onClick={() => setDraft(createEmptyGroup(draft.category))}><FolderPlus />New</Button>
              <Button onClick={save}><Save />Save group</Button>
            </div>
          </section>

          <section className="lore-group-list">
            {tree.map(({ group, depth }) => (
              <div key={group.id} className="lore-group-row" style={{ paddingLeft: 12 + depth * 16 }}>
                <span className="lore-group-row__main">
                  <strong>{group.name}</strong>
                  <small>{group.category}</small>
                </span>
                <Button size="icon-xs" variant="ghost" title="Edit group" onClick={() => edit(group)}><Pencil /></Button>
                <Button size="icon-xs" variant="ghost" title="Archive group" onClick={() => onArchive?.(group)}><Archive /></Button>
              </div>
            ))}
          </section>

          {draft.id && (
            <section className="lore-group-merge">
              <label>Merge <strong>{draft.name}</strong> into
                <select value={mergeTargetId} onChange={(event) => setMergeTargetId(event.target.value)}>
                  <option value="">Select target...</option>
                  {groups.filter((group) => group.id !== draft.id && group.category === draft.category && !group.archivedAt).map((group) => (
                    <option key={group.id} value={group.id}>{group.name}</option>
                  ))}
                </select>
              </label>
              <Button variant="outline" disabled={!mergeTargetId} onClick={() => onMerge?.(draft, mergeTargetId)}><GitMerge />Merge group</Button>
            </section>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}

function createEmptyGroup(category = "history") {
  return { name: "", category, parentId: null, sortOrder: 0 };
}

function flattenTree(nodes, depth) {
  return nodes.flatMap((group) => [
    { group, depth },
    ...flattenTree(group.children || [], depth + 1),
  ]);
}
