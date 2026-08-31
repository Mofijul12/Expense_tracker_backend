import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';
import { usePrefersReducedMotion } from '../lib/scroll.js';

/**
 * Five chapters, each one a formation of the particle field behind them. The
 * canvas reads the scroll position itself; this component only tracks which
 * chapter is in view, for the rail and the copy fade.
 */
const CHAPTERS = [
  {
    rail: 'Scatter',
    eyebrow: '01 · Before',
    title: ['Every transaction, a ', 'point of light', '.'],
    body: 'Right now your spending is just scattered data — hundreds of tiny signals with no shape and no story.',
  },
  {
    rail: 'Cluster',
    eyebrow: '02 · Cluster',
    title: ['Points find their ', 'category', '.'],
    body: 'Ledgerline pulls every point toward where it belongs — groceries, rent, transport — without you lifting a finger.',
  },
  {
    rail: 'Chart',
    eyebrow: '03 · Chart',
    title: ['Clusters become a ', 'chart', '.'],
    body: 'The same points snap into bars you can actually read at a glance — no spreadsheet required.',
  },
  {
    rail: 'Trend',
    eyebrow: '04 · Trend',
    title: ['Bars become a ', 'trendline', " — and it's climbing."],
    body: 'Over weeks and months, the same data traces a line. You start to see momentum, not just numbers.',
  },
  {
    rail: 'Launch',
    eyebrow: '05 · Launch',
    title: ["You're ", 'ready', '.'],
    body: 'Same data. Completely different picture. Start turning your spending into something you understand.',
    last: true,
  },
];

// Placeholder figures carried over from the reference design — see the README.
const STATS = [
  { value: '4.2M+', label: 'transactions sorted' },
  { value: '98%', label: 'auto-categorized' },
  { value: '0.3s', label: 'sync time' },
];

export default function Home() {
  const reduced = usePrefersReducedMotion();
  const { user } = useAuth();
  const canvasRef = useRef(null);
  const chapterRefs = useRef([]);
  const [active, setActive] = useState(0);

  // The particle field owns its own scroll listener and animation loop. It is
  // imported dynamically so three.js lands in its own chunk: the copy paints
  // immediately, and anyone going straight to the dashboard never loads it.
  useEffect(() => {
    let destroy = null;
    let cancelled = false;

    import('../lib/particles.js').then(({ createParticleField }) => {
      if (cancelled) return;
      destroy = createParticleField(canvasRef.current, { reducedMotion: reduced });
    });

    return () => {
      cancelled = true;
      if (destroy) destroy();
    };
  }, [reduced]);

  // One observer drives both the rail and the chapter fade-in.
  useEffect(() => {
    const nodes = chapterRefs.current.filter(Boolean);
    if (!nodes.length || !('IntersectionObserver' in window)) {
      for (const node of nodes) node.classList.add('in-view');
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add('in-view');
          const index = nodes.indexOf(entry.target);
          if (index >= 0) setActive(index);
        }
      },
      { threshold: 0.5 }
    );

    for (const node of nodes) observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="lp">
      <div className="lp-canvas" ref={canvasRef} aria-hidden="true" />

      <nav className="lp-rail" aria-label="Chapters">
        {CHAPTERS.map((chapter, i) => (
          <a
            key={chapter.rail}
            href={`#chapter-${i}`}
            className={`lp-dot${i === active ? ' active' : ''}`}
            aria-label={chapter.rail}
            aria-current={i === active ? 'true' : undefined}
          >
            <span>{chapter.rail}</span>
          </a>
        ))}
      </nav>

      <main className="lp-story">
        {CHAPTERS.map((chapter, i) => (
          <section
            key={chapter.eyebrow}
            id={`chapter-${i}`}
            className={`lp-chapter${chapter.last ? ' last-chapter' : ''}`}
            ref={(node) => {
              chapterRefs.current[i] = node;
            }}
          >
            <div className="lp-chapter-content">
              <div className="lp-eyebrow">{chapter.eyebrow}</div>
              <h2>
                {chapter.title[0]}
                <em>{chapter.title[1]}</em>
                {chapter.title[2]}
              </h2>
              <p>{chapter.body}</p>

              {chapter.last && (
                <>
                  <div className="lp-cta-row">
                    {user ? (
                      <Link className="lp-btn lp-btn-primary" to="/app">
                        Open your dashboard
                      </Link>
                    ) : (
                      <>
                        <Link className="lp-btn lp-btn-primary" to="/register">
                          Start tracking free
                        </Link>
                        <Link className="lp-btn lp-btn-ghost" to="/login">
                          Sign in
                        </Link>
                      </>
                    )}
                  </div>

                  <div className="lp-stat-strip">
                    {STATS.map((stat) => (
                      <div key={stat.value}>
                        <strong>{stat.value}</strong>
                        {stat.label}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </section>
        ))}
      </main>
    </div>
  );
}
