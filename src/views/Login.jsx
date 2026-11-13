import { useEffect, useRef, useState } from 'react';
import { S, save, go, toast, totals } from '../store.js';
import { scene } from '../data/content.js';
import { Icon, Mark, Ticks } from '../components/ui.jsx';
import { RM, SITE_URL } from '../lib/util.js';
import { auth as cmsAuth } from '../lib/api/index.js';

function enter(email, demo) {
  S.authed = true; S.email = email; S.demoMode = !!demo;
  save();
  go('overview');
  if (demo) setTimeout(() => toast("You're exploring with sample content", { icon: 'spark' }), 500);
}

function PasswordStep() {
  const [em, setEm] = useState('');
  const [pw, setPw] = useState('');
  const [show, setShow] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const ref = useRef(null);
  useEffect(() => { setTimeout(() => ref.current?.querySelector('#pem')?.focus(), 30); }, []);
  const submit = async (e) => {
    e.preventDefault();
    const m = em.trim();
    const bad = !m ? 'Enter your work email address.' : !/^\S+@\S+\.\S+$/.test(m) ? 'Enter a valid email address.' : !pw ? 'Enter your password.' : '';
    if (bad) { setErr(bad); return; }
    if (busy) return;
    setBusy(true);
    try {
      await cmsAuth.login(m, pw);
      enter(m, false);
    } catch (e) {
      setErr(e.message || 'Could not sign in. Check your email and password.');
      setBusy(false);
    }
  };
  return (
    <div className="l-in" ref={ref}>
      <h1>Sign in</h1><p className="lede">Use your work email and password.</p>
      <form noValidate onSubmit={submit}>
        <div className="lf"><label className="lbl" htmlFor="pem">Work email</label>
          <div className="lin"><Icon n="mail" /><input className="inp" id="pem" type="email" autoComplete="email" inputMode="email" autoCapitalize="off" spellCheck="false" placeholder="name@otci.lagosstate.gov.ng" value={em} aria-describedby="perr" aria-invalid={err && !em ? 'true' : undefined} onChange={(e) => setEm(e.target.value)} /></div>
        </div>
        <div className="lf"><label className="lbl" htmlFor="pw">Password</label>
          <div className="lin"><Icon n="lock" /><input className="inp" id="pw" type={show ? 'text' : 'password'} autoComplete="current-password" placeholder="Your password" value={pw} style={{ paddingRight: 42 }} aria-describedby="perr" aria-invalid={err && !pw ? 'true' : undefined} onChange={(e) => setPw(e.target.value)} />
            <button type="button" className="ib" aria-label={show ? 'Hide password' : 'Show password'} aria-pressed={show} onClick={() => setShow(!show)}><Icon n={show ? 'eyeoff' : 'eye'} /></button></div>
        </div>
        <p className="err" id="perr" hidden={!err} role="alert">{err && <><Icon n="x" />{err}</>}</p>
        <button className="btn btn-p l-go" type="submit" disabled={busy}>{busy ? <><span className="spin" />Signing in</> : <>Sign in<Icon n="chev" /></>}</button>
      </form>
    </div>
  );
}

const LINES = ['Taking Governance to Greater Heights', 'Your voice shapes better services in Lagos', 'Building a culture of creativity and innovation'];

/** Typing headline, review flow and health counter on the right-hand art panel. */
function useLoginAnim(target) {
  const [typed, setTyped] = useState(RM ? LINES[0] : '');
  const [flow, setFlow] = useState(RM ? 2 : 0);
  const [hnum, setHnum] = useState(RM ? target : 0);
  useEffect(() => {
    if (RM) return;
    const t0 = performance.now(); let raf;
    const cnt = (t) => { const k = Math.min(1, (t - t0) / 1100); setHnum(Math.round(target * (1 - Math.pow(1 - k, 3)))); if (k < 1) raf = requestAnimationFrame(cnt); };
    raf = requestAnimationFrame(cnt);
    let li = 0, ci = 0, del = false, pause = 0; const timers = [];
    timers.push(setInterval(() => {
      if (pause > 0) { pause--; return; }
      const L = LINES[li];
      if (!del) { ci++; if (ci >= L.length) { del = true; pause = 30; setFlow(1); timers.push(setTimeout(() => setFlow(2), 1300)); } }
      else { ci -= 2; if (ci <= 0) { ci = 0; del = false; li = (li + 1) % LINES.length; pause = 6; setFlow(0); } }
      setTyped(L.slice(0, Math.max(0, ci)));
    }, 65));
    return () => { cancelAnimationFrame(raf); timers.forEach((t) => { clearInterval(t); clearTimeout(t); }); };
  }, [target]);
  return { typed, flow, hnum };
}

export default function Login() {
  const health = Math.round(totals().health * 100);
  const [skipping, setSkipping] = useState(false);
  const { typed, flow, hnum } = useLoginAnim(health);
  const bg = useRef(scene('sky', 11)).current;
  const flowIcon = (i) => (i < flow ? <Icon n="check" /> : i === flow ? <span className="spin" /> : <Icon n={['pen', 'send', 'globe'][i]} />);

  return (
    <div className="login">
      <section className="l-form">
        <div className="l-brand"><Mark /><div>OTCI Studio<small>Lagos State Office of Transformation, Creativity and Innovation</small></div></div>
        <div className="l-body"><div className="l-inner">
          <span className="l-eyebrow"><i />Content workspace for otci.lagosstate.gov.ng</span>
          <div id="lstep"><PasswordStep /></div>
          <button type="button" className="l-skip" disabled={skipping} onClick={() => { setSkipping(true); setTimeout(() => enter('demo@otci.lagosstate.gov.ng', true), 350); }}>
            {skipping ? <><span className="spin" />Opening</> : <>Skip to the dashboard<Icon n="chev" /></>}
          </button>
        </div></div>
        <div className="l-foot"><span>© 2026 Lagos State OTCI · <a href={SITE_URL} target="_blank" rel="noopener" style={{ color: 'inherit' }}>Go to the website</a></span><span>Need access? Ask your Super Admin.</span></div>
      </section>
      <section className="l-art" aria-label="About OTCI Studio">
        <span className="glow g1" /><span className="glow g2" /><span className="glow g3" /><span className="grain" />
        <div className="art-head">
          <span className="art-kicker"><span>New</span>Live preview for every department page</span>
          <h2>Edit the OTCI website in one calm place.</h2>
          <p>Change a headline and watch the page update beside you. Send it for review, then publish when it's right.</p>
        </div>
        <div className="bento" aria-hidden="true">
          <div className="bc bc-big" style={{ '--d': '.1s' }}>
            <div><h4>Live preview</h4><p>Your words appear on the page as you type.</p></div>
            <div className="ed-mini"><div className="ebar">Homepage<b>Hero Section</b><span className="pill"><Icon n="pen" />Draft</span></div><div className="typer">{typed}</div></div>
            <div className="site-mini" style={{ backgroundImage: `url('${bg}')` }}><span className="live">Preview</span><div className="sx"><h5>{typed}</h5><div className="bt"><span>Explore Our Work</span><span>View Impact</span></div></div></div>
          </div>
          <div className="bc" style={{ '--d': '.22s' }}><h4>Review before it goes live</h4><p>Every change follows the same path.</p>
            <div className="flow">{['Edit section', 'Send for review', 'Publish'].map((l, i) => <span key={i} className={i < flow ? 'done' : i === flow ? 'now' : ''}>{flowIcon(i)}{l}</span>)}</div>
          </div>
          <div className="bc" style={{ '--d': '.34s' }}><h4>Content health</h4><p>How complete the site's sections are today.</p>
            <div className="health-mini"><b className="num">{hnum}</b><span>% of fields filled</span></div><Ticks n={30} frac={health / 100} grad />
          </div>
        </div>
      </section>
    </div>
  );
}
