# goldaction.net

Public website for **Golden Intelligence LLC**, a missed-call text-back SMS
service for small businesses.

## Contents

| Path                 | Page                        |
| -------------------- | --------------------------- |
| `index.html`         | Landing page                |
| `privacy/index.html` | Privacy Policy — `/privacy` |
| `terms/index.html`   | Terms of Service — `/terms` |

Every page is plain HTML with inlined CSS. There is no build step, no
dependencies, and no JavaScript — the files in this repository are exactly what
gets served.

## Hosting

Served by GitHub Pages from the `main` branch, root directory.

Two files must stay in the repository root:

- **`CNAME`** — binds the `goldaction.net` custom domain. Removing it breaks the
  domain.
- **`.nojekyll`** — tells Pages to serve the files as-is rather than running
  them through Jekyll.

### Setup

1. Settings → Pages → Build and deployment → Source: **Deploy from a branch**
2. Branch: **`main`**, folder: **`/ (root)`**
3. Confirm the custom domain reads `goldaction.net`, and enable
   **Enforce HTTPS** once the certificate finishes provisioning.

## Editing

Edit the HTML directly and commit. Changes are live within a minute or two of
pushing to `main`.

To preview locally, open the `.html` files in a browser, or serve the directory:

```sh
python3 -m http.server 8000
```

Then visit <http://localhost:8000/>.
