import { rampColor, formatCompact } from '../lib/format.js';

/** The thin progress bar under a category row or budget card. */
export function Bar({ pct, color = 'var(--color-accent)' }) {
  const width = Math.max(0, Math.min(Number(pct) || 0, 100));
  return (
    <div className="bar-track">
      <div className="bar-fill" style={{ width: `${width}%`, background: color }} />
    </div>
  );
}

/**
 * Six-month spend trend. `style` switches between the three marks the canvas
 * exposed as a prop: bars, area or dots.
 */
export function TrendChart({ points = [], budget = 0, style = 'bars', symbol = '৳' }) {
  if (!points.length) return null;

  const W = 600;
  const H = 200;
  const base = 168;
  const top = 20;
  // Headroom above the tallest mark so the budget line and its label clear it.
  const max = Math.max(budget, ...points.map((p) => p.amount)) * 1.18 || 1;
  const y = (v) => base - (v / max) * (base - top);
  const x = (i) => (points.length === 1 ? W / 2 : 28 + i * ((W - 56) / (points.length - 1)));
  const last = points.length - 1;

  let marks = null;
  if (style === 'area') {
    const pts = points.map((p, i) => `${x(i)},${y(p.amount)}`).join(' ');
    marks = (
      <>
        <polygon
          points={`${pts} ${x(last)},${base} ${x(0)},${base}`}
          fill="rgba(145,132,217,.18)"
        />
        <polyline points={pts} fill="none" stroke="#9184d9" strokeWidth="2" strokeLinejoin="round" />
        {points.map((p, i) => (
          <circle key={p.month} cx={x(i)} cy={y(p.amount)} r="3.5" fill="#161826" stroke="#9184d9" strokeWidth="2" />
        ))}
      </>
    );
  } else if (style === 'dots') {
    marks = points.map((p, i) => (
      <g key={p.month}>
        <line x1={x(i)} x2={x(i)} y1={base} y2={y(p.amount)} stroke="#3f424d" strokeWidth="1" />
        <circle cx={x(i)} cy={y(p.amount)} r={i === last ? 7 : 5} fill={i === last ? '#9184d9' : '#5d5294'} />
        <text x={x(i)} y={y(p.amount) - 14} fill="#b2b6ca" fontSize="10" textAnchor="middle" fontFamily="Inter, system-ui, sans-serif">
          {formatCompact(p.amount)}
        </text>
      </g>
    ));
  } else {
    const bw = Math.min(34, (W - 56) / points.length - 6);
    marks = points.map((p, i) => (
      <g key={p.month}>
        <rect x={x(i) - bw / 2} y={top} width={bw} height={base - top} rx="4" fill="#292b31" />
        <rect
          x={x(i) - bw / 2}
          y={y(p.amount)}
          width={bw}
          height={base - y(p.amount)}
          rx="4"
          fill={i === last ? '#9184d9' : '#5d5294'}
        />
        <title>{`${p.label}: ${symbol}${p.amount.toLocaleString('en-US')}`}</title>
      </g>
    ));
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 200, display: 'block' }}>
      <line x1="8" x2={W - 8} y1={base} y2={base} stroke="rgba(233,233,237,.14)" />
      {/* The line carries no label of its own — wherever it sat inside the plot
          it crossed a bar. Callers name it in the caption underneath. */}
      {budget > 0 && (
        <line
          x1="8"
          x2={W - 8}
          y1={y(budget)}
          y2={y(budget)}
          stroke="#595d6c"
          strokeWidth="1"
          strokeDasharray="4 5"
        />
      )}
      {marks}
      {points.map((p, i) => (
        <text key={p.month} x={x(i)} y="190" fill="#75798c" fontSize="11" textAnchor="middle" fontFamily="Inter, system-ui, sans-serif">
          {p.label}
        </text>
      ))}
    </svg>
  );
}

/**
 * One bar per day of the period; weekends take the accent.
 *
 * A single rent-sized day would flatten every other bar to a sliver, so the
 * axis tops out at the 90th percentile of spending days. Days above that are
 * drawn full height in a lighter fill and called out underneath — the chart is
 * about the rhythm, and the outlier's real figure is still in its tooltip.
 */
export function DailyChart({ days = [], symbol = '৳' }) {
  if (!days.length) return null;
  const W = 560;
  const H = 120;
  const slot = (W - 20) / days.length;

  const spent = days.map((d) => d.amount).filter((a) => a > 0).sort((a, b) => a - b);
  const p90 = spent.length ? spent[Math.min(Math.floor(spent.length * 0.9), spent.length - 1)] : 0;
  const scaleMax = Math.max(p90, 1);
  const clipped = days.filter((d) => d.amount > scaleMax).length;

  return (
    <>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 120, display: 'block' }}>
        {days.map((d, i) => {
          const over = d.amount > scaleMax;
          const bh = Math.max(2, Math.min(d.amount / scaleMax, 1) * 96);
          return (
            <rect
              key={d.date}
              x={10 + i * slot}
              y={104 - bh}
              width={Math.max(2, slot - 3)}
              height={bh}
              rx="2"
              fill={over ? '#b5abfc' : d.weekend ? '#9184d9' : '#4a4666'}
            >
              <title>{`${d.date}: ${symbol}${d.amount.toLocaleString('en-US')}${
                over ? ' (above the scale)' : ''
              }`}</title>
            </rect>
          );
        })}
        <line x1="10" x2={W - 10} y1="105" y2="105" stroke="rgba(233,233,237,.12)" />
      </svg>
      {clipped > 0 && (
        <div style={{ fontSize: 11, color: 'var(--color-neutral-600)', marginTop: 'var(--space-2)' }}>
          {clipped} {clipped === 1 ? 'day runs' : 'days run'} past the top of the scale — hover for
          the real figure.
        </div>
      )}
    </>
  );
}

/** Category mix, total in the middle. */
export function Donut({ items = [], total = 0, symbol = '৳', caption = '' }) {
  const R = 52;
  const C = 2 * Math.PI * R;
  let offset = 0;

  return (
    <svg viewBox="0 0 140 140" style={{ width: 140, height: 140, flex: 'none' }}>
      <circle cx="70" cy="70" r={R} fill="none" stroke="#292b31" strokeWidth="16" />
      <g transform="rotate(-90 70 70)">
        {items.map((item, i) => {
          const len = total > 0 ? (item.amount / total) * C : 0;
          const arc = (
            <circle
              key={item._id || item.name}
              cx="70"
              cy="70"
              r={R}
              fill="none"
              stroke={rampColor(item.colorIndex ?? i)}
              strokeWidth="16"
              strokeDasharray={`${Math.max(len - 2, 0)} ${C - Math.max(len - 2, 0)}`}
              strokeDashoffset={-offset}
            >
              <title>{`${item.name}: ${symbol}${item.amount.toLocaleString('en-US')}`}</title>
            </circle>
          );
          offset += len;
          return arc;
        })}
      </g>
      <text x="70" y="66" fill="#e9e9ed" fontSize="17" fontWeight="500" textAnchor="middle" fontFamily="Inter, system-ui, sans-serif">
        {`${symbol}${Number(total).toLocaleString('en-US')}`}
      </text>
      <text x="70" y="84" fill="#75798c" fontSize="10" textAnchor="middle" fontFamily="Inter, system-ui, sans-serif">
        {caption.toUpperCase()}
      </text>
    </svg>
  );
}

/** The budget ring on the Budgets screen. */
export function Ring({ pct = 0 }) {
  const R = 34;
  const C = 2 * Math.PI * R;
  const value = Math.max(0, Math.min(Number(pct) || 0, 100)) / 100;
  const over = (Number(pct) || 0) > 100;

  return (
    <svg viewBox="0 0 88 88" style={{ width: 88, height: 88, flex: 'none' }}>
      <circle cx="44" cy="44" r={R} fill="none" stroke="#292b31" strokeWidth="9" />
      <circle
        cx="44"
        cy="44"
        r={R}
        fill="none"
        stroke={over ? '#b5abfc' : '#9184d9'}
        strokeWidth="9"
        strokeLinecap="round"
        strokeDasharray={`${C * value} ${C}`}
        transform="rotate(-90 44 44)"
      />
      <text x="44" y="49" fill="#e9e9ed" fontSize="16" fontWeight="500" textAnchor="middle" fontFamily="Inter, system-ui, sans-serif">
        {`${Math.round(Number(pct) || 0)}%`}
      </text>
    </svg>
  );
}

/** A small square legend swatch. */
export const Swatch = ({ colorIndex = 0 }) => (
  <span
    style={{
      width: 9,
      height: 9,
      borderRadius: 2,
      flex: 'none',
      background: rampColor(colorIndex),
    }}
  />
);
