import { useEffect, useRef, useState } from 'react';
import { S, UI, commit, persist, log, toast, go, comp, secState, secSchema, pageState } from '../store.js';
import { META, DEPTS } from '../data/content.js';
import { Icon, Pill, Mini, Stepper, Mark } from '../components/ui.jsx';
import { ago, clone, pick, readImg, RM } from '../lib/util.js';

const getP = (o, p) => p.reduce((a, k) => a?.[k], o);
const setP = (o, p, v) => { getP(o, p.slice(0, -1))[p[p.length - 1]] = v; };
const idOf = (p) => JSON.stringify(p);

function markDirty(s) { s.dirty = true; s.editedAt = Date.now(); persist(); commit(); }
const imgError = () => toast('That file isn’t an image we can read', { icon: 'x' });

// ---------------------------------------------------------------- page editor

export default function Editor({ pid }) {
  const p = S.pages[pid], st = pageState(pid), m = META[pid];
  const [publishing, setPublishing] = useState(false);
  const [stepKey, setStepKey] = useState(0);

  const publish = () => {
    setPublishing(true);
    // TODO(api): publish the page's sections. No CMS content endpoint exists yet.
    setTimeout(() => {
      p.sections.forEach((s) => { s.dirty = false; s.pub = clone(s.v); });
      p.review = false; p.publishedAt = Date.now();
      log('published', m.short || m.name, pid); persist(); setPublishing(false); setStepKey((k) => k + 1); commit();
      toast(`Published ${m.short || m.name}`, { icon: 'globe' });
    }, 700);
  };
  const review = () => { p.review = true; log('sent for review', m.short || m.name, pid); persist(); setStepKey((k) => k + 1); commit(); toast('Sent for review', { icon: 'send' }); };
  const withdraw = () => { p.review = false; persist(); commit(); toast('Review withdrawn', { icon: 'undo' }); };
  const pubBtn = <button className="btn btn-p" disabled={publishing} onClick={publish}>{publishing ? <><span className="spin" />Publishing</> : <><Icon n="globe" />Publish page</>}</button>;

  return (
    <>
      <div className="ed-h">
        <div><h1 className="h1"><span className="dot" style={{ '--c': DEPTS[m.dept], width: 10, height: 10 }} />{m.name}</h1><p className="lede">{p.sections.length} sections · last published {ago(p.publishedAt).toLowerCase()}</p></div>
        <div className="ed-acts">
          {st === 'published' ? <button className="btn btn-s" disabled><Icon n="check" />Published</button>
            : st === 'review' ? <><button className="btn btn-g" onClick={withdraw}>Withdraw</button>{pubBtn}</>
              : <><button className="btn btn-s" onClick={review}><Icon n="send" />Send for review</button>{pubBtn}</>}
        </div>
      </div>
      <div className="ed-steps" key={stepKey}><Stepper state={st} /></div>
      <div className="seg" role="group" aria-label="Editor view">
        <button aria-pressed={UI.tab === 'sections'} onClick={() => { UI.tab = 'sections'; commit(); }}>{UI.open != null ? 'Edit' : 'Sections'}</button>
        <button aria-pressed={UI.tab === 'preview'} onClick={() => { UI.tab = 'preview'; commit(); }}>Preview</button>
      </div>
      <div className="ed" data-tab={UI.tab}>
        <div className="pane list-pane">{UI.open == null ? <SectionList pid={pid} /> : <SectionForm key={UI.open} pid={pid} i={UI.open} />}</div>
        <div className="pane pv-pane"><div className="pv-wrap">
          <div className="pv-chrome"><i /><i /><i /><span className="url"><Icon n="lock" />otci.lagosstate.gov.ng{m.url}</span>
            <span className="pv-dev">
              <button aria-pressed={UI.dev === 'desk'} aria-label="Desktop preview" onClick={() => { UI.dev = 'desk'; commit(); }}><Icon n="desk" /></button>
              <button aria-pressed={UI.dev === 'mob'} aria-label="Mobile preview" onClick={() => { UI.dev = 'mob'; commit(); }}><Icon n="phone" /></button>
            </span>
          </div>
          <SitePreview pid={pid} />
        </div></div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------- section list

function SectionList({ pid }) {
  const P = S.pages[pid], ss = P.sections;
  const [drag, setDrag] = useState(null);
  const [over, setOver] = useState(null);
  const [flash, setFlash] = useState(null);
  const lastOpen = useRef(UI.lastClosed);

  useEffect(() => {
    if (lastOpen.current != null) { setFlash(lastOpen.current); document.querySelector(`[data-row="${lastOpen.current}"] .s-main`)?.focus({ preventScroll: true }); UI.lastClosed = null; }
  }, []);

  const move = (i, j) => {
    if (j < 0 || j >= ss.length || i === j) return;
    const [s] = ss.splice(i, 1); ss.splice(j, 0, s); markDirty(s); setFlash(j);
  };
  const toggle = (i) => {
    const s = ss[i]; s.visible = !s.visible; markDirty(s); log(s.visible ? 'showed' : 'hid', s.title, pid); commit();
    toast(`${s.title} ${s.visible ? 'will show' : 'is hidden'} once you publish`, { icon: s.visible ? 'eye' : 'eyeoff' });
  };
  const del = (i) => {
    const [s] = ss.splice(i, 1); persist(); log('deleted', s.title, pid); commit();
    toast(`Deleted ${s.title}`, { icon: 'trash', undo: () => { ss.splice(i, 0, s); persist(); log('restored', s.title, pid); commit(); } });
  };

  return (
    <>
      <div className="pane-h"><h2 className="h2">Sections</h2><span className="sub">Drag to reorder</span></div>
      <div className={UI.slideBack ? 'slide-back' : ''}>
        {ss.length ? ss.map((s, i) => {
          const c = comp(pid, s);
          return (
            <div key={s.uid} data-row={i} draggable={drag === i}
              className={`srow ${drag === i ? 'dragging' : ''} ${over === i && drag !== i ? 'drop' : ''} ${flash === i ? 'flash' : ''}`}
              onAnimationEnd={() => flash === i && setFlash(null)}
              onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(i)); }}
              onDragEnd={() => { setDrag(null); setOver(null); }}
              onDragOver={(e) => { if (!e.dataTransfer.types.includes('text/plain')) return; e.preventDefault(); setOver(i); }}
              onDrop={(e) => {
                e.preventDefault(); const from = +e.dataTransfer.getData('text/plain');
                setDrag(null); setOver(null);
                if (isNaN(from) || from === i) return;
                move(from, from < i ? i - 1 : i); toast('Section order updated');
              }}>
              <span className="grip" aria-hidden="true" onPointerDown={() => setDrag(i)}><Icon n="grip" /></span>
              <button className="s-main" onClick={() => { UI.open = i; UI.tab = 'sections'; commit(); }}>
                <b>{s.title}</b><span className="s-meta"><Pill k={secState(s)} /><Mini frac={c} /><span className="num">{Math.round(c * 100)}%</span></span>
              </button>
              <span className="s-acts">
                <button className="ib mv" aria-label="Move up" disabled={!i} style={i ? undefined : { visibility: 'hidden' }} onClick={() => move(i, i - 1)}><Icon n="up" /></button>
                <button className="ib mv" aria-label="Move down" disabled={i >= ss.length - 1} style={i < ss.length - 1 ? undefined : { visibility: 'hidden' }} onClick={() => move(i, i + 1)}><Icon n="down" /></button>
                <button className="sw-hit" role="switch" aria-checked={s.visible} aria-label={`Show ${s.title} on site`} onClick={() => toggle(i)}><span className="sw" /></button>
                <button className="ib danger" aria-label={`Delete ${s.title}`} onClick={() => del(i)}><Icon n="trash" /></button>
              </span>
            </div>
          );
        }) : <div className="empty"><b>No sections left</b>Undo a delete from the notification, or reset the demo.</div>}
      </div>
    </>
  );
}

// ---------------------------------------------------------------- section form

function SectionForm({ pid, i }) {
  const s = S.pages[pid].sections[i];
  const [saving, setSaving] = useState(false);
  const t = useRef();
  if (!s) return null;
  const schema = secSchema(pid, s), c = comp(pid, s);

  const change = () => {
    markDirty(s);
    setSaving(true); clearTimeout(t.current); t.current = setTimeout(() => setSaving(false), 500);
  };
  const close = () => { UI.lastClosed = i; UI.slideBack = true; UI.open = null; commit(); setTimeout(() => { UI.slideBack = false; }, 400); };
  const discard = () => { s.v = clone(s.pub); s.dirty = false; persist(); log('discarded', s.title, pid); commit(); toast('Changes discarded', { icon: 'undo' }); };

  return (
    <div className="slide-in">
      <div className="pane-h"><button className="ib" aria-label="Back to sections" onClick={close}><Icon n="back" /></button><h2 className="h2">{s.title}</h2><span><Pill k={secState(s)} extra={s.dirty ? 'pop' : ''} /></span></div>
      <div className="form">
        <div className="fld" style={{ display: 'flex', alignItems: 'center', gap: 12 }}><span className="sub" style={{ flex: 1 }}>Completeness</span><Mini frac={c} /><b className="num" style={{ fontWeight: 500, fontSize: 12.5, minWidth: 34, textAlign: 'right' }}>{Math.round(c * 100)}%</b></div>
        {schema.fields.map((f, k) => <Field key={k} f={f} vals={s.v} path={[]} s={s} onChange={change} />)}
      </div>
      <div className="form-foot">
        <span className={`saved ${saving ? 'ing' : ''}`}><i />{saving ? 'Saving draft' : s.dirty ? 'Draft saved' : 'Matches live site'}</span>
        <button className="btn btn-g" disabled={!s.dirty} onClick={discard}>Discard</button>
        <button className="btn btn-s" onClick={close}>Done</button>
      </div>
    </div>
  );
}

function Field({ f, vals, path, s, onChange, inItem }) {
  if (f.t === 'row') {
    return <div className="fld"><div className="row2">{f.f.map((x) => <div key={x.k}><label className="lbl" htmlFor={idOf([...path, x.k])}>{x.label}</label><Control f={x} vals={vals} path={path} s={s} onChange={onChange} /></div>)}</div></div>;
  }
  if (f.t === 'note') {
    return <div className="fld"><div className="note-c"><Icon n="layers" /><div><b>{f.label}</b><span>{f.text}</span></div>{f.go && <button className="btn btn-s" onClick={() => go(f.go)}>{f.cta || 'Open'}<Icon n="chev" /></button>}</div></div>;
  }
  if (f.t === 'diagram') return <div className="fld"><span className="lbl">Diagram</span><span className="hint">Shown in the preview. The first four wings fill north, east, south and west.</span></div>;
  if (f.t === 'list') return <ListField f={f} vals={vals} path={path} s={s} onChange={onChange} />;
  const empty = !String(vals[f.k] ?? '').trim() && f.t !== 'select';
  return (
    <div className="fld">
      <label className="lbl" htmlFor={idOf([...path, f.k])}>{f.label}{empty && !inItem && <span className="req">Empty</span>}</label>
      {f.hint && <span className="hint">{f.hint}</span>}
      <Control f={f} vals={vals} path={path} s={s} onChange={onChange} />
    </div>
  );
}

function ListField({ f, vals, path, s, onChange }) {
  const arr = vals[f.k] || [];
  const [fresh, setFresh] = useState(null);
  const flat = f.fields.flatMap((x) => (x.t === 'row' ? x.f : [x]));
  const first = flat.find((x) => x.t === 'text' || x.t === 'textarea');
  const add = () => {
    const o = {};
    flat.forEach((x) => { o[x.k] = x.t === 'select' ? x.opts?.[0] : x.t === 'color' ? '#008751' : x.k === 'font' ? 'Inter' : ''; });
    if (!vals[f.k]) vals[f.k] = [];
    vals[f.k].push(o); setFresh(vals[f.k].length - 1); onChange();
  };
  const rm = (j) => {
    const [it] = arr.splice(j, 1); onChange();
    toast('Item removed', { icon: 'trash', undo: () => { arr.splice(j, 0, it); persist(); commit(); } });
  };
  const mv = (j, d) => { const k = j + d; if (k < 0 || k >= arr.length) return; [arr[j], arr[k]] = [arr[k], arr[j]]; onChange(); };

  return (
    <div className="fld">
      <span className="lbl">{f.label}<span className="sub num">{arr.length}</span></span>
      {f.hint && <span className="hint">{f.hint}</span>}
      <div className="items">
        {arr.map((it, j) => {
          const nm = first ? it[first.k] : '';
          return (
            <div key={j} className={`item ${fresh === j ? 'new' : ''}`} ref={(el) => { if (el && fresh === j) { el.scrollIntoView({ block: 'nearest', behavior: RM ? 'auto' : 'smooth' }); el.querySelector('input,textarea')?.focus({ preventScroll: true }); setFresh(null); } }}>
              <div className="item-h">
                <span>{f.item} {j + 1}{nm ? <> · <em>{String(nm).slice(0, 40)}</em></> : null}</span>
                <button className="ib" aria-label="Move up" disabled={!j} onClick={() => mv(j, -1)}><Icon n="up" /></button>
                <button className="ib" aria-label="Move down" disabled={j >= arr.length - 1} onClick={() => mv(j, 1)}><Icon n="down" /></button>
                <button className="ib danger" aria-label={`Remove ${f.item} ${j + 1}`} onClick={() => rm(j)}><Icon n="trash" /></button>
              </div>
              <div className="item-b">{f.fields.map((x, k) => <Field key={k} f={x} vals={it} path={[...path, f.k, j]} s={s} onChange={onChange} inItem />)}</div>
            </div>
          );
        })}
      </div>
      <button className="add" onClick={add}><Icon n="plus" />{f.add}</button>
    </div>
  );
}

function Control({ f, vals, path, s, onChange }) {
  const id = idOf([...path, f.k]);
  const v = vals[f.k] ?? '';
  const blank = !String(v).trim() ? 'blank' : '';
  const set = (x) => { vals[f.k] = x; onChange(); };
  const [over, setOver] = useState(false);

  switch (f.t) {
    case 'textarea':
      return <textarea className={`inp ${blank}`} id={id} value={v} placeholder={f.ph || 'Add ' + f.label.toLowerCase()} onChange={(e) => set(e.target.value)} />;
    case 'select':
      return <select className="inp" id={id} value={v} onChange={(e) => set(e.target.value)}>{f.opts.map((o) => <option key={o}>{o}</option>)}</select>;
    case 'color':
      return (
        <div className="colr">
          <input type="color" value={/^#[0-9a-f]{6}$/i.test(v) ? v : '#008751'} aria-label="Pick colour" onChange={(e) => set(e.target.value)} />
          <input className="inp" id={id} value={v} placeholder="#008751" onChange={(e) => set(e.target.value)} />
        </div>
      );
    case 'image': {
      const browse = () => pick('image/*', false, (file) => readImg(file, (src) => set(src), imgError));
      return (
        <div className={`media ${f.shape === 'round' ? 'round' : ''} ${v ? 'has' : ''} ${over ? 'over' : ''}`}
          onDragOver={(e) => { if (!e.dataTransfer.types.includes('Files')) return; e.preventDefault(); setOver(true); }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => { e.preventDefault(); setOver(false); const file = e.dataTransfer.files[0]; if (file) readImg(file, (src) => set(src), imgError); }}>
          {v ? (
            <><img src={v} alt="" /><div className="ov"><button className="mbtn" onClick={browse}><Icon n="upload" />Replace</button><button className="mbtn r" onClick={() => set('')}>Remove</button></div></>
          ) : (
            <button className="up" onClick={browse}><Icon n="image" /><span>Drop an image or <u>browse</u></span><small>JPG, PNG or WebP</small></button>
          )}
        </div>
      );
    }
    case 'file': {
      const browse = () => pick('.pdf,.doc,.docx,application/pdf', false, (file) => set(file.name));
      return v ? (
        <div className="file has"><span className="fi">PDF</span><div><b>{v}</b><span>Attached</span></div>
          <span className="acts"><button className="ib" aria-label="Replace file" onClick={browse}><Icon n="upload" /></button><button className="ib danger" aria-label="Remove file" onClick={() => set('')}><Icon n="trash" /></button></span></div>
      ) : (
        <button className="file" onClick={browse}><Icon n="upload" /><div><b>Upload a PDF or document</b><span>20 MB max</span></div></button>
      );
    }
    default:
      return <input className={`inp ${blank}`} id={id} value={v} placeholder={f.ph || 'Add ' + f.label.toLowerCase()} onChange={(e) => set(e.target.value)} />;
  }
}

// ---------------------------------------------------------------- live site preview

const Ph = ({ w = '80%' }) => <span className="ph-line" style={{ width: w }} />;
function Txt({ v, w, tag: Tag = 'p' }) {
  if (!v) return <Ph w={w} />;
  const lines = String(v).split('\n');
  return <Tag>{lines.map((l, k) => <span key={k}>{k > 0 && <br />}{l}</span>)}</Tag>;
}
function firstArr(v) { for (const [k, x] of Object.entries(v)) if (Array.isArray(x) && k !== 'buttons' && k !== 'stats') return [k, x]; return null; }
function imgOf(o) { for (const k of ['img', 'bg']) if (o[k]) return o[k]; return ''; }
function Btns({ v }) {
  const b = v.buttons || [];
  const one = v.ctaText ? [{ label: v.ctaText, type: 'Primary' }] : v.cta ? [{ label: v.cta, type: 'Primary' }] : [];
  const all = [...b, ...one].filter((x) => x.label);
  return all.length ? <div className="btns">{all.map((x, k) => <span key={k} className={`sbtn ${x.type === 'Secondary' ? 'sec' : ''}`}>{x.label}</span>)}</div> : null;
}

function PvSection({ s, i, active }) {
  const v = s.v, head = v.headline ?? v.title ?? v.header, desc = v.subtext ?? v.desc ?? v.body;
  const ref = useRef(null);
  const first = useRef(true);
  const json = JSON.stringify(v);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (!active || RM || !ref.current) return;
    const el = ref.current; el.classList.remove('upd'); void el.offsetWidth; el.classList.add('upd');
  }, [json]); // eslint-disable-line react-hooks/exhaustive-deps

  const common = { ref, 'data-pv': i, 'data-name': s.title };
  const hidTag = s.visible ? null : <span className="hid-tag">Hidden</span>;
  const cls = `${s.visible ? '' : 'hid'} ${active ? 'act' : ''}`;

  if ('bg' in v && ('headline' in v || 'title' in v)) {
    return (
      <section {...common} className={`ps hero ${cls}`} style={v.bg ? { backgroundImage: `url('${v.bg}')` } : undefined}>
        {hidTag}<div className="ps-pad"><Txt v={head} w="70%" tag="h3" /><Txt v={desc} w="90%" /><Btns v={v} /></div>
      </section>
    );
  }
  let inner;
  if (v.stats) {
    inner = <div className="sstats">{v.stats.length ? v.stats.map((x, k) => <div key={k}><b>{(x.prefix || '') + (x.value || '–')}</b><span>{x.label || x.title || 'Label'}</span></div>) : <div><b>{'–'}</b><span>Add stats</span></div>}</div>;
  } else if (v.vTitle !== undefined) {
    inner = <div className="ps-pad"><div className="sgrid">{[['vTitle', 'vDesc'], ['mTitle', 'mDesc']].map(([a, b]) => <div key={a} className="sitem"><div className="tx"><b>{v[a] || 'Title'}</b><span>{v[b] || ''}</span></div></div>)}</div></div>;
  } else if (v.wings) {
    const w = (v.wings || []).map((x) => x.text).filter(Boolean).slice(0, 4);
    inner = (
      <div className="ps-pad"><Txt v={v.title} w="40%" tag="h3" />
        {w.length ? <div className="diagram">{w.map((t, k) => <div key={k} className={`wing w${k}`}>{t}</div>)}<div className="ctr"><Icon n="bulb" /><span>{v.center || 'C & I Functions'}</span></div></div>
          : <p style={{ marginTop: 10 }}>Add wing items to build the diagram.</p>}
      </div>
    );
  } else {
    const arr = firstArr(v);
    if (arr && arr[0] === 'docs') {
      inner = <div className="ps-pad"><Txt v={v.header || s.title} w="40%" tag="h3" />{arr[1].map((d, k) => <div key={k} className="doc"><span className="fi">PDF</span><b>{d.title || 'Untitled document'}</b><span>{d.file ? 'Download' : 'No file yet'}</span></div>)}</div>;
    } else if (arr) {
      const round = arr[1].some((x) => 'desc' in x && 'img' in x && Object.keys(x).length === 2);
      inner = (
        <div className="ps-pad"><Txt v={head || (arr[0] === 'features' ? '' : s.title)} w="40%" tag="h3" />{desc ? <Txt v={desc} /> : null}
          <div className="sgrid">
            {arr[1].length ? arr[1].map((it, k) => {
              const im = imgOf(it);
              const texts = Object.entries(it).filter(([kk, x]) => !['img', 'bg', 'file', 'link', 'ctaLink', 'url', 'date'].includes(kk) && typeof x === 'string').map(([, x]) => x);
              return (
                <div key={k} className="sitem">
                  {'img' in it && <div className={`im ${round ? 'rd' : ''}`} style={im ? { backgroundImage: `url('${im}')` } : undefined} />}
                  <div className="tx">{texts[0] ? <b>{texts[0]}</b> : <Ph w="70%" />}{texts[1] && <span>{texts[1]}</span>}{it.date && <span>{it.date}</span>}</div>
                </div>
              );
            }) : <div className="sitem"><div className="tx"><Ph w="60%" /><Ph w="90%" /></div></div>}
          </div>
          <Btns v={v} />
        </div>
      );
    } else {
      const im = imgOf(v);
      inner = (
        <div className="ps-pad">
          {im || 'img' in v ? (
            <div className="split">
              <div><Txt v={head} w="60%" tag="h3" /><Txt v={desc} w="95%" />{v.leader && <p style={{ marginTop: 10, color: '#14171C', fontWeight: 600 }}>{v.leader}</p>}<Btns v={v} /></div>
              <div className="im" style={im ? { backgroundImage: `url('${im}')` } : undefined} />
            </div>
          ) : <><Txt v={head} w="50%" tag="h3" /><Txt v={desc} w="90%" /><Btns v={v} /></>}
        </div>
      );
    }
  }
  return <section {...common} className={`ps ${cls}`}>{hidTag}{inner}</section>;
}

function SitePreview({ pid }) {
  const ref = useRef(null);
  useEffect(() => {
    if (UI.open == null || !ref.current) return;
    const el = ref.current.querySelector(`[data-pv="${UI.open}"]`);
    if (el) ref.current.scrollTo({ top: el.offsetTop - 44, behavior: RM ? 'auto' : 'smooth' });
  }, [UI.open, UI.tab]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div ref={ref} className={`site ${UI.dev === 'mob' ? 'mob' : ''}`}>
      <div className="site-nav"><Mark /><b>OTCI</b><span>About</span><span>Departments</span><span>Gallery</span><span>Contact</span></div>
      {S.pages[pid].sections.map((s, i) => <PvSection key={s.uid} s={s} i={i} active={UI.open === i} />)}
      <div className="site-foot">Office of Transformation, Creativity and Innovation, Lagos State</div>
    </div>
  );
}
