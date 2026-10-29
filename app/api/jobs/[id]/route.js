import mongoose from 'mongoose';
import { db } from '@/lib/db';
import { Job } from '@/lib/models';
import { me, json } from '@/lib/auth';
export async function GET(_, { params }) {
  if (!mongoose.isValidObjectId(params.id)) return json({ error: 'Not found' }, 404);
  await db(); const u = await me(); const j = await Job.findById(params.id).lean();
  const staff = u && ['recruiter', 'hiring_manager', 'admin'].includes(u.role);
  return !j || (j.status !== 'open' && !staff) ? json({ error: 'Not found' }, 404) : json(j);
}
