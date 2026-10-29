import mongoose from 'mongoose';
import { db } from '@/lib/db';
import { Application, Job, Notification, User } from '@/lib/models';
import { me, log, json, deny } from '@/lib/auth';

const statuses = ['Received', 'Under Review', 'Shortlisted', 'Assessment', 'Interview', 'Offer Made', 'Hired', 'Rejected'];
const staff = ['recruiter', 'hiring_manager', 'admin'];
const departmentPattern = (department) => new RegExp(`^${department.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
const readBody = async (req) => {
  try {
    const body = await req.json();
    return body && typeof body === 'object' && !Array.isArray(body) ? body : null;
  } catch {
    return null;
  }
};

export async function GET() {
  await db();
  const user = await me();
  if (!user || !['candidate', ...staff, 'interviewer'].includes(user.role)) return deny();
  if (user.role === 'admin') return deny();
  let query = {};
  if (user.role === 'candidate') query = { candidate: user._id };
  if (user.role === 'interviewer') {
    query = {
      interviewDate: { $exists: true },
      status: { $ne: 'Withdrawn' },
      $or: [{ interviewer: user._id }, { panelMembers: user._id }],
    };
  }
  if (user.role === 'hiring_manager') {
    const departmentJobIds = user.department?.trim()
      ? await Job.find({ department: departmentPattern(user.department) }).distinct('_id')
      : [];
    query = {
      job: { $in: departmentJobIds },
      $or: [
        { status: { $in: ['Shortlisted', 'Assessment', 'Offer Made', 'Hired'] } },
        { status: 'Interview', panelMembers: user._id },
      ],
    };
  }
  if (user.role === 'recruiter') {
    query = { job: { $in: await Job.find({ createdBy: user._id }).distinct('_id') } };
  }
  const candidateFields = ['interviewer', 'hiring_manager'].includes(user.role)
    ? 'name skills experience education cvName employmentHistory.company employmentHistory.jobTitle educationHistory.qualification educationHistory.institution'
    : user.role === 'recruiter' ? 'name skills educationHistory.qualification' : 'name';
  let applicationsQuery = Application.find(query);
  if (user.role === 'candidate') {
    applicationsQuery = applicationsQuery.select('job candidate status score interviewDate meetingLink createdAt updatedAt');
    applicationsQuery = applicationsQuery.populate('interviewer', 'name');
  }
  if (user.role === 'interviewer') {
    const interviewerApplications = await applicationsQuery
      .select('job candidate status interviewDate meetingLink interviewer panelMembers scorecards createdAt updatedAt')
      .populate('job', 'title company location type description skills')
      .populate('candidate', 'name skills experience education employmentHistory.company employmentHistory.jobTitle educationHistory.qualification educationHistory.institution cvName')
      .populate('interviewer', 'name role')
      .populate('panelMembers', 'name role')
      .lean()
      .sort('interviewDate')
      .limit(200);
    return json(interviewerApplications.map((application) => ({
      ...application,
      scorecards: (application.scorecards || []).filter((scorecard) => String(scorecard.by) === String(user._id)),
    })));
  }
  if (user.role === 'recruiter') applicationsQuery = applicationsQuery.populate('interviewer', 'name email');
  if (user.role === 'hiring_manager') applicationsQuery = applicationsQuery.populate('scorecards.by', 'name role');
  return json(await applicationsQuery
    .populate('job', 'title company department location type salary deadline skills createdAt')
    .populate('candidate', candidateFields)
    .populate('panelMembers', 'name email role')
    .sort('-createdAt')
    .limit(200));
}

export async function POST(req) {
  await db();
  const user = await me();
  if (!user || user.role !== 'candidate') return deny();

  const body = await readBody(req);
  if (!body || typeof body.jobId !== 'string' || !mongoose.isValidObjectId(body.jobId)) {
    return json({ error: 'Choose a valid vacancy before applying.' }, 400);
  }
  if (body.coverLetter !== undefined && (typeof body.coverLetter !== 'string' || body.coverLetter.length > 5000)) {
    return json({ error: 'Your cover letter must be 5,000 characters or fewer.' }, 400);
  }
  const job = await Job.findOne({ _id: body.jobId, status: 'open' });
  if (!job) return json({ error: 'This vacancy is no longer open. Choose another open job.' }, 404);
  if (await Application.findOne({ job: job._id, candidate: user._id })) {
    return json({ error: 'You already applied for this vacancy.' }, 400);
  }

  const skills = new Set((user.skills || []).map((skill) => skill.toLowerCase()));
  const requiredSkills = (job.skills || []).map((skill) => skill.toLowerCase());
  const score = requiredSkills.length
    ? Math.round((requiredSkills.filter((skill) => skills.has(skill)).length / requiredSkills.length) * 100)
    : 50;
  const application = await Application.create({
    job: job._id,
    candidate: user._id,
    source: 'Website',
    coverLetter: (body.coverLetter || '').trim(),
    score,
  });
  await log(user.email, `applied ${job.title}`);
  return json(application, 201);
}

export async function PATCH(req) {
  await db();
  const user = await me();
  if (!user || !['candidate', ...staff, 'interviewer'].includes(user.role)) return deny();
  if (user.role === 'admin') {
    await log(user.email, 'administrator attempted direct application update');
    return deny();
  }

  const body = await readBody(req);
  if (!body || typeof body.id !== 'string' || !mongoose.isValidObjectId(body.id)) {
    return json({ error: 'Choose a valid application to update.' }, 400);
  }
  const application = await Application.findById(body.id);
  if (!application) return json({ error: 'That application could not be found.' }, 404);

  if (user.role === 'interviewer') {
    if (Object.keys(body).some((key) => !['id', 'scorecard'].includes(key)) || !body.scorecard) return deny();
    const assignedToInterviewer = String(application.interviewer) === String(user._id)
      || application.panelMembers.some((member) => String(member) === String(user._id));
    if (!assignedToInterviewer || application.status !== 'Interview' || !application.interviewDate) return deny();
    const { ratings, recommendation, comments } = body.scorecard;
    const ratingKeys = ['skills', 'communication', 'cultureFit'];
    if (!body.scorecard || Object.keys(body.scorecard).some((key) => !['ratings', 'recommendation', 'comments'].includes(key))
      || !ratings || typeof ratings !== 'object' || Array.isArray(ratings)
      || Object.keys(ratings).some((key) => !ratingKeys.includes(key))
      || ratingKeys.some((key) => !Number.isInteger(ratings[key]) || ratings[key] < 1 || ratings[key] > 5)
      || !['hire', 'maybe', 'no hire'].includes(recommendation)
      || typeof comments !== 'string'
      || comments.length > 3000) {
      return json({ error: 'Rate skills, communication and culture fit from 1 to 5, choose a recommendation, and keep comments under 3,000 characters.' }, 400);
    }
    if (application.scorecards.some((scorecard) => String(scorecard.by) === String(user._id))) {
      return json({ error: 'You have already submitted your scorecard for this interview.' }, 400);
    }
    application.scorecards.push({ by: user._id, ratings, recommendation, comments: comments.trim(), submittedAt: new Date() });
    await application.save();
    await log(user.email, `interview scorecard submitted for application ${application._id}`);
    return json(application);
  }

  if (user.role === 'candidate') {
    if (Object.keys(body).some((key) => !['id', 'status'].includes(key))
      || String(application.candidate) !== String(user._id)
      || body.status !== 'Withdrawn'
      || ['Hired', 'Rejected', 'Withdrawn'].includes(application.status)) {
      return deny();
    }
    application.status = 'Withdrawn';
    await application.save();
    await log(user.email, `application ${application._id} withdrawn`);
    return json(application);
  }

  if (!staff.includes(user.role)) return deny();
  if (user.role === 'hiring_manager') {
    const job = await Job.findOne({
      _id: application.job,
      department: user.department?.trim() ? departmentPattern(user.department) : { $in: [] },
    }).select('_id');
    if (!job) return deny();
  }
  if (user.role === 'recruiter') {
    const job = await Job.findOne({ _id: application.job, createdBy: user._id }).select('_id');
    if (!job) return deny();
  }
  const allowedKeys = ['id', 'status', 'note', 'interviewDate', 'meetingLink', 'interviewerId', 'interviewerEmail', 'interviewerEmails', 'offerApproved', 'offerReviewComment', 'scorecard'];
  if (Object.keys(body).some((key) => !allowedKeys.includes(key))) return json({ error: 'The application update contains unsupported fields.' }, 400);
  if (body.scorecard !== undefined) {
    if (user.role !== 'hiring_manager'
      || !application.panelMembers.some((member) => String(member) === String(user._id))
      || application.status !== 'Interview'
      || !application.interviewDate) return deny();
    const { ratings, recommendation, comments } = body.scorecard || {};
    const ratingKeys = ['skills', 'communication', 'cultureFit'];
    if (Object.keys(body.scorecard || {}).some((key) => !['ratings', 'recommendation', 'comments'].includes(key))
      || !ratings || typeof ratings !== 'object' || Array.isArray(ratings)
      || Object.keys(ratings).some((key) => !ratingKeys.includes(key))
      || ratingKeys.some((key) => !Number.isInteger(ratings[key]) || ratings[key] < 1 || ratings[key] > 5)
      || !['hire', 'maybe', 'no hire'].includes(recommendation)
      || typeof comments !== 'string'
      || comments.length > 3000) {
      return json({ error: 'Rate skills, communication and culture fit from 1 to 5, choose a recommendation, and keep comments under 3,000 characters.' }, 400);
    }
    if (application.scorecards.some((scorecard) => String(scorecard.by) === String(user._id))) {
      return json({ error: 'You have already submitted your scorecard for this interview.' }, 400);
    }
    application.scorecards.push({ by: user._id, ratings, recommendation, comments: comments.trim(), submittedAt: new Date() });
    await application.save();
    await log(user.email, `hiring manager scorecard submitted for application ${application._id}`);
    return json({ ok: true });
  }
  if ((body.offerApproved !== undefined || body.offerReviewComment !== undefined) && user.role !== 'hiring_manager') {
    return deny();
  }
  if (body.offerApproved !== undefined && (typeof body.offerApproved !== 'boolean' || application.status !== 'Offer Made')) {
    return json({ error: 'Only an application at Offer Made can have its offer approved or returned for changes.' }, 400);
  }
  if (body.offerReviewComment !== undefined && (typeof body.offerReviewComment !== 'string' || body.offerReviewComment.trim().length > 2000)) {
    return json({ error: 'Offer review comments must be 2,000 characters or fewer.' }, 400);
  }
  if (body.offerApproved === false && !body.offerReviewComment?.trim()) {
    return json({ error: 'Add a comment explaining what needs to change before returning this offer.' }, 400);
  }
  if (body.status !== undefined) {
    if (!statuses.includes(body.status)) return json({ error: 'Choose a valid application status.' }, 400);
    if (body.status === 'Hired' && !application.offerApproved) {
      return json({ error: 'An approved offer is required before marking this candidate as hired.' }, 400);
    }
  }
  if (body.note !== undefined && (typeof body.note !== 'string' || body.note.trim().length > 2000)) {
    return json({ error: 'Notes must be 2,000 characters or fewer.' }, 400);
  }
  if (body.interviewDate !== undefined && (typeof body.interviewDate !== 'string'
    || Number.isNaN(Date.parse(body.interviewDate))
    || new Date(body.interviewDate) <= new Date())) {
    return json({ error: 'Enter an interview date and time in the future.' }, 400);
  }
  if (body.status === 'Interview' && (!body.interviewDate
    || (!body.interviewerId && !body.interviewerEmail && !body.interviewerEmails && !application.interviewer)
    || (!body.meetingLink && !application.meetingLink))) {
    return json({ error: 'Set a future interview date, meeting link and interviewer before moving this application to Interview.' }, 400);
  }
  if (body.meetingLink !== undefined) {
    if (typeof body.meetingLink !== 'string' || body.meetingLink.length > 2048) return json({ error: 'Enter a valid meeting link.' }, 400);
    try {
      const link = new URL(body.meetingLink);
      if (!['http:', 'https:'].includes(link.protocol)) throw new Error('Unsupported protocol');
    } catch {
      return json({ error: 'Enter a valid meeting link beginning with https://.' }, 400);
    }
  }
  if ((body.interviewerId !== undefined || body.interviewerEmail !== undefined || body.interviewerEmails !== undefined)
    && !['recruiter', 'hiring_manager', 'admin'].includes(user.role)) return deny();
  let assignedPanel = null;
  if (body.interviewerEmails !== undefined) {
    if (!Array.isArray(body.interviewerEmails) || body.interviewerEmails.length < 1 || body.interviewerEmails.length > 10
      || body.interviewerEmails.some((email) => typeof email !== 'string' || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))) {
      return json({ error: 'Enter between 1 and 10 valid interviewer email addresses.' }, 400);
    }
    const emails = [...new Set(body.interviewerEmails.map((email) => email.trim().toLowerCase()))];
    assignedPanel = await User.find({ email: { $in: emails }, role: 'interviewer' }).select('_id email');
    if (assignedPanel.length !== emails.length) return json({ error: 'Every panel member must have an active interviewer account.' }, 400);
  }
  if (body.interviewerId !== undefined && body.interviewerEmail !== undefined) {
    return json({ error: 'Choose one primary interviewer.' }, 400);
  }
  if (body.interviewerId !== undefined || body.interviewerEmail !== undefined) {
    if (body.interviewerEmail !== undefined && (typeof body.interviewerEmail !== 'string'
      || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.interviewerEmail.trim())
      || body.interviewerEmail.length > 254)) {
      return json({ error: 'Enter the valid email address of an interviewer.' }, 400);
    }
    const interviewerQuery = body.interviewerId !== undefined
      ? mongoose.isValidObjectId(body.interviewerId) ? { _id: body.interviewerId, role: 'interviewer' } : null
      : { email: body.interviewerEmail.trim().toLowerCase(), role: 'interviewer' };
    if (!interviewerQuery) return json({ error: 'Choose a valid interviewer.' }, 400);
    const interviewer = await User.findOne(interviewerQuery).select('_id');
    if (!interviewer) return json({ error: 'Choose an active interviewer account.' }, 400);
    application.interviewer = interviewer._id;
  }

  const changed = [];
  if (body.status !== undefined) {
    const previousStatus = application.status;
    application.status = body.status;
    if (body.status === 'Offer Made') application.offerApproved = false;
    if (body.status === 'Hired') application.hiredAt = new Date();
    else if (previousStatus === 'Hired') application.hiredAt = undefined;
    changed.push(`status changed to ${body.status}`);
  }
  if (body.note?.trim()) {
    application.notes.push(`${user.name}: ${body.note.trim()}`);
    changed.push('note added');
  }
  if (body.interviewDate !== undefined) {
    application.interviewDate = new Date(body.interviewDate);
    changed.push('interview scheduled');
  }
  if (body.meetingLink !== undefined) application.meetingLink = body.meetingLink.trim();
  if (body.interviewerId !== undefined || body.interviewerEmail !== undefined) changed.push('interviewer assigned');
  if (assignedPanel) {
    application.panelMembers = [...new Set([...assignedPanel.map((member) => String(member._id)), String(user._id)])];
    application.interviewer = assignedPanel[0]._id;
    changed.push('interview panel assigned');
  }
  if (body.offerApproved !== undefined) {
    application.offerApproved = body.offerApproved;
    application.offerReviewComment = body.offerApproved ? '' : body.offerReviewComment.trim();
    changed.push(body.offerApproved ? 'offer approved' : 'offer returned for changes');
  }
  if (body.offerReviewComment !== undefined && body.offerApproved === undefined) {
    application.offerReviewComment = body.offerReviewComment.trim();
  }
  if (changed.length === 0) return json({ error: 'Add a valid status, note or interview update.' }, 400);

  await application.save();
  const job = await Job.findById(application.job).select('title');
  if (body.status !== undefined) {
    await Notification.create({ user: application.candidate, text: `Your application for ${job?.title || 'a vacancy'} was updated to ${application.status}.` });
  }
  if (body.interviewDate !== undefined) {
    await Notification.create({ user: application.candidate, text: `An interview for ${job?.title || 'a vacancy'} has been scheduled.` });
  }
  if (body.interviewDate !== undefined && application.interviewer) {
    const panel = application.panelMembers?.length ? application.panelMembers : [application.interviewer];
    await Notification.insertMany([...new Set(panel.map(String))].map((memberId) => ({
      user: memberId,
      text: `You have been assigned an interview for ${job?.title || 'a vacancy'}.`,
    })));
  }
  if (body.offerApproved !== undefined) {
    await Notification.create({
      user: application.candidate,
      text: body.offerApproved
        ? `Your offer for ${job?.title || 'a vacancy'} has been approved.`
        : `Your offer for ${job?.title || 'a vacancy'} needs changes: ${application.offerReviewComment}`,
    });
    const postingRecruiter = await Job.findById(application.job).select('createdBy');
    if (postingRecruiter?.createdBy) {
      await Notification.create({
        user: postingRecruiter.createdBy,
        text: body.offerApproved
          ? `The offer for ${job?.title || 'a vacancy'} has been approved.`
          : `The offer for ${job?.title || 'a vacancy'} needs changes: ${application.offerReviewComment}`,
      });
    }
  }
  await log(user.email, `application ${application._id}: ${changed.join(', ')}`);
  return json(application);
}
