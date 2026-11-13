import { useEffect, useRef, useState } from 'react';
import { toast } from '../store.js';
import { Icon, Pill } from '../components/ui.jsx';
import { adminNewsletter } from '../lib/api/index.js';

const when = (iso) => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');

export default function Subscribers() {
  const [items, setItems]   = useState(null);
  const [meta, setMeta]     = useState(null);
  const [err, setErr]       = useState(null);
  const [page, setPage]     = useState(1);
  const [status, setStatus] = useState('active');
  const [q, setQ]           = useState('');
  const [exporting, setExporting] = useState(false);
  const abortRef = useRef(null);

  const load = (p = page) => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setErr(null);
    adminNewsletter.list({ page: p, status, search: q }, { signal: ctrl.signal })
      .then(({ items, meta }) => { if (!ctrl.signal.aborted) { setItems(items); setMeta(meta); } })
      .catch((e) => {
        if (e?.name === 'AbortError' || ctrl.signal.aborted) return;
        setErr(e.message || 'Could not load subscribers.');
        setItems([]);
      });
  };

  useEffect(() => { load(page); }, [page, status]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const t = setTimeout(() => { setPage(1); load(1); }, 300); return () => clearTimeout(t); }, [q]); // eslint-disable-line react-hooks/exhaustive-deps

  const exportCsv = async () => {
    setExporting(true);
    try {
      const { blob, filename } = await adminNewsletter.exportCsv({ status });
      const url = URL.createObjectURL(blob);
      const a = Object.assign(document.createElement('a'), { href: url, download: filename || 'subscribers.csv' });
      a.click();
      URL.revokeObjectURL(url);
      toast('Subscriber list downloaded', { icon: 'check' });
    } catch (e) {
      toast(e.message || 'Could not export the list.', { icon: 'x' });
    } finally {
      setExporting(false);
    }
  };

  const loading = items === null;
  const rows = items ?? [];
  const last = meta?.last_page || 1;

  return (
    <>
      <div className="h-row">
        <div>
          <h1 className="h1">Newsletter subscribers</h1>
          <p className="lede">People signed up for updates through the website footer.{meta?.active_count != null ? ` ${meta.active_count} active.` : ''}</p>
        </div>
        <button className="btn btn-p" onClick={exportCsv} disabled={exporting || loading}>
          {exporting ? <><span className="spin" />Exporting…</> : <><Icon n="upload" />Export CSV</>}
        </button>
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
        <div className="fld" style={{ maxWidth: 320, flex: '1 1 220px' }}>
          <input className="inp" type="search" placeholder="Search by email" aria-label="Search subscribers"
                 value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <label className="fsel"><Icon n="filter" /><span className="sr">Status</span>
          <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="active">Active</option>
            <option value="unsubscribed">Unsubscribed</option>
            <option value="all">All</option>
          </select>
        </label>
      </div>

      {err && <p className="err" style={{ marginBottom: 16 }}><Icon n="x" />{err}</p>}

      <div className="tbl-w">
        <table className="tbl">
          <thead><tr><th>Email</th><th>Source</th><th>Status</th><th>Subscribed</th></tr></thead>
          <tbody>
            {loading && (
              <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--muted)', padding: '32px 0' }}>
                <span className="spin" style={{ display: 'inline-block' }} /> Loading subscribers…
              </td></tr>
            )}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--muted)', padding: '32px 0' }}>
                No subscribers{q || status !== 'all' ? ' match these filters' : ' yet'}.
              </td></tr>
            )}
            {rows.map((s) => (
              <tr key={s.id} style={{ cursor: 'default' }}>
                <td>{s.email}</td>
                <td style={{ color: 'var(--muted)' }}>{s.source || '—'}</td>
                <td><Pill k={s.unsubscribed_at ? 'inactive' : 'active'} label={s.unsubscribed_at ? 'Unsubscribed' : 'Active'} /></td>
                <td style={{ color: 'var(--muted)', fontSize: '0.85em' }}>{when(s.subscribed_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="tbl-foot">
        <span>{loading ? '…' : `${meta?.total ?? rows.length} subscriber${(meta?.total ?? rows.length) !== 1 ? 's' : ''}`}</span>
        {last > 1 && (
          <span>
            <button className="ib" aria-label="Previous page" disabled={page <= 1} onClick={() => setPage(page - 1)}><Icon n="back" /></button>
            <span className="num" style={{ margin: '0 8px' }}>{page} / {last}</span>
            <button className="ib" aria-label="Next page" disabled={page >= last} onClick={() => setPage(page + 1)}><Icon n="chev" /></button>
          </span>
        )}
      </div>
    </>
  );
}
