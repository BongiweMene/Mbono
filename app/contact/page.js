import SiteHeader from '@/components/SiteHeader';
import './contact.css';
export const metadata = { title: 'Contact | Mbono Career Goal' };
// Paste your official social media links here. A button only shows when its link is filled in.
const SOCIALS = [['Facebook', ''], ['Instagram', ''], ['LinkedIn', '']];
const ADDRESS = '19 Oakworth Road, Harbour View Building, South End, Gqeberha, South Africa, 6001';
export default function Contact() {
  const socials = SOCIALS.filter(([, u]) => u);
  return (<><SiteHeader /><main className="ct">
    <h1>Contact us</h1><p className="sub">We would love to hear from you.</p>
    <section className="cc"><p className="lab">Address</p><p className="big">{ADDRESS}</p>
      <p style={{ marginTop: 8 }}><a href={'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(ADDRESS)} target="_blank" rel="noopener noreferrer"><u>View on Google Maps</u></a></p></section>
    {socials.length > 0 && <section className="cc"><p className="lab">Follow us</p><div className="soc">{socials.map(([n, u]) => <a key={n} href={u} target="_blank" rel="noopener noreferrer">{n}</a>)}</div></section>}
    <section className="cc"><p className="lab">Phone number</p><a className="big" href="tel:+27418800086">+27 (0)41 880 0086</a></section>
    <section className="cc"><p className="lab">Email address</p><a className="big" href="mailto:info@mbono.co.za">info@mbono.co.za</a></section>
  </main></>);
}
