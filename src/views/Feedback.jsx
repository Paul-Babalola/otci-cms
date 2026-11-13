import { useEffect, useRef, useState } from 'react';
import { openModal } from '../store.js';
import { Icon } from '../components/ui.jsx';
import { adminFeedback } from '../lib/api/index.js';

const TYPES = ['Complaint', 'Commendation', 'Suggestion'];
const TYPE_CLS = { complaint: 'warn', commendation: 'ok', suggestion: 'rev' };
const typeCls = (t) => TYPE_CLS[String(t || '').toLowerCase()] || 'off';
const when = (iso) => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');

function Detail({ id, row, close, onRead }) {
  const [item, setItem] = useState(row);
  useEffect(() => {
    // Opening a submission marks it read on the server.
    adminFeedback.get(id).then((d) => { setItem(d); onRead?.(); }).catch(() => {});
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  const f = item || {};
  const line = (label, v) => (v || v === 0) ? <p style={{ margin: '4px 0' }}><b style={{ fontWeight: 600 }}>{label}:</b> {v}</p> : null;
  return (
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="fbt" style={{ maxWidth: 560 }}>
      <h3 id="fbt">{f.reference || 'Feedback'}<span className={`pill ${typeCls(f.feedback_type)}`} style={{ marginLeft: 10 }}>{f.feedback_type || '—'}</span></h3>
      <p style={{ whiteSpace: 'pre-wrap' }}>{f.description}</p>
      {line('From', f.is_anonymous ? 'Anonymous' : [f.full_name, f.email, f.contact_number].filter(Boolean).join(' · '))}
      {line('MDA', [f.mda, f.department].filter(Boolean).join(' — '))}
      {line('Service', f.service)}
      {line('Medical record no.', f.medical_record_number)}
      {line('Rating', f.rating ? `${f.rating}/5 (${f.rating_label || ''})` : null)}
      {line('Time taken', f.time_taken ? `${f.time_taken} ${f.time_taken_unit}${f.time_taken > 1 ? 's' : ''}` : null)}
      {line('Found info online', f.info_online)}
      {line('Submitted', when(f.submitted_at))}
      {!!f.attachments?.length && (
        <div style={{ marginTop: 10 }}>
          <b style={{ fontWeight: 600 }}>Attachments</b>
          {f.attachments.map((a, i) => (
            <p key={i} style={{ margin: '4px 0' }}>
              <a href={a.url || '#'} target="_blank" rel="noopener"><Icon n="file" /> {a.original_name || a.path}</a>
            </p>
          ))}
        </div>
      )}
      <div className="acts"><button className="btn btn-g" onClick={close}>Close</button></div>
    </div>
  );
}

export default function Feedback() {
  const [items, setItems] = useState(null);
  const [meta, setMeta]   = useState(null);
  const [err, setErr]     = useState(null);
  const [page, setPage]   = useState(1);
  const [type, setType]   = useState('');
  const [q, setQ]         = useState('');
  const abortRef = useRef(null);

  const load = (p = page) => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setErr(null);
    adminFeedback.list({ page: p, feedback_type: type, search: q }, { signal: ctrl.signal })
      .then(({ items, meta }) => { if (!ctrl.signal.aborted) { setItems(items); setMeta(meta); } })
      .catch((e) => {
        if (e?.name === 'AbortError' || ctrl.signal.aborted) return;
        setErr(e.message || 'Could not load feedback.');
        setItems([]);
      });
  };

  useEffect(() => { load(page); }, [page, type]); // eslint-disable-line react-hooks/exhaustive-deps
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
          <h1 className="h1">Citizen feedback</h1>
          <p className="lede">Submissions from the public BOS feedback form. Opening one marks it as read.{meta?.unread_count ? ` ${meta.unread_count} unread.` : ''}</p>
        </div>
        <label className="fsel"><Icon n="filter" /><span className="sr">Feedback type</span>
          <select value={type} onChange={(e) => { setType(e.target.value); setPage(1); }}>
            <option value="">All types</option>{TYPES.map((t) => <option key={t} value={t.toLowerCase()}>{t}</option>)}
          </select>
        </label>
      </div>

      <div className="fld" style={{ maxWidth: 360, marginBottom: 14 }}>
        <input className="inp" type="search" placeholder="Search reference, name, email or service" aria-label="Search feedback"
               value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {err && <p className="err" style={{ marginBottom: 16 }}><Icon n="x" />{err}</p>}

      <div className="tbl-w">
        <table className="tbl">
          <thead><tr><th>Reference</th><th>Type</th><th>From</th><th>MDA</th><th>Rating</th><th>Received</th></tr></thead>
          <tbody>
            {loading && (
              <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--muted)', padding: '32px 0' }}>
                <span className="spin" style={{ display: 'inline-block' }} /> Loading feedback…
              </td></tr>
            )}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--muted)', padding: '32px 0' }}>
                No feedback submissions{type || q ? ' match these filters' : ' yet'}.
              </td></tr>
            )}
            {rows.map((f) => (
              <tr key={f.id} onClick={() => open(f)} style={{ cursor: 'pointer', fontWeight: f.is_read ? undefined : 600 }}>
                <td><span className="num">{f.reference}</span>{!f.is_read && <span className="dot" style={{ '--c': 'var(--accent)', marginLeft: 6 }} />}</td>
                <td><span className={`pill ${typeCls(f.feedback_type)}`}>{f.feedback_type || '—'}</span></td>
                <td>{f.is_anonymous ? <span style={{ color: 'var(--muted)' }}>Anonymous</span> : (f.full_name || f.email || '—')}</td>
                <td style={{ color: 'var(--muted)' }}>{f.mda || '—'}</td>
                <td>{f.rating ? <span className="num">{f.rating}/5</span> : '—'}</td>
                <td style={{ color: 'var(--muted)', fontSize: '0.85em' }}>{when(f.submitted_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="tbl-foot">
        <span>{loading ? '…' : `${meta?.total ?? rows.length} submission${(meta?.total ?? rows.length) !== 1 ? 's' : ''}`}</span>
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
