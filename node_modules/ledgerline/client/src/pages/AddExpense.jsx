import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useApp } from '../lib/store.jsx';
import { Topbar, Loading, ErrorState } from '../components/Shell.jsx';
import { toDateInput } from '../lib/format.js';

const BLANK = {
  amount: '',
  date: toDateInput(new Date()),
  category: '',
  note: '',
};

export default function AddExpense() {
  const { id } = useParams();
  const editing = Boolean(id);
  const navigate = useNavigate();
  const { settings, categories, refresh, notify } = useApp();

  const [form, setForm] = useState(BLANK);
  const [loading, setLoading] = useState(editing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    if (!editing) return;
    let alive = true;
    setLoading(true);
    api.expenses
      .get(id)
      .then((e) => {
        if (!alive) return;
        setForm({
          amount: String(e.amount),
          date: toDateInput(e.date),
          category: e.category?._id || '',
          note: e.note || '',
        });
        setLoadError(null);
      })
      .catch((err) => alive && setLoadError(err.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [id, editing]);

  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));

  async function save(andAnother = false) {
    setError(null);
    const amount = Number(form.amount);
    if (!(amount > 0)) return setError('Enter an amount above zero.');

    setSaving(true);
    try {
      const body = { ...form, amount, category: form.category || null };
      if (editing) {
        await api.expenses.update(id, body);
        notify('Expense updated');
        refresh();
        navigate(`/app/expenses/${id}`);
      } else {
        const created = await api.expenses.create(body);
        notify('Expense saved');
        refresh();
        if (andAnother) {
          setForm({ ...BLANK, date: form.date });
        } else {
          navigate(`/app/expenses/${created._id}`);
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Loading label="Loading expense" />;
  if (loadError) return <ErrorState message={loadError} onRetry={() => navigate('/app/expenses')} />;

  return (
    <>
      <Topbar
        title={editing ? 'Edit expense' : 'Add expense'}
        subtitle={editing ? 'Change anything and save' : 'Takes about ten seconds'}
      />
      <div className="screen">
        <section
          className="panel"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-4)',
            maxWidth: 520,
          }}
        >
          <h4 style={{ margin: 0, fontSize: 16 }}>Expense details</h4>

          {error && (
            <div className="banner error">
              <i className="ph ph-warning-circle" />
              {error}
            </div>
          )}

          <div className="field">
            <label htmlFor="amount">Amount</label>
            <div className="amount-field">
              <span className="amount-currency">{settings?.currencySymbol}</span>
              <input
                id="amount"
                inputMode="decimal"
                placeholder="0"
                autoFocus
                value={form.amount}
                onChange={(e) => set('amount')(e.target.value.replace(/[^\d.]/g, ''))}
              />
              <span className="amount-code">{settings?.currencyCode}</span>
            </div>
          </div>

          <div className="field">
            <label htmlFor="date">Date</label>
            <input
              id="date"
              type="date"
              className="input"
              value={form.date}
              onChange={(e) => set('date')(e.target.value)}
            />
          </div>

          <div className="field">
            <label>Category</label>
            <div className="chips">
              {categories.map((c) => (
                <button
                  key={c._id}
                  type="button"
                  className={`chip${form.category === c._id ? ' on' : ''}`}
                  onClick={() => set('category')(form.category === c._id ? '' : c._id)}
                >
                  <i className={c.icon} style={{ fontSize: 12 }} />
                  {c.name}
                </button>
              ))}
              <button
                type="button"
                className="chip"
                onClick={() => navigate('/app/categories')}
                title="Manage categories"
              >
                <i className="ph ph-plus" style={{ fontSize: 12 }} />
                New…
              </button>
            </div>
            {!form.category && form.note && (
              <div className="muted-sm" style={{ marginTop: 'var(--space-2)' }}>
                Leave this blank and a matching keyword in the note will sort it for you.
              </div>
            )}
          </div>

          <div className="field">
            <label htmlFor="note">Note</label>
            <textarea
              id="note"
              className="input"
              style={{ minHeight: 60 }}
              placeholder="What was this for?"
              value={form.note}
              onChange={(e) => set('note')(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
            <button className="btn btn-primary" disabled={saving} onClick={() => save(false)}>
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Save expense'}
            </button>
            {!editing && (
              <button className="btn btn-secondary" disabled={saving} onClick={() => save(true)}>
                Save &amp; add another
              </button>
            )}
            <button
              className="btn btn-ghost spacer"
              style={{ color: 'var(--color-neutral-400)' }}
              onClick={() => navigate(editing ? `/app/expenses/${id}` : '/app/expenses')}
            >
              Cancel
            </button>
          </div>
        </section>
      </div>
    </>
  );
}
