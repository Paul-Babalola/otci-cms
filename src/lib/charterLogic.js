// Charter labels, checks and spreadsheet parsing, copied verbatim from OTCI Studio.
export const ICONS=[['gov','Government'],['tax','Revenue'],['land','Land'],['car','Transport'],['hosp','Hospital'],['mat','Maternity'],['blood','Blood'],['tech','Technology']];
export const TK=[['exact','Fixed time'],['range','Time range'],['upto','Up to a limit'],['atleast','At least'],['immediate','Immediate'],['case','Case by case'],['ongoing','Ongoing'],['request','On request'],['rules','Set by rules or law'],['external','Depends on another body'],['none','Not stated']];
export const TU=[['min','Minutes'],['hour','Hours'],['day','Days'],['wday','Working days'],['week','Weeks'],['month','Months']];
export const TNUM={exact:['min'],range:['min','max'],upto:['max'],atleast:['min'],case:['max']};
export const CKD=[['free','Free'],['na','No fee listed'],['fixed','Fixed fee'],['range','Fee range'],['rate','Rate per unit'],['percent','Percentage'],['schedule','See a fee table'],['tiered','Tiered (fee table)'],['statutory','Statutory rate'],['assessed','Assessed per case'],['market','Market price'],['external','Set by another body'],['pending','Fee being set'],['text','Text only'],['none','Not stated']];
export const CKEEP={fixed:['amount','per','renew'],range:['min','max','per'],rate:['amount','min','max','per'],percent:['pct','min','max','of'],schedule:['ref','min','max'],tiered:['ref','min','max'],statutory:['min'],market:['amount','per']};
export const has=v=>v!=null&&v!=='';
export const CNEED={fixed:c=>has(c.amount)?[]:['amount'],range:c=>['min','max'].filter(n=>!has(c[n])),rate:c=>[...(has(c.amount)||has(c.min)&&has(c.max)?[]:['amount']),...(has(c.per)?[]:['per'])],percent:c=>has(c.of)?[]:['of'],schedule:(c,s)=>has(c.ref)||has(c.min)||s?.variants?.length?[]:['ref'],tiered:(c,s)=>has(c.ref)||has(c.min)||s?.variants?.length?[]:['ref']};
export const NOTEXT=['free','na','none'];

/* labels: identical rules to the website explorer */
export const UNL={min:['min','mins'],hour:['hr','hrs'],day:['day','days'],wday:['working day','working days'],week:['week','weeks'],month:['month','months']};
export const unl=(n,u)=>(UNL[u]||['',''])[n===1?0:1];
export const HU={min:1/60,hour:1,day:24,wday:33.6,week:168,month:720};
export const tHrs=t=>{if(!t)return null;if(t.kind==='immediate')return .25;const f=HU[t.unit];if(!f||!['exact','range','upto','atleast'].includes(t.kind))return null;const v=t.max??t.min;return v==null?null:v*f};
export function tLab(t){if(!t||!t.kind)return 'Not set';const ok=n=>n!=null&&n!=='';switch(t.kind){
  case 'immediate':return 'Immediate';
  case 'exact':return ok(t.min)?`${t.min} ${unl(t.min,t.unit)}`:'Fixed time';
  case 'range':return ok(t.min)&&ok(t.max)?(+t.min===0?`Immediate to ${t.max} ${unl(t.max,t.unit)}`:`${t.min} – ${t.max} ${unl(t.max,t.unit)}`):'Time range';
  case 'upto':return ok(t.max)?`Within ${t.max} ${unl(t.max,t.unit)}`:'Up to a limit';
  case 'atleast':return ok(t.min)?`At least ${t.min} ${unl(t.min,t.unit)}`:'At least';
  case 'ongoing':return 'Ongoing';case 'case':return 'Case by case';case 'rules':return 'Court rules apply';case 'external':return 'Depends on another body';case 'request':return 'On request';default:return 'Not stated'}}
export const NGN=n=>'₦'+Number(n).toLocaleString('en-GB',{maximumFractionDigits:2});
export function cLab(c){if(!c||!c.kind)return 'Not set';const has=n=>n!=null&&n!=='';switch(c.kind){
  case 'free':return 'Free';case 'na':return 'No fee listed';
  case 'fixed':return (has(c.amount)?NGN(c.amount):(c.text||'Fixed fee'))+(c.per?` per ${c.per}`:'')+(c.renew&&has(c.renew.amount)?` · ${NGN(c.renew.amount)}/${c.renew.period==='year'?'yr':c.renew.period||'yr'} renewal`:'');
  case 'range':return has(c.min)&&has(c.max)?`${NGN(c.min)} – ${NGN(c.max)}`:'Varies';
  case 'rate':return has(c.amount)?`${NGN(c.amount)} per ${c.per||'unit'}`:has(c.min)?`${NGN(c.min)} – ${NGN(c.max)} per ${c.per||'unit'}`:'Rate applies';
  case 'percent':return has(c.pct)?`${c.pct}% of ${c.of||'value'}`:has(c.min)?`${c.min} – ${c.max}% of ${c.of||'value'}`:`Share of ${c.of||'value'}`;
  case 'tiered':case 'schedule':return has(c.min)&&has(c.max)?`${NGN(c.min)} – ${NGN(c.max)}`:has(c.min)?`From ${NGN(c.min)}`:'See fee table';
  case 'statutory':return has(c.min)?`Statutory, from ${NGN(c.min)}`:'Statutory rate';
  case 'assessed':return 'Assessed per case';case 'market':return has(c.amount)?`${NGN(c.amount)} per ${c.per} · market price`:'Market price';
  case 'external':return 'Set by another body';case 'pending':return 'Fee being set';case 'text':return c.text||'Text only';default:return 'Not stated'}}

export const slug=s=>String(s||'').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,40);
export const getPC=(o,p)=>p.reduce((a,k)=>a==null?a:a[k],o);
export function setPC(o,p,v){let a=o;for(let i=0;i<p.length-1;i++){if(a[p[i]]==null)a[p[i]]=typeof p[i+1]==='number'?[]:{};a=a[p[i]]}const k=p[p.length-1];if(v===undefined)delete a[k];else a[k]=v}
export function delPC(o,p){const a=getPC(o,p.slice(0,-1));if(!a)return;const k=p[p.length-1];Array.isArray(a)?a.splice(k,1):delete a[k]}
export function chClean(x){
  if(Array.isArray(x))return x.map(chClean).filter(v=>v!==undefined);
  if(x&&typeof x==='object'){const o={};for(const [k,v] of Object.entries(x)){if(k[0]==='_')continue;const c=chClean(v);if(c===undefined)continue;o[k]=c}
    if(o.renew&&o.renew.amount==null)delete o.renew;
    return Object.keys(o).length?o:undefined}
  if(x===''||x==null||(typeof x==='number'&&isNaN(x)))return undefined;
  return typeof x==='string'?x.trim():x}
export function tIss(t,who,tab,key,L,opt){if(!t||!t.kind){if(!opt)L.push({m:`${who}: choose how long it takes`,tab,key});return}
  if(!opt||t.kind)if(!String(t.text||'').trim())L.push({m:`${who}: add the time as published`,tab,key});
  const need=(TNUM[t.kind]||[]).filter(n=>t.kind!=='case');need.forEach(n=>{if(t[n]==null||t[n]==='')L.push({m:`${who}: enter the ${n==='min'?'starting':'maximum'} time`,tab,key})});
  if(need.length&&!t.unit)L.push({m:`${who}: choose a time unit`,tab,key});
  if(t.kind==='range'&&t.min!=null&&t.max!=null&&+t.min>+t.max)L.push({m:`${who}: the time range runs backwards`,tab,key})}
export function cIss(c,who,tab,key,L,ch,opt,svc){if(!c||!c.kind){if(!opt)L.push({m:`${who}: choose the fee type`,tab,key});return}
  if(!NOTEXT.includes(c.kind)&&!String(c.text||'').trim())L.push({m:`${who}: add the fee as published`,tab,key});
  (opt?[]:(CNEED[c.kind]?.(c,svc)||[])).forEach(n=>{L.push({m:`${who}: ${n==='ref'?'pick the fee table':n==='of'?'say what the percentage is of':n==='per'?'say what the rate is per':'enter the '+({amount:'amount',min:'lowest fee',max:'highest fee',pct:'percentage'}[n])}`,tab,key})});
  if(c.ref&&!(ch.schedules||[]).some(s=>s.id===c.ref))L.push({m:`${who}: the linked fee table no longer exists`,tab,key})}
export function chIssues(c){const L=[];
  if(!String(c.name||'').trim())L.push({m:'Add the MDA name',tab:'details'});
  if(c.status!=='coming'&&!String(c.short||'').trim())L.push({m:'Add a short name',tab:'details'});
  if(!String(c.sector||'').trim())L.push({m:'Add a sector',tab:'details'});
  if(c.status==='coming')return L;
  const ss=c.services||[],sc=c.schedules||[],md=c.mandates||[];
  if(!ss.length&&!sc.length&&!md.length)L.push({m:'Add at least one service, fee table or mandate',tab:'services'});
  ss.forEach((s,i)=>{const who=s.name?.trim()?`“${s.name.trim().slice(0,38)}”`:`Service ${i+1}`,key='s'+i;
    if(!s.name?.trim())L.push({m:`Service ${i+1}: add a name`,tab:'services',key});
    tIss(s.turnaround,who,'services',key,L);if(s._imp&&s.turnaround?.kind==='none'&&s.turnaround.text)L.push({m:`${who}: time not recognised, pick a type`,tab:'services',key});cIss(s.cost,who,'services',key,L,c,0,s);
    (s.variants||[]).forEach((v,j)=>{const w=`${who}, option ${j+1}`;if(!v.label?.trim())L.push({m:`${w}: add a label`,tab:'services',key});if(v.cost)cIss(v.cost,w,'services',key,L,c,1);if(v.turnaround)tIss(v.turnaround,w,'services',key,L,1)})});
  sc.forEach((t,i)=>{const who=t.title?.trim()?`“${t.title.trim().slice(0,38)}”`:`Fee table ${i+1}`,key='t'+i;
    if(!t.title?.trim())L.push({m:`Fee table ${i+1}: add a title`,tab:'fees',key});
    if(!(t.cols||[]).some(x=>String(x).trim()))L.push({m:`${who}: name the columns`,tab:'fees',key});
    if(!(t.rows||[]).some(r=>r.some(x=>String(x).trim())))L.push({m:`${who}: add at least one row`,tab:'fees',key})});
  md.forEach((m,i)=>{if(!String(m).trim())L.push({m:`Mandate ${i+1} is empty`,tab:'mandates'})});
  if(c.performance?.response)tIss(c.performance.response,'Response time','promise',null,L,1);
  if(c.performance?.resolution)tIss(c.performance.resolution,'Resolution time','promise',null,L,1);
  return L}
export const chState=c=>c.status==='published'?(c._dirty?'changes':'published'):c.status==='coming'?'coming':'draft';
export const CHP={published:['ok','Published','globe'],changes:['warn','Unpublished changes','pen'],coming:['off','Coming soon','hour'],draft:['rev','Draft','file']};
export const CHT={service:()=>({name:'',turnaround:{kind:'upto',text:''},cost:{kind:'free',text:''}}),variant:()=>({label:''}),mandate:()=>'',schedule:c=>({id:`${c.id||slug(c.short)||'table'}-${(c.schedules||[]).length+1}`,title:'',cols:['Item','Fee'],rows:[['','']]})};
export const CSV_COLS=['Service','Time to deliver','Fee','Unit or office','Group','Conditions','Description'];
export const CSV_EX=[['Tax clearance certificate','Within 10 working days of complete application','Free','Tax Audit','Certificates','No outstanding tax liability',''],['Change of name on title','2 – 4 weeks','₦50,000','Lands Registry','Title documents','Sworn affidavit; Newspaper publication','']];
export const csvCell=v=>/[",\n]/.test(v)?'"'+String(v).replace(/"/g,'""')+'"':String(v);
export const csvTemplate=()=>[CSV_COLS,...CSV_EX].map(r=>r.map(csvCell).join(',')).join('\r\n')+'\r\n';
export function parseRows(text){const t=String(text).replace(/^﻿/,'');const sep=t.split('\n')[0].includes('\t')?'\t':',';const rows=[];let row=[],cur='',q=false;
  for(let i=0;i<t.length;i++){const ch=t[i];if(q){if(ch==='"'){if(t[i+1]==='"'){cur+='"';i++}else q=false}else cur+=ch;continue}
    if(ch==='"'){q=true;continue}if(ch===sep){row.push(cur);cur='';continue}if(ch==='\n'||ch==='\r'){if(ch==='\r'&&t[i+1]==='\n')i++;row.push(cur);rows.push(row);row=[];cur='';continue}cur+=ch}
  if(cur||row.length){row.push(cur);rows.push(row)}
  return rows.map(r=>r.map(x=>x.trim())).filter(r=>r.some(Boolean))}
export const UMAP=[[/working days?|business days?|work days?/,'wday'],[/days?/,'day'],[/hours?|hrs?\b/,'hour'],[/weeks?|wks?\b/,'week'],[/months?/,'month'],[/minutes?|mins?\b/,'min']];
export const unitOf=s=>{for(const [r,u] of UMAP)if(r.test(s))return u;return null};
export const num=s=>parseFloat(String(s).replace(/,/g,''));
export function guessTime(text){const s=String(text||'').toLowerCase().trim(),o={text:String(text||'').trim()};
  if(!s)return {...o,kind:'none'};
  const R=/(\d+(?:\.\d+)?)\s*(?:-|–|—|to)\s*(\d+(?:\.\d+)?)\s*([a-z ]+)/.exec(s);
  if(R&&unitOf(R[3])){const a=num(R[1]),b=num(R[2]),u=unitOf(R[3]);return a===0?{...o,kind:'range',min:0,max:b,unit:u}:{...o,kind:'range',min:a,max:b,unit:u}}
  const one=/(\d+(?:\.\d+)?)\s*(working days?|business days?|work days?|days?|hours?|hrs?|weeks?|wks?|months?|minutes?|mins?)/.exec(s);
  if(/case|depend|varies|subject to volume/.test(s))return one?{...o,kind:'case',max:num(one[1]),unit:unitOf(one[2])}:{...o,kind:'case'};
  if(one){const n=num(one[1]),u=unitOf(one[2]);if(/at least|minimum|not less than/.test(s))return {...o,kind:'atleast',min:n,unit:u};if(/within|up to|not more than|maximum|max|no later|before/.test(s))return {...o,kind:'upto',max:n,unit:u};return {...o,kind:'exact',min:n,max:n,unit:u}}
  if(/same day|while you wait|on the spot/.test(s))return {...o,kind:'upto',max:24,unit:'hour'};
  if(/immediate|instant|real.?time|on arrival|on submission/.test(s))return {...o,kind:'immediate'};
  if(/court|rules|statut|law/.test(s))return {...o,kind:'rules'};
  if(/ongoing|continuous|always|24\/7/.test(s))return {...o,kind:'ongoing'};
  if(/request|demand|appointment/.test(s))return {...o,kind:'request'};
  if(/other agenc|another body|third part|external/.test(s))return {...o,kind:'external'};
  return {...o,kind:'none'}}
export function guessCost(text){const raw=String(text||'').trim(),s=raw.toLowerCase(),o={text:raw};
  if(!s||/^(n\/?a|not applicable|-|—)$/.test(s))return {...o,kind:'na'};
  if(/^(free|nil|none|no (fee|charge|cost))\b|free of charge|no charge/.test(s))return {...o,kind:'free'};
  const amts=[...raw.matchAll(/(?:₦|ngn|naira|\bn)\s?(\d[\d,]*(?:\.\d+)?)|(\d[\d,]*(?:\.\d+)?)\s?(?:naira|ngn)/gi)].map(m=>num(m[1]||m[2])).filter(n=>!isNaN(n));
  const rn=/renew\w*\s*(?:yearly|annually|every year)?\s*(?:at|for)?\s*(?:₦|ngn|n)\s?(\d[\d,]*)/i.exec(raw);
  if(rn&&amts.length>=1)return {...o,kind:'fixed',amount:amts[0],renew:{amount:num(rn[1]),period:/month/.test(s)?'month':'year'}};
  const pct=/(\d+(?:\.\d+)?)\s?%(?:\s*of\s*(?:the\s*)?([a-z ]+))?/.exec(s);
  if(pct)return {...o,kind:'percent',pct:num(pct[1]),of:(pct[2]||'').trim()||'value'};
  const per=/per\s+([a-z0-9 ]+?)(?:\s+(?:per|yearly|annually|by|for|,|;)|$)/.exec(s);
  if(amts.length>=2&&/(-|–|—|to|between)/.test(s))return per?{...o,kind:'rate',min:Math.min(...amts),max:Math.max(...amts),per:per[1].trim()}:{...o,kind:'range',min:Math.min(...amts),max:Math.max(...amts)};
  if(amts.length===1&&per)return {...o,kind:'rate',amount:amts[0],per:per[1].trim()};
  if(/statut|gazett|as prescribed|by law/.test(s))return amts.length?{...o,kind:'statutory',min:Math.min(...amts)}:{...o,kind:'statutory'};
  if(/assess|evaluat|valuation/.test(s))return {...o,kind:'assessed'};
  if(/market/.test(s))return {...o,kind:'market'};
  if(/schedule|table|see (the )?(attached|fee)|tier|by (zone|category|size)/.test(s))return amts.length?{...o,kind:'schedule',min:Math.min(...amts),max:Math.max(...amts)}:{...o,kind:'schedule'};
  if(/other agenc|another body|third part|bank charge/.test(s))return {...o,kind:'external'};
  if(/to be (set|announced|determined)|pending/.test(s))return {...o,kind:'pending'};
  if(amts.length===1)return {...o,kind:'fixed',amount:amts[0]};
  return {...o,kind:'text'}}
export function rowsToServices(rows){let start=0;const h=(rows[0]||[]).map(x=>x.toLowerCase());if(h[0]&&/service/.test(h[0]))start=1;
  const col=(name,def)=>{const i=h.findIndex(x=>x.includes(name));return start&&i>-1?i:def};
  const ci={name:col('service',0),time:col('time',1),fee:Math.max(col('fee',2),col('cost',-1)),unit:col('unit',3),group:col('group',4),cond:col('condition',5),desc:col('desc',6)};
  return rows.slice(start).filter(r=>r[ci.name]).map(r=>{const s={name:r[ci.name],turnaround:guessTime(r[ci.time]),cost:guessCost(r[ci.fee]),_imp:1};
    if(r[ci.unit])s.unit=r[ci.unit];if(r[ci.group])s.group=r[ci.group];if(r[ci.desc])s.desc=r[ci.desc];
    if(r[ci.cond])s.conditions=r[ci.cond].split(/;|\n/).map(x=>x.trim()).filter(Boolean);return s})}
export const sure=s=>({t:!['none','case'].includes(s.turnaround.kind)||!s.turnaround.text,c:!['text'].includes(s.cost.kind)});
