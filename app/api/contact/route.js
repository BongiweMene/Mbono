import { db } from '@/lib/db';
import { Contact } from '@/lib/models';
import { log, json } from '@/lib/auth';

export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Your message could not be read. Please check the form and try again.' }, 400);
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return json({ error: 'Enter your name, a valid email and a message.' }, 400);
  }
  const fields = ['name', 'email', 'phone', 'subject', 'message'];
  if (fields.some((field) => body[field] !== undefined && typeof body[field] !== 'string')) {
    return json({ error: 'Check the contact form fields and submit them as text.' }, 400);
  }
  const name = (body.name || '').trim();
  const email = (body.email || '').trim().toLowerCase();
  const message = (body.message || '').trim();
  if (!name || name.length > 100 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 120
    || !message || message.length > 3000 || (body.phone || '').length > 30 || (body.subject || '').length > 150) {
    return json({ error: 'Enter a name (up to 100 characters), valid email, and message (up to 3,000 characters). Check that phone and subject are within their limits.' }, 400);
  }
  await db();
  await Contact.create({
    name,
    email,
    phone: (body.phone || '').trim(),
    subject: (body.subject || '').trim(),
    message,
  });
  await log(email, 'public contact message submitted');
  return json({ ok: true }, 201);
}
