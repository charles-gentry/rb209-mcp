import type { Operation } from "./openapi/types.js";
import type { Rb209Request } from "./http/client.js";
import {
  applyRecommendationDefaults,
  isRecommendationOp,
} from "./recommendationGuardrail.js";

export function buildRequest(op: Operation, args: Record<string, unknown>): Rb209Request {
  let path = op.path;
  const query = new URLSearchParams();
  let hasBody = false;

  for (const p of op.parameters) {
    if (p.in === "path") {
      const value = args[p.name];
      path = path.replace(`{${p.name}}`, encodeURIComponent(String(value)));
    } else if (p.in === "query") {
      const value = args[p.name];
      if (value !== undefined && value !== null) query.set(p.name, String(value));
    } else if (p.in === "body") {
      hasBody = true;
    }
  }

  let body = hasBody ? args.body : undefined;
  if (hasBody && isRecommendationOp(op)) {
    body = applyRecommendationDefaults(body);
  }

  return { method: op.method, path, query, body };
}
