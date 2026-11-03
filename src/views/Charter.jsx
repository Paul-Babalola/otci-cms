import { useEffect, useRef, useState } from 'react';
import { S, UI, commit, persist, save, log, toast, go, chInit, openModal } from '../store.js';
import {
  ICONS, TK, TU, TNUM, CKD, CKEEP, NOTEXT, tHrs, tLab, cLab, slug, getPC, setPC, delPC, chClean,
  chIssues, chState, CHT, CSV_COLS, csvTemplate, parseRows, rowsToServices, sure,
} from '../lib/charterLogic.js';
import { Icon, Mic, ChPill } from '../components/ui.jsx';
import { clone, copyText, download, pick, RM } from '../lib/util.js';

const CTABS = [['details', 'Details'], ['services', 'Services'], ['fees', 'Fee tables'], ['mandates', 'Mandates'], ['promise', 'Service promise']];
const NEW_FEEDBACK = { qr: true, phone: '02018870607', handledBy: 'Service Delivery Liaison Officers respond daily' };
const scrollTo = (sel, block = 'start') => setTimeout(() => document.querySelector(sel)?.scrollIntoView({ block, behavior: RM ? 'auto' : 'smooth' }), 30);

// ---------------------------------------------------------------- state changes

let saveT;
/** Marks the charter as having unpublished changes and shows "Saving draft". */
function touch(c) {
  const first = !c._dirty;
  c._dirty = true; c._at = Date.now();
  if (first) log('edited', c.short || c.name || 'New charter', '');
  UI.ch.saving = true; clearTimeout(saveT);
  saveT = setTimeout(() => { UI.ch.saving = false; commit(); }, 450);
  save();
}

/** Writes a value at a path, with the same clean-up rules as the original. */
function setField(c, p, raw, o = {}) {
  let v = raw;
  if (o.num) v = v === '' ? undefined : parseFloat(v);
  else if (o.lines) v = v.split('\n').map((x) => x.trim()).filter(Boolean);
  if (o.opt && v === '') { delPC(c, p.slice(0, -1)); touch(c); return; }
  setPC(c, p, v);
  if (o.mirror) setPC(c, [...p.slice(0, -1), o.mirror], v);
  if (p[p.length - 1] === 'kind') {
    const obj = getPC(c, p.slice(0, -1)), isT = p.includes('turnaround') || p.includes('performance');
    if (isT) {
      const keep = TNUM[v] || [];
      ['min', 'max', 'unit'].forEach((n) => { if (n === 'unit' ? !keep.length : !keep.includes(n)) delete obj[n]; });
      if (v === 'exact' && obj.min == null && obj.max != null) obj.min = obj.max;
    } else {
      const keep = CKEEP[v] || [];
      ['amount', 'min', 'max', 'per', 'pct', 'of', 'renew', 'ref'].forEach((n) => { if (!keep.includes(n)) delete obj[n]; });
    }
  }
  if (p.length === 1 && p[0] === 'short' && c._fresh) c.id = slug(v);
  touch(c);
}

// ---------------------------------------------------------------- field controls

let fid = 0;
const useId = () => useRef('cf' + (++fid)).current;
const fmt = (v, o) => (o.lines ? (v || []).join('\n') : v ?? '');

/** Text, number or multi-line input bound to a charter path. Keeps its own
 *  text so partial input ("1.", a trailing newline) isn't lost on re-render. */
function CIn({ c, label, p, v, ...o }) {
  const id = useId();
  const [txt, setTxt] = useState(String(fmt(v, o)));
  const ext = String(fmt(v, o));
  useEffect(() => {
    const parsed = o.num ? (txt === '' ? '' : String(parseFloat(txt))) : o.lines ? txt.split('\n').map((x) => x.trim()).filter(Boolean).join('\n') : txt;
    if (parsed !== ext) setTxt(ext);
  }, [ext]); // eslint-disable-line react-hooks/exhaustive-deps
  const onChange = (e) => { setTxt(e.target.value); setField(c, p, e.target.value, o); };
  const common = { id, value: txt, onChange, placeholder: o.ph || '', list: o.list };
  return (
    <div className="fld">
      <label className="lbl" htmlFor={id}>{label}{o.req && <span className="req">Required</span>}</label>
      {o.hint && <span className="hint">{o.hint}</span>}
      {o.ta ? <textarea className="inp" rows={o.rows || 3} {...common} />
        : <input className={`inp ${String(txt).trim() ? '' : 'blank'}`} type={o.num ? 'number' : 'text'} {...(o.num ? { step: 'any', min: '0', inputMode: 'decimal' } : {})} {...common} />}
    </div>
  );
}

function CSel({ c, label, p, v, opts, opt }) {
  const id = useId();
  return (
    <div className="fld"><label className="lbl" htmlFor={id}>{label}</label>
      <select className="inp" id={id} value={String(v ?? '')} onChange={(e) => setField(c, p, e.target.value, { opt })}>
        {opts.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
      </select>
    </div>
  );
}

const G = ({ n, children }) => <div className={`ch-g${n}`}>{children}</div>;

function TimeFs({ c, title, p, t, opt, full }) {
  t = t || {}; const k = t.kind || '';
  const nums = TNUM[k] || [];
  const numLabel = (n) => (k === 'exact' ? 'Time' : k === 'case' ? 'Usually within' : n === 'min' ? (k === 'range' ? 'From' : 'At least') : (k === 'range' ? 'To' : 'Within'));
  return (
    <div className="ch-fs"><div className="ch-fs-h"><Icon n="hour" />{title}</div>
      <CSel c={c} label="How long it takes" p={[...p, 'kind']} v={k} opts={(opt ? [['', opt]] : []).concat(TK)} opt={!!opt} />
      {k && <>
        {nums.length > 0 && <G n={3}>
          {nums.map((n) => <CIn key={n} c={c} label={numLabel(n)} p={[...p, n]} v={t[n]} num mirror={k === 'exact' ? 'max' : ''} ph={k === 'case' ? 'Optional' : 'e.g. 3'} />)}
          <CSel c={c} label="Unit" p={[...p, 'unit']} v={t.unit || ''} opts={[['', 'Choose']].concat(TU)} />
        </G>}
        <CIn c={c} label="As published" p={[...p, 'text']} v={t.text} ph="Copy the wording from the SLA" req hint="Kept word for word under the service details" />
        {full && <G n={2}><CIn c={c} label="Clock starts at" p={[...p, 'start']} v={t.start} ph="e.g. complete documents received" /><CIn c={c} label="Acknowledgement" p={[...p, 'ack']} v={t.ack} ph="e.g. within 24 hours" /></G>}
        <CIn c={c} label="Note" p={[...p, 'note']} v={t.note} ph="Optional" />
        <p className="ch-out">Shows on the website as <b>{tLab(t)}</b></p>
      </>}
    </div>
  );
}

function CostFs({ c, title, p, cost, opt }) {
  cost = cost || {}; const k = cost.kind || '';
  const N = (l, n, x = {}) => <CIn key={n} c={c} label={l} p={[...p, n]} v={cost[n]} num ph="0" {...x} />;
  const T = (l, n, ph) => <CIn key={n} c={c} label={l} p={[...p, n]} v={cost[n]} ph={ph} />;
  const sc = c.schedules || [];
  return (
    <div className="ch-fs"><div className="ch-fs-h"><Icon n="star" />{title}</div>
      <CSel c={c} label="Fee type" p={[...p, 'kind']} v={k} opts={(opt ? [['', opt]] : []).concat(CKD)} opt={!!opt} />
      {k && <>
        {k === 'fixed' && <>
          <G n={2}>{N('Amount (₦)', 'amount')}{T('Per', 'per', 'Optional, e.g. metre')}</G>
          <G n={2}><CIn c={c} label="Renewal (₦)" p={[...p, 'renew', 'amount']} v={cost.renew?.amount} num ph="Optional" /><CSel c={c} label="Renewed every" p={[...p, 'renew', 'period']} v={cost.renew?.period || ''} opts={[['', '—'], ['year', 'Year'], ['month', 'Month']]} /></G>
        </>}
        {k === 'range' && <G n={3}>{N('Lowest (₦)', 'min')}{N('Highest (₦)', 'max')}{T('Per', 'per', 'Optional')}</G>}
        {k === 'rate' && <G n={2}>{N('Amount (₦)', 'amount')}{T('Per', 'per', 'e.g. metre, sqm')}</G>}
        {k === 'percent' && <G n={2}>{N('Percentage', 'pct', { ph: 'Optional, e.g. 5' })}{T('Of', 'of', 'e.g. contract value')}</G>}
        {(k === 'schedule' || k === 'tiered') && (sc.length ? <>
          <CSel c={c} label="Fee table" p={[...p, 'ref']} v={cost.ref || ''} opts={[['', 'Choose a fee table']].concat(sc.map((s) => [s.id, s.title || 'Untitled table']))} />
          <G n={2}>{N('Lowest (₦)', 'min', { ph: 'Optional' })}{N('Highest (₦)', 'max', { ph: 'Optional' })}</G>
        </> : <p className="ch-hint"><Icon n="layers" />Add the table under <button type="button" className="ch-lnk" onClick={() => { UI.ch.tab = 'fees'; commit(); }}>Fee tables</button> first, then link it here.</p>)}
        {k === 'statutory' && N('From (₦)', 'min', { ph: 'Optional' })}
        {k === 'market' && <G n={2}>{N('Indicative price (₦)', 'amount', { ph: 'Optional' })}{T('Per', 'per', 'e.g. bag')}</G>}
        <CIn c={c} label="As published" p={[...p, 'text']} v={cost.text} ph={NOTEXT.includes(k) ? 'Optional, e.g. Nil' : 'Copy the wording from the SLA'} req={!NOTEXT.includes(k)} />
        <CIn c={c} label="Note" p={[...p, 'note']} v={cost.note} ph="Optional" />
        <p className="ch-out">Shows on the website as <b>{cLab(cost)}</b></p>
      </>}
    </div>
  );
}

// ---------------------------------------------------------------- list operations

const openSet = () => UI.ch.open;
const prefixOf = (P) => (P.join() === 'services' ? 's' : P.join() === 'schedules' ? 't' : null);

function addItem(c, P, type) {
  const arr = getPC(c, P) || (setPC(c, P, []), getPC(c, P));
  arr.push(CHT[type](c));
  const key = type === 'service' ? 's' : type === 'schedule' ? 't' : null;
  if (key) openSet().add(key + (arr.length - 1));
  touch(c);
  if (key) setTimeout(() => { const el = document.querySelector(`[data-ok="${key}${arr.length - 1}"]`); el?.scrollIntoView({ block: 'center', behavior: RM ? 'auto' : 'smooth' }); el?.querySelector('input')?.focus({ preventScroll: true }); }, 40);
}
function removeItem(c, P, i) {
  const arr = getPC(c, P), [it] = arr.splice(i, 1), pre = prefixOf(P);
  if (pre) UI.ch.open = new Set([...openSet()].filter((x) => !x.startsWith(pre)));
  touch(c);
  toast('Removed', { icon: 'trash', undo: () => { arr.splice(i, 0, it); touch(c); } });
}
function moveItem(c, P, i, d) {
  const arr = getPC(c, P), k = i + d;
  if (k < 0 || k >= arr.length) return;
  [arr[i], arr[k]] = [arr[k], arr[i]];
  const pre = prefixOf(P);
  if (pre) { openSet().delete(pre + i); openSet().add(pre + k); }
  touch(c);
}

function ItemBtns({ c, P, i, n, what }) {
  return (
    <div className="ch-acts">
      <button type="button" className="ib" disabled={!i} aria-label={`Move ${what} up`} onClick={() => moveItem(c, P, i, -1)}><Icon n="up" /></button>
      <button type="button" className="ib" disabled={i >= n - 1} aria-label={`Move ${what} down`} onClick={() => moveItem(c, P, i, 1)}><Icon n="down" /></button>
      {what === 'service' && <button type="button" className="ib" aria-label="Duplicate service" title="Duplicate" onClick={() => {
        const cp = clone(c.services[i]); cp.name = (cp.name || '') + ' (copy)'; c.services.splice(i + 1, 0, cp);
        UI.ch.open = new Set([...openSet()].filter((x) => !x.startsWith('s'))); openSet().add('s' + (i + 1));
        touch(c); toast('Service duplicated', { icon: 'layers' });
      }}><Icon n="layers" /></button>}
      <button type="button" className="ib danger" aria-label={`Remove ${what}`} onClick={() => removeItem(c, P, i)}><Icon n="trash" /></button>
    </div>
  );
}

/** Collapsible card whose open state survives re-renders. */
function Card({ k, no, summary, children }) {
  return (
    <details className="ch-card" data-ok={k} open={openSet().has(k)} onToggle={(e) => { if (e.currentTarget.open) openSet().add(k); else openSet().delete(k); }}>
      <summary><span className="ch-no num">{no}</span><span className="ch-st">{summary}</span><Icon n="chev" className="ch-cv" /></summary>
      <div className="ch-cb">{children}</div>
    </details>
  );
}

// ---------------------------------------------------------------- tabs

function TabDetails({ c }) {
  const secs = [...new Set(S.charters.map((x) => x.sector).filter(Boolean))].sort();
  return (
    <>
      <section className="ch-sec"><h3>The MDA</h3><p className="sub">How the MDA appears in the charter list on the website.</p>
        <CIn c={c} label="MDA name" p={['name']} v={c.name} req ph="e.g. Lagos State Internal Revenue Service" />
        <G n={2}><CIn c={c} label="Short name" p={['short']} v={c.short} req ph="e.g. LIRS" /><CIn c={c} label="Sector" p={['sector']} v={c.sector} req list="chSecs" ph="e.g. Revenue & finance" /></G>
        <datalist id="chSecs">{secs.map((s) => <option key={s} value={s} />)}</datalist>
        <div className="fld"><span className="lbl">Icon</span>
          <div className="ch-ip" role="radiogroup" aria-label="Icon">
            {ICONS.map(([k, l]) => <label key={k}><input type="radio" name="chicon" value={k} checked={c.icon === k} onChange={() => setField(c, ['icon'], k)} /><Mic k={k} size={20} /><span>{l}</span></label>)}
          </div>
        </div>
        <CIn c={c} label="Introduction" p={['intro']} v={c.intro} ta ph="Optional. One or two sentences on what the MDA does." />
      </section>
      <section className="ch-sec"><h3>Source</h3><p className="sub">The signed SLA this charter comes from.</p>
        <div className="fld"><span className="lbl">Signed SLA (PDF)</span><span className="hint">Shown on the website as a download under the charter.</span>
          {c.source ? (
            <div className="file has"><span className="fi">PDF</span><div><b>{c.source}</b><span>{c.sourceSize ? (c.sourceSize / 1048576).toFixed(1) + ' MB · ' : ''}Attached</span></div>
              <span className="acts"><button type="button" className="ib" aria-label="Replace PDF" onClick={() => chSource(c)}><Icon n="upload" /></button><button type="button" className="ib danger" aria-label="Remove PDF" onClick={() => { c.source = ''; delete c.sourceSize; touch(c); }}><Icon n="trash" /></button></span></div>
          ) : <button type="button" className="file" onClick={() => chSource(c)}><Icon n="upload" /><div><b>Attach the signed SLA</b><span>PDF, 20 MB max</span></div></button>}
        </div>
        <CIn c={c} label="Web ID" p={['id']} v={c.id} ph="e.g. lirs" hint="Lower case, no spaces. Set once." />
        <G n={2}><CIn c={c} label="Reviewed" p={['review']} v={c.review} ph="e.g. Annually" /><CIn c={c} label="Escalate disputes to" p={['escalation']} v={c.escalation} ph="e.g. Chairman" /></G>
      </section>
    </>
  );
}

function SvcSummary({ s, c, i }) {
  const is = chIssues(c).filter((x) => x.key === 's' + i).length;
  return (
    <><b>{s.name || 'Untitled service'}</b><span>
      <span className="ch-chip"><Icon n="hour" />{tLab(s.turnaround)}</span><span className="ch-chip">{cLab(s.cost)}</span>
      {(s.variants || []).length > 0 && <span className="ch-chip">{s.variants.length} option{s.variants.length === 1 ? '' : 's'}</span>}
      {is > 0 && <span className="ch-chip w">{is} to fix</span>}
    </span></>
  );
}

function TabServices({ c }) {
  const ss = c.services || [];
  return (
    <>
      <div className="note-c"><Icon n="upload" /><div><b>Fill from a spreadsheet</b><span>Faster for long SLAs. Paste or upload one row per service and the CMS reads each time and fee for you.</span></div><button type="button" className="btn btn-s" onClick={() => chFill(c)}>Upload or paste<Icon n="chev" /></button></div>
      <p className="ch-lede" style={{ marginTop: 14 }}>Or edit one card per service. Pick a type for time and fee, then copy the wording exactly as published. The website works out the rest.</p>
      {ss.map((s, i) => {
        const p = ['services', i];
        return (
          <Card key={i} k={'s' + i} no={i + 1} summary={<SvcSummary s={s} c={c} i={i} />}>
            <CIn c={c} label="Service name" p={[...p, 'name']} v={s.name} req ph="e.g. Tax clearance certificate" />
            <G n={2}><CIn c={c} label="Unit or office" p={[...p, 'unit']} v={s.unit} ph="Optional" /><CIn c={c} label="Group" p={[...p, 'group']} v={s.group} ph="Optional, groups related services" /></G>
            <CIn c={c} label="Description" p={[...p, 'desc']} v={s.desc} ta rows={2} ph="Optional" />
            <CIn c={c} label="Conditions" p={[...p, 'conditions']} v={s.conditions} ta rows={2} lines ph="One per line, e.g. No outstanding tax liability" hint="What the applicant must have in place" />
            <TimeFs c={c} title="Time to deliver" p={[...p, 'turnaround']} t={s.turnaround} full />
            <CostFs c={c} title="Fee" p={[...p, 'cost']} cost={s.cost} />
            <div className="ch-fs"><div className="ch-fs-h"><Icon n="layers" />Options<span className="sub">For fees or times that vary, e.g. by plot size or vehicle type</span></div>
              <div className="items">
                {(s.variants || []).map((v, j) => {
                  const vp = [...p, 'variants', j];
                  return (
                    <div key={j} className="item">
                      <div className="item-h"><span>Option {j + 1}{v.label ? <> · <em>{v.label}</em></> : null}</span><button type="button" className="ib danger" aria-label="Remove option" onClick={() => removeItem(c, [...p, 'variants'], j)}><Icon n="trash" /></button></div>
                      <div className="item-b">
                        <CIn c={c} label="Label" p={[...vp, 'label']} v={v.label} ph="e.g. Plots up to 1,000 sqm" />
                        <CostFs c={c} title="Fee" p={[...vp, 'cost']} cost={v.cost} opt="Same as service" />
                        <TimeFs c={c} title="Time" p={[...vp, 'turnaround']} t={v.turnaround} opt="Same as service" />
                      </div>
                    </div>
                  );
                })}
              </div>
              <button type="button" className="add" onClick={() => addItem(c, [...p, 'variants'], 'variant')}><Icon n="plus" />Add option</button>
            </div>
            <ItemBtns c={c} P={['services']} i={i} n={ss.length} what="service" />
          </Card>
        );
      })}
      <button type="button" className="add ch-add" onClick={() => addItem(c, ['services'], 'service')}><Icon n="plus" />Add service</button>
    </>
  );
}

function GridEditor({ c, sc, i }) {
  const p = ['schedules', i], cols = sc.cols || [], rows = sc.rows || [];
  const onPaste = (e, r0, c0) => {
    const txt = e.clipboardData.getData('text');
    if (!/[\t\n]/.test(txt.trim())) return;
    e.preventDefault();
    const lines = txt.replace(/\r/g, '').replace(/\n+$/, '').split('\n').map((l) => l.split('\t'));
    lines.forEach((cells, li) => {
      const r = r0 + li;
      cells.forEach((v, ci) => {
        const j = c0 + ci;
        while (sc.cols.length <= j) { sc.cols.push(''); sc.rows.forEach((x) => x.push('')); }
        if (r < 0) sc.cols[j] = v.trim();
        else { while (sc.rows.length <= r) sc.rows.push(sc.cols.map(() => '')); sc.rows[r][j] = v.trim(); }
      });
    });
    touch(c); toast(`Pasted ${lines.length} row${lines.length === 1 ? '' : 's'}`, { icon: 'layers' });
  };
  const cell = (path, val, r, j, label) => <input value={val ?? ''} placeholder={r < 0 ? `Column ${j + 1}` : undefined} aria-label={label} data-cell={`${i},${r},${j}`} onChange={(e) => setField(c, path, e.target.value)} onPaste={(e) => onPaste(e, r, j)} />;
  return (
    <>
      <div className="ch-gw"><table className="ch-gt">
        <thead><tr>
          {cols.map((h, j) => <th key={j}><div className="ch-gc">{cell([...p, 'cols', j], h, -1, j, `Column ${j + 1} heading`)}{cols.length > 1 && <button type="button" className="ch-gb" aria-label={`Remove column ${j + 1}`} onClick={() => { sc.cols.splice(j, 1); sc.rows.forEach((r) => r.splice(j, 1)); touch(c); }}><Icon n="x" /></button>}</div></th>)}
          <th className="ch-gx"><button type="button" className="ch-gb" aria-label="Add column" title="Add column" onClick={() => { sc.cols.push(''); sc.rows.forEach((r) => r.push('')); touch(c); }}><Icon n="plus" /></button></th>
        </tr></thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri}>
              {cols.map((_, j) => <td key={j}>{cell([...p, 'rows', ri, j], r[j], ri, j, `Row ${ri + 1}, ${cols[j] || 'column ' + (j + 1)}`)}</td>)}
              <td className="ch-gx"><button type="button" className="ch-gb" aria-label={`Remove row ${ri + 1}`} onClick={() => { const [row] = sc.rows.splice(ri, 1); touch(c); toast('Row removed', { icon: 'trash', undo: () => { sc.rows.splice(ri, 0, row); touch(c); } }); }}><Icon n="x" /></button></td>
            </tr>
          ))}
        </tbody>
      </table></div>
      <button type="button" className="add" onClick={() => { sc.rows.push(sc.cols.map(() => '')); touch(c); setTimeout(() => document.querySelector(`[data-cell="${i},${sc.rows.length - 1},0"]`)?.focus(), 30); }}><Icon n="plus" />Add row</button>
    </>
  );
}

function TabFees({ c }) {
  const sc = c.schedules || [];
  return (
    <>
      <p className="ch-lede">Rate cards and fee schedules, kept as tables. Paste straight from a spreadsheet into any cell to fill several rows at once. Link a service to a table with the fee type “See a fee table”.</p>
      {sc.map((t, i) => {
        const uses = (c.services || []).filter((s) => s.cost?.ref === t.id).length;
        return (
          <Card key={i} k={'t' + i} no={i + 1} summary={<><b>{t.title || 'Untitled table'}</b><span><span className="ch-chip">{(t.rows || []).length} rows</span><span className="ch-chip">{(t.cols || []).length} columns</span>{uses > 0 && <span className="ch-chip">Linked to {uses} service{uses === 1 ? '' : 's'}</span>}</span></>}>
            <CIn c={c} label="Title" p={['schedules', i, 'title']} v={t.title} req ph="e.g. Land information fee" />
            <CIn c={c} label="Note" p={['schedules', i, 'note']} v={t.note} ph="Optional, e.g. how to read the cells" />
            <div className="fld"><span className="lbl">Table</span><GridEditor c={c} sc={t} i={i} /></div>
            <ItemBtns c={c} P={['schedules']} i={i} n={sc.length} what="fee table" />
          </Card>
        );
      })}
      <button type="button" className="add ch-add" onClick={() => addItem(c, ['schedules'], 'schedule')}><Icon n="plus" />Add fee table</button>
    </>
  );
}

function TabMandates({ c }) {
  const md = c.mandates || [];
  return (
    <>
      <p className="ch-lede">For MDAs whose SLA lists responsibilities rather than services. Each line shows as a numbered point.</p>
      <section className="ch-sec">
        <div className="items" style={{ paddingTop: 12 }}>
          {md.map((m, i) => (
            <div key={i} className="item">
              <div className="item-h"><span>Mandate {i + 1}</span>
                <button type="button" className="ib" disabled={!i} aria-label="Move up" onClick={() => moveItem(c, ['mandates'], i, -1)}><Icon n="up" /></button>
                <button type="button" className="ib" disabled={i >= md.length - 1} aria-label="Move down" onClick={() => moveItem(c, ['mandates'], i, 1)}><Icon n="down" /></button>
                <button type="button" className="ib danger" aria-label="Remove mandate" onClick={() => removeItem(c, ['mandates'], i)}><Icon n="trash" /></button>
              </div>
              <div className="item-b"><div className="fld"><textarea className="inp" rows={2} aria-label={`Mandate ${i + 1}`} placeholder="e.g. Keep the State’s revenue laws under review" value={m} onChange={(e) => setField(c, ['mandates', i], e.target.value)} /></div></div>
            </div>
          ))}
        </div>
        <button type="button" className="add" onClick={() => addItem(c, ['mandates'], 'mandate')}><Icon n="plus" />Add mandate</button>
      </section>
    </>
  );
}

function TabPromise({ c }) {
  const a = c.availability || {}, pf = c.performance || {}, fb = c.feedback || {};
  return (
    <>
      <section className="ch-sec"><h3>Availability</h3><p className="sub">When and how people can reach the service.</p>
        <CIn c={c} label="Opening hours" p={['availability', 'hours']} v={a.hours} ph="e.g. 8:00am – 5:00pm, Monday to Friday (excluding public holidays)" />
        <G n={2}><CIn c={c} label="Emergency service" p={['availability', 'emergency']} v={a.emergency} ph="Optional" /><CIn c={c} label="Online" p={['availability', 'online']} v={a.online} ph="Optional, e.g. 24/7 portal" /></G>
        <CIn c={c} label="Maintenance notice" p={['availability', 'maintenance']} v={a.maintenance} ph="Optional" />
        <CIn c={c} label="Other notes" p={['availability', 'notes']} v={a.notes} ph="Optional" />
      </section>
      <section className="ch-sec"><h3>Response and resolution</h3><p className="sub">The commitments for handling enquiries and reported issues.</p>
        <TimeFs c={c} title="Responds to enquiries" p={['performance', 'response']} t={pf.response} opt="Not stated" />
        <TimeFs c={c} title="Resolves reported issues" p={['performance', 'resolution']} t={pf.resolution} opt="Not stated" />
      </section>
      <section className="ch-sec"><h3>Feedback</h3><p className="sub">Shown at the end of every charter.</p>
        <div className="fld"><label className="ch-tg"><input type="checkbox" checked={!!fb.qr} onChange={(e) => setField(c, ['feedback', 'qr'], e.target.checked)} /><span className="sw" aria-hidden="true" />QR code at the service point</label></div>
        <G n={2}><CIn c={c} label="Feedback line" p={['feedback', 'phone']} v={fb.phone} ph="e.g. 02018870607" /><CIn c={c} label="Handled by" p={['feedback', 'handledBy']} v={fb.handledBy} ph="e.g. Service Delivery Liaison Officers" /></G>
      </section>
    </>
  );
}

// ---------------------------------------------------------------- website preview

function ChPreview({ c }) {
  if (c.status === 'coming') {
    return (
      <>
        <div className="cp-hd"><span className="cp-lg"><Mic k={c.icon} size={22} /></span><div><h4>{c.name || 'MDA name'}</h4><p>Charter not yet published</p></div></div>
        <div className="cp-empty"><b>This charter is on its way</b><p>{c.name || 'This MDA'} hasn’t published its service standards here yet.</p></div>
      </>
    );
  }
  const ss = c.services || [], sc = c.schedules || [], md = c.mandates || [], a = c.availability || {}, pf = c.performance || {};
  const meta = [ss.length ? `${ss.length} service${ss.length === 1 ? '' : 's'}` : '', sc.length ? `${sc.length} fee table${sc.length === 1 ? '' : 's'}` : '', md.length ? `${md.length} mandates` : ''].filter(Boolean).join(' · ');
  const fast = ss.filter((s) => { const x = tHrs(s.turnaround); return x != null && x <= 24; }).length;
  const free = ss.filter((s) => ['free', 'na'].includes(s.cost?.kind)).length;
  const it = [];
  if (a.hours) it.push(['Opening hours', a.hours]);
  if (pf.response?.kind) it.push(['Responds to enquiries', tLab(pf.response)]);
  if (pf.resolution?.kind) it.push(['Resolves reported issues', tLab(pf.resolution)]);
  if (a.emergency) it.push(['Emergency service', a.emergency]);
  if (a.online) it.push(['Online', a.online]);
  if (c.escalation) it.push(['If a dispute is not resolved', 'Escalate to the ' + c.escalation]);
  const phone = String(c.feedback?.phone || 'the feedback line').replace(/\s/g, '');
  const phoneFmt = /^\d{11}$/.test(phone) ? phone.replace(/(\d{4})(\d{3})(\d{4})/, '$1 $2 $3') : phone;
  let last = null;

  return (
    <>
      <div className="cp-hd"><span className="cp-lg"><Mic k={c.icon} size={22} /></span><div><h4>{c.name || 'MDA name'}</h4><p>{[c.sector || 'Sector', meta].filter(Boolean).join(' · ')}</p></div></div>
      {c.intro && <p className="cp-in">{c.intro}</p>}
      {ss.length > 0 && <>
        <div className="cp-st"><div><b>{ss.length}</b><span>Services</span></div><div><b>{fast}</b><span>Within 24 hrs</span></div><div><b>{free}</b><span>No charge</span></div></div>
        <div className="cp-lh"><span>Service</span><span>Time</span><span>Fee</span></div>
        {ss.map((s, i) => {
          const g = s.group && s.group !== last ? <p className="cp-g">{s.group}</p> : null; last = s.group;
          return (
            <span key={i} style={{ display: 'contents' }}>{g}
              <div className="cp-r"><div><b>{s.name || 'Untitled service'}</b>{s.unit && <small>{s.unit}</small>}</div><span className="cp-t">{tLab(s.turnaround)}</span><span className="cp-c">{s.variants?.length ? `${s.variants.length} options` : cLab(s.cost)}</span></div>
            </span>
          );
        })}
      </>}
      {md.length > 0 && <><p className="cp-sh">Mandates</p><ol className="cp-md">{md.map((m, i) => <li key={i}>{m}</li>)}</ol></>}
      {sc.map((t, i) => (
        <span key={i} style={{ display: 'contents' }}>
          <p className="cp-sh">{t.title || 'Untitled table'}</p>{t.note && <p className="cp-nt">{t.note}</p>}
          <div className="cp-tw"><table><thead><tr>{(t.cols || []).map((x, j) => <th key={j}>{x}</th>)}</tr></thead>
            <tbody>{(t.rows || []).slice(0, 6).map((r, ri) => <tr key={ri}>{(t.cols || []).map((_, j) => <td key={j}>{r[j] ?? ''}</td>)}</tr>)}</tbody></table>
            {(t.rows || []).length > 6 && <p className="cp-more">+ {t.rows.length - 6} more rows</p>}
          </div>
        </span>
      ))}
      {c.source && <p className="cp-dl"><Icon n="file" />Download the signed charter (PDF)</p>}
      <p className="cp-sh">Service promise</p>
      <dl className="cp-pr">
        {it.map((x) => <div key={x[0]}><dt>{x[0]}</dt><dd>{x[1]}</dd></div>)}
        <div><dt>Give feedback</dt><dd>{c.feedback?.qr ? 'Scan the QR code at the service point, or call ' : 'Call '}{phoneFmt}.</dd></div>
      </dl>
    </>
  );
}

// ---------------------------------------------------------------- editor

function Checks({ c }) {
  const is = chIssues(c);
  if (!is.length) return <div className="ch-ck ok"><Icon n="check" /><span><b>Ready to publish.</b> {c.status === 'coming' ? 'Shows as coming soon on the website.' : 'Nothing required is missing.'}</span></div>;
  const jump = (x) => {
    UI.ch.tab = x.tab; if (x.key) openSet().add(x.key); UI.ch.pv = false; commit();
    scrollTo(x.key ? `[data-ok="${x.key}"]` : '.ch-tabs');
  };
  return (
    <details className="ch-ck w" id="chChkD">
      <summary><Icon n="filter" /><span><b>{is.length} thing{is.length === 1 ? '' : 's'} to fix</b> before this can be published</span><Icon n="chev" className="ch-cv" /></summary>
      <ul>
        {is.slice(0, 12).map((x, k) => <li key={k}><button type="button" onClick={(e) => { e.preventDefault(); jump(x); }}>{x.m}<Icon n="chev" /></button></li>)}
        {is.length > 12 && <li className="sub">and {is.length - 12} more</li>}
      </ul>
    </details>
  );
}

export default function Charter({ k }) {
  chInit();
  const c = S.charters.find((x) => x._k === k);
  const CU = UI.ch;
  const [publishing, setPublishing] = useState(false);
  if (!c) return <div className="empty"><b>Charter not found</b>It may have been deleted.<br /><button className="btn btn-s" onClick={() => go('charters')}>Back to charters</button></div>;

  const st = chState(c), is = chIssues(c);
  const tabIdx = CTABS.findIndex((x) => x[0] === CU.tab);
  const Body = { details: TabDetails, services: TabServices, fees: TabFees, mandates: TabMandates, promise: TabPromise }[CU.tab];
  const setTab = (t) => { CU.tab = t; commit(); scrollTo('.ch-tabs', 'nearest'); };

  const coming = () => {
    if (chIssues({ ...c, status: 'coming' }).length) { CU.tab = 'details'; commit(); toast('Add the name, short name and sector first', { icon: 'x' }); return; }
    c.status = 'coming'; c._dirty = false; log('marked coming soon', c.short || c.name, ''); save(); toast('Shows as coming soon once exported', { icon: 'hour' });
  };
  const unpub = () => { c.status = 'draft'; c._dirty = true; log('unpublished', c.short || c.name, ''); save(); toast('Moved to drafts', { icon: 'undo' }); };
  const publish = () => {
    const iss = chIssues({ ...c, status: 'published' });
    if (iss.length) { const d = document.getElementById('chChkD'); if (d) { d.open = true; d.scrollIntoView({ block: 'center', behavior: RM ? 'auto' : 'smooth' }); } toast(`Fix ${iss.length} thing${iss.length === 1 ? '' : 's'} before publishing`, { icon: 'x' }); return; }
    if (!c.id) c.id = slug(c.short || c.name);
    setPublishing(true);
    // TODO(api): publish the charter. No charter endpoint exists yet.
    setTimeout(() => {
      c.status = 'published'; c._dirty = false; delete c._fresh; c._pub = Date.now();
      log('published', c.short || c.name, ''); setPublishing(false); save();
      toast(`Published ${c.short || c.name}. Export to update the website.`, { icon: 'globe' });
    }, 600);
  };
  const del = () => {
    const i = S.charters.indexOf(c); S.charters.splice(i, 1); log('deleted', c.short || c.name || 'charter', ''); persist(); go('charters');
    toast(`Deleted ${c.short || c.name || 'charter'}`, { icon: 'trash', undo: () => { S.charters.splice(i, 0, c); save(); } });
  };
  const counts = { services: (c.services || []).length, fees: (c.schedules || []).length, mandates: (c.mandates || []).length };

  return (
    <>
      <div className="ed-h">
        <div style={{ minWidth: 0 }}>
          <h1 className="h1"><span className="ch-ico lg"><Mic k={c.icon} size={22} /></span><span>{c.short || c.name || 'New charter'}</span><span><ChPill c={c} /></span></h1>
          <p className="lede">{c.name && c.short ? c.name : 'Fill in the details, services and fees exactly as the SLA states them.'}</p>
        </div>
        <div className="ed-acts">
          {c.status === 'draft' && <button className="btn btn-g" onClick={coming}><Icon n="hour" />Mark as coming soon</button>}
          {c.status === 'published' && <button className="btn btn-g" onClick={unpub}>Move to drafts</button>}
          <button className="btn btn-s" onClick={() => chExport([c], `Export ${c.short || c.name || 'charter'}`, `${c.id || slug(c.short) || 'charter'}.json`)}><Icon n="file" />Export JSON</button>
          <button className="ib danger" aria-label="Delete charter" title="Delete charter" onClick={del}><Icon n="trash" /></button>
          <button className="btn btn-p" disabled={st === 'published' || publishing} onClick={publish}>
            {publishing ? <><span className="spin" />Publishing</> : <><Icon n="globe" />{st === 'changes' ? 'Publish changes' : st === 'published' ? 'Published' : 'Publish'}</>}
          </button>
        </div>
      </div>
      <Checks c={c} />
      <div className="seg ch-seg2">
        <button type="button" aria-pressed={!CU.pv} onClick={() => { CU.pv = false; commit(); }}>Edit</button>
        <button type="button" aria-pressed={CU.pv} onClick={() => { CU.pv = true; commit(); }}>Preview</button>
      </div>
      <div className={`ch-ed ${CU.pv ? 'pv' : ''}`}>
        <div className="ch-form">
          <div className="ch-tabs" role="tablist" aria-label="Charter sections">
            {CTABS.map(([t, l]) => {
              const w = is.filter((x) => x.tab === t).length;
              return <button key={t} type="button" role="tab" aria-selected={CU.tab === t} onClick={() => setTab(t)}>{l}{w ? <span className="n w" title={`${w} to fix`}>{w}</span> : counts[t] != null ? <span className="n">{counts[t]}</span> : null}</button>;
            })}
          </div>
          <div className="slide-in" key={CU.tab}><Body c={c} /></div>
          <div className="ch-foot">
            <span className={`saved ${CU.saving ? 'ing' : ''}`}><i />{CU.saving ? 'Saving draft' : c._dirty ? 'Draft saved' : 'No unpublished changes'}</span>
            {CU.tab !== 'promise' && <button type="button" className="btn btn-s" onClick={() => { CU.tab = CTABS[tabIdx + 1][0]; commit(); scrollTo('.ch-tabs'); }}>Next: {CTABS[tabIdx + 1][1]}<Icon n="chev" /></button>}
          </div>
        </div>
        <aside className="ch-pv" aria-label="Website preview"><div className="ch-pvw">
          <div className="pv-chrome"><i /><i /><i /><span className="url"><Icon n="globe" />Charters · {c.short || c.name || 'New'}</span></div>
          <div className="ch-site"><ChPreview c={c} /></div>
        </div></aside>
      </div>
    </>
  );
}

// ---------------------------------------------------------------- actions and modals

function newCharter(extra = {}) {
  return { _k: 'n' + Date.now().toString(36), _dirty: true, _fresh: true, id: '', name: '', short: '', icon: 'gov', sector: '', status: 'draft', services: [], availability: {}, performance: {}, feedback: { ...NEW_FEEDBACK }, ...extra };
}

export function chNew() {
  chInit();
  const c = newCharter();
  S.charters.unshift(c); log('created', 'New charter', ''); persist();
  UI.ch.tab = 'details'; UI.ch.open = new Set();
  go('charter-' + c._k);
  setTimeout(() => document.querySelector('.ch-sec input')?.focus(), 60);
}

function chSource(c) {
  pick('.pdf,application/pdf', false, (f) => {
    if (f.size > 20 * 1024 * 1024) { toast('That file is over 20 MB', { icon: 'x' }); return; }
    // TODO(api): upload the PDF. Only the file name is kept for now.
    c.source = f.name; c.sourceSize = f.size; touch(c); toast('Signed charter attached', { icon: 'upload' });
  });
}

function JsonModal({ close, title, intro, json, file, height }) {
  return (
    <div className="modal ch-modal" role="dialog" aria-modal="true" aria-label={title}>
      <h3>{title}</h3><p>{intro}</p>
      <textarea className="inp ch-json" readOnly aria-label="JSON" value={json} style={height ? { height } : undefined} />
      <div className="acts">
        <span className="sub" style={{ marginRight: 'auto', alignSelf: 'center' }}>{(json.length / 1024).toFixed(1)} KB</span>
        <button className="btn btn-g" onClick={close}>Close</button>
        <button className="btn btn-s" onClick={async () => { if (await copyText(json)) toast('Copied'); else toast('Copy isn’t available here', { icon: 'x' }); }}><Icon n="file" />Copy</button>
        <button className="btn btn-p" autoFocus onClick={() => { download(json, file, file.endsWith('.csv') ? 'text/csv' : 'application/json'); toast(`Saved ${file}`, { icon: 'upload' }); }}><Icon n="upload" />Download</button>
      </div>
    </div>
  );
}

export function chExport(list, title, file) {
  const json = JSON.stringify({ version: 1, charters: list.map((c) => chClean(c) || {}) }, null, 2);
  openModal((close) => <JsonModal close={close} title={title} json={json} file={file} intro="Structured exactly like the website’s charters.json, so the charter explorer reads it without changes. Drafts are included and keep their status." />);
}

export function chTemplate() {
  const csv = csvTemplate();
  openModal((close) => <JsonModal close={close} title="Charter template" json={csv} file="otci-charter-template.csv" height={150} intro="Save this as a spreadsheet, or copy it into a new one. Only the first three columns are required." />);
}

export function chImport() {
  pick('.json,application/json', false, (f) => {
    const r = new FileReader();
    r.onload = () => {
      let d;
      try { d = JSON.parse(r.result); } catch (_) { toast('That file isn’t valid JSON', { icon: 'x' }); return; }
      const list = Array.isArray(d) ? d : Array.isArray(d?.charters) ? d.charters : d && typeof d === 'object' ? [d] : [];
      chInit();
      const okC = (x) => x && typeof x === 'object' && typeof x.name === 'string' && (!x.services || (Array.isArray(x.services) && x.services.every((s) => s && s.name && s.turnaround?.kind && s.cost?.kind)));
      const good = list.filter(okC), bad = list.length - good.length;
      if (!good.length) { toast('No charters in that file match the structure', { icon: 'x' }); return; }
      const before = clone(S.charters); let up = 0;
      good.forEach((x) => {
        const i = S.charters.findIndex((c) => x.id && c.id === x.id);
        const n = { ...clone(x), _k: i > -1 ? S.charters[i]._k : (x.id || 'i' + Math.random().toString(36).slice(2, 8)), _dirty: true };
        if (i > -1) { S.charters[i] = n; up++; } else S.charters.push(n);
      });
      log('imported', `${good.length} charter${good.length === 1 ? '' : 's'}`, ''); save();
      toast(`Imported ${good.length}${up ? ` (${up} updated)` : ''}${bad ? `, skipped ${bad}` : ''}`, { icon: 'upload', undo: () => { S.charters.splice(0, S.charters.length, ...before); save(); } });
    };
    r.readAsText(f);
  });
}

function FillModal({ close, target }) {
  const [name, setName] = useState('');
  const [text, setText] = useState('');
  const nameRef = useRef(null), textRef = useRef(null);
  useEffect(() => { setTimeout(() => (nameRef.current || textRef.current)?.focus(), 40); }, []);
  const read = (t) => {
    const svc = rowsToServices(parseRows(t));
    if (!svc.length) { toast('No services found. Check the first column is the service name.', { icon: 'x' }); return; }
    let c = target;
    if (!c) {
      const nm = name.trim();
      if (!nm) { nameRef.current?.focus(); toast('Add the MDA name first', { icon: 'x' }); return; }
      chInit();
      c = newCharter({ id: slug(nm), name: nm, _new: true });
    }
    close(); chReview(c, svc);
  };
  return (
    <div className="modal ch-modal" role="dialog" aria-modal="true" aria-labelledby="fillH">
      <h3 id="fillH">{target ? 'Add services from a spreadsheet' : 'New charter from a spreadsheet'}</h3>
      <p>Upload the filled template (.csv), or copy the rows in Excel or Google Sheets and paste them below. Columns: {CSV_COLS.slice(0, 3).map((x, i) => <span key={x}>{i > 0 && ', '}<b>{x}</b></span>)}, then optional {CSV_COLS.slice(3).join(', ').toLowerCase()}.</p>
      {!target && <div className="fld"><label className="lbl" htmlFor="fillN">MDA name</label><input ref={nameRef} className="inp" id="fillN" placeholder="e.g. Lagos State Internal Revenue Service" value={name} onChange={(e) => setName(e.target.value)} /></div>}
      <button className="drop" type="button" onClick={() => pick('.csv,text/csv,.txt', false, (f) => { const r = new FileReader(); r.onload = () => read(r.result); r.readAsText(f); })}><Icon n="upload" /><span><b>Upload the filled template</b> (.csv)</span></button>
      <div className="fld"><label className="lbl" htmlFor="fillT">Or paste rows</label><textarea ref={textRef} className="inp" id="fillT" rows={6} placeholder="Paste straight from your spreadsheet, headings included" value={text} onChange={(e) => setText(e.target.value)} /></div>
      <div className="acts">
        <button className="btn btn-g" onClick={chTemplate}><Icon n="file" />Get the template</button><span style={{ flex: 1 }} />
        <button className="btn btn-g" onClick={close}>Cancel</button>
        <button className="btn btn-p" onClick={() => { if (!text.trim()) { toast('Upload a file or paste rows first', { icon: 'x' }); return; } read(text); }}>Read rows<Icon n="chev" /></button>
      </div>
    </div>
  );
}

export function chFill(target) { openModal((close) => <FillModal close={close} target={target} />); }

function ReviewModal({ close, c, svc }) {
  const ok = svc.filter((s) => { const x = sure(s); return x.t && x.c; }).length;
  const hasOld = (c.services || []).length;
  const [mode, setMode] = useState('add');
  const add = () => {
    if (c._new) { delete c._new; S.charters.unshift(c); }
    c.services = mode === 'rep' ? svc : [...(c.services || []), ...svc];
    log('imported', `${svc.length} services into ${c.short || c.name}`, '');
    close(); UI.ch.tab = 'services'; UI.ch.open = new Set(); touch(c);
    if (UI.route !== 'charter-' + c._k) go('charter-' + c._k);
    toast(`Added ${svc.length} service${svc.length === 1 ? '' : 's'}`, { icon: 'check' });
  };
  return (
    <div className="modal ch-modal ch-rv" role="dialog" aria-modal="true" aria-labelledby="rvH">
      <h3 id="rvH">Check {svc.length} service{svc.length === 1 ? '' : 's'}</h3>
      <p>{ok === svc.length ? 'Every row was understood.' : <>{ok} understood, <b>{svc.length - ok} to check</b> after adding. They keep your wording and are flagged in the charter.</>} This is how they will read on the website.</p>
      <div className="rv-w"><table className="rv"><thead><tr><th>Service</th><th>Time to deliver</th><th>Fee</th></tr></thead><tbody>
        {svc.map((s, i) => {
          const x = sure(s);
          return (
            <tr key={i}>
              <td><b>{s.name}</b>{s.unit && <small>{s.unit}</small>}</td>
              <td className={x.t ? '' : 'ck'}>{tLab(s.turnaround)}<small>{s.turnaround.text}</small></td>
              <td className={x.c ? '' : 'ck'}>{cLab(s.cost)}<small>{s.cost.text}</small></td>
            </tr>
          );
        })}
      </tbody></table></div>
      {hasOld > 0 && <fieldset className="rv-mode"><legend className="sr">How to add</legend>
        <label><input type="radio" name="rvm" value="add" checked={mode === 'add'} onChange={() => setMode('add')} /> Add to the {hasOld} existing services</label>
        <label><input type="radio" name="rvm" value="rep" checked={mode === 'rep'} onChange={() => setMode('rep')} /> Replace existing services</label>
      </fieldset>}
      <div className="acts"><button className="btn btn-g" onClick={close}>Cancel</button><button className="btn btn-p" onClick={add}><Icon n="check" />Add {svc.length} service{svc.length === 1 ? '' : 's'}</button></div>
    </div>
  );
}

function chReview(c, svc) { openModal((close) => <ReviewModal close={close} c={c} svc={svc} />); }
