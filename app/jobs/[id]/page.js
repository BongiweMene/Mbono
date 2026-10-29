import Link from 'next/link';
import mongoose from 'mongoose';
import { db } from '@/lib/db';
import { Job } from '@/lib/models';
import SiteHeader from '@/components/SiteHeader';
import AlertForm from '@/components/AlertForm';
import '@/app/extra.css';
export const dynamic = 'force-dynamic';
const List = ({ t, items }) => items?.length ? <section className="jsec"><h2>{t}</h2><ul>{items.map((i) => <li key={i}>{i}</li>)}</ul></section> : null;
export default async function JobPage({ params }) {
  let j = null;
  if (mongoose.isValidObjectId(params.id)) { await db(); j = await Job.findOne({ _id: params.id, status: 'open' }).lean(); }
  if (!j) return (<><SiteHeader /><main className="wrap sec"><h1>Vacancy not found</h1><p>This vacancy may have closed.</p><Link className="btn" href="/dashboard">Back to jobs</Link></main></>);
  const facts = [['Employer', j.company || 'Mbono'], ['Location', j.location], ['Work mode', j.workMode || 'On-site'], ['Salary', j.salary], ['Employment type', j.type], ['Closing date', j.deadline && new Date(j.deadline).toLocaleDateString('en-ZA')]].filter((x) => x[1]);
  return (<><SiteHeader /><main>
    <header className="jhead"><div className="wrap"><Link href="/dashboard">← All vacancies</Link><h1>{j.title}</h1><span className="badge">{j.industry || 'Vacancy'}</span></div></header>
    <div className="wrap"><div className="facts">{facts.map(([k, v]) => <div className="fact" key={k}><small>{k}</small><b>{v}</b></div>)}</div>
      <div className="jlayout"><article>
        <section className="jsec"><h2>About the role</h2>{(j.description || '').split('\n\n').map((p, i) => <p key={i}>{p}</p>)}</section>
        <List t="Key responsibilities" items={j.responsibilities} /><List t="Minimum qualifications and requirements" items={j.requirements} />
        <List t="Required skills and experience" items={j.skills} /><List t="Preferred qualifications" items={j.preferred} />
        {j.hours && <section className="jsec"><h2>Working hours and shifts</h2><p>{j.hours}</p></section>}
        {j.additional && <section className="jsec"><h2>Additional information</h2><p>{j.additional}</p></section>}
      </article><aside className="side"><div className="card"><h3>Interested?</h3><p>You will review your application before it is sent.</p><Link className="btn alt" href={`/jobs/${params.id}/apply`}>Apply Now</Link></div>
        <AlertForm keywords={j.title} location={j.location || ''} /></aside></div></div></main></>);
}
