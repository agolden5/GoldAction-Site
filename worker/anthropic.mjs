import { MAX_BILLED_INPUT_TOKENS, MAX_COUNTED_INPUT_TOKENS, MAX_OUTPUT_TOKENS } from "./cost.mjs";

export const CLAUDE_MODEL = "claude-haiku-5-5";
const TIMEOUT_MS = 15_000;
const SYSTEM = [
  "Write a sample reply to a fictional small-business inquiry for a public demo.",
  "Use 1–3 short sentences and provide exactly two specific before-sending review checks.",
  "Use only the facts in the inquiry. Never invent prices, dates, availability, links,",
  "policy terms, or commitments. Leave decisions to the human reviewer.",
  "If there may be an urgent issue, flag it for the business's existing process.",
].join(" ");

const outputSchema = {
  type: "object",
  properties: {
    draft: { type: "string" },
    review: { type: "array", items: { type: "string" } },
  },
  required: ["draft", "review"],
  additionalProperties: false,
};

function isText(value, limit) {
  return typeof value === "string" && value.trim().length > 0 && value.length <= limit;
}

export class UsageGuardError extends Error {}

function withinUsageLimit(message) {
  const { usage } = message;
  return message.model === CLAUDE_MODEL && Number.isSafeInteger(usage?.input_tokens)
    && usage.input_tokens >= 0 && usage.input_tokens <= MAX_BILLED_INPUT_TOKENS
    && Number.isSafeInteger(usage.output_tokens) && usage.output_tokens >= 0
    && usage.output_tokens <= MAX_OUTPUT_TOKENS
    && (usage.cache_creation_input_tokens ?? 0) === 0
    && (usage.cache_read_input_tokens ?? 0) === 0;
}

// The adapter accepts a fictional inquiry and returns text for a person to review.
export async function generateWithClaude(inquiry, apiKey, send = fetch) {
  const signal = AbortSignal.timeout(TIMEOUT_MS);
  const input = {
    model: CLAUDE_MODEL,
    thinking: { type: "disabled" },
    system: SYSTEM,
    messages: [{ role: "user", content: inquiry }],
    output_config: {
      effort: "low",
      format: { type: "json_schema", schema: outputSchema },
    },
  };

  async function post(path, payload) {
    const response = await send("https://api.anthropic.com/v1/messages" + path, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      redirect: "manual",
      signal,
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error("Provider request failed");
    return response;
  }

  // Counting is free. Leave headroom for the provider’s actual billed input.
  const estimate = await (await post("/count_tokens", input)).json();
  if (!Number.isSafeInteger(estimate?.input_tokens) || estimate.input_tokens < 1
    || estimate.input_tokens > MAX_COUNTED_INPUT_TOKENS) {
    throw new Error("Prompt is outside the input allowance");
  }

  const response = await post("", { ...input, max_tokens: MAX_OUTPUT_TOKENS });
  const message = await response.json().catch(() => null);
  if (!message || !withinUsageLimit(message)) {
    throw new UsageGuardError("Provider usage is outside the reservation assumptions");
  }
  const text = message.content?.find((block) => block.type === "text")?.text;
  if (message.stop_reason !== "end_turn" || !isText(text, 4_096)) {
    throw new Error("Provider returned no complete draft");
  }

  const output = JSON.parse(text);
  if (!isText(output?.draft, 1_000) || !Array.isArray(output.review)
    || output.review.length !== 2 || !output.review.every((item) => isText(item, 300))) {
    throw new Error("Provider output did not match the draft contract");
  }
  return { draft: output.draft.trim(), review: output.review.map((item) => item.trim()) };
}
