import { describe, it, expect, beforeAll, afterEach, afterAll } from "vitest";
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";
import { AuthManager } from "../src/http/authManager.js";
import { Rb209Client, RateLimitError } from "../src/http/client.js";

const BASE = "https://api.test";
const server = setupServer(
  http.post(`${BASE}/api/users/login`, () =>
    HttpResponse.json({ accessToken: "good", refreshToken: "ref" })),
);
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const makeClient = () => new Rb209Client(BASE, new AuthManager({ baseUrl: BASE, email: "a@b.com", password: "pw" }));

describe("Rb209Client", () => {
  it("injects the bearer token and returns JSON", async () => {
    let seen = "";
    server.use(http.get(`${BASE}/api/Soil/SoilTypes`, ({ request }) => {
      seen = request.headers.get("authorization") ?? "";
      return HttpResponse.json([{ soilTypeId: 0, soilType: "Light sand" }]);
    }));
    const data = await makeClient().request({ method: "get", path: "/api/Soil/SoilTypes" });
    expect(seen).toBe("Bearer good");
    expect(data).toEqual([{ soilTypeId: 0, soilType: "Light sand" }]);
  });

  it("refreshes and retries once on 401", async () => {
    let calls = 0;
    server.use(
      http.post(`${BASE}/api/users/refresh_token`, () =>
        HttpResponse.json({ accessToken: "good2", refreshToken: "ref2" })),
      http.get(`${BASE}/api/Field/Countries`, ({ request }) => {
        calls++;
        const auth = request.headers.get("authorization");
        if (auth === "Bearer good") return HttpResponse.json({ error: "expired" }, { status: 401 });
        return HttpResponse.json([{ countryId: 1 }]);
      }),
    );
    const data = await makeClient().request({ method: "get", path: "/api/Field/Countries" });
    expect(calls).toBe(2);
    expect(data).toEqual([{ countryId: 1 }]);
  });

  it("throws RateLimitError with retry seconds on 429", async () => {
    server.use(http.get(`${BASE}/api/Soil/SoilTypes`, () =>
      new HttpResponse("You have made too many requests", {
        status: 429,
        headers: { "RateLimit-Reset": "42" },
      })));
    try {
      await makeClient().request({ method: "get", path: "/api/Soil/SoilTypes" });
      throw new Error("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(RateLimitError);
      expect((e as RateLimitError).retryAfterSeconds).toBe(42);
    }
  });
});
