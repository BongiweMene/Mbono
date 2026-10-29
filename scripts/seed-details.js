const fs = require('fs'), mongoose = require('mongoose'), bcrypt = require('bcryptjs');
fs.readFileSync('.env.local', 'utf8').split(/\r?\n/).forEach((l) => { const i = l.indexOf('='); if (i > 0 && !l.startsWith('#')) process.env[l.slice(0, i).trim()] = l.slice(i + 1).trim(); });
const loose = (n) => mongoose.models[n] || mongoose.model(n, new mongoose.Schema({}, { strict: false, timestamps: true }));
const Job = loose('Job'), User = loose('User');
const D = {
  'Data Analyst': { workMode: 'Hybrid', type: 'Permanent', deadline: new Date(Date.now() + 30 * 864e5), description: 'Join the Mbono insights team and turn data into clear decisions.\n\nYou will build reports, keep data accurate and present findings to managers.', responsibilities: ['Build weekly and monthly reports', 'Clean and validate data', 'Present insights to managers'], requirements: ['Diploma or degree in IT, statistics or finance', '1 year of relevant experience'], preferred: ['Power BI experience', 'Experience in a BPO or GBS environment'], hours: 'Monday to Friday, 08:00 to 17:00. Occasional month-end overtime.', additional: 'Two office days a week in Gqeberha.', questions: ['Which tools have you used for data analysis?'] },
  'Frontend Developer': { workMode: 'Remote', type: 'Contract', deadline: new Date(Date.now() + 21 * 864e5), description: 'Build friendly, accessible web interfaces for Mbono platforms.', responsibilities: ['Build and test React components', 'Work with designers and the backend team'], requirements: ['Degree or diploma in IT', 'Portfolio of web projects'], preferred: ['Next.js experience'], hours: 'Flexible hours, 40 per week, with a daily check-in.', additional: '12-month contract with possible extension.', questions: [] },
  'HR Intern': { workMode: 'On-site', type: 'Temporary', deadline: new Date(Date.now() + 14 * 864e5), description: 'A 6-month internship supporting the recruitment and HR team.', responsibilities: ['Support CV screening', 'Schedule interviews', 'Keep HR records up to date'], requirements: ['Studying or completed an HR or business qualification', 'Good communication skills'], preferred: ['Experience with Microsoft Office'], hours: 'Monday to Friday, 08:00 to 16:30.', additional: 'Stipend paid monthly.', questions: [] },
};
(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  for (const [t, d] of Object.entries(D)) await Job.updateOne({ title: t }, { $set: { ...d, company: 'Mbono' } });
  await User.findOneAndUpdate({ email: 'support@mbono.co.za' }, { name: 'Sam Support', email: 'support@mbono.co.za', role: 'support', consentPOPIA: true, password: await bcrypt.hash('Mbono@2026', 10) }, { upsert: true });
  console.log('Done. Support login: support@mbono.co.za / Mbono@2026'); process.exit(0);
})().catch((e) => { console.error(e.message); process.exit(1); });
