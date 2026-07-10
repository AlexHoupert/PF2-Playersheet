import { expect, test } from "@playwright/test";

test.setTimeout(120_000);

const UPLIFTING_OVERTURE_ROW_ID = "spells-focus-uplifting-overture-json";
const AID_ROW_ID = "actions-aid-json";

async function gotoFixture(page, params = "") {
  const query = params ? `&${params.replace(/^&/, "")}` : "";
  await page.goto(`/?e2e=true&e2eReset=true${query}`, { waitUntil: "commit" });
}

async function reloadFixture(page, params = "") {
  const query = params ? `&${params.replace(/^&/, "")}` : "";
  await page.goto(`/?e2e=true${query}`, { waitUntil: "commit" });
}

async function openPlayerCategory(page, name) {
  await page.getByRole("button", { name: new RegExp(`^${name}`, "i") }).first().click();
}

async function openPlayerPage(page, categoryName, pageId) {
  await openPlayerCategory(page, categoryName);
  await page.getByTestId(`player-carousel-page-${pageId}`).click();
}

async function readFixtureXp(page) {
  return page.evaluate(() => {
    const db = JSON.parse(localStorage.getItem("pf2:e2e-runtime-db") || "{}");
    const actor = db.campaigns?.e2e_campaign?.actors?.find?.((entry) => entry.id === "e2e_actor_nimwe");
    return actor?.xp?.current ?? null;
  });
}

async function expectFixtureRoute(page, route) {
  await expect(page.getByTestId(`${route}-route`)).toBeVisible({ timeout: 120_000 });
}

test("auth gate renders without fixture bypass", async ({ page }) => {
  await page.goto("/?e2eAuthGate=true", { waitUntil: "domcontentloaded", timeout: 120_000 });
  await expect(page.getByText("PF2e Player Sheet")).toBeVisible();
  await expect(page.getByText("Sign in with Google")).toBeVisible();
});

test("player fixture route loads character, quests, loot, shop, and spell override", async ({ page }) => {
  test.slow();
  await gotoFixture(page);
  await expectFixtureRoute(page, "player");
  await expect(page.getByText("Nimwe Smoke")).toBeVisible();

  await openPlayerPage(page, "Campaign", "campaign.quests");
  await expect(page.getByText("Smoke Test Quest")).toBeVisible();

  await openPlayerPage(page, "Items", "items.loot");
  await expect(page.getByText("Smoke Loot")).toBeVisible();
  await expect(page.getByText("Healing Potion (Minor)")).toBeVisible();

  await openPlayerPage(page, "Character", "character.magic");
  await expect(page.getByText("Uplifting Overture")).toBeVisible();

  await openPlayerPage(page, "Items", "items.equipment");
  await page.getByRole("button", { name: /\+ Open Shop/i }).first().click();
  await expect(page.getByText("Show all available Items")).toBeVisible();
});

test("admin fixture route loads campaign, player, items, quests, and encounter surfaces", async ({ page }) => {
  await gotoFixture(page, "admin=true");
  await expectFixtureRoute(page, "admin");
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
  await expectFixtureRoute(page, "player");

  await page.getByTestId("player-health-bar").click();
  await page.getByTestId("hp-modal-input").fill("21");
  await page.getByTestId("hp-modal-set").click();
  await expect(page.getByTestId("player-health-text")).toContainText(/21\s*\/\s*30/);

  await page.getByTestId("player-gold-display").click();
  await page.getByTestId("gold-modal-input").fill("15");
  await page.getByTestId("gold-modal-set").click();
  await expect(page.getByTestId("player-gold-display")).toContainText("15.00");

  await page.getByRole("button", { name: /Frightened/i }).click();
  await page.getByTestId("condition-detail-increase-frightened").click();
  await page.getByRole("button", { name: "Close" }).click();
  await expect(page.getByRole("button", { name: /Frightened 2/i })).toBeVisible();

  await reloadFixture(page);
  await expect(page.getByTestId("player-health-text")).toContainText(/21\s*\/\s*30/);
  await expect(page.getByTestId("player-gold-display")).toContainText("15.00");
  await expect(page.getByRole("button", { name: /Frightened 2/i })).toBeVisible();
});

test("persistent damage is removable by its player and hidden encounter effects stay out of Party view", async ({ page }) => {
  await gotoFixture(page, "admin=true");
  await page.getByText("Encounters", { exact: true }).click();

  await page.getByTestId("initiative-card-combatant_player").click({ button: "right" });
  await page.getByTestId("encounter-add-persistent-damage").click();
  await page.getByTestId("encounter-persistent-add").click();
  await expect(page.getByText("1d6 fire persistent", { exact: true })).toBeVisible();

  await page.getByTestId("initiative-card-combatant_player").click({ button: "right" });
  await page.getByTestId("encounter-add-custom-condition").click();
  await page.getByTestId("encounter-custom-condition-input").fill("GM Only Mark");
  await page.getByLabel("Share with party").click();
  await page.getByTestId("encounter-custom-condition-add").click();
  await expect(page.getByText("GM Only Mark", { exact: true })).toBeVisible();

  await page.getByTestId("initiative-card-combatant_creature").click({ button: "right" });
  await page.getByTestId("encounter-set-defeated").click();
  await expect(page.getByTestId("initiative-card-combatant_creature")).toContainText("Defeated");

  await page.goto("/?e2e=true&party=true", { waitUntil: "domcontentloaded" });
  await expectFixtureRoute(page, "party");
  await expect(page.getByTestId("initiative-card-combatant_creature")).toHaveCount(0);
  await expect(page.getByText("1d6 fire persistent", { exact: true })).toBeVisible();
  await expect(page.getByText("GM Only Mark", { exact: true })).toHaveCount(0);

  await page.goto("/?e2e=true", { waitUntil: "domcontentloaded" });
  await expectFixtureRoute(page, "player");
  await page.getByRole("button", { name: /1d6 fire persistent/i }).click();
  await expect(page.getByText(/Persistent damage is taken at the end/i)).toBeVisible();
  await page.getByRole("button", { name: "Remove" }).click();
  await expect(page.getByRole("button", { name: /1d6 fire persistent/i })).toHaveCount(0);
});

test("player loot claim and gold split persist without losing remaining state", async ({ page }) => {
  await gotoFixture(page, "playerMode=character&playerTab=items");
  await openPlayerPage(page, "Items", "items.loot");

  await expect(page.getByTestId("loot-bag-e2e_loot")).toBeVisible();
  await page.getByTestId("loot-claim-item-e2e_loot_item").click();
  await expect(page.getByTestId("loot-claim-item-e2e_loot_item")).toHaveCount(0);

  await page.getByTestId("loot-split-gold-e2e_loot").click();
  await page.getByTestId("app-feedback-confirm").click();
  await expect(page.getByTestId("loot-gold-e2e_loot")).toHaveCount(0);

  await reloadFixture(page, "playerMode=character&playerTab=items");
  await openPlayerPage(page, "Items", "items.consumables");
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
  await openPlayerPage(page, "Items", "items.equipment");
  await expect(page.getByText("Smoke Custom Charm")).toBeVisible();
});

test("quest reward toggle is idempotent across reload", async ({ page }) => {
  await gotoFixture(page, "admin=true");
  await page.getByText("Quests", { exact: true }).click();
  await page.getByTestId("quest-summary-e2e_quest").click();
  await page.getByTestId("quest-objective-e2e_quest-0").click();
  await page.getByTestId("app-feedback-confirm").click();

  await reloadFixture(page, "admin=true");
  await expectFixtureRoute(page, "admin");
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
  await page.getByTestId("initiative-remove-condition-combatant_creature-clumsy").click();
  await expect(page.getByTestId("initiative-condition-combatant_creature-clumsy")).toHaveCount(0);
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
  await openPlayerPage(page, "Character", "character.magic");
  await page.getByTestId("magic-add-spell").click();
  await page.getByPlaceholder("Search...").fill("Uplifting Overture");

  const row = page.locator(".item-row", { hasText: "Uplifting Overture" }).first();
  await expect(row).toBeVisible();
  await expect(row).toContainText("Lv0");
});

test("admin spell edit refreshes the catalog row and copy reference is available", async ({ page }) => {
  await gotoFixture(page, "admin=true");
  await page.getByText("Spells", { exact: true }).click();
  await expect(page.getByTestId("catalog-admin-spell")).toBeVisible();

  await page.getByTestId("catalog-search-spell").fill("Uplifting Overture");
  const spellRow = page.getByTestId(`catalog-row-spell-${UPLIFTING_OVERTURE_ROW_ID}`);
  await expect(spellRow).toBeVisible();
  await expect(page.getByTestId(`catalog-cell-spell-${UPLIFTING_OVERTURE_ROW_ID}-level`)).toContainText("0");

  await spellRow.click({ button: "right" });
  await page.getByTestId("catalog-action-spell-edit").click();
  await expect(page.getByRole("heading", { name: "Edit Spell" })).toBeVisible();
  await page.getByTestId("spell-editor-level").fill("2");
  await page.getByTestId("spell-editor-save").click();

  await expect(page.getByTestId("catalog-admin-spell")).toBeVisible();
  await expect(page.getByTestId(`catalog-row-spell-${UPLIFTING_OVERTURE_ROW_ID}`)).toHaveCount(1);
  await expect(page.getByTestId(`catalog-cell-spell-${UPLIFTING_OVERTURE_ROW_ID}-level`)).toContainText("2");

  await page.getByTestId(`catalog-row-spell-${UPLIFTING_OVERTURE_ROW_ID}`).click({ button: "right" });
  await page.getByTestId("catalog-action-spell-copyReference").click();
  await expect(page.getByText(/Reference copied: Uplifting Overture/)).toBeVisible();
});

test("admin catalog table toolbar, drawer, and context menu keep stable layout", async ({ page }) => {
  await gotoFixture(page, "admin=true");
  await page.getByText("Spells", { exact: true }).click();
  await expect(page.getByTestId("catalog-admin-spell")).toBeVisible();

  const toolbar = page.locator("[data-admin-table-toolbar]");
  const tableSurface = page.locator("[data-admin-table-surface]");
  await expect(toolbar).toBeVisible();
  await expect(tableSurface).toBeVisible();

  const toolbarBox = await toolbar.boundingBox();
  const tableBox = await tableSurface.boundingBox();
  expect(toolbarBox).not.toBeNull();
  expect(tableBox).not.toBeNull();
  expect(toolbarBox.y + toolbarBox.height).toBeLessThanOrEqual(tableBox.y);
  expect(toolbarBox.height).toBeLessThan(70);

  const adminShell = page.locator(".admin-shell");
  const baseShellBox = await adminShell.boundingBox();
  expect(baseShellBox).not.toBeNull();

  await page.getByRole("button", { name: /Filters/i }).click();
  await expectShellLayoutStable(adminShell, baseShellBox);
  const drawerContent = page.locator('[data-slot="drawer-content"]');
  await expect(drawerContent).toBeVisible();
  const drawerBackground = await drawerContent.evaluate((node) => getComputedStyle(node).backgroundColor);
  expect(drawerBackground).not.toBe("rgb(255, 255, 255)");
  expect(drawerBackground).not.toBe("rgba(0, 0, 0, 0)");
  await page.getByRole("button", { name: "Cancel" }).click();

  await page.getByRole("button", { name: /Columns/i }).click();
  await expectShellLayoutStable(adminShell, baseShellBox);
  const dropdownContent = page.locator('[data-slot="dropdown-menu-content"]');
  await expect(dropdownContent).toBeVisible();
  await expect(dropdownContent).toHaveClass(/zoom-in-100/);
  await page.keyboard.press("Escape");

  const spellRow = page.locator('[data-testid^="catalog-row-spell-"]').first();
  await spellRow.click({ button: "right" });
  await expectShellLayoutStable(adminShell, baseShellBox);
  const menuContent = page.locator('[data-slot="context-menu-content"]');
  await expect(menuContent).toBeVisible();
  await expect(menuContent).toHaveClass(/zoom-in-100/);
});

async function expectShellLayoutStable(shellLocator, beforeBox) {
  const afterBox = await shellLocator.boundingBox();
  expect(afterBox).not.toBeNull();
  expect(Math.abs(afterBox.x - beforeBox.x)).toBeLessThan(1);
  expect(Math.abs(afterBox.y - beforeBox.y)).toBeLessThan(1);
  expect(Math.abs(afterBox.width - beforeBox.width)).toBeLessThan(1);
  expect(Math.abs(afterBox.height - beforeBox.height)).toBeLessThan(1);
}

test("admin action delete creates a hide override and deleted filter reveals it", async ({ page }) => {
  await gotoFixture(page, "admin=true");
  await page.getByText("Actions", { exact: true }).click();
  await expect(page.getByTestId("catalog-admin-action")).toBeVisible();

  await page.getByTestId("catalog-search-action").fill("Aid");
  const actionRow = page.getByTestId(`catalog-row-action-${AID_ROW_ID}`);
  await expect(actionRow).toBeVisible();

  await actionRow.click({ button: "right" });
  await page.getByTestId("catalog-action-action-delete").click();
  await page.getByTestId("app-feedback-confirm").click();
  await expect(page.getByTestId(`catalog-row-action-${AID_ROW_ID}`)).toHaveCount(0);

  await page.getByRole("button", { name: /Filters/i }).click();
  await page.getByRole("button", { name: "Catalog Status", exact: true }).click();
  await page.getByTestId("catalog-status-action-deleted").click();
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(page.getByTestId(`catalog-row-action-${AID_ROW_ID}`)).toBeVisible();
});
