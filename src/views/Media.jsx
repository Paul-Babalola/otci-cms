import { useEffect, useRef, useState } from 'react';
import { S, UI, commit, persist, save, log, toast, go, totals } from '../store.js';
import { Icon, Pill, Count } from '../components/ui.jsx';
import { pick, readImg } from '../lib/util.js';
import { cmsApiFetch, mapFolder } from '../lib/cmsApi.js';

export async function newFolder() {
  try {
    const result = await cmsApiFetch('/api/admin/gallery', { method: 'POST', body: { title: '', description: '', is_visible: false } });
    const f = mapFolder(result?.folder || result);
    S.gallery.push(f); log('created', 'New folder', ''); persist();
    UI.folder = f.id; UI.focusTitle = true; commit();
  } catch (_) {
    const f = { id: 'f' + Date.now(), title: '', desc: '', visible: false, images: [] };
    S.gallery.push(f); log('created', 'New folder', ''); persist();
    UI.folder = f.id; UI.focusTitle = true; commit();
  }
}

export function Media() {
  const t = totals();
  const [publishing, setPublishing] = useState(false);
  useEffect(() => {
    const load = (path, opts) => cmsApiFetch(path, opts).then((data) => {
      const rows = Array.isArray(data) ? data : (data?.folders ?? data?.data ?? []);
      if (rows.length) { S.gallery = rows.map((f) => mapFolder(f)); commit(); }
    });
    load('/api/gallery', { auth: false, query: { page: 1 } }).catch(() =>
      load('/api/admin/gallery', {}).catch(() => {}));
  }, []);

  const publishGallery = async () => {
    setPublishing(true);
    try {
      await cmsApiFetch('/api/admin/gallery/publish', { method: 'POST' });
      S.gallery.forEach((f) => { f.hasChanges = false; });
      commit();
      toast('Gallery published successfully', { icon: 'globe' });
    } catch (e) {
      toast(e.message || 'Could not publish the gallery.', { icon: 'x' });
    } finally {
      setPublishing(false);
    }
  };

  const hasUnpublished = S.gallery.some((f) => f.hasChanges);

  return (
    <>
      <div className="h-row">
        <div><h1 className="h1">Media library</h1><p className="lede">Folders shown in the public gallery. The last uploaded image becomes a folder's cover.</p></div>
        <div style={{ display: 'flex', gap: 8 }}>
          {hasUnpublished && <button className="btn btn-g" onClick={publishGallery} disabled={publishing}>{publishing ? <><span className="spin" />Publishing…</> : <><Icon n="globe" />Publish gallery</>}</button>}
          <button className="btn btn-p" data-a="newfolder" onClick={newFolder}><Icon n="plus" />New folder</button>
        </div>
      </div>
      <div className="mstats">
        <div className="card"><b className="num"><Count to={t.folders} /></b><span className="sub">Folders</span></div>
        <div className="card"><b className="num"><Count to={t.imgs} /></b><span className="sub">Images</span></div>
        <div className="card"><b className="num"><Count to={t.visFolders} /></b><span className="sub">Visible folders</span></div>
      </div>
      <div className="fgrid">
        {S.gallery.map((f) => {
          const im = [...f.images].reverse().slice(0, 3);
          const hasCover = im.length || f.cover;
          return (
            <button key={f.id} className="fcard" onClick={() => { UI.anim = true; go('media', { folder: f.id }); }}>
              {hasCover ? <div className="mos">{[0, 1, 2].map((k) => <div key={k} style={(im[k]?.src || (k === 0 && f.cover)) ? { backgroundImage: `url('${im[k]?.src || f.cover}')` } : undefined} />)}</div> : <div className="mos none"><Icon n="image" /></div>}
              <div className="fb"><div><b>{f.title || 'Untitled folder'}</b><small className="num">{f.images.length} {f.images.length === 1 ? 'image' : 'images'}</small></div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  {f.hasChanges && <span className="pill" style={{ background: 'var(--warn)', color: '#fff', fontSize: 11, padding: '2px 7px' }}>Unpublished</span>}
                  <Pill k={f.visible ? 'visible' : 'hidden'} />
                </div>
              </div>
            </button>
          );
        })}
        <button className="fnew" onClick={newFolder}><Icon n="plus" />New folder</button>
      </div>
    </>
  );
}

export function Folder() {
  const f = S.gallery.find((x) => x.id === UI.folder);
  const [over, setOver] = useState(false);
  const [fresh, setFresh] = useState(null);
  const titleRef = useRef(null);
  const editTimer = useRef(null);
  useEffect(() => { if (UI.focusTitle) { UI.focusTitle = false; setTimeout(() => titleRef.current?.focus(), 50); } }, []);
  useEffect(() => {
    if (!f || !Number.isFinite(f.id)) return;
    const applyImgs = (data) => {
      const imgs = data?.images || [];
      if (!imgs.length) return;
      f.images = mapFolder(data?.folder || f, imgs).images;
      commit();
    };
    cmsApiFetch(`/api/gallery/${f.id}`, { auth: false })
      .then(applyImgs)
      .catch(() => cmsApiFetch(`/api/admin/gallery/${f.id}`).then(applyImgs).catch(() => {}));
  }, [f?.id]);
  if (!f) { UI.folder = null; return <Media />; }

  const add = (file) => {
    const fd = new FormData(); fd.append('image', file);
    cmsApiFetch(`/api/admin/gallery/${f.id}/images`, { method: 'POST', body: fd })
      .then((im) => {
        f.images.push({ id: im.id, name: im.original_name || im.name || file.name, src: im.url || im.src }); setFresh(f.images.length - 1);
        log('uploaded to', f.title || 'Untitled folder', ''); save();
        toast('Uploaded and set as cover', { icon: 'upload' });
      })
      .catch(() => {
        readImg(file, (src, name) => {
          f.images.push({ name, src }); setFresh(f.images.length - 1);
          log('uploaded to', f.title || 'Untitled folder', ''); save();
          toast('Uploaded and set as cover', { icon: 'upload' });
        }, () => toast("That file isn't an image we can read", { icon: 'x' }));
      });
  };

  const toggle = () => {
    f.visible = !f.visible;
    cmsApiFetch(`/api/admin/gallery/${f.id}/visibility`, { method: 'PATCH', body: { is_visible: f.visible } }).catch(() => {});
    log(f.visible ? 'showed' : 'hid', f.title || 'Untitled folder', ''); save();
    toast(f.visible ? 'Folder is visible in the gallery' : 'Folder hidden from the gallery', { icon: f.visible ? 'eye' : 'eyeoff' });
  };
  const del = () => {
    cmsApiFetch(`/api/admin/gallery/${f.id}`, { method: 'DELETE' }).catch(() => {});
    const k = S.gallery.indexOf(f); S.gallery.splice(k, 1); UI.folder = null; save();
    toast(`Deleted ${f.title || 'folder'}`, { icon: 'trash', undo: () => { S.gallery.splice(k, 0, f); save(); } });
  };
  const cover = (j) => { const [im] = f.images.splice(j, 1); f.images.push(im); save(); toast('Cover updated', { icon: 'star' }); };
  const rm = (j) => {
    const [im] = f.images.splice(j, 1);
    if (im?.id) cmsApiFetch(`/api/admin/gallery/${f.id}/images/${im.id}`, { method: 'DELETE' }).catch(() => {});
    save(); toast('Image removed', { icon: 'trash', undo: () => { f.images.splice(j, 0, im); persist(); commit(); } });
  };
  const edit = (k, v) => {
    f[k] = v; save();
    clearTimeout(editTimer.current);
    editTimer.current = setTimeout(() => {
      cmsApiFetch(`/api/admin/gallery/${f.id}`, { method: 'PUT', body: { title: f.title, description: f.desc, is_visible: f.visible } }).catch(() => {});
    }, 800);
  };
  const n = f.images.length;

  return (
    <>
      <div className="h-row">
        <div><h1 className="h1">{f.title || 'Untitled folder'}</h1><p className="lede num">{n} {n === 1 ? 'image' : 'images'} · {f.visible ? 'Shown in the public gallery' : 'Hidden from the public gallery'}</p></div>
        <div className="ed-acts">
          <button className="btn btn-d" onClick={del}><Icon n="trash" />Delete folder</button>
          <button className="btn btn-s" role="switch" aria-checked={f.visible} onClick={toggle}><span className="sw" />{f.visible ? 'Visible' : 'Hidden'}</button>
        </div>
      </div>
      <div className="card" style={{ padding: '4px 18px 18px', marginBottom: 12 }}><div className="row2">
        <div className="fld"><label className="lbl" htmlFor="ftitle">Folder title</label><input ref={titleRef} className="inp" id="ftitle" value={f.title} placeholder="For example, Ideas Day 2026" onChange={(e) => edit('title', e.target.value)} /></div>
        <div className="fld"><label className="lbl" htmlFor="fdesc">Description</label><input className="inp" id="fdesc" value={f.desc} placeholder="Shown under the folder title" onChange={(e) => edit('desc', e.target.value)} /></div>
      </div></div>
      <button className={`drop ${over ? 'over' : ''}`} onClick={() => pick('image/*', true, add)}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); [...e.dataTransfer.files].filter((x) => x.type.startsWith('image')).forEach(add); }}>
        <Icon n="upload" /><span><b>Drop images here</b> or browse. The newest image becomes the cover.</span>
      </button>
      {n ? (
        <div className="igrid">
          {f.images.map((im, j) => (
            <div key={j + im.name} className={`it ${fresh === j ? 'new' : ''}`}>
              <div className="th" style={im.src ? { backgroundImage: `url('${im.src}')` } : undefined} />
              {j === n - 1 && <span className="cv"><Pill k="live" label="Cover" /></span>}
              <div className="bar2"><span title={im.name}>{im.name}</span>
                {j !== n - 1 && <button className="ib" aria-label="Make cover" title="Make cover" onClick={() => cover(j)}><Icon n="star" /></button>}
                <button className="ib danger" aria-label={`Remove ${im.name}`} onClick={() => rm(j)}><Icon n="trash" /></button>
              </div>
            </div>
          ))}
        </div>
      ) : <div className="empty"><b>This folder is empty</b>Upload images to give it a cover and show it in the gallery.</div>}
    </>
  );
}
