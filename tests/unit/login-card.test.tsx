/**
 * tests/unit/login-card.test.tsx
 * TDD RED phase — LoginCard rendering and behavior stubs.
 * These tests verify the LoginCard module exports the correct structure.
 */
import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const LOGIN_CARD_PATH = path.resolve(
  __dirname,
  "../../src/features/auth/LoginCard.tsx"
);
const LOGIN_PAGE_PATH = path.resolve(
  __dirname,
  "../../src/app/(auth)/login/page.tsx"
);
const ROOT_LAYOUT_PATH = path.resolve(
  __dirname,
  "../../src/app/layout.tsx"
);
const MIDDLEWARE_PATH = path.resolve(
  __dirname,
  "../../src/middleware.ts"
);

describe("LoginCard module (file-level assertions)", () => {
  it("LoginCard.tsx exists", () => {
    expect(fs.existsSync(LOGIN_CARD_PATH)).toBe(true);
  });

  it("LoginCard.tsx contains authClient.signIn.email", () => {
    const content = fs.readFileSync(LOGIN_CARD_PATH, "utf8");
    expect(content).toContain("authClient.signIn.email");
  });

  it("LoginCard.tsx contains zodResolver", () => {
    const content = fs.readFileSync(LOGIN_CARD_PATH, "utf8");
    expect(content).toContain("zodResolver");
  });

  it("LoginCard.tsx contains the Sign In button text", () => {
    const content = fs.readFileSync(LOGIN_CARD_PATH, "utf8");
    expect(content).toContain("Sign In");
  });

  it("LoginCard.tsx contains the error copy for wrong credentials", () => {
    const content = fs.readFileSync(LOGIN_CARD_PATH, "utf8");
    expect(content).toContain(
      "Incorrect email or password. Please try again."
    );
  });

  it("LoginCard.tsx contains isPending or isSubmitting loading state", () => {
    const content = fs.readFileSync(LOGIN_CARD_PATH, "utf8");
    expect(content).toMatch(/isPending|isSubmitting/);
  });
});

describe("Login page module (file-level assertions)", () => {
  it("login/page.tsx exists", () => {
    expect(fs.existsSync(LOGIN_PAGE_PATH)).toBe(true);
  });

  it("login/page.tsx renders LoginCard", () => {
    const content = fs.readFileSync(LOGIN_PAGE_PATH, "utf8");
    expect(content).toContain("LoginCard");
  });

  it("login/page.tsx uses bg-slate-50 background", () => {
    const content = fs.readFileSync(LOGIN_PAGE_PATH, "utf8");
    expect(content).toContain("bg-slate-50");
  });
});

describe("Root layout module (file-level assertions)", () => {
  it("layout.tsx exists", () => {
    expect(fs.existsSync(ROOT_LAYOUT_PATH)).toBe(true);
  });

  it("layout.tsx contains the Sonner Toaster", () => {
    const content = fs.readFileSync(ROOT_LAYOUT_PATH, "utf8");
    expect(content).toContain("Toaster");
  });

  it("layout.tsx contains a skip link", () => {
    const content = fs.readFileSync(ROOT_LAYOUT_PATH, "utf8");
    // Skip link should have href to #main
    expect(content).toMatch(/href="#main"/);
  });
});

describe("Middleware module (file-level assertions)", () => {
  it("middleware.ts exists", () => {
    expect(fs.existsSync(MIDDLEWARE_PATH)).toBe(true);
  });

  it("middleware.ts redirects to /login", () => {
    const content = fs.readFileSync(MIDDLEWARE_PATH, "utf8");
    expect(content).toContain("/login");
  });

  it("middleware.ts contains UX-only comment (CVE-2025-29927)", () => {
    const content = fs.readFileSync(MIDDLEWARE_PATH, "utf8");
    expect(content).toMatch(/UX.only|UX only|security boundary|CVE-2025-29927/i);
  });
});
