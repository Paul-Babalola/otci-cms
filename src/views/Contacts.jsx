import { useEffect, useRef, useState } from 'react';
import { openModal } from '../store.js';
import { Icon } from '../components/ui.jsx';
import { adminContact } from '../lib/api/index.js';

const when = (iso) => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');

function Detail({ id, row, close, onRead }) {
  const [item, setItem] = useState(row);
  useEffect(() => {
    adminContact.get(id).then((d) => { setItem(d); onRead?.(); }).catch(() => {});
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  const c = item || {};
  const line = (label, v) => v ? <p style={{ margin: '4px 0' }}><b style={{ fontWeight: 600 }}>{label}:</b> {v}</p> : null;
  return (
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="crt" style={{ maxWidth: 560 }}>
      <h3 id="crt">{c.reference || 'Contact request'}</h3>
      <p style={{ whiteSpace: 'pre-wrap' }}>{c.message}</p>
      {line('MDA', c.mda)}
      {line('Needs', c.need)}
      {line('Contact', [c.name, c.email, c.phone].filter(Boolean).join(' · '))}
      {line('Submitted', when(c.submitted_at))}
      <div className="acts">
        {c.email && <a className="btn btn-g" href={`mailto:${c.email}?subject=${encodeURIComponent(`Re: ${c.reference || 'your MCSD request'}`)}`}><Icon n="mail" />Reply by email</a>}
        <button className="btn btn-p" onClick={close}>Close</button>
      </div>
    </div>
  );
}

export default function Contacts() {
  const [items, setItems] = useState(null);
  const [meta, setMeta]   = useState(null);
  const [err, setErr]     = useState(null);
  const [page, setPage]   = useState(1);
  const [q, setQ]         = useState('');
  const abortRef = useRef(null);

  const load = (p = page) => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setErr(null);
    adminContact.list({ page: p, search: q }, { signal: ctrl.signal })
      .then(({ items, meta }) => { if (!ctrl.signal.aborted) { setItems(items); setMeta(meta); } })
      .catch((e) => {
        if (e?.name === 'AbortError' || ctrl.signal.aborted) return;
        setErr(e.message || 'Could not load contact requests.');
        setItems([]);
      });
  };

  useEffect(() => { load(page); }, [page]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const t = setTimeout(() => { setPage(1); load(1); }, 300); return () => clearTimeout(t); }, [q]); // eslint-disable-line react-hooks/exhaustive-deps

  const open = (row) => openModal((close) => (
    <Detail id={row.id} row={row} close={close}
            onRead={() => setItems((xs) => xs?.map((x) => (x.id === row.id ? { ...x, is_read: true } : x)))} />
  ));

  const loading = items === null;
  const rows = items ?? [];
  const last = meta?.last_page || 1;

  return (
    <>
      <div className="h-row">
        <div>
          <h1 className="h1">Contact requests</h1>
          <p className="lede">Requests for Management Consulting Services from MDAs. Opening one marks it as read.{meta?.unread_count ? ` ${meta.unread_count} unread.` : ''}</p>
        </div>
      </div>

      <div className="fld" style={{ maxWidth: 360, marginBottom: 14 }}>
        <input className="inp" type="search" placeholder="Search reference, MDA or email" aria-label="Search contact requests"
               value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {err && <p className="err" style={{ marginBottom: 16 }}><Icon n="x" />{err}</p>}

      <div className="tbl-w">
        <table className="tbl">
          <thead><tr><th>Reference</th><th>MDA</th><th>Needs</th><th>Email</th><th>Received</th></tr></thead>
          <tbody>
            {loading && (
              <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--muted)', padding: '32px 0' }}>
                <span className="spin" style={{ display: 'inline-block' }} /> Loading contact requests…
              </td></tr>
            )}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--muted)', padding: '32px 0' }}>
                No contact requests{q ? ' match this search' : ' yet'}.
              </td></tr>
            )}
            {rows.map((c) => (
              <tr key={c.id} onClick={() => open(c)} style={{ cursor: 'pointer', fontWeight: c.is_read ? undefined : 600 }}>
                <td><span className="num">{c.reference}</span>{!c.is_read && <span className="dot" style={{ '--c': 'var(--accent)', marginLeft: 6 }} />}</td>
                <td>{c.mda || '—'}</td>
                <td style={{ color: 'var(--muted)' }}>{c.need || '—'}</td>
                <td style={{ color: 'var(--muted)' }}>{c.email || '—'}</td>
                <td style={{ color: 'var(--muted)', fontSize: '0.85em' }}>{when(c.submitted_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="tbl-foot">
        <span>{loading ? '…' : `${meta?.total ?? rows.length} request${(meta?.total ?? rows.length) !== 1 ? 's' : ''}`}</span>
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
