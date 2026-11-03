import { S, UI, go, totals, pageComp, pageState } from '../store.js';
import { META, PIDS, DEPTS } from '../data/content.js';
import { Icon, Pill, Ticks, Stepper, Timeline, Grow, Count } from '../components/ui.jsx';
import { DAY } from '../lib/util.js';

const filterTo = (status) => { UI.filter = { dept: 'all', status, q: '' }; go('pages'); };

function Chip({ status, color, children }) {
  return <button className="chip" onClick={() => filterTo(status)}><i style={{ '--c': color }} />{children}</button>;
}

export default function Overview() {
  const t = totals();
  const hour = new Date().getHours(), greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const health = Math.round(t.health * 100), livePct = t.secs ? t.live / t.secs : 1;
  const days = [...Array(7)].map((_, i) => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - (6 - i)); return d; });
  const counts = days.map((d) => S.activity.filter((a) => a.t >= +d && a.t < +d + DAY).length);
  const max = Math.max(4, ...counts), hasDemo = S.activity.some((a) => a.demo);
  const pages = (n) => `${n} ${n === 1 ? 'page' : 'pages'}`;

  let brief;
  if (t.drafts) brief = <>You have <Chip status="changes" color="var(--warn)">{t.drafts} unpublished {t.drafts === 1 ? 'change' : 'changes'}</Chip> across {pages(t.draftPages)}{t.review ? <>, and <Chip status="review" color="var(--rev)">{pages(t.review)}</Chip> waiting for review</> : null}.</>;
  else if (t.review) brief = <><Chip status="review" color="var(--rev)">{pages(t.review)}</Chip> {t.review === 1 ? 'is' : 'are'} waiting for review.</>;
  else brief = <strong>Everything on the site is published.</strong>;

  return (
    <>
      <p className="sub" style={{ margin: '0 0 6px' }}>{greet}. Here is where the website stands.</p>
      <h1 className="brief">{brief}{t.thin ? <> <Chip status="thin" color="var(--bad)">{t.thin} sections</Chip> still need content.</> : null}</h1>
      <div className="kpis">
        <section className="card kpi">
          <div className="kpi-top"><span>Content health</span><span className={`pill ${health >= 80 ? 'ok' : health >= 60 ? 'warn' : 'bad'}`}>{health >= 80 ? 'Good' : health >= 60 ? 'Fair' : 'Needs work'}</span></div>
          <div className="kpi-v"><b className="num"><Count to={health} /></b><span className="of">%</span><span>of fields filled across {t.secs} sections</span></div>
          <Ticks n={48} frac={t.health} grad />
          <button className="foot-link" onClick={() => filterTo('thin')}><span>{t.thin} sections below 60% complete</span><Icon n="chev" /></button>
        </section>
        <section className="card kpi">
          <div className="kpi-top"><span>Sections live</span><span className="sub">{t.hidden} hidden</span></div>
          <div className="kpi-v"><b className="num"><Count to={t.live} /></b><span className="of">/{t.secs}</span></div>
          <div className="meter"><Grow as="div" className="fill" w={`${Math.max(livePct * 100 - 6, 8)}%`}>{Math.round(livePct * 100)}%</Grow><span className="knob" /><span className="rest">{Array.from({ length: Math.max(3, Math.round((1 - livePct) * 24)) }, (_, i) => <i key={i} />)}</span></div>
          <button className="foot-link" onClick={() => go('pages')}><span>{t.secs} sections on {PIDS.length} pages, {t.drafts} in draft</span><Icon n="chev" /></button>
        </section>
        <section className="card kpi">
          <div className="kpi-top"><span>Media library</span><span className="sub">{t.visFolders} of {t.folders} folders visible</span></div>
          <div className="kpi-v"><b className="num"><Count to={t.imgs} /></b><span>images in {t.folders} folders</span></div>
          <div className="stack">{S.gallery.map((f, i) => <Grow key={f.id} g={Math.max(f.images.length, 0.4)} title={`${f.title || 'Untitled'}: ${f.images.length}`} style={{ background: ['var(--accent)', '#7FD1AC', 'var(--line-2)', '#94A3B8', '#F39A45'][i % 5] }} />)}</div>
          <button className="foot-link" onClick={() => go('media')}><span>{t.noCover ? `${t.noCover} ${t.noCover === 1 ? 'folder has' : 'folders have'} no images yet` : 'Every folder has a cover image'}</span><Icon n="chev" /></button>
        </section>
      </div>
      <div className="ov">
        <div className="col">
          <section className="card"><div className="card-h"><h2 className="h2">Publishing pipeline</h2><span className="sub">Pages by stage</span></div><Stepper counts={[t.changes, t.review, t.published]} /></section>
          <section className="card">
            <div className="card-h" style={{ paddingBottom: 12 }}><h2 className="h2">Pages</h2><a className="btn btn-g" href="#pages" style={{ height: 32 }} onClick={(e) => { e.preventDefault(); go('pages'); }}>See all</a></div>
            {PIDS.map((pid) => {
              const c = pageComp(pid), st = pageState(pid);
              return (
                <a key={pid} className="prow" href={`#page-${pid}`} onClick={(e) => { e.preventDefault(); go('page-' + pid); }}>
                  <span className="nm"><span className="dot" style={{ '--c': DEPTS[META[pid].dept] }} /><span>{META[pid].name}</span></span>
                  <span><Pill k={st} /></span>
                  <span className="barw"><span className="bar"><Grow w={`${Math.round(c * 100)}%`} style={{ '--c': c < 0.6 ? 'var(--warn)' : 'var(--accent)' }} /></span><b className="num">{Math.round(c * 100)}%</b></span>
                  <Icon n="chev" />
                </a>
              );
            })}
          </section>
        </div>
        <div className="col">
          <section className="card">
            <div className="card-h"><div><h2 className="h2">Edits this week</h2><span className="sub"><span className="num">{counts.reduce((a, b) => a + b, 0)}</span> changes logged</span></div>{hasDemo && <span className="demo" title="Seeded sample activity, replaced once the CMS is connected">Sample data</span>}</div>
            <div className="card-b"><div className="chart">
              {counts.map((c, i) => (
                <div key={i} className={`c ${i === 6 ? 'today' : ''}`}>
                  <div className="trk"><Grow as="div" className="b" h={`${Math.max((c / max) * 100, c ? 16 : 0)}%`} style={{ '--d': `${i * 60}ms` }}>{c ? <span className="num">{c}</span> : null}</Grow></div>
                  <label>{i === 6 ? 'Today' : days[i].toLocaleDateString('en-GB', { weekday: 'short' })}</label>
                </div>
              ))}
            </div></div>
          </section>
          <section className="card"><div className="card-h"><h2 className="h2">Recent activity</h2><a className="btn btn-g" href="#activity" style={{ height: 32 }} onClick={(e) => { e.preventDefault(); go('activity'); }}>View all</a></div><Timeline list={S.activity.slice(0, 6)} compact /></section>
        </div>
      </div>
    </>
  );
}
