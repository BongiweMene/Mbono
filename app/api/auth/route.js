import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';
import { User } from '@/lib/models';
import { sign, me, log, json } from '@/lib/auth';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function readBody(req) {
  try {
    const body = await req.json();
    return body && typeof body === 'object' && !Array.isArray(body) ? body : null;
  } catch {
    return null;
  }
}

export async function GET() {
  return json({ user: await me() });
}

export async function POST(req) {
  await db();
  const body = await readBody(req);
  if (!body || typeof body.mode !== 'string') {
    return json({ error: 'Your request could not be read. Please try again.' }, 400);
  }

  if (body.mode === 'logout') {
    const user = await me();
    cookies().delete('t');
    if (user) await log(user.email, 'logout');
    return json({ ok: true });
  }
  if (!['login', 'register'].includes(body.mode)) {
    return json({ error: 'Choose a valid account action.' }, 400);
  }
  if (typeof body.email !== 'string' || !emailPattern.test(body.email.trim()) || body.email.trim().length > 254
    || typeof body.password !== 'string' || body.password.length < 8 || body.password.length > 128) {
    return json({ error: 'Enter a valid email address and a password between 8 and 128 characters.' }, 400);
  }

  const email = body.email.trim().toLowerCase();
  let user;
  if (body.mode === 'register') {
    if (typeof body.name !== 'string' || !body.name.trim() || body.name.trim().length > 120) {
      return json({ error: 'Enter your full name using no more than 120 characters.' }, 400);
    }
    if (body.consent !== true) return json({ error: 'Please accept the privacy policy (POPIA) to continue.' }, 400);
    if (await User.findOne({ email }).select('_id')) return json({ error: 'That email is already registered.' }, 400);
    const adminEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
    user = await User.create({
      name: body.name.trim(),
      email,
      password: await bcrypt.hash(body.password, 10),
      consentPOPIA: true,
      role: email === adminEmail ? 'admin' : 'candidate',
    });
  } else {
    user = await User.findOne({ email });
    if (!user || user.active === false || !(await bcrypt.compare(body.password, user.password))) {
      await log(email, 'failed login attempt');
      return json({ error: 'Email or password is incorrect.' }, 401);
    }
  }

  await log(email, body.mode);
  cookies().set('t', await sign(user), { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 604800 });
  return json({ role: user.role });
}
