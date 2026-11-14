// CMS API base client.
//
// Wraps fetch with:
// - Bearer token stored in localStorage['otci.cms_token'] (memory fallback)
// - { success, message, data } envelope unwrapping
// - Pagination normalisation via list()
// - Throws CmsApiError on any failure (including success:false bodies)
// - 401 clears the token and fires onCmsUnauthorized()

const env = import.meta.env || {};
export const CMS_BASE = String(env.VITE_API_BASE_URL || '').replace(/\/+$/, '');

// ---------------------------------------------------------------- token

let _memToken = null;

export function getCmsToken() {
  if (_memToken) return _memToken;
  try { _memToken = window.localStorage.getItem('otci.cms_token') || null; } catch (_) {}
  return _memToken;
}

export function setCmsToken(t) {
  _memToken = t || null;
  try {
    if (t) window.localStorage.setItem('otci.cms_token', t);
    else window.localStorage.removeItem('otci.cms_token');
  } catch (_) {}
}

export function clearCmsToken() { setCmsToken(null); }

// ---------------------------------------------------------------- unauthorized handler

let _unauthorizedCb = null;
export function onCmsUnauthorized(fn) { _unauthorizedCb = fn; }

// ---------------------------------------------------------------- error

export class CmsApiError extends Error {
  constructor(message, { status = 0, errors = null, body = null } = {}) {
    super(message);
    this.name = 'CmsApiError';
    this.status = status;
    this.errors = errors;
    this.body = body;
  }
  get isValidation()   { return this.status === 422; }
  get isUnauthorized() { return this.status === 401; }
  get isNotFound()     { return this.status === 404; }
  get isForbidden()    { return this.status === 403; }
  fieldError(name) {
    const e = this.errors?.[name];
    return Array.isArray(e) ? e[0] : (e || null);
  }
}

// ---------------------------------------------------------------- helpers

export const seg = (v) => encodeURIComponent(String(v));

export function toQuery(params) {
  if (!params) return '';
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue;
    if (Array.isArray(v)) v.forEach((x) => q.append(`${k}[]`, x));
    else q.append(k, String(v));
  }
  const s = q.toString();
  return s ? `?${s}` : '';
}

export function toFormData(fields) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) {
    if (v === undefined || v === null) continue;
    if (Array.isArray(v)) v.forEach((x) => fd.append(`${k}[]`, x));
    else if (typeof v === 'boolean') fd.append(k, v ? '1' : '0');
    else fd.append(k, v);
  }
  return fd;
}

function _defaultMsg(status) {
  if (status === 401) return 'Your session has expired. Please sign in again.';
  if (status === 403) return 'You do not have permission to do that.';
  if (status === 404) return 'The requested item was not found.';
  if (status === 422) return 'Please check the highlighted fields.';
  if (status >= 500) return 'The server encountered a problem. Please try again later.';
  return `Request failed (${status}).`;
}

function _toPage(body) {
  let items = body?.data;
  let meta = body?.pagination || body?.meta || null;
  // Handle nested { data: { data: [], meta: {} } } shapes
  if (items && !Array.isArray(items) && Array.isArray(items.data)) {
    const { data, meta: m, pagination: p } = items;
    meta = p || m || meta;
    items = data;
  }
  items = Array.isArray(items) ? items : [];
  return {
    items,
    page: {
      total:       meta?.total        ?? items.length,
      perPage:     meta?.per_page     ?? items.length,
      currentPage: meta?.current_page ?? 1,
      lastPage:    meta?.last_page    ?? 1,
      from:        meta?.from         ?? (items.length ? 1 : 0),
      to:          meta?.to           ?? items.length,
    },
    links: body?.links || null,
  };
}

// ---------------------------------------------------------------- fetch

/**
 * Core fetch wrapper. `opts.auth = false` skips token attachment entirely.
 * Default: auth = true (attach token if present, trigger unauthorizedCb on 401).
 */
export async function cmsApiFetch(path, opts = {}) {
  const { method = 'GET', body, signal, query, auth = true, as = 'json' } = opts;
  const headers = { Accept: as === 'blob' ? '*/*' : 'application/json' };

  let payload;
  if (body instanceof FormData) {
    payload = body; // browser sets the multipart boundary
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  let sentToken = false;
  if (auth !== false) {
    const t = getCmsToken();
    if (t) { headers.Authorization = `Bearer ${t}`; sentToken = true; }
  }

  let res;
  try {
    res = await fetch(CMS_BASE + path + toQuery(query), { method, headers, body: payload, signal });
  } catch (err) {
    if (err?.name === 'AbortError') throw err;
    throw new CmsApiError('Could not reach the server. Check your connection.', { status: 0 });
  }

  if (as === 'blob' && res.ok) {
    const cd = res.headers.get('Content-Disposition') || '';
    const m = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(cd);
    return { blob: await res.blob(), filename: m ? decodeURIComponent(m[1]) : null };
  }

  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch (_) {}

  if (!res.ok || (json && json.success === false)) {
    const err = new CmsApiError(json?.message || _defaultMsg(res.status), {
      status: res.ok ? 400 : res.status,
      errors: json?.errors || null,
      body: json ?? text,
    });
    // Only treat 401 as "session expired" when the request actually carried a
    // token — a tokenless 401 (demo mode) should not force a logout.
    if (err.status === 401 && sentToken) {
      clearCmsToken();
      _unauthorizedCb?.(err);
    }
    throw err;
  }
  return json ?? {};
}

/** Returns the envelope's `data` field. */
export async function call(path, opts) {
  const body = await cmsApiFetch(path, opts);
  return body && 'data' in body ? body.data : body;
}

/** Returns a normalised page for list endpoints. */
export async function list(path, opts) {
  return _toPage(await cmsApiFetch(path, opts));
}

// ---------------------------------------------------------------- media upload

/**
 * Upload a File to the CMS media store.
 * Returns the relative URL string (e.g. "storage/media/2026/11/file.jpg")
 * stored by the backend. Store it in section content fields as-is; the
 * mediaUrl() helper in pageSync / engine will prepend the host when needed.
 */
export async function uploadMedia(file) {
  const fd = new FormData();
  fd.append('file', file);
  const data = await cmsApiFetch('/api/admin/media', { method: 'POST', body: fd });
  const url = data?.url || data?.data?.url || data?.media?.url || data?.path || data?.data?.path;
  if (!url) throw new Error('Media upload succeeded but no URL was returned.');
  return url;
}

// ---------------------------------------------------------------- gallery helper (used by Media.jsx)

export function mapFolder(f, images) {
  const imgs = images || f.images || [];
  return {
    id: f.id,
    title: f.title || '',
    desc: f.description || f.desc || '',
    visible: !!(f.is_visible ?? f.visible),
    images: imgs.map((im) => ({
      id: im.id,
      name: im.original_name || im.name || im.filename || '',
      src: im.url || im.src || '',
    })),
  };
}
