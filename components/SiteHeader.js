'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
export default function SiteHeader() {
  const [u, setU] = useState(null), r = useRouter();
  useEffect(() => { fetch('/api/auth').then((x) => x.json()).then((d) => setU(d.user || null)).catch(() => {}); }, []);
  async function out() { await fetch('/api/auth', { method: 'POST', body: JSON.stringify({ mode: 'logout' }) }); setU(null); r.push('/login'); r.refresh(); }
  return (<header className="sh"><div className="wrap">
    <Link href="/" className="brand"><img src="/logo-mark.png" alt="" />Mbono Career Goals</Link>
    <div className="links"><Link className="l" href="/">Home</Link><Link className="l" href="/contact">Contact</Link>
      {u ? <><Link className="l" href={u.role === 'support' ? '/support' : '/dashboard'}>My dashboard</Link><button className="btn" onClick={out}>Log out</button></> : <Link className="btn" href="/login">Log in</Link>}</div>
  </div></header>);
}
