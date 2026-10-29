import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { db } from './db';
import { User, Audit } from './models';
const key = () => new TextEncoder().encode(process.env.JWT_SECRET);
export const sign = (u) => new SignJWT({ id: String(u._id), role: u.role }).setProtectedHeader({ alg: 'HS256' }).setExpirationTime('7d').sign(key());
export async function me() {
  try { const t = cookies().get('t')?.value; if (!t) return null; const { payload } = await jwtVerify(t, key()); await db(); return await User.findOne({ _id: payload.id, active: { $ne: false } }).select('-password -cvData -cvContentType'); } catch { return null; }
}
export const log = (user, action) => Audit.create({ user, action });
export const json = (d, s = 200) => Response.json(d, { status: s });
export const deny = () => json({ error: 'Not allowed' }, 403);
