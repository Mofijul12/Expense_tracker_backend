# Ledgerline — client

The React front end: a public marketing home page with a scroll-driven WebGL
particle field, sign-up and sign-in, and a nine-screen dashboard where every
figure comes from the API. Vite, React 18, React Router 6, no state library and
no UI framework.

```
src/
  main.jsx            mount + the three stylesheets, in order
  App.jsx             routing, the auth gate, the toast
  components/
    Shell.jsx         Sidebar, Topbar, Loading / ErrorState / Empty, Async
    Charts.jsx        TrendChart, DailyChart, Donut, Ring, Bar, Swatch
  lib/
    api.js            the single fetch wrapper and the typed call surface
    auth.jsx          AuthProvider — who is signed in
    store.jsx         AppProvider — settings, categories, month, refresh; useApi
    format.js         money, dates, months, deltas, the accent ramp
    particles.js      the home page's three.js field
    scroll.js         usePrefersReducedMotion
  pages/              Home, Auth, Overview, Expenses, AddExpense,
                      ExpenseDetail, Budgets, Reports, Categories, Settings
  styles/
    nocturne.css      design tokens + base component classes
    app.css           dashboard shell and screen layout
    home.css          landing page and auth screens (scoped under .lp / .auth)
```

## Run it

```bash
npm install
npm run dev       # http://localhost:5173
```

The dev server proxies `/api` to `http://localhost:4000`, so the API has to be
running too — from the repo root, `npm run dev` starts both.

`npm run build` emits `dist/`, which the Express server picks up automatically
and serves on its own origin. `npm run preview` serves that build without the
API proxy, so it is only useful against a server that is already serving `/api`.

## Routing and the auth gate

| Route | Screen |
| --- | --- |
| `/` | Home — five scroll chapters over the particle field |
| `/login`, `/register` | Sign in / create an account |
| `/app` | Overview — four stat tiles, six-month trend, category split, recent activity |
| `/app/expenses` | Filter, search, sort, paginate; CSV export of the current page |
| `/app/expenses/new` | Add an expense |
| `/app/expenses/:id` | Detail — edit, duplicate, split, delete, plus the audit history |
| `/app/expenses/:id/edit` | The add form in edit mode |
| `/app/budgets` | Envelope ring, per-category pace, inline editing |
| `/app/reports` | Trend (bars / area / dots), donut, daily rhythm, movers |
| `/app/categories` | Cards with counts and auto-sort rules |
| `/app/settings` | Currency, period start, monthly budget, rounding, reminders, export |

Anything unmatched under `/app` redirects to `/app`; anything unmatched outside
it goes to `/`.

`RequireAuth` guards the whole `/app` subtree. It waits on `checking` before
deciding — without that wait, a signed-in visitor reloading the page would be
bounced to `/login` while the session check was still in flight. When it does
redirect, it stashes the attempted path in location state so login can send them
onward.

`AppProvider` mounts **inside** the gate, so its first calls never fire without a
session.

## The data layer

Three files, and they stack.

**[lib/api.js](src/lib/api.js)** — one `request()` over `fetch`, and a nested
object mirroring the API surface (`api.expenses.list`, `api.reports.mix`, …).
Two things it does beyond the fetch:

- `credentials: 'include'` on every call, because the session is an httpOnly
  cookie the JS can't see or attach by hand.
- On a `401` from any non-auth route it dispatches a `ledgerline:signed-out`
  window event. That is how an expired session becomes a redirect to the login
  page instead of a dead screen behind an error message.

Errors are thrown as real `Error`s carrying `status` and `details`, so a form can
show the server's per-field validation messages.

**[lib/auth.jsx](src/lib/auth.jsx)** — `AuthProvider` runs `api.auth.me()` once
on mount, exposes `{ user, checking, login, register, logout }`, and listens for
that signed-out event. `logout` clears the local user even if the request fails;
the cookie is gone or expired either way.

**[lib/store.jsx](src/lib/store.jsx)** — `AppProvider` holds what every screen
needs: `settings`, `categories`, the selected `month`, a `notify()` toast, and a
`version` counter.

That counter is the whole cache strategy. `useApi(fetcher, deps)` re-runs
whenever its deps *or* `version` change, so calling `refresh()` after a save
re-fetches every mounted screen at once — edit a budget and the sidebar's budget
card, the ring and the Overview tiles all catch up without any of them knowing
about each other. `useApi` returns `{ data, loading, error, reload }` and drops
results from a request that has been superseded.

The month lives here too, which is why the stepper in the header moves every
dashboard screen together.

## Screen anatomy

Screens are deliberately uniform:

```jsx
const { settings, month, notify, refresh } = useApp();
const state = useApi(() => api.reports.overview({ month }), [month]);

return (
  <>
    <Topbar title="Overview" subtitle={formatMonthName(month)} />
    <Async state={state} empty={{ title: 'Nothing here yet' }}>
      {(data) => /* the screen */}
    </Async>
  </>
);
```

`Async` renders `Loading`, `ErrorState` (with a retry) or `Empty` around the
content, so no screen hand-rolls those three states. `Topbar` carries the title,
the month stepper, optional search and the primary action.

The sidebar's `NAV` entries each carry their own `match(pathname)` because
"Add expense" is its own nav item — leaving it to `NavLink`'s built-in `active`
would light up Expenses alongside it.

## Design system

[styles/nocturne.css](src/styles/nocturne.css) holds the tokens the whole
dashboard is built from — colour ramps, spacing scale, radii, shadows, type —
plus base classes (`.btn`, `.input`, `.card`, `.table`, `.hr`). **Retune the look
there, not in a screen.** [app.css](src/styles/app.css) is the shell and screen layout;
[home.css](src/styles/home.css) is the landing and auth pages.

Three conventions to keep:

- **`.num` on every figure.** Tabular numerals with a tightened tracking, so
  columns of money line up and a changing amount doesn't jitter.
- **`color-scheme: dark`** is set globally, which is what makes native date
  pickers and selects render dark.
- **The dashboard scrolls its inner pane, not the document** (`body:has(.app)
  { overflow: hidden }`). The landing and auth pages are ordinary scrolling
  documents, which is why the `:has()` rules exist rather than a blanket
  `overflow: hidden`.

The landing page carries a **different** palette and type from the dashboard —
the reference design's ink, indigo and coral, with Space Grotesk and IBM Plex
Mono — all scoped under `.lp`, so none of it leaks into Nocturne.

Icons are Phosphor, loaded as a webfont; a category stores its icon as the class
string (`ph ph-bus`).

## Charts

No chart library. `TrendChart`, `DailyChart`, `Donut` and `Ring` are hand-drawn
SVG in [components/Charts.jsx](src/components/Charts.jsx); `Bar` and `Swatch` are
plain styled elements. Colours come from `rampColor(colorIndex)` in
[lib/format.js](src/lib/format.js), the same five-step ramp the server hands out
indexes into, so a category is the same colour in the donut, its bar and its
swatch.

`DailyChart` has one rule worth preserving: **the axis tops out at the 90th
percentile of spending days.** A single rent-sized day would otherwise flatten
every other bar to a sliver. Days above the cap are drawn full height in a
lighter fill and called out underneath, and their real figure stays in the
tooltip — the chart is about the rhythm.

`TrendChart` takes a `style` prop (`bars` / `area` / `dots`); the Reports screen
exposes it as a toggle.

## Formatting

[lib/format.js](src/lib/format.js) is the only place money and dates get shaped.
`formatMoney(value, settings)` reads the account's currency symbol and its
rounding preference, so switching currency in Settings changes every figure in
the app. Dates are formatted in **UTC** to match the server's period maths — a
`formatShortDate` in local time would show an expense on the wrong day near a
month boundary.

## The home page

[pages/Home.jsx](src/pages/Home.jsx) plus [lib/particles.js](src/lib/particles.js):
one swarm of 1,400 points reused for five formations — a chaotic cloud, six
category clusters, a bar chart, an ascending trendline, a launch arrow — morphed
by scroll position. The field owns its own scroll listener and animation loop;
the component only tracks which chapter is in view, for the rail and the copy
fade.

Load-bearing details, easy to "improve" by mistake:

- **The material is untextured.** `PointsMaterial` with no `map` renders each
  point as a crisp square, which is the look. A radial sprite softens every point
  into a blur.
- **The camera makes a full turntable sweep** (`progress * π * 1.3`). Facing the
  formations head-on reads better in isolation but is not the intended motion.
- **three.js is imported dynamically**, so it lands in its own ~512 KB chunk.
  Anyone going straight to `/app` never downloads it; the dashboard bundle stays
  around 234 KB.
- **Everything the field creates, it disposes.** No WebGL context means the page
  simply renders without the canvas, and React StrictMode's double-mount leaves
  no orphaned canvas or leaked GPU buffers.

`usePrefersReducedMotion` is honoured, and keeps being honoured if the OS setting
changes mid-session.

> **The three figures in the stat strip — 4.2M+ transactions, 98%
> auto-categorized, 0.3s sync — are placeholders carried over from the reference
> design. They are not measurements of anything.** Replace them before this page
> is public.

## Adding a screen

1. A page in `pages/`, using `useApp()` for month/settings and `useApi()` for its
   data.
2. A call in `api.js` if it needs an endpoint that isn't there yet.
3. A route in `App.jsx` under `/app/*`.
4. A `NAV` entry in `Shell.jsx` with its own `match`, if it belongs in the
   sidebar.
5. `refresh()` after any write, so the rest of the app catches up.

Reach for existing tokens and `Shell` primitives before writing new CSS.

## Not wired up

- **CSV export is client-side and partial.** The Expenses page exports the rows
  on screen; Settings re-fetches the selected month but caps it at 200 rows.
- **Bank sync** is a present, disabled button.
- **Reminder toggles** persist to the server; nothing sends anything.
- **No password reset flow** — there is nowhere to send the mail.
