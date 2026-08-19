import { describe, it, expect, afterEach, beforeAll, afterAll } from "vitest";
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";
import { AuthManager } from "../src/http/authManager.js";

const BASE = "https://api.test";
let loginCount = 0;
let refreshCount = 0;

const server = setupServer(
  http.post(`${BASE}/api/users/login`, () => {
    loginCount++;
    return HttpResponse.json({ accessToken: `acc-${loginCount}`, refreshToken: `ref-${loginCount}` });
  }),
  http.post(`${BASE}/api/users/refresh_token`, () => {
    refreshCount++;
    return HttpResponse.json({ accessToken: `refreshed-${refreshCount}`, refreshToken: `ref2-${refreshCount}` });
  }),
);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => { server.resetHandlers(); loginCount = 0; refreshCount = 0; });
afterAll(() => server.close());

const opts = { baseUrl: BASE, email: "a@b.com", password: "pw" };

describe("AuthManager", () => {
  it("logs in once and caches the access token", async () => {
    const am = new AuthManager(opts);
    expect(await am.getAccessToken()).toBe("acc-1");
    expect(await am.getAccessToken()).toBe("acc-1");
    expect(loginCount).toBe(1);
  });

  it("uses the refresh token to obtain a new access token", async () => {
    const am = new AuthManager(opts);
    await am.getAccessToken();
    expect(await am.refresh()).toBe("refreshed-1");
    expect(refreshCount).toBe(1);
  });

  it("falls back to a fresh login when refresh fails", async () => {
    const am = new AuthManager(opts);
    await am.getAccessToken();
    server.use(
      http.post(`${BASE}/api/users/refresh_token`, () =>
        HttpResponse.json({ error: "expired" }, { status: 401 })),
    );
    const token = await am.refresh();
    expect(token).toBe("acc-2"); // re-login incremented loginCount to 2
  });

  it("throws a descriptive error when login fails", async () => {
    server.use(
      http.post(`${BASE}/api/users/login`, () =>
        HttpResponse.json({ errorCode: "L04", error: "Credentials are not valid" }, { status: 401 })),
    );
    const am = new AuthManager(opts);
    await expect(am.getAccessToken()).rejects.toThrow(/login failed/i);
  });
});
