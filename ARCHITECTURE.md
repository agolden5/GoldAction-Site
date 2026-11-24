# Website architecture

The website is plain HTML, CSS, and browser JavaScript. GitHub Pages serves the root of `main` at `goldaction.net`. `CNAME` binds the domain and `.nojekyll` keeps the files unchanged during publication.

| Route | Responsibility |
| --- | --- |
| `/` | Missed-call text-back: hero with price and a fictional example text, how it works, pricing, messaging policy, and contact. Links to the consultancy. |
| `/privacy/` and `/terms/` | Existing SMS policies and terms. |
| `/consulting/` | Consultancy, founder, product project, AI workflows, workshops, and a browser-only workshop brief builder. Inquiry links open the user's mail client with a topic and the existing support inbox. |
| `/playground/` | Fictional inquiries with prewritten replies and human review steps. JavaScript updates the page in memory. Visitors can also request a live draft when an approved endpoint is configured. |
| `/assets/site-shell.css` and `/assets/site.js` | Shared site navigation styles, mobile menu behavior, and workshop brief builder. |
| `/assets/portfolio.css` and `/assets/revamp.css` | Shared marketing page styles. |
| `/assets/playground.js` | Sample and live draft controls. |

The product's SMS operation is outside this repository. The site does not call Twilio or other messaging services. The workshop brief builder and playground sample mode run in the browser without APIs, analytics, or storage. Copying a brief writes it to the visitor’s clipboard. Live mode sends only a fixed scenario ID. The Worker sends the matching fictional inquiry to Claude and stores quota counters separately.

## Environment and optional provider setup

The static site needs no credentials. The optional Cloudflare Worker in `worker/` has two secret bindings, `ANTHROPIC_API_KEY` and `RATE_LIMIT_SECRET`. It also has a live enable switch and one allowed browser origin. GitHub Pages only gets a public endpoint URL, when configured.

The Worker validates the scenario ID and atomically reserves request quota and a fixed amount against its $5 monthly budget in one SQLite Durable Object. The adapter uses Anthropic’s free token-count endpoint to check the prompt before sending it to Claude Haiku 5.5. It uses a 256-token output cap and a 15-second timeout across both API steps. Unexpected billed usage pauses generation through the end of the UTC month. The browser labels live and sample replies distinctly and falls back to the prewritten sample on failure. There is no automatic provider retry, outbound messaging, tool use, free-text input, or customer data integration.

See [Worker setup](worker/README.md) for the deployment sequence, cost assumptions, settings, test commands, and immediate disable switch.

## Deployment and rollback

Review changes on the local branch. Merging into `main` can publish to Pages, so get the site owner’s explicit approval for the reviewed changes before publishing. After an approved deploy, check the product, policy, portfolio, and demo routes without triggering external activity. If needed, revert the approved site commit on `main` and let Pages publish the revert.
