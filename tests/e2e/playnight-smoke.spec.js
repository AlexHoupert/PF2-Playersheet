import { expect, test } from "@playwright/test";

test.setTimeout(60_000);

test("auth gate renders without fixture bypass", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded", timeout: 60_000 });
  await expect(page.getByText("PF2e Player Sheet")).toBeVisible();
  await expect(page.getByText("Sign in with Google")).toBeVisible();
});

test("player fixture route loads character, quests, loot, shop, and spell override", async ({ page }) => {
  await page.goto("/?e2e=true", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("player-route")).toBeVisible();
  await expect(page.getByText("Nimwe Smoke")).toBeVisible();

  await page.locator("button.btn-char-switch").first().click();
  await page.getByRole("button", { name: /QUESTS/i }).click();
  await expect(page.getByText("Smoke Test Quest")).toBeVisible();

  await page.locator("button.btn-char-switch").first().click();
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
  await page.goto("/?e2e=true&admin=true", { waitUntil: "domcontentloaded" });
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
