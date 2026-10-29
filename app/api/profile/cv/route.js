import { db } from '@/lib/db';
import { Application, Job, User } from '@/lib/models';
import { me, log, json, deny } from '@/lib/auth';

const maxCvSize = 4 * 1024 * 1024;
const contentTypes = { pdf: 'application/pdf', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' };
const departmentPattern = (department) => new RegExp(`^${department.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');

export async function GET(req) {
  await db();
  const user = await me();
  if (!user || !['candidate', 'hiring_manager', 'interviewer'].includes(user.role)) return deny();
  const applicationId = new URL(req.url).searchParams.get('applicationId');
  let candidateId = user._id;
  if (user.role === 'candidate' && applicationId) return deny();
  if (user.role === 'interviewer') {
    if (!applicationId || !/^[a-f\d]{24}$/i.test(applicationId)) return json({ error: 'Choose a valid assigned interview before viewing a CV.' }, 400);
    const application = await Application.findOne({
      _id: applicationId,
      interviewDate: { $exists: true },
      status: { $ne: 'Withdrawn' },
      $or: [{ interviewer: user._id }, { panelMembers: user._id }],
    }).select('candidate');
    if (!application) return deny();
    candidateId = application.candidate;
  }
  if (user.role === 'hiring_manager') {
    if (!applicationId || !/^[a-f\d]{24}$/i.test(applicationId) || !user.department?.trim()) return json({ error: 'Choose a valid shortlisted candidate CV.' }, 400);
    const application = await Application.findOne({
      _id: applicationId,
      $or: [
        { status: { $in: ['Shortlisted', 'Assessment', 'Offer Made', 'Hired'] } },
        { status: 'Interview', panelMembers: user._id },
      ],
    }).select('candidate job');
    if (!application) return deny();
    if (!await Job.exists({ _id: application.job, department: departmentPattern(user.department) })) return deny();
    candidateId = application.candidate;
  }
  const cv = await User.findById(candidateId).select('cvData cvName cvContentType');
  if (!cv?.cvData || !cv.cvName || !cv.cvContentType) {
    return json({ error: 'You have not uploaded a CV yet. Choose a PDF or DOCX file in your profile.' }, 404);
  }
  if (user.role !== 'candidate') await log(user.email, `viewed candidate CV for assigned interview`);
  const filename = cv.cvName.replace(/[^\w.-]/g, '_');
  return new Response(cv.cvData, {
    headers: {
      'Content-Type': cv.cvContentType,
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

export async function PUT(req) {
  await db();
  const user = await me();
  if (!user || user.role !== 'candidate') return deny();

  let form;
  try {
    form = await req.formData();
  } catch {
    return json({ error: 'The CV upload could not be read. Choose a PDF or DOCX file and try again.' }, 400);
  }
  const file = form.get('cv');
  if (!file || typeof file.arrayBuffer !== 'function' || typeof file.name !== 'string') {
    return json({ error: 'Choose a PDF or DOCX file to upload.' }, 400);
  }
  if (!file.size || file.size > maxCvSize) {
    return json({ error: 'Your CV must be between 1 byte and 4 MB. Choose a smaller file and try again.' }, 400);
  }
  const extension = file.name.split('.').pop()?.toLowerCase();
  if (!['pdf', 'docx'].includes(extension)) {
    return json({ error: 'Upload your CV as a PDF or DOCX file.' }, 400);
  }
  const data = Buffer.from(await file.arrayBuffer());
  const isPdf = extension === 'pdf' && data.subarray(0, 5).toString() === '%PDF-';
  const isDocx = extension === 'docx' && data.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
  if (!isPdf && !isDocx) {
    return json({ error: 'The file contents do not match a valid PDF or DOCX document. Check the file and try again.' }, 400);
  }
  const filename = file.name.replace(/[^\w.-]/g, '_').slice(-160) || `candidate-cv.${extension}`;
  await user.updateOne({
    $set: { cvName: filename, cvContentType: contentTypes[extension], cvData: data },
  });
  await log(user.email, `candidate CV uploaded (${extension})`);
  return json({ cvName: filename, message: 'Your CV has been uploaded.' });
}

export async function DELETE() {
  await db();
  const user = await me();
  if (!user || user.role !== 'candidate') return deny();
  if (!user.cvName) return json({ error: 'There is no CV to remove.' }, 404);
  await user.updateOne({ $unset: { cvName: '', cvContentType: '', cvData: '' } });
  await log(user.email, 'candidate CV removed');
  return json({ message: 'Your CV has been removed.' });
}
