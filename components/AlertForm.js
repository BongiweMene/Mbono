'use client';
import { useState } from 'react';
export default function AlertForm({ keywords = '', location = '' }) {
  const [f, setF] = useState({ email: '', keywords, location, ok: false }), [m, setM] = useState('');
  async function go() {
    const d = await (await fetch('/api/alerts', { method: 'POST', body: JSON.stringify(f) })).json();
    setM(d.error || 'Saved. We will notify you about matching vacancies.');
  }
  return (<div className="card"><h3>Get job alerts</h3><p>Tell us what you are looking for.</p>
    <input type="email" placeholder="Email address" onChange={(e) => setF({ ...f, email: e.target.value })} />
    <input placeholder="Keywords, e.g. data analyst" defaultValue={keywords} onChange={(e) => setF({ ...f, keywords: e.target.value })} />
    <input placeholder="Preferred location" defaultValue={location} onChange={(e) => setF({ ...f, location: e.target.value })} />
    <label><input type="checkbox" style={{ width: 'auto' }} onChange={(e) => setF({ ...f, ok: e.target.checked })} /> I agree to receive job alert emails from Mbono. I can ask to stop at any time.</label>
    {m && <p role="status"><b>{m}</b></p>}<button className="btn sm" onClick={go}>Subscribe</button></div>);
}
