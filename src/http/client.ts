import type { AuthManager } from "./authManager.js";

export class RateLimitError extends Error {
  constructor(message: string, readonly retryAfterSeconds: number) {
    super(message);
    this.name = "RateLimitError";
  }
}

export interface Rb209Request {
  method: "get" | "post";
  path: string;
  query?: URLSearchParams;
  body?: unknown;
}

export class Rb209Client {
  constructor(private readonly baseUrl: string, private readonly auth: AuthManager) {}

  async request(req: Rb209Request): Promise<unknown> {
    const qs = req.query && [...req.query.keys()].length ? `?${req.query}` : "";
    const url = `${this.baseUrl}${req.path}${qs}`;

    let token = await this.auth.getAccessToken();
    let res = await this.send(url, req, token);

    if (res.status === 401) {
      token = await this.auth.refresh();
      res = await this.send(url, req, token);
    }

    if (res.status === 429) {
      const reset = Number(res.headers.get("RateLimit-Reset") ?? "600");
      throw new RateLimitError(
        `RB209 rate limit reached; retry after ${reset}s`,
        Number.isFinite(reset) ? reset : 600,
      );
    }

    if (!res.ok) {
      throw new Error(`RB209 ${res.status}: ${await res.text()}`);
    }

    const text = await res.text();
    return text ? JSON.parse(text) : null;
  }

  private send(url: string, req: Rb209Request, token: string): Promise<Response> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    };
    const init: RequestInit = { method: req.method.toUpperCase(), headers };
    if (req.method === "post") {
      headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(req.body ?? {});
    }
    return fetch(url, init);
  }
}
