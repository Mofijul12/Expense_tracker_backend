import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useApi, useApp } from '../lib/store.jsx';
import { Topbar, Async, Empty } from '../components/Shell.jsx';
import { Ring, Bar } from '../components/Charts.jsx';
import { formatMoney, formatMonthName, rampColor } from '../lib/format.js';

/**
 * The line under each envelope. Amounts are built here so they carry the
 * currency symbol and thousands separators the rest of the app uses; anything
 * the envelope carries as a custom note wins.
 */
function envelopeNote(b, settings, daysLeft) {
  if (b.state === 'Over') return `${formatMoney(b.spent - b.limit, settings)} over`;
  if (b.state === 'On pace') {
    return `${formatMoney(b.limit - b.spent, settings)} left · ${daysLeft} ${
      daysLeft === 1 ? 'day' : 'days'
    }`;
  }
  return b.note;
}

const STATE_TAG = {
  Over: 'tag tag-outline',
  'Fully spent': 'tag tag-accent',
  Done: 'tag tag-accent-2',
  'On pace': 'tag tag-neutral',
  'No limit': 'tag tag-neutral',
};

/** Inline editor for the whole month's envelopes. */
function AdjustDialog({ month, items, settings, onClose, onSaved }) {
  const [limits, setLimits] = useState(() =>
    Object.fromEntries(items.map((i) => [i.category._id, String(i.limit)]))
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const total = Object.values(limits).reduce((n, v) => n + (Number(v) || 0), 0);

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      await api.budgets.saveAll(
        month,
        Object.entries(limits).map(([category, limit]) => ({ category, limit: Number(limit) || 0 }))
      );
      onSaved();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog" style={{ width: 'min(520px, 100%)' }} onClick={(e) => e.stopPropagation()}>
        <div className="dialog-title">Adjust budgets</div>
        <div className="dialog-body">Envelopes for {formatMonthName(month)}.</div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', maxHeight: 320, overflow: 'auto' }}>
          {items.map((i) => (
            <div key={i.category._id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
              <i className={i.category.icon} style={{ fontSize: 15, color: 'var(--color-accent)' }} />
              <span style={{ fontSize: 13.5 }}>{i.category.name}</span>
              <input
                className="input num spacer"
                style={{ width: 120, textAlign: 'right' }}
                inputMode="numeric"
                value={limits[i.category._id]}
                onChange={(e) =>
                  setLimits((l) => ({
                    ...l,
                    [i.category._id]: e.target.value.replace(/[^\d.]/g, ''),
                  }))
                }
                aria-label={`${i.category.name} limit`}
              />
            </div>
          ))}
        </div>

        <div className="muted-sm">
          Envelopes total {formatMoney(total, settings)} against a monthly budget of{' '}
          {formatMoney(settings?.monthlyBudget, settings)}.
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
          <button className="btn btn-primary" disabled={saving} onClick={submit}>
            {saving ? 'Saving…' : 'Save budgets'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Budgets() {
  const { month, settings, refresh, notify } = useApp();
  const navigate = useNavigate();
  const state = useApi(() => api.budgets.list({ month }), [month]);
  const [adjusting, setAdjusting] = useState(false);

  return (
    <>
      <Topbar title="Budgets" subtitle={`Envelopes and pace for ${formatMonthName(month)}`} />
      <div className="screen">
        <Async state={state} label="Loading budgets">
          {(data) => {
            const s = data.summary;
            return (
              <div className="stack" style={{ maxWidth: 1000 }}>
                <div
                  className="panel"
                  style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-6)' }}
                >
                  <Ring pct={s.pct} />
                  <div>
                    <div
                      style={{
                        fontSize: 11,
                        letterSpacing: '.06em',
                        textTransform: 'uppercase',
                        color: 'var(--color-neutral-600)',
                      }}
                    >
                      {formatMonthName(month).split(' ')[0]} envelope
                    </div>
                    <div className="num" style={{ fontSize: 31, fontWeight: 500, marginTop: 'var(--space-1)' }}>
                      {s.left >= 0
                        ? `${formatMoney(s.left, settings)} left`
                        : `${formatMoney(Math.abs(s.left), settings)} over`}
                    </div>
                    <div style={{ fontSize: 12.5, color: 'var(--color-neutral-500)' }}>
                      of {formatMoney(s.monthlyBudget, settings)}
                      {/* A projection off zero spend would be a made-up claim. */}
                      {s.spent > 0
                        ? ` · on pace to finish ${formatMoney(s.paceDelta, settings)} ${s.pace}`
                        : ' · nothing spent yet'}
                    </div>
                  </div>
                  <button
                    className="btn btn-secondary spacer"
                    disabled={data.items.length === 0}
                    onClick={() => setAdjusting(true)}
                  >
                    Adjust budgets
                  </button>
                </div>

                {data.items.length === 0 && (
                  <section className="panel">
                    <Empty
                      icon="ph ph-target"
                      title="No envelopes yet"
                      hint="Budgets are set per category, so create a category first — then give it a limit here."
                      action={
                        <button className="btn btn-primary" onClick={() => navigate('/app/categories')}>
                          <i className="ph ph-tag" style={{ fontSize: 14 }} />
                          Go to categories
                        </button>
                      }
                    />
                  </section>
                )}

                <div className="grid-2">
                  {data.items.map((b) => (
                    <div
                      key={b.category._id}
                      style={{
                        padding: 14,
                        borderRadius: 'var(--radius-md)',
                        background: 'var(--color-surface)',
                        boxShadow: 'var(--shadow-sm)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
                        <i className={b.category.icon} style={{ fontSize: 15, color: 'var(--color-accent)' }} />
                        {b.category.name}
                        <span className={`${STATE_TAG[b.state] || 'tag tag-neutral'} spacer`}>
                          {b.state}
                        </span>
                      </div>
                      <div className="num" style={{ fontSize: 20, fontWeight: 500, marginTop: 'var(--space-3)' }}>
                        {formatMoney(b.spent, settings)}{' '}
                        <span style={{ fontSize: 12, color: 'var(--color-neutral-600)' }}>
                          / {formatMoney(b.limit, settings, { bare: true })}
                        </span>
                      </div>
                      <Bar
                        pct={b.pct}
                        color={b.state === 'Over' ? '#b5abfc' : rampColor(b.category.colorIndex)}
                      />
                      <div style={{ fontSize: 11.5, color: 'var(--color-neutral-600)', marginTop: 'var(--space-2)' }}>
                        {envelopeNote(b, settings, s.daysLeft)}
                      </div>
                    </div>
                  ))}
                </div>

                {data.uncategorizedSpent > 0 && (
                  <div className="banner">
                    <i className="ph ph-question" />
                    {formatMoney(data.uncategorizedSpent, settings)} of this month&apos;s spend has no
                    category, so it sits outside every envelope.
                  </div>
                )}

                {adjusting && (
                  <AdjustDialog
                    month={month}
                    items={data.items}
                    settings={settings}
                    onClose={() => setAdjusting(false)}
                    onSaved={() => {
                      setAdjusting(false);
                      notify('Budgets updated');
                      refresh();
                      state.reload();
                    }}
                  />
                )}
              </div>
            );
          }}
        </Async>
      </div>
    </>
  );
}
