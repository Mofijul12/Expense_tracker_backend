import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';

const HIGHLIGHTS = [
  { icon: 'ph ph-target', text: 'Envelopes that show pace, not just totals' },
  { icon: 'ph ph-chart-line-up', text: 'Six months of trend from your first month on' },
  { icon: 'ph ph-magic-wand', text: 'Keyword rules that file expenses for you' },
];

/** Shared two-column frame: form on the left, the pitch on the right. */
function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <div className="auth">
      <div className="auth-panel">
        <Link to="/" className="auth-brand">
          <span className="brand-mark">
            <i className="ph ph-wallet" />
          </span>
          Ledgerline
        </Link>

        <div className="auth-form-wrap">
          <h1 className="auth-title">{title}</h1>
          <p className="auth-subtitle">{subtitle}</p>
          {children}
          <div className="auth-footer">{footer}</div>
        </div>
      </div>

      <aside className="auth-aside">
        <div className="auth-aside-inner">
          {/* Deliberately not phrased as a customer quote — there are no
              customers to quote, and an invented testimonial is a lie. */}
          <div className="auth-quote">
            By the 27th of the month you should be able to say exactly where the
            money went. That is the whole idea.
          </div>
          <ul className="auth-highlights">
            {HIGHLIGHTS.map((h) => (
              <li key={h.text}>
                <i className={h.icon} />
                {h.text}
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}

function Field({ id, label, hint, ...props }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input id={id} className="input" {...props} />
      {hint && <div className="auth-hint">{hint}</div>}
    </div>
  );
}

export function Login() {
  const { user, checking, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  // Where the visitor was headed before they were bounced here.
  const next = location.state?.from || '/app';
  if (!checking && user) return <Navigate to={next} replace />;

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(form);
      navigate(next, { replace: true });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to pick up where your month left off."
      footer={
        <>
          New here? <Link to="/register">Create an account</Link>
        </>
      }
    >
      <form className="auth-form" onSubmit={submit}>
        {error && (
          <div className="banner error">
            <i className="ph ph-warning-circle" />
            {error}
          </div>
        )}
        <Field
          id="email"
          label="Email"
          type="email"
          autoComplete="email"
          required
          value={form.email}
          onChange={set('email')}
          placeholder="you@example.com"
        />
        <Field
          id="password"
          label="Password"
          type="password"
          autoComplete="current-password"
          required
          value={form.password}
          onChange={set('password')}
          placeholder="Your password"
        />
        <button className="btn btn-primary btn-block" disabled={busy} type="submit">
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </AuthLayout>
  );
}

export function Register() {
  const { user, checking, register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  if (!checking && user) return <Navigate to="/app" replace />;

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(event) {
    event.preventDefault();
    if (form.password.length < 8) {
      setError('Use at least 8 characters for your password.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await register(form);
      navigate('/app', { replace: true });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <AuthLayout
      title="Start tracking"
      subtitle="Free, and your first five categories are already set up."
      footer={
        <>
          Already have an account? <Link to="/login">Sign in</Link>
        </>
      }
    >
      <form className="auth-form" onSubmit={submit}>
        {error && (
          <div className="banner error">
            <i className="ph ph-warning-circle" />
            {error}
          </div>
        )}
        <Field
          id="name"
          label="Name"
          autoComplete="name"
          required
          value={form.name}
          onChange={set('name')}
          placeholder="What should we call you?"
        />
        <Field
          id="email"
          label="Email"
          type="email"
          autoComplete="email"
          required
          value={form.email}
          onChange={set('email')}
          placeholder="you@example.com"
        />
        <Field
          id="password"
          label="Password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={form.password}
          onChange={set('password')}
          placeholder="At least 8 characters"
          hint="At least 8 characters."
        />
        <button className="btn btn-primary btn-block" disabled={busy} type="submit">
          {busy ? 'Creating your account…' : 'Create account'}
        </button>
      </form>
    </AuthLayout>
  );
}
