import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import path from "node:path";

test.beforeEach(async ({ page }) => {
  await page.route(
    /^https:\/\/(fonts\.(googleapis|gstatic)\.com|[abc]\.tile\.openstreetmap\.org)\//,
    (route) => route.abort(),
  );
  await page.route("**/js/config.js", (route) =>
    route.fulfill({
      path: path.resolve("tests/fixtures/config-disabled.js"),
      contentType: "text/javascript",
    }),
  );
});
for (const width of [1440, 390, 320]) {
  for (const file of ["index.html", "track.html", "driver.html"])
    test(
      file + " dark mode is accessible and fits at " + width + "px",
      async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.emulateMedia({ colorScheme: "dark" });
        await page.goto("/" + file, { waitUntil: "domcontentloaded" });
        await expect(page.locator("html")).toHaveAttribute(
          "data-theme",
          "dark",
        );
        await expect(
          page.getByRole("button", { name: "Switch to light mode" }),
        ).toBeVisible();
        if (file === "track.html" && width <= 760)
          await page.getByRole("button", { name: "Bus information" }).click();
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        const results = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze();
        expect(
          results.violations.map((v) => ({
            id: v.id,
            nodes: v.nodes.map((n) => n.target),
          })),
        ).toEqual([]);
        await page.screenshot({
          path:
            "artifacts/dark-" +
            file.replace(".html", "") +
            "-" +
            width +
            ".png",
          fullPage: true,
        });
      },
    );
}
test("theme preference persists across pages and overrides the system setting", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/index.html");
  await page.getByRole("button", { name: "Switch to dark mode" }).click();
  await page.goto("/track.html");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: "Switch to light mode" }).click();
  await page.goto("/driver.html");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});
