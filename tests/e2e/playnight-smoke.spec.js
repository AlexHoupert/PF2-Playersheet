import { expect, test } from "@playwright/test";

test.setTimeout(120_000);

test.beforeEach(async ({ page }) => {
  page.on("pageerror", (error) => console.error(`[browser pageerror] ${error.stack || error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") console.error(`[browser console] ${message.text()}`);
  });
});

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
  await page.getByRole("button", { name: "Shop", exact: true }).first().click();
  await expect(page.getByText("Show all available Items")).toBeVisible();
});

test("universal rounds load a slide pistol and versatile vials reuse formula filters", async ({ page }) => {
  await gotoFixture(page);

  await openPlayerPage(page, "Items", "items.equipment");
  const ammoSlot = page.getByTestId("weapon-ammo-slot-e2e_item_slide_pistol-0");
  await expect(ammoSlot).toHaveAttribute("title", "Empty Slot (Tap to Load)");
  await ammoSlot.click();
  await expect(ammoSlot).toHaveAttribute("title", "Loaded: Rounds (Universal)");

  await openPlayerPage(page, "Items", "items.consumables");
  await page.getByTestId("inventory-item-e2e_item_versatile_vial").dblclick();
  const formulaModal = page.getByTestId("formula-book-modal");
  await expect(formulaModal.getByRole("heading", { name: /Versatile Vial - Select Formula/ })).toBeVisible();
  await expect(formulaModal.getByRole("combobox")).toBeVisible();
  await expect(formulaModal.getByText("Highest level only", { exact: true })).toBeVisible();
  await expect(formulaModal.getByText("Daily Preparation", { exact: true })).toHaveCount(0);

  const formulaList = formulaModal.getByTestId("formula-book-list");
  const [listBox, footerBox] = await Promise.all([
    formulaList.boundingBox(),
    formulaModal.locator("[data-app-dialog-footer]").boundingBox(),
  ]);
  expect(listBox).not.toBeNull();
  expect(footerBox).not.toBeNull();
  expect(footerBox.y - (listBox.y + listBox.height)).toBeLessThan(40);

  await formulaModal.getByLabel("Highest level only").check();
  await expect(formulaModal.getByText("Alchemist's Fire (Lesser)", { exact: true })).toHaveCount(0);
  await formulaModal.getByText("Alchemist's Fire (Moderate)", { exact: true }).click();
  await expect(page.getByRole("heading", { name: /Versatile Vial - Select Formula/ })).toHaveCount(0);
  await openPlayerPage(page, "Items", "items.equipment");
  await expect(page.locator(".item-name").filter({ hasText: "Alchemist's Fire (Moderate)" })).toBeVisible();
});

test("trusted player edits impulses through the shared list edit mode", async ({ page }) => {
  await gotoFixture(page, "e2eRole=trusted_player");
  await expectFixtureRoute(page, "player");

  await openPlayerPage(page, "Character", "character.impulses");
  const impulseRow = page.locator(".spell-row").filter({ hasText: "Elemental Blast" }).first();
  await expect(impulseRow.getByText("Elemental Blast", { exact: true })).toBeVisible();
  await expect(impulseRow.getByText("Fork", { exact: true })).toHaveCount(0);

  const actionBars = page.getByTestId("player-catalog-action-bar");
  let actionBar = null;
  for (let index = 0; index < await actionBars.count(); index += 1) {
    const candidate = actionBars.nth(index);
    if (await candidate.isVisible()) actionBar = candidate;
  }
  expect(actionBar).not.toBeNull();
  const actionButtons = actionBar.getByRole("button");
  await expect(actionButtons).toHaveCount(3);
  const buttonWidths = await actionButtons.evaluateAll(buttons => buttons.map(button => button.getBoundingClientRect().width));
  expect(Math.max(...buttonWidths) - Math.min(...buttonWidths)).toBeLessThan(1);

  const addButton = actionBar.getByRole("button", { name: "Add Impulse", exact: true });
  const createButton = actionBar.getByRole("button", { name: "Create Impulse", exact: true });
  expect(await addButton.evaluate(element => getComputedStyle(element).backgroundColor))
    .toBe(await createButton.evaluate(element => getComputedStyle(element).backgroundColor));
  expect(await addButton.locator("svg").evaluate(element => getComputedStyle(element).color)).toBe("rgb(46, 125, 50)");

  const rowHeightBeforeEdit = (await impulseRow.boundingBox()).height;
  await actionBar.getByRole("button", { name: "Edit Impulses", exact: true }).click();
  const editMarker = impulseRow.getByLabel("Edit Elemental Blast");
  await expect(editMarker).toBeVisible();
  const markerBox = await editMarker.boundingBox();
  expect(markerBox.width).toBeLessThanOrEqual(16.5);
  expect(Number.parseFloat(await editMarker.evaluate(element => getComputedStyle(element).marginLeft))).toBeGreaterThanOrEqual(6);
  expect(Math.abs((await impulseRow.boundingBox()).height - rowHeightBeforeEdit)).toBeLessThan(1);
  await impulseRow.click();
  await expect(page.getByRole("heading", { name: "Edit Impulse", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
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

test("GM item workspace persists resizing and edits loot quantity inline", async ({ page }) => {
  await gotoFixture(page, "admin=true");
  await page.getByRole("button", { name: /Items$/ }).first().click();
  await page.getByTestId("gm-items-side-loot").click();

  const targetRow = page.getByTestId("gm-items-loot-target-row-e2e-loot");
  await expect(targetRow).toContainText("Smoke Loot");
  await targetRow.click();

  const contentTable = page.getByTestId("gm-items-loot-contents");
  const lootRow = contentTable.locator("tbody tr").filter({ hasText: "Healing Potion (Minor)" });
  await expect(lootRow).toBeVisible();
  await lootRow.getByRole("button", { name: "1", exact: true }).click();
  const quantityInput = lootRow.getByRole("spinbutton");
  await quantityInput.fill("3");
  await quantityInput.press("Enter");
  await expect(lootRow.getByRole("button", { name: "3", exact: true })).toBeVisible();

  const workspace = page.locator('[data-admin-resource-workspace="desktop"]');
  const mainPanel = workspace.locator('[data-slot="resizable-panel"]').first();
  const separator = workspace.locator('[data-slot="resizable-handle"]').first();
  const before = await mainPanel.boundingBox();
  const handle = await separator.boundingBox();
  expect(before).not.toBeNull();
  expect(handle).not.toBeNull();
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
  await page.mouse.down();
  await page.mouse.move(handle.x + 90, handle.y + handle.height / 2, { steps: 8 });
  await page.mouse.up();
  await expect.poll(async () => page.evaluate(() => localStorage.getItem("gm-items-loot:horizontal"))).not.toBeNull();
  const resizedWidth = (await mainPanel.boundingBox()).width;
  expect(Math.abs(resizedWidth - before.width)).toBeGreaterThan(20);

  await reloadFixture(page, "admin=true");
  await page.getByRole("button", { name: /Items$/ }).first().click();
  await page.getByTestId("gm-items-side-loot").click();
  const restoredWidth = (await page.locator('[data-admin-resource-workspace="desktop"] [data-slot="resizable-panel"]').first().boundingBox()).width;
  expect(Math.abs(restoredWidth - resizedWidth)).toBeLessThan(6);
});

test("mobile GM resource workspace uses a focused subtable sheet", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await gotoFixture(page, "admin=true");
  await page.getByRole("button", { name: /Items$/ }).first().click();
  await page.getByTestId("gm-items-side-loot").click();

  const mobileWorkspace = page.locator('[data-admin-resource-workspace="mobile"]');
  const sheet = page.getByRole("dialog").filter({ hasText: "Loot Bags / Contents" });
  await expect(mobileWorkspace).toBeVisible();
  await expect(sheet).toBeVisible();
  await expect(sheet.getByTestId("gm-items-loot-target-row-e2e-loot")).toContainText("Smoke Loot");

  await sheet.getByTestId("gm-items-loot-target-row-e2e-loot").click({ position: { x: 16, y: 12 } });
  await expect(sheet.getByTestId("gm-items-loot-content-row-e2e-loot-item")).toContainText("Healing Potion (Minor)");
  await sheet.getByRole("button", { name: "Loot Bags", exact: true }).click();
  await expect(sheet.getByTestId("gm-items-loot-target-row-e2e-loot")).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("items-resource-workspace-mobile.png"), fullPage: false });
});

test("GM assembles and customizes an encounter from the creature workspace", async ({ page }, testInfo) => {
  await gotoFixture(page, "admin=true");
  await page.getByRole("button", { name: /Creatures$/ }).first().click();
  await expect(page.getByTestId("gm-bestiary-mode-encounters")).toBeVisible();
  await page.getByTestId("gm-bestiary-mode-encounters").click();
  await page.getByPlaceholder("Search creatures...").fill("Smoke Ember Bear");

  const creatureRow = page.getByTestId("gm-creature-row-smoke-ember-bear");
  const encounterRow = page.getByTestId("gm-encounter-row-e2e_encounter");
  await expect(creatureRow).toBeVisible();
  await expect(encounterRow).toContainText("Smoke Encounter");
  await creatureRow.dragTo(encounterRow);

  const combatantTable = page.getByTestId("gm-bestiary-encounter-creatures-table");
  const addedRow = combatantTable.locator("tbody tr").filter({ hasText: "Smoke Ember Bear" });
  await expect(addedRow).toBeVisible();

  await addedRow.dblclick();
  let detailDialog = page.getByRole("dialog").filter({ hasText: "Encounter creature details" });
  await expect(detailDialog).toBeVisible();
  await expect(detailDialog.getByText("Smoke Ember Bear", { exact: true }).first()).toBeVisible();
  await detailDialog.getByRole("button", { name: "Close", exact: true }).click();

  await addedRow.click({ button: "right" });
  await page.getByTestId("gm-encounter-combatant-action-view-detail").click();
  detailDialog = page.getByRole("dialog").filter({ hasText: "Encounter creature details" });
  await expect(detailDialog).toBeVisible();
  await detailDialog.getByRole("button", { name: "Close", exact: true }).click();

  await addedRow.click({ button: "right" });
  await page.getByTestId("gm-encounter-combatant-action-customize").click();
  await expect(page.getByRole("heading", { name: "Edit Creature" })).toBeVisible();
  await page.getByTestId("creature-editor-name").fill("Smoke Ember Bear Veteran");
  await page.getByRole("button", { name: "Save Creature", exact: true }).click();
  await expect(page.getByText("Smoke Ember Bear Veteran", { exact: true })).toBeVisible();
  await expect(page.getByTestId("gm-creature-row-smoke-ember-bear")).toContainText("Smoke Ember Bear");

  await encounterRow.click({ button: "right" });
  await page.getByTestId("gm-encounter-action-show-main").click();
  await expect(page.getByRole("button", { name: /Smoke Encounter/ })).toBeVisible();

  const customizedRow = combatantTable.locator("tbody tr").filter({ hasText: "Smoke Ember Bear Veteran" });
  await customizedRow.click({ button: "right" });
  await page.getByTestId("gm-encounter-combatant-action-remove").click();
  await expect(customizedRow).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath("bestiary-encounter-workspace.png"), fullPage: false });
});

test("creature spellcasting modes survive save and reload", async ({ page }) => {
  await gotoFixture(page, "admin=true");
  await page.getByRole("button", { name: /Creatures$/ }).first().click();
  await page.getByPlaceholder("Search creatures...").fill("Smoke Ember Bear");
  const creatureRow = page.getByTestId("gm-creature-row-smoke-ember-bear");
  await creatureRow.click({ button: "right" });
  await page.getByRole("menuitem", { name: "Edit", exact: true }).click();
  const spellcastingToggle = page.getByTestId("creature-editor-toggle-spellcasting");
  if (await spellcastingToggle.getAttribute("aria-expanded") !== "true") await spellcastingToggle.click();

  const addEntry = page.getByTestId("creature-spellcasting-add-entry");
  for (let index = 0; index < 4; index += 1) await addEntry.click();
  const modes = ["prepared", "spontaneous", "innate", "focus"];
  for (let index = 0; index < modes.length; index += 1) {
    await page.getByTestId(`creature-spellcasting-entry-${index}`).getByLabel("Mode").selectOption(modes[index]);
  }
  await page.getByRole("button", { name: "Save Creature", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Edit Creature" })).toHaveCount(0);

  await reloadFixture(page, "admin=true");
  await page.getByRole("button", { name: /Creatures$/ }).first().click();
  await page.getByPlaceholder("Search creatures...").fill("Smoke Ember Bear");
  await page.getByTestId("gm-creature-row-smoke-ember-bear").click({ button: "right" });
  await page.getByRole("menuitem", { name: "Edit", exact: true }).click();
  const reloadedToggle = page.getByTestId("creature-editor-toggle-spellcasting");
  await expect(reloadedToggle).toContainText("Spellcasting (4)");
  if (await reloadedToggle.getAttribute("aria-expanded") !== "true") await reloadedToggle.click();
  for (let index = 0; index < modes.length; index += 1) {
    await expect(page.getByTestId(`creature-spellcasting-entry-${index}`).getByLabel("Mode")).toHaveValue(modes[index]);
  }
});

test("encounter creature search includes catalog clones", async ({ page }) => {
  await gotoFixture(page, "admin=true");
  await page.getByText("Encounters", { exact: true }).click();

  await page.getByPlaceholder("Search creatures...").fill("Smoke Ember Bear");
  const clone = page.getByTestId("encounter-creature-result-smoke-ember-bear");
  await expect(clone).toContainText("Smoke Ember Bear");
  await clone.click();

  await expect(page.getByText("Smoke Ember Bear", { exact: true }).first()).toBeVisible();
});

test("creature ability library tolerates incomplete legacy abilities", async ({ page }) => {
  await gotoFixture(page, "admin=true");
  await page.getByText("Creatures", { exact: true }).click();
  await page.getByPlaceholder("Search creatures...").fill("Smoke Ember Bear");

  const creatureRow = page.getByText("Smoke Ember Bear", { exact: true }).first();
  await expect(creatureRow).toBeVisible();
  await creatureRow.click({ button: "right" });
  await page.getByRole("menuitem", { name: "Edit", exact: true }).click();
  await page.getByRole("button", { name: /From Library/i }).first().click();

  await expect(page.getByRole("heading", { name: "Ability Library" })).toBeVisible();
  const legacyAbility = page.getByText("Legacy Smoke Aura", { exact: false }).first();
  await expect(legacyAbility).toBeVisible();
  await legacyAbility.click();
  await expect(page.getByText("A legacy ability without a traits field.")).toBeVisible();
  await page.getByRole("button", { name: "Add to Creature" }).click();
  await expect(page.locator('input[value="Legacy Smoke Aura"]')).toBeVisible();
});

test("armor editor loads and persists AC bonus and Dexterity cap", async ({ page }) => {
  await gotoFixture(page, "admin=true");
  await page.getByText("Items", { exact: true }).click();
  await page.getByPlaceholder("Search items...").fill("Ancestral Embrace");

  const armorRow = page.getByTestId("gm-item-row-ancestral-embrace");
  await expect(armorRow).toBeVisible();
  await armorRow.click({ button: "right" });
  await page.getByText("Edit Item", { exact: true }).click();

  await expect(page.getByTestId("item-editor-acBonus")).toHaveValue("1");
  await expect(page.getByTestId("item-editor-dexCap")).toHaveValue("4");
  await page.getByTestId("item-editor-dexCap").fill("3");
  await page.getByRole("button", { name: "Save Item" }).click();

  await expect(page.getByTestId("item-editor-dexCap")).toHaveCount(0);
  await armorRow.click({ button: "right" });
  await page.getByText("Edit Item", { exact: true }).click();
  await expect(page.getByTestId("item-editor-dexCap")).toHaveValue("3");
});

test("campaign roles gate admin surfaces and spectator edits", async ({ page }) => {
  await gotoFixture(page, "admin=true&e2eRole=assistant_gm");
  await expectFixtureRoute(page, "admin");
  await expect(page.getByText("Campaign Changes", { exact: true })).toBeVisible();
  await expect(page.getByText("Players", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: /Effect Requests/i }).click();
  await expect(page.getByRole("button", { name: /Approve/i })).toBeDisabled();

  await gotoFixture(page, "admin=true&e2eRole=spectator");
  await expect(page.getByTestId("route-access-denied")).toBeVisible();

  await gotoFixture(page, "e2eRole=spectator");
  await expectFixtureRoute(page, "player");
  await page.getByTestId("player-gold-display").click();
  await expect(page.getByTestId("gold-modal-input")).toHaveCount(0);
});

test("GM sees catalog audit and approves a pending creature effect", async ({ page }) => {
  await gotoFixture(page, "admin=true");
  await page.getByText("Campaign Changes", { exact: true }).click();
  await expect(page.getByText("Smoke Campaign Spell", { exact: true })).toBeVisible();
  await expect(page.locator("small").filter({ hasText: /^trusted_player$/ })).toBeVisible();

  await page.getByRole("button", { name: /Effect Requests/i }).click();
  await expect(page.getByText("Smoke Bless", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /Approve/i }).click();
  await expect(page.getByRole("button", { name: /Effect Requests/i })).toHaveCount(0);
});

test("player HP, gold, and condition edits survive reload in fixture runtime", async ({ page }) => {
  await gotoFixture(page);
  await expectFixtureRoute(page, "player");

  await page.getByTestId("player-health-bar").click();
  const sharedDialog = page.locator("[data-app-dialog-shell]");
  await expect(sharedDialog).toBeVisible();
  await expect(sharedDialog.locator("[data-app-dialog-header]")).toBeVisible();
  await expect(sharedDialog.locator("[data-app-dialog-footer]")).toBeVisible();
  await expect.poll(() => sharedDialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
  await expect.poll(() => sharedDialog.locator("[data-app-dialog-body]").evaluate((element) => getComputedStyle(element).overflowY)).toBe("auto");
  await page.getByTestId("hp-modal-input").fill("21");
  await page.getByTestId("hp-modal-set").click();
  await expect(page.getByTestId("player-health-text")).toContainText(/21\s*\/\s*30/);

  await page.getByTestId("player-gold-display").click();
  await page.getByTestId("gold-modal-input").fill("15");
  await page.getByTestId("gold-modal-set").click();
  await expect(page.getByTestId("player-gold-display")).toContainText("15.00");

  await page.getByRole("button", { name: "Frightened", exact: true }).click();
  await page.getByTestId("condition-detail-increase-frightened").click();
  await page.getByRole("button", { name: "Close" }).click();
  await expect(page.getByRole("button", { name: "Frightened 2", exact: true })).toBeVisible();

  await reloadFixture(page);
  await expect(page.getByTestId("player-health-text")).toContainText(/21\s*\/\s*30/);
  await expect(page.getByTestId("player-gold-display")).toContainText("15.00");
  await expect(page.getByRole("button", { name: "Frightened 2", exact: true })).toBeVisible();
});

test("shared form dialogs keep their header and footer reachable on a short mobile viewport", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 640 });
  await gotoFixture(page);
  await expectFixtureRoute(page, "player");

  await page.getByTestId("player-health-bar").click();
  const dialog = page.locator("[data-app-dialog-shell]");
  await expect(dialog).toBeVisible();
  await expect(dialog.locator("[data-app-dialog-header]")).toBeInViewport();
  await expect(dialog.locator("[data-app-dialog-footer]")).toBeInViewport();
  await testInfo.attach("shared-form-dialog-mobile", {
    body: await page.screenshot(),
    contentType: "image/png",
  });
  await dialog.getByRole("button", { name: "Close", exact: true }).click();
  await expect(dialog).toHaveCount(0);
});

test("mobile player catalog editor scrolls its form and keeps attach controls in the header", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 700 });
  await gotoFixture(page, "e2eRole=trusted_player");

  await page
    .getByRole("navigation", { name: "Player navigation" })
    .getByRole("button", { name: /Items$/i })
    .click();
  await page
    .getByRole("region", { name: "Items pages" })
    .getByRole("button", { name: "Equipment", exact: true })
    .click();
  await page.locator("button:visible").filter({ hasText: /^Create Item$/ }).first().click();

  const editor = page.getByTestId("catalog-editor-shell");
  const header = page.getByTestId("catalog-editor-header");
  const body = page.getByTestId("catalog-editor-body");
  const attach = page.getByTestId("player-catalog-add-to-actor");
  await expect(editor).toBeVisible();
  await expect(header.getByRole("heading", { name: "Create Item" })).toBeVisible();
  await expect(attach).toBeChecked();

  const outerScrollBody = page.locator(".modal-layer-scroll-body").filter({ has: editor });
  expect(await outerScrollBody.evaluate(element => getComputedStyle(element).overflowY)).toBe("hidden");
  expect(await body.evaluate(element => element.scrollHeight > element.clientHeight)).toBe(true);
  expect(await body.evaluate(element => {
    element.scrollTop = 180;
    return element.scrollTop;
  })).toBeGreaterThan(0);

  const [headingBox, attachBox] = await Promise.all([
    header.getByRole("heading", { name: "Create Item" }).boundingBox(),
    attach.boundingBox(),
  ]);
  expect(headingBox).not.toBeNull();
  expect(attachBox).not.toBeNull();
  expect(attachBox.x).toBeGreaterThan(headingBox.x);
  expect(Math.abs((attachBox.y + attachBox.height / 2) - (headingBox.y + headingBox.height / 2))).toBeLessThan(24);

  await testInfo.attach("mobile-player-item-editor", {
    body: await page.screenshot(),
    contentType: "image/png",
  });

  await page.getByRole("button", { name: "Browse...", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Select Image" })).toBeVisible();
  await expect(page.getByText("ressources/icons", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Cancel", exact: true }).last().click();
  await editor.getByRole("button", { name: "Cancel", exact: true }).click();
});

test("player can inspect and remove an exact persisted effect from the status screen", async ({ page }, testInfo) => {
  const accessibilityWarnings = [];
  page.on("console", (message) => {
    if (/Blocked aria-hidden/i.test(message.text())) accessibilityWarnings.push(message.text());
  });
  await gotoFixture(page);
  await expectFixtureRoute(page, "player");

  const conditionChip = page.getByTestId("condition-badge-e2e-effect-frightened");
  const overviewButton = page.getByTestId("actor-effects-overview-button");
  await expect(conditionChip).toBeVisible();
  await conditionChip.getByRole("button", { name: "Frightened", exact: true }).click();
  let conditionDialog = page.locator("[data-app-dialog-shell]");
  await expect(conditionDialog.getByRole("heading", { name: "Frightened", exact: true })).toBeVisible();
  await conditionDialog.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByTestId("condition-add-button").click();
  conditionDialog = page.locator("[data-app-dialog-shell]");
  await expect(conditionDialog.getByRole("heading", { name: "Conditions", exact: true })).toBeVisible();
  await expect(conditionDialog.locator(".conditions-modal__active-effect-icon")).toBeVisible();
  await conditionDialog.getByRole("button", { name: "Close", exact: true }).click();
  const [overviewBox, chipBox] = await Promise.all([overviewButton.boundingBox(), conditionChip.boundingBox()]);
  expect(overviewBox.width).toBeLessThanOrEqual(30.5);
  expect(Math.abs(overviewBox.height - chipBox.height)).toBeLessThan(1);
  await overviewButton.click();
  const drawer = page.getByTestId("actor-effects-drawer");
  await expect(drawer).toBeVisible();
  await expect(page.getByTestId("actor-effects-scope-all")).not.toBeChecked();
  await expect.poll(() => drawer.evaluate((element) => element.contains(document.activeElement))).toBe(true);
  await expect(page.getByText("Frightened", { exact: true }).last()).toBeVisible();

  await page.getByTestId("actor-effects-view-sources").click();
  const frightenedSource = page.getByTestId("actor-effect-source-e2e_effect_frightened");
  await frightenedSource.getByRole("button", { name: "Expand Frightened" }).click();
  await expect(page.getByText(/\[Status\] Attack Rolls/).first()).toBeVisible();
  await expect(page.getByText(/\[Status\] Skill Checks/).first()).toBeVisible();
  const frightenedInfoTrigger = frightenedSource.getByRole("button", { name: "Frightened", exact: true });
  await frightenedInfoTrigger.click();
  conditionDialog = page.locator("[data-app-dialog-shell]");
  await expect(conditionDialog.getByRole("heading", { name: "Frightened", exact: true })).toBeVisible();
  await conditionDialog.getByRole("button", { name: "Close", exact: true }).click();
  await expect(frightenedInfoTrigger).toBeFocused();
  await expect(page.getByText(/\[Status\] Attack Rolls/).first()).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("actor-effects-desktop-sources.png") });
  await page.getByRole("button", { name: "Close active effects" }).click();
  await expect(page.getByTestId("actor-effects-overview-button")).toBeFocused();
  expect(accessibilityWarnings).toEqual([]);

  await page.getByRole("button", { name: "Remove Frightened" }).click();
  await expect(page.getByTestId("condition-badge-e2e-effect-frightened")).toHaveCount(0);

  const [sectionBox, addButtonBox, emptyOverviewBox] = await Promise.all([
    page.locator(".actor-effects-section").boundingBox(),
    page.getByTestId("condition-add-button").boundingBox(),
    page.getByTestId("actor-effects-overview-button").boundingBox(),
  ]);
  expect(Math.abs((addButtonBox.x + addButtonBox.width / 2) - (sectionBox.x + sectionBox.width / 2))).toBeLessThan(1);
  expect(Math.abs(emptyOverviewBox.height - addButtonBox.height)).toBeLessThan(1);

  await reloadFixture(page);
  await expect(page.getByTestId("condition-badge-e2e-effect-frightened")).toHaveCount(0);
});

test("mobile actor effects drawer opens from the left and keeps focus contained", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await gotoFixture(page);
  await expectFixtureRoute(page, "player");

  const trigger = page.getByTestId("actor-effects-overview-button");
  await trigger.click();
  const drawer = page.getByTestId("actor-effects-drawer");
  await expect(drawer).toBeVisible();
  await expect.poll(async () => (await drawer.boundingBox())?.x ?? -999).toBeGreaterThanOrEqual(-1);
  const box = await drawer.boundingBox();

  expect(box.x).toBeLessThanOrEqual(1);
  expect(box.width).toBeGreaterThanOrEqual(340);
  expect(box.width).toBeLessThanOrEqual(420);
  expect(box.height).toBeGreaterThanOrEqual(840);
  await expect.poll(() => drawer.evaluate((element) => element.contains(document.activeElement))).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("actor-effects-mobile-left.png") });

  await page.getByRole("button", { name: "Close active effects" }).click();
  await expect(trigger).toBeFocused();
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
  await page.getByTestId("actor-effects-overview-button").click();
  const effectDrawer = page.getByTestId("actor-effects-drawer");
  await expect(effectDrawer.getByText("1d6 fire", { exact: true })).toBeVisible();
  await expect(effectDrawer.getByText("3.5", { exact: true })).toHaveCount(0);
  await page.getByTestId("actor-effects-view-sources").click();
  await expect(effectDrawer.getByText("1d6 fire", { exact: true })).toBeVisible();
  await expect(effectDrawer.getByText(/Applied by Nimwe/i)).toHaveCount(0);
  await page.getByRole("button", { name: "Close active effects" }).click();
  const persistentDamageChip = page.locator(".effect-chip__main").filter({ hasText: "1d6 fire persistent" });
  await persistentDamageChip.click();
  await expect(page.getByText(/Persistent damage is taken at the end/i)).toBeVisible();
  await page.getByRole("button", { name: "Remove", exact: true }).click();
  await expect(persistentDamageChip).toHaveCount(0);
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
  await expect(page.getByTestId("gm-items-loot-targets").getByRole("cell", { name: "Smoke Created Loot", exact: true })).toBeVisible();

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

test("GM publishes linked lore and player reads the release and shares a note", async ({ page }) => {
  await gotoFixture(page, "admin=true");
  await page.getByText("Lore", { exact: true }).click();
  await expect(page.getByTestId("lore-admin-workspace")).toBeVisible();
  await expect(page.getByTestId("lore-admin-row-e2e_lore_history")).toBeVisible();

  await page.getByTestId("lore-new-article").click();
  await page.getByTestId("lore-title-input").fill("E2E Released Chronicle");
  await page.locator('[data-testid^="lore-block-content-"]').first().fill("The party recovered a new chronicle about");
  await page.getByTestId("lore-insert-link").click();
  await page.getByTestId("lore-reference-option-lore-e2e_lore_history").click();
  await page.getByTestId("lore-open-publish").click();
  await expect(page.getByTestId("lore-publish-notify")).toBeChecked();
  await page.getByTestId("lore-publish-confirm").click();
  await expect(page.locator('[data-testid^="lore-admin-row-"]', { hasText: "E2E Released Chronicle" })).toBeVisible();

  await reloadFixture(page);
  await expectFixtureRoute(page, "player");
  await expect(page.getByRole("heading", { name: "E2E Released Chronicle" })).toBeVisible();
  await page.getByTestId("lore-release-open").click();
  const loreReader = page.getByTestId("player-lore-reader-history");
  await expect(loreReader).toContainText("E2E Released Chronicle");
  await expect(loreReader.getByRole("button", { name: "Founding of Smokehaven" })).toBeVisible();

  await loreReader.getByTestId("knowledge-note-content").fill("The old road may still be useful.");
  await expect.poll(() => page.evaluate(() => {
    const db = JSON.parse(localStorage.getItem("pf2:e2e-runtime-db") || "{}");
    return db.campaigns?.e2e_campaign?.knowledgeNotes?.find?.(
      (note) => note.content === "The old road may still be useful."
    )?.content;
  })).toBe("The old road may still be useful.");
  await loreReader.getByTestId("knowledge-note-share").check();
  await expect.poll(() => page.evaluate(() => {
    const db = JSON.parse(localStorage.getItem("pf2:e2e-runtime-db") || "{}");
    return db.campaigns?.e2e_campaign?.knowledgeNotes?.find?.(
      (note) => note.content === "The old road may still be useful."
    )?.sharedWithGm;
  })).toBe(true);
  await loreReader.getByTestId("knowledge-note-share-party").check();
  await expect.poll(() => page.evaluate(() => {
    const db = JSON.parse(localStorage.getItem("pf2:e2e-runtime-db") || "{}");
    return db.campaigns?.e2e_campaign?.knowledgeNotes?.find?.(
      (note) => note.content === "The old road may still be useful."
    )?.sharedWithParty;
  })).toBe(true);
  await expect(loreReader.getByTestId("knowledge-note-status")).toContainText("Saved");

  const deliveryState = await page.evaluate(() => {
    const db = JSON.parse(localStorage.getItem("pf2:e2e-runtime-db") || "{}");
    return db.campaigns?.e2e_campaign?.loreDeliveries?.find?.((delivery) => delivery.snapshot?.title === "E2E Released Chronicle");
  });
  expect(deliveryState?.readVersion).toBe(deliveryState?.attentionVersion);

  await reloadFixture(page, "admin=true");
  await page.getByText("Lore", { exact: true }).click();
  await page.locator('[data-testid^="lore-admin-row-"]', { hasText: "E2E Released Chronicle" }).click();
  await expect(page.getByText("The old road may still be useful.", { exact: true })).toBeVisible();
});

test("player finds, filters, edits, and opens Lore and Bestiary notes from the overview", async ({ page }) => {
  await gotoFixture(page);
  await expectFixtureRoute(page, "player");

  await openPlayerPage(page, "Knowledge", "knowledge.history");
  await page.getByTestId("player-lore-entry-e2e_lore_history").click();
  await page.getByTestId("player-lore-reader-history").getByTestId("knowledge-note-content").fill("Remember the amber road marker.");
  await expect.poll(() => readFixtureKnowledgeNote(page, "loreArticle", "e2e_lore_history")).toBe("Remember the amber road marker.");

  await openPlayerPage(page, "Knowledge", "knowledge.bestiary");
  await page.getByTestId("player-bestiary-entry-fLLKuOXwPq1Iq0U4").click();
  await page.getByTestId("knowledge-note-content").fill("Silver bells distract this goblin.");
  await page.getByTestId("knowledge-note-share-party").check();
  await expect.poll(() => readFixtureKnowledgeNote(page, "creature", "fLLKuOXwPq1Iq0U4")).toBe("Silver bells distract this goblin.");

  await openPlayerPage(page, "Knowledge", "knowledge.notes");
  await expect(page.getByTestId("player-knowledge-notes")).toBeVisible();
  await expect(page.getByTestId("knowledge-notes-total")).toHaveText("2");
  await expect(page.locator('[data-testid^="knowledge-note-row-"]')).toHaveCount(2);

  await page.getByTestId("knowledge-notes-search").fill("silver bells");
  await expect(page.locator('[data-testid^="knowledge-note-row-"]')).toHaveCount(1);
  await expect(page.locator('[data-testid^="knowledge-note-row-"]').first()).toContainText("Goblin Warrior");
  await page.getByTestId("knowledge-notes-search").fill("");
  await page.getByTestId("knowledge-notes-sharing-filter").selectOption("party");
  await expect(page.locator('[data-testid^="knowledge-note-row-"]')).toHaveCount(1);

  await page.locator('[data-testid^="knowledge-note-row-"]').first().click();
  await page.getByTestId("knowledge-note-content").fill("Silver bells distract this goblin. Confirm at camp.");
  await expect.poll(() => readFixtureKnowledgeNote(page, "creature", "fLLKuOXwPq1Iq0U4")).toBe("Silver bells distract this goblin. Confirm at camp.");
  await page.getByTestId("knowledge-note-open-source").click();
  await expect(page.getByTestId("player-bestiary-entry-fLLKuOXwPq1Iq0U4")).toHaveClass(/active/);

  await reloadFixture(page);
  await openPlayerPage(page, "Knowledge", "knowledge.notes");
  await page.getByTestId("knowledge-notes-search").fill("confirm at camp");
  await expect(page.locator('[data-testid^="knowledge-note-row-"]')).toHaveCount(1);
});

test("mobile Knowledge notes switch cleanly between list and reachable editor controls", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await gotoFixture(page);
  await expectFixtureRoute(page, "player");

  await page.getByTestId("player-nav-category-knowledge").click();
  await page.getByTestId("player-nav-page-knowledge.history").click();
  await page.getByTestId("player-lore-entry-e2e_lore_history").click();
  await page.getByTestId("knowledge-note-content").fill("Mobile note for the old road.");
  await expect.poll(() => readFixtureKnowledgeNote(page, "loreArticle", "e2e_lore_history")).toBe("Mobile note for the old road.");

  await page.getByTestId("player-nav-category-knowledge").click();
  await page.getByTestId("player-nav-page-knowledge.notes").click();
  await expect(page.getByTestId("player-knowledge-notes")).toBeVisible();
  await page.locator('[data-testid^="knowledge-note-row-"]').first().click();
  await expect(page.getByTestId("knowledge-notes-reader")).toBeVisible();

  const partyShare = page.getByTestId("knowledge-notes-reader").getByTestId("knowledge-note-share-party");
  await partyShare.scrollIntoViewIfNeeded();
  const controlBox = await partyShare.boundingBox();
  const navBox = await page.locator(".player-bottom-nav").boundingBox();
  expect(controlBox.y + controlBox.height).toBeLessThanOrEqual(navBox.y);

  await page.getByRole("button", { name: "Back to notes" }).click();
  await expect(page.locator('[data-testid^="knowledge-note-row-"]').first()).toBeVisible();
});

async function readFixtureKnowledgeNote(page, targetType, targetId) {
  return page.evaluate(({ targetType: expectedType, targetId: expectedId }) => {
    const db = JSON.parse(localStorage.getItem("pf2:e2e-runtime-db") || "{}");
    return db.campaigns?.e2e_campaign?.knowledgeNotes?.find?.(
      (note) => note.actorId === "e2e_actor_nimwe"
        && note.targetType === expectedType
        && note.targetId === expectedId
    )?.content || null;
  }, { targetType, targetId });
}

test("lore workspace and player knowledge surfaces keep visual smoke artifacts", async ({ page }, testInfo) => {
  test.slow();
  await gotoFixture(page, "admin=true");
  await page.getByText("Lore", { exact: true }).click();
  await expect(page.getByTestId("lore-admin-workspace")).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("gm-lore-desktop.png") });

  await reloadFixture(page);
  await expectFixtureRoute(page, "player");
  await openPlayerPage(page, "Knowledge", "knowledge.history");
  await page.getByTestId("player-lore-entry-e2e_lore_history").click();
  await expect(page.getByTestId("player-lore-reader-history")).toContainText("Founding of Smokehaven");
  await expect(page.getByTestId("party-shared-note-e2e_party_note_history")).toContainText("old road as worth revisiting");
  await page.screenshot({ path: testInfo.outputPath("player-lore-desktop.png") });

  await page.getByTestId("player-lore-reader-history").getByRole("button", { name: "goblin warriors" }).click();
  await expect(page.locator(".player-bestiary-library")).toBeVisible();
  await expect(page.locator(".player-bestiary-library .player-knowledge-list > button").first()).toBeVisible();
  await page.waitForTimeout(250);
  await page.screenshot({ path: testInfo.outputPath("player-bestiary-desktop.png") });

  await page.setViewportSize({ width: 390, height: 844 });
  await reloadFixture(page);
  await page.getByTestId("player-nav-category-knowledge").click();
  await page.getByTestId("player-nav-page-knowledge.history").click();
  await expect(page.locator(".player-category-drawer")).toHaveAttribute("aria-hidden", "true");
  await page.getByTestId("player-lore-entry-e2e_lore_history").click();
  await expect(page.getByTestId("player-lore-reader-history")).toBeVisible();
  await page.waitForTimeout(250);
  await page.screenshot({ path: testInfo.outputPath("player-lore-mobile.png") });
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

test("nested item context menus stay inside the lower-right viewport edge", async ({ page }) => {
  await gotoFixture(page, "admin=true");
  await page.getByRole("button", { name: /Items$/ }).first().click();
  const table = page.getByTestId("gm-items-table");
  const surface = table.locator("xpath=..");
  await surface.evaluate(element => { element.scrollTop = element.scrollHeight; });
  const row = table.locator("tbody tr").last();
  await row.scrollIntoViewIfNeeded();
  const lastCell = row.locator("td").last();
  const cellBox = await lastCell.boundingBox();
  expect(cellBox).not.toBeNull();
  await lastCell.click({ button: "right", position: { x: cellBox.width - 4, y: cellBox.height / 2 } });
  const submenuTrigger = page.getByTestId("gm-items-add-loot");
  await expect(submenuTrigger).toBeVisible();
  await submenuTrigger.hover();
  const submenu = page.locator('[data-slot="context-menu-sub-content"]');
  await expect(submenu).toBeVisible();
  const submenuBox = await submenu.boundingBox();
  const viewport = page.viewportSize();
  expect(submenuBox).not.toBeNull();
  expect(submenuBox.x).toBeGreaterThanOrEqual(0);
  expect(submenuBox.y).toBeGreaterThanOrEqual(0);
  expect(submenuBox.x + submenuBox.width).toBeLessThanOrEqual(viewport.width);
  expect(submenuBox.y + submenuBox.height).toBeLessThanOrEqual(viewport.height);
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
