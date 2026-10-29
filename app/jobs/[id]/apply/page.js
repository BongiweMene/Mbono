'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import SiteHeader from '@/components/SiteHeader';
import AlertForm from '@/components/AlertForm';
import '@/app/extra.css';
export default function Review() {
  const { id } = useParams(), r = useRouter();
  const [u, setU] = useState(), [j, setJ] = useState(), [cl, setCl] = useState(''), [ans, setAns] = useState([]), [ok, setOk] = useState(false), [err, setErr] = useState(''), [ref, setRef] = useState(''), [busy, setBusy] = useState(false);
  useEffect(() => { (async () => {
    const { user } = await (await fetch('/api/auth')).json(); if (!user) return r.push('/login');
    setU(user); const jr = await fetch('/api/jobs/' + id); setJ(jr.ok ? await jr.json() : null);
  })(); }, []);
  if (!u || j === undefined) return <p className="wrap">Loading…</p>;
  if (!j) return <><SiteHeader /><main className="wrap sec"><h1>Vacancy not found</h1></main></>;
  const qs = j.questions || [];
  const items = [['Full name', u.name], ['Email', u.email], ['Phone number', u.phone], ['Skills', u.skills?.length], ...qs.map((q, i) => [q, ans[i]?.trim()])];
  const pct = Math.round((items.filter((x) => x[1]).length / items.length) * 100);
  async function submit() {
    setBusy(true); setErr('');
    const d = await (await fetch('/api/apply', { method: 'POST', body: JSON.stringify({ jobId: id, coverLetter: cl, answers: ans, consent: ok }) })).json();
    setBusy(false); d.error ? setErr(d.error) : setRef(d.ref);
  }
  if (ref) return (<><SiteHeader /><main className="wrap sec"><div className="card"><h1>Application submitted</h1><p role="status">Thank you, {u.name}. Your application for <b>{j.title}</b> has been received. Your reference is <b>{ref}</b>.</p>
    <p>Mbono recruiters can now see it. Track the status on your dashboard.</p><Link className="btn" href="/dashboard">Go to dashboard</Link></div><AlertForm keywords={j.title} location={j.location || ''} /></main></>);
  return (<><SiteHeader /><main className="wrap sec"><h1>Review your application</h1>
    <div className="card"><h3>{j.title}</h3><p>{j.company || 'Mbono'} · {j.location} · {j.workMode || 'On-site'}</p>
      <div className="row"><b>Application completion</b><b>{pct}%</b></div><div className="bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}><i style={{ width: pct + '%' }} /></div></div>
    <div className="card"><h3>Your details</h3><ul className="chk">{items.slice(0, 4).map(([k, v]) => <li key={k} className={v ? 'ok' : 'no'}>{k}: {k === 'Skills' ? (u.skills || []).join(', ') || 'Missing' : v || 'Missing'}</li>)}</ul>
      <p><b>CV / résumé:</b> {u.cvName || 'No CV file yet. Your profile details will be shared instead.'}</p><Link className="btn sm ghost" href="/dashboard/profile">Edit profile</Link></div>
    <div className="card"><h3>Cover letter (optional)</h3><textarea rows={4} value={cl} onChange={(e) => setCl(e.target.value)} placeholder="Tell us why you are a good fit." />
      {qs.map((q, i) => <label key={i}>{q}<textarea rows={2} value={ans[i] || ''} onChange={(e) => { const a = [...ans]; a[i] = e.target.value; setAns(a); }} /></label>)}</div>
    <div className="warn"><b>Before you submit:</b> you may not be able to edit your application after it is sent. Please check everything above.</div>
    <label><input type="checkbox" style={{ width: 'auto' }} checked={ok} onChange={(e) => setOk(e.target.checked)} /> I confirm my information is correct. I agree that Mbono recruiters and the hiring team for this vacancy may view my profile, answers and CV, as described in the <Link href="/legal/privacy" target="_blank"><u>Privacy Policy</u></Link>, <Link href="/legal/terms" target="_blank"><u>Terms and Conditions</u></Link> and <Link href="/legal/cookies" target="_blank"><u>Cookie Policy</u></Link>.</label>
    {err && <p className="err" role="alert">{err}</p>}
    <div className="row" style={{ marginTop: 14 }}><Link className="btn ghost" href={`/jobs/${id}`}>← Go back</Link><button className="btn alt" disabled={pct < 100 || !ok || busy} onClick={submit}>{busy ? 'Submitting…' : 'Submit application'}</button></div>
    {pct < 100 && <p className="err">Complete the missing items (use Edit profile) to enable submit.</p>}</main></>);
}
