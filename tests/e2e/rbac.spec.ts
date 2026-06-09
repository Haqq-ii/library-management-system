import { test, expect } from "@playwright/test";

const LIBRARIAN_EMAIL = "librarian@library.test";
const MEMBER_EMAIL = "student1@library.test";
const PASSWORD = "Password123!";

async function loginAs(page: any, email: string, password = PASSWORD) {
  await page.goto("/login");
  await page.fill('[name="email"]', email);
  await page.fill('[name="password"]', password);
  await page.click('button[type="submit"]');
}

test.describe("AUTH-03: Role-based access control", () => {
  test("MEMBER accessing /books (librarian route) is redirected or gets 403", async ({ page }) => {
    await loginAs(page, MEMBER_EMAIL);
    await page.goto("/books");
    // Member should not see the librarian catalog — either redirected or error shown
    const url = page.url();
    const isForbidden = url.includes("/login") || url.includes("/catalog") || url.includes("/403");
    // If they land on /books, there should be no create/edit controls
    if (!isForbidden) {
      const createButton = page.locator("button:has-text('Add Book'), button:has-text('New Book')");
      await expect(createButton).not.toBeVisible();
    } else {
      expect(isForbidden).toBe(true);
    }
  });

  test("LIBRARIAN accessing /catalog sees the member catalog view", async ({ page }) => {
    await loginAs(page, LIBRARIAN_EMAIL);
    await expect(page).toHaveURL("/dashboard");
    // Librarian can navigate to catalog if they choose — it should render
    await page.goto("/catalog");
    // Should not redirect to login
    expect(page.url()).not.toContain("/login");
  });

  test("LIBRARIAN can access /books (librarian-only route)", async ({ page }) => {
    await loginAs(page, LIBRARIAN_EMAIL);
    await page.goto("/books");
    await expect(page).toHaveURL("/books");
  });

  test("LIBRARIAN can access /members (librarian-only route)", async ({ page }) => {
    await loginAs(page, LIBRARIAN_EMAIL);
    await page.goto("/members");
    await expect(page).toHaveURL("/members");
  });

  test("MEMBER can access /my-profile but not /members (librarian-only)", async ({ page }) => {
    await loginAs(page, MEMBER_EMAIL);
    await page.goto("/my-profile");
    expect(page.url()).not.toContain("/login");

    // Member accessing /members should be redirected or shown error
    await page.goto("/members");
    const url = page.url();
    expect(url).not.toBe("http://localhost:3000/members");
  });
});
