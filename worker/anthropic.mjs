export const CLAUDE_MODEL = "claude-haiku-5-5";
export const MAX_OUTPUT_TOKENS = 256;
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

// The adapter accepts one fictional inquiry and returns text for the visitor to review.
export async function generateWithClaude(inquiry, apiKey, send = fetch) {
  const response = await send("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    redirect: "manual",
    signal: AbortSignal.timeout(TIMEOUT_MS),
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: MAX_OUTPUT_TOKENS,
      thinking: { type: "disabled" },
      system: SYSTEM,
      messages: [{ role: "user", content: inquiry }],
      output_config: {
        effort: "low",
        format: { type: "json_schema", schema: outputSchema },
      },
    }),
  });
  if (!response.ok) throw new Error("Provider request failed");

  const message = await response.json();
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
