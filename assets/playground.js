import { scenarios } from "./playground-scenarios.mjs";

const demo = document.querySelector("#demo");
const form = document.querySelector("#scenario-form");
const inquiry = document.querySelector("#inquiry");
const result = document.querySelector("#result");
const status = document.querySelector("#result-status");
const heading = document.querySelector("#draft-heading");
const draft = document.querySelector("#draft");
const review = document.querySelector("#review");
const liveButton = document.querySelector("#live-draft");
const liveNote = document.querySelector("#live-note");
const endpoint = getLiveEndpoint(demo.dataset.liveEndpoint);
let pending = null;

function getLiveEndpoint(value) {
  if (!value) return null;
  try {
    const url = new URL(value);
    const local = location.hostname === "127.0.0.1" && url.hostname === "127.0.0.1";
    if (url.username || url.password || url.search || url.hash || url.pathname !== "/api/generate") return null;
    return url.protocol === "https:" || (local && url.protocol === "http:") ? url.href : null;
  } catch {
    return null;
  }
}

function cancelLiveDraft() {
  pending?.abort();
  pending = null;
  liveButton.disabled = false;
}

function showInquiry() {
  cancelLiveDraft();
  inquiry.textContent = scenarios[form.elements.scenario.value].inquiry;
  result.hidden = true;
  status.textContent = endpoint
    ? "Show a sample draft or generate a reply with Claude."
    : "Select “Show sample draft” to see the reply and review steps.";
}

function showDraft(output, live) {
  heading.textContent = live ? "Claude-generated draft" : "Sample draft reply";
  draft.textContent = output.draft;
  review.replaceChildren(...output.review.map((item) => {
    const bullet = document.createElement("li");
    bullet.textContent = item;
    return bullet;
  }));
  result.hidden = false;
  status.textContent = live
    ? "Claude draft ready. Check the details before using it."
    : "Sample reply and review steps ready.";
}

function showLiveFallback(message) {
  showDraft(scenarios[form.elements.scenario.value], false);
  status.textContent = message;
}

form.addEventListener("change", showInquiry);
form.addEventListener("submit", (event) => {
  event.preventDefault();
  cancelLiveDraft();
  showDraft(scenarios[form.elements.scenario.value], false);
});

liveButton.addEventListener("click", async () => {
  if (!endpoint || pending) return;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  pending = controller;
  liveButton.disabled = true;
  result.hidden = true;
  status.textContent = "Generating a draft with Claude…";
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "omit",
      redirect: "error",
      cache: "no-store",
      signal: controller.signal,
      body: JSON.stringify({ scenario: form.elements.scenario.value }),
    });
    if (pending !== controller) return;
    if (response.status === 429) {
      showLiveFallback("Live generation is at its limit. Here’s the sample draft instead.");
    } else if (!response.ok) {
      throw new Error("Live generation unavailable");
    } else {
      const output = await response.json();
      if (pending === controller) showDraft(output, true);
    }
  } catch {
    if (pending === controller) {
      showLiveFallback("Claude couldn’t finish a draft. Here’s the sample draft instead.");
    }
  } finally {
    clearTimeout(timeout);
    if (pending === controller) {
      pending = null;
      liveButton.disabled = false;
    }
  }
});

if (endpoint) {
  liveButton.hidden = false;
  liveNote.hidden = false;
  document.querySelector("#live-mode-key").hidden = false;
}
showInquiry();
demo.hidden = false;
