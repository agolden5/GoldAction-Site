# Live Claude playground

GitHub Pages serves the playground. A separate Cloudflare Worker calls Anthropic. Deploy the Worker on a `workers.dev` URL to avoid changing site DNS or the existing product. The Worker and browser entry point both ship disabled.

## Budget and data handling

- Claude Haiku 5.5 costs $0.10 per million input tokens and $0.50 per million output tokens for short prompts at the documented standard rates. The Worker accepts only three fixed fictional scenarios and disables thinking. It checks the prompt using Anthropic’s free token-count endpoint before generation, rejects estimates above 2,048 input tokens, and caps output at 256 tokens.
- At an allowance of 4,096 input tokens and 256 output tokens per call, 1,000 attempts would cost about $0.54 at those rates. This is a conservative estimate, not a measured bill. Check model access and actual token usage in the dedicated workspace before activating the public UI.
- SQLite atomically reserves $0.004 before each attempt and applies a $5 UTC monthly budget to those reservations. Separate limits allow 5 attempts per network fingerprint per UTC day, 50 globally per UTC day, 1,000 per UTC month, and 4 in flight. At the current request limit, reservations cannot exceed $4 per month. Failures keep their reservation. The Worker does not retry and pauses generation for the rest of the UTC month if Claude reports usage outside the reservation assumptions. The counter is independent of Cloudflare and Anthropic account usage.
- A separate Anthropic workspace cap is optional. The Worker limits only traffic it initiates, and its estimates depend on the documented model prices. Use a dedicated key and recheck prices before changing the model or enabling live traffic. Keep the account on Cloudflare Workers Free unless separately approved. The SQLite Durable Object and Worker fit within their current free allowances at planned traffic. Unwanted traffic can exhaust free hosting quotas. Sample mode remains available.
- The Worker uses Cloudflare’s visitor IP header and an encrypted secret to derive a daily HMAC fingerprint. It does not send the IP or fingerprint to Anthropic. The ledger removes expired counters on the next reservation. The application stores no prompts, drafts, raw IPs, or user-provided content, and Worker observability is disabled in the supplied configuration. Cloudflare and Anthropic have their own operational and retention policies.
- CORS is limited to `https://goldaction.net`. A non-browser client can construct an Origin header, so the durable quota and provider workspace cap are the controls on spending.

[Claude model and pricing](https://platform.claude.com/docs/en/models/haiku-5-5/overview) · [Claude token counting](https://platform.claude.com/docs/en/build-with-claude/token-counting) · [Cloudflare Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/) · [Durable Object pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/)

## Test without a key

From the repository root, use Node.js 24 or newer.

```sh
node --test worker/tests/playground.test.mjs
npx wrangler@4.168.0 deploy --dry-run --config worker/wrangler.jsonc
```

The tests use mock provider responses and a local SQLite database. Open the site using the root README’s preview instructions to test sample mode.

## Stage the Worker with live generation off

1. Sign into the intended Cloudflare account, select Workers Free, and set a `workers.dev` subdomain if needed. In [Claude Console](https://platform.claude.com/), create a dedicated workspace for this playground. Confirm Haiku 5.5 access and credits or billing, then create a dedicated key. A Console spend cap is optional because the Worker reserves against its own budget.
2. From the reviewed repository, deploy the Worker with its checked-in `LIVE_ENABLED=false` setting. Verify the selected Cloudflare account before running the deploy command.

   ```sh
   npx wrangler@4.168.0 login
   npx wrangler@4.168.0 deploy --config worker/wrangler.jsonc
   ```

3. In [Cloudflare Workers & Pages](https://dash.cloudflare.com/), open **goldaction-playground → Settings → Variables and Secrets → Add**. Choose **Secret**. Enter `ANTHROPIC_API_KEY` as the name and paste the key directly as the value. If `RATE_LIMIT_SECRET` is already present as a **Secret**, leave it in place. For a new Worker, generate a unique random value of at least 32 characters and save it as a separate **Secret** with that name. Select **Deploy** with `LIVE_ENABLED` still false.
4. Share the public Worker URL with the reviewer. Keep both secret values out of chat, Drive, GitHub, browser code, and plaintext variables. Confirm that the disabled endpoint responds to an allowed CORS preflight and rejects generation before enabling live mode.

For terminal entry, the key can be pasted into the interactive prompt for `npx wrangler@4.168.0 secret put ANTHROPIC_API_KEY --config worker/wrangler.jsonc`. To generate the separate rate limit secret without displaying it, run `openssl rand -hex 32 | npx wrangler@4.168.0 secret put RATE_LIMIT_SECRET --config worker/wrangler.jsonc`. These commands update the selected Worker immediately. Use them while live mode is off.

## Enable and verify

After approving the budget and release, set the Worker’s `LIVE_ENABLED` text variable to `true`, keep `ALLOWED_ORIGIN=https://goldaction.net`, and deploy that version. Verify one fictional generation and its recorded usage before exposing the button. Then set `data-live-endpoint` in `playground/index.html` to the exact HTTPS Worker URL ending in `/api/generate`. Publish the reviewed site change, test both modes, and verify the existing website routes.

To stop provider calls, set `LIVE_ENABLED=false` and deploy the Worker, or revoke the dedicated Anthropic key. The browser shows the prewritten sample when live generation is unavailable. Clear the public endpoint value on the website to hide the live button altogether.

[Cloudflare secret setup](https://developers.cloudflare.com/workers/configuration/secrets/)
