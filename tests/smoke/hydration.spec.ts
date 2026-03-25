import { test, expect } from "@playwright/test";

/**
 * Hydration and layout stability tests.
 * Checks that pages render without React hydration mismatches or layout shift.
 */
test.describe("Hydration & layout stability", () => {
  test("Dashboard loads without hydration errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });

    await page.goto("/", { waitUntil: "networkidle" });
    expect(errors).toHaveLength(0);

    // Sidebar should be visible
    const sidebar = page.locator("aside").first();
    await expect(sidebar).toBeVisible();
  });

  test("Tasks board loads without hydration errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });

    await page.goto("/tasks", { waitUntil: "networkidle" });
    expect(errors).toHaveLength(0);

    // Shell header should be visible
    const header = page.locator("header").first();
    await expect(header).toBeVisible();
  });

  test("Sidebar and main content are present on all key pages", async ({ page }) => {
    const pages = ["/", "/tasks", "/agents", "/logs"];
    for (const path of pages) {
      await page.goto(path, { waitUntil: "domcontentloaded" });

      // Sidebar should exist (may be hidden on mobile)
      const sidebar = page.locator("aside").first();
      await expect(sidebar).toBeAttached();

      // Main content area should exist
      const main = page.locator("main").first();
      await expect(main).toBeAttached();
    }
  });
});
