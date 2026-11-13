import { useEffect } from 'react';
import { S, UI, commit, go, chInit } from '../store.js';
import { chIssues, chState } from '../lib/charterLogic.js';
import { Icon, Mic, ChPill } from '../components/ui.jsx';
import { chNew, chFill, chTemplate, chExport, chImport } from './Charter.jsx';
import { adminCharters } from '../lib/api/index.js';

const ORDER = { changes: 0, draft: 1, published: 2, coming: 3 };

export default function Charters() {
  chInit();

  useEffect(() => {
    adminCharters.list()
      .then(({ items }) => {
        if (!items.length) return;
        const edited = new Set(S.charters.filter((c) => c._dirty || c._fresh).map((c) => String(c._k)));
        const mapped = items.map((c) => {
          const existing = S.charters.find((x) => String(x._k) === String(c.key) || x.id === c.id);
          if (existing && edited.has(String(existing._k))) return existing;
          return {
            _k: String(c.key),
            id: c.id,
            name: c.name,
            short: c.short || '',
            sector: c.sector || '',
            icon: c.icon || 'gov',
            status: c.state === 'coming' ? 'coming' : (c.state === 'published' || c.state === 'changes') ? 'published' : 'draft',
            _dirty: c.state === 'changes',
            _apiKey: c.key,
            _issues_count: c.issues_count ?? null,
            services_count: c.services_count ?? 0,
            fee_tables_count: c.fee_tables_count ?? 0,
            services: [],
            schedules: [],
            mandates: [],
          };
        });
        S.charters = [...mapped, ...S.charters.filter((c) => c._fresh)];
        commit();
      })
      .catch(() => {});
  }, []);
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
              const issueCount = c._issues_count != null ? c._issues_count : is.length;
              const svcCount = c._apiKey != null ? (c.services_count ?? (c.services || []).length) : (c.services || []).length;
              const feeCount = c._apiKey != null ? (c.fee_tables_count ?? (c.schedules || []).length) : (c.schedules || []).length;
              return (
                <tr key={c._k} tabIndex={0} onClick={open} onKeyDown={(e) => { if (e.key === 'Enter') open(); }}>
                  <td><div className="first"><span className="ch-ico"><Mic k={c.icon} /></span><div>{c.short || c.name || 'Untitled charter'}<small>{c.short ? c.name : ''}</small></div></div></td>
                  <td>{c.sector || '—'}</td>
                  <td className="num">{svcCount || '—'}</td>
                  <td className="num">{feeCount || '—'}</td>
                  <td><ChPill c={c} /></td>
                  <td>{issueCount ? <span className="pill warn">{issueCount} to fix</span> : <span className="pill ok"><Icon n="check" />Ready</span>}</td>
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
