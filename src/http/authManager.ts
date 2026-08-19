export interface AuthOptions {
  baseUrl: string;
  email: string;
  password: string;
}

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export class AuthManager {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private pending: Promise<string> | null = null;

  constructor(private readonly opts: AuthOptions) {}

  async getAccessToken(): Promise<string> {
    if (this.accessToken) return this.accessToken;
    if (this.pending) return this.pending;
    this.pending = this.login().finally(() => { this.pending = null; });
    return this.pending;
  }

  async refresh(): Promise<string> {
    if (this.pending) return this.pending;
    this.pending = this.doRefresh().finally(() => { this.pending = null; });
    return this.pending;
  }

  private async doRefresh(): Promise<string> {
    if (this.refreshToken) {
      const res = await fetch(`${this.opts.baseUrl}/api/users/refresh_token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ Email: this.opts.email, RefreshToken: this.refreshToken }),
      });
      if (res.ok) {
        return this.store((await res.json()) as TokenPair);
      }
    }
    return this.login();
  }

  private async login(): Promise<string> {
    const res = await fetch(`${this.opts.baseUrl}/api/users/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ Email: this.opts.email, Password: this.opts.password }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`RB209 login failed: ${res.status} ${body}`);
    }
    return this.store((await res.json()) as TokenPair);
  }

  private store(pair: TokenPair): string {
    this.accessToken = pair.accessToken;
    this.refreshToken = pair.refreshToken;
    return this.accessToken;
  }
}
