# Website architecture

The website is plain HTML, CSS, and one browser script. GitHub Pages serves the root of `main` at `goldaction.net`. `CNAME` binds the domain and `.nojekyll` keeps the files unchanged during publication.

| Route | Responsibility |
| --- | --- |
| `/` | Existing missed-call text-back funnel. The Consultancy link leads into the portfolio. |
| `/privacy/` and `/terms/` | Existing SMS policies and terms. |
| `/consulting/` | Consultancy, founder, product project, AI workflows, and workshops. Inquiry links open the user's mail client with a topic and the existing support inbox. |
| `/playground/` | Fictional inquiries with prewritten replies and human review steps. JavaScript updates the page in memory. |
| `/assets/portfolio.css` and `/assets/playground.js` | Shared styles for the new pages and the playground's private-to-the-browser interaction. |

The product's SMS operation is outside this repository. The site does not call Twilio or other messaging services. The playground has no request endpoint, database, provider calls, user inputs, analytics, or browser persistence.

## Environment and optional provider setup

The static site needs no environment variables. GitHub Pages does not run server-side code. A future live demo needs a separate runtime and durable budget store. Choose and review that host before implementing an adapter.

Suggested server-only configuration names are `PLAYGROUND_LIVE_ENABLED`, `PLAYGROUND_ALLOWED_ORIGIN`, `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, and optional `OPENAI_API_KEY` and `OPENAI_MODEL`. Set project rate, token, time and spend limits in the selected runtime. These names are a design reference. The current site does not read them. Set credentials in the host's secret manager and keep them out of the Pages repository, preview URLs, logs, and browser code.

Use a shared adapter contract that accepts an approved scenario and returns a draft plus review notes. Prefer Anthropic when configured. Treat OpenAI fallback as an explicit feature with its own credentials and budget. Use synthetic scenarios defined server-side and reserve the maximum request cost before calling either provider. Use durable per-visitor and global request limits, a daily spend cap, and bounded timeouts. Avoid automatic cross-provider retries on uncertain billing outcomes. If enforcement or the provider is unavailable, keep sample mode usable. The API must have no access to Twilio, analytics, billing, inboxes, or customer records.

Before enabling live calls, verify the model and API entitlements in the provider account, use mock checks for request validation and failure paths, confirm provider data handling, and review the public demo disclosure.

## Deployment and rollback

Review changes on the local branch. Merging into `main` can publish to Pages, so get Anthony's explicit approval for the reviewed changes before publishing. After an approved deploy, check the product, policy, portfolio, and demo routes without triggering external activity. If needed, revert the approved site commit on `main` and let Pages publish the revert.
