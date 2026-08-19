export interface Rb209Config {
  baseUrl: string;
  email: string;
  password: string;
  enabledGroups: string[] | null;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Rb209Config {
  const email = env.RB209_EMAIL;
  const password = env.RB209_PASSWORD;
  if (!email) throw new Error("Missing required env var RB209_EMAIL");
  if (!password) throw new Error("Missing required env var RB209_PASSWORD");

  const baseUrl = (env.RB209_BASE_URL ?? "https://rb209api.ahdb.org.uk").replace(/\/+$/, "");

  const groupsRaw = (env.RB209_ENABLED_GROUPS ?? "").trim();
  const enabledGroups = groupsRaw
    ? groupsRaw.split(",").map((g) => g.trim()).filter(Boolean)
    : null;

  return { baseUrl, email, password, enabledGroups };
}
