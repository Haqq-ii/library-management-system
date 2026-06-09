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

test.describe("MBR-03: Member profile view", () => {
  test("member can view /my-profile and sees their own name", async ({ page }) => {
    await loginAsMember(page);
    await page.goto("/my-profile");

    // Should not redirect to login
    expect(page.url()).not.toContain("/login");

    // Should display the member's name (seeded as "Student 1" or similar)
    const profileName = page.locator("[data-testid='profile-name'], h1, h2, .profile-name");
    await expect(profileName.first()).toBeVisible({ timeout: 5000 });
  });

  test("member can view /my-profile and sees their email", async ({ page }) => {
    await loginAsMember(page);
    await page.goto("/my-profile");

    // Should show the email
    await expect(page.locator(`text=${MEMBER_EMAIL}`)).toBeVisible({ timeout: 5000 });
  });

  test("member can view /my-profile and sees their role (MEMBER)", async ({ page }) => {
    await loginAsMember(page);
    await page.goto("/my-profile");

    // Should indicate they are a member/student
    const roleBadge = page.locator("text=MEMBER, text=Student, text=Member, [data-testid='role']");
    await expect(roleBadge.first()).toBeVisible({ timeout: 5000 });
  });

  test("unauthenticated user cannot access /my-profile", async ({ page }) => {
    await page.goto("/my-profile");
    await expect(page).toHaveURL("/login");
  });
});
