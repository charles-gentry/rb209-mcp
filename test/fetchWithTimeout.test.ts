import { describe, it, expect, beforeAll, afterEach, afterAll } from "vitest";
import { setupServer } from "msw/node";
import { http, HttpResponse, delay } from "msw";
import { fetchWithTimeout, TimeoutError } from "../src/http/fetchWithTimeout.js";

const BASE = "https://api.test";
const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("fetchWithTimeout", () => {
  it("returns the response when the server answers in time", async () => {
    server.use(http.get(`${BASE}/quick`, () => HttpResponse.json({ ok: true })));
    const res = await fetchWithTimeout(`${BASE}/quick`, { method: "GET" }, 1000, "test call");
    expect(await res.json()).toEqual({ ok: true });
  });

  it("throws a named TimeoutError when the server hangs", async () => {
    server.use(http.get(`${BASE}/slow`, async () => {
      await delay(2000);
      return HttpResponse.json({ ok: true });
    }));
    await expect(
      fetchWithTimeout(`${BASE}/slow`, { method: "GET" }, 50, "RB209 /slow"),
    ).rejects.toThrow(TimeoutError);
  });

  it("names the operation and the deadline in the message", async () => {
    server.use(http.get(`${BASE}/slow`, async () => {
      await delay(2000);
      return HttpResponse.json({ ok: true });
    }));
    await expect(
      fetchWithTimeout(`${BASE}/slow`, { method: "GET" }, 1000, "RB209 login"),
    ).rejects.toThrow("RB209 login timed out after 1s");
  });

  it("passes non-timeout network errors through untouched", async () => {
    server.use(http.get(`${BASE}/boom`, () => HttpResponse.error()));
    const err = await fetchWithTimeout(`${BASE}/boom`, { method: "GET" }, 1000, "test call")
      .catch((e) => e);
    expect(err).toBeInstanceOf(Error);
    expect(err).not.toBeInstanceOf(TimeoutError);
  });
});
