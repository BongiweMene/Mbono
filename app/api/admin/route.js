import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';
import { User, Job, Application, Audit, Contact, Notification, Chat } from '@/lib/models';
import { me, log, json, deny } from '@/lib/auth';

const roles = ['candidate', 'recruiter', 'hiring_manager', 'interviewer', 'admin'];
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

async function readBody(req) {
  try {
    const body = await req.json();
    return body && typeof body === 'object' && !Array.isArray(body) ? body : null;
  } catch {
    return null;
  }
}

function monthStart(monthsAgo = 5) {
  const date = new Date();
  date.setDate(1);
  date.setHours(0, 0, 0, 0);
  date.setMonth(date.getMonth() - monthsAgo);
  return date;
}

function monthLabel(dateValue) {
  return dateValue.toLocaleDateString('en-ZA', { month: 'short', year: 'numeric' });
}

function recentMonths(start) {
  return Array.from({ length: 6 }, (_, index) => {
    const date = new Date(start);
    date.setMonth(date.getMonth() + index);
    return { key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`, label: monthLabel(date) };
  });
}

async function applicationMonthly(field, start) {
  const rows = await Application.aggregate([
    { $match: { [field]: { $gte: start }, ...(field === 'updatedAt' ? { status: 'Hired' } : {}) } },
    { $group: { _id: { $dateToString: { format: '%Y-%m', date: `$${field}` } }, count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]);
  return new Map(rows.map((row) => [row._id, row.count]));
}

async function hireMonthly(start) {
  const rows = await Application.aggregate([
    { $match: { status: 'Hired', $expr: { $gte: [{ $ifNull: ['$hiredAt', '$updatedAt'] }, start] } } },
    { $group: { _id: { $dateToString: { format: '%Y-%m', date: { $ifNull: ['$hiredAt', '$updatedAt'] } } }, count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]);
  return new Map(rows.map((row) => [row._id, row.count]));
}

export async function GET(req) {
  await db();
  const user = await me();
  if (!user || !['admin', 'recruiter', 'hiring_manager'].includes(user.role)) return deny();

  if (user.role === 'recruiter') {
    const jobs = await Job.find({ createdBy: user._id }).select('_id');
    const jobIds = jobs.map((job) => job._id);
    const query = { job: { $in: jobIds } };
    const weekStart = new Date(Date.now() - 7 * 86400000);
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const [applications, activeCandidates, newApplicants, interviews, hires, activeVacancies] = await Promise.all([
      Application.find(query).select('status interviewDate scorecards'),
      Application.distinct('candidate', { ...query, status: { $nin: ['Hired', 'Rejected', 'Withdrawn'] } }),
      Application.countDocuments({ ...query, createdAt: { $gte: weekStart } }),
      Application.countDocuments({ ...query, status: 'Interview' }),
      Application.countDocuments({ ...query, status: 'Hired', $or: [{ hiredAt: { $gte: monthStart } }, { hiredAt: { $exists: false }, updatedAt: { $gte: monthStart } }] }),
      Job.countDocuments({ createdBy: user._id, status: 'open' }),
    ]);
    const overdueFeedback = applications.filter((application) => application.status === 'Interview'
      && application.interviewDate < new Date() && !(application.scorecards || []).length).length;
    return json({
      stats: {
        vacancies: jobs.length,
        activeVacancies,
        applications: applications.length,
        activeCandidates: activeCandidates.length,
        newApplicants,
        interviewsScheduled: interviews,
        hiresThisMonth: hires,
      },
      overdueFeedback,
    });
  }
  if (user.role === 'hiring_manager') {
    const department = user.department?.trim();
    if (!department) return json({ stats: { vacancies: 0, open: 0, applications: 0, interviews: 0, hires: 0 } });
    const jobIds = await Job.find({ department: new RegExp(`^${escapeRegex(department)}$`, 'i') }).distinct('_id');
    const applicationQuery = { job: { $in: jobIds } };
    const [vacancies, open, applications, interviews, hires] = await Promise.all([
      Job.countDocuments({ _id: { $in: jobIds } }),
      Job.countDocuments({ _id: { $in: jobIds }, status: 'open' }),
      Application.countDocuments(applicationQuery),
      Application.countDocuments({ ...applicationQuery, status: 'Interview' }),
      Application.countDocuments({ ...applicationQuery, status: 'Hired' }),
    ]);
    return json({ stats: { vacancies, open, applications, interviews, hires } });
  }

  const params = new URL(req.url).searchParams;
  const roleFilter = params.get('role') || '';
  const search = (params.get('search') || '').trim();
  const auditUser = (params.get('auditUser') || '').trim();
  const auditAction = (params.get('auditAction') || '').trim();
  if ((roleFilter && !roles.includes(roleFilter)) || [search, auditUser, auditAction].some((value) => value.length > 100)) {
    return json({ error: 'Check the role and search filters, then try again.' }, 400);
  }

  const userQuery = {};
  if (roleFilter) userQuery.role = roleFilter;
  if (search) {
    const pattern = new RegExp(escapeRegex(search), 'i');
    userQuery.$or = [{ name: pattern }, { email: pattern }];
  }
  const auditQuery = {};
  if (auditUser) auditQuery.user = new RegExp(escapeRegex(auditUser), 'i');
  if (auditAction) auditQuery.action = new RegExp(escapeRegex(auditAction), 'i');

  const start = monthStart();
  const months = recentMonths(start);
  const [
    totalUsers,
    activeUsers,
    inactiveUsers,
    consentGranted,
    consentMissing,
    failedLoginAttempts,
    securityEvents,
    totalVacancies,
    openVacancies,
    pendingVacancies,
    applicationCount,
    interviewCount,
    hireCount,
    users,
    audit,
    contacts,
    deletionRequests,
    roleCounts,
    applicationMonths,
    hireMonths,
    hiredApplications,
    agingJobs,
    skillRows,
    sourceRows,
    recruiterWeek,
    activeCandidates,
    recruiterHires,
    departments,
    industries,
    jobTypes,
  ] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ active: { $ne: false } }),
    User.countDocuments({ active: false }),
    User.countDocuments({ consentPOPIA: true }),
    User.countDocuments({ consentPOPIA: { $ne: true } }),
    Audit.countDocuments({ action: 'failed login attempt', createdAt: { $gte: new Date(Date.now() - 7 * 86400000) } }),
    Audit.find({ action: 'failed login attempt', createdAt: { $gte: new Date(Date.now() - 30 * 86400000) } }).select('user action createdAt').sort('-createdAt').limit(50).lean(),
    Job.countDocuments(),
    Job.countDocuments({ status: 'open' }),
    Job.countDocuments({ status: { $in: ['pending', 'changes_requested'] } }),
    Application.countDocuments(),
    Application.countDocuments({ status: 'Interview' }),
    Application.countDocuments({ status: 'Hired' }),
    User.find(userQuery).select('name email role department active deleteRequested createdAt').sort('-createdAt').limit(200).lean(),
    Audit.find(auditQuery).select('user action createdAt').sort('-createdAt').limit(100).lean(),
    Contact.find().select('name email phone subject message createdAt').sort('-createdAt').limit(100).lean(),
    User.find({ deleteRequested: true }).select('name email role createdAt').sort('createdAt').limit(100).lean(),
    User.aggregate([{ $group: { _id: '$role', count: { $sum: 1 } } }, { $sort: { _id: 1 } }]),
    applicationMonthly('createdAt', start),
    hireMonthly(start),
    Application.find({ status: 'Hired' }).select('createdAt updatedAt hiredAt source').lean(),
    Job.find({ status: { $in: ['open', 'pending', 'changes_requested'] } }).select('title status createdAt').sort('createdAt').limit(100).lean(),
    Job.aggregate([
      { $unwind: '$skills' },
      { $group: { _id: { $toLower: '$skills' }, count: { $sum: 1 } } },
      { $sort: { count: -1, _id: 1 } },
      { $limit: 10 },
    ]),
    Application.aggregate([
      { $match: { status: 'Hired' } },
      { $group: { _id: { $ifNull: ['$source', 'Not recorded'] }, count: { $sum: 1 } } },
      { $sort: { count: -1, _id: 1 } },
      { $limit: 10 },
    ]),
    Application.countDocuments({ createdAt: { $gte: new Date(Date.now() - 7 * 86400000) } }),
    Application.distinct('candidate', { status: { $nin: ['Hired', 'Rejected', 'Withdrawn'] } }),
    Application.countDocuments({ status: 'Hired', $or: [{ hiredAt: { $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) } }, { hiredAt: { $exists: false }, updatedAt: { $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) } }] }),
    Job.distinct('department', { department: { $type: 'string', $ne: '' } }),
    Job.distinct('industry', { industry: { $type: 'string', $ne: '' } }),
    Job.distinct('type', { type: { $type: 'string', $ne: '' } }),
  ]);

  const roleCountsByRole = Object.fromEntries(roles.map((role) => [role, 0]));
  for (const row of roleCounts) roleCountsByRole[row._id] = row.count;

  const applicationsByMonth = months.map(({ key, label }) => ({ label, count: applicationMonths.get(key) || 0 }));
  const hiresByMonth = months.map(({ key, label }) => ({ label, count: hireMonths.get(key) || 0 }));
  const timeToHire = hiredApplications.length
    ? Math.round(hiredApplications.reduce((total, application) =>
      total + Math.max(0, new Date(application.hiredAt || application.updatedAt).getTime() - new Date(application.createdAt).getTime()) / 86400000, 0) / hiredApplications.length)
    : null;
  const vacancyAging = agingJobs.map((job) => ({
    title: job.title,
    status: job.status,
    days: Math.max(0, Math.floor((Date.now() - new Date(job.createdAt).getTime()) / 86400000)),
  })).sort((a, b) => b.days - a.days).slice(0, 10);
  const topSkills = skillRows.map((row) => ({ skill: row._id, count: row.count }));
  const sourceOfHire = sourceRows.map((row) => ({ source: row._id || 'Not recorded', count: row.count }));

  return json({
    stats: {
      totalUsers,
      activeUsers,
      inactiveUsers,
      consentGranted,
      consentMissing,
      failedLoginAttempts,
      vacancies: totalVacancies,
      open: openVacancies,
      pending: pendingVacancies,
      applications: applicationCount,
      activeCandidates: activeCandidates.length,
      newApplicants: recruiterWeek,
      interviews: interviewCount,
      hires: hireCount,
      hiresThisMonth: recruiterHires,
      usersByRole: roleCountsByRole,
    },
    users: users.map((entry) => ({ ...entry, active: entry.active !== false })),
    audit,
    securityEvents,
    contacts,
    deletionRequests,
    departments: [...new Set([...departments, ...(await User.distinct('department', { role: 'hiring_manager', department: { $type: 'string', $ne: '' } }))])].sort(),
    industries: industries.filter((value) => typeof value === 'string').sort(),
    jobTypes: jobTypes.filter((value) => typeof value === 'string').sort(),
    reports: {
      applicationsByMonth,
      hiresByMonth,
      timeToHire,
      vacancyAging,
      sourceOfHire,
      topSkills,
    },
  });
}

export async function PATCH(req) {
  await db();
  const user = await me();
  if (!user || user.role !== 'admin') return deny();

  const body = await readBody(req);
  if (!body || typeof body.action !== 'string'
    || (body.action !== 'create_user' && (typeof body.id !== 'string' || !mongoose.isValidObjectId(body.id)))
    || (body.action === 'create_user' && body.id !== undefined)) {
    return json({ error: 'Choose a valid admin action and record.' }, 400);
  }

  if (body.action === 'change_role') {
    if (Object.keys(body).some((key) => !['action', 'id', 'role'].includes(key)) || !roles.includes(body.role)) {
      return json({ error: 'Choose a valid user role.' }, 400);
    }
    if (String(body.id) === String(user._id) && body.role !== 'admin') {
      return json({ error: 'You cannot remove your own administrator access.' }, 400);
    }
    const target = await User.findById(body.id);
    if (!target) return json({ error: 'That user could not be found.' }, 404);
    const previousRole = target.role;
    target.role = body.role;
    if (body.role !== 'hiring_manager') target.department = undefined;
    await target.save();
    await log(user.email, `user ${target.email} role changed from ${previousRole} to ${target.role}`);
    return json({ _id: target._id, name: target.name, email: target.email, role: target.role, department: target.department || '', active: target.active !== false });
  }

  if (body.action === 'create_user') {
    if (Object.keys(body).some((key) => !['action', 'id', 'name', 'email', 'password', 'role', 'department'].includes(key))
      || typeof body.name !== 'string' || !body.name.trim() || body.name.trim().length > 120
      || typeof body.email !== 'string' || body.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim())
      || typeof body.password !== 'string' || body.password.length < 8 || body.password.length > 128
      || !roles.includes(body.role)
      || (body.department !== undefined && (typeof body.department !== 'string' || body.department.trim().length > 120))) {
      return json({ error: 'Enter a name, valid email, password from 8 to 128 characters and a supported role.' }, 400);
    }
    const email = body.email.trim().toLowerCase();
    if (await User.exists({ email })) return json({ error: 'That email is already registered. Use another email address.' }, 409);
    let department = '';
    if (body.role === 'hiring_manager' && body.department?.trim()) {
      const availableDepartments = await Job.distinct('department');
      department = availableDepartments.find((value) =>
        typeof value === 'string' && value.trim().toLowerCase() === body.department.trim().toLowerCase()) || '';
      if (!department) return json({ error: 'Choose a department used by an existing vacancy, or leave the manager unassigned.' }, 400);
    }
    const target = await User.create({
      name: body.name.trim(),
      email,
      password: await bcrypt.hash(body.password, 10),
      role: body.role,
      ...(body.role === 'hiring_manager' ? { department } : {}),
      consentPOPIA: false,
    });
    await log(user.email, `user ${email} created with role ${target.role}`);
    return json({
      _id: target._id,
      name: target.name,
      email: target.email,
      role: target.role,
      department: target.department || '',
      active: target.active !== false,
      createdAt: target.createdAt,
    }, 201);
  }

  if (body.action === 'set_department') {
    if (Object.keys(body).some((key) => !['action', 'id', 'department'].includes(key))
      || typeof body.department !== 'string' || body.department.trim().length > 120) {
      return json({ error: 'Choose a department using no more than 120 characters.' }, 400);
    }
    const target = await User.findOne({ _id: body.id, role: 'hiring_manager' });
    if (!target) return json({ error: 'Department assignments are only available for hiring managers.' }, 404);
    const previousDepartment = target.department || '';
    const requestedDepartment = body.department.trim();
    if (requestedDepartment) {
      const availableDepartments = await Job.distinct('department');
      const matchingDepartment = availableDepartments.find((department) =>
        typeof department === 'string' && department.trim().toLowerCase() === requestedDepartment.toLowerCase());
      const keepsExistingDepartment = previousDepartment.toLowerCase() === requestedDepartment.toLowerCase();
      if (!matchingDepartment && !keepsExistingDepartment) {
        return json({ error: 'Choose a department used by an existing vacancy, or leave the manager unassigned.' }, 400);
      }
      target.department = matchingDepartment || previousDepartment;
    } else {
      target.department = '';
    }
    await target.save();
    await log(user.email, `hiring manager ${target.email} department changed from "${previousDepartment}" to "${target.department}"`);
    return json({ _id: target._id, name: target.name, email: target.email, role: target.role, department: target.department, active: target.active !== false });
  }

  if (body.action === 'set_active') {
    if (Object.keys(body).some((key) => !['action', 'id', 'active'].includes(key)) || typeof body.active !== 'boolean') {
      return json({ error: 'Choose whether to activate or deactivate this account.' }, 400);
    }
    if (String(body.id) === String(user._id) && !body.active) {
      return json({ error: 'You cannot deactivate your own administrator account.' }, 400);
    }
    const target = await User.findById(body.id);
    if (!target) return json({ error: 'That user could not be found.' }, 404);
    target.active = body.active;
    await target.save();
    await log(user.email, `user ${target.email} ${body.active ? 'activated' : 'deactivated'}`);
    return json({ _id: target._id, name: target.name, email: target.email, role: target.role, active: target.active });
  }

  if (body.action === 'deletion_request') {
    if (Object.keys(body).some((key) => !['action', 'id', 'decision'].includes(key))
      || !['approve', 'decline'].includes(body.decision)) {
      return json({ error: 'Choose approve or decline for this deletion request.' }, 400);
    }
    const target = await User.findOne({ _id: body.id, deleteRequested: true });
    if (!target) return json({ error: 'That pending data-deletion request could not be found.' }, 404);
    if (String(target._id) === String(user._id)) return json({ error: 'You cannot process your own deletion request.' }, 400);
    if (body.decision === 'decline') {
      target.deleteRequested = false;
      await target.save();
      await log(user.email, `POPIA deletion request declined for ${target.email}`);
      return json({ ok: true, decision: 'declined' });
    }

    const targetId = target._id;
    const targetEmail = target.email;
    await log(user.email, `POPIA deletion request approved for ${targetEmail}`);
    await Promise.all([
      Application.deleteMany({ candidate: targetId }),
      Application.updateMany(
        { $or: [{ interviewer: targetId }, { panelMembers: targetId }, { 'scorecards.by': targetId }] },
        { $pull: { panelMembers: targetId, scorecards: { by: targetId } } },
      ),
      Application.updateMany({ interviewer: targetId }, { $unset: { interviewer: '' } }),
      Notification.deleteMany({ user: targetId }),
      Chat.deleteMany({ user: targetEmail }),
      Contact.deleteMany({ email: targetEmail }),
      Job.updateMany({ createdBy: targetId }, { $unset: { createdBy: '' } }),
      Audit.updateMany({ user: targetEmail }, { $set: { user: 'deleted user' } }),
      User.deleteOne({ _id: targetId }),
    ]);
    return json({ ok: true, decision: 'approved' });
  }

  return json({ error: 'Choose a supported admin action.' }, 400);
}
