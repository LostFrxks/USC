import { expect, test } from "@playwright/test";

test.skip("onboarding resumes from saved step after skip", async ({ page }) => {
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();

    if (
      (path.includes("/api/auth/me") || path.includes("/api/me") || path.includes("/api/profile/me")) &&
      method === "GET"
    ) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: 1,
          email: "buyer@test.local",
          first_name: "Buyer",
          last_name: "Demo",
          phone: "+996700111111",
          role: "buyer",
          is_courier_enabled: false,
          companies: [
            {
              company_id: 10,
              name: "Demo Buyer Co",
              company_type: "BUYER",
              role: "OWNER",
              phone: "+996700000000",
              address: "Bishkek",
            },
          ],
        }),
      });
      return;
    }

    if (path.includes("/api/notifications") && method === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ items: [], unread_count: 0 }),
      });
      return;
    }

    if (path.includes("/api/products") && method === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ count: 0, next: null, previous: null, results: [] }),
      });
      return;
    }

    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({}) });
  });

  await page.goto("/");
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem("usc_access_token", "access-token");
    localStorage.setItem("usc_refresh_token", "refresh-token");
    localStorage.setItem("usc_company_id", "10");
    localStorage.setItem("usc_company_name", "Demo Buyer Co");
    localStorage.setItem("usc_app_role", "buyer");
    localStorage.setItem(
      "usc.onboarding.v1.state.1.10.buyer",
      JSON.stringify({
        status: "in_progress",
        stepIndex: 1,
        lastUpdatedAt: Date.now(),
        engineVersion: "1.0.0",
        storageSchemaVersion: 1,
        guideContentVersion: "1.0.0",
      })
    );
  });
  await page.reload();

  await expect(page.locator(".onboarding-card")).toBeVisible();
  await expect(page.locator(".onboarding-progress")).toHaveText("2/8");
  await page.getByRole("button", { name: "Пропустить" }).click();

  await page.reload();
  await expect(page.locator(".onboarding-card")).toBeVisible();
  await expect(page.locator(".onboarding-progress")).toHaveText("2/8");
});
