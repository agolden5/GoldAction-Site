# goldaction.net

Public website for **Golden Intelligence LLC**. The homepage presents the missed-call text-back service. The consultancy and workflow playground have their own pages.

| Path | Page |
| --- | --- |
| `index.html` | Missed-call text-back and pricing |
| `privacy/index.html` | Privacy Policy at `/privacy/` |
| `terms/index.html` | Terms of Service at `/terms/` |
| `consulting/index.html` | Consultancy and founder portfolio at `/consulting/` |
| `playground/index.html` | Workflow playground at `/playground/` |

## Local preview

From the repository root, run:

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

Open <http://127.0.0.1:8000/>, then follow the Consultancy link. No dependencies, build step, API key, or environment setup are required. The playground shows prewritten replies to fictional inquiries and makes no API calls.

## Verify a change

Run `git diff --check`. In the local preview, open all five pages and check the product anchors, pricing, support links and policies. Try all three playground scenarios with a keyboard and confirm that switching scenarios clears the old reply. Check the new pages at narrow and wide viewport sizes.

## Hosting and API design

GitHub Pages publishes the repository root from `main`, so every file committed here is publicly served at goldaction.net. Keep internal plans and working notes out of the repository (`docs/` is gitignored for that).

Keep `CNAME` and `.nojekyll` in the repository root. Removing `CNAME` breaks the custom domain. `.nojekyll` makes Pages serve the files as-is. Review production changes before merging.

See [Architecture](ARCHITECTURE.md) for deployment, rollback, and optional live API design.
