import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useApp, useApi } from '../lib/store.jsx';
import { useAuth } from '../lib/auth.jsx';
import { api } from '../lib/api.js';
import { formatMoney, formatMonthName, shiftMonth } from '../lib/format.js';
import { Bar } from './Charts.jsx';

// `match` decides the highlight, because /app/expenses/new is its own nav item
// and must not light up the Expenses row alongside it.
const NAV = [
  { to: '/app', label: 'Overview', icon: 'ph ph-squares-four', match: (p) => p === '/app' },
  {
    to: '/app/expenses',
    label: 'Expenses',
    icon: 'ph ph-list-dashes',
    match: (p) => p.startsWith('/app/expenses') && p !== '/app/expenses/new',
  },
  {
    to: '/app/expenses/new',
    label: 'Add expense',
    icon: 'ph ph-plus-circle',
    match: (p) => p === '/app/expenses/new',
  },
  { to: '/app/budgets', label: 'Budgets', icon: 'ph ph-target', match: (p) => p.startsWith('/app/budgets') },
  { to: '/app/reports', label: 'Reports', icon: 'ph ph-chart-line-up', match: (p) => p.startsWith('/app/reports') },
  { to: '/app/categories', label: 'Categories', icon: 'ph ph-tag', match: (p) => p.startsWith('/app/categories') },
  { to: '/app/settings', label: 'Settings', icon: 'ph ph-sliders-horizontal', match: (p) => p.startsWith('/app/settings') },
];

/** Signed-in identity and the way out, pinned under the nav. */
function AccountBox() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  if (!user) return null;

  const initials = user.name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');

  return (
    <div className="account">
      <div className="account-avatar" aria-hidden="true">
        {initials || '?'}
      </div>
      <div className="account-id">
        <div className="account-name">{user.name}</div>
        <div className="account-email">{user.email}</div>
      </div>
      <button
        type="button"
        className="account-out"
        title="Sign out"
        aria-label="Sign out"
        onClick={async () => {
          await logout();
          navigate('/', { replace: true });
        }}
      >
        <i className="ph ph-sign-out" />
      </button>
    </div>
  );
}

/** The pinned budget card at the foot of the sidebar. */
function BudgetPeek() {
  const { month, settings } = useApp();
  const { data } = useApi(() => api.budgets.list({ month }), [month]);
  const summary = data?.summary;

  if (!summary) return <div className="budget-peek" style={{ minHeight: 92 }} />;

  const pct = summary.monthlyBudget > 0 ? (summary.spent / summary.monthlyBudget) * 100 : 0;
  return (
    <div className="budget-peek">
      <div className="kicker">{formatMonthName(month).split(' ')[0]} budget</div>
      <div className="num" style={{ fontSize: 19, fontWeight: 500 }}>
        {formatMoney(summary.spent, settings)}{' '}
        <span style={{ fontSize: 12, color: 'var(--color-neutral-600)' }}>
          / {formatMoney(summary.monthlyBudget, settings, { bare: true })}
        </span>
      </div>
      <Bar pct={pct} color={pct > 100 ? '#b5abfc' : undefined} />
      <div style={{ fontSize: 11, color: 'var(--color-neutral-600)', marginTop: 'var(--space-2)' }}>
        {summary.left >= 0
          ? `${formatMoney(summary.left, settings)} left`
          : `${formatMoney(Math.abs(summary.left), settings)} over`}{' '}
        · {summary.daysLeft} {summary.daysLeft === 1 ? 'day' : 'days'}
      </div>
    </div>
  );
}

export function Sidebar() {
  const { pathname } = useLocation();

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">
          <i className="ph ph-wallet" />
        </div>
        <span className="brand-name">Ledgerline</span>
      </div>

      <nav className="sidenav">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            // A function className stops NavLink appending its own "active",
            // which would light up Expenses while sitting on /expenses/new.
            className={() => (item.match(pathname) ? 'active' : undefined)}
          >
            <i className={item.icon} style={{ fontSize: 16 }} />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <BudgetPeek />
      <AccountBox />
    </aside>
  );
}

/** Title, month stepper, search and the primary action. */
export function Topbar({ title, subtitle, search, onSearch }) {
  const { month, setMonth } = useApp();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const onAddScreen = pathname === '/app/expenses/new';

  return (
    <header className="topbar">
      <div>
        <div className="topbar-title">{title}</div>
        <div className="topbar-sub">{subtitle}</div>
      </div>

      <div className="topbar-actions">
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <button
            type="button"
            className="month-picker"
            style={{ padding: '6px 8px' }}
            onClick={() => setMonth(shiftMonth(month, -1))}
            aria-label="Previous month"
          >
            <i className="ph ph-caret-left" style={{ fontSize: 13 }} />
          </button>
          <span className="month-picker" style={{ cursor: 'default' }}>
            <i className="ph ph-calendar-blank" style={{ fontSize: 14 }} />
            {formatMonthName(month)}
          </span>
          <button
            type="button"
            className="month-picker"
            style={{ padding: '6px 8px' }}
            onClick={() => setMonth(shiftMonth(month, 1))}
            aria-label="Next month"
          >
            <i className="ph ph-caret-right" style={{ fontSize: 13 }} />
          </button>
        </div>

        {onSearch && (
          <div className="searchbox">
            <i className="ph ph-magnifying-glass" style={{ fontSize: 14, color: 'var(--color-neutral-600)' }} />
            <input
              value={search}
              onChange={(e) => onSearch(e.target.value)}
              placeholder="Search notes"
              aria-label="Search notes"
            />
          </div>
        )}

        {!onAddScreen && (
          <button className="btn btn-primary" onClick={() => navigate('/app/expenses/new')}>
            <i className="ph ph-plus" style={{ fontSize: 14 }} />
            Add expense
          </button>
        )}
      </div>
    </header>
  );
}

export function Loading({ label = 'Loading' }) {
  return (
    <div className="state-block">
      <div className="spinner" />
      <div>{label}…</div>
    </div>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <div className="state-block">
      <i className="ph ph-warning-circle" style={{ color: '#e79aae' }} />
      <div style={{ color: 'var(--color-neutral-300)' }}>{message}</div>
      {onRetry && (
        <button className="btn btn-secondary" onClick={onRetry}>
          <i className="ph ph-arrow-clockwise" style={{ fontSize: 14 }} />
          Try again
        </button>
      )}
    </div>
  );
}

export function Empty({ icon = 'ph ph-tray', title, hint, action }) {
  return (
    <div className="state-block">
      <i className={icon} />
      <div style={{ color: 'var(--color-neutral-300)', fontSize: 15 }}>{title}</div>
      {hint && <div style={{ fontSize: 13 }}>{hint}</div>}
      {action}
    </div>
  );
}

/** Renders loading / error / empty around a screen's content. */
export function Async({ state, empty, children, label }) {
  if (state.loading && !state.data) return <Loading label={label} />;
  if (state.error) return <ErrorState message={state.error} onRetry={state.reload} />;
  if (!state.data) return null;
  if (empty && empty(state.data)) return empty(state.data);
  return children(state.data);
}
