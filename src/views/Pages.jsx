import { S, UI, commit, go, comp, secState, totals } from '../store.js';
import { META, PIDS, DEPTS } from '../data/content.js';
import { Icon, Pill, Grow } from '../components/ui.jsx';
import { ago } from '../lib/util.js';

export default function Pages() {
  const f = UI.filter;
  const rows = [];
  PIDS.forEach((pid) => {
    const m = META[pid];
    if (f.dept !== 'all' && m.dept !== f.dept) return;
    S.pages[pid].sections.forEach((s, i) => {
      const c = comp(pid, s), st = secState(s);
      if (f.status === 'changes' && !s.dirty) return;
      if (f.status === 'review' && !S.pages[pid].review) return;
      if (f.status === 'thin' && c >= 0.6) return;
      if (f.status === 'hidden' && s.visible) return;
      if (f.status === 'live' && st !== 'live') return;
      if (f.q && !(s.title + ' ' + m.name).toLowerCase().includes(f.q.toLowerCase())) return;
      rows.push({ pid, i, s, c, st });
    });
  });
  const set = (k, v) => { UI.filter = { ...UI.filter, [k]: v }; commit(); };
  const clear = () => { UI.filter = { dept: 'all', status: 'all', q: '' }; commit(); };
  const open = (r) => { go('page-' + r.pid); UI.open = r.i; commit(); };

  return (
    <>
      <div className="h-row"><div><h1 className="h1">Pages</h1><p className="lede">Every section on the OTCI website. Open one to edit it with a live preview.</p></div></div>
      <div className="filters">
        <label className="fsel"><Icon n="layers" /><span className="sr">Department</span>
          <select value={f.dept} onChange={(e) => set('dept', e.target.value)}><option value="all">All departments</option>{Object.keys(DEPTS).map((d) => <option key={d} value={d}>{d}</option>)}</select>
        </label>
        <label className="fsel"><Icon n="filter" /><span className="sr">Status</span>
          <select value={f.status} onChange={(e) => set('status', e.target.value)}>
            {[['all', 'Any status'], ['live', 'Live'], ['changes', 'Unpublished changes'], ['review', 'In review'], ['hidden', 'Hidden'], ['thin', 'Needs content']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        {(f.dept !== 'all' || f.status !== 'all' || f.q) && <button className="btn btn-g" style={{ height: 36 }} onClick={clear}><Icon n="x" />Clear filters</button>}
        <label className="search"><Icon n="search" /><span className="sr">Search sections</span><input value={f.q} placeholder="Search sections or pages" onChange={(e) => set('q', e.target.value)} /></label>
      </div>
      <div className="tbl-w">
        {rows.length ? (
          <table className="tbl">
            <thead><tr><th>Section</th><th>Page</th><th>Status</th><th>Completeness</th><th>Last edited</th><th /></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.s.uid} tabIndex={0} onClick={() => open(r)} onKeyDown={(e) => { if (e.key === 'Enter') open(r); }}>
                  <td><div className="first"><span className="dot" style={{ '--c': DEPTS[META[r.pid].dept] }} /><div>{r.s.title}<small>{META[r.pid].url}</small></div></div></td>
                  <td>{META[r.pid].short || META[r.pid].name}</td>
                  <td><Pill k={r.st} /></td>
                  <td><span className="barw" style={{ width: 150 }}><span className="bar"><Grow w={`${Math.round(r.c * 100)}%`} style={{ '--c': r.c < 0.6 ? 'var(--warn)' : 'var(--accent)' }} /></span><b className="num">{Math.round(r.c * 100)}%</b></span></td>
                  <td className="sub">{ago(r.s.editedAt)}</td>
                  <td><Icon n="chev" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="empty"><b>No sections match these filters</b>Try a different department or status.<br /><button className="btn btn-s" onClick={clear}>Clear filters</button></div>
        )}
      </div>
      <div className="tbl-foot"><span>{rows.length} of {totals().secs} sections</span><span>Sorted by page order</span></div>
    </>
  );
}
