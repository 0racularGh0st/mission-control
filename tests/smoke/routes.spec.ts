import { test, expect } from "@playwright/test";

/**
 * Smoke tests: verify key routes load and return 200.
 * These are the canary pages — if any of these break, something is seriously wrong.
 */
test.describe("Route availability", () => {
  const routes = [
    { path: "/", label: "Dashboard (home)" },
    { path: "/tasks", label: "Tasks board" },
    { path: "/agents", label: "Agents" },
    { path: "/logs", label: "Logs" },
    { path: "/models", label: "Models" },
    { path: "/automations", label: "Automations" },
    { path: "/memory", label: "Memory" },
    { path: "/costs", label: "Costs" },
    { path: "/settings", label: "Settings" },
  ];

  for (const { path, label } of routes) {
    test(`${label} (${path}) loads without crash`, async ({ page }) => {
      // Collect console errors (Error level only, not warnings)
      const consoleErrors: string[] = [];
      page.on("console", (msg) => {
        if (msg.type() === "error") {
          consoleErrors.push(msg.text());
        }
      });

      const response = await page.goto(path, { waitUntil: "networkidle" });
      expect(response?.status()).toBe(200);

      // Should not have any console errors
      expect(consoleErrors, `Console errors on ${path}`).toHaveLength(0);
    });
  }
});
