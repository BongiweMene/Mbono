import mongoose from 'mongoose';
import { db } from '@/lib/db';
import { Job } from '@/lib/models';
import { me, log, json, deny } from '@/lib/auth';

export async function GET() {
  await db();
  const user = await me();
  if (!user || user.role !== 'candidate') return deny();
  const jobs = await Job.find({ _id: { $in: user.savedJobs || [] }, status: 'open' })
    .select('title location industry type salary skills deadline')
    .sort('-createdAt')
    .limit(100);
  return json({ jobs });
}

export async function POST(req) {
  await db();
  const user = await me();
  if (!user || user.role !== 'candidate') return deny();

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Your saved-job request could not be read. Please try again.' }, 400);
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)
    || typeof body.jobId !== 'string' || !mongoose.isValidObjectId(body.jobId) || typeof body.saved !== 'boolean') {
    return json({ error: 'Choose a valid job and whether you want to save or remove it.' }, 400);
  }
  if (body.saved && !await Job.exists({ _id: body.jobId, status: 'open' })) {
    return json({ error: 'Only open vacancies can be saved.' }, 404);
  }

  await user.updateOne(body.saved
    ? { $addToSet: { savedJobs: body.jobId } }
    : { $pull: { savedJobs: body.jobId } });
  await log(user.email, `${body.saved ? 'saved' : 'removed saved'} job ${body.jobId}`);
  return json({ saved: body.saved });
}
