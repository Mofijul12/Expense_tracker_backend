import { useState } from 'react';
import { api } from '../lib/api.js';
import { useApi, useApp } from '../lib/store.jsx';
import { Topbar, Async, Empty } from '../components/Shell.jsx';
import { formatMoney, formatMonthName } from '../lib/format.js';

const ICONS = [
  'ph ph-shopping-cart', 'ph ph-house-line', 'ph ph-bus', 'ph ph-heartbeat',
  'ph ph-popcorn', 'ph ph-piggy-bank', 'ph ph-gift', 'ph ph-graduation-cap',
  'ph ph-coffee', 'ph ph-car', 'ph ph-wifi-high', 'ph ph-book-open',
  'ph ph-t-shirt', 'ph ph-paw-print', 'ph ph-airplane-tilt', 'ph ph-tag',
];

const BLANK = { name: '', icon: 'ph ph-tag', colorIndex: 0, keywords: '', excludeFromSpend: false };

function CategoryDialog({ initial, onClose, onSave, onDelete }) {
  const editing = Boolean(initial?._id);
  const [form, setForm] = useState(
    initial
      ? {
          name: initial.name,
          icon: initial.icon,
          colorIndex: initial.colorIndex ?? 0,
          keywords: (initial.keywords || []).join(', '),
          excludeFromSpend: Boolean(initial.excludeFromSpend),
        }
      : BLANK
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function submit() {
    if (!form.name.trim()) return setError('Give the category a name.');
    setBusy(true);
    setError(null);
    try {
      const keywords = form.keywords
        .split(',')
        .map((k) => k.trim())
        .filter(Boolean);
      await onSave({
        ...form,
        keywords,
        rule: keywords.length ? `Auto: ${keywords.join(', ')}` : 'No rule',
      });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-title">{editing ? 'Edit category' : 'New category'}</div>

        <div className="field">
          <label htmlFor="cat-name">Name</label>
          <input
            id="cat-name"
            className="input"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
        </div>

        <div className="field">
          <label>Icon</label>
          <div className="chips">
            {ICONS.map((icon) => (
              <button
                key={icon}
                type="button"
                className={`chip${form.icon === icon ? ' on' : ''}`}
                style={{ padding: '6px 8px' }}
                onClick={() => setForm((f) => ({ ...f, icon }))}
                aria-label={icon}
              >
                <i className={icon} style={{ fontSize: 15 }} />
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <label htmlFor="cat-keywords">Auto-sort keywords</label>
          <input
            id="cat-keywords"
            className="input"
            placeholder="grocer, tea, produce"
            value={form.keywords}
            onChange={(e) => setForm((f) => ({ ...f, keywords: e.target.value }))}
          />
          <div className="muted-sm" style={{ marginTop: 'var(--space-1)' }}>
            A new expense whose note contains one of these lands here automatically.
          </div>
        </div>

        <label className="radio">
          <input
            type="checkbox"
            checked={form.excludeFromSpend}
            onChange={(e) => setForm((f) => ({ ...f, excludeFromSpend: e.target.checked }))}
          />
          <span className="dot" style={{ borderRadius: 4 }} />
          Keep out of spend totals
        </label>

        {error && (
          <div className="banner error">
            <i className="ph ph-warning-circle" />
            {error}
          </div>
        )}

        <div className="dialog-actions">
          {editing && (
            <button
              className="btn btn-ghost"
              style={{ marginRight: 'auto', color: 'var(--color-neutral-400)' }}
              disabled={busy}
              onClick={() => onDelete(initial)}
            >
              Delete
            </button>
          )}
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={busy} onClick={submit}>
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Categories() {
  const { month, settings, refresh, notify } = useApp();
  const state = useApi(() => api.categories.list({ month }), [month]);
  const [dialog, setDialog] = useState(null);

  async function save(values) {
    if (dialog?._id) await api.categories.update(dialog._id, values);
    else await api.categories.create(values);
    setDialog(null);
    notify(dialog?._id ? 'Category updated' : 'Category created');
    refresh();
    state.reload();
  }

  async function remove(category) {
    await api.categories.remove(category._id);
    setDialog(null);
    notify(`${category.name} deleted — its expenses are now uncategorized`);
    refresh();
    state.reload();
  }

  return (
    <>
      <Topbar title="Categories" subtitle="Buckets and the rules that fill them" />
      <div className="screen">
        <Async state={state} label="Loading categories">
          {(data) => {
            const ruled = data.items.filter((c) => c.keywords?.length).length;
            return (
              <div className="stack-tight" style={{ maxWidth: 980 }}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <span className="muted-sm">
                    {data.items.length} categories · {ruled}{' '}
                    {ruled === 1 ? 'rule' : 'rules'} auto-sorting new expenses ·{' '}
                    {formatMonthName(month)}
                  </span>
                  <button className="btn btn-primary spacer" onClick={() => setDialog({})}>
                    <i className="ph ph-plus" style={{ fontSize: 14 }} />
                    New category
                  </button>
                </div>

                {data.items.length === 0 && (
                  <section className="panel">
                    <Empty
                      icon="ph ph-tag"
                      title="No categories yet"
                      hint="Categories are the buckets everything else groups by — budgets, the donut, the movers table. Create a few to get started."
                      action={
                        <button className="btn btn-primary" onClick={() => setDialog({})}>
                          <i className="ph ph-plus" style={{ fontSize: 14 }} />
                          Create your first category
                        </button>
                      }
                    />
                  </section>
                )}

                <div className="grid-3">
                  {data.items.map((c) => (
                    <button key={c._id} className="cat-card" onClick={() => setDialog(c)}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                        <div className="cat-icon">
                          <i className={c.icon} style={{ fontSize: 16 }} />
                        </div>
                        <div>
                          <div style={{ fontSize: 14 }}>{c.name}</div>
                          <div style={{ fontSize: 11.5, color: 'var(--color-neutral-600)' }}>
                            {c.count} {c.count === 1 ? 'expense' : 'expenses'}
                          </div>
                        </div>
                        <i className="ph ph-dots-three spacer" style={{ color: 'var(--color-neutral-600)' }} />
                      </div>
                      <div className="num" style={{ fontSize: 17, marginTop: 'var(--space-4)' }}>
                        {formatMoney(c.amount, settings)}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--color-neutral-600)' }}>
                        {c.excludeFromSpend ? 'Excluded from spend' : c.rule}
                      </div>
                    </button>
                  ))}

                  {data.uncategorized.count > 0 && (
                    <div className="cat-card" style={{ cursor: 'default' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                        <div className="cat-icon">
                          <i className="ph ph-question" style={{ fontSize: 16 }} />
                        </div>
                        <div>
                          <div style={{ fontSize: 14 }}>Uncategorized</div>
                          <div style={{ fontSize: 11.5, color: 'var(--color-neutral-600)' }}>
                            {data.uncategorized.count}{' '}
                            {data.uncategorized.count === 1 ? 'expense' : 'expenses'}
                          </div>
                        </div>
                      </div>
                      <div className="num" style={{ fontSize: 17, marginTop: 'var(--space-4)' }}>
                        {formatMoney(data.uncategorized.amount, settings)}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--color-neutral-600)' }}>Needs review</div>
                    </div>
                  )}
                </div>

                {dialog && (
                  <CategoryDialog
                    initial={dialog._id ? dialog : null}
                    onClose={() => setDialog(null)}
                    onSave={save}
                    onDelete={remove}
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
