# /manage back office: custom CMS + sales log

Date: 2026-08-13
Status: Approved by user, pending spec review

## Goal

Replace today's Decap CMS admin with one custom-built back office at
`/manage` that staff actually enjoy using, covering two things:

1. **Catalog** — products, prices (per region), and the banner message.
   Functionally the same as what Decap did, just through our own UI.
2. **Sales** — a manually-entered log of orders, since the storefront has
   no payment processor and every order today happens over WhatsApp,
   off-platform.

One login (the existing shared password), one Worker, one nice-looking
app, instead of Decap's generic form UI plus a separate system for sales.

## Non-goals (explicit, from the conversation)

- **No changes to the live storefront.** Not the checkout button, not
  `js/main.js`, not `index.html` except the one footer change below,
  which was explicitly requested. Sales are entered by hand; nothing
  auto-captures an order from the cart.
- **No totals, summaries, or analytics.** Sales tracking means an
  accurate, editable log — nothing more. CSV export is the deliberate
  escape hatch for anyone who wants to crunch numbers later.
- **No tiered access.** Catalog and sales share one password, per the
  earlier decision.
- **No WhatsApp click-tracking build.** GA4 already auto-tracks outbound
  link clicks (Enhanced Measurement), which covers this. Confirming that
  and optionally adding a named `checkout_click` event is a separate,
  future, one-line change to the live checkout handler — not part of
  this project.
- **No rate-limiting beyond what's proportionate.** Covered in Security
  below.

## Why not keep Decap

Decap's `github` backend needs staff to either have a GitHub account
(wrong fit, already ruled out) or go through the OAuth-popup-postMessage
handshake we built a password gate in front of. That gate works, but
Decap's UI itself is generic — a plain list-editor for arrays, a button
that will always say "Login with GitHub" no matter what's behind it. The
user asked directly for something custom instead. Once we're building
real forms for products/prices/banner anyway, running Decap in parallel
for nothing is two systems where one does the job.

## Architecture

One Cloudflare Worker, `innerathlete-backoffice` (replaces
`innerathlete-cms-auth`, which gets torn down once this is live), fronting:

- **A GitHub token** (the fine-grained PAT already created, scoped to
  just this repo, Contents read/write) — used for the Catalog tab, via
  GitHub's Contents API instead of Decap.
- **A D1 database** (`innerathlete-sales`) — used for the Sales tab.

A single-page app at `/manage/index.html` (plain HTML/CSS/vanilla JS, no
framework, no build step) talks to this Worker over a small JSON API.
Login screen first; two tabs after: Catalog, Sales.

```
Staff browser  --password-->  Worker /auth  --session token-->  Staff browser
Staff browser  --Bearer token + JSON-->  Worker /api/*
Worker  --Contents API + GITHUB_PAT-->  GitHub (content/products.json, content/banner.json, img/uploads/*)
Worker  --SQL-->  D1 (sales table)
```

A commit to `content/products.json` or `content/banner.json` lands on
`main` exactly like a Decap save did, which means the existing
`Build and Minify Assets` GitHub Action (and inside it,
`content/sync_content.py`, the JSON-LD price sync from earlier) fires
the same way. Nothing about that pipeline changes.

## Auth

Simpler than Decap required, because we're not pretending to be a GitHub
login anymore:

1. `POST /auth {password}` — Worker checks it against the `STAFF_PASSWORD`
   secret (already set, same one used today).
2. On success, the Worker issues a signed session token: a JSON payload
   (just an expiry timestamp) plus an HMAC-SHA256 signature, using the
   Worker's native Web Crypto API — no JWT library, nothing to install.
   Signed with a new secret, `SESSION_SECRET` (random, Worker-only,
   generated during setup).
3. The browser holds the token in `localStorage` and sends it as
   `Authorization: Bearer <token>` on every `/api/*` call. The Worker
   verifies the signature and expiry before doing anything.
4. Tokens expire after 24 hours. No "remember me" — logging in again is
   a five-second password entry, not worth persisting longer.

Tradeoff, stated plainly: `localStorage` is vulnerable to XSS (a
malicious script could steal the token), not to CSRF (a cookie's usual
weakness). Acceptable for an internal tool with one shared low-stakes
credential and no untrusted content rendered unescaped anywhere in
`/manage` (see Security).

## Catalog tab

Forms for exactly the fields that exist today, not a generic list editor:

- Each product: name, description, price per currency (USD/LKR/MVR),
  available sizes (checkboxes), colors (name, swatch, mobile/desktop
  photo upload).
- Banner: the three region messages (Sri Lanka / Maldives /
  International), same as `content/banner.json` today.

API:
- `GET /api/products` → current `content/products.json` contents + the
  file's git SHA (GitHub's Contents API needs the SHA of the version
  being replaced, to update rather than accidentally overwrite a
  concurrent edit).
- `PUT /api/products {content, sha}` → commits the update.
- `GET /api/banner`, `PUT /api/banner {content, sha}` → same pattern.
- `POST /api/images {filename, base64}` → commits a new file under
  `img/uploads/`, returns its path for the color's image field.

## Sales tab

A structured entry form, not free text — staff pick from the real
product list (fetched from the same `content/products.json`) rather
than retyping names, which also means the data comes out clean enough
for the CSV export to be genuinely useful later.

Fields per sale:
- Date (defaults to today)
- Customer name, customer phone (optional — the whole reason this is
  manual is that this information only ever exists in the WhatsApp
  conversation)
- One or more line items: product (dropdown), size, color, quantity,
  price (auto-filled from the catalog, editable — covers discounts or
  one-off adjustments)
- Currency (USD/LKR/MVR)
- Total (auto-summed from line items, editable)
- Status: **Paid** or **Pending**, defaulting to **Paid** — since entry
  happens after a staff member already knows the order is confirmed,
  unlike the auto-capture idea we dropped. Pending stays available for
  the odd case (bank transfer still clearing, etc.).
- Notes (free text, optional)

Below the form: a list of existing sales, editable, with a status
toggle and a basic filter (date range, paid/pending) for findability —
not analytics, just being able to find something in a list that's grown
past a dozen rows.

A **CSV export** button downloads the current (filtered) list straight
from the browser. This is the intentional ceiling for "basic": if anyone
ever wants totals or trends, they open the CSV in a spreadsheet rather
than me building a dashboard now.

API:
- `GET /api/sales?status=&from=&to=` → list from D1.
- `POST /api/sales {…}` → insert a row.
- `PATCH /api/sales/:id {…}` → update a row (status, corrections).
- `GET /api/sales/export?status=&from=&to=` → same query, returned as
  `text/csv` with a `Content-Disposition: attachment` header.

### D1 schema

```sql
CREATE TABLE sales (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT,
  status TEXT NOT NULL DEFAULT 'paid' CHECK (status IN ('pending','paid')),
  currency TEXT NOT NULL CHECK (currency IN ('USD','LKR','MVR')),
  items TEXT NOT NULL,        -- JSON array: [{name,size,color,qty,price}]
  total REAL NOT NULL,
  customer_name TEXT,
  customer_phone TEXT,
  notes TEXT
);
```

One row per sale, line items as a JSON column rather than a separate
table — the simplest schema that fits "basic." Deliberate ceiling: if
per-product sales analysis is ever wanted, this is the point that needs
normalizing into a real `sale_items` table. Not needed for what's being
asked now.

## Look and feel

Not a generic gray admin panel. Reuses the site's own brand: Audiowide
for headings, the dark/green (`#3ce76a`) palette, the `iA` mark on the
login screen — most of this can come straight from the existing
`styles.css` custom properties (`--font-head`, `--accent`, etc.) rather
than being invented fresh. Save actions get a small toast confirmation
instead of a silent reload. Responsive — staff are as likely to be on a
phone as a laptop, matching how the rest of this business already runs
(WhatsApp-first).

## Entry point

- Served at `/manage/` instead of `/admin/` (per request).
- The footer's `&copy; 2026 innerAthlete. All Rights Reserved.` line:
  the word "innerAthlete" becomes a link to `/manage/`. Low-visibility on
  purpose — customers won't think twice about it, staff know to look
  there. This is the one live-site (`index.html`) change in this
  project, explicitly requested rather than incidental.

## Migration from Decap

Once `/manage` is built and verified working end to end:
- Delete `admin/` (Decap's `index.html` + `config.yml`).
- Delete `cms-auth/` and its deployed Worker (`innerathlete-cms-auth`).
- Deploy `innerathlete-backoffice` with the D1 binding and all three
  secrets — `STAFF_PASSWORD` and `GITHUB_PAT` carried over with their
  current values, plus the new `SESSION_SECRET`.
- Remove the `decap-cms` CDN script reference, since nothing loads it
  anymore.

## Security

- `GITHUB_PAT`: already fine-grained, scoped to only this repo,
  Contents read/write, nothing else.
- `STAFF_PASSWORD`: still no rate-limiting on `/auth` — same
  proportionality call as before (internal tool, one shared low-value
  credential). Worth revisiting only if this ever becomes a
  higher-stakes system.
- `SESSION_SECRET`: new, random, never leaves the Worker.
- All D1 queries use parameterized statements (`.bind()`), never string
  concatenation — no SQL injection surface.
- Staff-entered text (customer name, notes) gets escaped when rendered
  back in the sales list, so the tool can't be turned into a stored-XSS
  vector against itself.
- The public write endpoint from the earlier "hybrid" design (and the
  abuse-surface that came with it) no longer exists, since sales entry
  is manual-only now.

## Testing

- Local: `wrangler dev` against a local D1 instance
  (`wrangler d1 execute --local`) for all sales CRUD, without touching
  production data.
- GitHub Contents API calls are exercised against the real repo (no
  practical way to mock GitHub) — verified carefully before treating
  the Catalog tab as done, same rigor as the smoke tests already done
  on the current CMS Worker.
- End-to-end smoke test after deploy: log in, edit a price and confirm
  it commits and the existing build fires; add a sale and confirm it
  lists; toggle its status; export CSV and confirm it opens correctly;
  confirm a session expires/re-prompts after the token's 24h window
  (or confirm the check logically, without waiting 24 real hours).

## Open questions

None blocking — deferred items above (click tracking, totals,
tiered access) are explicitly out of scope, not undecided.
