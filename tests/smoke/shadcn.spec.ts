import { test, expect } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

/**
 * shadcn canonical import check.
 * Verifies shadcn components are imported from @/components/ui/*,
 * not from ad-hoc styled duplicates.
 */
test.describe("shadcn canonical imports", () => {
  const uiComponentsDir = path.join(
    process.cwd(),
    "components",
    "ui"
  );
  const srcUiComponentsDir = path.join(
    process.cwd(),
    "src",
    "components",
    "ui"
  );

  test("shadcn components directory exists with expected files", () => {
    expect(fs.existsSync(uiComponentsDir) || fs.existsSync(srcUiComponentsDir)).toBe(true);

    const dir = fs.existsSync(uiComponentsDir) ? uiComponentsDir : srcUiComponentsDir;
    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".tsx"));
    expect(files.length).toBeGreaterThan(0);

    // Should have canonical shadcn files
    const expectedComponents = ["button", "card", "dialog", "input", "textarea"];
    for (const comp of expectedComponents) {
      const found = files.some((f) => f.startsWith(comp));
      expect(found, `Expected ${comp} component in ui/ directory`).toBe(true);
    }
  });

  test("All .tsx files import shadcn components from @/components/ui/*", () => {
    const patterns = ["/app", "/src", "/components"]
      .map((d) => path.join(process.cwd(), d))
      .filter(fs.existsSync);

    const badImports: string[] = [];

    function checkFile(filePath: string) {
      if (!filePath.endsWith(".tsx") && !filePath.endsWith(".ts")) return;
      if (filePath.includes("node_modules")) return;

      const content = fs.readFileSync(filePath, "utf-8");

      // Look for imports from @/components/ui
      const uiImportRe = /from\s+['"]@\/components\/ui\//g;
      const matches = content.match(uiImportRe);
      if (!matches) return;

      // Now check no ad-hoc styled shadcn-like components are defined inline
      // This is a heuristic: if someone defines Button/Dialog/Card/etc outside ui/
      // without importing from ui/, that could be a duplicate
      const inlineComponentRe =
        /(?:function|const)\s+(Button|Dialog|Card|Input|Textarea|Command)\s*[=\(]/g;
      const inlineMatches = content.match(inlineComponentRe);
      if (inlineMatches) {
        // Make sure they also import from ui/
        if (!uiImportRe.test(content)) {
          badImports.push(`${filePath}: inline ${inlineMatches[0]} without ui/ import`);
        }
      }
    }

    function walkDir(dir: string) {
      if (dir.includes("node_modules") || dir.includes(".next")) return;
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walkDir(full);
        } else {
          checkFile(full);
        }
      }
    }

    for (const dir of patterns) {
      walkDir(dir);
    }

    expect(badImports, `Bad shadcn imports found:\n${badImports.join("\n")}`).toHaveLength(0);
  });

  test("shadcn components in ui/ export their component functions", () => {
    const dir = fs.existsSync(uiComponentsDir) ? uiComponentsDir : srcUiComponentsDir;
    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".tsx"));

    for (const file of files) {
      const content = fs.readFileSync(path.join(dir, file), "utf-8");
      // Should have at least one export
      expect(content).toMatch(/export\s+(default|function|const|\{)/);
    }
  });
});
