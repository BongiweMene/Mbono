import { db } from '@/lib/db';
import { Application, Job } from '@/lib/models';
import { me, log, json, deny } from '@/lib/auth';
export async function POST(req) {
  await db(); const u = await me(); if (!u || u.role !== 'candidate') return deny();
  const { jobId, coverLetter = '', answers = [], consent } = await req.json();
  if (!consent) return json({ error: 'Please accept the privacy notice to submit.' }, 400);
  const job = await Job.findOne({ _id: jobId, status: 'open' }); if (!job) return json({ error: 'This vacancy is no longer open.' }, 400);
  if (!u.name || !u.email || !u.phone || !u.skills?.length) return json({ error: 'Complete your profile (name, phone and skills) first.' }, 400);
  if ((job.questions || []).some((_, i) => !String(answers[i] || '').trim())) return json({ error: 'Please answer every employer question.' }, 400);
  if (await Application.findOne({ job: jobId, candidate: u._id })) return json({ error: 'You have already applied for this vacancy.' }, 400);
  const have = u.skills.map((s) => s.toLowerCase());
  const score = job.skills?.length ? Math.round((job.skills.filter((s) => have.includes(s.toLowerCase())).length / job.skills.length) * 100) : 50;
  const text = [coverLetter.slice(0, 3000), ...(job.questions || []).map((q, i) => `Q: ${q}\nA: ${String(answers[i]).slice(0, 1500)}`)].filter(Boolean).join('\n\n');
  const a = await Application.create({ job: jobId, candidate: u._id, coverLetter: text, score });
  await log(u.email, `submitted application ${a._id} for ${job.title} (consent given)`);
  return json({ ref: 'APP-' + String(a._id).slice(-6).toUpperCase() });
}
