import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useApi, useApp } from '../lib/store.jsx';
import { Topbar, Loading, Empty } from '../components/Shell.jsx';
import { TrendChart, DailyChart, Donut, Swatch } from '../components/Charts.jsx';
import { formatMoney, formatMonthName, formatDelta } from '../lib/format.js';

const CHART_STYLES = [
  { id: 'bars', label: 'Bars' },
  { id: 'area', label: 'Area' },
  { id: 'dots', label: 'Dots' },
];

export default function Reports() {
  const { month, settings } = useApp();
  const navigate = useNavigate();
  // The canvas exposed this as an editable prop; here it is a real control.
  const [chartStyle, setChartStyle] = useState('bars');

  const trend = useApi(() => api.reports.trend({ month, months: 6 }), [month]);
  const mix = useApi(() => api.reports.mix({ month }), [month]);
  const daily = useApi(() => api.reports.daily({ month }), [month]);
  const movers = useApi(() => api.reports.movers({ month }), [month]);

  const loading = trend.loading && mix.loading && daily.loading && movers.loading;
  // Charts of six flat zero bars say nothing; show one honest message instead.
  const hasData =
    (trend.data?.points || []).some((p) => p.amount > 0) || (mix.data?.items.length || 0) > 0;

  return (
    <>
      <Topbar title="Reports" subtitle="Trends, mix and movers" />
      <div className="screen">
        {loading ? (
          <Loading label="Building reports" />
        ) : !hasData ? (
          <Empty
            icon="ph ph-chart-line-up"
            title="Nothing to report yet"
            hint="Reports compare months against each other. Log some expenses and the trend, mix and movers fill in."
            action={
              <button className="btn btn-primary" onClick={() => navigate('/app/expenses/new')}>
                <i className="ph ph-plus" style={{ fontSize: 14 }} />
                Add expense
              </button>
            }
          />
        ) : (
          <div className="stack-tight">
            <div className="split-report">
              <section className="panel">
                <div className="panel-head">
                  <h4>Spend over time</h4>
                  <span className="spacer seg" style={{ alignSelf: 'center' }}>
                    {CHART_STYLES.map((s) => (
                      <label key={s.id} className="seg-opt">
                        <input
                          type="radio"
                          name="chartStyle"
                          checked={chartStyle === s.id}
                          onChange={() => setChartStyle(s.id)}
                        />
                        {s.label}
                      </label>
                    ))}
                  </span>
                </div>
                {trend.data && (
                  <>
                    <TrendChart
                      points={trend.data.points}
                      budget={trend.data.budget}
                      style={chartStyle}
                      symbol={settings?.currencySymbol}
                    />
                    <div style={{ fontSize: 11.5, color: 'var(--color-neutral-600)', marginTop: 'var(--space-2)' }}>
                      {trend.data.points.length} months · budget line at{' '}
                      {formatMoney(trend.data.budget, settings)}
                    </div>
                  </>
                )}
              </section>

              <section className="panel">
                <h4 style={{ margin: '0 0 var(--space-4)', fontSize: 16 }}>Category mix</h4>
                {mix.data && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-6)' }}>
                    <Donut
                      items={mix.data.items}
                      total={mix.data.total}
                      symbol={settings?.currencySymbol}
                      caption={formatMonthName(month).split(' ')[0]}
                    />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', minWidth: 0 }}>
                      {mix.data.items.map((c, i) => (
                        <div
                          key={c._id || c.name}
                          style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5 }}
                        >
                          <Swatch colorIndex={c.colorIndex ?? i} />
                          <span style={{ whiteSpace: 'nowrap' }}>{c.name}</span>
                          <span className="spacer" style={{ color: 'var(--color-neutral-600)' }}>
                            {c.pct}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </section>
            </div>

            <div className="grid-2">
              <section className="panel">
                <h4 style={{ margin: '0 0 var(--space-4)', fontSize: 16 }}>Daily rhythm</h4>
                {daily.data && (
                  <>
                    <DailyChart days={daily.data.days} symbol={settings?.currencySymbol} />
                    <div style={{ fontSize: 11.5, color: 'var(--color-neutral-600)', marginTop: 'var(--space-3)' }}>
                      Weekends carry {daily.data.weekendShare}% of the month&apos;s spend.
                    </div>
                  </>
                )}
              </section>

              <section className="panel panel-flush">
                <h4 style={{ margin: '0 var(--space-6) var(--space-4)', fontSize: 16 }}>
                  Biggest movers vs {movers.data?.previousLabel?.split(' ')[0] || 'last month'}
                </h4>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Category</th>
                      <th style={{ textAlign: 'right' }}>
                        {movers.data?.previousLabel?.split(' ')[0] || 'Prev'}
                      </th>
                      <th style={{ textAlign: 'right' }}>
                        {formatMonthName(month).split(' ')[0].slice(0, 3)}
                      </th>
                      <th style={{ textAlign: 'right' }}>Change</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movers.data?.items.slice(0, 6).map((m) => (
                      <tr key={m._id}>
                        <td>{m.name}</td>
                        <td className="num" style={{ textAlign: 'right', color: 'var(--color-neutral-500)' }}>
                          {formatMoney(m.previous, settings)}
                        </td>
                        <td className="num" style={{ textAlign: 'right' }}>
                          {formatMoney(m.current, settings)}
                        </td>
                        <td
                          className="num"
                          style={{
                            textAlign: 'right',
                            color:
                              m.direction === 'up'
                                ? 'var(--color-accent-300)'
                                : m.direction === 'down'
                                  ? 'var(--color-neutral-400)'
                                  : 'var(--color-neutral-600)',
                          }}
                        >
                          {formatDelta(m.pct)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
