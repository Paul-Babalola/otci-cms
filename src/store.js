// App state. Content (S) is persisted to localStorage, like the original
// artifact; UI state is not. Components call useStore() to re-render on
// change, and mutate S/UI in place followed by commit().
//
// When the backend has CMS endpoints, replace persist()/load() with API calls.

import { useSyncExternalStore } from 'react';
import { PAGES, GALLERY, PIDS, rng } from './data/content.js';
import { CH_SEED } from './data/charterSeed.js';
import { clone, DAY, RM } from './lib/util.js';

const KEY = 'otci-studio-v4';

export function fresh() {
  const now = Date.now(), r = rng(42);
  const pages = {};
  PIDS.forEach((id) => {
    pages[id] = {
      review: false,
      publishedAt: now - (2 + Math.floor(r() * 9)) * DAY,
      sections: PAGES[id].sections.map((s, i) => ({
        uid: id + '-' + i, schema: i, title: s.title, visible: true, dirty: false,
        v: clone(s.v), pub: clone(s.v),
        editedAt: now - Math.floor(r() * 12) * DAY - Math.floor(r() * 20) * 36e5,
      })),
    };
  });
  // Sample workflow state so the dashboard has something to show
  pages.home.sections[5].dirty = true; pages.home.sections[5].editedAt = now - 25 * 6e4;
  pages.bos.sections[0].dirty = true; pages.bos.sections[0].editedAt = now - 3 * 36e5;
  pages.ci.review = true; pages.ci.sections[6].dirty = true; pages.ci.sections[6].editedAt = now - 5 * 36e5;
  pages.reforms.sections[6].visible = false;
  const who = ['Super Admin', 'BOS editor', 'C&I editor', 'Reforms editor', 'MCSD editor'];
  const verbs = ['edited', 'published', 'uploaded to', 'edited', 'hid'];
  const activity = [];
  for (let i = 0; i < 46; i++) {
    const pid = PIDS[Math.floor(r() * PIDS.length)];
    const sec = PAGES[pid].sections[Math.floor(r() * PAGES[pid].sections.length)];
    const v = Math.floor(r() * verbs.length);
    activity.push({ t: now - Math.floor(r() * 9.5 * DAY), who: who[Math.floor(r() * who.length)], verb: verbs[v], target: verbs[v] === 'uploaded to' ? 'Gallery' : sec.title, page: pid, demo: true });
  }
  activity.sort((a, b) => b.t - a.t);
  const gallery = clone(GALLERY).map((f, i) => ({ id: 'f' + i, title: f.title, desc: f.desc, visible: f.visible, images: f.images }));
  const admins = [
    { name: 'Super Admin', email: 'you@otci.lagosstate.gov.ng', dept: 'All departments', role: 'super', status: 'active' },
    { name: 'Admin name', email: 'bos.admin@example.gov.ng', dept: 'BOS', role: 'editor', status: 'active' },
    { name: 'Admin name', email: 'ci.admin@example.gov.ng', dept: 'C&I', role: 'editor', status: 'invited' },
  ];
  return { v: 2, authed: false, email: '', theme: 'system', pages, gallery, admins, activity, charters: clone(CH_SEED.charters) };
}

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s && s.v === 2) return s;
  } catch (_) { /* blocked or corrupt storage */ }
  return fresh();
}

export let S = load();
chInit();

export const UI = {
  route: 'overview',
  open: null,           // open section index in the page editor
  tab: 'sections',      // editor mobile tab
  dev: 'desk',          // preview device
  filter: { dept: 'all', status: 'all', q: '' },
  folder: null,         // open media folder id
  act: 'all',           // activity department filter
  nav: false,           // mobile nav drawer
  anim: true,           // play entrance animations once per visit
  ch: { tab: 'details', open: new Set(), pv: false, q: '', st: 'all' }, // charter UI
  toasts: [],
  modals: [],
};

// ---------------------------------------------------------------- subscriptions

let version = 0;
const subs = new Set();
const subscribe = (fn) => { subs.add(fn); return () => subs.delete(fn); };

/** Re-render every subscribed component. */
export function commit() { version++; subs.forEach((f) => f()); }

export function useStore() {
  useSyncExternalStore(subscribe, () => version);
  return S;
}

let saveT;
export function persist() {
  clearTimeout(saveT);
  saveT = setTimeout(() => {
    try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (_) { /* storage full: keep working in memory */ }
  }, 150);
}

/** Commit and persist in one go. */
export function save() { persist(); commit(); }

export function resetState(keepAuth) {
  const em = S.email;
  S = fresh();
  chInit();
  if (keepAuth) { S.authed = true; S.email = em; }
  save();
}

export function log(verb, target, page) {
  S.activity.unshift({ t: Date.now(), who: 'You', verb, target, page, demo: false, fresh: true });
  if (S.activity.length > 200) S.activity.length = 200;
}

export function chInit() {
  if (!Array.isArray(S.charters)) S.charters = clone(CH_SEED.charters);
  S.charters.forEach((c) => { if (!c._k) c._k = c.id || ('c' + Math.random().toString(36).slice(2, 8)); });
}

// ---------------------------------------------------------------- theme

export const isDark = () => S.theme === 'dark' || (S.theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
export function applyTheme() {
  if (S.theme === 'system') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = S.theme;
}
export function toggleTheme() { S.theme = isDark() ? 'light' : 'dark'; applyTheme(); save(); }

// ---------------------------------------------------------------- routing

export function validRoutes() {
  return ['overview', 'pages', 'charters', 'build', 'media', 'activity', 'admins',
    'feedback', 'contacts', 'subscribers',
    ...S.charters.map((c) => 'charter-' + c._k), ...PIDS.map((p) => 'page-' + p)];
}

export function go(r, opts = {}) {
  if (!S.authed) r = 'login';
  if (r !== UI.route) { UI.open = null; UI.folder = opts.folder ?? null; UI.tab = 'sections'; UI.anim = true; }
  UI.route = r;
  UI.nav = false;
  try { history.replaceState(null, '', r === 'overview' ? location.pathname : '#' + r); } catch (_) { /* sandboxed */ }
  const run = () => { commit(); window.scrollTo({ top: 0 }); };
  if (document.startViewTransition && !RM && !opts.instant) document.startViewTransition(run);
  else run();
}

// ---------------------------------------------------------------- toasts and modals

let toastId = 0;
/** @param {string} msg @param {{ icon?: string, undo?: () => void }} [opt] */
export function toast(msg, opt = {}) {
  const id = ++toastId;
  UI.toasts = [...UI.toasts, { id, msg, ...opt }];
  commit();
  setTimeout(() => dismissToast(id), opt.undo ? 6000 : 2600);
}
export function dismissToast(id) {
  if (!UI.toasts.some((t) => t.id === id)) return;
  UI.toasts = UI.toasts.map((t) => (t.id === id ? { ...t, out: true } : t));
  commit();
  setTimeout(() => { UI.toasts = UI.toasts.filter((t) => t.id !== id); commit(); }, 220);
}

let modalId = 0;
/** @param {(close: () => void) => import('react').ReactNode} render */
export function openModal(render) {
  const id = ++modalId;
  const last = document.activeElement;
  const close = () => { UI.modals = UI.modals.filter((m) => m.id !== id); commit(); last?.focus?.(); };
  UI.modals = [...UI.modals, { id, render, close }];
  commit();
  return close;
}

// ---------------------------------------------------------------- derived metrics (from real content)

function walk(fields, vals, acc) {
  for (const f of fields) {
    if (f.t === 'row') { walk(f.f, vals, acc); continue; }
    if (f.t === 'diagram' || f.t === 'note') continue;
    if (f.t === 'list') { acc.total++; const a = vals[f.k] || []; if (a.length) acc.filled++; a.forEach((it) => walk(f.fields, it, acc)); continue; }
    if (f.t === 'select' || f.t === 'color') continue;
    acc.total++;
    if (String(vals[f.k] ?? '').trim()) acc.filled++;
  }
  return acc;
}
export const secSchema = (pid, s) => PAGES[pid].sections[s.schema];
export function comp(pid, s) { const a = walk(secSchema(pid, s).fields, s.v, { total: 0, filled: 0 }); return a.total ? a.filled / a.total : 1; }
export const secState = (s) => (!s.visible ? 'hidden' : s.dirty ? 'draft' : 'live');
export function pageState(pid) { const p = S.pages[pid]; return p.review ? 'review' : p.sections.some((s) => s.dirty) ? 'changes' : 'published'; }
export function pageComp(pid) { const ss = S.pages[pid].sections; return ss.length ? ss.reduce((a, s) => a + comp(pid, s), 0) / ss.length : 1; }
export function totals() {
  let secs = 0, live = 0, drafts = 0, hidden = 0, thin = 0, compSum = 0;
  const draftPages = new Set();
  PIDS.forEach((pid) => S.pages[pid].sections.forEach((s) => {
    secs++; const c = comp(pid, s); compSum += c;
    if (c < 0.6) thin++;
    if (!s.visible) hidden++; else live++;
    if (s.dirty) { drafts++; draftPages.add(pid); }
  }));
  const imgs = S.gallery.reduce((a, f) => a + f.images.length, 0);
  return {
    secs, live, drafts, hidden, thin, health: secs ? compSum / secs : 1, draftPages: draftPages.size,
    review: PIDS.filter((p) => S.pages[p].review).length,
    published: PIDS.filter((p) => pageState(p) === 'published').length,
    changes: PIDS.filter((p) => pageState(p) === 'changes').length,
    imgs, folders: S.gallery.length, visFolders: S.gallery.filter((f) => f.visible).length,
    noCover: S.gallery.filter((f) => !f.images.length).length,
  };
}
