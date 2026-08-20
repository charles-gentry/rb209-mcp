/**
 * Every RB209 call goes through here so that none of them can hang forever.
 * A stalled request on a stdio MCP server is invisible to the user — the tool
 * call simply never returns — so an explicit deadline is the only way the
 * failure ever reaches them.
 */

export class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TimeoutError";
  }
}

export async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
  what: string,
): Promise<Response> {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  } catch (e) {
    // fetch surfaces an AbortSignal.timeout as a TimeoutError DOMException;
    // some runtimes still report the older AbortError name.
    const name = (e as Error)?.name;
    if (name === "TimeoutError" || name === "AbortError") {
      throw new TimeoutError(`${what} timed out after ${Math.round(timeoutMs / 1000)}s`);
    }
    throw e;
  }
}
