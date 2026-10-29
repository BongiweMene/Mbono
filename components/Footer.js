import Link from 'next/link';
const units = [['BPO Link', 'https://www.mbono.co.za/bpo-link', '#2B3FBF'], ['Career Goals', 'https://www.mbono.co.za/career-goals', '#0F4C3A'], ['DigiGoals', 'https://www.mbono.co.za/digigoals', '#B4432F'], ['MCX Connect', 'https://www.mbono.co.za/mcx-connect', '#E0B43C']];
export default function Footer() {
  return (<footer className="foot"><div className="wrap">
    <div className="fg">
      <div><span className="brand"><img src="/logo-mark.png" alt="" />Professional Mbono Services</span><p>A purpose-led workforce solutions and business enablement company unlocking human potential across the Eastern Cape.</p></div>
      <div><h4>Company</h4><Link href="/">Home</Link><Link href="/contact">Contact</Link><Link href="/login">Log in</Link></div>
      <div><h4>Business units</h4>{units.map(([n, u, c]) => <a className="bu" key={n} href={u} target="_blank" rel="noopener noreferrer"><i style={{ background: c }} />{n}</a>)}</div>
      <div><h4>Get in touch</h4><a href="mailto:info@mbono.co.za">info@mbono.co.za</a><a href="tel:+27418800086">+27 (0)41 880 0086</a><p>19 Oakworth Road, Harbour View Building, South End, Gqeberha, South Africa, 6001</p></div>
    </div>
    <div className="fb"><span>© 2026 Professional Mbono Services. All rights reserved.</span><span><Link href="/legal/privacy" style={{ display: 'inline', marginRight: 20 }}>Privacy Policy</Link><Link href="/legal/terms" style={{ display: 'inline', marginRight: 20 }}>Terms &amp; Conditions</Link><Link href="/legal/cookies" style={{ display: 'inline' }}>Cookie Policy</Link></span></div>
  </div></footer>);
}
