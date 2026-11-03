import { useEffect, useRef, useState } from 'react';
import { S, UI, go, commit, toggleTheme, isDark, resetState, toast } from '../store.js';
import { META, PIDS } from '../data/content.js';
import { Icon } from './ui.jsx';
import { SITE_URL } from '../lib/util.js';
import { chNew } from '../views/Charter.jsx';
import { inviteModal } from '../views/Admins.jsx';

function items() {
  return [
    ...[['overview', 'Overview', 'home'], ['pages', 'Pages', 'pages'], ['charters', 'Service charters', 'file'], ['media', 'Media library', 'image'], ['activity', 'Activity', 'pulse'], ['admins', 'Department admins', 'users']]
      .map(([r, l, i]) => ({ g: 'Go to', l, i, run: () => go(r) })),
    ...PIDS.map((pid) => ({ g: 'Pages', l: META[pid].name, i: 'pages', sub: META[pid].url, run: () => go('page-' + pid) })),
    ...PIDS.flatMap((pid) => S.pages[pid].sections.map((s, k) => ({ g: 'Sections', l: s.title, i: 'layers', sub: META[pid].short || META[pid].name, run: () => { go('page-' + pid); UI.open = k; commit(); } }))),
    ...S.charters.map((c) => ({ g: 'Charters', l: c.short || c.name || 'New charter', i: 'file', sub: c.name && c.short ? c.name : '', run: () => go('charter-' + c._k) })),
    { g: 'Actions', l: 'New service charter', i: 'plus', run: () => chNew() },
    ...S.gallery.map((f) => ({ g: 'Folders', l: f.title || 'Untitled folder', i: 'folder', sub: f.images.length + ' images', run: () => go('media', { folder: f.id }) })),
    { g: 'Actions', l: 'Open the public website', i: 'ext', run: () => window.open(SITE_URL, '_blank', 'noopener') },
    { g: 'Actions', l: 'New gallery folder', i: 'plus', run: () => { go('media'); setTimeout(() => document.querySelector('[data-a=newfolder]')?.click(), 40); } },
    { g: 'Actions', l: 'Invite an admin', i: 'mail', run: () => { go('admins'); setTimeout(inviteModal, 60); } },
    { g: 'Actions', l: isDark() ? 'Switch to light theme' : 'Switch to dark theme', i: isDark() ? 'sun' : 'moon', run: toggleTheme },
    { g: 'Actions', l: 'Reset demo content', i: 'undo', run: () => { resetState(true); go('overview'); toast('Demo content reset'); } },
  ];
}

export default function Palette({ close }) {
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const all = useRef(items()).current;
  const listRef = useRef(null);
  const inputRef = useRef(null);

  const ql = q.trim().toLowerCase();
  let shown = all.filter((x) => !ql || (x.l + ' ' + (x.sub || '')).toLowerCase().includes(ql));
  if (!ql) shown = shown.filter((x) => x.g !== 'Sections').concat(shown.filter((x) => x.g === 'Sections').slice(0, 5));
  const cur = Math.min(sel, Math.max(0, shown.length - 1));

  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => { listRef.current?.querySelector('[aria-selected=true]')?.scrollIntoView({ block: 'nearest' }); }, [cur, q]);

  const run = (k) => { const x = shown[k]; if (!x) return; close(); x.run(); };
  let g = '';

  return (
    <div className="palette" role="dialog" aria-modal="true" aria-label="Search">
      <div className="pal-in"><Icon n="search" />
        <input ref={inputRef} value={q} placeholder="Search pages, sections, folders or actions" aria-label="Search" role="combobox" aria-expanded="true" aria-controls="pall"
          onChange={(e) => { setQ(e.target.value); setSel(0); }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setSel(Math.min(cur + 1, shown.length - 1)); }
            if (e.key === 'ArrowUp') { e.preventDefault(); setSel(Math.max(cur - 1, 0)); }
            if (e.key === 'Enter') { e.preventDefault(); run(cur); }
          }} />
      </div>
      <div className="pal-l" id="pall" role="listbox" ref={listRef}>
        {shown.length ? shown.map((x, k) => {
          const head = x.g !== g ? <div className="pal-g">{(g = x.g)}</div> : null;
          return (
            <span key={k} style={{ display: 'contents' }}>
              {head}
              <button className="pal-i" role="option" aria-selected={k === cur} onClick={() => run(k)} onMouseMove={() => k !== cur && setSel(k)}>
                <Icon n={x.i} /><span>{x.l}</span>{x.sub && <small>{x.sub}</small>}
              </button>
            </span>
          );
        }) : <div className="empty" style={{ padding: 28 }}><b>No matches</b>Try a page name such as “Gallery” or “Hero”.</div>}
      </div>
      <div className="pal-f"><span>↑↓ to move</span><span>↵ to open</span><span>esc to close</span></div>
    </div>
  );
}
