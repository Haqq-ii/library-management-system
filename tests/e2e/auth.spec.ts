import { test, expect } from "@playwright/test";

// Seeded credentials (INFRA-03)
const LIBRARIAN_EMAIL = "librarian@library.test";
const LIBRARIAN_PASSWORD = "Password123!";
const WRONG_PASSWORD = "WrongPassword!";

test.describe("AUTH-01: Email and password login", () => {
  test("librarian can log in with valid credentials and lands on /dashboard", async ({ page }) => {
    await page.goto("/login");
    await page.fill('[name="email"]', LIBRARIAN_EMAIL);
    await page.fill('[name="password"]', LIBRARIAN_PASSWORD);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL("/dashboard");
  });

  test("login fails with wrong password and shows error message", async ({ page }) => {
    await page.goto("/login");
    await page.fill('[name="email"]', LIBRARIAN_EMAIL);
    await page.fill('[name="password"]', WRONG_PASSWORD);
    await page.click('button[type="submit"]');
    // Should stay on login page
    await expect(page).toHaveURL("/login");
    // Should show some error indication
    const errorEl = page.locator("[role='alert'], .error, [data-slot='error']");
    await expect(errorEl.first()).toBeVisible({ timeout: 5000 });
  });

  test("member can log in with valid credentials and lands on /catalog", async ({ page }) => {
    await page.goto("/login");
    await page.fill('[name="email"]', "student1@library.test");
    await page.fill('[name="password"]', LIBRARIAN_PASSWORD);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL("/catalog");
  });
});
