import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useApi, useApp } from '../lib/store.jsx';
import { Topbar, Async } from '../components/Shell.jsx';
import { formatMoney, formatLongDate, formatShortDate } from '../lib/format.js';

/** Split dialog — two parts that must add up to the original amount. */
function SplitDialog({ expense, settings, categories, onClose, onDone }) {
  const half = Math.round((expense.amount / 2) * 100) / 100;
  const [parts, setParts] = useState([
    { amount: String(half), category: expense.category?._id || '', note: expense.note || '' },
    {
      amount: String(Math.round((expense.amount - half) * 100) / 100),
      category: '',
      note: '',
    },
  ]);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const sum = parts.reduce((n, p) => n + (Number(p.amount) || 0), 0);
  const balanced = Math.abs(sum - expense.amount) < 0.01;

  const update = (i, key, value) =>
    setParts((ps) => ps.map((p, idx) => (idx === i ? { ...p, [key]: value } : p)));

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      await api.expenses.split(
        expense._id,
        parts.map((p) => ({ ...p, amount: Number(p.amount), category: p.category || null }))
      );
      onDone();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-title">Split this expense</div>
        <div className="dialog-body">
          {formatMoney(expense.amount, settings)} becomes the parts below.
        </div>

        {parts.map((p, i) => (
          <div key={i} style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <input
              className="input"
              style={{ width: 110 }}
              inputMode="decimal"
              value={p.amount}
              onChange={(e) => update(i, 'amount', e.target.value.replace(/[^\d.]/g, ''))}
              aria-label={`Part ${i + 1} amount`}
            />
            <select
              className="input"
              value={p.category}
              onChange={(e) => update(i, 'category', e.target.value)}
              aria-label={`Part ${i + 1} category`}
            >
              <option value="">Uncategorized</option>
              {categories.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        ))}

        <div className="muted-sm">
          Parts add up to {formatMoney(sum, settings)} of {formatMoney(expense.amount, settings)}
          {!balanced && ' — they need to match before you can save.'}
        </div>
        {error && (
          <div className="banner error">
            <i className="ph ph-warning-circle" />
            {error}
          </div>
        )}

        <div className="dialog-actions">
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={!balanced || saving} onClick={submit}>
            {saving ? 'Splitting…' : 'Split'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ConfirmDialog({ title, body, confirmLabel, onClose, onConfirm, busy }) {
  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-title">{title}</div>
        <div className="dialog-body">{body}</div>
        <div className="dialog-actions">
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={busy} onClick={onConfirm}>
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ExpenseDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { settings, categories, refresh, notify } = useApp();
  const state = useApi(() => api.expenses.get(id), [id]);

  const [dialog, setDialog] = useState(null);
  const [busy, setBusy] = useState(false);

  async function remove() {
    setBusy(true);
    try {
      await api.expenses.remove(id);
      notify('Expense deleted');
      refresh();
      navigate('/app/expenses');
    } finally {
      setBusy(false);
    }
  }

  async function duplicate() {
    setBusy(true);
    try {
      const copy = await api.expenses.duplicate(id);
      notify('Duplicated — dated today');
      refresh();
      navigate(`/app/expenses/${copy._id}`);
    } finally {
      setBusy(false);
      setDialog(null);
    }
  }

  return (
    <>
      <Topbar
        title="Expense"
        subtitle={
          state.data
            ? state.data.category?.name || 'Uncategorized'
            : 'Loading'
        }
      />
      <div className="screen">
        <Async state={state} label="Loading expense">
          {(e) => (
            <div style={{ maxWidth: 880, display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
              <button
                className="btn btn-ghost"
                style={{ alignSelf: 'flex-start' }}
                onClick={() => navigate('/app/expenses')}
              >
                <i className="ph ph-arrow-left" style={{ fontSize: 13 }} />
                Back to expenses
              </button>

              <div className="split-detail">
                <section className="panel">
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-4)' }}>
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        flex: 'none',
                        borderRadius: 8,
                        background: 'var(--color-accent-900)',
                        display: 'grid',
                        placeItems: 'center',
                        color: 'var(--color-accent-300)',
                      }}
                    >
                      <i className={e.category?.icon || 'ph ph-question'} style={{ fontSize: 19 }} />
                    </div>
                    <div>
                      <div style={{ fontSize: 19, fontWeight: 500 }}>
                        {e.category?.name || 'Uncategorized'}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--color-neutral-600)' }}>
                        {formatLongDate(e.date)}
                      </div>
                    </div>
                    <div className="num spacer" style={{ fontSize: 31, fontWeight: 500 }}>
                      {formatMoney(e.amount, settings)}
                    </div>
                  </div>

                  <hr className="hr" />

                  <div className="grid-2">
                    {[
                      ['Category', e.category?.name || 'Uncategorized'],
                      ['Tags', e.tags?.length ? e.tags.join(', ') : '—'],
                      ['Logged', formatShortDate(e.createdAt)],
                    ].map(([k, v]) => (
                      <div key={k}>
                        <div
                          style={{
                            fontSize: 11,
                            letterSpacing: '.06em',
                            textTransform: 'uppercase',
                            color: 'var(--color-neutral-600)',
                          }}
                        >
                          {k}
                        </div>
                        <div style={{ fontSize: 14, marginTop: 'var(--space-1)' }}>{v}</div>
                      </div>
                    ))}
                  </div>

                  <hr className="hr" />

                  <div
                    style={{
                      fontSize: 11,
                      letterSpacing: '.06em',
                      textTransform: 'uppercase',
                      color: 'var(--color-neutral-600)',
                      marginBottom: 'var(--space-2)',
                    }}
                  >
                    Note
                  </div>
                  <p style={{ margin: 0, fontSize: 13.5, color: 'var(--color-neutral-300)' }}>
                    {e.note || 'No note on this one.'}
                  </p>

                  <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-6)' }}>
                    <button className="btn btn-primary" onClick={() => navigate(`/app/expenses/${id}/edit`)}>
                      <i className="ph ph-pencil-simple" style={{ fontSize: 14 }} />
                      Edit
                    </button>
                    <button className="btn btn-secondary" onClick={() => setDialog('duplicate')}>
                      <i className="ph ph-copy" style={{ fontSize: 14 }} />
                      Duplicate
                    </button>
                    <button className="btn btn-secondary" onClick={() => setDialog('split')}>
                      <i className="ph ph-scissors" style={{ fontSize: 14 }} />
                      Split
                    </button>
                    <button
                      className="btn btn-ghost spacer"
                      style={{ color: 'var(--color-neutral-400)' }}
                      onClick={() => setDialog('delete')}
                    >
                      Delete
                    </button>
                  </div>
                </section>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                  <section className="panel" style={{ padding: 14 }}>
                    <div
                      style={{
                        fontSize: 11,
                        letterSpacing: '.06em',
                        textTransform: 'uppercase',
                        color: 'var(--color-neutral-600)',
                        marginBottom: 'var(--space-3)',
                      }}
                    >
                      History
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                      {e.history?.length ? (
                        e.history.map((h, i) => (
                          <div key={i} style={{ display: 'flex', gap: 8, fontSize: 12.5 }}>
                            <i
                              className="ph ph-circle"
                              style={{ fontSize: 8, color: 'var(--color-accent)', marginTop: 5 }}
                            />
                            <span>{h.what}</span>
                            <span className="spacer" style={{ color: 'var(--color-neutral-600)' }}>
                              {formatShortDate(h.when)}
                            </span>
                          </div>
                        ))
                      ) : (
                        <div className="muted-sm">Nothing recorded yet.</div>
                      )}
                    </div>
                  </section>
                </div>
              </div>

              {dialog === 'split' && (
                <SplitDialog
                  expense={e}
                  settings={settings}
                  categories={categories}
                  onClose={() => setDialog(null)}
                  onDone={() => {
                    setDialog(null);
                    notify('Split into parts');
                    refresh();
                    navigate('/app/expenses');
                  }}
                />
              )}
              {dialog === 'delete' && (
                <ConfirmDialog
                  title="Delete this expense?"
                  body={`${formatMoney(e.amount, settings)} on ${formatShortDate(
                    e.date
                  )} will be removed for good.`}
                  confirmLabel="Delete"
                  busy={busy}
                  onClose={() => setDialog(null)}
                  onConfirm={remove}
                />
              )}
              {dialog === 'duplicate' && (
                <ConfirmDialog
                  title="Duplicate this expense?"
                  body="A copy is created with today's date. You can edit it straight after."
                  confirmLabel="Duplicate"
                  busy={busy}
                  onClose={() => setDialog(null)}
                  onConfirm={duplicate}
                />
              )}
            </div>
          )}
        </Async>
      </div>
    </>
  );
}
