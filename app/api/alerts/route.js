import { db } from '@/lib/db';
import { JobAlert } from '@/lib/extra';
import { json } from '@/lib/auth';
export async function POST(req) {
  const b = await req.json();
  if (!/^\S+@\S+\.\S+$/.test(b.email || '')) return json({ error: 'Enter a valid email address.' }, 400);
  if (!b.ok) return json({ error: 'Please tick the box to agree to receive alerts.' }, 400);
  await db(); const q = { email: b.email.slice(0, 120), keywords: String(b.keywords || '').slice(0, 100), location: String(b.location || '').slice(0, 100) };
  await JobAlert.findOneAndUpdate(q, q, { upsert: true }); return json({ ok: true });
}
