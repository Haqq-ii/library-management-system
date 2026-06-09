import { test, expect } from "@playwright/test";

const LIBRARIAN_EMAIL = "librarian@library.test";
const LIBRARIAN_PASSWORD = "Password123!";

test.describe("AUTH-02: Session persistence", () => {
  test("session persists after page refresh", async ({ page }) => {
    // Log in
    await page.goto("/login");
    await page.fill('[name="email"]', LIBRARIAN_EMAIL);
    await page.fill('[name="password"]', LIBRARIAN_PASSWORD);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL("/dashboard");

    // Refresh the page — should still be on dashboard (not redirected to /login)
    await page.reload();
    await expect(page).toHaveURL("/dashboard");
  });

  test("unauthenticated request to /dashboard redirects to /login", async ({ page }) => {
    // Navigate directly without logging in
    await page.goto("/dashboard");
    await expect(page).toHaveURL("/login");
  });

  test("unauthenticated request to /books redirects to /login", async ({ page }) => {
    await page.goto("/books");
    await expect(page).toHaveURL("/login");
  });

  test("session is invalidated after logout", async ({ page }) => {
    // Log in
    await page.goto("/login");
    await page.fill('[name="email"]', LIBRARIAN_EMAIL);
    await page.fill('[name="password"]', LIBRARIAN_PASSWORD);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL("/dashboard");

    // Find and click sign out button
    const signOutBtn = page.locator("button:has-text('Sign out'), button:has-text('Log out'), a:has-text('Sign out')");
    if (await signOutBtn.count() > 0) {
      await signOutBtn.first().click();
    } else {
      // Navigate to logout route directly
      await page.goto("/api/auth/sign-out");
    }

    // Should redirect to login
    await page.goto("/dashboard");
    await expect(page).toHaveURL("/login");
  });
});
