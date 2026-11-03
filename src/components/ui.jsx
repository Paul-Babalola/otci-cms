import { useEffect, useRef, useState } from 'react';
import { P, MIC } from '../data/icons.js';
import { LOGO, PILL, META, DEPTS } from '../data/content.js';
import { CHP, chState } from '../lib/charterLogic.js';
import { UI, useStore, dismissToast, go } from '../store.js';
import { ago, gradAt, RM, DAY } from '../lib/util.js';

/** Stroke icon. Path data is static and comes from data/icons.js. */
export function Icon({ n, className = '' }) {
  return <svg className={`ic ${className}`} viewBox="0 0 24 24" aria-hidden="true" dangerouslySetInnerHTML={{ __html: P[n] || '' }} />;
}

/** MDA icon used by service charters. */
export function Mic({ k, size = 18 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" dangerouslySetInnerHTML={{ __html: MIC[k] || MIC.gov }} />;
}

export const Mark = () => <span className="mark"><img src={LOGO} alt="" /></span>;

export function Pill({ k, extra = '', label }) {
  const p = PILL[k];
  return <span className={`pill ${p[1]} ${extra}`}><Icon n={p[2]} />{label || p[0]}</span>;
}

export function ChPill({ c }) {
  const [k, l, i] = CHP[chState(c)];
  return <span className={`pill ${k}`}><Icon n={i} />{l}</span>;
}

/** Plays the CSS entrance animation (.go) a frame after mount. */
export function useGo() {
  const [go, setGo] = useState(false);
  useEffect(() => {
    let a, b;
    a = requestAnimationFrame(() => { b = requestAnimationFrame(() => setGo(true)); });
    return () => { cancelAnimationFrame(a); cancelAnimationFrame(b); };
  }, []);
  return go;
}

export function Ticks({ n, frac, grad }) {
  const on = Math.round(n * frac), go = useGo();
  return (
    <div className={`ticks ${go ? 'go' : ''}`} role="img" aria-label={`${Math.round(frac * 100)} percent`}>
      {Array.from({ length: n }, (_, i) => (
        <i key={i} className={i < on ? 'on' : ''} style={{ ...(grad ? { '--c': gradAt(i / (n - 1)) } : {}), '--d': `${i * 14}ms` }} />
      ))}
    </div>
  );
}

export function Mini({ frac }) {
  const on = Math.round(10 * frac);
  return (
    <span className="mini" style={{ '--c': frac < 0.5 ? 'var(--warn)' : frac < 1 ? 'var(--accent)' : 'var(--ok)' }} title={`${Math.round(frac * 100)}% complete`}>
      {Array.from({ length: 10 }, (_, i) => <i key={i} className={i < on ? 'on' : ''} />)}
    </span>
  );
}

/** Animated width/height/flex-grow: starts at 0 and grows on the next frame. */
export function Grow({ as: Tag = 'span', w, h, g, style, ...rest }) {
  const go = useGo();
  const s = { ...style };
  if (w != null) s.width = go ? w : 0;
  if (h != null) s.height = go ? h : 0;
  if (g != null) s.flexGrow = go ? g : 0;
  return <Tag style={s} {...rest} />;
}

/** Counts up from 0 once, on first mount. */
export function Count({ to, dec = 0 }) {
  const [v, setV] = useState(UI.anim && !RM ? 0 : to);
  useEffect(() => {
    if (RM) { setV(to); return; }
    const t0 = performance.now(), d = 900; let raf;
    const step = (t) => { const k = Math.min(1, (t - t0) / d), e = 1 - Math.pow(1 - k, 3); setV(to * e); if (k < 1) raf = requestAnimationFrame(step); };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [to]);
  return <>{v.toFixed(dec)}</>;
}

export function Stepper({ state, counts }) {
  const steps = [['Editing', 'Changes saved as drafts'], ['In review', 'Waiting for sign-off'], ['Published', 'Live on the website']];
  const idx = { changes: 0, review: 1, published: 2 }[state] ?? 0;
  return (
    <div className="stepper">
      {steps.map((s, i) => {
        let cl, sub;
        if (counts) { cl = i === 2 ? (counts[i] ? 'done' : 'todo') : (counts[i] ? 'now' : 'todo'); sub = s[1]; }
        else { cl = (i < idx || state === 'published') ? 'done' : i === idx ? 'now' : 'todo'; sub = i === idx ? (state === 'published' ? 'Everything on this page is live' : s[1]) : (cl === 'done' ? 'Done' : ' '); }
        const lineDone = counts ? !!counts[i] : i <= idx;
        return (
          <span key={i} style={{ display: 'contents' }}>
            {i > 0 && <span className={`step-line ${lineDone ? 'done' : ''}`} />}
            <div className={`step ${cl}`}>
              <div className="step-pill"><span className="st-i">{cl === 'done' && <Icon n="check" />}</span>{s[0]}{counts && <span className="step-ct num">{counts[i]}</span>}</div>
              <small>{sub}</small>
            </div>
          </span>
        );
      })}
    </div>
  );
}

const EVI = {
  edited: ['pen', 'var(--accent-soft)', 'var(--accent)'], published: ['globe', 'var(--ok-bg)', 'var(--ok)'],
  'uploaded to': ['upload', 'var(--rev-bg)', 'var(--rev)'], hid: ['eyeoff', 'var(--off-bg)', 'var(--off)'],
  showed: ['eye', 'var(--ok-bg)', 'var(--ok)'], deleted: ['trash', 'var(--bad-bg)', 'var(--bad)'],
  'sent for review': ['hour', 'var(--rev-bg)', 'var(--rev)'], discarded: ['undo', 'var(--warn-bg)', 'var(--warn)'],
  restored: ['undo', 'var(--ok-bg)', 'var(--ok)'], created: ['plus', 'var(--accent-soft)', 'var(--accent)'],
  invited: ['mail', 'var(--rev-bg)', 'var(--rev)'],
};

export function Timeline({ list, compact }) {
  // Highlight entries added this session once, then clear the flag.
  const fresh = useRef(new Set(list.filter((a) => a.fresh).map((a) => a.t)));
  useEffect(() => { list.forEach((a) => { a.fresh = false; }); }, [list]);
  if (!list.length) return <div className="empty"><b>No activity yet</b>Edits, uploads and publishes will appear here.</div>;
  const groups = {};
  const today = new Date(); today.setHours(0, 0, 0, 0);
  list.forEach((a) => {
    const g = a.t >= +today ? 'Today' : a.t >= +today - DAY ? 'Yesterday' : a.t >= +today - 6 * DAY ? 'Earlier this week' : 'Older';
    (groups[g] = groups[g] || []).push(a);
  });
  return (
    <div className="tl">
      {Object.entries(groups).map(([g, items]) => (
        <span key={g} style={{ display: 'contents' }}>
          <div className="tl-g"><span>{g}</span></div>
          {items.map((a, k) => {
            const e = EVI[a.verb] || EVI.edited, m = META[a.page];
            return (
              <div key={a.t + '-' + k} className={`ev ${fresh.current.has(a.t) ? 'fresh' : ''}`}>
                <span className="ev-i" style={{ '--bg': e[1], '--fg': e[2] }}><Icon n={e[0]} /></span>
                <p>
                  <b>{a.who}</b> {a.verb} <span className="tag">{a.target}</span>
                  {a.page && m && !compact && <> on <a href={`#page-${a.page}`} className="tag" style={{ textDecoration: 'none' }} onClick={(ev) => { ev.preventDefault(); go('page-' + a.page); }}><span className="dot" style={{ '--c': DEPTS[m.dept] }} />{m.short || m.name}</a></>}
                </p>
                <time>{ago(a.t)}</time>
              </div>
            );
          })}
        </span>
      ))}
    </div>
  );
}

export function Toasts() {
  useStore();
  return (
    <div className="toasts" role="status" aria-live="polite">
      {UI.toasts.map((t) => (
        <div key={t.id} className={`toast ${t.out ? 'out' : ''}`}>
          <Icon n={t.icon || 'check'} /><span>{t.msg}</span>
          {t.undo ? <button onClick={() => { t.undo(); dismissToast(t.id); }}><Icon n="undo" />Undo</button> : <span style={{ width: 8 }} />}
        </div>
      ))}
    </div>
  );
}

export function Modals() {
  useStore();
  return (
    <div id="layer">
      {UI.modals.map((m) => (
        <div key={m.id} className="scrim"
          onMouseDown={(e) => { if (e.target === e.currentTarget) m.close(); }}
          onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); m.close(); } }}>
          {m.render(m.close)}
        </div>
      ))}
    </div>
  );
}

/** Focus the first matching element after mount. */
export function useAutoFocus(selector, deps = []) {
  const ref = useRef(null);
  useEffect(() => {
    const t = setTimeout(() => ref.current?.querySelector(selector)?.focus(), 40);
    return () => clearTimeout(t);
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
  return ref;
}
