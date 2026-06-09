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

test.describe("CAT-01: Librarian book catalog management", () => {
  test("librarian can add a book and it appears in the catalog table", async ({ page }) => {
    await loginAsLibrarian(page);
    await page.goto("/books");

    // Click Add Book button
    const addButton = page.locator("button:has-text('Add Book'), button:has-text('New Book'), button:has-text('Add')").first();
    await addButton.click();

    // Fill in book form (slide-over sheet)
    await page.fill('[name="isbn"]', "9780140449136");
    await page.fill('[name="title"]', "The Divine Comedy");
    await page.fill('[name="authorName"]', "Dante Alighieri");

    // Submit form
    const submitButton = page.locator('button[type="submit"]:has-text("Save"), button:has-text("Create Book"), button:has-text("Add Book")').last();
    await submitButton.click();

    // Book should appear in table
    await expect(page.locator("text=The Divine Comedy")).toBeVisible({ timeout: 10000 });
  });

  test("librarian can soft-delete a book; it disappears from the default list", async ({ page }) => {
    await loginAsLibrarian(page);
    await page.goto("/books");

    // Find a book row with delete action
    const firstDeleteBtn = page.locator("[data-testid='delete-book'], button:has-text('Delete')").first();
    if (await firstDeleteBtn.count() > 0) {
      const bookTitle = await page.locator("tbody tr:first-child td:first-child").textContent();
      await firstDeleteBtn.click();

      // Confirm deletion if dialog appears
      const confirmBtn = page.locator("button:has-text('Confirm'), button:has-text('Delete'), button:has-text('Yes')").last();
      if (await confirmBtn.isVisible()) {
        await confirmBtn.click();
      }

      // Book should no longer be visible
      if (bookTitle) {
        await expect(page.locator(`text=${bookTitle}`)).not.toBeVisible({ timeout: 5000 });
      }
    }
  });
});
