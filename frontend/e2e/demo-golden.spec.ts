import { expect, test } from "@playwright/test";

test("demo golden path: login -> home -> analytics -> ai -> create order -> orders", async ({ page }) => {
  let orders = [
    {
      id: 77,
      status: "PENDING",
      created_at: "2026-02-28T10:00:00Z",
      comment: "Existing order",
      items_count: 1,
      total: 120,
    },
  ];

  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();
    if (!path.startsWith("/api/")) {
      await route.continue();
      return;
    }

    if (path.endsWith("/api/auth/login/") && method === "POST") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ access: "access-token", refresh: "refresh-token" }),
      });
      return;
    }

    if ((path.endsWith("/api/auth/me/") || path.endsWith("/api/me/")) && method === "GET") {
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

    if (path.endsWith("/api/notifications/") && method === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ items: [], unread_count: 0 }),
      });
      return;
    }

    if (path.endsWith("/api/products/") && method === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          count: 1,
          next: null,
          previous: null,
          results: [
            {
              id: 501,
              supplier_company_id: 20,
              category_id: 1,
              name: "Mock Product",
              description: "",
              price: "100",
              unit: "pcs",
              min_qty: "1",
              in_stock: true,
              supplier_name: "Supplier Mock",
              category_name: "meat",
            },
          ],
        }),
      });
      return;
    }

    if (path.endsWith("/api/analytics/summary/") && method === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          company_id: 10,
          role: "buyer",
          days: 365,
          total_orders: 3,
          total_revenue: 15000,
          daily_revenue: [],
          top_products: [],
          market: { platform_revenue: 100000, platform_orders: 100, company_share_pct: 15 },
          market_trends: [{ month: "2026-01", revenue: 1200 }, { month: "2026-02", revenue: 1300 }],
          sales_trends: [{ month: "2026-01", revenue: 1000 }, { month: "2026-02", revenue: 1400 }],
          category_breakdown: [{ name: "Meat", revenue: 1400, share_pct: 100 }],
          status_funnel: [{ status: "DELIVERED", count: 2 }, { status: "PENDING", count: 1 }],
          insights: ["Demo insight"],
        }),
      });
      return;
    }

    if (path.endsWith("/api/analytics/assistant/query/stream") && method === "POST") {
      await route.fulfill({
        status: 200,
        contentType: "text/plain",
        body: [
          JSON.stringify({ type: "start" }),
          JSON.stringify({ type: "delta", text: "Demo answer" }),
          JSON.stringify({
            type: "done",
            data: {
              summary: "Demo answer",
              probable_causes: [],
              actions: [],
              confidence: 0.8,
              focus_month: null,
              metrics: {
                mom_pct: null,
                delivery_rate_pct: 0,
                cancel_rate_pct: 0,
                market_share_pct: 0,
                top_category_name: "Meat",
                top_category_share_pct: 100,
              },
            },
          }),
        ].join("\n"),
      });
      return;
    }

    if (path.endsWith("/api/orders/create/") && method === "POST") {
      const id = 100 + orders.length;
      orders = [
        {
          id,
          status: "PENDING",
          created_at: "2026-02-28T10:10:00Z",
          comment: "Created from e2e",
          items_count: 1,
          total: 100,
        },
        ...orders,
      ];
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ id, status: "PENDING" }),
      });
      return;
    }

    if (path.endsWith("/api/orders/") && method === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(orders),
      });
      return;
    }

    if (path.includes("/api/orders/") && method === "GET") {
      const id = Number(path.split("/").filter(Boolean).at(-1));
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id,
          status: "PENDING",
          created_at: "2026-02-28T10:10:00Z",
          comment: "Created from e2e",
          buyer_company_id: 10,
          supplier_company_id: 20,
          items: [
            {
              product_id: 501,
              qty: 1,
              price_snapshot: 100,
              name: "Mock Product",
            },
          ],
        }),
      });
      return;
    }

    if (path.includes("/api/deliveries/by_order/") && method === "GET") {
      await route.fulfill({ status: 200, contentType: "application/json", body: "null" });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({}),
    });
  });

  await page.goto("/");
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem("usc_access_token", "access-token");
    localStorage.setItem("usc_refresh_token", "refresh-token");
  });
  await page.reload();

  await expect(page.getByTestId("screen-home")).toBeVisible();
  await expect(page.getByTestId("home-product-grid")).toBeVisible();

  await page.getByTestId("tab-analytics").click();
  await expect(page.locator("#screen-analytics")).toBeVisible();

  await page.getByTestId("tab-ai").click();
  await expect(page.locator("#screen-ai")).toBeVisible();

  await page.getByTestId("tab-home").click();
  await page.getByTestId("product-add-501").click();

  await page.getByTestId("tab-cart").click();
  await expect(page.getByTestId("screen-cart")).toBeVisible();
  await page.getByTestId("cart-open-checkout").click();
  await page.getByTestId("cart-create-order").click();

  await expect(page.getByTestId("screen-orders")).toBeVisible();
  await expect(page.getByTestId("order-card-101")).toBeVisible();
});
