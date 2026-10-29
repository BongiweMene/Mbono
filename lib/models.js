import mongoose from 'mongoose';

const model = (name, schema) => mongoose.models[name] || mongoose.model(name, new mongoose.Schema(schema, { timestamps: true }));
const ObjectId = mongoose.Schema.Types.ObjectId;

export const User = model('User', {
  name: String,
  email: { type: String, unique: true },
  password: String,
  role: { type: String, default: 'candidate' },
  department: String,
  active: { type: Boolean, default: true },
  phone: String,
  address: String,
  idPassportNumber: String,
  employmentHistory: [{ company: String, jobTitle: String, startDate: String, endDate: String, description: String }],
  educationHistory: [{ institution: String, qualification: String, year: String }],
  certifications: [{ name: String, issuer: String, year: String }],
  references: [{ name: String, company: String, phone: String, email: String }],
  skills: [String],
  languages: [String],
  education: String,
  experience: String,
  cvName: String,
  cvContentType: String,
  cvData: Buffer,
  savedJobs: [{ type: ObjectId, ref: 'Job' }],
  consentPOPIA: Boolean,
  deleteRequested: Boolean,
});

export const Job = model('Job', {
  title: String,
  company: { type: String, default: 'Mbono' },
  location: String,
  workMode: { type: String, default: 'On-site' },
  industry: String,
  department: String,
  type: String,
  salary: String,
  skills: [String],
  description: String,
  responsibilities: [String],
  requirements: [String],
  preferred: [String],
  hours: String,
  additional: String,
  questions: [String],
  deadline: Date,
  status: { type: String, default: 'pending' },
  approvalComment: String,
  createdBy: ObjectId,
});

export const Application = model('Application', {
  job: { type: ObjectId, ref: 'Job' },
  candidate: { type: ObjectId, ref: 'User' },
  status: { type: String, default: 'Received' },
  source: { type: String, default: 'Website' },
  hiredAt: Date,
  score: Number,
  coverLetter: String,
  notes: [String],
  interview: String,
  interviewer: { type: ObjectId, ref: 'User' },
  panelMembers: [{ type: ObjectId, ref: 'User' }],
  interviewDate: Date,
  meetingLink: String,
  scorecards: [{
    by: { type: ObjectId, ref: 'User' },
    ratings: { skills: Number, communication: Number, cultureFit: Number },
    recommendation: { type: String, enum: ['hire', 'maybe', 'no hire'] },
    comments: String,
    submittedAt: Date,
  }],
  offerApproved: { type: Boolean, default: false },
  offerReviewComment: String,
});

export const Notification = model('Notification', {
  user: { type: ObjectId, ref: 'User', required: true },
  text: { type: String, required: true },
  read: { type: Boolean, default: false },
});

export const Audit = model('Audit', { user: String, action: String });
export const Chat = model('Chat', { user: String, text: String, handoff: Boolean });
export const Contact = model('Contact', { name: String, email: String, phone: String, subject: String, message: String });
