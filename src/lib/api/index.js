// CMS API — structured domain methods for all CMS admin endpoints.
//
//   import cmsApi from '../lib/api';
//   await cmsApi.auth.sendCode(email);
//   const { items } = await cmsApi.admin.users.list();
//   await cmsApi.auth.logout();
//
// Auth endpoints: auth = false (no token needed).
// Everything else: auth = true (default — sends otci.cms_token if present).

import {
  call, list, cmsApiFetch, seg, toFormData,
  setCmsToken, clearCmsToken, getCmsToken,
} from '../cmsApi.js';

const AUTH = '/api/auth';
const PUB  = '/api';
const ADM  = '/api/admin';

// ================================================================ auth

export const auth = {
  /** Code sign-in, step 1: request a 6-digit code sent to the given email. */
  sendCode: (email, opts) =>
    call(`${AUTH}/send-code`, { method: 'POST', body: { email }, auth: false, ...opts }),

  /** Code sign-in, step 2: exchange email + code for a session token. Stores the token automatically.
   *  Codes are single use; 5 wrong tries lock the code. */
  verifyCode: async (email, code, opts) => {
    const data = await call(`${AUTH}/verify-code`, {
      method: 'POST', body: { email, code }, auth: false, ...opts,
    });
    if (data?.token) setCmsToken(data.token);
    return data;
  },

  /** Password sign-in. Stores the token automatically. */
  login: async (email, password, opts) => {
    const data = await call(`${AUTH}/login`, {
      method: 'POST', body: { email, password }, auth: false, ...opts,
    });
    if (data?.token) setCmsToken(data.token);
    return data;
  },

  /** Sign out and clear the stored token. Always resolves (swallows network errors). */
  logout: async (opts) => {
    try { await cmsApiFetch(`${AUTH}/logout`, { method: 'POST', ...opts }); } finally { clearCmsToken(); }
  },

  me: (opts) => call(`${AUTH}/me`, opts),

  forgotPassword: (email, opts) =>
    call(`${AUTH}/forgot-password`, { method: 'POST', body: { email }, auth: false, ...opts }),

  resetPassword: (input, opts) =>
    call(`${AUTH}/reset-password`, { method: 'POST', body: input, auth: false, ...opts }),

  validateOnboardingToken: (token, opts) =>
    call(`${AUTH}/validate-onboarding-token`, { method: 'POST', body: { token }, auth: false, ...opts }),

  completeOnboarding: (input, opts) =>
    call(`${AUTH}/complete-onboarding`, { method: 'POST', body: input, auth: false, ...opts }),

  isSignedIn: () => !!getCmsToken(),
};

// ================================================================ public — pages

export const publicPages = {
  /** Fetch a page by its slug (e.g. 'home', 'bos', 'reforms', 'msd', 'non-technical'). */
  get: (slug, opts) => call(`${PUB}/pages/${seg(slug)}`, { auth: false, ...opts }),
};

// ================================================================ public — gallery

export const publicGallery = {
  list: (opts) => call(`${PUB}/gallery`, { auth: false, ...opts }),
  get: (id, opts) => call(`${PUB}/gallery/${seg(id)}`, { auth: false, ...opts }),
};

// ================================================================ public — feedback

export const publicFeedback = {
  /** `data` may be a plain object (JSON) or FormData (multipart with attachments). */
  submit: (data, opts) =>
    call(`${PUB}/feedback`, { method: 'POST', body: data, auth: false, ...opts }),
};

// ================================================================ public — newsletter

export const publicNewsletter = {
  subscribe: (email, opts) =>
    call(`${PUB}/newsletter/subscribe`, { method: 'POST', body: { email }, auth: false, ...opts }),
  unsubscribe: (token, opts) =>
    call(`${PUB}/newsletter/unsubscribe`, { query: { token }, auth: false, ...opts }),
};

// ================================================================ public — contact MCSD

export const publicContact = {
  submit: (data, opts) =>
    call(`${PUB}/contact`, { method: 'POST', body: data, auth: false, ...opts }),
};

// ================================================================ public — service charters

export const publicCharters = {
  list: (query, opts) => call(`${PUB}/charters`, { query, auth: false, ...opts }),
  get: (id, opts)     => call(`${PUB}/charters/${seg(id)}`, { auth: false, ...opts }),
  departments: (opts) => call(`${PUB}/departments`, { auth: false, ...opts }),
};

// ================================================================ admin — gallery

export const adminGallery = {
  list: (opts) =>
    call(`${ADM}/gallery`, opts),
  create: (data, opts) =>
    call(`${ADM}/gallery`, { method: 'POST', body: data, ...opts }),
  update: (id, data, opts) =>
    call(`${ADM}/gallery/${seg(id)}`, { method: 'PUT', body: data, ...opts }),
  remove: (id, opts) =>
    cmsApiFetch(`${ADM}/gallery/${seg(id)}`, { method: 'DELETE', ...opts }),
  toggleVisibility: (id, visible, opts) =>
    call(`${ADM}/gallery/${seg(id)}/visibility`, { method: 'PATCH', body: { is_visible: visible }, ...opts }),
  reorder: (folderIds, opts) =>
    call(`${ADM}/gallery/reorder`, { method: 'PUT', body: { folder_ids: folderIds }, ...opts }),
  publish: (opts) =>
    call(`${ADM}/gallery/publish`, { method: 'POST', ...opts }),
  uploadImage: (folderId, file, opts) =>
    call(`${ADM}/gallery/${seg(folderId)}/images`, {
      method: 'POST', body: toFormData({ image: file }), ...opts,
    }),
  deleteImage: (folderId, imageId, opts) =>
    cmsApiFetch(`${ADM}/gallery/${seg(folderId)}/images/${seg(imageId)}`, { method: 'DELETE', ...opts }),
};

// ================================================================ admin — pages

export const adminPages = {
  list: (query, opts) => list(`${ADM}/pages`, { query, ...opts }),
  get: (id, opts)     => call(`${ADM}/pages/${seg(id)}`, opts),
  publish: (id, opts) => call(`${ADM}/pages/${seg(id)}/publish`, { method: 'POST', ...opts }),
  sendForReview: (id, opts) =>
    call(`${ADM}/pages/${seg(id)}/review`, { method: 'POST', ...opts }),
  withdraw: (id, opts) =>
    call(`${ADM}/pages/${seg(id)}/withdraw`, { method: 'POST', ...opts }),

  sections: {
    list: (pageId, opts) =>
      call(`${ADM}/pages/${seg(pageId)}/sections`, opts),
    get: (pageId, sId, opts) =>
      call(`${ADM}/pages/${seg(pageId)}/sections/${seg(sId)}`, opts),
    update: (pageId, sId, data, opts) =>
      call(`${ADM}/pages/${seg(pageId)}/sections/${seg(sId)}`, { method: 'PUT', body: data, ...opts }),
    setVisibility: (pageId, sId, visible, opts) =>
      call(`${ADM}/pages/${seg(pageId)}/sections/${seg(sId)}/visibility`, { method: 'PATCH', body: { is_visible: visible }, ...opts }),
    reorder: (pageId, sectionIds, opts) =>
      call(`${ADM}/pages/${seg(pageId)}/sections/reorder`, { method: 'PUT', body: { section_ids: sectionIds }, ...opts }),
    discard: (pageId, sId, opts) =>
      call(`${ADM}/pages/${seg(pageId)}/sections/${seg(sId)}/discard`, { method: 'POST', ...opts }),
    schema: {
      get: (pageId, sId, opts) =>
        call(`${ADM}/pages/${seg(pageId)}/sections/${seg(sId)}/schema`, opts),
    },
  },
};

// ================================================================ admin — footer

export const adminFooter = {
  get: (opts) => call(`${ADM}/footer`, opts),
  update: (data, opts) => call(`${ADM}/footer`, { method: 'PUT', body: data, ...opts }),
  publish: (opts) => call(`${ADM}/footer/publish`, { method: 'POST', ...opts }),
};

// ================================================================ admin — users

export const adminUsers = {
  add: (input, opts) =>
    call(`${ADM}/users`, { method: 'POST', body: input, ...opts }),

  /** Returns { items, meta }. Body example: `{email, role: super_admin|department_admin, department_slug}`. */
  list: async (query, opts) => {
    const body = await cmsApiFetch(`${ADM}/users`, { query, ...opts });
    return { items: body?.users || body?.data || [], meta: body?.meta || null };
  },

  get: async (id, opts) => {
    const body = await cmsApiFetch(`${ADM}/users/${seg(id)}`, opts);
    return body?.user ?? body?.data ?? body;
  },

  update: (id, input, opts) =>
    call(`${ADM}/users/${seg(id)}`, { method: 'PUT', body: input, ...opts }),

  resendActivation: (id, opts) =>
    call(`${ADM}/users/${seg(id)}/resend-activation`, { method: 'POST', ...opts }),

  delete: (id, opts) =>
    cmsApiFetch(`${ADM}/users/${seg(id)}`, { method: 'DELETE', ...opts }),
};

// ================================================================ admin — feedback submissions

export const adminFeedback = {
  /** Response keys: `submissions` + `meta` (current_page, last_page, total, unread_count).
   *  Filters: page, mda, feedback_type, rating, unread=1, search. */
  list: async (query, opts) => {
    const body = await cmsApiFetch(`${ADM}/feedback`, { query, ...opts });
    return { items: body?.submissions || [], meta: body?.meta || null };
  },
  /** Opening a submission marks it as read on the server. */
  get: async (id, opts) => {
    const body = await cmsApiFetch(`${ADM}/feedback/${seg(id)}`, opts);
    return body?.submission ?? body?.data ?? body;
  },
};

// ================================================================ admin — contact MCSD requests

export const adminContact = {
  /** Response keys: `requests` + `meta`. Filters: page, unread=1, search. */
  list: async (query, opts) => {
    const body = await cmsApiFetch(`${ADM}/contact-requests`, { query, ...opts });
    return { items: body?.requests || [], meta: body?.meta || null };
  },
  get: async (id, opts) => {
    const body = await cmsApiFetch(`${ADM}/contact-requests/${seg(id)}`, opts);
    return body?.request ?? body?.data ?? body;
  },
};

// ================================================================ admin — newsletter subscribers

export const adminNewsletter = {
  /** Response keys: `subscribers` + `meta` (…, active_count). status: active | unsubscribed | all. */
  list: async (query, opts) => {
    const body = await cmsApiFetch(`${ADM}/newsletter`, { query, ...opts });
    return { items: body?.subscribers || [], meta: body?.meta || null };
  },
  /** Same endpoint with format=csv — returns { blob, filename }. */
  exportCsv: (query, opts) =>
    cmsApiFetch(`${ADM}/newsletter`, { query: { ...query, format: 'csv' }, as: 'blob', ...opts }),
};

// ================================================================ admin — service charters

export const adminCharters = {
  /** GET /api/admin/charters — response key is `charters`, not `data`. */
  list: async (query, opts) => {
    const body = await cmsApiFetch(`${ADM}/charters`, { query, ...opts });
    const items = Array.isArray(body?.charters) ? body.charters : [];
    return { items, meta: body?.meta || null };
  },
  get: (id, opts)          => call(`${ADM}/charters/${seg(id)}`, opts),
  create: (data, opts)     => call(`${ADM}/charters`, { method: 'POST', body: data, ...opts }),
  update: (id, data, opts) => call(`${ADM}/charters/${seg(id)}`, { method: 'PUT', body: data, ...opts }),
  remove: (id, opts)       => cmsApiFetch(`${ADM}/charters/${seg(id)}`, { method: 'DELETE', ...opts }),
  uploadSource: (id, file, opts) =>
    call(`${ADM}/charters/${seg(id)}/source`, {
      method: 'POST', body: toFormData({ file }), ...opts,
    }),
  deleteSource: (id, opts) =>
    cmsApiFetch(`${ADM}/charters/${seg(id)}/source`, { method: 'DELETE', ...opts }),
  publish: (id, opts) =>
    call(`${ADM}/charters/${seg(id)}/publish`, { method: 'POST', ...opts }),
  unpublish: (id, opts) =>
    call(`${ADM}/charters/${seg(id)}/unpublish`, { method: 'POST', ...opts }),
  comingSoon: (id, opts) =>
    call(`${ADM}/charters/${seg(id)}/coming-soon`, { method: 'POST', ...opts }),
  import: (data, opts) =>
    call(`${ADM}/charters/import`, { method: 'POST', body: data, ...opts }),
  exportAll: (query, opts) =>
    cmsApiFetch(`${ADM}/charters/export`, { query, as: 'blob', ...opts }),
  csvTemplate: (opts) =>
    cmsApiFetch(`${ADM}/charters/template`, { as: 'blob', ...opts }),
};

// ================================================================ admin — overview & activity

export const adminOverview = {
  /** GET /api/admin/dashboard — returns the `dashboard` sub-object. */
  get: async (opts) => {
    const body = await cmsApiFetch(`${ADM}/dashboard`, opts);
    return body?.dashboard ?? body;
  },
  /** GET /api/admin/activity — response key is `activity`, not `data`. */
  activity: async (query, opts) => {
    const body = await cmsApiFetch(`${ADM}/activity`, { query, ...opts });
    const items = Array.isArray(body?.activity) ? body.activity : [];
    return { items, meta: body?.meta || null };
  },
};

// ================================================================ default export

export default {
  auth,
  public: {
    pages:      publicPages,
    gallery:    publicGallery,
    feedback:   publicFeedback,
    newsletter: publicNewsletter,
    contact:    publicContact,
    charters:   publicCharters,
  },
  admin: {
    gallery:    adminGallery,
    pages:      adminPages,
    footer:     adminFooter,
    users:      adminUsers,
    feedback:   adminFeedback,
    contact:    adminContact,
    newsletter: adminNewsletter,
    charters:   adminCharters,
    overview:   adminOverview,
  },
};
