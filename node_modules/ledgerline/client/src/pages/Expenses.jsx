import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useApi, useApp } from '../lib/store.jsx';
import { Topbar, Async, Empty } from '../components/Shell.jsx';
import { formatMoney, formatMonthName, formatShortDate } from '../lib/format.js';

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'uncategorized', label: 'Uncategorized' },
];

const PAGE_SIZE = 10;

/** Turn the rows into a CSV file the browser downloads. */
function exportCsv(rows, symbol) {
  const head = ['Date', 'Category', 'Note', `Amount (${symbol})`];
  const escape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const body = rows.map((r) =>
    [
      new Date(r.date).toISOString().slice(0, 10),
      r.category?.name || 'Uncategorized',
      r.note,
      r.amount,
    ]
      .map(escape)
      .join(',')
  );
  const blob = new Blob([[head.map(escape).join(','), ...body].join('\n')], {
    type: 'text/csv;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'expenses.csv';
  a.click();
  URL.revokeObjectURL(url);
}

export default function Expenses() {
  const { month, settings, categories, notify } = useApp();
  const navigate = useNavigate();

  const [filter, setFilter] = useState('all');
  const [category, setCategory] = useState('');
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(search), 250);
    return () => clearTimeout(id);
  }, [search]);

  // Any change to the filters puts us back on the first page.
  useEffect(() => setPage(1), [filter, category, debounced, month]);

  const state = useApi(
    () =>
      api.expenses.list({
        month,
        filter,
        category,
        q: debounced,
        page,
        limit: PAGE_SIZE,
      }),
    [month, filter, category, debounced, page]
  );

  return (
    <>
      <Topbar
        title="Expenses"
        subtitle={`Every expense in ${formatMonthName(month)}`}
        search={search}
        onSearch={setSearch}
      />
      <div className="screen">
        <div className="stack-tight">
          <div className="toolbar">
            <div className="seg">
              {FILTERS.map((f) => (
                <label key={f.id} className="seg-opt">
                  <input
                    type="radio"
                    name="filter"
                    checked={filter === f.id}
                    onChange={() => setFilter(f.id)}
                  />
                  {f.label}
                </label>
              ))}
            </div>

            <select
              className="input"
              style={{ width: 'auto', minWidth: 150 }}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              aria-label="Filter by category"
            >
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </select>

            <span className="spacer muted-sm">
              {state.data
                ? `${state.data.total} ${state.data.total === 1 ? 'expense' : 'expenses'} · ${formatMoney(
                    state.data.spendAmount,
                    settings
                  )} spend`
                : ' '}
            </span>

            <button
              className="btn btn-secondary"
              disabled={!state.data?.items.length}
              onClick={() => {
                exportCsv(state.data.items, settings?.currencySymbol || '');
                notify('Exported this page to expenses.csv');
              }}
            >
              <i className="ph ph-export" style={{ fontSize: 14 }} />
              Export
            </button>
          </div>

          <Async
            state={state}
            label="Loading expenses"
            empty={(data) =>
              data.items.length === 0 ? (
                <section className="panel">
                  <Empty
                    icon="ph ph-funnel"
                    title="Nothing matches these filters"
                    hint="Try a different month, category or search."
                    action={
                      <button
                        className="btn btn-secondary"
                        onClick={() => {
                          setFilter('all');
                          setCategory('');
                          setSearch('');
                        }}
                      >
                        Clear filters
                      </button>
                    }
                  />
                </section>
              ) : null
            }
          >
            {(data) => (
              <section className="panel" style={{ padding: 'var(--space-3) 0' }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th style={{ width: 30 }} />
                      <th>Date</th>
                      <th>Category</th>
                      <th>Note</th>
                      <th style={{ textAlign: 'right' }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((e) => (
                      <tr
                        key={e._id}
                        className="row-link"
                        onClick={() => navigate(`/app/expenses/${e._id}`)}
                      >
                        <td>
                          <i
                            className={e.category?.icon || 'ph ph-question'}
                            style={{ fontSize: 15, color: 'var(--color-accent)' }}
                          />
                        </td>
                        <td style={{ color: 'var(--color-neutral-500)', whiteSpace: 'nowrap' }}>
                          {formatShortDate(e.date)}
                        </td>
                        <td>
                          <span className="tag tag-neutral">
                            {e.category?.name || 'Uncategorized'}
                          </span>
                        </td>
                        <td>{e.note || <span className="muted-sm">—</span>}</td>
                        <td className="num" style={{ textAlign: 'right' }}>
                          {formatMoney(e.amount, settings)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-3)',
                    padding: 'var(--space-4) var(--space-6) var(--space-2)',
                  }}
                >
                  <span className="muted-sm">
                    Showing {(data.page - 1) * data.limit + 1}–
                    {Math.min(data.page * data.limit, data.total)} of {data.total}
                  </span>
                  <div className="spacer" style={{ display: 'flex', gap: 'var(--space-2)' }}>
                    <button
                      className="btn btn-secondary btn-icon"
                      disabled={data.page <= 1}
                      onClick={() => setPage((p) => Math.max(p - 1, 1))}
                      aria-label="Previous page"
                    >
                      <i className="ph ph-caret-left" />
                    </button>
                    <button
                      className="btn btn-secondary btn-icon"
                      disabled={data.page >= data.pages}
                      onClick={() => setPage((p) => Math.min(p + 1, data.pages))}
                      aria-label="Next page"
                    >
                      <i className="ph ph-caret-right" />
                    </button>
                  </div>
                </div>
              </section>
            )}
          </Async>
        </div>
      </div>
    </>
  );
}
