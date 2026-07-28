import assert from "node:assert/strict";
import test from "node:test";

import { createDataActions } from "../src/shared/db/domain/createDataActions.js";

const firestore = { app: { options: { projectId: "test-project" } } };

function createHarness(role) {
  const calls = [];
  const actions = createDataActions({
    actorEmail: "gm@example.test",
    campaignId: "campaign",
    db: {},
    firestore,
    memberRole: role,
    mode: "firestore-v2",
    repositories: {
      memberRepo: {
        async setRole(_firestore, campaignId, email, nextRole) {
          calls.push({ campaignId, email, role: nextRole });
        },
        async updateSettings(_firestore, campaignId, email, settings) {
          calls.push({ campaignId, email, settings });
        },
      },
    },
  });
  return { actions, calls };
}

test("campaign GM changes a normalized member role through the targeted repository", async () => {
  const { actions, calls } = createHarness("gm");

  await actions.member.setRole("campaign", " Player@Example.Test ", "trusted_player");

  assert.deepEqual(calls, [{
    campaignId: "campaign",
    email: "player@example.test",
    role: "trusted_player",
  }]);
});

test("player cannot change campaign member roles", async () => {
  const { actions, calls } = createHarness("player");

  await assert.rejects(
    () => actions.member.setRole("campaign", "other@example.test", "gm"),
    /Only a campaign GM/
  );
  assert.deepEqual(calls, []);
});

test("member stores normalized personal settings through a targeted self update", async () => {
  const { actions, calls } = createHarness("player");

  await actions.member.updateOwnSettings("campaign", {
    skillProficiencyDisplay: "STARS",
    loopPages: false,
  });

  assert.deepEqual(calls, [{
    campaignId: "campaign",
    email: "gm@example.test",
    settings: {
      skillProficiencyDisplay: "stars",
      loopPages: false,
    },
  }]);
});
