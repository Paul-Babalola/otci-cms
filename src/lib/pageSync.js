// Syncs the Studio's local homepage sections with the backend's page sections.
//
// The Studio's edit forms predate the backend's content schemas, so the two
// use different shapes and ids. This module maps them:
//
//   local 'Hero'                      ↔ hero            (headline, subtext)
//   local 'Impact numbers'            ↔ metrics_bar     (stats)
//   local 'What we do'                ↔ what_we_do      (header + departments)
//   local 'Transformation highlights' ↔ transformation_highlights
//   local 'Citizen voice band'        ↔ citizen_engagement_cta
//   local 'News & updates'            ↔ news_updates
//
// 'Hero' department tiles, 'How we work' and 'Audiences' have no backend
// section — they stay local. Backend fields the Studio doesn't edit (images,
// links, icons, colors) are preserved on save by spreading the previous
// content. Save routes: PUT /api/admin/pages/{slug}/sections/{id}.

import { cmsApiFetch } from './cmsApi.js';

const PAGE_SLUGS = { home: 'home' };
const API = {}; // pid -> { type: { id, content } }

const isUrl = (u) => /^https?:\/\//i.test(u || '');
const toISO = (d) => { const t = new Date(d); return isNaN(t) ? null : `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`; };
const fromISO = (d) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(d || '')); if (!m) return String(d || ''); return new Date(+m[1], +m[2] - 1, +m[3]).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }); };

// Keyed by the local section schema title. pull: backend → local form values.
// push: local form values → [{ id, content }] PUT payloads.
const ADAPTERS = {
  'Hero': {
    pull(v, api) {
      const c = api.hero && api.hero.content; if (!c) return;
      if (c.headline) v.headline = c.headline;
      if (c.subtext) v.subtext = c.subtext;
      if (Array.isArray(c.tiles) && c.tiles.length) v.tiles = c.tiles.map((t) => ({ dept: t.dept || 'OTCI', value: t.value || '', label: t.label || '' }));
    },
    push(v, api) {
      const s = api.hero; if (!s) return [];
      const prev = Array.isArray(s.content && s.content.tiles) ? s.content.tiles : [];
      const tiles = (v.tiles || []).map((t, i) => ({ ...(prev[i] || {}), dept: t.dept, value: t.value, label: t.label }));
      return [{ id: s.id, content: { ...s.content, headline: v.headline, subtext: v.subtext, tiles } }];
    },
  },
  'Impact numbers': {
    pull(v, api) {
      const c = api.metrics_bar && api.metrics_bar.content;
      if (Array.isArray(c && c.stats) && c.stats.length) v.stats = c.stats.map((s) => ({ value: s.value || '', label: s.label || '' }));
    },
    push(v, api) {
      const s = api.metrics_bar; if (!s) return [];
      const prev = Array.isArray(s.content && s.content.stats) ? s.content.stats : [];
      const stats = (v.stats || []).map((k, i) => ({ ...(prev[i] || { icon: 'Building', color: 'Green' }), label: k.label, value: k.value }));
      return [{ id: s.id, content: { ...s.content, stats } }];
    },
  },
  'What we do': {
    pull(v, api) {
      const c = api.what_we_do && api.what_we_do.content; if (!c) return;
      if (c.header && c.header.description) v.desc = c.header.description;
      if (Array.isArray(c.departments) && c.departments.length) v.cards = c.departments.map((d) => ({ title: d.title || '', desc: d.description || '' }));
    },
    push(v, api) {
      const s = api.what_we_do; if (!s) return [];
      const prev = Array.isArray(s.content && s.content.departments) ? s.content.departments : [];
      const departments = (v.cards || []).map((k, i) => ({ ...(prev[i] || {}), title: k.title, description: k.desc }));
      return [{ id: s.id, content: { ...s.content, header: { ...(s.content && s.content.header || {}), description: v.desc }, departments } }];
    },
  },
  'Transformation highlights': {
    pull(v, api) {
      const c = api.transformation_highlights && api.transformation_highlights.content; if (!c) return;
      if (c.header && c.header.title) v.title = c.header.title;
      if (c.header && c.header.description) v.desc = c.header.description;
      if (Array.isArray(c.highlights)) c.highlights.forEach((h, i) => {
        if (!v.items || !v.items[i]) return;
        if (h.title) v.items[i].title = h.title;
        if (isUrl(h.image)) v.items[i].img = h.image;
      });
    },
    push(v, api) {
      const s = api.transformation_highlights; if (!s) return [];
      const prev = Array.isArray(s.content && s.content.highlights) ? s.content.highlights : [];
      const highlights = (v.items || []).map((it, i) => ({ ...(prev[i] || {}), title: it.title, ...(isUrl(it.img) ? { image: it.img } : {}) }));
      return [{ id: s.id, content: { ...s.content, header: { ...(s.content && s.content.header || {}), title: v.title, description: v.desc }, highlights } }];
    },
  },
  'Citizen voice band': {
    pull(v, api) {
      const c = api.citizen_engagement_cta && api.citizen_engagement_cta.content; if (!c) return;
      if (c.headline) v.headline = c.headline;
      if (c.subtext) v.subtext = c.subtext;
      if (c.cta_tag && v.buttons && v.buttons[0]) v.buttons[0].label = c.cta_tag;
    },
    push(v, api) {
      const s = api.citizen_engagement_cta; if (!s) return [];
      const label = v.buttons && v.buttons[0] && v.buttons[0].label;
      return [{ id: s.id, content: { ...s.content, headline: v.headline, subtext: v.subtext, ...(label ? { cta_tag: label } : {}) } }];
    },
  },
  'News & updates': {
    pull(v, api) {
      const c = api.news_updates && api.news_updates.content; if (!c) return;
      if (c.header && c.header.title) v.title = c.header.title;
      if (c.header && c.header.description) v.desc = c.header.description;
      if (Array.isArray(c.items) && c.items.length) {
        v.articles = c.items.map((n, i) => ({
          ...(v.articles && v.articles[i] || { tag: 'Events', img: '' }),
          title: n.title || '', date: fromISO(n.date), body: n.description || '',
          ...(isUrl(n.image) ? { img: n.image } : {}),
        }));
      }
    },
    push(v, api) {
      const s = api.news_updates; if (!s) return [];
      const prev = Array.isArray(s.content && s.content.items) ? s.content.items : [];
      const items = (v.articles || []).map((a, i) => ({
        ...(prev[i] || {}),
        title: a.title, description: a.body || (prev[i] && prev[i].description) || '',
        ...(toISO(a.date) ? { date: toISO(a.date) } : {}),
        ...(isUrl(a.img) ? { image: a.img } : {}),
      }));
      return [{ id: s.id, content: { ...s.content, header: { ...(s.content && s.content.header || {}), title: v.title, description: v.desc }, items } }];
    },
  },
};

/** True when this page has backend-synced sections. */
export const pageSynced = (pid) => !!PAGE_SLUGS[pid];

/** True when this local section maps to a backend section. */
export const sectionSynced = (pid, title) => !!(PAGE_SLUGS[pid] && ADAPTERS[title] && API[pid]);

/**
 * Fetch the page's backend sections (admin first for drafts, public as
 * fallback) and cache them by type. Returns the map or null.
 */
export async function pageSyncLoad(pid) {
  const slug = PAGE_SLUGS[pid];
  if (!slug) return null;
  let secs = null;
  try {
    const b = await cmsApiFetch(`/api/admin/pages/${slug}/sections`);
    secs = b.sections || b.data || (Array.isArray(b) ? b : null);
  } catch (_) { /* not signed in or route differs — use the public shape */ }
  if (!secs) {
    try {
      const b = await cmsApiFetch(`/api/pages/${slug}`, { auth: false });
      secs = (b.page && b.page.sections) || null;
    } catch (_) { return null; }
  }
  if (!secs) return null;
  const map = {};
  secs.forEach((s) => { if (s && s.type) map[s.type] = { id: s.id, content: s.content || {} }; });
  API[pid] = map;
  return map;
}

/**
 * Overwrite local form values with the backend's current content.
 * Skips sections with unsaved local edits (dirty) so nothing is lost.
 * Returns the number of sections hydrated.
 */
export function pageSyncPull(pid, localSections, titleOf, clone) {
  if (!API[pid]) return 0;
  let n = 0;
  localSections.forEach((s) => {
    const a = ADAPTERS[titleOf(s)];
    if (!a || s.dirty) return;
    a.pull(s.v, API[pid]);
    s.pub = clone(s.v);
    n++;
  });
  return n;
}

/**
 * Save one local section to the backend. Resolves { synced: boolean }.
 * Throws on a server error so the caller can tell the editor the truth.
 */
export async function pageSyncSave(pid, title, v) {
  const slug = PAGE_SLUGS[pid];
  const a = ADAPTERS[title];
  if (!slug || !a) return { synced: false };          // local-only section
  if (!API[pid]) await pageSyncLoad(pid);
  if (!API[pid]) throw new Error('Could not reach the server to look up this section.');
  const puts = a.push(v, API[pid]);
  if (!puts.length) return { synced: false };          // no matching backend section
  for (const p of puts) {
    const body = await cmsApiFetch(`/api/admin/pages/${slug}/sections/${p.id}`, { method: 'PUT', body: { content: p.content } });
    const saved = body && (body.section || body.data);
    API[pid][saved && saved.type || Object.keys(API[pid]).find((t) => API[pid][t].id === p.id)] = { id: p.id, content: (saved && saved.content) || p.content };
  }
  return { synced: true };
}

/** Toggle a synced section's visibility on the backend. */
export async function pageSyncVisibility(pid, title, visible) {
  const slug = PAGE_SLUGS[pid];
  const a = ADAPTERS[title];
  if (!slug || !a || !API[pid]) return { synced: false };
  const puts = a.push({}, API[pid]);
  if (!puts.length) return { synced: false };
  await cmsApiFetch(`/api/admin/pages/${slug}/sections/${puts[0].id}`, { method: 'PATCH', body: { is_visible: !!visible } });
  return { synced: true };
}

/** Publish the page's draft sections. */
export function pageSyncPublish(pid) {
  const slug = PAGE_SLUGS[pid];
  if (!slug) return Promise.resolve({ synced: false });
  return cmsApiFetch(`/api/admin/pages/${slug}/publish`, { method: 'POST' }).then(() => ({ synced: true }));
}
