import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const rules = fs.readFileSync(new URL("../firestore.rules", import.meta.url), "utf8");
const stores = fs.readFileSync(new URL("../src/shared/lore/useLoreStores.js", import.meta.url), "utf8");

test("player lore subscriptions retain actor-constrained Firestore queries", () => {
  assert.match(stores, /V2_COLLECTIONS\.loreDeliveries[\s\S]*where\("actorId", "==", actorId\)/);
  assert.match(stores, /V2_COLLECTIONS\.knowledgeNotes[\s\S]*where\("actorId", "==", actorId\)/);
  assert.match(stores, /where\("sharedWithGm", "==", true\)/);
});

test("lore Firestore rules keep drafts private and owner fields immutable", () => {
  assert.match(rules, /match \/loreArticles\/\{articleId\}[\s\S]*allow read, write: if isCampaignGm/);
  assert.match(rules, /match \/loreDeliveries\/\{deliveryId\}[\s\S]*isAssignedActor\(campaignId, resource\.data\.actorId\)/);
  assert.match(rules, /affectedKeys\(\)\.hasOnly\(\[[\s\S]*'readVersion'[\s\S]*'notifiedVersion'/);
  assert.match(rules, /match \/knowledgeNotes\/\{noteId\}[\s\S]*request\.resource\.data\.actorId == resource\.data\.actorId/);
  assert.match(rules, /request\.resource\.data\.targetId == resource\.data\.targetId/);
  assert.match(rules, /request\.resource\.data\.targetType == resource\.data\.targetType/);
  assert.match(rules, /resource\.data\.sharedWithGm == true/);
});
