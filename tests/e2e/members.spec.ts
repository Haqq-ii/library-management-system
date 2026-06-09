import { test, expect } from "@playwright/test";

const LIBRARIAN_EMAIL = "librarian@library.test";
const PASSWORD = "Password123!";

async function loginAsLibrarian(page: any) {
  await page.goto("/login");
  await page.fill('[name="email"]', LIBRARIAN_EMAIL);
  await page.fill('[name="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL("/dashboard");
}

test.describe("MBR-01: Librarian member management", () => {
  test("librarian can register a new member and they appear in the member list", async ({ page }) => {
    await loginAsLibrarian(page);
    await page.goto("/members");

    // Click Add Member button
    const addButton = page.locator("button:has-text('Add Member'), button:has-text('Register Member'), button:has-text('New Member')").first();
    await addButton.click();

    // Fill in member form
    const uniqueEmail = `newmember.${Date.now()}@library.test`;
    await page.fill('[name="name"]', "New Test Member");
    await page.fill('[name="email"]', uniqueEmail);
    await page.fill('[name="password"]', "Password123!");

    // Select member type if available
    const memberTypeSelect = page.locator('[name="memberType"], select[name="memberType"]');
    if (await memberTypeSelect.count() > 0) {
      await memberTypeSelect.selectOption("STUDENT");
    }

    // Submit form
    const submitButton = page.locator('button[type="submit"]:has-text("Save"), button:has-text("Register"), button:has-text("Create")').last();
    await submitButton.click();

    // Member should appear in the list
    await expect(page.locator("text=New Test Member")).toBeVisible({ timeout: 10000 });
  });

  test("members page shows existing seeded members", async ({ page }) => {
    await loginAsLibrarian(page);
    await page.goto("/members");

    // Should see a table with members
    const tableRows = page.locator("tbody tr, [data-testid='member-row']");
    await expect(tableRows.first()).toBeVisible({ timeout: 5000 });
  });
});
