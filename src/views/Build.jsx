import { S, chInit, toast } from '../store.js';
import { PAGES, PIDS } from '../data/content.js';
import { chClean } from '../lib/charterLogic.js';
import { Icon } from '../components/ui.jsx';
import { download } from '../lib/util.js';

export function siteContent() {
  chInit();
  const pages = {};
  PIDS.forEach((pid) => { pages[pid] = S.pages[pid].sections.filter((s) => s.visible).map((s) => ({ id: PAGES[pid].sections[s.schema].title, ...s.pub })); });
  return {
    version: 1, generated: new Date().toISOString(), pages,
    charters: S.charters.filter((c) => c.status !== 'draft').map((c) => chClean(c) || {}),
    gallery: S.gallery.filter((f) => f.visible).map((f) => ({ title: f.title, desc: f.desc, images: f.images.map((i) => i.name) })),
  };
}

const Step = ({ n, t, d }) => <li><b className="num">{n}</b><div><h3>{t}</h3><p>{d}</p></div></li>;
const Row = ({ a, b, c }) => <tr><td><code>{a}</code></td><td>{b}</td><td>{c}</td></tr>;

export default function Build() {
  const exportJson = () => { download(JSON.stringify(siteContent(), null, 2), 'otci-site-content.json'); toast('Site content saved', { icon: 'upload' }); };
  return (
    <>
      <div className="h-row"><div><h1 className="h1">How it’s built</h1><p className="lede">A light setup with no database server and no monthly platform fees. The website is a set of static files that reads its words, images and charters from JSON files. This CMS edits those files.</p></div><button className="btn btn-p" onClick={exportJson}><Icon n="file" />Export site content</button></div>
      <div className="bd-g">
        <section className="card bd-c"><h2 className="h2">How a change reaches the website</h2><ol className="bd-steps">
          <Step n={1} t="An editor saves a draft" d="Copy, images and charters are saved as drafts in the CMS. Nothing on the website changes yet." />
          <Step n={2} t="A Super Admin publishes" d="Publishing writes the page’s JSON file, plus any new images or PDFs, to the website’s file store." />
          <Step n={3} t="The website updates itself" d="The host sees the new files and redeploys in about a minute. Visitors get the change on their next visit." />
        </ol></section>
        <section className="card bd-c"><h2 className="h2">What gets stored</h2><div className="tbl-w"><table className="tbl bd-t"><thead><tr><th>File</th><th>Holds</th><th>Edited in</th></tr></thead><tbody>
          <Row a="content/pages/<page>.json" b="Every section’s copy, numbers, buttons and image paths" c="Pages" />
          <Row a="content/charters.json" b="All service charters in one shape (services, times, fees, fee tables)" c="Service charters" />
          <Row a="content/gallery.json" b="Gallery folders and their order" c="Media library" />
          <Row a="media/…" b="Images (resized to 1600px before upload) and PDFs" c="Any upload field" />
        </tbody></table></div></section>
        <section className="card bd-c"><h2 className="h2">Recommended setup</h2><ul className="bd-l">
          <li><b>Hosting:</b> any static host with a free tier, such as Netlify, Cloudflare Pages or GitHub Pages. No server to maintain.</li>
          <li><b>File store:</b> a private GitHub repository. Every publish is a saved version, so any change can be rolled back.</li>
          <li><b>Sign-in and roles:</b> the host’s identity service, or GitHub accounts. Editors can save and send for review; only Super Admins publish.</li>
          <li><b>Feedback and ratings:</b> one small serverless function stores form submissions in a spreadsheet or a free-tier database, and writes the quarterly ratings file.</li>
          <li><b>Charters from MDAs:</b> the CSV template. MDAs fill a spreadsheet they already know; the CMS reads it, so nobody types an SLA in twice.</li>
        </ul></section>
        <section className="card bd-c"><h2 className="h2">Why this shape</h2><ul className="bd-l">
          <li><b>Cheap to run:</b> the main costs are the domain name and the developer’s time. Free tiers cover a government information site’s traffic.</li>
          <li><b>Fast and safe:</b> static pages load quickly on mobile data and have no database to attack.</li>
          <li><b>Easy to hand over:</b> the content is plain JSON in this exact structure. Another developer or CMS can pick it up without a migration.</li>
          <li><b>Grows when needed:</b> if OTCI later wants many editors working at once, the same JSON can move into a hosted database without changing the website.</li>
        </ul></section>
      </div>
    </>
  );
}
