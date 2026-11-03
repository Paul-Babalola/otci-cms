import { S, UI, commit } from '../store.js';
import { META, DEPTS } from '../data/content.js';
import { Icon, Timeline } from '../components/ui.jsx';

export default function Activity() {
  const list = S.activity.filter((a) => UI.act === 'all' || META[a.page]?.dept === UI.act);
  return (
    <>
      <div className="h-row">
        <div><h1 className="h1">Activity</h1><p className="lede">Every edit, upload and publish across the website.{S.activity.some((a) => a.demo) ? ' Entries from other editors are sample data.' : ''}</p></div>
        <label className="fsel"><Icon n="layers" /><span className="sr">Department</span>
          <select value={UI.act} onChange={(e) => { UI.act = e.target.value; commit(); }}>
            <option value="all">All departments</option>{Object.keys(DEPTS).map((d) => <option key={d}>{d}</option>)}
          </select>
        </label>
      </div>
      <section className="card" style={{ maxWidth: 760 }}><Timeline list={list.slice(0, 60)} /></section>
    </>
  );
}
