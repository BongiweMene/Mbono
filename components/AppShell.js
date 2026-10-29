'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import '@/app/shell.css';
const D = ['/dashboard', '🏠 Dashboard'], P = ['/dashboard/profile', '👤 My profile'], S = ['/support', '🎧 Support tickets'];
const NAV = { candidate: [D, P], recruiter: [D], hiring_manager: [D], interviewer: [D], admin: [D, S], support: [S] };
const LABEL = { candidate: 'Candidate', recruiter: 'Recruiter', hiring_manager: 'Hiring manager', interviewer: 'Interviewer', admin: 'Administrator', support: 'Support' };
export default function AppShell({ children }) {
  const [u, setU] = useState(), [open, setOpen] = useState(false), path = usePathname(), r = useRouter();
  useEffect(() => { fetch('/api/auth').then((x) => x.json()).then((d) => (d.user ? setU(d.user) : r.push('/login'))); }, []);
  useEffect(() => setOpen(false), [path]);
  async function out() { await fetch('/api/auth', { method: 'POST', body: JSON.stringify({ mode: 'logout' }) }); r.push('/login'); r.refresh(); }
  if (!u) return <p className="wrap">Loading…</p>;
  return (<div className="shell">
    <div className="topbar"><button aria-label="Open menu" aria-expanded={open} onClick={() => setOpen(!open)}>☰</button><span>Mbono Career Goals</span></div>
    <aside className={'side-nav' + (open ? ' open' : '')}>
      <Link href="/" className="sn-brand"><img src="/logo-mark.png" alt="" />Mbono Career Goals</Link>
      <nav aria-label="Main">{(NAV[u.role] || NAV.candidate).map(([h, l]) => <Link key={h} href={h} className={path === h ? 'on' : ''} aria-current={path === h ? 'page' : undefined}>{l}</Link>)}
        <Link href="/">🌐 Home page</Link><a href="https://www.mbono.co.za/contact" target="_blank" rel="noopener noreferrer">✉️ Contact Mbono</a></nav>
      <div className="sn-user"><b>{u.name}</b><span>{LABEL[u.role] || u.role}</span><button onClick={out}>Log out</button></div>
    </aside>
    {open && <div className="sn-scrim" onClick={() => setOpen(false)} />}
    <div className="shell-main">{children}</div>
  </div>);
}
