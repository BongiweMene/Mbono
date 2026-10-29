'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import SiteHeader from '@/components/SiteHeader';
import '@/app/extra.css';
const S = ['Open', 'Assigned', 'In Progress', 'Awaiting User Response', 'Resolved'];
const CANNED = ['Hi, thanks for contacting Mbono. We are looking into this and will update you shortly.', 'Please reply with a screenshot or a few more details so we can help.', 'This has been resolved. Please tell us if it happens again.'];
const api = (b) => fetch('/api/tickets', { method: 'PATCH', body: JSON.stringify(b) }).then((r) => r.json());
const Tile = ({ n, t }) => <div className="stat"><b>{n}</b>{t}</div>;
export default function Support() {
  const [d, setD] = useState(), [show, setShow] = useState(), [note, setNote] = useState({}), [fs, setFs] = useState('Unresolved'), [q, setQ] = useState(''), r = useRouter();
  const load = async () => { const x = await fetch('/api/tickets'); if (!x.ok) return r.push('/login'); setD(await x.json()); };
  useEffect(() => { load(); }, []);
  if (!d) return <p className="wrap">Loading…</p>;
  const adm = d.role === 'admin', st = d.stats, week = Date.now() - 7 * 864e5;
  const mine = d.tickets.filter((t) => t.assignee?._id === d.me);
  const overdue = (t) => ['Open', 'Assigned'].includes(t.status) && !t.firstResponseAt && Date.now() - new Date(t.createdAt) > 864e5;
  const list = d.tickets.filter((t) => (fs === 'Unresolved' ? t.status !== 'Resolved' : fs === 'All' || t.status === fs) && (!q || (t.number + t.name + t.email).toLowerCase().includes(q.toLowerCase())));
  async function act(b) { const x = await api(b); if (x.error) alert(x.error); load(); }
  async function setStatus(t, s) {
    let n; if (s === 'Resolved' && !t.notes.length) { n = window.prompt('Add a short resolution note (required)'); if (!n) return; }
    act({ id: t._id, status: s, note: n });
  }
  return (<><SiteHeader /><main className="wrap sec"><h1>Support tickets</h1>
    {adm ? <><div className="stats"><Tile n={st.unresolved} t="unresolved" /><Tile n={st.unassigned} t="unassigned" /><Tile n={st.resolvedThisWeek} t="resolved this week" /><Tile n={st.avgFirstResponseHours ?? '–'} t="avg first response (h)" /><Tile n={st.oldestDays} t="oldest open (days)" /></div>
      <div className="card"><b>Agent workload (open tickets):</b> {Object.entries(st.workload).map(([n, c]) => <span className="tag" key={n} style={{ marginLeft: 6 }}>{n}: {c}</span>)}{!Object.keys(st.workload).length && ' none'}</div></>
      : <div className="stats"><Tile n={mine.filter((t) => t.status !== 'Resolved').length} t="my open tickets" /><Tile n={mine.filter((t) => t.status === 'Awaiting User Response').length} t="awaiting user" /><Tile n={mine.filter((t) => t.resolvedAt && new Date(t.resolvedAt) > week).length} t="resolved this week" /><Tile n={d.tickets.filter((t) => !t.assignee).length} t="unclaimed in queue" /></div>}
    <div className="row" style={{ margin: '14px 0' }}><input style={{ flex: 1 }} aria-label="Search tickets" placeholder="Search by ticket number, name or email" value={q} onChange={(e) => setQ(e.target.value)} />
      <select style={{ width: 210 }} aria-label="Filter by status" value={fs} onChange={(e) => setFs(e.target.value)}>{['Unresolved', 'All', ...S].map((s) => <option key={s}>{s}</option>)}</select></div>
    {list.length === 0 && <p>No tickets match.</p>}
    {list.map((t) => <div className={'card tk ' + t.status.replace(/ /g, '')} key={t._id}>
      <div className="row"><div><b>{t.number}</b> <span className="tag">{t.status}</span> {t.queued && <span className="tag">queued</span>} {overdue(t) && <span className="tag" style={{ background: '#FBE3DE', color: '#B4432F' }}>Overdue 24h+</span>}
        <br /><small>{new Date(t.createdAt).toLocaleString('en-ZA')} · {t.name} · <a href={'tel:' + t.phone}><u>Call {t.phone}</u></a> · <a href={'mailto:' + t.email + '?subject=' + encodeURIComponent('Mbono support ' + t.number)}><u>Email</u></a> · {t.assignee?.name || 'Unassigned'}</small></div>
        <span>{!t.assignee && !adm && <button className="btn sm alt" onClick={() => act({ id: t._id, claim: true })}>Claim ticket</button>}
          {adm && <select style={{ width: 170 }} aria-label="Assign" value={t.assignee?._id || ''} onChange={(e) => act({ id: t._id, assignee: e.target.value })}><option value="">Unassigned</option>{d.agents.map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}</select>}
          {(adm || t.assignee) && <select style={{ width: 190 }} aria-label="Status" value={t.status} onChange={(e) => setStatus(t, e.target.value)}>{S.map((s) => <option key={s}>{s}</option>)}</select>}</span></div>
      <p>{t.issue}</p><button className="link" onClick={() => setShow(show === t._id ? null : t._id)}>{show === t._id ? 'Hide' : 'View'} chat history</button>
      {show === t._id && <div className="tr">{t.transcript.map((m, i) => <div key={i}><b>{m.from}:</b> {m.text}</div>)}</div>}
      {t.notes.map((n, i) => <div className="tr" key={i}><b>{n.by}</b>: {n.text}</div>)}
      {(adm || t.assignee?._id === d.me) && <div className="row"><input style={{ flex: 1 }} placeholder="Add a note or follow-up" value={note[t._id] || ''} onChange={(e) => setNote({ ...note, [t._id]: e.target.value })} />
        <select style={{ width: 150 }} aria-label="Canned reply" value="" onChange={(e) => setNote({ ...note, [t._id]: e.target.value })}><option value="">Quick reply…</option>{CANNED.map((c, i) => <option key={i} value={c}>{c.slice(0, 30)}…</option>)}</select>
        <button className="btn sm" onClick={async () => { if (!note[t._id]) return; await act({ id: t._id, note: note[t._id] }); setNote({ ...note, [t._id]: '' }); }}>Add note</button></div>}
    </div>)}
  </main></>);
}
