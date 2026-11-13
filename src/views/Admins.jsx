import { useEffect, useRef, useState } from 'react';
import { S, log, save, toast, openModal } from '../store.js';
import { DEPTS, META } from '../data/content.js';
import { Icon, Pill } from '../components/ui.jsx';
import { initials } from '../lib/util.js';
import { adminUsers } from '../lib/api/index.js';

// Department slugs accepted by POST /api/admin/users (department_slug).
const DEPT_OPTS = ['bos', 'ci', 'reforms', 'msd', 'nt'].map((slug) => ({ slug, name: META[slug]?.name || slug }));

// ---- invite form ----------------------------------------------------------------

function InviteForm({ close, onInvited }) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('department_admin');
  const [dept, setDept] = useState('bos');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const ref = useRef(null);
  useEffect(() => { setTimeout(() => ref.current?.focus(), 30); }, []);

  const submit = async (e) => {
    e.preventDefault();
    const em = email.trim();
    if (!em) { setErr('Enter an email address.'); return; }
    if (!/^\S+@\S+\.\S+$/.test(em)) { setErr(`"${em}" is not a valid email address.`); return; }
    setBusy(true);
    try {
      const payload = { email: em, role };
      if (role === 'department_admin') payload.department_slug = dept;
      await adminUsers.add(payload);
      log('invited', em, '');
      save();
      onInvited?.();
      close();
      toast('Onboarding email sent', { icon: 'send' });
    } catch (err) {
      setErr(err.fieldError?.('email') || err.message || 'Could not add the admin. Please try again.');
      setBusy(false);
    }
  };

  return (
    <form className="modal" role="dialog" aria-modal="true" aria-labelledby="ivt" noValidate onSubmit={submit}>
      <h3 id="ivt">Invite an admin</h3>
      <p>They'll get an onboarding email with a 48-hour activation link.</p>
      <div className="fld">
        <label className="lbl" htmlFor="iem">Work email</label>
        <input ref={ref} className="inp" id="iem" type="email"
               placeholder="name@otci.lagosstate.gov.ng"
               autoComplete="off" value={email}
               onChange={e => setEmail(e.target.value)} />
      </div>
      <div className="fld">
        <label className="lbl" htmlFor="irl">Role</label>
        <select className="inp" id="irl" value={role} onChange={e => setRole(e.target.value)}>
          <option value="department_admin">Department admin — edits one department</option>
          <option value="super_admin">Super Admin — can publish everything</option>
        </select>
      </div>
      {role === 'department_admin' && (
        <div className="fld">
          <label className="lbl" htmlFor="idp">Department</label>
          <select className="inp" id="idp" value={dept} onChange={e => setDept(e.target.value)}>
            {DEPT_OPTS.map(d => <option key={d.slug} value={d.slug}>{d.name}</option>)}
          </select>
        </div>
      )}
      <p className="err" hidden={!err}>{err && <><Icon n="x" />{err}</>}</p>
      <div className="acts">
        <button type="button" className="btn btn-g" onClick={close} disabled={busy}>Cancel</button>
        <button className="btn btn-p" type="submit" disabled={busy}>
          {busy ? <><span className="spin" />Sending…</> : <><Icon n="send" />Send invite</>}
        </button>
      </div>
    </form>
  );
}

export function inviteModal(onInvited) {
  openModal((close) => <InviteForm close={close} onInvited={onInvited} />);
}

// ---- main view -----------------------------------------------------------------

export default function Admins() {
  const [items, setItems] = useState(null);   // null = loading
  const [err, setErr]     = useState(null);
  const [busy, setBusy]   = useState({});     // { [id]: true } while an action is in flight
  const abortRef = useRef(null);

  const load = () => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setErr(null);

    adminUsers.list({}, { signal: ctrl.signal })
      .then(({ items }) => { if (!ctrl.signal.aborted) setItems(items); })
      .catch(e => {
        if (e?.name === 'AbortError' || ctrl.signal.aborted) return;
        setErr(e.message || 'Could not load administrators.');
        // Fall back to the local seed so the view is not blank
        setItems(S.admins.map(a => ({
          id: null,
          name: a.name === 'Admin name' ? a.email : a.name,
          email: a.email,
          role: a.role === 'super' ? 'super_admin' : 'department_admin',
          department: a.dept && a.dept !== 'All departments' ? { slug: '', name: a.dept } : null,
          is_activated: a.status === 'active',
        })));
      });

    return () => ctrl.abort();
  };

  useEffect(load, []);  // eslint-disable-line react-hooks/exhaustive-deps

  const run = async (id, fn, okMsg) => {
    setBusy(b => ({ ...b, [id]: true }));
    try {
      await fn();
      if (okMsg) toast(okMsg, { icon: 'check' });
      load();
    } catch (e) {
      toast(e.message || 'Action failed.', { icon: 'x' });
    } finally {
      setBusy(b => { const n = { ...b }; delete n[id]; return n; });
    }
  };

  const loading = items === null;
  const rows    = items ?? [];

  return (
    <>
      <div className="h-row">
        <div>
          <h1 className="h1">Department admins</h1>
          <p className="lede">Administrators who can manage the website. Super Admins can publish; department admins edit their own department.</p>
        </div>
        <button className="btn btn-p" onClick={() => inviteModal(load)}><Icon n="plus" />Invite admin</button>
      </div>

      {err && (
        <p className="err" style={{ marginBottom: 16 }}>
          <Icon n="x" />{err} — showing local data as a fallback.
        </p>
      )}

      <div className="tbl-w">
        <table className="tbl">
          <thead>
            <tr><th>Admin</th><th>Role</th><th>Department</th><th>Status</th><th /></tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--muted)', padding: '32px 0' }}>
                <span className="spin" style={{ display: 'inline-block' }} /> Loading administrators…
              </td></tr>
            )}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--muted)', padding: '32px 0' }}>
                No administrators yet.
              </td></tr>
            )}
            {rows.map((a, i) => {
              const isBusy = busy[a.id];
              const deptName = a.department?.name || (a.role === 'super_admin' ? 'All departments' : '—');
              return (
                <tr key={(a.id ?? a.email ?? '') + '-' + i} style={{ cursor: 'default', opacity: isBusy ? 0.6 : 1 }}>
                  <td>
                    <div className="first">
                      <span className="av" style={{ '--c': DEPTS[META[a.department?.slug]?.dept] || 'var(--accent)' }}>
                        {initials(a.name || a.email || '?')}
                      </span>
                      <div>{a.name || '—'}<small>{a.email}</small></div>
                    </div>
                  </td>
                  <td><Pill k={a.role === 'super_admin' ? 'super' : 'department_admin'} /></td>
                  <td style={{ color: 'var(--muted)', fontSize: '0.85em' }}>{deptName}</td>
                  <td><Pill k={a.is_activated ? 'active' : 'invited'} label={a.is_activated ? 'Active' : 'Awaiting activation'} /></td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {!a.is_activated && a.id != null && (
                      <button className="ib" aria-label={`Resend activation email to ${a.email}`} title="Resend activation email" disabled={isBusy}
                              onClick={() => run(a.id, () => adminUsers.resendActivation(a.id), 'Activation email resent.')}>
                        <Icon n="send" />
                      </button>
                    )}
                    {a.id != null && (
                      <button className="ib danger" aria-label={`Remove ${a.name || a.email}`} title="Remove admin" disabled={isBusy}
                              onClick={() => {
                                openModal((close) => (
                                  <div className="modal" role="dialog" aria-modal="true" aria-labelledby="rmt">
                                    <h3 id="rmt">Remove this admin?</h3>
                                    <p><b>{a.name || a.email}</b> will lose access to the CMS immediately. This cannot be undone.</p>
                                    <div className="acts">
                                      <button className="btn btn-g" onClick={close}>Cancel</button>
                                      <button className="btn btn-p" onClick={() => { close(); run(a.id, () => adminUsers.delete(a.id), 'Admin removed.'); }}>
                                        <Icon n="trash" />Remove
                                      </button>
                                    </div>
                                  </div>
                                ));
                              }}>
                        <Icon n="trash" />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="tbl-foot">
        <span>{loading ? '…' : `${rows.length} admin${rows.length !== 1 ? 's' : ''}`}</span>
        {err && <span style={{ color: 'var(--warn)' }}>Showing cached data — could not reach the API</span>}
      </div>
    </>
  );
}
