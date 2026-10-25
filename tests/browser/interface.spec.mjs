import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import path from "node:path";
import { mkdir } from "node:fs/promises";

test.beforeEach(async ({ page }) => {
  await page.route("**/js/config.js", (route) =>
    route.fulfill({
      path: path.resolve("tests/fixtures/config-disabled.js"),
      contentType: "text/javascript",
    }),
  );
});

for (const [name, width, height] of [
  ["desktop", 1440, 1000],
  ["tablet", 820, 1180],
  ["mobile", 390, 844],
  ["narrow", 320, 720],
]) {
  test(
    name + ": responsive pages, real empty states, accessible controls",
    async ({ page }) => {
      await page.setViewportSize({ width, height });
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      let firebaseRequests = 0;
      page.on("request", (request) => {
        if (/firebasejs|firebaseio|identitytoolkit/.test(request.url()))
          firebaseRequests++;
      });
      for (const file of ["index.html", "track.html", "driver.html"]) {
        await page.goto("/" + file);
        if (file === "track.html") {
          await expect(page.locator("#connection-status")).toHaveText(
            "Tracking unavailable",
          );
          await expect(page.locator(".bus-map-marker")).toHaveCount(0);
          if (width <= 760)
            await page.getByRole("button", { name: "Bus information" }).click();
          await page.getByRole("button", { name: /FUL-002/ }).click();
          await expect(page.locator("#selected-bus")).toHaveText("FUL-002");
          await expect(page.locator("#focus-bus")).toBeDisabled();
        }
        if (file === "driver.html") {
          await expect(page.locator("#configuration-message")).toContainText(
            "not available yet",
          );
          await expect(
            page.getByRole("button", { name: "Sign in", exact: true }),
          ).toBeDisabled();
        }
        if (file === "index.html") {
          await expect(
            page.getByRole("button", { name: "Open navigation" }),
          ).toBeVisible({ visible: width <= 760 });
        }
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBeTruthy();
        const results = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze();
        expect(
          results.violations.map((v) => ({
            id: v.id,
            nodes: v.nodes.map((n) => n.target),
          })),
        ).toEqual([]);
        await mkdir("artifacts", { recursive: true });
        await page.screenshot({
          path: "artifacts/" + file.replace(".html", "") + "-" + name + ".png",
          fullPage: true,
        });
      }
      expect(errors).toEqual([]);
      expect(firebaseRequests).toBe(0);
    },
  );
}

test("fresh GPS, directional markers, stationary updates, stale data, and reconnect", async ({
  page,
}) => {
  await page.route("**/js/firebase-client.js", (route) =>
    route.fulfill({
      path: path.resolve("tests/fixtures/fleet.js"),
      contentType: "text/javascript",
    }),
  );
  await page.clock.install({ time: new Date("2026-10-24T12:00:00Z") });
  await page.goto("/track.html");
  await expect(page.locator("#connection-status")).toHaveText("Connected");
  const send = async (patch) =>
    page.evaluate((patch) => {
      const now = Date.now();
      window.fixtureBus = {
        busId: "FUL-001",
        status: "ONLINE",
        tripStarted: true,
        latitude: 7.82,
        longitude: 6.7,
        accuracy: 8,
        routeId: "adankolo-felele",
        lastGpsUpdate: now,
        lastHeartbeat: now,
        ...window.fixtureBus,
        ...patch,
      };
      window.testFleet.onBuses({ "FUL-001": window.fixtureBus });
    }, patch);
  await send({});
  await expect(page.locator("#status-FUL-001")).toHaveText("Live");
  await expect(page.locator(".bus-map-marker")).toHaveCount(1);
  await page.clock.runFor(5000);
  const time = await page.evaluate(() => Date.now());
  await send({
    longitude: 6.7004,
    lastGpsUpdate: time,
    lastHeartbeat: time,
    speed: 7,
  });
  await expect(page.locator("#selected-direction")).toHaveText("East");
  await expect(page.locator(".bus-marker-body")).toHaveClass(/is-moving/);
  await page.clock.runFor(1200);
  const marker = page.locator(".bus-map-marker");
  const stoppedPosition = await marker.getAttribute("style");
  await page.clock.runFor(1000);
  expect(await marker.getAttribute("style")).toBe(stoppedPosition);
  const nextTime = await page.evaluate(() => Date.now());
  await send({ lastGpsUpdate: nextTime, speed: 0 });
  await expect(page.locator(".bus-marker-body")).not.toHaveClass(/is-moving/);
  await page.clock.runFor(31_000);
  const heartbeat = await page.evaluate(() => Date.now());
  await send({ lastHeartbeat: heartbeat });
  await expect(page.locator("#status-FUL-001")).toHaveText("GPS stale");
  await expect(page.locator(".bus-marker-body")).toHaveClass(/is-stale/);
  await expect(page.locator("#live-count")).toHaveText("0 live");
  await page.evaluate(() => window.testFleet.onConnection(false));
  await expect(page.locator("#connection-status")).toHaveText(
    "Connection lost",
  );
  await page.evaluate(() => window.testFleet.onConnection(true));
  await expect(page.locator("#status-FUL-001")).toHaveText("GPS stale");
  const freshTime = await page.evaluate(() => Date.now());
  await send({ lastGpsUpdate: freshTime, lastHeartbeat: freshTime });
  await expect(page.locator("#status-FUL-001")).toHaveText("Live");
  await send({ tripStarted: false, status: "OFFLINE" });
  await expect(marker).toHaveCount(0);
});

test("route reference is validated and labeled; failures do not create a fake line", async ({
  page,
}) => {
  await page.route("https://router.project-osrm.org/**", (route) =>
    route.fulfill({
      json: {
        code: "Ok",
        routes: [
          {
            geometry: {
              type: "LineString",
              coordinates: [
                [0, 0],
                [1, 1],
              ],
            },
          },
        ],
      },
    }),
  );
  await page.goto("/track.html");
  await page.locator("#show-route").check();
  await expect(page.locator("#route-message")).toContainText("unavailable");
  await expect(page.locator("#show-route")).not.toBeChecked();
});

test("legacy entry points lead to maintained pages", async ({ page }) => {
  for (const [source, destination] of [
    ["Driver/driver.html?bus=FUL-003", "driver.html"],
    ["bus-tracking-platform/index.html", "index.html"],
    ["tracker.html", "track.html"],
  ]) {
    await page.goto("/" + source);
    await expect(page).toHaveURL(
      new RegExp("/" + destination.replace(".", "\\.") + "$"),
    );
  }
});

test("denied student reads explain unavailable updates without reporting live buses", async ({
  page,
}) => {
  await page.route("**/js/firebase-client.js", (route) =>
    route.fulfill({
      path: path.resolve("tests/fixtures/fleet.js"),
      contentType: "text/javascript",
    }),
  );
  await page.goto("/track.html", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#connection-status")).toHaveText("Connected");
  await page.evaluate(() =>
    window.testFleet.onError({ code: "PERMISSION_DENIED" }),
  );
  await expect(page.locator("#map-notice")).toContainText(
    "database access was denied",
  );
  await expect(page.locator("#live-count")).toHaveText("0 live");
});
