import { expect, test } from "@playwright/test";

test.setTimeout(60_000);

async function gotoFixture(page, params = "") {
  const query = params ? `&${params.replace(/^&/, "")}` : "";
  await page.goto(`/?e2e=true&e2eReset=true${query}`, { waitUntil: "domcontentloaded" });
}

async function reloadFixture(page, params = "") {
  const query = params ? `&${params.replace(/^&/, "")}` : "";
  await page.goto(`/?e2e=true${query}`, { waitUntil: "domcontentloaded" });
}

async function showCharacterTabs(page) {
  if ((await page.getByRole("button", { name: /ITEMS/i }).count()) === 0) {
    await page.getByTestId("player-mode-toggle").click();
    await expect(page.getByRole("button", { name: /ITEMS/i })).toBeVisible();
  }
}

async function showStoryTabs(page) {
  if ((await page.getByRole("button", { name: /QUESTS/i }).count()) === 0) {
    await page.getByTestId("player-mode-toggle").click();
    await expect(page.getByRole("button", { name: /QUESTS/i })).toBeVisible();
  }
}

async function readFixtureXp(page) {
  return page.evaluate(() => {
    const db = JSON.parse(localStorage.getItem("pf2:e2e-runtime-db") || "{}");
    const actor = db.campaigns?.e2e_campaign?.actors?.find?.((entry) => entry.id === "e2e_actor_nimwe");
    return actor?.xp?.current ?? null;
  });
}

test("auth gate renders without fixture bypass", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded", timeout: 60_000 });
  await expect(page.getByText("PF2e Player Sheet")).toBeVisible();
  await expect(page.getByText("Sign in with Google")).toBeVisible();
});

test("player fixture route loads character, quests, loot, shop, and spell override", async ({ page }) => {
  await gotoFixture(page);
  await expect(page.getByTestId("player-route")).toBeVisible();
  await expect(page.getByText("Nimwe Smoke")).toBeVisible();

  await showStoryTabs(page);
  await page.getByRole("button", { name: /QUESTS/i }).click();
  await expect(page.getByText("Smoke Test Quest")).toBeVisible();

  await showCharacterTabs(page);
  await page.getByRole("button", { name: /ITEMS/i }).click();
  await page.getByRole("button", { name: /Loot/i }).click();
  await expect(page.getByText("Smoke Loot")).toBeVisible();
  await expect(page.getByText("Healing Potion (Minor)")).toBeVisible();

  await page.getByRole("button", { name: /MAGIC/i }).click();
  await expect(page.getByText("Uplifting Overture")).toBeVisible();

  await page.getByRole("button", { name: /ITEMS/i }).click();
  await page.getByRole("button", { name: /\+ Open Shop/i }).click();
  await expect(page.getByText("Show all available Items")).toBeVisible();
});

test("admin fixture route loads campaign, player, items, quests, and encounter surfaces", async ({ page }) => {
  await gotoFixture(page, "admin=true");
  await expect(page.getByTestId("admin-route")).toBeVisible();
  await expect(page.getByRole("heading", { name: "E2E Smoke Campaign", exact: true })).toBeVisible();

  await page.getByText("Players", { exact: true }).click();
  await expect(page.getByText("Nimwe Smoke")).toBeVisible();

  await page.getByText("Items", { exact: true }).click();
  await page.getByRole("button", { name: "Loot" }).click();
  await expect(page.getByText("Smoke Loot")).toBeVisible();

  await page.getByText("Quests", { exact: true }).click();
  await expect(page.getByText("Smoke Test Quest")).toBeVisible();

  await page.getByText("Encounters", { exact: true }).click();
  await expect(page.getByRole("heading", { name: "Smoke Encounter" }).first()).toBeVisible();
  await expect(page.getByText("Smoke Goblin", { exact: true })).toBeVisible();
});

test("player HP, gold, and condition edits survive reload in fixture runtime", async ({ page }) => {
  await gotoFixture(page);
  await expect(page.getByTestId("player-route")).toBeVisible();

  await page.getByTestId("player-health-bar").click();
  await page.getByTestId("hp-modal-input").fill("21");
  await page.getByTestId("hp-modal-set").click();
  await expect(page.getByTestId("player-health-text")).toContainText(/21\s*\/\s*30/);

  await page.getByTestId("player-gold-display").click();
  await page.getByTestId("gold-modal-input").fill("15");
  await page.getByTestId("gold-modal-set").click();
  await expect(page.getByTestId("player-gold-display")).toContainText("15.00");

  await page.getByTestId("condition-badge-frightened").click();
  await page.getByTestId("condition-list-plus-frightened").click();
  await page.getByRole("button", { name: "Close" }).click();
  await expect(page.getByTestId("condition-badge-frightened")).toContainText("Frightened 2");

  await reloadFixture(page);
  await expect(page.getByTestId("player-health-text")).toContainText(/21\s*\/\s*30/);
  await expect(page.getByTestId("player-gold-display")).toContainText("15.00");
  await expect(page.getByTestId("condition-badge-frightened")).toContainText("Frightened 2");
});

test("player loot claim and gold split persist without losing remaining state", async ({ page }) => {
  await gotoFixture(page, "playerMode=character&playerTab=items");
  await page.getByRole("button", { name: /ITEMS/i }).click();
  await page.getByTestId("inventory-tab-loot").click();

  await expect(page.getByTestId("loot-bag-e2e_loot")).toBeVisible();
  await page.getByTestId("loot-claim-item-e2e_loot_item").click();
  await expect(page.getByTestId("loot-claim-item-e2e_loot_item")).toHaveCount(0);

  await page.getByTestId("loot-split-gold-e2e_loot").click();
  await page.getByTestId("app-feedback-confirm").click();
  await expect(page.getByTestId("loot-gold-e2e_loot")).toHaveCount(0);

  await reloadFixture(page, "playerMode=character&playerTab=items");
  await page.getByRole("button", { name: /ITEMS/i }).click();
  await page.getByRole("button", { name: /Consumables/i }).click();
  await expect(page.getByText("Healing Potion (Minor)")).toBeVisible();
  await expect(page.getByTestId("player-gold-display")).toContainText("17.00");
});

test("GM creates lootbag and gives custom item that player sees after reload", async ({ page }) => {
  await gotoFixture(page, "admin=true");
  await page.getByText("Items", { exact: true }).click();

  await page.getByTestId("gm-items-side-loot").click();
  await page.getByTestId("gm-items-create-loot").click();
  await page.getByTestId("app-feedback-input").fill("Smoke Created Loot");
  await page.getByTestId("app-feedback-confirm").click();
  await expect(page.getByText("Smoke Created Loot", { exact: true })).toBeVisible();

  await page.getByPlaceholder("Search items...").fill("Smoke Custom Charm");
  const customItemRow = page.getByTestId("gm-item-row-smoke-custom-charm");
  await expect(customItemRow).toBeVisible();
  await customItemRow.click({ button: "right" });
  await page.getByTestId("gm-items-give-to-player").hover();
  await page.getByTestId("gm-items-give-player-e2e_actor_nimwe").click();

  await reloadFixture(page, "playerMode=character&playerTab=items");
  await page.getByRole("button", { name: /ITEMS/i }).click();
  await expect(page.getByText("Smoke Custom Charm")).toBeVisible();
});

test("quest reward toggle is idempotent across reload", async ({ page }) => {
  await gotoFixture(page, "admin=true");
  await page.getByText("Quests", { exact: true }).click();
  await page.getByTestId("quest-summary-e2e_quest").click();
  await page.getByTestId("quest-objective-e2e_quest-0").click();
  await page.getByTestId("app-feedback-confirm").click();

  await reloadFixture(page, "admin=true");
  await expect(page.getByTestId("admin-route")).toBeVisible();
  await expect(await readFixtureXp(page)).toBe(120);

  await page.getByText("Quests", { exact: true }).click();
  await page.getByTestId("quest-summary-e2e_quest").click();
  await page.getByTestId("quest-objective-e2e_quest-0").click();
  await page.getByTestId("app-feedback-confirm").click();
  await page.getByTestId("quest-objective-e2e_quest-0").click();
  await page.getByTestId("app-feedback-confirm").click();

  await reloadFixture(page, "admin=true");
  await expect(await readFixtureXp(page)).toBe(120);
});

test("encounter player and creature combatants accept HP, initiative, and effect edits", async ({ page }) => {
  await gotoFixture(page, "admin=true");
  await page.getByText("Encounters", { exact: true }).click();

  await page.getByTestId("initiative-hp-combatant_creature").click();
  await page.getByTestId("initiative-hp-input-combatant_creature").fill("5");
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("initiative-hp-combatant_creature")).toContainText("5/8");

  await page.getByTestId("initiative-badge-combatant_creature").click();
  await page.getByTestId("initiative-input-combatant_creature").fill("16");
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("initiative-badge-combatant_creature")).toContainText("16");

  await page.getByTestId("initiative-card-combatant_creature").click({ button: "right" });
  await page.getByTestId("encounter-add-condition").click();
  await page.getByTestId("encounter-condition-option-clumsy").click();
  await expect(page.getByTestId("initiative-condition-combatant_creature-clumsy")).toBeVisible();

  await page.getByTestId("initiative-card-combatant_player").click({ button: "right" });
  await page.getByTestId("encounter-add-custom-condition").click();
  await page.getByTestId("encounter-custom-condition-input").fill("Blessed by Smoke");
  await page.getByTestId("encounter-custom-condition-add").click();
  await expect(page.getByTestId("initiative-condition-combatant_player-blessed-by-smoke")).toBeVisible();

  await reloadFixture(page, "admin=true");
  await page.getByText("Encounters", { exact: true }).click();
  await expect(page.getByTestId("initiative-hp-combatant_creature")).toContainText("5/8");
  await expect(page.getByTestId("initiative-badge-combatant_creature")).toContainText("16");
  await expect(page.getByTestId("initiative-condition-combatant_creature-clumsy")).toBeVisible();
  await expect(page.getByTestId("initiative-condition-combatant_player-blessed-by-smoke")).toBeVisible();
});

test("spell catalog override appears in player add-spell flow at rank zero", async ({ page }) => {
  await gotoFixture(page);
  await page.getByRole("button", { name: /MAGIC/i }).click();
  await page.getByTestId("magic-add-spell").click();
  await page.getByPlaceholder("Search...").fill("Uplifting Overture");

  const row = page.locator(".item-row", { hasText: "Uplifting Overture" }).first();
  await expect(row).toBeVisible();
  await expect(row).toContainText("Lv0");
});
