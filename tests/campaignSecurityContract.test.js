import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const rules = fs.readFileSync(new URL("../firestore.rules", import.meta.url), "utf8");
const app = fs.readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");

test("admin query parameter selects a route but does not bypass capabilities", () => {
  assert.match(app, /route === 'admin' && !capabilities\?\.canAccessAdmin/);
  assert.match(app, /data-testid="route-access-denied"/);
});

test("campaign Firestore contract encodes member roles and scoped writes", () => {
  assert.match(rules, /memberData\(campaignId\)\.role in \['gm', 'admin'\]/);
  assert.match(rules, /memberData\(campaignId\)\.role == 'assistant_gm'/);
  assert.match(rules, /memberData\(campaignId\)\.role == 'trusted_player'/);
  assert.match(rules, /!isSpectator\(campaignId\) && isAssignedActor/);
  assert.match(rules, /match \/members\/\{email\}[\s\S]*allow create, update, delete: if isCampaignGm/);
  assert.match(rules, /match \/catalogEntries\/\{entryId\}[\s\S]*request\.resource\.data\.mode == 'custom'[\s\S]*request\.resource\.data\.ownerEmail == request\.auth\.token\.email/);
  assert.match(rules, /match \/catalogChangeEvents\/\{eventId\}[\s\S]*allow delete: if false/);
  assert.match(rules, /match \/effectRequests\/\{requestId\}[\s\S]*isAssignedActor\(campaignId, request\.resource\.data\.sourceActorId\)/);
  assert.match(rules, /canApplyEffectFromAssignedActor\(campaignId\)/);
  assert.match(rules, /exists\(\/databases\/\$\(database\)\/documents\/campaigns\/\$\(campaignId\)\/actors\/\$\(request\.resource\.data\.targetActorId\)\)/);
  assert.match(rules, /match \/loreContributions\/\{contributionId\}[\s\S]*request\.resource\.data\.isPlayerContribution == true/);
});
