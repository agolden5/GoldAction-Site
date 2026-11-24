import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { generateWithClaude, UsageGuardError } from "../anthropic.mjs";
import { BudgetLedger, LIMITS } from "../budget.mjs";
import { ATTEMPT_RESERVE_MICROS, MONTHLY_BUDGET_MICROS } from "../cost.mjs";
import { handleRequest } from "../gateway.mjs";
import { scenarios } from "../../assets/playground-scenarios.mjs";

const ORIGIN = "https://goldaction.net";
const OUTPUT = { draft: "Thanks for reaching out.", review: ["Check availability.", "Confirm the policy."] };

function request(body = '{"scenario":"estimate"}', headers = {}, method = "POST") {
  return new Request("https://goldaction-playground.example/api/generate", {
    method,
    headers: { Origin: ORIGIN, "Content-Type": "application/json", "CF-Connecting-IP": "192.0.2.1", ...headers },
    ...(method === "POST" ? { body } : {}),
  });
}

function gateway(overrides = {}) {
  const calls = [];
  const tasks = [];
  const stub = {
    async reserve(visitor) {
      calls.push(["reserve", visitor]);
      return { lease: "test-lease" };
    },
    async release(lease, pause) {
      calls.push(["release", lease, pause]);
    },
    ...overrides,
  };
  const env = {
    LIVE_ENABLED: "true", ALLOWED_ORIGIN: ORIGIN,
    ANTHROPIC_API_KEY: "fake-key", RATE_LIMIT_SECRET: "test-secret".repeat(4),
    BUDGET: { idFromName: (name) => name, get: () => stub },
  };
  const context = { waitUntil: (task) => tasks.push(task) };
  let generator = async (inquiry, key) => {
    calls.push(["provider", inquiry, key]);
    return OUTPUT;
  };
  return {
    calls, env, tasks,
    run: (input) => handleRequest(input, env, context, generator),
    setGenerator: (fn) => { generator = fn; },
  };
}

test("the gateway sends only the fixed scenario after reserving and then releases concurrency", async () => {
  const g = gateway();
  const response = await g.run(request());
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), ORIGIN);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.deepEqual(await response.json(), OUTPUT);
  await Promise.all(g.tasks);
  assert.equal(g.calls[0][0], "reserve");
  assert.match(g.calls[0][1], /^[a-f0-9]{64}$/);
  assert.deepEqual(g.calls.slice(1), [["provider", scenarios.estimate.inquiry, "fake-key"], ["release", "test-lease", false]]);
});

test("malformed, unauthenticated-context, oversized, and disabled requests never reach the budget or provider", async () => {
  const g = gateway();
  assert.equal((await g.run(request(undefined, { Origin: "https://other.example" }))).status, 403);
  for (const body of ['{"scenario":"__proto__"}', '{"scenario":"estimate","text":"extra"}', "x".repeat(129), "null"]) {
    assert.equal((await g.run(request(body))).status, 400);
  }
  assert.equal((await g.run(request(undefined, { "CF-Connecting-IP": "" }))).status, 503);
  g.env.ANTHROPIC_API_KEY = "";
  assert.equal((await g.run(request())).status, 503);
  assert.deepEqual(g.calls, []);
});

test("preflight permits only the site, and quota or storage errors fail closed", async () => {
  const g = gateway({ reserve: async () => ({ retryAfter: 60 }) });
  const preflight = await g.run(request(undefined, { "Access-Control-Request-Method": "POST" }, "OPTIONS"));
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get("Access-Control-Allow-Headers"), "Content-Type");
  const blocked = await g.run(request());
  assert.equal(blocked.status, 429);
  assert.equal(blocked.headers.get("Retry-After"), "60");
  assert.deepEqual(g.calls, []);
  const down = gateway({ reserve: async () => { throw new Error("storage unavailable"); } });
  assert.equal((await down.run(request())).status, 503);
  assert.deepEqual(down.calls, []);
});

test("provider failure returns a generic response with no retry", async () => {
  const g = gateway();
  let attempts = 0;
  g.setGenerator(async () => {
    attempts++;
    throw new Error("Sensitive upstream details");
  });
  const response = await g.run(request());
  assert.equal(response.status, 502);
  assert.deepEqual(await response.json(), { error: "generation_failed" });
  await Promise.all(g.tasks);
  assert.equal(attempts, 1);
  assert.equal(g.calls.at(-1)[0], "release");
});

test("the Claude adapter counts input, caps structured generation, and rejects incomplete drafts", async () => {
  const data = {
    model: "claude-haiku-5-5",
    usage: { input_tokens: 190, output_tokens: 40 },
    stop_reason: "end_turn",
    content: [{ type: "text", text: JSON.stringify(OUTPUT) }],
  };
  const sent = [];
  const answer = await generateWithClaude(scenarios.booking.inquiry, "fake-key", async (url, options) => {
    assert.equal(options.headers["x-api-key"], "fake-key");
    assert.equal(options.redirect, "manual");
    const body = JSON.parse(options.body);
    assert.equal(body.model, "claude-haiku-5-5");
    assert.deepEqual(body.thinking, { type: "disabled" });
    assert.equal(body.output_config.effort, "low");
    assert.equal(body.output_config.format.type, "json_schema");
    assert.deepEqual(body.messages, [{ role: "user", content: scenarios.booking.inquiry }]);
    sent.push({ url, body });
    return Response.json(url.endsWith("/count_tokens") ? { input_tokens: 200 } : data);
  });
  assert.deepEqual(answer, OUTPUT);
  assert.equal(sent[0].url, "https://api.anthropic.com/v1/messages/count_tokens");
  assert.equal(sent[1].url, "https://api.anthropic.com/v1/messages");
  const { max_tokens, ...draftInput } = sent[1].body;
  assert.equal(max_tokens, 256);
  assert.deepEqual(sent[0].body, draftInput);
  await assert.rejects(generateWithClaude("sample", "fake-key", async () =>
    Response.redirect("https://example.com/", 302)));
  const stub = (response) => async (url) => Response.json(url.endsWith("/count_tokens") ? { input_tokens: 200 } : response);
  await assert.rejects(generateWithClaude("sample", "fake-key", stub({ ...data, stop_reason: "max_tokens" })));
  await assert.rejects(generateWithClaude("sample", "fake-key", stub({
    ...data, content: [{ type: "text", text: '{"draft":"x","review":["one"]}' }],
  })));
  await assert.rejects(generateWithClaude("sample", "fake-key", stub({
    ...data, usage: { input_tokens: 4097, output_tokens: 40 },
  })), UsageGuardError);
});

test("an oversized or unverifiable count never makes a paid generation request", async () => {
  for (const count of [2049, -1, null]) {
    const calls = [];
    await assert.rejects(generateWithClaude("sample", "fake-key", async (url) => {
      calls.push(url);
      return Response.json({ input_tokens: count });
    }));
    assert.deepEqual(calls, ["https://api.anthropic.com/v1/messages/count_tokens"]);
  }
});

test("unexpected billed usage asks the budget ledger to suspend the Worker", async () => {
  const g = gateway();
  g.setGenerator(async () => { throw new UsageGuardError("Unexpected output"); });
  assert.equal((await g.run(request())).status, 502);
  assert.deepEqual(g.calls.at(-1), ["release", "test-lease", true]);
});

function ledger(t, expose = () => {}) {
  const db = new DatabaseSync(":memory:");
  t.after(() => db.close());
  expose(db);
  const sql = { exec(statement, ...args) {
    const rows = db.prepare(statement).all(...args);
    return { toArray: () => rows, one: () => rows[0] };
  } };
  return new BudgetLedger({
    sql,
    transactionSync(callback) {
      db.exec("BEGIN");
      try {
        const result = callback();
        db.exec("COMMIT");
        return result;
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
    },
  });
}

test("reservations survive release, respect the visitor limit, and reset at UTC midnight", (t) => {
  const service = ledger(t);
  const now = Date.UTC(2026, 10, 24, 23, 59);
  for (let i = 0; i < LIMITS.perVisitorDaily; i++) {
    const result = service.reserve("same-visitor", now);
    assert.ok(result.lease);
    service.release(result.lease);
  }
  assert.deepEqual(service.reserve("same-visitor", now), { retryAfter: 60 });
  assert.ok(service.reserve("same-visitor", now + 60_000).lease);
});

test("global day, month, and concurrency caps cannot be bypassed by additional visitors", (t) => {
  const service = ledger(t);
  const now = Date.UTC(2026, 10, 1);
  for (let i = 0; i < LIMITS.concurrent; i++) assert.ok(service.reserve(`initial:${i}`, now).lease);
  assert.deepEqual(service.reserve("extra", now), { retryAfter: 15 });
  const days = LIMITS.monthly / LIMITS.daily;
  for (let day = 0; day < days; day++) {
    const start = now + day * 86_400_000 + 30_001;
    for (let i = day === 0 ? LIMITS.concurrent : 0; i < LIMITS.daily; i++) {
      const result = service.reserve(`day:${day}:${i}`, start);
      assert.ok(result.lease);
      service.release(result.lease);
    }
    assert.ok(service.reserve("extra", start).retryAfter);
  }
  assert.ok(service.reserve("extra", now + days * 86_400_000).retryAfter);
  assert.ok(service.reserve("extra", Date.UTC(2026, 11, 1)).lease);
});

test("a reservation cannot push the monthly USD ledger over the app budget", (t) => {
  let db;
  const service = ledger(t, (storage) => { db = storage; });
  const now = Date.UTC(2026, 10, 24);
  const monthEnd = Date.UTC(2026, 11, 1);
  db.prepare("INSERT INTO counts VALUES ('monthly-spend', ?, ?)").run(
    monthEnd, MONTHLY_BUDGET_MICROS - ATTEMPT_RESERVE_MICROS,
  );
  const accepted = service.reserve("visitor-one", now);
  assert.ok(accepted.lease);
  service.release(accepted.lease);
  assert.equal(db.prepare("SELECT used FROM counts WHERE key = 'monthly-spend'").get().used, MONTHLY_BUDGET_MICROS);
  assert.equal(service.reserve("visitor-two", now).retryAfter, (monthEnd - now) / 1000);
  assert.ok(service.reserve("visitor-two", monthEnd).lease);
});

test("a provider usage anomaly blocks the rest of the UTC month", (t) => {
  const service = ledger(t);
  const now = Date.UTC(2026, 10, 24);
  const monthEnd = Date.UTC(2026, 11, 1);
  const first = service.reserve("visitor-one", now);
  service.release(first.lease, true, now);
  assert.equal(service.reserve("visitor-two", now).retryAfter, (monthEnd - now) / 1000);
  assert.ok(service.reserve("visitor-two", monthEnd).lease);
});
