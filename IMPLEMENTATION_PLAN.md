# Golden Intelligence website implementation plan

## Baseline

Inspected the clean local checkout of `agolden5/GoldAction-Site` at `d7d5912` on November 24, 2026. The site is plain HTML and inline CSS. There is no package manager, build command, test suite, or server runtime. The README documents that GitHub Pages publishes `main` from the root. Keep `CNAME` and `.nojekyll` in place. Work locally on `website/consultancy-portfolio`.

| Existing route | Preserve |
| --- | --- |
| `/` | Product hero, CTA to `#contact`, example, support email, `#about`, `#how`, `#pricing`, `#messaging`, and `#contact` |
| `/privacy/` | Full policy, including the carrier and SMS consent language |
| `/terms/` | Full terms and SMS policies |
| Product offer | $129/month, first month free, no setup fee, cancel anytime |
| Integrations | Product SMS gateway is documented as Twilio. The website calls no SMS, billing, or booking API. Product operation is outside this checkout. |

Baseline HTML parsing, unique IDs, and internal links passed. Build and automated tests are absent in the baseline. Existing routes can be served directly from a local static server.

## Work and acceptance criteria

- [x] Inspect Git status, source, hosting documentation, existing route and CTA destinations, brand tokens, pricing and policy boundaries.
- [x] Stage this plan before making site edits.
- [x] Add a single Consultancy link after the existing product navigation items. Preserve the product page body, original links and anchors, pricing and messaging verbatim. Leave policy pages and hosting files byte-for-byte intact.
- [x] Add `/consulting/` with AI consultancy positioning, founder context, shipped product work, illustrative AI workflows, and workshop formats. Use the current product as a first-party project. Publish metrics, client claims, and additional bio details only when supplied and verified.
- [x] Add `/playground/` with keyboard-accessible selection of fictional inquiries and visibly labeled, deterministic draft and review examples. The demo should use no personal inputs, provider calls, web storage, sends, or production integrations.
- [x] Reuse gold/ink brand colors and system fonts. Validate mobile and desktop layout, contrast, focus, reduced motion, page navigation, and demo interaction.
- [x] Update README and architecture notes with run instructions, route map, and live API configuration decisions. Static sample mode requires no environment values.
- [x] Verify the original product markup and links against the baseline, policy and hosting checksums, static HTTP responses, and browser interactions. Record actual results and limits.
- [ ] Review before any push to the production branch, Pages configuration change, DNS change, or live deployment.

## Verification and review status

- Verified that the homepage differs from the baseline by one navigation link. Privacy, Terms, `CNAME` and `.nojekyll` match byte for byte.
- Checked all five pages, their internal references, assets and anchors. In Chrome, followed the product CTA and policy links, exercised all three playground scenarios by keyboard, and checked that changing scenarios clears stale replies.
- Confirmed the new layouts have no horizontal overflow at 320 px and fit the desktop layout. Checked key text and focus color pairs for contrast and used no animations on the new pages. This is a targeted check, not a full accessibility audit.
- No package build or test script exists. Changes have been verified locally. SMS operations behind the existing service were outside this repository and were not triggered.
- Confirm the draft founder bio, workshop positioning and support inbox routing before publication. The case study describes the product without client metrics. Review the change on the `website/consultancy-portfolio` branch.

## Optional live demo phase

GitHub Pages serves static files. A live provider requires a separate server or serverless endpoint. Keep GitHub Pages and the SMS service in place. Start by evaluating a dedicated endpoint under a separate origin. Pin allowed origins and use rate and spend controls because CORS alone does not restrict direct requests.

Validate scenario IDs server-side and construct prompts from approved synthetic examples. Set request, token, time and concurrency limits. Reserve worst-case request cost atomically against durable per-visitor and global caps before calling a model. Fail closed if enforcement cannot be reached. Keep credentials and configuration in the endpoint host's secret settings. Use separate Anthropic and optional OpenAI adapters with one explicit provider selection per request. Enable fallback only when configured with its own budget and eligible failure rules. Keep the demo isolated from messaging, email, billing, and customer records. Use mock providers for tests before enabling live access.

Check Claude Console access and available API credits or billing before setting up paid calls. An eligible Claude plan may include credits after linking a Console organization. This project has no provider credentials or chosen runtime.
