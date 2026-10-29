'use client';
import { useEffect, useRef, useState } from 'react';
import '@/app/extra.css';
const post = (b) => fetch('/api/chat', { method: 'POST', body: JSON.stringify(b) }).then((r) => r.json());
export default function Chatbot() {
  const [open, setOpen] = useState(false), [msgs, setM] = useState([]), [quick, setQ] = useState([]), [collect, setC] = useState(false), [f, setF] = useState({}), [v, setV] = useState(''), [err, setErr] = useState(''), [busy, setB] = useState(false), sid = useRef(''), end = useRef(null);
  useEffect(() => { sid.current = sessionStorage.getItem('mbsid') || crypto.randomUUID(); sessionStorage.setItem('mbsid', sid.current); }, []);
  const apply = (r) => { setM((m) => [...m, ...r.messages]); setQ(r.quick || []); setC(!!r.collect); };
  useEffect(() => { if (open && !msgs.length) (async () => { const h = await (await fetch('/api/chat?sid=' + sid.current)).json(); if (h.messages.length) { setM(h.messages); setQ(h.quick || []); setC(!!h.collect); } else apply(await post({ sid: sid.current })); })(); }, [open]);
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); }, [msgs, collect]);
  async function send(b, label) {
    if (label) setM((m) => [...m, { from: 'user', text: label }]);
    setB(true); setV(''); const r = await post({ sid: sid.current, ...b }); setB(false);
    r.error ? setErr(r.error) : (setErr(''), apply(r));
  }
  return (<>
    <button className="chat-fab" onClick={() => setOpen(!open)} aria-label="Open chat">💬</button>
    {open && <div className="chat" role="dialog" aria-label="Chat"><div className="chat-h">Mbo · automated assistant</div>
      <div className="chat-b" aria-live="polite">{msgs.map((m, i) => <p key={i} className={m.from === 'user' ? 'me' : m.from === 'system' ? 'msys' : 'bot'}>{m.from === 'bot' && <span className="lbl">Automated assistant</span>}{m.text}</p>)}<div ref={end} /></div>
      {!collect && <div className="quick">{quick.map((q) => <button key={q.l} disabled={busy} onClick={() => send(q.a ? { action: q.a } : { text: q.t }, q.l)}>{q.l}</button>)}</div>}
      {collect && <div className="cform"><small>We use these details only to follow up on this request.</small>
        {[['name', 'Your name'], ['phone', 'Phone number'], ['email', 'Email address']].map(([k, p]) => <input key={k} placeholder={p} onChange={(e) => setF({ ...f, [k]: e.target.value })} />)}
        <textarea rows={2} placeholder="Describe the problem" onChange={(e) => setF({ ...f, issue: e.target.value })} />
        {err && <p className="err" role="alert">{err}</p>}<button className="btn sm" disabled={busy} onClick={() => send({ action: 'escalate', contact: f })}>Send to support</button></div>}
      {!collect && <div className="chat-f"><input aria-label="Message" value={v} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && v.trim() && send({ text: v }, v)} placeholder="Type your question" /><button className="btn" disabled={busy || !v.trim()} onClick={() => send({ text: v }, v)}>Send</button></div>}
      {!collect && <button className="link" onClick={() => send({ action: 'no' }, 'I would like to speak to a person')}>Talk to a person</button>}
    </div>}
  </>);
}
