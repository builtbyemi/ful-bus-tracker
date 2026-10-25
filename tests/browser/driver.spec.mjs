import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import path from "node:path";

test.beforeEach(async ({ page }) => {
  await page.route("**/js/firebase-client.js", (route) =>
    route.fulfill({
      path: path.resolve("tests/fixtures/driver.js"),
      contentType: "text/javascript",
    }),
  );
  await page.addInitScript(() => {
    window.testGPS = { cleared: false };
    Object.defineProperty(navigator, "geolocation", {
      value: {
        watchPosition(ok, fail) {
          window.testGPS.ok = ok;
          window.testGPS.fail = fail;
          return 0;
        },
        clearWatch() {
          window.testGPS.cleared = true;
        },
      },
    });
  });
  await page.goto("/driver.html?bus=FUL-003");
});
async function signIn(page) {
  await page.getByLabel("Email address").fill("driver@example.test");
  await page.getByLabel("Password", { exact: true }).fill("test-only-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}

test("wrong credentials, assigned bus ignores URL, start/fix/end confirmation and sign out", async ({
  page,
}) => {
  await page.getByLabel("Email address").fill("driver@example.test");
  await page
    .getByLabel("Password", { exact: true })
    .fill("wrong-test-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.locator("#login-message")).toContainText("incorrect");
  await signIn(page);
  await expect(page.locator("#assigned-bus")).toHaveText("FUL-001");
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(results.violations.map((v) => v.id)).toEqual([]);
  await page.getByRole("button", { name: "Start trip", exact: true }).click();
  await expect(page.locator("#trip-message")).toContainText(
    "Waiting for a fresh",
  );
  await page.evaluate(() =>
    window.testGPS.ok({
      timestamp: Date.now(),
      coords: {
        latitude: 7.82,
        longitude: 6.7,
        accuracy: 9,
        speed: 0,
        heading: null,
      },
    }),
  );
  await expect(page.locator("#driver-status")).toHaveText("Sharing");
  await expect(page.locator("#last-success")).toHaveText("Just now");
  expect(
    await page.evaluate(
      () => window.testDriver.records["buses/FUL-001"].status,
    ),
  ).toBe("ONLINE");
  await page.getByRole("button", { name: "End trip", exact: true }).click();
  await page.getByRole("button", { name: "Keep sharing" }).click();
  await expect(page.locator("#driver-status")).toHaveText("Sharing");
  await page.getByRole("button", { name: "End trip", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "End trip", exact: true })
    .click();
  await expect(page.locator("#trip-message")).toContainText("Trip ended");
  expect(await page.evaluate(() => window.testGPS.cleared)).toBe(true);
  expect(
    await page.evaluate(
      () => window.testDriver.records["buses/FUL-001"].status,
    ),
  ).toBe("OFFLINE");
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page.locator("#login-section")).toBeVisible();
});

test("permission denial stops the trip and has actionable feedback", async ({
  page,
}) => {
  await signIn(page);
  await page.getByRole("button", { name: "Start trip", exact: true }).click();
  await page.evaluate(() => window.testGPS.fail({ code: 1 }));
  await expect(page.locator("#trip-message")).toContainText(
    "permission was denied",
  );
  await expect(page.locator("#driver-status")).toHaveText("Offline");
  await expect(
    page.getByRole("button", { name: "Start trip", exact: true }),
  ).toBeVisible();
});

test("connection loss stops local GPS and reconnect confirms end without resuming", async ({
  page,
}) => {
  await signIn(page);
  await page.getByRole("button", { name: "Start trip", exact: true }).click();
  await page.evaluate(() =>
    window.testDriver.connectionCallback({ val: () => false }),
  );
  await expect(page.locator("#trip-message")).toContainText("Connection lost");
  expect(await page.evaluate(() => window.testGPS.cleared)).toBe(true);
  await page.evaluate(() =>
    window.testDriver.connectionCallback({ val: () => true }),
  );
  await expect(page.locator("#trip-message")).toContainText("Trip ended");
  await expect(page.locator("#driver-status")).toHaveText("Offline");
});

test("unassigned account cannot start a trip", async ({ page }) => {
  await page.evaluate(() => (window.testDriver.assignment = null));
  await signIn(page);
  await expect(page.locator("#assignment-message")).toContainText(
    "not assigned",
  );
  await expect(
    page.getByRole("button", { name: "Start trip", exact: true }),
  ).toBeDisabled();
});
