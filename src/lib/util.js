// Small helpers shared across the CMS.

export const DAY = 864e5;
export const RM = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
export const SITE_URL = 'https://otci.lagosstate.gov.ng';

export const clone = (o) => JSON.parse(JSON.stringify(o));

export function ago(t) {
  const d = Date.now() - t, m = Math.round(d / 6e4);
  if (m < 1) return 'Just now';
  if (m < 60) return m + ' min ago';
  const h = Math.round(m / 60);
  if (h < 24) return h + (h === 1 ? ' hour ago' : ' hours ago');
  const dd = Math.round(h / 24);
  return dd === 1 ? 'Yesterday' : dd + ' days ago';
}

export function initials(s) {
  return (s || '?').split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((x) => x[0].toUpperCase()).join('');
}

/** Red → amber → yellow → green, for the content-health ticks. */
export function gradAt(t) {
  const stops = [[239, 68, 68], [245, 158, 11], [234, 179, 8], [34, 197, 94]];
  const x = t * (stops.length - 1), i = Math.min(Math.floor(x), stops.length - 2), f = x - i;
  const c = stops[i].map((v, k) => Math.round(v + (stops[i + 1][k] - v) * f));
  return `rgb(${c})`;
}

/** Opens the file picker. */
export function pick(accept, multi, cb) {
  const i = document.createElement('input');
  i.type = 'file';
  i.accept = accept;
  i.multiple = !!multi;
  i.onchange = () => [...i.files].forEach(cb);
  i.click();
}

/** Reads an image, resized to 1600px on the long side, as a JPEG data URL. */
export function readImg(file, cb, onError) {
  const r = new FileReader();
  r.onload = () => {
    const im = new Image();
    im.onload = () => {
      const k = Math.min(1, 1600 / Math.max(im.width, im.height));
      const c = document.createElement('canvas');
      c.width = im.width * k;
      c.height = im.height * k;
      c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
      try { cb(c.toDataURL('image/jpeg', 0.82), file.name); } catch (_) { cb(r.result, file.name); }
    };
    im.onerror = () => onError?.();
    im.src = r.result;
  };
  r.readAsDataURL(file);
}

/** Saves text as a file through the browser. */
export function download(text, filename, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch (_) { return false; }
}
