import { useEffect } from 'react';
import { S, UI, useStore, go, commit, save, toggleTheme, isDark, applyTheme, validRoutes, totals, pageState, openModal } from './store.js';
import { META, PIDS, DEPTS, PILL } from './data/content.js';
import { Icon, Mark, Toasts, Modals } from './components/ui.jsx';
import { SITE_URL } from './lib/util.js';
import { auth as cmsAuth } from './lib/api/index.js';
import { onCmsUnauthorized } from './lib/cmsApi.js';
import Login from './views/Login.jsx';
import Overview from './views/Overview.jsx';
import Pages from './views/Pages.jsx';
import Editor from './views/Editor.jsx';
import { Media, Folder } from './views/Media.jsx';
import Activity from './views/Activity.jsx';
import Admins, { inviteModal } from './views/Admins.jsx';
import Feedback from './views/Feedback.jsx';
import Contacts from './views/Contacts.jsx';
import Subscribers from './views/Subscribers.jsx';
import Build from './views/Build.jsx';
import Charters from './views/Charters.jsx';
import Charter, { chNew } from './views/Charter.jsx';
import Palette from './components/Palette.jsx';

export function openPalette() {
  if (UI.modals.some((m) => m.palette)) return;
  const close = openModal((c) => <Palette close={c} />);
  UI.modals[UI.modals.length - 1].palette = true;
  return close;
}

function Crumbs() {
  const r = UI.route;
  const link = (to, label, onClick) => <a href={`#${to}`} onClick={(e) => { e.preventDefault(); onClick ? onClick() : go(to); }}>{label}</a>;
  if (r.startsWith('charter-')) {
    const c = S.charters.find((x) => x._k === r.slice(8));
    return <>{link('charters', 'Service charters')}<Icon n="chev" /><b>{c?.short || c?.name || 'New charter'}</b></>;
  }
  if (r.startsWith('page-')) {
    const pid = r.slice(5), s = UI.open != null ? S.pages[pid].sections[UI.open] : null;
    return <>{link('pages', 'Pages')}<Icon n="chev" />{s ? <>{link(r, META[pid].short || META[pid].name, () => { UI.open = null; commit(); })}<Icon n="chev" /><b>{s.title}</b></> : <b>{META[pid].name}</b>}</>;
  }
  if (r === 'media' && UI.folder != null) {
    const f = S.gallery.find((x) => x.id === UI.folder);
    return <>{link('media', 'Media library', () => { UI.folder = null; commit(); })}<Icon n="chev" /><b>{f?.title || 'Untitled folder'}</b></>;
  }
  const map = { build: 'How it’s built', charters: 'Service charters', overview: 'Overview', pages: 'Pages', media: 'Media library', activity: 'Activity', admins: 'Department admins', feedback: 'Citizen feedback', contacts: 'Contact requests', subscribers: 'Newsletter subscribers' };
  return <b>{map[r] || ''}</b>;
}

function View() {
  const r = UI.route;
  if (r === 'overview') return <Overview />;
  if (r === 'pages') return <Pages />;
  if (r === 'media') return UI.folder != null ? <Folder /> : <Media />;
  if (r === 'activity') return <Activity />;
  if (r === 'admins') return <Admins />;
  if (r === 'feedback') return <Feedback />;
  if (r === 'contacts') return <Contacts />;
  if (r === 'subscribers') return <Subscribers />;
  if (r === 'build') return <Build />;
  if (r === 'charters') return <Charters />;
  if (r.startsWith('charter-')) return <Charter k={r.slice(8)} />;
  if (r.startsWith('page-')) return <Editor key={r} pid={r.slice(5)} />;
  return null;
}

function Shell() {
  const t = totals(), r = UI.route;
  const nv = (id, icon, label, ct, hot) => {
    const on = r === id || (id === 'pages' && r.startsWith('page-')) || (id === 'charters' && r.startsWith('charter-'));
    return (
      <a className={`nv ${on ? 'on' : ''}`} href={`#${id}`} aria-current={r === id ? 'page' : undefined} onClick={(e) => { e.preventDefault(); go(id); }}>
        <Icon n={icon} /><span>{label}</span>{ct != null && <span className={`ct num ${hot ? 'hot' : ''}`}>{ct}</span>}
      </a>
    );
  };
  const draftCharters = S.charters.filter((c) => c._dirty || c.status === 'draft').length;
  const closeNav = () => { UI.nav = false; commit(); };
  return (
    <div className="frame">
      <aside className={`side ${UI.nav ? 'show' : ''}`} aria-label="Main navigation">
        <div className="ws"><Mark /><div><b>OTCI Studio</b><small>Website CMS</small></div></div>
        <button className="find" onClick={openPalette}><Icon n="search" />Search or jump to<kbd>⌘K</kbd></button>
        <div className="grp"><span>Workspace</span>
          {nv('overview', 'home', 'Overview')}
          {nv('pages', 'pages', 'Pages', t.drafts || null, t.drafts)}
          {nv('charters', 'file', 'Service charters', draftCharters || null, true)}
          {nv('media', 'image', 'Media library', t.imgs)}
          {nv('activity', 'pulse', 'Activity')}
        </div>
        <div className="grp"><span>Departments</span>
          {PIDS.filter((p) => META[p].short).map((p) => {
            const st = pageState(p);
            return (
              <a key={p} className={`nv ${r === 'page-' + p ? 'on' : ''}`} href={`#page-${p}`} onClick={(e) => { e.preventDefault(); go('page-' + p); }}>
                <span className="dot" style={{ '--c': DEPTS[META[p].dept] }} /><span>{META[p].short}</span>
                {st !== 'published' && <span className={`ct ${st === 'changes' ? 'hot' : ''}`} title={PILL[st][0]}>{st === 'review' ? 'Review' : 'Draft'}</span>}
              </a>
            );
          })}
        </div>
        <div className="grp"><span>Inbox</span>
          {nv('feedback', 'star', 'Citizen feedback')}
          {nv('contacts', 'mail', 'Contact requests')}
          {nv('subscribers', 'send', 'Subscribers')}
        </div>
        <div className="grp"><span>Manage</span>{nv('admins', 'users', 'Department admins', S.admins.length)}{nv('build', 'layers', 'How it’s built')}</div>
        <div className="side-foot"><div className="me">
          <div className="av" style={{ '--c': 'var(--accent)' }}>SA</div>
          <div style={{ minWidth: 0 }}><b>Super Admin</b><small>{S.email || 'Signed in'}</small></div>
          <button className="ib" aria-label="Log out" title="Log out" onClick={() => {
            cmsAuth.logout().finally(() => { S.authed = false; save(); go('login'); });
          }}><Icon n="logout" /></button>
        </div></div>
      </aside>
      <div className={`side-scrim ${UI.nav ? 'show' : ''}`} onClick={closeNav} />
      <main className="main" id="main">
        <div className="top">
          <button className="ib menu-btn" aria-label="Open navigation" onClick={() => { UI.nav = true; commit(); }}><Icon n="menu" /></button>
          <nav className="crumb" aria-label="Breadcrumb"><Crumbs /></nav>
          <span className="sp" />
          <button className="ib" aria-label="Search" onClick={openPalette}><Icon n="search" /></button>
          <button className="ib" aria-label="Switch theme" title="Switch theme" onClick={toggleTheme}><Icon n={isDark() ? 'sun' : 'moon'} /></button>
          <a className="btn btn-s hide-m" href={SITE_URL} target="_blank" rel="noopener" style={{ height: 34 }}><Icon n="ext" />View website</a>
        </div>
        <div className="view"><div className="view-in" id="view"><View /></div></div>
      </main>
    </div>
  );
}

export default function App() {
  useStore();

  useEffect(() => {
    onCmsUnauthorized(() => { S.authed = false; save(); go('login'); });

    applyTheme();
    const h = location.hash.slice(1);
    UI.route = S.authed ? (validRoutes().includes(h) ? h : 'overview') : 'login';
    commit();
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const onScheme = () => { if (S.theme === 'system') commit(); };
    mq.addEventListener?.('change', onScheme);
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k' && S.authed) { e.preventDefault(); openPalette(); return; }
      if (e.key === 'Escape' && !UI.modals.length) {
        if (UI.nav) { UI.nav = false; commit(); return; }
        if (UI.open != null && UI.route.startsWith('page-')) { UI.open = null; commit(); }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => { mq.removeEventListener?.('change', onScheme); document.removeEventListener('keydown', onKey); };
  }, []);

  // The animation flag is consumed by the first render of each visit.
  useEffect(() => { UI.anim = false; });

  return (
    <>
      {UI.route === 'login' || !S.authed ? <Login /> : <Shell />}
      <Toasts />
      <Modals />
    </>
  );
}

export { chNew, inviteModal };
