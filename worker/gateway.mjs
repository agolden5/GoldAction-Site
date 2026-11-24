import { isScenario, scenarios } from "../assets/playground-scenarios.mjs";
import { generateWithClaude, UsageGuardError } from "./anthropic.mjs";

const MAX_REQUEST_BYTES = 128;
const encoder = new TextEncoder();

function reply(status, data, origin, otherHeaders = {}) {
  const headers = {
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Vary": "Origin",
    ...otherHeaders,
  };
  if (origin) headers["Access-Control-Allow-Origin"] = origin;
  if (data === null) return new Response(null, { status, headers });
  return Response.json(data, { status, headers });
}

async function readScenario(request) {
  const contentType = request.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
  if (contentType !== "application/json" || !request.body
    || Number(request.headers.get("content-length")) > MAX_REQUEST_BYTES) return null;

  const reader = request.body.getReader();
  const bytes = new Uint8Array(MAX_REQUEST_BYTES);
  let used = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (used + value.length > bytes.length) {
        await reader.cancel();
        return null;
      }
      bytes.set(value, used);
      used += value.length;
    }

    const value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes.subarray(0, used)));
    return value && Object.keys(value).length === 1 && isScenario(value.scenario) ? value.scenario : null;
  } catch {
    return null;
  } finally {
    reader.releaseLock();
  }
}

async function fingerprint(ip, secret) {
  const day = new Date().toISOString().slice(0, 10);
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const result = await crypto.subtle.sign("HMAC", key, encoder.encode(`${day}:${ip}`));
  return Array.from(new Uint8Array(result), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function handleRequest(request, env, context, generate = generateWithClaude) {
  const url = new URL(request.url);
  const origin = request.headers.get("origin");
  if (url.pathname !== "/api/generate") return reply(404, { error: "not_found" });
  if (!origin || origin !== env.ALLOWED_ORIGIN) return reply(403, { error: "origin_denied" });

  if (request.method === "OPTIONS") {
    if (request.headers.get("Access-Control-Request-Method") !== "POST") {
      return reply(405, { error: "method_denied" }, origin);
    }
    return reply(204, null, origin, {
      "Access-Control-Allow-Methods": "POST",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "600",
    });
  }
  if (request.method !== "POST") return reply(405, { error: "method_denied" }, origin, { "Allow": "POST, OPTIONS" });

  const ip = request.headers.get("CF-Connecting-IP");
  if (env.LIVE_ENABLED !== "true" || !env.ANTHROPIC_API_KEY || !env.BUDGET
    || !env.RATE_LIMIT_SECRET || env.RATE_LIMIT_SECRET.length < 32 || !ip) {
    return reply(503, { error: "unavailable" }, origin);
  }

  const scenario = await readScenario(request);
  if (!scenario) return reply(400, { error: "invalid_scenario" }, origin);

  let budget, reservation;
  try {
    budget = env.BUDGET.get(env.BUDGET.idFromName("goldaction-playground-v1"));
    reservation = await budget.reserve(await fingerprint(ip, env.RATE_LIMIT_SECRET));
  } catch {
    // A failed reservation must never become a billable provider request.
    return reply(503, { error: "unavailable" }, origin);
  }

  if (!reservation?.lease) {
    if (!Number.isFinite(reservation?.retryAfter)) return reply(503, { error: "unavailable" }, origin);
    return reply(429, { error: "rate_limited" }, origin, {
      "Retry-After": String(reservation.retryAfter),
    });
  }

  let pause = false;
  try {
    const output = await generate(scenarios[scenario].inquiry, env.ANTHROPIC_API_KEY);
    return reply(200, output, origin);
  } catch (error) {
    pause = error instanceof UsageGuardError;
    return reply(502, { error: "generation_failed" }, origin);
  } finally {
    // Spend remains reserved even if a response failed or timed out.
    const release = Promise.resolve().then(() => budget.release(reservation.lease, pause)).catch(() => {});
    if (pause) await release;
    else context.waitUntil(release);
  }
}
