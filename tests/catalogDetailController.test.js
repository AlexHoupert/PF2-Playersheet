import test from "node:test";
import assert from "node:assert/strict";
import {
  inferCatalogEntityType,
  resolveCatalogSourceFile,
  resolveContentLink,
  shouldFetchCatalogDetail,
} from "../src/shared/catalog/catalogDetailCore.js";

const fakeIndex = {
  action: { Strike: { sourceFile: "actions/strike.json" } },
  item: { "Alchemist's Fire (Lesser)": { sourceFile: "equipment/alchemists-fire-lesser.json" } },
  spell: { "Uplifting Overture": { sourceFile: "spells/uplifting-overture.json" } },
};

const findIndexItemByType = (type, name) => fakeIndex[type]?.[name] || null;

test("catalog detail controller infers entity type and source file", () => {
  assert.equal(inferCatalogEntityType({ _entityType: "spell" }, "item"), "spell");
  assert.equal(inferCatalogEntityType({ type: "Impulse" }, "item"), "impulse");
  assert.equal(
    resolveCatalogSourceFile({ name: "Uplifting Overture", _entityType: "spell" }, "item", findIndexItemByType)?.includes(
      "uplifting-overture"
    ),
    true
  );
  assert.equal(
    resolveCatalogSourceFile({ name: "Alchemist's Fire (Lesser)" }, "item", findIndexItemByType)?.includes("alchemists-fire-lesser"),
    true
  );
});

test("catalog detail controller decides when indexed details should load", () => {
  assert.equal(
    shouldFetchCatalogDetail(
      { name: "Uplifting Overture", _entityType: "spell", description: "short" },
      "item",
      findIndexItemByType
    ),
    true
  );
  assert.equal(
    shouldFetchCatalogDetail(
      { name: "Alchemist's Fire (Lesser)", description: "short" },
      "item",
      findIndexItemByType
    ),
    false
  );
  assert.equal(shouldFetchCatalogDetail({ name: "Alchemist's Fire (Lesser)" }, "item", findIndexItemByType), true);
});

test("catalog detail controller resolves content links", () => {
  const action = resolveContentLink("action", "Strike", findIndexItemByType);
  assert.equal(action.type, "action");
  assert.equal(action.modalMode, "item");
  assert.equal(action.sourceFile, "actions/strike.json");

  const condition = resolveContentLink("condition", "Frightened", findIndexItemByType);
  assert.equal(condition.type, "condition");
  assert.equal(condition.modalMode, "conditionInfo");
  assert.equal(condition.sourceFile, null);
});
