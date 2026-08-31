import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useApi, useApp } from '../lib/store.jsx';
import { Topbar, Async, Empty } from '../components/Shell.jsx';
import { TrendChart, Bar } from '../components/Charts.jsx';
import {
  formatMoney,
  formatMonthName,
  formatShortDate,
  formatDelta,
  rampColor,
} from '../lib/format.js';

function Stat({ icon, label, value, note }) {
  return (
    <div className="stat">
      <div className="stat-label">
        <i className={icon} />
        {label}
      </div>
      <div className="stat-value num">{value}</div>
      <div className="stat-note">{note}</div>
    </div>
  );
}

export default function Overview() {
  const { month, settings } = useApp();
  const navigate = useNavigate();

  const overview = useApi(() => api.reports.overview({ month }), [month]);
  const trend = useApi(() => api.reports.trend({ month, months: 6 }), [month]);
  const mix = useApi(() => api.reports.mix({ month }), [month]);

  const monthName = formatMonthName(month).split(' ')[0];

  return (
    <>
      <Topbar
        title="Overview"
        subtitle={
          overview.data
            ? `${formatMonthName(month)} · ${overview.data.expenseCount} expenses tracked`
            : formatMonthName(month)
        }
      />
      <div className="screen">
        <Async
          state={overview}
          label="Loading overview"
          empty={(data) =>
            data.expenseCount === 0 ? (
              <Empty
                icon="ph ph-receipt"
                title={`Nothing logged in ${formatMonthName(month)} yet`}
                hint="Add your first expense and this screen fills in."
                action={
                  <button className="btn btn-primary" onClick={() => navigate('/app/expenses/new')}>
                    <i className="ph ph-plus" style={{ fontSize: 14 }} />
                    Add expense
                  </button>
                }
              />
            ) : null
          }
        >
          {(data) => {
            const { stats, change, progress } = data;
            return (
              <div className="stack">
                <div className="stat-grid">
                  <Stat
                    icon="ph ph-arrow-down-right"
                    label={`Spent in ${monthName}`}
                    value={formatMoney(stats.spent.value, settings)}
                    note={`${stats.spent.pctOfBudget}% of budget · ${progress.daysLeft} days left`}
                  />
                  <Stat
                    icon="ph ph-wallet"
                    label="Left to spend"
                    value={formatMoney(stats.left.value, settings)}
                    note={
                      stats.left.value >= 0
                        ? `${formatMoney(stats.left.safeDaily, settings)} a day is safe`
                        : 'Over budget for this month'
                    }
                  />
                  <Stat
                    icon="ph ph-chart-bar"
                    label="Daily average"
                    value={formatMoney(stats.dailyAverage.value, settings)}
                    note={
                      stats.dailyAverage.change === 0
                        ? 'Level with last month'
                        : `${stats.dailyAverage.change > 0 ? 'Up' : 'Down'} ${formatMoney(
                            Math.abs(stats.dailyAverage.change),
                            settings
                          )} from ${change.previousLabel}`
                    }
                  />
                  <Stat
                    icon="ph ph-crown-simple"
                    label="Largest expense"
                    value={stats.largest ? formatMoney(stats.largest.value, settings) : '—'}
                    note={
                      stats.largest
                        ? [stats.largest.category, stats.largest.note]
                            .filter(Boolean)
                            .join(' · ')
                        : 'No expenses yet'
                    }
                  />
                </div>

                <div className="split-wide">
                  <section className="panel">
                    <div className="panel-head">
                      <h4>Monthly spend</h4>
                      <span style={{ fontSize: 11.5, color: 'var(--color-neutral-600)' }}>
                        last 6 months
                      </span>
                      <span
                        className="spacer"
                        style={{ fontSize: 11.5, color: 'var(--color-accent-300)' }}
                      >
                        {formatDelta(change.pct)} vs {change.previousLabel}
                      </span>
                    </div>
                    {trend.data && (
                      <>
                        <TrendChart
                          points={trend.data.points}
                          budget={trend.data.budget}
                          symbol={settings?.currencySymbol}
                        />
                        <div style={{ fontSize: 11.5, color: 'var(--color-neutral-600)', marginTop: 'var(--space-2)' }}>
                          Dashed line marks the {formatMoney(trend.data.budget, settings)} monthly budget.
                        </div>
                      </>
                    )}
                  </section>

                  <section className="panel">
                    <h4 style={{ margin: '0 0 var(--space-4)', fontSize: 16 }}>Where it went</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                      {mix.data?.items.length ? (
                        <>
                          {/* Top five here; the full breakdown lives on Reports. */}
                          {mix.data.items.slice(0, 5).map((c, i) => (
                            <div key={c._id || c.name}>
                              <div className="cat-row">
                                <i className={c.icon} />
                                <span>{c.name}</span>
                                <span className="num spacer">{formatMoney(c.amount, settings)}</span>
                                <span className="cat-pct">{c.pct}%</span>
                              </div>
                              <Bar pct={c.pct} color={rampColor(c.colorIndex ?? i)} />
                            </div>
                          ))}
                          {mix.data.items.length > 5 && (
                            <button
                              className="btn btn-ghost"
                              style={{ alignSelf: 'flex-start' }}
                              onClick={() => navigate('/app/reports')}
                            >
                              {mix.data.items.length - 5} more in Reports
                              <i className="ph ph-arrow-right" style={{ fontSize: 13 }} />
                            </button>
                          )}
                        </>
                      ) : (
                        <div className="muted-sm">No categorised spend yet.</div>
                      )}
                    </div>
                  </section>
                </div>

                <section className="panel panel-flush">
                  <div style={{ display: 'flex', alignItems: 'center', padding: '0 var(--space-6) var(--space-4)' }}>
                    <h4 style={{ margin: 0, fontSize: 16 }}>Recent activity</h4>
                    <button className="btn btn-ghost spacer" onClick={() => navigate('/app/expenses')}>
                      View all
                      <i className="ph ph-arrow-right" style={{ fontSize: 13 }} />
                    </button>
                  </div>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Category</th>
                        <th>Note</th>
                        <th style={{ textAlign: 'right' }}>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.recent.map((e) => (
                        <tr
                          key={e._id}
                          className="row-link"
                          onClick={() => navigate(`/app/expenses/${e._id}`)}
                        >
                          <td style={{ color: 'var(--color-neutral-500)', whiteSpace: 'nowrap' }}>
                            {formatShortDate(e.date)}
                          </td>
                          <td>
                            <span className="tag tag-neutral">
                              {e.category?.name || 'Uncategorized'}
                            </span>
                          </td>
                          <td style={{ color: 'var(--color-neutral-500)' }}>
                            {e.note || '—'}
                          </td>
                          <td className="num" style={{ textAlign: 'right' }}>
                            {formatMoney(e.amount, settings)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>
              </div>
            );
          }}
        </Async>
      </div>
    </>
  );
}
