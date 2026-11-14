// Syncs the Studio's local page sections with the backend's page sections.
//
// The Studio's edit forms predate the backend's content schemas, so the two
// use different shapes and ids. ADAPTERS maps them per page, keyed by the
// local section schema title. Backend fields the Studio doesn't edit are
// preserved on save by spreading the previous content. Local-only sections
// (no backend counterpart) simply stay local.
//
// Save route: PUT /api/admin/pages/{slug}/sections/{id} { content }.

import { cmsApiFetch, CMS_BASE } from './cmsApi.js';

const PAGE_SLUGS = { home: 'home', about: 'about', bos: 'bos', ci: 'ci', reforms: 'reforms', msd: 'msd' };
const API = {}; // pid -> { type: { id, content, sort_order, is_visible } }

const isUrl = (u) => /^https?:\/\//i.test(u || '');
const mediaUrl = (u) => { u = String(u || '').trim(); return !u ? '' : isUrl(u) ? u : CMS_BASE + '/' + u.replace(/^\/+/, ''); };
const toISO = (d) => { const t = new Date(d); return isNaN(t) ? null : `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`; };
const fromISO = (d) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(d || '')); if (!m) return String(d || ''); return new Date(+m[1], +m[2] - 1, +m[3]).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }); };
const sect = (api, type) => api[type] || null;

// ---------------------------------------------------------------- shared adapter factories

/** Dept hero: headline, subtext, background image and CTA buttons all sync. */
const heroDept = () => ({
  _type: 'hero',
  pull(v, api) {
    const c = sect(api, 'hero') && api.hero.content; if (!c) return;
    if (c.headline) v.headline = c.headline;
    if (c.subtext) v.subtext = c.subtext;
    if (c.background_image) v.bg = mediaUrl(c.background_image);
    if (Array.isArray(c.cta_buttons) && c.cta_buttons.length) {
      v.buttons = c.cta_buttons.map((b) => ({ label: b.label || '', link: b.link || '', type: b.type === 'secondary' ? 'Secondary' : 'Primary' }));
    }
  },
  push(v, api) {
    const s = sect(api, 'hero'); if (!s) return [];
    const cta_buttons = (v.buttons || []).filter((b) => b.label).map((b) => ({ label: b.label, link: b.link || '', type: (b.type || 'Primary').toLowerCase() }));
    return [{ id: s.id, content: { ...s.content, headline: v.headline, subtext: v.subtext, ...(isUrl(v.bg) ? { background_image: v.bg } : {}), ...(cta_buttons.length ? { cta_buttons } : {}) } }];
  },
});

/** 'In numbers' ↔ metrics_bar. Stats sync; section-level title stored as passthrough. */
const metrics = () => ({
  _type: 'metrics_bar',
  pull(v, api) {
    const c = sect(api, 'metrics_bar') && api.metrics_bar.content;
    if (!c) return;
    if (c.title) v.title = c.title;
    if (Array.isArray(c.stats) && c.stats.length) v.stats = c.stats.map((s) => ({ value: s.value || '', label: s.title || s.label || '' }));
  },
  push(v, api) {
    const s = sect(api, 'metrics_bar'); if (!s) return [];
    const prev = Array.isArray(s.content && s.content.stats) ? s.content.stats : [];
    const stats = (v.stats || []).map((k, i) => ({ ...(prev[i] || {}), value: k.value, title: k.label, label: k.label }));
    return [{ id: s.id, content: { ...s.content, ...(v.title !== undefined ? { title: v.title } : {}), stats } }];
  },
});

/** 'At a glance' ↔ program_overview (statement=title, body=description, img=right_image, cta_button_label=buttons[0].label). */
const overview = () => ({
  _type: 'program_overview',
  pull(v, api) {
    const c = sect(api, 'program_overview') && api.program_overview.content; if (!c) return;
    if (c.title) v.statement = c.title;
    if (c.description) v.body = c.description;
    if (c.right_image) v.img = mediaUrl(c.right_image);
    if (c.cta_button_label) {
      if (Array.isArray(v.buttons) && v.buttons.length) v.buttons[0].label = c.cta_button_label;
      else v.buttons = [{ label: c.cta_button_label, link: '', type: 'Primary' }];
    }
  },
  push(v, api) {
    const s = sect(api, 'program_overview'); if (!s) return [];
    const ctaLabel = v.buttons && v.buttons[0] && v.buttons[0].label;
    return [{ id: s.id, content: { ...s.content, title: v.statement, ...(v.body ? { description: v.body } : {}), ...(isUrl(v.img) ? { right_image: v.img } : {}), ...(ctaLabel ? { cta_button_label: ctaLabel } : {}) } }];
  },
});

/** Card/item lists: local [{title,desc}] ↔ backend items under `type`.`listKey` with `descKey` text. Also syncs section title/eyebrow. */
const cardList = (type, listKey, descKey, localKey = 'cards') => ({
  _type: type,
  pull(v, api) {
    const c = sect(api, type) && api[type].content;
    if (!c) return;
    if (c.title) v.title = c.title;
    if (c.eyebrow) v.eyebrow = c.eyebrow;
    if (c.header) {
      if (c.header.title) v.title = c.header.title;
      if (c.header.description) v.desc = c.header.description;
    }
    const items = c[listKey];
    if (Array.isArray(items) && items.length) v[localKey] = items.map((it) => ({ title: it.title || '', desc: it[descKey] || '' }));
  },
  push(v, api) {
    const s = sect(api, type); if (!s) return [];
    const prev = Array.isArray(s.content && s.content[listKey]) ? s.content[listKey] : [];
    const items = (v[localKey] || []).map((k, i) => ({ ...(prev[i] || {}), title: k.title, [descKey]: k.desc }));
    const c = s.content || {};
    const extra = c.header !== undefined
      ? { header: { ...(c.header || {}), ...(v.title !== undefined ? { title: v.title } : {}), ...(v.desc !== undefined ? { description: v.desc } : {}) } }
      : { ...(v.title !== undefined ? { title: v.title } : {}), ...(v.eyebrow !== undefined ? { eyebrow: v.eyebrow } : {}) };
    return [{ id: s.id, content: { ...c, ...extra, [listKey]: items } }];
  },
});

/** 'Focus areas' ↔ focus_areas: title + items [{img,title}] ↔ backend [{image,description}]. */
const focusAreas = () => ({
  _type: 'focus_areas',
  pull(v, api) {
    const c = sect(api, 'focus_areas') && api.focus_areas.content;
    if (!c) return;
    if (c.title) v.title = c.title;
    if (Array.isArray(c.items) && c.items.length) v.items = c.items.map((it) => ({ img: mediaUrl(it.image), title: it.description || '' }));
  },
  push(v, api) {
    const s = sect(api, 'focus_areas'); if (!s) return [];
    const prev = Array.isArray(s.content && s.content.items) ? s.content.items : [];
    const items = (v.items || []).map((k, i) => ({ ...(prev[i] || {}), description: k.title, ...(isUrl(k.img) ? { image: k.img } : {}) }));
    return [{ id: s.id, content: { ...s.content, ...(v.title !== undefined ? { title: v.title } : {}), items } }];
  },
});

/** 'Closing band' ↔ final_cta (headline, subtext, cta_buttons). */
const band = () => ({
  _type: 'final_cta',
  pull(v, api) {
    const c = sect(api, 'final_cta') && api.final_cta.content; if (!c) return;
    if (c.headline) v.headline = c.headline;
    if (c.subtext) v.subtext = c.subtext;
    if (Array.isArray(c.cta_buttons) && c.cta_buttons.length) {
      v.buttons = c.cta_buttons.map((b) => ({ label: b.label || '', link: b.link || '', type: b.type === 'secondary' ? 'Secondary' : 'Primary' }));
    }
  },
  push(v, api) {
    const s = sect(api, 'final_cta'); if (!s) return [];
    const cta_buttons = (v.buttons || []).filter((b) => b.label).map((b) => ({ label: b.label, link: b.link || '', type: (b.type || 'Primary').toLowerCase() }));
    return [{ id: s.id, content: { ...s.content, headline: v.headline, subtext: v.subtext, ...(cta_buttons.length ? { cta_buttons } : {}) } }];
  },
});

/** 'Documents' ↔ a {title, description, <listKey>:[{title,description,file}]} section. */
const docList = (type, listKey) => ({
  _type: type,
  pull(v, api) {
    const c = sect(api, type) && api[type].content; if (!c) return;
    if (c.title) v.title = c.title;
    if (c.description) v.desc = c.description;
    if (Array.isArray(c[listKey]) && c[listKey].length) v.docs = c[listKey].map((d) => ({ title: d.title || '', desc: d.description || '', file: d.file ? mediaUrl(d.file) : '' }));
  },
  push(v, api) {
    const s = sect(api, type); if (!s) return [];
    const prev = Array.isArray(s.content && s.content[listKey]) ? s.content[listKey] : [];
    const items = (v.docs || []).map((k, i) => ({ ...(prev[i] || {}), title: k.title, description: k.desc, ...(isUrl(k.file) ? { file: k.file } : {}) }));
    return [{ id: s.id, content: { ...s.content, title: v.title, ...(v.desc !== undefined ? { description: v.desc } : {}), [listKey]: items } }];
  },
});

// ---------------------------------------------------------------- per-page adapters

const ADAPTERS = {
  home: {
    'Hero': {
      _type: 'hero',
      pull(v, api) {
        const c = sect(api, 'hero') && api.hero.content; if (!c) return;
        if (c.headline) v.headline = c.headline;
        if (c.subtext) v.subtext = c.subtext;
        if (Array.isArray(c.tiles) && c.tiles.length) v.tiles = c.tiles.map((t) => ({ dept: t.dept || 'OTCI', value: t.value || '', label: t.label || '' }));
      },
      push(v, api) {
        const s = sect(api, 'hero'); if (!s) return [];
        const prev = Array.isArray(s.content && s.content.tiles) ? s.content.tiles : [];
        const tiles = (v.tiles || []).map((t, i) => ({ ...(prev[i] || {}), dept: t.dept, value: t.value, label: t.label }));
        return [{ id: s.id, content: { ...s.content, headline: v.headline, subtext: v.subtext, tiles } }];
      },
    },
    'Impact numbers': metrics(),
    'What we do': {
      _type: 'what_we_do',
      pull(v, api) {
        const c = sect(api, 'what_we_do') && api.what_we_do.content; if (!c) return;
        if (c.header) {
          if (c.header.title) v.title = c.header.title;
          if (c.header.description) v.desc = c.header.description;
        }
        if (Array.isArray(c.departments) && c.departments.length) v.cards = c.departments.map((d) => ({ title: d.title || '', desc: d.description || '' }));
        if (Array.isArray(c.cta_buttons) && c.cta_buttons.length) {
          v.buttons = c.cta_buttons.map((b) => ({ label: b.label || '', link: b.link || '', type: b.type === 'secondary' ? 'Secondary' : 'Primary' }));
        }
      },
      push(v, api) {
        const s = sect(api, 'what_we_do'); if (!s) return [];
        const prev = Array.isArray(s.content && s.content.departments) ? s.content.departments : [];
        const departments = (v.cards || []).map((k, i) => ({ ...(prev[i] || {}), title: k.title, description: k.desc }));
        const cta_buttons = (v.buttons || []).filter((b) => b.label).map((b) => ({ label: b.label, link: b.link || '', type: (b.type || 'Primary').toLowerCase() }));
        return [{ id: s.id, content: { ...s.content, header: { ...(s.content && s.content.header || {}), title: v.title, description: v.desc }, departments, ...(cta_buttons.length ? { cta_buttons } : {}) } }];
      },
    },
    'Transformation highlights': {
      _type: 'transformation_highlights',
      pull(v, api) {
        const c = sect(api, 'transformation_highlights') && api.transformation_highlights.content; if (!c) return;
        if (c.header && c.header.title) v.title = c.header.title;
        if (c.header && c.header.description) v.desc = c.header.description;
        if (Array.isArray(c.highlights)) c.highlights.forEach((h, i) => {
          if (!v.items || !v.items[i]) return;
          if (h.title) v.items[i].title = h.title;
          if (h.image) v.items[i].img = mediaUrl(h.image);
        });
      },
      push(v, api) {
        const s = sect(api, 'transformation_highlights'); if (!s) return [];
        const prev = Array.isArray(s.content && s.content.highlights) ? s.content.highlights : [];
        const highlights = (v.items || []).map((it, i) => ({ ...(prev[i] || {}), title: it.title, ...(isUrl(it.img) ? { image: it.img } : {}) }));
        return [{ id: s.id, content: { ...s.content, header: { ...(s.content && s.content.header || {}), title: v.title, description: v.desc }, highlights } }];
      },
    },
    'Citizen voice band': {
      _type: 'citizen_engagement_cta',
      pull(v, api) {
        const c = sect(api, 'citizen_engagement_cta') && api.citizen_engagement_cta.content; if (!c) return;
        if (c.headline) v.headline = c.headline;
        if (c.subtext) v.subtext = c.subtext;
        if (c.cta_tag || c.cta_link) {
          if (!Array.isArray(v.buttons) || !v.buttons[0]) v.buttons = [{ label: '', link: '', type: 'Primary' }];
          if (c.cta_tag) v.buttons[0].label = c.cta_tag;
          if (c.cta_link) v.buttons[0].link = c.cta_link;
        }
        if (Array.isArray(c.cta_buttons) && c.cta_buttons.length) {
          v.buttons = c.cta_buttons.map((b) => ({ label: b.label || '', link: b.link || '', type: b.type === 'secondary' ? 'Secondary' : 'Primary' }));
        }
      },
      push(v, api) {
        const s = sect(api, 'citizen_engagement_cta'); if (!s) return [];
        const cta_buttons = (v.buttons || []).filter((b) => b.label).map((b) => ({ label: b.label, link: b.link || '', type: (b.type || 'Primary').toLowerCase() }));
        const label = v.buttons && v.buttons[0] && v.buttons[0].label;
        const link = v.buttons && v.buttons[0] && v.buttons[0].link;
        return [{ id: s.id, content: { ...s.content, headline: v.headline, subtext: v.subtext, ...(label ? { cta_tag: label } : {}), ...(link ? { cta_link: link } : {}), ...(cta_buttons.length ? { cta_buttons } : {}) } }];
      },
    },
    'News & updates': {
      _type: 'news_updates',
      pull(v, api) {
        const c = sect(api, 'news_updates') && api.news_updates.content; if (!c) return;
        if (c.header && c.header.title) v.title = c.header.title;
        if (c.header && c.header.description) v.desc = c.header.description;
        if (Array.isArray(c.items) && c.items.length) {
          v.articles = c.items.map((n, i) => ({
            ...(v.articles && v.articles[i] || { tag: 'Events', img: '' }),
            title: n.title || '', date: fromISO(n.date), body: n.description || '',
            ...(n.image ? { img: mediaUrl(n.image) } : {}),
          }));
        }
      },
      push(v, api) {
        const s = sect(api, 'news_updates'); if (!s) return [];
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
  },

  about: {
    'Who we are': {
      _type: 'hero',
      pull(v, api) {
        const c = sect(api, 'hero') && api.hero.content; if (!c) return;
        // API uses 'title' for the eyebrow label; fall back to 'eyebrow' if present.
        if (c.title) v.eyebrow = c.title;
        else if (c.eyebrow) v.eyebrow = c.eyebrow;
        if (c.description) v.statement = c.description;
        if (Array.isArray(c.features) && c.features.length) v.pillars = c.features.map((f) => ({ title: f.label || '', desc: f.subtext || '' }));
      },
      push(v, api) {
        const s = sect(api, 'hero'); if (!s) return [];
        const prev = Array.isArray(s.content && s.content.features) ? s.content.features : [];
        const features = (v.pillars || []).map((k, i) => ({ ...(prev[i] || {}), label: k.title, subtext: k.desc }));
        return [{ id: s.id, content: { ...s.content, ...(v.eyebrow !== undefined ? { title: v.eyebrow } : {}), description: v.statement, features } }];
      },
    },
    'Vision and mission': {
      _type: 'vision_mission',
      pull(v, api) {
        const c = sect(api, 'vision_mission') && api.vision_mission.content; if (!c) return;
        if (c.vision) { if (c.vision.title) v.vTitle = c.vision.title; if (c.vision.description) v.vDesc = c.vision.description; }
        if (c.mission) { if (c.mission.title) v.mTitle = c.mission.title; if (c.mission.description) v.mDesc = c.mission.description; }
      },
      push(v, api) {
        const s = sect(api, 'vision_mission'); if (!s) return [];
        const c = s.content || {};
        return [{ id: s.id, content: { ...c, vision: { ...(c.vision || {}), title: v.vTitle, description: v.vDesc }, mission: { ...(c.mission || {}), title: v.mTitle, description: v.mDesc } } }];
      },
    },
    'Leadership quote': {
      _type: 'leadership_organization',
      pull(v, api) {
        const c = sect(api, 'leadership_organization') && api.leadership_organization.content; if (!c) return;
        if (c.title) v.quote = c.title;
        if (c.body) v.body = c.body;
        if (c.leader_name) v.by = c.leader_name;
        if (c.leader_role) v.role = c.leader_role;
        if (c.image) v.img = mediaUrl(c.image);
      },
      push(v, api) {
        const s = sect(api, 'leadership_organization'); if (!s) return [];
        return [{ id: s.id, content: { ...s.content, title: v.quote, body: v.body, leader_name: v.by, ...(v.role !== undefined ? { leader_role: v.role } : {}), ...(isUrl(v.img) ? { image: v.img } : {}) } }];
      },
    },
  },

  bos: {
    'Hero': heroDept(),
    'In numbers': metrics(),
    'Documents': docList('guides_policy_documents', 'documents'),
    'Feedback form': {
      _type: 'feedback_form_config',
      pull(v, api) {
        const c = sect(api, 'feedback_form_config') && api.feedback_form_config.content; if (!c) return;
        if (c.title) v.title = c.title;
        if (c.description) v.desc = c.description;
      },
      push(v, api) {
        const s = sect(api, 'feedback_form_config'); if (!s) return [];
        return [{ id: s.id, content: { ...s.content, title: v.title, description: v.desc } }];
      },
    },
  },

  ci: {
    'Hero': heroDept(),
    'At a glance': overview(),
    'In numbers': metrics(),
    'Cards': cardList('innovation_in_numbers', 'items', 'description'),
    'Closing band': band(),
    'Images from Idea Day': {
      _type: 'image_gallery',
      pull(v, api) {
        const c = sect(api, 'image_gallery') && api.image_gallery.content; if (!c) return;
        if (c.title) v.title = c.title;
        if (c.subtitle) v.desc = c.subtitle;
        if (Array.isArray(c.images) && c.images.length) v.images = c.images.map((i) => ({ img: mediaUrl(i.image), caption: i.caption || '' }));
      },
      push(v, api) {
        const s = sect(api, 'image_gallery'); if (!s) return [];
        const prev = Array.isArray(s.content && s.content.images) ? s.content.images : [];
        const items = (v.images || []).filter((k) => isUrl(k.img)).map((k, i) => ({ ...(prev[i] || {}), image: k.img, caption: k.caption || null }));
        return [{ id: s.id, content: { ...s.content, title: v.title, subtitle: v.desc, ...(items.length ? { images: items } : {}) } }];
      },
    },
  },

  reforms: {
    'Hero': heroDept(),
    'At a glance': overview(),
    'Focus areas': focusAreas(),
    'Cards': cardList('build_stronger_institutions', 'items', 'content'),
    'Documents': docList('reform_reports', 'reports'),
    'Videos': {
      _type: 'press_briefings',
      pull(v, api) {
        const c = sect(api, 'press_briefings') && api.press_briefings.content; if (!c) return;
        if (c.title) v.title = c.title;
        if (c.description) v.desc = c.description;
      },
      push(v, api) {
        const s = sect(api, 'press_briefings'); if (!s) return [];
        const prev = Array.isArray(s.content && s.content.items) ? s.content.items : [];
        const items = (v.videos || []).map((k, i) => ({ ...(prev[i] || {}), title: k.title, link: k.url }));
        return [{ id: s.id, content: { ...s.content, title: v.title, description: v.desc, ...(items.length ? { items } : {}) } }];
      },
    },
  },

  msd: {
    'Hero': heroDept(),
    'At a glance': overview(),
    'Services': cardList('info_cards', 'cards', 'content'),
    'Focus areas': focusAreas(),
    'Cards': cardList('enabling_whole_otci', 'items', 'subtext'),
    'Closing band': band(),
  },
};

// ---------------------------------------------------------------- public API

/** True when this page has backend-synced sections. */
export const pageSynced = (pid) => !!(PAGE_SLUGS[pid] && ADAPTERS[pid]);

/** True when this local section maps to a backend section. */
export const sectionSynced = (pid, title) => !!(ADAPTERS[pid] && ADAPTERS[pid][title] && API[pid]);

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
  secs.forEach((s) => {
    if (s && s.type) map[s.type] = {
      id: s.id,
      content: s.content || {},
      sort_order: s.sort_order ?? null,
      is_visible: s.is_visible ?? null,
    };
  });
  API[pid] = map;
  return map;
}

/**
 * Overwrite local form values with the backend's current content.
 * Also seeds s.visible from is_visible and returns the number of sections hydrated.
 * Skips sections with unsaved local edits (dirty) so nothing is lost.
 */
export function pageSyncPull(pid, localSections, titleOf, clone) {
  const set = ADAPTERS[pid];
  if (!set || !API[pid]) return 0;
  let n = 0;
  localSections.forEach((s) => {
    const a = set[titleOf(s)];
    if (!a || s.dirty) return;
    a.pull(s.v, API[pid]);
    s.pub = clone(s.v);
    // Seed section visibility from the backend's is_visible flag.
    if (a._type && API[pid][a._type] && API[pid][a._type].is_visible !== null) {
      s.visible = API[pid][a._type].is_visible;
    }
    n++;
  });
  return n;
}

/**
 * Returns an array of sort_order values (or null) parallel to localSections,
 * based on each section's backend sort_order. Sections with no backend mapping
 * get null. Returns null if no sort_order data is available at all.
 */
export function pageSyncSortOrder(pid, localSections, titleOf) {
  const set = ADAPTERS[pid];
  if (!set || !API[pid]) return null;
  const orders = localSections.map((s) => {
    const a = set[titleOf(s)];
    if (!a || !a._type) return null;
    const meta = API[pid][a._type];
    return (meta && meta.sort_order != null) ? meta.sort_order : null;
  });
  return orders.some((o) => o !== null) ? orders : null;
}

/**
 * Save one local section to the backend. Resolves { synced: boolean }.
 * Throws on a server error so the caller can tell the editor the truth.
 */
export async function pageSyncSave(pid, title, v) {
  const slug = PAGE_SLUGS[pid];
  const a = ADAPTERS[pid] && ADAPTERS[pid][title];
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
  const a = ADAPTERS[pid] && ADAPTERS[pid][title];
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
