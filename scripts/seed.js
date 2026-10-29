const fs = require('fs');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// read .env.local
fs.readFileSync('.env.local', 'utf8').split(/\r?\n/).forEach((l) => {
  const i = l.indexOf('=');
  if (i > 0 && !l.startsWith('#')) process.env[l.slice(0, i).trim()] = l.slice(i + 1).trim();
});

const loose = (n) => mongoose.models[n] || mongoose.model(n, new mongoose.Schema({}, { strict: false, timestamps: true }));
const User = loose('User'), Job = loose('Job'), Application = loose('Application');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const password = await bcrypt.hash('Mbono@2026', 10);
  const people = [
    ['Admin User', process.env.ADMIN_EMAIL || 'admin@mbono.co.za', 'admin', []],
    ['Rita Recruiter', 'recruiter@mbono.co.za', 'recruiter', []],
    ['Hennie Manager', 'manager@mbono.co.za', 'hiring_manager', []],
    ['Ivy Interviewer', 'interviewer@mbono.co.za', 'interviewer', []],
    ['Thandi Candidate', 'thandi@example.com', 'candidate', ['excel', 'sql', 'reporting']],
    ['Sipho Candidate', 'sipho@example.com', 'candidate', ['javascript', 'react', 'node']],
  ];
  const users = {};
  for (const [name, email, role, skills] of people) {
    users[email] = await User.findOneAndUpdate({ email }, { name, email, role, skills, password, consentPOPIA: true }, { upsert: true, new: true });
  }
  const rec = users['recruiter@mbono.co.za']._id;
  const jobs = [
    ['Data Analyst', 'Gqeberha', 'Finance', 'Full-time', 'R35,000 - R45,000', ['excel', 'sql', 'reporting']],
    ['Frontend Developer', 'Remote', 'Technology', 'Full-time', 'R40,000 - R55,000', ['javascript', 'react', 'css']],
    ['HR Intern', 'Cape Town', 'Human Resources', 'Internship', 'R8,000', ['communication', 'excel']],
  ];
  const made = [];
  for (const [title, location, industry, type, salary, skills] of jobs) {
    made.push(await Job.findOneAndUpdate({ title }, { title, company: 'Mbono', location, industry, type, salary, skills, description: `${title} role at Mbono.`, status: 'open', createdBy: rec }, { upsert: true, new: true }));
  }
  const apps = [['thandi@example.com', 0, 'Shortlisted', 100], ['sipho@example.com', 1, 'Under Review', 67], ['thandi@example.com', 2, 'Received', 50]];
  for (const [email, j, status, score] of apps) {
    await Application.findOneAndUpdate({ job: made[j]._id, candidate: users[email]._id }, { status, score }, { upsert: true });
  }
  console.log('Seed complete. Password for every account: Mbono@2026');
  process.exit(0);
})().catch((e) => { console.error(e.message); process.exit(1); });