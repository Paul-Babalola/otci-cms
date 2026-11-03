import { S, UI, commit, go, chInit } from '../store.js';
import { chIssues, chState } from '../lib/charterLogic.js';
import { Icon, Mic, ChPill } from '../components/ui.jsx';
import { chNew, chFill, chTemplate, chExport, chImport } from './Charter.jsx';

const ORDER = { changes: 0, draft: 1, published: 2, coming: 3 };

export default function Charters() {
  chInit();
  const A = S.charters, CU = UI.ch, q = CU.q.trim().toLowerCase();
  const rows = A.filter((c) => (CU.st === 'all' || chState(c) === CU.st || (CU.st === 'draft' && chState(c) === 'changes')) && (!q || `${c.name} ${c.short} ${c.sector}`.toLowerCase().includes(q)))
    .sort((a, b) => (ORDER[chState(a)] - ORDER[chState(b)]) || String(a.name).localeCompare(b.name));
  const n = (k) => A.filter((c) => chState(c) === k).length;
  const svc = A.reduce((a, c) => a + (c.services || []).length, 0);
  const set = (k, v) => { CU[k] = v; commit(); };

  return (
    <>
      <div className="h-row">
        <div><h1 className="h1">Service charters</h1><p className="lede">Every MDA’s service level agreement, entered in one shape so the website shows them the same way: services, time to deliver, fees, fee tables and the service promise.</p></div>
        <div className="ed-acts">
          <button className="btn btn-g" onClick={chTemplate}><Icon n="file" />Template</button>
          <button className="btn btn-s" onClick={() => chFill(null)}><Icon n="upload" />From spreadsheet</button>
          <button className="btn btn-s" onClick={() => { chInit(); chExport(S.charters, 'Export all charters', 'otci-service-charters.json'); }}><Icon n="ext" />Export</button>
          <button className="btn btn-p" onClick={chNew}><Icon n="plus" />New charter</button>
        </div>
      </div>
      <div className="note-c ch-how"><Icon n="layers" /><div><b>Three steps for a new SLA</b><span>1. Download the template and fill one row per service, copying the time and fee exactly as the SLA states them. 2. Upload it with <i>From spreadsheet</i>: the CMS reads each time and fee and shows a check. 3. Attach the signed PDF, review and publish.</span></div></div>
      <div className="ch-kpis">
        <div className="card"><span className="sub">Published</span><b className="num">{n('published') + n('changes')}</b></div>
        <div className="card"><span className="sub">Drafts</span><b className="num">{n('draft') + n('changes')}</b></div>
        <div className="card"><span className="sub">Coming soon</span><b className="num">{n('coming')}</b></div>
        <div className="card"><span className="sub">Services listed</span><b className="num">{svc}</b></div>
      </div>
      <div className="filters">
        <div className="fsel"><Icon n="filter" />
          <select aria-label="Filter by status" value={CU.st} onChange={(e) => set('st', e.target.value)}>
            {[['all', 'All charters'], ['draft', 'Drafts and changes'], ['published', 'Published'], ['coming', 'Coming soon']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <label className="search"><Icon n="search" /><input value={CU.q} placeholder="Search MDAs or sectors" aria-label="Search charters" onChange={(e) => set('q', e.target.value)} /></label>
      </div>
      <div className="tbl-w">
        <table className="tbl">
          <thead><tr><th>MDA</th><th>Sector</th><th>Services</th><th>Fee tables</th><th>Status</th><th>Checks</th><th /></tr></thead>
          <tbody>
            {rows.map((c) => {
              const is = chIssues(c), open = () => go('charter-' + c._k);
              return (
                <tr key={c._k} tabIndex={0} onClick={open} onKeyDown={(e) => { if (e.key === 'Enter') open(); }}>
                  <td><div className="first"><span className="ch-ico"><Mic k={c.icon} /></span><div>{c.short || c.name || 'Untitled charter'}<small>{c.short ? c.name : ''}</small></div></div></td>
                  <td>{c.sector || '—'}</td>
                  <td className="num">{(c.services || []).length || '—'}</td>
                  <td className="num">{(c.schedules || []).length || '—'}</td>
                  <td><ChPill c={c} /></td>
                  <td>{is.length ? <span className="pill warn">{is.length} to fix</span> : <span className="pill ok"><Icon n="check" />Ready</span>}</td>
                  <td style={{ textAlign: 'right', color: 'var(--faint)' }}><Icon n="chev" /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!rows.length && <div className="empty"><b>No charters match</b>Try another status or search.</div>}
      </div>
      <div className="tbl-foot"><span>{rows.length} of {A.length} charters</span><span>The website reads the exported charters.json · <button className="ch-lnk" onClick={chImport}>Import JSON</button></span></div>
    </>
  );
}
