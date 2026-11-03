import { useEffect, useRef, useState } from 'react';
import { S, save, log, toast, openModal } from '../store.js';
import { DEPTS } from '../data/content.js';
import { Icon, Pill } from '../components/ui.jsx';
import { initials } from '../lib/util.js';

function InviteForm({ close }) {
  const [email, setEmail] = useState('');
  const [dept, setDept] = useState('BOS');
  const [role, setRole] = useState('editor');
  const [err, setErr] = useState('');
  const ref = useRef(null);
  useEffect(() => { setTimeout(() => ref.current?.focus(), 30); }, []);
  const submit = (e) => {
    e.preventDefault();
    const em = email.trim();
    if (!/^\S+@\S+\.\S+$/.test(em)) { setErr('Enter a valid email address.'); return; }
    // TODO(api): POST /api/v1/admin/invitations. That endpoint has no department field and uses admin/super_admin roles.
    S.admins.push({ name: 'Admin name', email: em, dept, role, status: 'invited' });
    log('invited', em, ''); save(); close(); toast('Invite sent to ' + em, { icon: 'send' });
  };
  return (
    <form className="modal" role="dialog" aria-modal="true" aria-labelledby="ivt" noValidate onSubmit={submit}>
      <h3 id="ivt">Invite an admin</h3><p>They’ll get an email to set a password, then can edit their department’s pages.</p>
      <div className="fld"><label className="lbl" htmlFor="iem">Work email</label><input ref={ref} className="inp" id="iem" type="email" placeholder="name@otci.lagosstate.gov.ng" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
      <div className="row2">
        <div className="fld"><label className="lbl" htmlFor="idp">Department</label><select className="inp" id="idp" value={dept} onChange={(e) => setDept(e.target.value)}>{['BOS', 'C&I', 'Reforms', 'MCSD'].map((d) => <option key={d}>{d}</option>)}</select></div>
        <div className="fld"><label className="lbl" htmlFor="irl">Role</label><select className="inp" id="irl" value={role} onChange={(e) => setRole(e.target.value)}><option value="editor">Editor</option><option value="super">Super Admin</option></select></div>
      </div>
      <p className="err" hidden={!err}>{err && <><Icon n="x" />{err}</>}</p>
      <div className="acts"><button type="button" className="btn btn-g" onClick={close}>Cancel</button><button className="btn btn-p" type="submit"><Icon n="send" />Send invite</button></div>
    </form>
  );
}

export function inviteModal() { openModal((close) => <InviteForm close={close} />); }

export default function Admins() {
  const rm = (i) => { const [ad] = S.admins.splice(i, 1); save(); toast('Admin removed', { icon: 'trash', undo: () => { S.admins.splice(i, 0, ad); save(); } }); };
  return (
    <>
      <div className="h-row"><div><h1 className="h1">Department admins</h1><p className="lede">People who can edit each department’s pages. Editors can send pages for review; only Super Admins publish.</p></div><button className="btn btn-p" onClick={inviteModal}><Icon n="plus" />Invite admin</button></div>
      <div className="tbl-w"><table className="tbl">
        <thead><tr><th>Admin</th><th>Department</th><th>Role</th><th>Status</th><th /></tr></thead>
        <tbody>
          {S.admins.map((a, i) => (
            <tr key={a.email + i} style={{ cursor: 'default' }}>
              <td><div className="first"><span className="av" style={{ '--c': DEPTS[a.dept] || 'var(--accent)' }}>{initials(a.name === 'Admin name' ? a.email : a.name)}</span><div>{a.name}<small>{a.email}</small></div></div></td>
              <td>{a.dept === 'All departments' ? 'All departments' : <span className="tag"><span className="dot" style={{ '--c': DEPTS[a.dept] }} />{a.dept}</span>}</td>
              <td><Pill k={a.role} /></td>
              <td><Pill k={a.status} /></td>
              <td style={{ textAlign: 'right' }}>{a.role !== 'super' && <button className="ib danger" aria-label={`Remove ${a.email}`} onClick={() => rm(i)}><Icon n="trash" /></button>}</td>
            </tr>
          ))}
        </tbody>
      </table></div>
      <div className="tbl-foot"><span>{S.admins.length} admins</span><span>Placeholder people until accounts are connected</span></div>
    </>
  );
}
