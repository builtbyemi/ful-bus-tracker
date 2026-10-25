import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir } from "node:fs/promises";
const browser = await chromium.launch({
  channel: process.env.PLAYWRIGHT_CHANNEL || "chromium",
});
await mkdir("artifacts", { recursive: true });
try {
  for (const [name, width, height] of [
    ["desktop", 1440, 1000],
    ["mobile", 390, 844],
    ["narrow", 320, 720],
  ]) {
    const context = await browser.newContext({ viewport: { width, height } });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("http://127.0.0.1:4173", { waitUntil: "networkidle" });
    if (
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      )
    )
      throw new Error(name + " overflows");
    if (width < 761) {
      await page.getByRole("button", { name: "Open navigation" }).click();
      await page
        .getByRole("navigation")
        .getByRole("link", { name: "How It Works" })
        .click();
      if (
        (await page
          .getByRole("button", { name: "Open navigation" })
          .getAttribute("aria-expanded")) !== "false"
      )
        throw new Error("Menu did not close");
      await page.evaluate(() => scrollTo(0, 0));
    }
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    if (result.violations.length)
      throw new Error(
        JSON.stringify(
          result.violations.map((v) => ({
            id: v.id,
            nodes: v.nodes.map((n) => n.target),
          })),
        ),
      );
    if (errors.length) throw new Error(errors.join("; "));
    await page.screenshot({
      path: "artifacts/homepage-" + name + ".png",
      fullPage: true,
    });
    console.log(
      name + ": no overflow, no JavaScript errors, accessibility checks passed",
    );
    await context.close();
  }
} finally {
  await browser.close();
}
