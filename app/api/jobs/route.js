import mongoose from 'mongoose';
import { db } from '@/lib/db';
import { Job, Notification } from '@/lib/models';
import { me, log, json, deny } from '@/lib/auth';

const staff = ['recruiter', 'hiring_manager', 'admin'];
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const departmentPattern = (department) => new RegExp(`^${escapeRegex(department.trim())}$`, 'i');
const validString = (value, max) => typeof value === 'string' && value.trim().length > 0 && value.trim().length <= max;

async function readBody(req) {
  try {
    const body = await req.json();
    return body && typeof body === 'object' && !Array.isArray(body) ? body : null;
  } catch {
    return null;
  }
}

export async function GET(req) {
  await db();
  const user = await me();
  const params = new URL(req.url).searchParams;
  const query = {};
  if (!user || !staff.includes(user.role)) query.status = 'open';
  if (user?.role === 'recruiter') query.createdBy = user._id;
  if (user?.role === 'hiring_manager') {
    query.department = user.department?.trim() ? departmentPattern(user.department) : { $in: [] };
  }
  for (const [param, field] of [['location', 'location'], ['industry', 'industry'], ['type', 'type'], ['department', 'department'], ['q', 'title']]) {
    const value = params.get(param)?.trim();
    if (value) {
      if (value.length > 100) return json({ error: `The ${param} filter must be 100 characters or fewer.` }, 400);
      const filter = new RegExp(escapeRegex(value), 'i');
      if (field === 'department' && user?.role === 'hiring_manager') {
        query.$and = [...(query.$and || []), { department: query.department }, { department: filter }];
        delete query.department;
      } else {
        query[field] = filter;
      }
    }
  }
  const fields = ['recruiter', 'hiring_manager', 'admin'].includes(user?.role) ? undefined : '-approvalComment';
  return json(await Job.find(query).select(fields).sort('-createdAt').limit(100));
}

export async function POST(req) {
  await db();
  const user = await me();
  if (!user || !['recruiter', 'admin'].includes(user.role)) return deny();

  const body = await readBody(req);
  if (!body) return json({ error: 'Your vacancy details could not be read. Please submit the form again.' }, 400);
  if (body.duplicateId !== undefined) {
    if (Object.keys(body).some((key) => key !== 'duplicateId')) {
      return json({ error: 'A duplication request can only include the source vacancy.' }, 400);
    }
    if (typeof body.duplicateId !== 'string' || !mongoose.isValidObjectId(body.duplicateId)) {
      return json({ error: 'Choose a valid vacancy to duplicate.' }, 400);
    }
    const source = await Job.findOne({ _id: body.duplicateId, createdBy: user._id });
    if (!source) return json({ error: 'You can only duplicate your own vacancies.' }, 404);
    const duplicate = await Job.create({
      title: `Copy of ${source.title}`.slice(0, 160),
      company: source.company,
      location: source.location,
      industry: source.industry,
      department: source.department,
      type: source.type,
      salary: source.salary,
      skills: source.skills,
      description: source.description,
      deadline: source.deadline,
      createdBy: user._id,
      status: 'pending',
    });
    await log(user.email, `job duplicated ${source._id} as ${duplicate._id}`);
    return json(duplicate, 201);
  }
  const stringFields = {
    title: 160,
    location: 160,
    industry: 120,
    type: 80,
    salary: 100,
    description: 5000,
    department: 120,
  };
  for (const [field, max] of Object.entries(stringFields)) {
    if (body[field] !== undefined && (typeof body[field] !== 'string' || body[field].length > max)) {
      return json({ error: `${field} must be ${max} characters or fewer.` }, 400);
    }
  }
  if (!validString(body.title, 160) || !validString(body.location, 160) || !validString(body.type, 80) || !validString(body.description, 5000)) {
    return json({ error: 'Enter a job title, location, employment type and description to post a vacancy.' }, 400);
  }
  if (body.deadline && (typeof body.deadline !== 'string' || Number.isNaN(Date.parse(body.deadline)))) {
    return json({ error: 'Enter a valid vacancy deadline.' }, 400);
  }
  if (body.skills !== undefined && typeof body.skills !== 'string' && !Array.isArray(body.skills)) {
    return json({ error: 'Enter skills as a comma-separated list.' }, 400);
  }
  const rawSkills = Array.isArray(body.skills) ? body.skills : (body.skills || '').split(',');
  if (rawSkills.length > 50 || rawSkills.some((skill) => typeof skill !== 'string' || skill.length > 80)) {
    return json({ error: 'Add no more than 50 skills, with each skill under 80 characters.' }, 400);
  }

  const job = await Job.create({
    title: body.title.trim(),
    location: body.location.trim(),
    industry: (body.industry || '').trim(),
    type: body.type.trim(),
    salary: (body.salary || '').trim(),
    description: body.description.trim(),
    department: (body.department || '').trim(),
    deadline: body.deadline ? new Date(body.deadline) : undefined,
    skills: [...new Set(rawSkills.map((skill) => skill.trim().toLowerCase()).filter(Boolean))],
    createdBy: user._id,
    status: 'pending',
  });
  await log(user.email, `job created ${job.title}`);
  return json(job, 201);
}

export async function PATCH(req) {
  await db();
  const user = await me();
  if (!user || !staff.includes(user.role)) return deny();
  if (user.role === 'admin') {
    await log(user.email, 'administrator attempted direct vacancy update');
    return deny();
  }

  const body = await readBody(req);
  if (!body || typeof body.id !== 'string' || !mongoose.isValidObjectId(body.id)) {
    return json({ error: 'Choose a valid vacancy to update.' }, 400);
  }

  const job = await Job.findById(body.id);
  if (!job) return json({ error: 'That vacancy could not be found.' }, 404);
  if (user.role === 'recruiter' && String(job.createdBy) !== String(user._id)) return deny();
  if (user.role === 'hiring_manager'
    && (!user.department?.trim() || !departmentPattern(user.department).test(job.department || ''))) return deny();

  if (body.status !== undefined) {
    const approvalAction = ['open', 'changes_requested'].includes(body.status);
    if (Object.keys(body).some((key) => !['id', 'status', 'comment'].includes(key))
      || !['open', 'closed', 'changes_requested'].includes(body.status)) {
      return json({ error: 'Choose an allowed vacancy status.' }, 400);
    }
    if (approvalAction && user.role !== 'hiring_manager') return deny();
    if (approvalAction && !['pending', 'changes_requested'].includes(job.status)) {
      return json({ error: 'Only pending vacancies can be approved or returned for changes.' }, 400);
    }
    if (body.status === 'changes_requested' && (typeof body.comment !== 'string' || !body.comment.trim() || body.comment.trim().length > 2000)) {
      return json({ error: 'Add a comment of up to 2,000 characters explaining what needs to change.' }, 400);
    }
    if (body.status === 'closed' && job.status === 'closed') {
      return json({ error: 'This vacancy is already closed.' }, 400);
    }
    job.status = body.status;
    if (body.status === 'changes_requested') job.approvalComment = body.comment.trim();
    if (body.status === 'open') job.approvalComment = '';
    await job.save();
    if (job.createdBy && approvalAction) {
      await Notification.create({
        user: job.createdBy,
        text: body.status === 'open'
          ? `Your vacancy "${job.title}" has been approved and is now open.`
          : `Changes were requested for "${job.title}": ${job.approvalComment}`,
      });
    }
    await log(user.email, body.status === 'changes_requested'
      ? `job ${job._id} changes requested: ${job.approvalComment}`
      : `job ${job._id} -> ${job.status}`);
    return json(job);
  }

  if (user.role !== 'recruiter') return deny();
  const allowedFields = ['title', 'location', 'industry', 'type', 'salary', 'description', 'department', 'deadline', 'skills'];
  if (Object.keys(body).some((key) => !['id', ...allowedFields].includes(key))) {
    return json({ error: 'The vacancy update contains unsupported fields.' }, 400);
  }
  const limits = { title: 160, location: 160, industry: 120, type: 80, salary: 100, description: 5000, department: 120 };
  for (const [field, max] of Object.entries(limits)) {
    if (body[field] !== undefined && (typeof body[field] !== 'string' || body[field].length > max)) {
      return json({ error: `${field} must be ${max} characters or fewer.` }, 400);
    }
  }
  for (const field of ['title', 'location', 'type', 'description']) {
    const value = body[field] === undefined ? job[field] : body[field];
    if (!validString(value, limits[field])) return json({ error: `Enter a valid ${field}.` }, 400);
  }
  if (body.deadline !== undefined && body.deadline !== '' && (typeof body.deadline !== 'string' || Number.isNaN(Date.parse(body.deadline)))) {
    return json({ error: 'Enter a valid vacancy deadline.' }, 400);
  }
  if (body.skills !== undefined && typeof body.skills !== 'string' && !Array.isArray(body.skills)) {
    return json({ error: 'Enter skills as a comma-separated list.' }, 400);
  }
  const rawSkills = body.skills === undefined
    ? job.skills || []
    : Array.isArray(body.skills) ? body.skills : body.skills.split(',');
  if (rawSkills.length > 50 || rawSkills.some((skill) => typeof skill !== 'string' || skill.length > 80)) {
    return json({ error: 'Add no more than 50 skills, with each skill under 80 characters.' }, 400);
  }
  for (const field of Object.keys(limits)) {
    if (body[field] !== undefined) job[field] = body[field].trim();
  }
  if (body.deadline !== undefined) job.deadline = body.deadline ? new Date(body.deadline) : undefined;
  if (body.skills !== undefined) job.skills = [...new Set(rawSkills.map((skill) => skill.trim().toLowerCase()).filter(Boolean))];
  await job.save();
  await log(user.email, `job ${job._id} edited`);
  return json(job);
}
