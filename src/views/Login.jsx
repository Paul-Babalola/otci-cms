import { useEffect, useRef, useState } from 'react';
import { S, save, go, toast, totals } from '../store.js';
import { scene } from '../data/content.js';
import { Icon, Mark, Ticks } from '../components/ui.jsx';
import { RM, SITE_URL } from '../lib/util.js';

function enter(email, demo) {
  S.authed = true; S.email = email; S.demoMode = !!demo;
  save();
  go('overview');
  if (demo) setTimeout(() => toast('You’re exploring with sample content', { icon: 'spark' }), 500);
}

function EmailStep({ email, onSent }) {
  const [val, setVal] = useState(email);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const ref = useRef(null);
  useEffect(() => { setTimeout(() => ref.current?.focus(), 30); }, []);
  const submit = (e) => {
    e.preventDefault();
    const em = val.trim();
    const bad = !em ? 'Enter your work email address.' : !/^\S+@\S+\.\S+$/.test(em) ? 'Enter an email address like name@otci.lagosstate.gov.ng.' : '';
    if (bad) { setErr(bad); ref.current?.focus(); return; }
    setBusy(true);
    // TODO(api): POST the email to send a one-time code. No such endpoint exists yet.
    setTimeout(() => onSent(em), 700);
  };
  return (
    <div className="l-in">
      <h1>Sign in</h1><p className="lede">Enter your work email and we’ll send you a 6-digit code. No password needed.</p>
      <form noValidate onSubmit={submit}>
        <div className="lf"><label className="lbl" htmlFor="em">Work email</label>
          <div className="lin"><Icon n="mail" /><input ref={ref} className="inp" id="em" type="email" autoComplete="email" inputMode="email" autoCapitalize="off" spellCheck="false" placeholder="name@otci.lagosstate.gov.ng" value={val} aria-describedby="lerr" aria-invalid={err ? 'true' : undefined} onChange={(e) => setVal(e.target.value)} /></div>
        </div>
        <p className="err" id="lerr" hidden={!err} role="alert">{err && <><Icon n="x" />{err}</>}</p>
        <button className="btn btn-p l-go" type="submit" disabled={busy}>{busy ? <><span className="spin" />Sending code</> : <>Send code<Icon n="chev" /></>}</button>
      </form>
    </div>
  );
}

function CodeStep({ email, onBack }) {
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [left, setLeft] = useState(30);
  const refs = useRef([]);
  const formRef = useRef(null);

  useEffect(() => { setTimeout(() => refs.current[0]?.focus(), 30); }, []);
  useEffect(() => { if (left <= 0) return; const t = setTimeout(() => setLeft(left - 1), 1000); return () => clearTimeout(t); }, [left]);

  const submit = (d = digits) => {
    const v = d.join('');
    if (v.length < 6) { setErr('Enter all 6 digits from the email.'); refs.current[d.findIndex((x) => !x)]?.focus(); return; }
    if (busy) return;
    setBusy(true);
    // TODO(api): verify the code. Preview build accepts any 6 digits.
    setTimeout(() => enter(email, false), 650);
  };
  const fill = (str, from) => {
    const d = [...digits];
    str.replace(/\D/g, '').slice(0, 6 - from).split('').forEach((x, k) => { d[from + k] = x; });
    setDigits(d);
    refs.current[Math.min(5, from + str.replace(/\D/g, '').length)]?.focus();
    if (d.join('').length === 6) submit(d);
  };

  return (
    <div className="l-in">
      <h1>Check your email</h1><p className="lede">We sent a 6-digit code to <b className="l-em">{email}</b>. It expires in 10 minutes.</p>
      <form ref={formRef} noValidate onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <fieldset className="otp" aria-describedby="cerr"><legend className="lbl">Enter the code</legend>
          <div className="otp-g">
            {digits.map((v, i) => (
              <input key={i} ref={(el) => { refs.current[i] = el; }} className="inp otp-i" inputMode="numeric" pattern="[0-9]*" maxLength={1}
                autoComplete={i === 0 ? 'one-time-code' : 'off'} aria-label={`Digit ${i + 1} of 6`} value={v} disabled={busy}
                aria-invalid={err && !v ? 'true' : undefined}
                onFocus={(e) => e.target.select()}
                onChange={(e) => {
                  setErr('');
                  const x = e.target.value.replace(/\D/g, '');
                  if (x.length > 1) { fill(x, i); return; }
                  const d = [...digits]; d[i] = x; setDigits(d);
                  if (x && i < 5) refs.current[i + 1]?.focus();
                  if (d.join('').length === 6) submit(d);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Backspace' && !v && i > 0) { e.preventDefault(); const d = [...digits]; d[i - 1] = ''; setDigits(d); refs.current[i - 1]?.focus(); }
                  else if (e.key === 'ArrowLeft' && i > 0) { e.preventDefault(); refs.current[i - 1]?.focus(); }
                  else if (e.key === 'ArrowRight' && i < 5) { e.preventDefault(); refs.current[i + 1]?.focus(); }
                }}
                onPaste={(e) => { const t = e.clipboardData.getData('text'); if (/\d/.test(t)) { e.preventDefault(); fill(t, i); } }} />
            ))}
          </div>
        </fieldset>
        <p className="err" id="cerr" hidden={!err} role="alert">{err && <><Icon n="x" />{err}</>}</p>
        <button className="btn btn-p l-go" type="submit" disabled={busy}>{busy ? <><span className="spin" />Verifying</> : <>Verify and continue<Icon n="chev" /></>}</button>
        <div className="otp-row">
          <button type="button" className="l-lnk" onClick={onBack}><Icon n="back" />Change email</button>
          <button type="button" className="l-lnk" disabled={left > 0} onClick={() => { setDigits(['', '', '', '', '', '']); refs.current[0]?.focus(); toast(`New code sent to ${email}`, { icon: 'mail' }); setLeft(30); }}>
            {left > 0 ? `Resend code in 0:${String(left).padStart(2, '0')}` : 'Resend code'}
          </button>
        </div>
        <p className="otp-demo"><Icon n="spark" />Preview build: any 6 digits will sign you in.</p>
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
  const [step, setStep] = useState('email');
  const [email, setEmail] = useState('');
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
          <div id="lstep">
            {step === 'email'
              ? <EmailStep email={email} onSent={(em) => { setEmail(em); setStep('code'); }} />
              : <CodeStep email={email} onBack={() => setStep('email')} />}
          </div>
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
          <p>Change a headline and watch the page update beside you. Send it for review, then publish when it’s right.</p>
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
          <div className="bc" style={{ '--d': '.34s' }}><h4>Content health</h4><p>How complete the site’s sections are today.</p>
            <div className="health-mini"><b className="num">{hnum}</b><span>% of fields filled</span></div><Ticks n={30} frac={health / 100} grad />
          </div>
        </div>
      </section>
    </div>
  );
}
