# Ledgerline — server

The Express + Mongoose API behind Ledgerline. It owns accounts, expenses,
categories, budgets, settings and every aggregate the dashboard draws — the
client computes nothing it could get from here.

ES modules throughout (`"type": "module"`), Node 18+, MongoDB Atlas.

```
src/
  index.js          app wiring, route mounting, static client, boot sequence
  db.js             connection + index sync
  seed.js           demo account with six months of history
  reset.js          empties every collection
  lib/
    period.js       month arithmetic — the source of truth for period windows
    token.js        JWT signing, the session cookie, token reading
  middleware/
    requireAuth.js  the gate; puts the owner id on req.userId
    asyncHandler.js promise-catching route wrapper + HttpError
    errors.js       404 handler and the single error responder
  models/           User, Expense, Category, Budget, Settings
  routes/           auth, expenses, categories, budgets, reports, settings
```

## Run it

```bash
npm install
cp .env.example .env     # then fill in MONGODB_URI and JWT_SECRET
npm run dev              # node --watch, http://localhost:4000
```

| Script | What it does |
| --- | --- |
| `npm run dev` | Watch mode, restarts on save |
| `npm start` | Plain `node src/index.js` |
| `npm run seed` | Rebuild the demo account — **destructive, no confirmation** |
| `npm run reset` | Empty every collection, accounts included — **destructive, no confirmation** |

### Environment

| Variable | Required | Purpose |
| --- | --- | --- |
| `MONGODB_URI` | yes | Atlas connection string. Boot fails loudly without it. |
| `JWT_SECRET` | yes | Session signing key. Rotating it signs everyone out. Generate with `openssl rand -hex 48`. |
| `PORT` | no | Default `4000` |
| `CLIENT_ORIGIN` | no | Comma-separated CORS allow-list. Unset means "reflect any origin" — fine in dev, set it in production. |
| `JWT_EXPIRES` | no | Token lifetime, default `30d` |

`NODE_ENV=production` also flips the session cookie to `secure`, so it will only
travel over HTTPS.

### Boot sequence

`connectDB` → `syncIndexes` → `listen`. A failure in either of the first two
exits the process with the reason rather than serving a half-working API.

`syncIndexes` is not cosmetic. The single-user version of this app indexed
`Category.name` and `Settings.key` as globally unique, and those indexes survive
a `deleteMany`. Left in place they reject the second account that creates a
category called "Transport", or that registers at all — every new settings
document has no `key`, so they collide on null. Syncing on boot drops them.

## Auth

- Passwords are bcrypt-hashed at cost 12. `passwordHash` is `select: false`, so
  it never rides along in an ordinary query result, and `toPublic()` is the only
  shape a user is ever serialized in.
- The session is a JWT in an **httpOnly, sameSite=lax cookie** named
  `ledgerline_token`. Page scripts cannot read it, so an XSS bug cannot walk off
  with the session. An `Authorization: Bearer <token>` header is also accepted,
  for API clients and tests.
- Register and login return the same message for a wrong password as for an
  unknown address, so neither can be used to discover which emails have accounts.
- `requireAuth` verifies the token *and* reloads the account, so deleting a user
  revokes access immediately instead of at token expiry.

Registering creates five starter categories and a settings document, so a new
account never lands on an empty screen.

## Ownership is the security model

`Expense`, `Category`, `Budget` and `Settings` all carry a `user`. `requireAuth`
puts that id on `req.userId`, and **every query in every data route filters by
it** — reads, writes, aggregates, and `findOne`-by-id lookups alike. Ids that
arrive from the caller (the category on an expense, the parts of a split) are
checked for ownership before use, so one account cannot attach itself to
another's records.

Uniqueness is per account, not global: `(user, name)` on categories,
`(user, month, category)` on budgets. Two people can both have a Transport.

No data route may skip `requireAuth` — that scoping is what keeps accounts apart.

## API

Everything is under `/api`, JSON in and out. Month parameters take `YYYY-MM`; a
missing or unparseable month falls back to the current one.

`GET /api/health` is the only public route besides auth.

### Auth — `/api/auth`

| Method | Route | Notes |
| --- | --- | --- |
| `POST` | `/register` | `{ name, email, password }`, password at least 8 characters. Sets the cookie, returns `{ user }`, seeds starter categories. `409` if the email is taken. |
| `POST` | `/login` | `{ email, password }`. Sets the cookie, stamps `lastLoginAt`. |
| `POST` | `/logout` | Clears the cookie. |
| `GET` | `/me` | Who the current cookie belongs to. `401` when there is nobody. |

Everything below requires that cookie.

### Expenses — `/api/expenses`

| Method | Route | Notes |
| --- | --- | --- |
| `GET` | `/` | Paginated list — see the query parameters below. |
| `GET` | `/:id` | |
| `POST` | `/` | Needs `amount` above zero; everything else is optional. With no category given, the note is matched against category keywords. |
| `PATCH` | `/:id` | Writable: `date`, `amount`, `category`, `note`, `tags`. Appends what changed to `history`. |
| `DELETE` | `/:id` | |
| `POST` | `/:id/duplicate` | Copies the row to today, or to `{ date }`. |
| `POST` | `/:id/split` | `{ parts: [{ amount, category, note }] }` — at least two, and they must total the original within a cent. The original is deleted; each part carries `splitFrom`. |

`GET /` query: `month` (or `all` for every period), `filter`
(`all` / `uncategorized`), `category`, `q` (case-insensitive match on note and
tags, escaped before it becomes a regex), `page`, `limit` (1–200, default 10),
`sort` (`date-desc` / `date-asc` / `amount-desc` / `amount-asc`), `minAmount`,
`maxAmount`.

```jsonc
{ "items": [ ... ], "month": "2026-08", "page": 1, "limit": 10,
  "total": 42, "pages": 5,
  "totalAmount": 53320,   // everything matching the filter
  "spendAmount": 48320 }  // the same, minus excludeFromSpend categories
```

Two totals, because a savings transfer belongs in the list but not in "spent".
When the caller pins a specific category, `spendAmount` stops excluding — they
asked for that bucket, savings included.

### Categories — `/api/categories`

`GET /` returns every category with the period's `amount` and `count` folded in,
plus an `uncategorized` tally. `POST /`, `PATCH /:id` and `DELETE /:id` are
ordinary. Writable: `name`, `icon`, `colorIndex` (0–4), `rule`, `keywords`,
`excludeFromSpend`, `order`.

Deleting a category is non-destructive to history: its expenses survive with
`category: null`, its budgets are removed, and the response reports how many
expenses were uncategorized.

### Budgets — `/api/budgets`

| Method | Route | Notes |
| --- | --- | --- |
| `GET` | `/?month=` | The whole Budgets screen in one call. |
| `PUT` | `/` | `{ month, items: [{ category, limit, note }] }` — upserts the month in a single `bulkWrite`. |
| `PATCH` | `/:id` | `limit`, `note`. |
| `DELETE` | `/:id` | |

`GET` returns a card per category (`limit`, `spent`, `left`, `pct`, `rawPct`,
`state`, `note`) and a `summary` carrying `monthlyBudget`, `spent`, `left`,
`pct`, `projected`, `pace`, `paceDelta`, `safeDaily` and the period progress
(`totalDays`, `daysElapsed`, `daysLeft`, `start`, `end`).

`state` is `On pace` / `Fully spent` (`Done` for excluded categories) / `Over` /
`No limit`. The overall ring skips `excludeFromSpend` categories but still counts
expenses with no category at all — otherwise the ring and the Overview screen
would disagree.

### Reports — `/api/reports`

| Route | Returns |
| --- | --- |
| `/overview?month=` | The four stat tiles, period progress, month-over-month change, and the five most recent expenses. |
| `/trend?month=&months=6` | `budget` plus a point per month; `months` clamps to 2–24. |
| `/daily?month=` | One entry per day (`date`, `day`, `weekend`, `amount`), the total, and `weekendShare` as a percentage. |
| `/mix?month=` | Category share of the period, biggest first, each with `pct`. |
| `/movers?month=` | This period against the previous one per category, biggest relative change first. |

Two things worth knowing here: **weekends are Friday and Saturday** in `/daily`,
and `/mix` folds uncategorized spend in as its own item — leave it out and every
share would be taken against a total smaller than the month's real spend.

### Settings — `/api/settings`

`GET /` loads the account's settings, creating them from the schema defaults on
first read. `PUT /` accepts `currencyCode`, `currencySymbol`, `currencyLabel`,
`monthStartsOn`, `monthlyBudget`, `rounding`, and a `reminders` object whose
keys are written through as `reminders.<key>` so the toggles can be saved one at
a time.

## Data model

| Model | Shape |
| --- | --- |
| **User** | `name`, unique lowercase `email`, `passwordHash` (`select: false`), `lastLoginAt` |
| **Expense** | `user`, `date`, `amount`, `category` (nullable), `note`, `tags`, `history[{ what, when }]`, `splitFrom`. A virtual `month` is exposed in JSON. |
| **Category** | `user`, `name`, `icon`, `colorIndex` 0–4, `rule`, `keywords[]`, `excludeFromSpend`, `order` |
| **Budget** | `user`, `category`, `month`, `limit`, `note` |
| **Settings** | one per account: the currency triple, `monthStartsOn` 1–28, `monthlyBudget`, `rounding`, `reminders` |

Indexes: `(user, date)` and `(user, category, date)` on expenses,
`(user, order, name)` plus unique `(user, name)` on categories, unique
`(user, month, category)` on budgets, unique `user` on settings.

`Settings.load(userId)` upserts, so no code path has to handle a missing
settings document.

## Two conventions the aggregates depend on

**The month is not always the calendar month.** `monthStartsOn` shifts every
period window, aggregate and budget; set it to 25 and August runs 25 Aug →
25 Sep. Every range is half-open `[start, end)` and computed in UTC, so the
boundaries don't drift with the host timezone. All of it lives in
[lib/period.js](src/lib/period.js) — date maths belongs there, not in a route.

**Savings are tracked but not spent.** A category with `excludeFromSpend` still
lists its expenses and keeps its own envelope, but stays out of spend totals, the
trend, the mix and the budget ring. `excludedCategoryIds()` in
[routes/reports.js](src/routes/reports.js) is how each report applies it.

## Errors

Routes are wrapped in `asyncHandler`, so a rejected promise reaches the error
handler instead of hanging the request. Throw `new HttpError(status, message,
details)` for anything deliberate. Every failure comes back as
`{ error, details? }`:

| Status | When |
| --- | --- |
| `400` | Mongoose `CastError` — a malformed id |
| `401` | No session, an expired token, or a deleted account |
| `404` | No such route, or the record isn't yours |
| `409` | Duplicate key — a taken email, a repeated category name |
| `422` | Validation, ours or Mongoose's (`details` maps field → message) |
| `500` | Anything else; logged server-side, generic message out |

A record that belongs to somebody else returns `404`, not `403` — the ownership
filter means the query simply finds nothing.

## Serving the built client

If `../client/dist` exists, Express serves it and sends every non-`/api` path to
`index.html`, so the SPA's routes survive a hard refresh. That is what makes
`npm run build && npm start` from the repo root a single-origin deployment on
port 4000, with no CORS involved.

## Seed and reset

Both are destructive and neither asks for confirmation.

`npm run seed` rebuilds **only** `demo@ledgerline.app` (password `demo1234`) —
other accounts are left alone. It writes 202 expenses across March–August 2026,
eight categories and 48 envelopes; August comes to ৳48,320 of a ৳60,000 budget
across 42 expenses. The back-months are generated from per-category totals, so
the trend chart has a real shape rather than noise.

`npm run reset` empties everything, accounts included, and prints what it
removed. After it there are no accounts, so register again from the home page.

## Before this faces the internet

- **No rate limiting.** Nothing throttles repeated login attempts.
- **No password reset.** No mail is sent anywhere; a lost password is a lost
  account.
- **Set `CLIENT_ORIGIN`.** Unset, CORS reflects whatever origin asks.
- **Reminder toggles persist but nothing acts on them** — no mail, no push.
