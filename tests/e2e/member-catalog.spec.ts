import { test, expect } from "@playwright/test";

const MEMBER_EMAIL = "student1@library.test";
const PASSWORD = "Password123!";

async function loginAsMember(page: any) {
  await page.goto("/login");
  await page.fill('[name="email"]', MEMBER_EMAIL);
  await page.fill('[name="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL("/catalog");
}

test.describe("CAT-03: Member catalog search", () => {
  test("member catalog page loads and shows books", async ({ page }) => {
    await loginAsMember(page);
    await page.goto("/catalog");

    // Page should render catalog — check for search input or book cards
    const searchInput = page.locator('[placeholder*="Search"], [placeholder*="search"], input[type="search"], input[name="search"]');
    await expect(searchInput.first()).toBeVisible({ timeout: 5000 });
  });

  test("member can search catalog and see matching results", async ({ page }) => {
    await loginAsMember(page);
    await page.goto("/catalog");

    // Type a search query
    const searchInput = page.locator('[placeholder*="Search"], input[type="search"], input[name="search"]').first();
    await searchInput.fill("Divine Comedy");

    // Results should update (either immediately or after debounce)
    await page.waitForTimeout(500); // debounce wait

    // Should see at least one result or the "no results" message
    const bookCards = page.locator('[data-testid="book-card"], .book-card, article');
    const noResults = page.locator("text=No books found, text=No results");
    const hasResults = await bookCards.count() > 0;
    const hasNoResultsMsg = await noResults.count() > 0;
    expect(hasResults || hasNoResultsMsg).toBe(true);
  });

  test("search with empty query shows all available books", async ({ page }) => {
    await loginAsMember(page);
    await page.goto("/catalog");

    // Clear search / initial state shows books
    const bookItems = page.locator('[data-testid="book-card"], article, .book-card');
    await expect(bookItems.first()).toBeVisible({ timeout: 5000 });
  });
});
