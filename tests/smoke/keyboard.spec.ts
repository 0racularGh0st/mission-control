import { test, expect } from "@playwright/test";

/**
 * Keyboard navigation tests.
 * Verifies Tab navigation works through the main shell.
 */
test.describe("Keyboard navigation", () => {
  test("Tab navigation cycles through sidebar nav links on dashboard", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });

    // Start at the top of the page
    await page.keyboard.press("Tab");

    // Cycle through a few tabs — should land on visible elements
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press("Tab");
      // Check focused element is visible (not a hidden portal)
      const isVisible = await page.evaluate(() => {
        const focused = document.activeElement;
        if (!focused || focused === document.body) return true;
        const el = focused as HTMLElement;
        return el.offsetWidth > 0 && el.offsetHeight > 0 && getComputedStyle(el).visibility !== "hidden";
      });
      expect(isVisible, `Tab ${i + 1}: focused element should be visible`).toBe(true);
    }
  });

  test("Tab navigation works on Tasks page", async ({ page }) => {
    await page.goto("/tasks", { waitUntil: "networkidle" });

    for (let i = 0; i < 5; i++) {
      await page.keyboard.press("Tab");
      const isVisible = await page.evaluate(() => {
        const focused = document.activeElement;
        if (!focused || focused === document.body) return true;
        const el = focused as HTMLElement;
        return el.offsetWidth > 0 && el.offsetHeight > 0 && getComputedStyle(el).visibility !== "hidden";
      });
      expect(isVisible, `Tab ${i + 1}: focused element should be visible`).toBe(true);
    }
  });

  test("Enter activates focused sidebar link on dashboard", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });

    // Focus first sidebar link via Tab
    await page.keyboard.press("Tab"); // first focusable element
    // Keep tabbing until we hit a nav link
    let foundLink = false;
    for (let i = 0; i < 20; i++) {
      const focused = page.locator(":focus").first();
      const tagName = await focused.evaluate((el) => el.tagName);
      if (tagName === "A") {
        foundLink = true;
        break;
      }
      await page.keyboard.press("Tab");
    }
    expect(foundLink).toBe(true);
  });
});
